import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { transaction } from '../db/pool.js';
import { requireMembership } from '../auth/sessions.js';
import { validateVideoInput,type VideoInput } from '../provider/validation.js';
import { platformSettings,postCredit } from '../billing/common.js';
import { canReserveCredits } from '../billing/rules.js';
import { assert } from '../utils/errors.js';
import type { Context } from '../models/context.js';
import { videoJobView } from '../models/view-models.js';
import { appendAudit,findJob } from '../repositories/core.repository.js';
const manageRoles=['owner','admin'];
const editRoles=['owner','admin','editor'];
async function actor(ctx:Context){assert(ctx.user,'请先登录',401);return ctx.user;}
const audit=appendAudit;
const job=videoJobView;
export const videoJobServiceMutations={
    resolveSubmission:async (_root:unknown,{orgId,id,providerTaskId,confirmedNotSubmitted}:any,ctx:Context)=>{
      const u=await actor(ctx);await requireMembership(u,orgId,manageRoles);
      assert(Boolean(confirmedNotSubmitted)!==Boolean(providerTaskId),'请选择填写上游任务编号，或确认任务未被上游受理');
      if(providerTaskId)assert(typeof providerTaskId==='string'&&providerTaskId.trim().length>=5&&providerTaskId.length<=150,'上游任务编号格式不正确');
      const r=await transaction(async db=>{const updated=await db.query(`UPDATE video_jobs SET
        status=CASE WHEN $3::boolean THEN 'failed' ELSE 'pending' END,
        provider_task_id=CASE WHEN $3::boolean THEN provider_task_id ELSE $4::text END,
        next_poll_at=CASE WHEN $3::boolean THEN NULL ELSE now() END,
        error_code=CASE WHEN $3::boolean THEN 'ADMIN_VERIFIED_NOT_SUBMITTED' ELSE NULL END,
        error_message=CASE WHEN $3::boolean THEN '管理员已确认上游未受理；请自行核查积分状态。' ELSE NULL END,
        finished_at=CASE WHEN $3::boolean THEN now() ELSE NULL END,
        lease_until=NULL,updated_at=now()
        WHERE org_id=$1 AND id=$2 AND status='submission_unknown' RETURNING *`,
        [orgId,id,Boolean(confirmedNotSubmitted),providerTaskId?.trim()??null]);
        assert(updated.rows[0],'任务不存在或不处于待核实状态',404);
        if(confirmedNotSubmitted && updated.rows[0].platform_credit_state==='reserved') {
          await postCredit(db,orgId,Number(updated.rows[0].platform_credit_cost),'job_refund',id);
          await db.query("UPDATE video_jobs SET platform_credit_state='released' WHERE id=$1",[id]);
          updated.rows[0].platform_credit_state='released';
        }
        return updated;
      });
      await audit(orgId,u.id,'job.manualReconcile',{jobId:id,confirmedNotSubmitted:Boolean(confirmedNotSubmitted),providerTaskId:providerTaskId??null});
      return job(r.rows[0]);
    },
    createVideoJob:async (_root:unknown,{orgId,input}: {orgId:string;input:VideoInput},ctx:Context)=>{
      const u=await actor(ctx);await requireMembership(u,orgId,editRoles);
      const valid=validateVideoInput(input);
      const clientTaskId=valid.clientTaskId||randomUUID();
      const jobId=await transaction(async db=>{
        // Organization row lock serializes quota checks and idempotent submissions within this tenant.
        await db.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[orgId]);
        const existing=await db.query<{id:string}>('SELECT id FROM video_jobs WHERE org_id=$1 AND client_task_id=$2',[orgId,clientTaskId]);
        if(existing.rows[0])return existing.rows[0].id;
        if(valid.projectId){const p=await db.query('SELECT 1 FROM projects WHERE id=$1 AND org_id=$2',[valid.projectId,orgId]);assert(p.rows[0],'项目不属于此工作区',403);}
        const groups:[string[],'image'|'audio'|'video'][]=[
          [valid.imageAssetIds,'image'],[valid.audioAssetIds,'audio'],[valid.videoAssetIds,'video']
        ];
        for(const [ids,kind] of groups)if(ids.length){
          const found=await db.query('SELECT id FROM uploaded_assets WHERE org_id=$1 AND kind=$2 AND id=ANY($3::uuid[])',[orgId,kind,ids]);
          assert(found.rowCount===new Set(ids).size,`无权限使用某个${kind}素材`,403);
        }
        const count=(await db.query<{total:string}>(`SELECT COUNT(*) AS total FROM video_jobs WHERE org_id=$1 AND status IN ('queued','submitting','submission_unknown','pending','polling')`,[orgId])).rows[0];
        assert(Number(count.total)<config.activeJobsLimit,`工作区同时最多允许 ${config.activeJobsLimit} 个活动任务`,429);
        const id=randomUUID();
        const billing=await platformSettings(db);
        let cost=0;
        if(billing.usage_billing_enabled){
          const tariff=(await db.query<{credits:number}>(`SELECT credits FROM video_tariffs
            WHERE model=$1 AND resolution=$2 AND active=true`,[valid.model,valid.resolution])).rows[0];
          assert(tariff,'当前型号/分辨率未配置积分价格，无法下单',409);
          cost=tariff.credits;
          await db.query('INSERT INTO credit_wallets(org_id,balance) VALUES($1,0) ON CONFLICT DO NOTHING',[orgId]);
          const wallet=(await db.query<{balance:string}>('SELECT balance FROM credit_wallets WHERE org_id=$1 FOR UPDATE',[orgId])).rows[0];
          assert(canReserveCredits(Number(wallet.balance),cost),'积分余额不足，请先购买积分',402);
        }
        await db.query(`INSERT INTO video_jobs(id,org_id,project_id,created_by,client_task_id,model,duration,ratio,resolution,prompt,
          image_urls,audio_urls,video_urls,image_asset_ids,audio_asset_ids,video_asset_ids,provider_is_mock,platform_credit_cost,platform_credit_state)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [id,orgId,valid.projectId||null,u.id,clientTaskId,valid.model,valid.duration,valid.ratio,valid.resolution,valid.prompt,
          JSON.stringify(valid.imageUrls),JSON.stringify(valid.audioUrls),JSON.stringify(valid.videoUrls),JSON.stringify(valid.imageAssetIds),JSON.stringify(valid.audioAssetIds),JSON.stringify(valid.videoAssetIds),config.mockProvider,cost,cost>0?'reserved':'none']);
        if(cost>0)await postCredit(db,orgId,-cost,'job_debit',id);
        return id;
      });
      await audit(orgId,u.id,'job.created',{jobId});
      return job(await findJob(orgId,jobId));
    }
};
