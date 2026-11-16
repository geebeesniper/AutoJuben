import { query } from '../db/pool.js';
export async function createUploadRecord(id:string,orgId:string,userId:string,path:string,name:string,kind:string,mime:string,bytes:number){
  await query(`INSERT INTO asset_uploads(id,org_id,user_id,storage_path,name,kind,mime,expected_bytes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,orgId,userId,path,name,kind,mime,bytes]);
}
export async function discardUploadRecord(id:string){await query('DELETE FROM asset_uploads WHERE id=$1',[id]);}
export async function readUploadRecord(id:string,orgId:string,userId:string){
  return (await query<{id:string;storage_path:string;name:string;kind:'image'|'audio'|'video';mime:string;expected_bytes:string;completed_at:Date|null}>(
    'SELECT * FROM asset_uploads WHERE id=$1 AND org_id=$2 AND user_id=$3',[id,orgId,userId])).rows[0];
}
export async function completeUploadRecord(id:string,orgId:string,userId:string,record:{kind:string;path:string;name:string;mime:string;size:number}){
  await query(`INSERT INTO uploaded_assets(id,org_id,uploaded_by,kind,file_path,original_name,content_type,bytes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
    [id,orgId,userId,record.kind,record.path,record.name,record.mime,record.size]);
  await query('UPDATE asset_uploads SET completed_at=COALESCE(completed_at,now()) WHERE id=$1',[id]);
}
export async function assetPathForUser(assetId:string,userId:string){
  return (await query<{file_path:string}>(`SELECT a.file_path FROM uploaded_assets a
    JOIN memberships m ON m.org_id=a.org_id WHERE a.id=$1 AND m.user_id=$2`,[assetId,userId])).rows[0]?.file_path;
}
export async function videoForUser(jobId:string,userId:string){
  return (await query<{org_id:string;video_url:string|null}>(`SELECT j.org_id,j.video_url FROM video_jobs j
    JOIN memberships m ON m.org_id=j.org_id WHERE j.id=$1 AND m.user_id=$2 AND j.status='success'`,[jobId,userId])).rows[0];
}
