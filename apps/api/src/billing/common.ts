import { config } from '../config.js';
import { query, transaction, type DbClient } from '../db/pool.js';
import { assert } from '../utils/errors.js';
import type { User } from '../auth/sessions.js';
import { decryptSecret } from '../auth/security.js';

export type PlatformSettings = {payments_enabled:boolean;usage_billing_enabled:boolean;provider_key_ciphertext:string|null;stripe_secret_ciphertext:string|null;stripe_webhook_ciphertext:string|null;stripe_portal_config:string|null};
export async function platformSettings(db?:DbClient):Promise<PlatformSettings>{
 const r=db?await db.query<PlatformSettings>('SELECT * FROM platform_settings WHERE id=1'):await query<PlatformSettings>('SELECT * FROM platform_settings WHERE id=1');
 assert(r.rows[0],'请执行 sql/004_customer_portal_payments.sql',503);
 return r.rows[0];
}
export function isPlatformAdmin(u:User|null):boolean {return !!u && config.platformAdminEmails.includes(u.email.toLowerCase());}
export function requirePlatformAdmin(u:User|null):asserts u is User {assert(isPlatformAdmin(u),'仅平台管理员可以访问',403);}
export async function stripeCredentials(){
 const s=await platformSettings();
 return {
   secret:s.stripe_secret_ciphertext?decryptSecret(s.stripe_secret_ciphertext):config.stripeSecretKey,
   webhook:s.stripe_webhook_ciphertext?decryptSecret(s.stripe_webhook_ciphertext):config.stripeWebhookSecret,
   portal:s.stripe_portal_config||config.stripePortalConfiguration||''
 };
}
export async function walletBalance(orgId:string):Promise<number>{
 const r=await query<{balance:string}>('SELECT balance FROM credit_wallets WHERE org_id=$1',[orgId]);
 return Number(r.rows[0]?.balance??0);
}
/** Ledger entry and balance mutation must be in the caller's transaction. */
export async function postCredit(db:DbClient,orgId:string,delta:number,sourceType:string,sourceId:string){
 assert(Number.isSafeInteger(delta)&&delta!==0,'积分数量无效',400);
 const log=await db.query(`INSERT INTO credit_ledger(org_id,delta,source_type,source_id) VALUES($1,$2,$3,$4)
   ON CONFLICT (source_type,source_id) DO NOTHING RETURNING id`,[orgId,delta,sourceType,sourceId]);
 if(!log.rowCount)return false;
 await db.query(`INSERT INTO credit_wallets(org_id,balance) VALUES($1,$2) ON CONFLICT(org_id) DO UPDATE
    SET balance=credit_wallets.balance+EXCLUDED.balance,updated_at=now()`,[orgId,delta]);
 return true;
}
export const MONEY_CURRENCY='usd';
export function safeStripeUrl(url:string):string {
 assert(typeof url==='string'&&/^https:\/\/(checkout|billing)\.stripe\.com\//.test(url),'支付页面链接无效',502);
 return url;
}

/** Refund or capture a reserved task exactly once; safe if cron retries. */
export async function settleVideoCredits(jobId:string,status:'success'|'failed'){
 await transaction(async db=>{
  const row=(await db.query<{id:string;org_id:string;platform_credit_cost:number;platform_credit_state:string}>(
   'SELECT id,org_id,platform_credit_cost,platform_credit_state FROM video_jobs WHERE id=$1 FOR UPDATE',[jobId])).rows[0];
  if(!row||row.platform_credit_state!=='reserved')return;
  if(status==='failed'){
   await postCredit(db,row.org_id,row.platform_credit_cost,'job_refund',row.id);
   await db.query(`UPDATE video_jobs SET platform_credit_state='released' WHERE id=$1`,[jobId]);
  }else await db.query(`UPDATE video_jobs SET platform_credit_state='captured' WHERE id=$1`,[jobId]);
 });
}
