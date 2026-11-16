import { randomUUID } from 'node:crypto';
import { findUsers,findOrders,allProducts,allTariffs,findUserEmail,setUserDisabled,
  upsertProduct,upsertTariff,deleteTariff,hasActiveProduct,hasActiveTariff,setBillingFlags,
  updateStripeSettings,updateGlobalVideoKey } from '../repositories/admin.repository.js';
import { isoDate,billingProductView,adminOrderView } from '../models/view-models.js';
import { encryptSecret } from '../auth/security.js';
import { config } from '../config.js';
import { stripeClient } from '../billing/stripe.js';
import { decryptSecret } from '../auth/security.js';
import { assert } from '../utils/errors.js';
import { isPlatformAdmin,requirePlatformAdmin,platformSettings,stripeCredentials } from '../billing/common.js';
import type { Context } from '../models/context.js';

const asAdmin=(ctx:Context)=>{requirePlatformAdmin(ctx.user);return ctx.user;};

async function billingInfo(){
 const s=await platformSettings();const keys=await stripeCredentials();
 return {paymentsEnabled:s.payments_enabled,usageBillingEnabled:s.usage_billing_enabled,
  stripeSecretConfigured:Boolean(keys.secret),webhookSecretConfigured:Boolean(keys.webhook),portalConfigured:Boolean(keys.portal),
  stripeMode:keys.secret.startsWith('sk_live_')?'LIVE':keys.secret.startsWith('sk_test_')?'TEST':'NOT CONFIGURED',
  webhookUrl:`${config.origin}/api/stripe`};
}
async function apiInfo(){
 const s=await platformSettings();return {baseUrl:config.providerUrl,mock:config.mockProvider,
  globalKeyConfigured:Boolean(s.provider_key_ciphertext||config.providerKey),endpointEditableInVercel:true};
}
export const adminServiceQueries={
 adminSearchUsers:async (_:unknown,{search,limit,offset}:{search:string;limit:number;offset:number},ctx:Context)=>{
  asAdmin(ctx);assert(Number.isInteger(limit)&&limit>=1&&limit<=100&&Number.isInteger(offset)&&offset>=0&&offset<=10000,'分页参数无效');
  assert(search.length<=100,'搜索字符串过长');
  return (await findUsers(search.trim(),limit,offset)).map((x:any)=>({id:x.id,name:x.name,email:x.email,
    disabled:x.is_disabled,orgCount:x.org_count,orders:x.orders,createdAt:isoDate(x.created_at)}));
 },
 adminOrders:async (_:unknown,{search,status,limit}:{search:string;status:string;limit:number},ctx:Context)=>{
  asAdmin(ctx);assert(search.length<=100&&status.length<=40&&Number.isInteger(limit)&&limit>=1&&limit<=100,'搜索参数无效');
  return (await findOrders(search.trim(),status,limit)).map(adminOrderView);
 },
 adminProducts:async (_:unknown,_a:unknown,ctx:Context)=>{asAdmin(ctx);return (await allProducts()).map(billingProductView);},
 adminTariffs:async (_:unknown,_a:unknown,ctx:Context)=>{asAdmin(ctx);return allTariffs();},
 adminBillingSettings:async (_:unknown,_a:unknown,ctx:Context)=>{asAdmin(ctx);return billingInfo();},
 adminApiSettings:async (_:unknown,_a:unknown,ctx:Context)=>{asAdmin(ctx);return apiInfo();},
 adminTestStripe:async (_:unknown,_a:unknown,ctx:Context)=>{
  asAdmin(ctx);
  try{const stripe=await stripeClient();await stripe.balance.retrieve();return {ok:true,message:'Stripe 凭据可用，已成功访问 Stripe API。'};}
  catch(e){return {ok:false,message:e instanceof Error?e.message.slice(0,160):'Stripe 连接失败'};}
 },
 adminTestVideoApi:async (_:unknown,_a:unknown,ctx:Context)=>{
  asAdmin(ctx);
  if(config.mockProvider)return {ok:true,message:'当前为 MOCK 演示模式，没有请求真实视频 API。'};
  const s=await platformSettings();const key=s.provider_key_ciphertext?decryptSecret(s.provider_key_ciphertext):config.providerKey;
  if(!key)return {ok:false,message:'尚未配置默认视频 API 密钥'};
  if(!config.providerUrl.startsWith('https://')&&!config.allowInsecureVideoHttp)return {ok:false,message:'上游地址不是 HTTPS，禁止发送卡密；仅受控测试可设置 ALLOW_INSECURE_VIDEO_HTTP=true'};
  try{const response=await fetch(config.providerUrl+'/api/pricing',{headers:{'X-License-Key':key},signal:AbortSignal.timeout(8000)});
   return {ok:response.ok,message:response.ok?'视频服务定价接口响应正常':`视频接口返回 HTTP ${response.status}`};}
  catch{return {ok:false,message:'网络连接失败或请求超时'};}
 }
};
export const adminServiceMutations={
 adminSetUserDisabled:async (_:unknown,{userId,disabled}:{userId:string;disabled:boolean},ctx:Context)=>{
  const u=asAdmin(ctx);assert(userId!==u.id,'不能禁用自己');
  const victim=await findUserEmail(userId);assert(victim,'用户不存在',404);
  assert(!config.platformAdminEmails.includes(victim.email.toLowerCase()),'不能禁用其他平台管理员',403);
  await setUserDisabled(userId,disabled);return true;
 },
 adminSaveProduct:async (_:unknown,{id,sku,name,description,credits,amountCents,active}:any,ctx:Context)=>{
  asAdmin(ctx);const s=String(sku).trim().toLowerCase(),n=String(name).trim();
  assert(/^[a-z0-9][a-z0-9_-]{1,63}$/.test(s),'SKU 需为小写字母、数字、- 或 _');
  assert(n.length>=2&&n.length<=120,'商品名称无效');
  assert(Number.isInteger(credits)&&credits>0&&credits<=1000000,'积分数量无效');
  assert(Number.isInteger(amountCents)&&amountCents>=50&&amountCents<=100000000,'价格需至少 $0.50');
  assert(String(description??'').length<=1000,'描述过长');
  return billingProductView(await upsertProduct(id||randomUUID(),s,n,String(description??''),credits,amountCents,active));
 },
 adminSaveTariff:async (_:unknown,{model,resolution,credits,active}:any,ctx:Context)=>{
  asAdmin(ctx);assert(['xinghe-2.0','xinghe-fast'].includes(model),'不支持的模型');
  assert(['480p','720p','1080p','4k'].includes(resolution),'不支持的清晰度');
  assert(Number.isInteger(credits)&&credits>=1&&credits<=1000000,'积分价格无效');
  return upsertTariff(model,resolution,credits,active);
 },
 adminDeleteTariff:async (_:unknown,{model,resolution}:{model:string;resolution:string},ctx:Context)=>{
  asAdmin(ctx);return deleteTariff(model,resolution);
 },
 adminSetBillingFlags:async (_:unknown,{paymentsEnabled,usageBillingEnabled}:{paymentsEnabled:boolean;usageBillingEnabled:boolean},ctx:Context)=>{
  const u=asAdmin(ctx);assert(!usageBillingEnabled||paymentsEnabled,'启用按任务计费前必须开放支付');
  const creds=await stripeCredentials();
  if(paymentsEnabled){
    assert(/^sk_(test|live)_/.test(creds.secret)&&creds.webhook,'启用支付前需配置 Stripe 密钥和 Webhook Secret');
    assert(await hasActiveProduct(),'至少启用一个有效商品');
  }
  if(usageBillingEnabled)assert(await hasActiveTariff(),'至少设置一条视频任务积分价格');
  await setBillingFlags(paymentsEnabled,usageBillingEnabled,u.id);return billingInfo();
 },
 adminSaveStripeIntegration:async (_:unknown,{secretKey,webhookSecret,portalConfig}:{secretKey?:string|null;webhookSecret?:string|null;portalConfig?:string|null},ctx:Context)=>{
  const u=asAdmin(ctx);
  const columns:string[]=[];const values:unknown[]=[];
  if(secretKey!==undefined && secretKey!==null){
   assert(secretKey.length<=512&&(!secretKey||/^sk_(test|live)_[a-zA-Z0-9]+$/.test(secretKey)),'Stripe Secret Key 格式无效');
   values.push(secretKey?encryptSecret(secretKey):null);columns.push(`stripe_secret_ciphertext=$${values.length}`);
  }
  if(webhookSecret!==undefined && webhookSecret!==null){
   assert(webhookSecret.length<=512&&(!webhookSecret||/^whsec_[a-zA-Z0-9]+$/.test(webhookSecret)),'Stripe Webhook Secret 格式无效');
   values.push(webhookSecret?encryptSecret(webhookSecret):null);columns.push(`stripe_webhook_ciphertext=$${values.length}`);
  }
  if(portalConfig!==undefined && portalConfig!==null){
   assert(portalConfig.length<=200&&(!portalConfig||/^bpc_[a-zA-Z0-9]+$/.test(portalConfig)),'Stripe Portal Configuration ID 无效');
   values.push(portalConfig);columns.push(`stripe_portal_config=$${values.length}`);
  }
  assert(columns.length>0,'没有需要保存的配置');
  await updateStripeSettings(columns,values,u.id);
  return billingInfo();
 },
 adminSaveGlobalVideoKey:async (_:unknown,{key}:{key:string},ctx:Context)=>{
  const u=asAdmin(ctx);assert(key.length<=1024,'视频 API 密钥过长');
  await updateGlobalVideoKey(key?encryptSecret(key):null,u.id);return apiInfo();
 }
};
