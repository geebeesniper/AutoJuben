import { query } from '../db/pool.js';
export type KeyRow={id:string;org_id:string;created_by:string;label:string;token_prefix:string;scopes:string[];
  expires_at:Date;last_used_at:Date|null;revoked_at:Date|null;created_at:Date};
export async function listApiKeys(orgId:string){
  return (await query<KeyRow>(`SELECT id,org_id,created_by,label,token_prefix,scopes,expires_at,last_used_at,revoked_at,created_at
    FROM api_keys WHERE org_id=$1 ORDER BY created_at DESC LIMIT 100`,[orgId])).rows;
}
export async function createApiKeyRow(orgId:string,userId:string,label:string,hash:string,prefix:string,scopes:string[],days:number){
  return (await query<KeyRow>(`INSERT INTO api_keys(org_id,created_by,label,token_hash,token_prefix,scopes,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,now()+($7::int * interval '1 day'))
    RETURNING id,org_id,created_by,label,token_prefix,scopes,expires_at,last_used_at,revoked_at,created_at`,
    [orgId,userId,label,hash,prefix,scopes,days])).rows[0];
}
export async function revokeApiKeyRow(orgId:string,id:string){
  return Boolean((await query('UPDATE api_keys SET revoked_at=now() WHERE org_id=$1 AND id=$2 AND revoked_at IS NULL',[orgId,id])).rowCount);
}
/** Atomic minute rate counter: 60 requests/minute/key, including rejected excess calls. */
export async function findAndCountKey(hash:string){
  const r=await query<KeyRow & {name:string;email:string;is_disabled:boolean;role:string;rate_count:number}>(`
    UPDATE api_keys k SET
      rate_count=CASE WHEN k.rate_window<=now()-interval '1 minute' THEN 1 ELSE k.rate_count+1 END,
      rate_window=CASE WHEN k.rate_window<=now()-interval '1 minute' THEN now() ELSE k.rate_window END,
      last_used_at=now()
    FROM users u,memberships m
    WHERE k.token_hash=$1 AND k.revoked_at IS NULL AND k.expires_at>now()
      AND u.id=k.created_by AND u.is_disabled=false
      AND m.org_id=k.org_id AND m.user_id=k.created_by
    RETURNING k.id,k.org_id,k.created_by,k.label,k.token_prefix,k.scopes,k.expires_at,
      k.last_used_at,k.revoked_at,k.created_at,k.rate_count,u.name,u.email,m.role`,[hash]);
  return r.rows[0];
}
