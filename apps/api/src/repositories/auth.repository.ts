import { randomUUID } from 'node:crypto';
import { query,transaction } from '../db/pool.js';
import { sha256 } from '../auth/security.js';
/** Durable rate limits and sessions shared by all stateless Vercel invocations. */
export async function incrementAuthThrottle(email:string){
  const key=sha256(email.toLowerCase());
  return (await query<{attempts:number}>(`INSERT INTO auth_throttle(key_hash,attempts,since) VALUES($1,1,now())
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts=CASE WHEN auth_throttle.since<now()-interval '15 minutes' THEN 1 ELSE auth_throttle.attempts+1 END,
      since=CASE WHEN auth_throttle.since<now()-interval '15 minutes' THEN now() ELSE auth_throttle.since END
    RETURNING attempts`,[key])).rows[0].attempts;
}
export async function accountDisabled(id:string){
  return Boolean((await query<{is_disabled:boolean}>('SELECT is_disabled FROM users WHERE id=$1',[id])).rows[0]?.is_disabled);
}
export async function ensureUserWorkspace(id:string,email:string,name:string,orgName:string){
  await transaction(async db=>{
    await db.query('INSERT INTO users(id,name,email) VALUES($1,$2,$3) ON CONFLICT (id) DO UPDATE SET email=excluded.email',[id,name,email]);
    const existing=await db.query('SELECT 1 FROM memberships WHERE user_id=$1 LIMIT 1',[id]);
    if(!existing.rows.length){
      const orgId=randomUUID();
      await db.query('INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)',[orgId,orgName,`org-${orgId.slice(0,12)}`]);
      await db.query('INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,$3)',[orgId,id,'owner']);
    }
  });
}
export async function auditLogin(userId:string){
  await query(`INSERT INTO audit_logs(org_id,actor_id,action,detail)
    SELECT org_id,$1,'auth.login','{}'::jsonb FROM memberships WHERE user_id=$1`,[userId]);
}
export async function persistSession(userId:string,tokenHash:string){
  await query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')",[userId,tokenHash]);
}
export async function revokeAllSessions(userId:string){await query('DELETE FROM sessions WHERE user_id=$1',[userId]);}
export async function revokeSessionHash(tokenHash:string){await query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash]);}
