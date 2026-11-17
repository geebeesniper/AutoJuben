import { randomUUID } from 'node:crypto';
import { findUsers,findOrders,allProducts,allTariffs,findUserEmail,setUserDisabled,
  upsertProduct,upsertTariff,deleteTariff,hasActiveProduct,hasActiveTariff,setBillingFlags,
  updateStripeSettings,updateGlobalVideoKey,
  adminStaffRole,adminStaffList,adminSetStaffRole,adminAudit,adminLedgerRows,
  adminInvestigationRows,adminThreads,adminThreadMessages,adminCreateThread,adminPostMessage,adminChangeThread,adminOverviewRows,anyProviderJobsInFlight,saveGlobalProviderRoutes } from '../repositories/admin.repository.js';
import { isoDate,billingProductView,adminOrderView } from '../models/view-models.js';
import { encryptSecret } from '../auth/security.js';
import { config } from '../config.js';
import { stripeClient } from '../billing/stripe.js';
import { decryptSecret } from '../auth/security.js';
import { getGlobalProviderApiRoutes,testGlobalProviderConnection,validateProviderApiRoutes,type ProviderApiRoutes } from '../provider/client.js';
import { assert } from '../utils/errors.js';
import { isPlatformAdmin,platformSettings,stripeCredentials } from '../billing/common.js';
import type { Context } from '../models/context.js';

export type AdminRole='super_admin'|'operations_manager'|'finance_manager'|'support_lead'|'analyst'|'auditor';
type AdminCapability='users'|'billing'|'secrets'|'operations'|'messaging'|'staff'|'ledger'|'investigation';
const permissions:Record<AdminRole,readonly AdminCapability[]>={
 super_admin:['users','billing','secrets','operations','messaging','staff','ledger','investigation'],
 operations_manager:['users','operations','messaging','staff','ledger','investigation'],
 finance_manager:['billing','ledger','messaging','investigation'],
 support_lead:['users','messaging','investigation'],
 analyst:['investigation'],
 auditor:['ledger','investigation']
};
export function adminRolePermissions(role:AdminRole):readonly AdminCapability[]{return permissions[role];}
export async function platformRole(user:Context['user']):Promise<AdminRole|null>{
 if(!user)return null;
 if(isPlatformAdmin(user))return 'super_admin';
 const role=await adminStaffRole(user.id);
 return role && Object.prototype.hasOwnProperty.call(permissions,role)?role as AdminRole:null;
}
const asAdmin=async(ctx:Context,cap:AdminCapability)=>{
 assert(ctx.user,'请先登录',401);
 const role=await platformRole(ctx.user);
 assert(role && permissions[role].includes(cap),'当前管理员级别没有执行该操作的权限',403);
 return {user:ctx.user,role};
};
function validDate(raw:string):string|null{
 if(!raw)return null;
 const ms=Date.parse(raw);
 assert(Number.isFinite(ms) && /^(?:19|20)\d\d-\d\d-\d\d(?:T.*)?$/.test(raw),'日期格式不正确',400);
 return new Date(ms).toISOString();
}
function boundedDates(from:string,to:string):{from:string;to:string|null}{
 const toValue=validDate(to);
 const start=validDate(from)??new Date(Date.now()-30*86400000).toISOString();
 assert((toValue?Date.parse(toValue):Date.now())>Date.parse(start),'结束日期必须在开始日期之后',400);
 assert((toValue?Date.parse(toValue):Date.now())-Date.parse(start)<=366*86400000,'单次查询最多 366 天，请缩小日期范围',400);
 return {from:start,to:toValue};
}
function searchBounds(limit:number,search:string){assert(Number.isInteger(limit)&&limit>=1&&limit<=100,'最多查询100条',400);assert(search.length<=120,'筛选关键字过长',400);}


