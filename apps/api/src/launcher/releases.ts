import { createHmac, randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { AppError, assert } from '../utils/errors.js';
import { compareVersions,safeRecordOp,runtimeConfig,type Channel } from './runtime.js';
export function releaseVersion(v:string):string {
  const str=String(v??'').trim();
  assert(/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(str),'版本号必须是 semver，例如 1.2.3',400);
  return str.replace(/^v/,'');
}
export async function releases(orgId:string) {
  return (await query(`SELECT id,version,channel,notes,created_at FROM launcher_releases WHERE org_id=$1
    ORDER BY created_at DESC LIMIT 100`,[orgId])).rows.map(r=>({id:r.id,version:r.version,channel:r.channel,notes:r.notes,createdAt:r.created_at.toISOString()}));
}
export async function checkReleases(orgId:string) {
  const settings=await runtimeConfig(orgId);
  const rows=(await query<{version:string;channel:Channel;notes:string}>(`SELECT version,channel,notes FROM launcher_releases WHERE org_id=$1
    AND (channel='stable' OR ($2='beta' AND channel='beta') OR ($2='gray' AND channel IN ('beta','gray')))
    LIMIT 100`,[orgId,settings.channel])).rows;
  rows.sort((a,b)=>-compareVersions(a.version,b.version));
  const latest=rows[0];
  return {currentVersion:process.env.APP_VERSION??'0.3.0',latestVersion:latest?.version??null,
    available:!!latest && compareVersions(latest.version,settings.current_version)>0,
    channel:settings.channel,notes:latest?.notes??'',deploymentState:settings.deployment_state,
    desiredVersion:settings.desired_version};
}
export async function publishRelease(orgId:string,actorId:string,version:string,channel:Channel,notes:string) {
  const v=releaseVersion(version);
  assert(['stable','beta','gray'].includes(channel),'发布通道无效');
  assert(notes.length<=10_000,'更新说明过长');
  const row=(await query(`INSERT INTO launcher_releases(org_id,version,channel,notes,published_by)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(org_id,version,channel) DO UPDATE SET notes=EXCLUDED.notes
    RETURNING id,version,channel,notes,created_at`,[orgId,v,channel,notes,actorId])).rows[0];
  await safeRecordOp(orgId,actorId,'release','published','success',{version:v,channel});
  return {...row,createdAt:row.created_at.toISOString()};
}
export async function deployRelease(orgId:string,actorId:string,version:string) {
  const v=releaseVersion(version);
  assert(config.deployWebhookUrl && config.deployWebhookSecret,
    '尚未配置 DEPLOY_WEBHOOK_URL / DEPLOY_WEBHOOK_SECRET，不能执行实际更新',409);
  // Only the operator-configured endpoint is invoked. Never accept a browser-supplied URL.
  const allowed=new URL(config.deployWebhookUrl);
  assert(allowed.protocol==='https:'||(allowed.hostname==='127.0.0.1'&&allowed.protocol==='http:'),
    '部署执行器必须为 HTTPS（或本机 127.0.0.1）',409);
  const settings=await runtimeConfig(orgId);
  const channels=settings.channel==='stable'?['stable']:settings.channel==='beta'?['stable','beta']:['stable','beta','gray'];
  const rel=(await query<{channel:Channel}>('SELECT channel FROM launcher_releases WHERE org_id=$1 AND version=$2 AND channel=ANY($3::text[]) LIMIT 1',[orgId,v,channels])).rows[0];
  assert(rel,'该版本未在当前工作区的更新通道发布',404);
  assert(compareVersions(v,settings.current_version)>0,'不能部署低于或等于当前版本的更新',409);
  const commandId=randomUUID();
  const locked=await query(`UPDATE launcher_config SET deployment_state='submitting',desired_version=$2,updated_at=now()
    WHERE org_id=$1 AND deployment_state NOT IN ('submitting','unknown') RETURNING org_id`,[orgId,v]);
  assert(locked.rowCount===1,'已有更新正在执行或上次结果未知，请先核实',409);
  const content=JSON.stringify({operation:'deploy',orgId,version:v,requestId:commandId});
  const signature=createHmac('sha256',config.deployWebhookSecret).update(content).digest('hex');
  try {
    const res=await fetch(allowed,{method:'POST',headers:{'Content-Type':'application/json','X-AutoJuben-Signature':signature,'X-Request-ID':commandId},body:content,signal:AbortSignal.timeout(90_000),redirect:'error'});
    const result=await res.json() as {status?:string;version?:string;message?:string};
    if(!res.ok || result.status!=='deployed' || result.version!==v){
      await query(`UPDATE launcher_config SET deployment_state='unknown',updated_at=now() WHERE org_id=$1`,[orgId]);
      await safeRecordOp(orgId,actorId,'deployment','result_unknown','warning',{version:v,requestId:commandId,httpStatus:res.status});
      throw new AppError(502,'部署执行器未确认完成；状态待核实，系统不会自动重试');
    }
    await query(`UPDATE launcher_config SET current_version=$2,desired_version=NULL,deployment_state='deployed',
      last_deployed_at=now(),updated_at=now() WHERE org_id=$1`,[orgId,v]);
    await safeRecordOp(orgId,actorId,'deployment','installed','success',{version:v,requestId:commandId});
    return checkReleases(orgId);
  }catch(error){
    await query(`UPDATE launcher_config SET deployment_state='unknown',updated_at=now()
      WHERE org_id=$1 AND deployment_state='submitting'`,[orgId]);
    if(!(error instanceof AppError))await safeRecordOp(orgId,actorId,'deployment','result_unknown','warning',{version:v,requestId:commandId,error:String(error)});
    throw error instanceof AppError?error:new AppError(502,'无法确认部署是否完成，请运维核实后再处理');
  }
}
export async function resolveDeployment(orgId:string,actorId:string,actualVersion:string) {
  const version=releaseVersion(actualVersion);
  const r=await query(`UPDATE launcher_config SET deployment_state='idle',desired_version=NULL,current_version=$2,updated_at=now()
    WHERE org_id=$1 RETURNING org_id`,[orgId,version]);
  assert(r.rowCount===1,'工作区不存在',404);
  await safeRecordOp(orgId,actorId,'deployment','operator_reconciled','success',{actualVersion:version});
  return checkReleases(orgId);
}
