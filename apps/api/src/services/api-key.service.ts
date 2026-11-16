import { randomBytes } from 'node:crypto';
import { sha256 } from '../auth/security.js';
import { requireMembership } from '../auth/sessions.js';
import type { Context } from '../models/context.js';
import type { ApiPrincipal,ApiScope } from '../models/api.model.js';
import { assert } from '../utils/errors.js';
import { createApiKeyRow,findAndCountKey,listApiKeys,revokeApiKeyRow } from '../repositories/api-key.repository.js';
import { appendAudit } from '../repositories/core.repository.js';
const roles=['owner','admin'];
function toView(row:any){return {id:row.id,orgId:row.org_id,label:row.label,prefix:row.token_prefix,
 scopes:row.scopes,createdAt:new Date(row.created_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString(),
 lastUsedAt:row.last_used_at?new Date(row.last_used_at).toISOString():null,
 revokedAt:row.revoked_at?new Date(row.revoked_at).toISOString():null};}
export const apiKeyService={
 list:async(orgId:string,ctx:Context)=>{
  await requireMembership(ctx.user,orgId,roles);return (await listApiKeys(orgId)).map(toView);
 },
 create:async(orgId:string,label:string,scope:string,expiresInDays:number,ctx:Context)=>{
  const u=ctx.user;await requireMembership(u,orgId,roles);assert(u,'登录已失效',401);
  const clean=label.trim();assert(clean.length>=1&&clean.length<=80,'密钥名称需要 1–80 字符');
  assert(scope==='read'||scope==='write','scope 必须是 read 或 write');
  assert(Number.isInteger(expiresInDays)&&expiresInDays>=1&&expiresInDays<=365,'有效期必须是 1–365 天');
  const raw='ajk_'+randomBytes(32).toString('base64url');
  const row=await createApiKeyRow(orgId,u.id,clean,sha256(raw),raw.slice(0,12),[scope],expiresInDays);
  // An audit outage must not hide a newly issued one-time secret from its creator.
  try{await appendAudit(orgId,u.id,'api_key.created',{keyId:row.id,scope});}catch(e){console.error('[API key audit missing]',row.id,e);}
  return {...toView(row),token:raw}; // Shown ONCE; never stored or logged in plaintext.
 },
 revoke:async(orgId:string,id:string,ctx:Context)=>{
  const u=ctx.user;await requireMembership(u,orgId,roles);assert(u,'登录已失效',401);
  const done=await revokeApiKeyRow(orgId,id);if(done)await appendAudit(orgId,u.id,'api_key.revoked',{keyId:id});return done;
 }
};
export async function principalFromBearer(authorization:string):Promise<ApiPrincipal|null>{
  if(!authorization.startsWith('Bearer '))return null;
  const token=authorization.slice(7);
  assert(/^ajk_[a-zA-Z0-9_-]{40,64}$/.test(token),'API Key 格式无效',401);
  const row=await findAndCountKey(sha256(token));assert(row,'API Key 无效、已过期或被撤销',401);
  assert(row.rate_count<=60,'API Key 调用频率超过每分钟 60 次',429);
  return {mode:'api_key',user:{id:row.created_by,name:row.name,email:row.email},
    orgId:row.org_id,keyId:row.id,scopes:row.scopes as ApiScope[]};
}
/** Tokens may call only tenant-scoped data/creation operations, never billing or platform-admin APIs. */
export function enforceKeyScope(principal:ApiPrincipal,orgId:string|undefined,mode:'read'|'write'|'session'){
  if(principal.mode==='session')return;
  assert(mode!=='session' && orgId===principal.orgId,'该 API Key 无权访问此资源',403);
  assert(mode==='read'||principal.scopes?.includes('write'),'该 API Key 只有读取权限',403);
}
