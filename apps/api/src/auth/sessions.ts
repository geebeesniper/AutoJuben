import { query } from '../db/pool.js';
import { assert } from '../utils/errors.js';
import { sha256 } from './security.js';
/** Server-side SaaS sessions are issued only after successful Supabase Auth verification. */
export type User = {id:string;name:string;email:string};
export type Organization = {id:string;name:string;slug:string;role:string};
export function cookies(cookieHeader:string):Record<string,string> {
  return Object.fromEntries(cookieHeader.split(';').map(c=>c.trim()).filter(Boolean).map(s=>{
    const i=s.indexOf('=');return i<0?['','']:[s.slice(0,i),s.slice(i+1)];
  }));
}
export async function getCurrentUser(cookie:string|undefined):Promise<User|null> {
  const raw=cookies(cookie ?? '').aj_session;
  if(!raw || raw.length>256) return null;
  const r=await query<User>(`SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.is_disabled=false LIMIT 1`,[sha256(raw)]);
  return r.rows[0]??null;
}
export async function memberships(userId:string):Promise<Organization[]> {
  return (await query<Organization>(`SELECT o.id,o.name,o.slug,m.role FROM memberships m
    JOIN organizations o ON o.id=m.org_id WHERE m.user_id=$1 ORDER BY m.joined_at ASC`,[userId])).rows;
}
export async function requireMembership(user:User|null,orgId:string,roles?:string[]) {
  assert(user,'请先登录',401);
  const r=await query<{role:string}>(`SELECT role FROM memberships WHERE user_id=$1 AND org_id=$2`,[user.id,orgId]);
  assert(r.rows[0],'没有访问该工作区的权限',403);
  if(roles?.length) assert(roles.includes(r.rows[0].role),'当前角色没有操作权限',403);
  return r.rows[0].role;
}
