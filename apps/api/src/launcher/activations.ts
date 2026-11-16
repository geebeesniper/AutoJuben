import {randomBytes,createHash} from 'node:crypto';
import {query,transaction} from '../db/pool.js';
import {assert,AppError} from '../utils/errors.js';
import {safeRecordOp} from './runtime.js';
const digest=(code:string)=>createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
export function activationCode():string {
  // 160-bit secret; no legacy license compatibility implied.
  return `AJ-${randomBytes(20).toString('hex').toUpperCase().match(/.{1,8}/g)!.join('-')}`;
}
export async function issueActivation(orgId:string,userId:string,label:string,role:string,expiresDays:number,maxUses:number) {
  assert(label.trim().length>=1&&label.length<=100,'标签需要 1–100 字符');
  assert(['admin','editor','viewer'].includes(role),'权限类型不正确');
  assert(Number.isInteger(expiresDays)&&expiresDays>=1&&expiresDays<=365,'有效期为 1–365 天');
  assert(Number.isInteger(maxUses)&&maxUses>=1&&maxUses<=100,'最大激活次数 1–100');
  const code=activationCode();
  const row=(await query(`INSERT INTO launcher_activations(org_id,code_hash,label,role,expires_at,max_uses,issued_by)
    VALUES($1,$2,$3,$4,now()+($5::integer * interval '1 day'),$6,$7)
    RETURNING id,org_id,label,role,expires_at,uses,max_uses,created_at`,
    [orgId,digest(code),label.trim(),role,expiresDays,maxUses,userId])).rows[0];
  await safeRecordOp(orgId,userId,'activation','issued','success',{activationId:row.id,role});
  return {id:row.id,code,label:row.label,role:row.role,expiresAt:row.expires_at.toISOString(),uses:row.uses,maxUses:row.max_uses};
}
export async function activationList(orgId:string) {
  const rows=(await query(`SELECT id,label,role,expires_at,uses,max_uses,revoked_at,created_at FROM launcher_activations
    WHERE org_id=$1 ORDER BY created_at DESC LIMIT 100`,[orgId])).rows;
  return rows.map(r=>({id:r.id,label:r.label,role:r.role,expiresAt:r.expires_at.toISOString(),uses:r.uses,maxUses:r.max_uses,
    revoked:Boolean(r.revoked_at),createdAt:r.created_at.toISOString()}));
}
export async function revokeActivation(orgId:string,userId:string,id:string) {
  const row=await query(`UPDATE launcher_activations SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND org_id=$2 RETURNING id`,[id,orgId]);
  assert(row.rowCount===1,'激活码不存在',404);
  await safeRecordOp(orgId,userId,'activation','revoked','success',{activationId:id});return true;
}
export async function redeemActivation(userId:string,rawCode:string) {
  const code=rawCode.trim().toUpperCase();
  assert(/^AJ-(?:[0-9A-F]{8}-){4}[0-9A-F]{8}$/.test(code),'激活码格式不正确',400);
  const result=await transaction(async db=>{
    const match=(await db.query(`SELECT * FROM launcher_activations WHERE code_hash=$1 FOR UPDATE`,[digest(code)])).rows[0];
    assert(match,'激活码无效',404);
    assert(!match.revoked_at&&new Date(match.expires_at)>new Date()&&match.uses<match.max_uses,'激活码已过期或达到使用上限',409);
    const already=await db.query('SELECT 1 FROM memberships WHERE org_id=$1 AND user_id=$2',[match.org_id,userId]);
    assert(!already.rowCount,'你已经是该工作区的成员，激活码不会重复消耗',409);
    await db.query('INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,$3)',[match.org_id,userId,match.role]);
    await db.query('UPDATE launcher_activations SET uses=uses+1 WHERE id=$1',[match.id]);
    return {orgId:match.org_id,role:match.role};
  });
  await safeRecordOp(result.orgId,userId,'activation','redeemed','success',{role:result.role});
  return result;
}
