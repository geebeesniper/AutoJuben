import { createHash,randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { query,transaction,pool } from '../db/pool.js';
import { storageClient } from '../serverless/storage.js';
import { config } from '../config.js';
import { assert,AppError } from '../utils/errors.js';
import { safeRecordOp } from './runtime.js';

type Row=Record<string,any>;
type Manifest={schema:3;orgId:string;backupId:string;createdAt:string;projects:Row[];assets:Row[];jobs:Row[];media:{id:string;backupPath:string;bytes:number}[]};
const storage=()=>storageClient().storage.from(config.storageBucket);
const backupRoot=(orgId:string,id:string)=>`${orgId}/backups/${id}`;
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export const isOwnedStoragePath=(path:string,orgId:string)=>path.startsWith(`${orgId}/uploads/`)||path.startsWith(`${orgId}/restores/`);
async function snapshot(orgId:string) {
  const db=await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const projects=(await db.query('SELECT * FROM projects WHERE org_id=$1 ORDER BY id',[orgId])).rows;
    const assets=(await db.query('SELECT * FROM uploaded_assets WHERE org_id=$1 ORDER BY id',[orgId])).rows;
    const jobs=(await db.query('SELECT * FROM video_jobs WHERE org_id=$1 ORDER BY id',[orgId])).rows;
    await db.query('COMMIT');return {projects,assets,jobs};
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
export async function createBackup(orgId:string,actorId:string|null,name='手动备份') {
  assert(name.trim().length>=1&&name.length<=100,'备份名称需要 1–100 字符');
  const data=await snapshot(orgId);
  // A synchronous Vercel Function must never claim to support unlimited bulk-copy jobs.
  assert(data.assets.length<=60&&data.jobs.length<=5000,'单次云备份限制：60 个媒体、5000 条任务；请使用 Supabase 平台备份执行大型备份',413);
  const id=randomUUID();const root=backupRoot(orgId,id);const media:Manifest['media']=[];
  const copied:string[]=[];let mediaBytes=0;
  try {
    for(const item of data.assets){
      assert(typeof item.file_path==='string'&&isOwnedStoragePath(item.file_path,orgId),'备份包含非本工作区的媒体地址',409);
      const path=`${root}/media/${item.id}${extname(item.file_path)}`;
      const {error}=await storage().copy(item.file_path,path);if(error)throw new AppError(502,`备份媒体复制失败：${error.message}`);
      media.push({id:item.id,backupPath:path,bytes:Number(item.bytes)});copied.push(path);mediaBytes+=Number(item.bytes);
    }
    const manifest:Manifest={schema:3,orgId,backupId:id,createdAt:new Date().toISOString(),...data,media};
    const raw=Buffer.from(JSON.stringify(manifest),'utf8');
    assert(raw.length<=8*1024*1024,'备份元数据超过 8MB，请使用 Supabase 备份',413);
    const checksum=hash(raw);
    const file=`${root}/manifest.json`;
    const up=await storage().upload(file,raw,{contentType:'application/json',upsert:false});
    if(up.error)throw new AppError(502,`写入云备份清单失败：${up.error.message}`);
    copied.push(file);
    await query(`INSERT INTO launcher_backups(id,org_id,name,checksum,bytes,asset_count,project_count,job_count,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,orgId,name,checksum,raw.length+mediaBytes,data.assets.length,data.projects.length,data.jobs.length,actorId]);
    await safeRecordOp(orgId,actorId,'backup','created','success',{backupId:id});
    return {id,name,checksum,bytes:raw.length+mediaBytes,assetCount:data.assets.length,projectCount:data.projects.length,
      jobCount:data.jobs.length,createdAt:manifest.createdAt};
  }catch(error){if(copied.length)await storage().remove(copied).catch(()=>{});throw error;}
}
export async function listBackups(orgId:string) {
  const rows=(await query(`SELECT id,name,checksum,bytes,asset_count,project_count,job_count,created_at
    FROM launcher_backups WHERE org_id=$1 ORDER BY created_at DESC LIMIT 100`,[orgId])).rows;
  return rows.map(x=>({id:x.id,name:x.name,checksum:x.checksum,bytes:Number(x.bytes),assetCount:x.asset_count,
    projectCount:x.project_count,jobCount:x.job_count,createdAt:new Date(x.created_at).toISOString()}));
}
async function readManifest(orgId:string,id:string):Promise<Manifest> {
  assert(/^[0-9a-f-]{36}$/i.test(id),'备份 ID 无效');
  const saved=(await query<{checksum:string}>(`SELECT checksum FROM launcher_backups WHERE org_id=$1 AND id=$2`,[orgId,id])).rows[0];
  assert(saved,'没有访问该备份的权限',404);
  const {data,error}=await storage().download(`${backupRoot(orgId,id)}/manifest.json`);
  assert(!error&&data,'云端备份清单不存在',404);
  assert(data.size<=8*1024*1024,'备份清单太大',413);
  const raw=Buffer.from(await data.arrayBuffer());
  assert(hash(raw)===saved.checksum,'备份清单校验失败',409);
  let manifest:Manifest;
  try{manifest=JSON.parse(raw.toString('utf8'));}catch{throw new AppError(409,'备份清单 JSON 损坏');}
  assert(manifest.schema===3&&manifest.orgId===orgId&&manifest.backupId===id,'备份与工作区不匹配',409);
  assert(Array.isArray(manifest.projects)&&Array.isArray(manifest.assets)&&Array.isArray(manifest.jobs)&&Array.isArray(manifest.media),'备份内容缺失',409);
  assert(manifest.media.length===manifest.assets.length,'媒体索引不一致',409);
  for(const m of manifest.media)assert(m.backupPath.startsWith(`${backupRoot(orgId,id)}/media/`),'备份媒体路径越权',409);
  return manifest;
}
export async function backupManifestForDownload(orgId:string,id:string) {
  const manifest=await readManifest(orgId,id);
  return Buffer.from(JSON.stringify({...manifest,warning:'元数据副本；完整媒体备份保存在 Supabase Storage 私有 bucket。'},null,2));
}
export async function restoreBackup(orgId:string,actorId:string,id:string,confirmation:string) {
  assert(confirmation===`RESTORE ${id}`,'确认文本需为 RESTORE 空格加完整备份 ID',400);
  const active=(await query<{count:string}>(`SELECT COUNT(*) AS count FROM video_jobs WHERE org_id=$1 AND status NOT IN ('success','failed')`,[orgId])).rows[0];
  assert(Number(active.count)===0,'存在活动任务，禁止恢复',409);
  const data=await readManifest(orgId,id);
  assert(data.assets.length<=60&&data.jobs.length<=5000,'恢复超出 Vercel 单次请求限制',413);
  const mediaById=new Map(data.media.map(x=>[x.id,x]));
  // Always make a recoverable safety snapshot before replacing tenant rows.
  const safety=await createBackup(orgId,actorId,`恢复 ${id.slice(0,8)} 前自动备份`);
  const pathMap=new Map<string,string>();const copied:string[]=[];
  try{
    const restoreId=randomUUID();
    for(const asset of data.assets){
      assert(asset.org_id===orgId&&typeof asset.id==='string','媒体所属工作区不匹配',409);
      const media=mediaById.get(asset.id);assert(media,'媒体缺失',409);
      const target=`${orgId}/restores/${restoreId}/${asset.id}${extname(media.backupPath)}`;
      const result=await storage().copy(media.backupPath,target);
      if(result.error)throw new AppError(502,`恢复媒体失败：${result.error.message}`);
      pathMap.set(asset.id,target);copied.push(target);
    }
    await transaction(async db=>{
      await db.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[orgId]);
      const count=(await db.query<{total:string}>(`SELECT COUNT(*) AS total FROM video_jobs WHERE org_id=$1 AND status NOT IN ('success','failed')`,[orgId])).rows[0];
      assert(Number(count.total)===0,'恢复期间创建了新任务',409);
      await db.query('DELETE FROM video_jobs WHERE org_id=$1',[orgId]);
      await db.query('DELETE FROM projects WHERE org_id=$1',[orgId]);
      await db.query('DELETE FROM uploaded_assets WHERE org_id=$1',[orgId]);
      const users=new Set((await db.query<{id:string}>('SELECT id FROM users')).rows.map(x=>x.id));
      for(const p of data.projects){
        assert(p.org_id===orgId,'项目跨租户',409);
        await db.query(`INSERT INTO projects(id,org_id,name,description,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6)`,
          [p.id,orgId,p.name,p.description,users.has(p.created_by)?p.created_by:null,p.created_at]);
      }
      for(const a of data.assets){
        await db.query(`INSERT INTO uploaded_assets(id,org_id,uploaded_by,kind,file_path,original_name,content_type,bytes,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [a.id,orgId,users.has(a.uploaded_by)?a.uploaded_by:null,a.kind,pathMap.get(a.id),a.original_name,a.content_type,a.bytes,a.created_at]);
      }
      for(const j of data.jobs){
        assert(j.org_id===orgId,'视频任务跨租户',409);
        const status=['success','failed'].includes(j.status)?j.status:'failed';
        await db.query(`INSERT INTO video_jobs(id,org_id,project_id,created_by,client_task_id,provider_task_id,model,duration,ratio,resolution,
          prompt,image_urls,audio_urls,video_urls,image_asset_ids,audio_asset_ids,video_asset_ids,status,progress,required_credits,billing_status,
          video_url,error_code,error_message,provider_is_mock,attempts,created_at,submitted_at,finished_at,updated_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
          [j.id,orgId,j.project_id,users.has(j.created_by)?j.created_by:null,j.client_task_id,j.provider_task_id,j.model,j.duration,
           j.ratio,j.resolution,j.prompt,JSON.stringify(j.image_urls),JSON.stringify(j.audio_urls),JSON.stringify(j.video_urls),
           JSON.stringify(j.image_asset_ids),JSON.stringify(j.audio_asset_ids),JSON.stringify(j.video_asset_ids),status,j.progress,
           j.required_credits,j.billing_status,j.video_url,status==='failed'&&j.status!=='failed'?'RESTORED_STOPPED':j.error_code,
           status==='failed'&&j.status!=='failed'?'恢复历史任务不重新提交上游':j.error_message,j.provider_is_mock,j.attempts,
           j.created_at,j.submitted_at,j.finished_at??(status==='failed'?new Date():null),new Date()]);
      }
    });
    await safeRecordOp(orgId,actorId,'backup','restored','success',{backupId:id,safetyBackup:safety.id});
    return {restoredBackupId:id,safetyBackupId:safety.id,projects:data.projects.length,jobs:data.jobs.length,assets:data.assets.length};
  }catch(e){if(copied.length)await storage().remove(copied).catch(()=>{});throw e;}
}