async function billingInfo(){
 const s=await platformSettings();const keys=await stripeCredentials();
 return {paymentsEnabled:s.payments_enabled,usageBillingEnabled:s.usage_billing_enabled,
  stripeSecretConfigured:Boolean(keys.secret),webhookSecretConfigured:Boolean(keys.webhook),portalConfigured:Boolean(keys.portal),
  stripeMode:keys.secret.startsWith('sk_live_')?'LIVE':keys.secret.startsWith('sk_test_')?'TEST':'NOT CONFIGURED',
  webhookUrl:`${config.origin}/api/stripe`};
}
async function apiInfo(){
 const [s,routes]=await Promise.all([platformSettings(),getGlobalProviderApiRoutes()]);
 return {baseUrl:config.providerUrl,mock:config.mockProvider,
  globalKeyConfigured:Boolean(s.provider_key_ciphertext||config.providerKey),endpointEditableInVercel:true,
  routes};
}
export const adminServiceQueries={
 adminOverview:async (_:unknown,args:{from:string;to:string;timezone:string;unit:string},ctx:Context)=>{
   const actor=await asAdmin(ctx,'investigation');
   assert(args.from.length<=40&&args.to.length<=40&&args.timezone.length<=80,'查询参数过长',400);
   assert(['hour','day'].includes(args.unit),'时间粒度无效',400);
   const start=Date.parse(args.from),end=Date.parse(args.to),now=Date.now();
   assert(Number.isFinite(start)&&Number.isFinite(end)&&start<end,'时间范围无效',400);
   const elapsed=end-start;
   assert(elapsed<=366*86400000+3600000,'单次最多查询366天',400);
   assert(elapsed>=3600000,'时间范围过短',400);
   assert(start<=now&&end<=now+27*3600000,'不能选择未来时间段',400);
   if(args.unit==='hour')assert(elapsed<=75*3600000,'小时趋势单次最多显示3天',400);
   try{new Intl.DateTimeFormat('en-US',{timeZone:args.timezone}).format(new Date());}
   catch{assert(false,'不支持的时区',400);}
   const canRevenue=permissions[actor.role].includes('ledger');
   const unit=args.unit as 'hour'|'day';
   const raw=await adminOverviewRows({from:new Date(start).toISOString(),to:new Date(end).toISOString(),
      timezone:args.timezone,unit,withRevenue:canRevenue});
   type Point={key:string;revenueCents:number|null;alerts:number;errors:number;online:number|null;peak:number|null};
   const points=new Map<string,Point>();
   const row=(key:string)=>{
     let record=points.get(key);
     if(!record){record={key,revenueCents:canRevenue?0:null,alerts:0,errors:0,online:raw.tracked?0:null,peak:raw.tracked?0:null};points.set(key,record);}
     return record;
   };
   for(const v of raw.revenue)row(v.key).revenueCents=Number(v.value);
   for(const v of raw.alerts)row(v.key).alerts=Number(v.value);
   for(const v of raw.errors)row(v.key).errors=Number(v.value);
   // The most recent 5-minute sample is online users; the highest sample is the peak.
   // These are sampled active USERS, not number of open browser connections.
   const latest=new Map<string,number>();
   const dayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:args.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
   for(const v of raw.presence){
     const tick=new Date(v.tick);
     const key=unit==='hour'?tick.toISOString().slice(0,13)+':00:00Z':(()=>{
       const x=Object.fromEntries(dayFormatter.formatToParts(tick).map(z=>[z.type,z.value]));
       return x.year+'-'+x.month+'-'+x.day;
     })();
     const point=row(key);
     const users=Number(v.users);
     if(!latest.has(key)||tick.getTime()>latest.get(key)!){point.online=users;latest.set(key,tick.getTime());}
     point.peak=Math.max(Number(point.peak??0),users);
   }
   return {canRevenue,hasPresence:raw.tracked,buckets:[...points.values()].sort((a,b)=>a.key.localeCompare(b.key))};
 },
 adminStaff:async (_:unknown,_args:unknown,ctx:Context)=>{
   await asAdmin(ctx,'staff');
   return (await adminStaffList()).map((s:any)=>({userId:s.user_id,email:s.email,name:s.name,role:s.role,active:s.active,updatedAt:isoDate(s.updated_at)}));
 },
 adminMyRole:async (_:unknown,_args:unknown,ctx:Context)=>{
   assert(ctx.user,'请先登录',401);
   const role=await platformRole(ctx.user);
   assert(role,'仅平台管理员可以访问',403);
   return {role,capabilities:permissions[role]};
 },
 adminLedger:async (_:unknown,args:{orgId:string;sourceType:string;search:string;from:string;to:string;before:string;limit:number},ctx:Context)=>{
   await asAdmin(ctx,'ledger');searchBounds(args.limit,args.search);
   assert(args.orgId.length<=80&&args.sourceType.length<=80,'查询参数无效');
   assert(!args.before||/^\d{1,20}$/.test(args.before),'分页游标无效');
   const dates=boundedDates(args.from,args.to);
   const rows=await adminLedgerRows({...args,...dates,before:args.before||null});
   return rows.map((r:any)=>({...r,createdAt:isoDate(r.createdAt)}));
 },
 adminInvestigations:async (_:unknown,args:{orgId:string;eventType:string;search:string;userId:string;from:string;to:string;before:string;limit:number},ctx:Context)=>{
   await asAdmin(ctx,'investigation');searchBounds(args.limit,args.search);
   assert(args.orgId.length<=80&&args.userId.length<=80,'查询参数无效');
   assert(['','video','order','audit','api','admin'].includes(args.eventType),'事件类型无效');
   assert(!args.before||/^20\d\d-[^|]{1,50}\|(?:video|order|audit|api|admin)\|[0-9a-fA-F-]{1,40}$/.test(args.before),'分页游标无效');
   const dates=boundedDates(args.from,args.to);
   const rows=await adminInvestigationRows({...args,...dates,before:args.before||null});
   return rows.map((r:any)=>({...r,createdAt:isoDate(r.createdAt)}));
 },
 adminUserTimeline:async (_:unknown,{userId,from,to,limit}:{userId:string;from:string;to:string;limit:number},ctx:Context)=>{
   await asAdmin(ctx,'investigation');searchBounds(limit,'');
   assert(/^[0-9a-f-]{36}$/i.test(userId),'用户 ID 格式无效');
   const dates=boundedDates(from,to);
   const rows=await adminInvestigationRows({orgId:'',eventType:'',search:'',userId,from:dates.from,to:dates.to,limit,before:null});
   return rows.map((r:any)=>({...r,createdAt:isoDate(r.createdAt)}));
 },
 adminInbox:async (_:unknown,{search,status,category,channel,limit}:{search:string;status:string;category:string;channel:string;limit:number},ctx:Context)=>{
   await asAdmin(ctx,'messaging');searchBounds(limit,search);
   assert(['','open','pending','resolved','closed'].includes(status),'无效工单状态');
   assert(['','support','billing','technical','compliance','internal','general','generation','account'].includes(category),'无效工单分类');
   assert(['internal','customer'].includes(channel),'无效消息频道');
   return (await adminThreads({search,status,category,channel:channel as 'internal'|'customer',limit})).map((r:any)=>({...r,createdAt:isoDate(r.createdAt),updatedAt:isoDate(r.updatedAt)}));
 },
 adminMessages:async (_:unknown,{threadId,limit}:{threadId:string;limit:number},ctx:Context)=>{
   await asAdmin(ctx,'messaging');searchBounds(limit,'');
   const rows=await adminThreadMessages(threadId,limit);
   assert(rows,'消息会话不存在',404);
   return rows.map((r:any)=>({...r,createdAt:isoDate(r.createdAt)}));
 },

 adminSearchUsers:async (_:unknown,{search,limit,offset}:{search:string;limit:number;offset:number},ctx:Context)=>{
  await asAdmin(ctx,'users');assert(Number.isInteger(limit)&&limit>=1&&limit<=100&&Number.isInteger(offset)&&offset>=0&&offset<=10000,'分页参数无效');
  assert(search.length<=100,'搜索字符串过长');
  return (await findUsers(search.trim(),limit,offset)).map((x:any)=>({id:x.id,name:x.name,email:x.email,
    disabled:x.is_disabled,orgCount:x.org_count,orders:x.orders,createdAt:isoDate(x.created_at)}));
 },
 adminOrders:async (_:unknown,{search,status,limit}:{search:string;status:string;limit:number},ctx:Context)=>{
  await asAdmin(ctx,'billing');assert(search.length<=100&&status.length<=40&&Number.isInteger(limit)&&limit>=1&&limit<=100,'搜索参数无效');
  return (await findOrders(search.trim(),status,limit)).map(adminOrderView);
 },
 adminProducts:async (_:unknown,_a:unknown,ctx:Context)=>{await asAdmin(ctx,'billing');return (await allProducts()).map(billingProductView);},
 adminTariffs:async (_:unknown,_a:unknown,ctx:Context)=>{await asAdmin(ctx,'billing');return allTariffs();},
 adminBillingSettings:async (_:unknown,_a:unknown,ctx:Context)=>{await asAdmin(ctx,'billing');return billingInfo();},
 adminApiSettings:async (_:unknown,_a:unknown,ctx:Context)=>{await asAdmin(ctx,'operations');return apiInfo();},
 adminTestStripe:async (_:unknown,_a:unknown,ctx:Context)=>{
  await asAdmin(ctx,'billing');
  try{const stripe=await stripeClient();await stripe.balance.retrieve();return {ok:true,message:'Stripe 凭据可用，已成功访问 Stripe API。'};}
  catch(e){return {ok:false,message:e instanceof Error?e.message.slice(0,160):'Stripe 连接失败'};}
 },
 adminTestVideoApi:async (_:unknown,_a:unknown,ctx:Context)=>{
  await asAdmin(ctx,'operations');
  return testGlobalProviderConnection();
 }
};
export const adminServiceMutations={
 adminSetStaffRole:async (_:unknown,{userId,role,active}:{userId:string;role:string;active:boolean},ctx:Context)=>{
   const actor=await asAdmin(ctx,'staff');
   assert(['operations_manager','finance_manager','support_lead','analyst','auditor'].includes(role),'角色不存在',400);
   assert(userId!==actor.user.id,'不能修改自己的权限',403);
   const target=await findUserEmail(userId);assert(target,'用户不存在',404);
   assert(!config.platformAdminEmails.includes(target.email.toLowerCase()),'超级管理员只能通过服务器配置管理',403);
   if(actor.role!=='super_admin')assert(['support_lead','analyst','auditor'].includes(role),'当前级别不能分配高级管理职位',403);
   const updated=await adminSetStaffRole(userId,role,active,actor.user.id);
   await adminAudit(actor.user.id,'staff.roleUpdated','user',userId,{role,active});
   return Boolean(updated);
 },
 adminCreateThread:async (_:unknown,{subject,category,priority,customerId,assignedAdminId,channel}:{subject:string;category:string;priority:string;customerId?:string;assignedAdminId?:string;channel:string},ctx:Context)=>{
   const actor=await asAdmin(ctx,'messaging');
   assert(subject.trim().length>=3&&subject.length<=200,'会话标题需3-200字符');
   assert(['internal','customer'].includes(channel),'无效消息频道');
   assert((channel==='internal'?['internal','support','billing','technical','compliance']:['general','generation','technical','billing','account']).includes(category),'无效频道类别');
   assert(channel==='customer'?Boolean(customerId):!customerId,'客户频道必须指定用户，内部频道不得绑定客户');
   assert(['low','normal','high','urgent'].includes(priority),'优先级无效');
   if(customerId){assert(await findUserEmail(customerId),'客户不存在',404);}
   if(assignedAdminId){const assigned=await findUserEmail(assignedAdminId);assert(assigned,'负责人不存在',404);assert(isPlatformAdmin({id:assignedAdminId,name:'',email:assigned.email})||Boolean(await adminStaffRole(assignedAdminId)),'负责人不是平台管理员',403);}
   const created=await adminCreateThread(subject.trim(),category,priority,customerId||null,assignedAdminId||null,actor.user.id,channel as 'internal'|'customer');
   await adminAudit(actor.user.id,'inbox.created','thread',created.id,{channel,category,priority});
   return created.id as string;
 },
 adminSendMessage:async (_:unknown,{threadId,content}:{threadId:string;content:string},ctx:Context)=>{
   const actor=await asAdmin(ctx,'messaging');
   assert(content.trim().length>0&&content.length<=8000,'消息长度须为1-8000字符');
   const sent=await adminPostMessage(threadId,actor.user.id,content.trim());
   assert(sent,'会话不存在或已关闭',404);
   await adminAudit(actor.user.id,'inbox.messageSent','thread',threadId);
   return true;
 },
 adminUpdateThread:async (_:unknown,{threadId,status,priority,assignedAdminId}:{threadId:string;status:string;priority:string;assignedAdminId?:string},ctx:Context)=>{
   const actor=await asAdmin(ctx,'messaging');
   assert(['open','pending','resolved','closed'].includes(status),'无效工单状态');
   assert(['low','normal','high','urgent'].includes(priority),'无效优先级');
   if(assignedAdminId){const a=await findUserEmail(assignedAdminId);assert(a,'负责人不存在',404);assert(isPlatformAdmin({id:assignedAdminId,name:'',email:a.email})||Boolean(await adminStaffRole(assignedAdminId)),'负责人不是管理员',403);}
   const row=await adminChangeThread(threadId,status,priority,assignedAdminId||null);
   assert(row,'会话不存在',404);
   await adminAudit(actor.user.id,'inbox.updated','thread',threadId,{status,priority,assignedAdminId:assignedAdminId??null});
   return true;
 },

 adminSetUserDisabled:async (_:unknown,{userId,disabled}:{userId:string;disabled:boolean},ctx:Context)=>{
  const u=(await asAdmin(ctx,'users')).user;assert(userId!==u.id,'不能禁用自己');
  const victim=await findUserEmail(userId);assert(victim,'用户不存在',404);
  assert(!config.platformAdminEmails.includes(victim.email.toLowerCase()),'不能禁用其他平台管理员',403);
  await setUserDisabled(userId,disabled);return true;
 },
 adminSaveProduct:async (_:unknown,{id,sku,name,description,credits,amountCents,active}:any,ctx:Context)=>{
  await asAdmin(ctx,'billing');const s=String(sku).trim().toLowerCase(),n=String(name).trim();
  assert(/^[a-z0-9][a-z0-9_-]{1,63}$/.test(s),'SKU 需为小写字母、数字、- 或 _');
  assert(n.length>=2&&n.length<=120,'商品名称无效');
  assert(Number.isInteger(credits)&&credits>0&&credits<=1000000,'积分数量无效');
  assert(Number.isInteger(amountCents)&&amountCents>=50&&amountCents<=100000000,'价格需至少 $0.50');
  assert(String(description??'').length<=1000,'描述过长');
  return billingProductView(await upsertProduct(id||randomUUID(),s,n,String(description??''),credits,amountCents,active));
 },
 adminSaveTariff:async (_:unknown,{model,resolution,credits,active}:any,ctx:Context)=>{
  await asAdmin(ctx,'billing');assert(['xinghe-2.0','xinghe-fast'].includes(model),'不支持的模型');
  assert(['480p','720p','1080p','4k'].includes(resolution),'不支持的清晰度');
  assert(Number.isInteger(credits)&&credits>=1&&credits<=1000000,'积分价格无效');
  return upsertTariff(model,resolution,credits,active);
 },
 adminDeleteTariff:async (_:unknown,{model,resolution}:{model:string;resolution:string},ctx:Context)=>{
  await asAdmin(ctx,'billing');return deleteTariff(model,resolution);
 },
 adminSetBillingFlags:async (_:unknown,{paymentsEnabled,usageBillingEnabled}:{paymentsEnabled:boolean;usageBillingEnabled:boolean},ctx:Context)=>{
  const u=(await asAdmin(ctx,'billing')).user;assert(!usageBillingEnabled||paymentsEnabled,'启用按任务计费前必须开放支付');
  const creds=await stripeCredentials();
  if(paymentsEnabled){
    assert(/^sk_(test|live)_/.test(creds.secret)&&creds.webhook,'启用支付前需配置 Stripe 密钥和 Webhook Secret');
    assert(await hasActiveProduct(),'至少启用一个有效商品');
  }
  if(usageBillingEnabled)assert(await hasActiveTariff(),'至少设置一条视频任务积分价格');
  await setBillingFlags(paymentsEnabled,usageBillingEnabled,u.id);return billingInfo();
 },
 adminSaveStripeIntegration:async (_:unknown,{secretKey,webhookSecret,portalConfig}:{secretKey?:string|null;webhookSecret?:string|null;portalConfig?:string|null},ctx:Context)=>{
  const u=(await asAdmin(ctx,'secrets')).user;
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
 adminSaveGlobalApiRoutes:async (_:unknown,{input}:{input:ProviderApiRoutes},ctx:Context)=>{
  const admin=await asAdmin(ctx,'secrets');
  const safe=validateProviderApiRoutes(input);
  assert(!(await anyProviderJobsInFlight()),
    '平台仍有未完成或状态未知的视频任务；为避免任务丢失，请先处理这些任务再更改全局接口',409);
  await saveGlobalProviderRoutes(safe,admin.user.id);
  await adminAudit(admin.user.id,'provider.routesUpdated','platform','global',{routes:safe});
  return apiInfo();
 },
 adminSaveGlobalVideoKey:async (_:unknown,{key}:{key:string},ctx:Context)=>{
  const u=(await asAdmin(ctx,'secrets')).user;assert(key.length<=1024,'视频 API 密钥过长');
  await updateGlobalVideoKey(key?encryptSecret(key):null,u.id);return apiInfo();
 }
};
