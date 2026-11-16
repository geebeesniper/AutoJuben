import { accountActivity,purchaseHistory,activeCatalog,renameUser,publishedHelpArticles,myHelpThreads,myHelpMessages,openHelpTicket,replyHelpTicket } from '../repositories/portal.repository.js';
import { isoDate,purchaseView } from '../models/view-models.js';
import { requireMembership } from '../auth/sessions.js';
import type { Context } from '../models/context.js';
import { assert } from '../utils/errors.js';
import { checkoutCredits,createPortal,myCards } from '../billing/stripe.js';
import { platformSettings,walletBalance } from '../billing/common.js';
import {platformRole,adminRolePermissions} from './admin.service.js';
const requireUser=(ctx:Context)=>{assert(ctx.user,'请先登录',401);return ctx.user;};

const helpCategories=['getting_started','generation','billing','account','api','troubleshooting'];
const ticketCategories=['general','generation','technical','billing','account'];
const statuses=['open','pending','resolved','closed'];
const isUUID=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const portalServiceQueries={
  helpArticles:async (_:unknown,{category,search,locale,limit}:{category:string;search:string;locale:string;limit:number})=>{
    assert(['',...helpCategories].includes(category),'无效知识库分类',400);
    assert(['zh','en','es'].includes(locale),'无效语言',400);
    assert(search.length<=100 && Number.isInteger(limit)&&limit>=1&&limit<=100,'检索参数无效',400);
    return publishedHelpArticles(category,search.trim(),locale as 'zh'|'en'|'es',limit);
  },
  myHelpThreads:async (_:unknown,{category,status,limit}:{category:string;status:string;limit:number},ctx:Context)=>{
    const u=requireUser(ctx);
    assert(['',...ticketCategories].includes(category) && ['',...statuses].includes(status),'无效筛选条件',400);
    assert(Number.isInteger(limit)&&limit>=1&&limit<=100,'查询条数无效',400);
    return (await myHelpThreads(u.id,category,status,limit)).map((r:any)=>({...r,createdAt:isoDate(r.createdAt),updatedAt:isoDate(r.updatedAt)}));
  },
  myHelpMessages:async (_:unknown,{threadId,limit}:{threadId:string;limit:number},ctx:Context)=>{
    const u=requireUser(ctx);
    assert(isUUID(threadId)&&Number.isInteger(limit)&&limit>=1&&limit<=100,'参数无效',400);
    const rows=await myHelpMessages(u.id,threadId,limit);
    assert(rows,'会话不存在或无权访问',404);
    return rows.map((r:any)=>({...r,createdAt:isoDate(r.createdAt)}));
  },
 viewerCapabilities:async(_:unknown,_a:unknown,ctx:Context)=>{
  const role=await platformRole(ctx.user);
  return {platformAdmin:Boolean(role),adminRole:role??'',adminCapabilities:role?[...adminRolePermissions(role)]:[]};
 },
 myHistory:async (_:unknown,{orgId,limit}:{orgId:string;limit:number},ctx:Context)=>{
  const u=requireUser(ctx);await requireMembership(u,orgId);
  assert(Number.isInteger(limit)&&limit>=1&&limit<=100,'最多 100 条',400);
  const rows=await accountActivity(u.id,orgId,limit);
  return rows.map((x:any)=>({...x,detail:JSON.stringify(x.detail),createdAt:isoDate(x.created_at)}));
 },
 myOrders:async (_:unknown,{limit}:{limit:number},ctx:Context)=>{
  const u=requireUser(ctx);assert(Number.isInteger(limit)&&limit>=1&&limit<=100,'最多 100 条');
  return (await purchaseHistory(u.id,limit)).map(purchaseView);
 },
 billingCatalog:async (_:unknown,_a:unknown,ctx:Context)=>{
  requireUser(ctx);
  return (await activeCatalog()).map((x:any)=>({...x,amountCents:x.amount_cents}));
 },
 myPaymentCards:async (_:unknown,_a:unknown,ctx:Context)=>myCards(requireUser(ctx)),
 walletSummary:async (_:unknown,{orgId}:{orgId:string},ctx:Context)=>{
  await requireMembership(requireUser(ctx),orgId);
  const s=await platformSettings();return {balance:await walletBalance(orgId),usageBillingEnabled:s.usage_billing_enabled};
 },
 billingAvailability:async (_:unknown,_a:unknown,ctx:Context)=>{
  requireUser(ctx);const s=await platformSettings();return {enabled:s.payments_enabled,gateway:'stripe',message:s.payments_enabled?'在线购买已启用':'在线购买尚未开放，请联系管理员'};
 }
};
export const portalServiceMutations={
  openHelpTicket:async (_:unknown,{category,subject,content}:{category:string;subject:string;content:string},ctx:Context)=>{
    const u=requireUser(ctx);
    assert(ticketCategories.includes(category),'请选择有效的问题类别',400);
    assert(subject.trim().length>=3&&subject.length<=200,'标题需 3–200 字符',400);
    assert(content.trim().length>=5&&content.length<=8000,'消息需 5–8000 字符',400);
    const id=await openHelpTicket(u.id,category,subject.trim(),content.trim());
    assert(id,'提交支持工单失败',500);return id;
  },
  replyHelpTicket:async (_:unknown,{threadId,content}:{threadId:string;content:string},ctx:Context)=>{
    const u=requireUser(ctx);
    assert(isUUID(threadId),'会话 ID 无效',400);
    assert(content.trim().length>=1&&content.length<=8000,'回复需 1–8000 字符',400);
    const ok=await replyHelpTicket(u.id,threadId,content.trim());
    assert(ok,'工单不存在、已关闭或无权访问',404);return true;
  },
 updateMyName:async (_:unknown,{name}:{name:string},ctx:Context)=>{
  const u=requireUser(ctx);const cleaned=name.trim();assert(cleaned.length>=2&&cleaned.length<=120,'姓名需要 2–120 字符');
  return renameUser(u.id,cleaned);
 },
 createCheckout:async (_:unknown,{orgId,productId}:{orgId:string;productId:string},ctx:Context)=>
  checkoutCredits(requireUser(ctx),orgId,productId),
 createBillingPortal:async (_:unknown,_a:unknown,ctx:Context)=>createPortal(requireUser(ctx))
};
