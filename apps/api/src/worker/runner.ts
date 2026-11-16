import { pool, query, transaction } from '../db/pool.js';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
import { settleVideoCredits } from '../billing/common.js';
import { reconcilePendingRefunds } from '../billing/stripe.js';
import { ProviderError, pollVideo, submitVideo, type StoredJob } from '../provider/client.js';
let running=false;
type ClaimedJob=StoredJob & {status:string; attempts:number};
async function claimJobs():Promise<ClaimedJob[]> {
  return transaction(async db=>{
    // Only queue or safely poll known upstream IDs. Never blindly resubmit stale "submitting" tasks.
    const selected=await db.query<ClaimedJob>(`SELECT * FROM video_jobs
      WHERE ((status='queued') OR (status IN ('pending','polling') AND next_poll_at<=now()))
      AND (lease_until IS NULL OR lease_until<now())
      ORDER BY created_at ASC LIMIT 4 FOR UPDATE SKIP LOCKED`);
    for(const job of selected.rows) {
      await db.query(`UPDATE video_jobs SET lease_until=now()+interval '120 seconds',
        status=CASE WHEN status='queued' THEN 'submitting' ELSE status END,
        attempts=attempts+1,updated_at=now() WHERE id=$1`,[job.id]);
    }
    return selected.rows;
  });
}
async function runJob(job:ClaimedJob) {
  if(job.status==='queued') {
    try {
      const submitted=await submitVideo(job);
      await query(`UPDATE video_jobs SET provider_task_id=$2, status='pending',progress=0,
        required_credits=$3,billing_status=$4,submitted_at=now(),next_poll_at=now()+interval '5 seconds',
        lease_until=NULL,provider_is_mock=$5,updated_at=now() WHERE id=$1 AND status='submitting'`,
        [job.id,submitted.taskId,submitted.requiredCredits,submitted.billingStatus,config.mockProvider]);
      await query(`INSERT INTO audit_logs(org_id,actor_id,action,detail) VALUES ($1,NULL,'job.submitted',$2)`,[job.org_id,JSON.stringify({jobId:job.id})]);
    }catch(error) {
      const ambiguous=error instanceof ProviderError?error.ambiguous:!(error instanceof AppError);
      const msg=error instanceof Error?error.message:'上游提交失败';
      await query(`UPDATE video_jobs SET status=$2,error_message=$3,error_code=$4,finished_at=CASE WHEN $2='failed' THEN now() ELSE NULL END,
        lease_until=NULL,updated_at=now() WHERE id=$1`,[job.id,ambiguous?'submission_unknown':'failed',msg.slice(0,500),ambiguous?'SUBMISSION_UNCERTAIN':'PROVIDER_REJECTED']);
      if(!ambiguous) await settleVideoCredits(job.id,'failed');
      console.error('[worker] submit',job.id,msg);
    }
    return;
  }
  if(!job.provider_task_id) {await query(`UPDATE video_jobs SET status='submission_unknown',error_message='没有上游 task_id，无法安全重新提交',lease_until=NULL WHERE id=$1`,[job.id]);return;}
  try {
    const result=await pollVideo(job);
    const afterTwoMinutes=(job.submitted_at?Date.now()-job.submitted_at.getTime()>120_000:false);
    const interval=afterTwoMinutes?15:5;
    await query(`UPDATE video_jobs SET status=$2,progress=$3,video_url=COALESCE($4,video_url),
      billing_status=COALESCE($5,billing_status),error_code=$6,error_message=$7,
      next_poll_at=CASE WHEN $2 IN ('success','failed') THEN NULL ELSE now()+($8::int * interval '1 second') END,
      finished_at=CASE WHEN $2 IN ('success','failed') THEN now() ELSE NULL END,
      lease_until=NULL,updated_at=now() WHERE id=$1`,
      [job.id,result.status,result.progress,result.videoUrl,result.billingStatus,result.errorCode,result.errorMessage,interval]);
    if(result.status==='success'||result.status==='failed') await settleVideoCredits(job.id,result.status);
    if(['success','failed'].includes(result.status)) await query(`INSERT INTO audit_logs(org_id,actor_id,action,detail) VALUES ($1,NULL,$2,$3)`,[job.org_id,`job.${result.status}`,JSON.stringify({jobId:job.id})]);
  }catch(error) {
    const msg=error instanceof Error?error.message:'轮询异常';
    // Known provider task: retry status reads only, never recreate billable tasks.
    await query(`UPDATE video_jobs SET next_poll_at=now()+interval '20 seconds',error_message=$2,
      lease_until=NULL,updated_at=now() WHERE id=$1`,[job.id,msg.slice(0,500)]);
    console.error('[worker] poll',job.id,msg);
  }
}
export async function tick() {
  if(running) return;
  running=true;
  try {
    // A crash during an upstream POST leaves an ambiguous state: human review is required.
    await query(`UPDATE video_jobs SET status='submission_unknown',error_code='SUBMISSION_UNCERTAIN',
      error_message='服务重启或上游提交超时。请人工确认上游任务，系统不会自动再次扣费。',
      lease_until=NULL,updated_at=now()
      WHERE status='submitting' AND lease_until<now()`);
    await reconcilePendingRefunds();
    // Retry finalization if a prior invocation crashed after status update.
    const unsettled=await query<{id:string;status:'success'|'failed'}>(`SELECT id,status FROM video_jobs
       WHERE status IN ('success','failed') AND platform_credit_state='reserved' LIMIT 50`);
    for(const j of unsettled.rows) await settleVideoCredits(j.id,j.status);
    const jobs=await claimJobs();
    await Promise.allSettled(jobs.map(runJob));
  } catch(error){console.error('[worker] tick',error);} finally{running=false;}
}
/** No background timer: invoked only by a verified Supabase Cron HTTP request. */
export async function runScheduledTick() { await tick(); }
