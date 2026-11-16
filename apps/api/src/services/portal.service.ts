import { accountActivity,purchaseHistory,activeCatalog,renameUser } from '../repositories/portal.repository.js';
import { isoDate,purchaseView } from '../models/view-models.js';
import { requireMembership } from '../auth/sessions.js';
import type { Context } from '../models/context.js';
import { assert } from '../utils/errors.js';
import { checkoutCredits,createPortal,myCards } from '../billing/stripe.js';
import { platformSettings,walletBalance,isPlatformAdmin } from '../billing/common.js';
const requireUser=(ctx:Context)=>{assert(ctx.user,'请先登录',401);return ctx.user;};

export const portalServiceQueries={
 viewerCapabilities:(_:unknown,_a:unknown,ctx:Context)=>({platformAdmin:isPlatformAdmin(ctx.user)}),
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
 updateMyName:async (_:unknown,{name}:{name:string},ctx:Context)=>{
  const u=requireUser(ctx);const cleaned=name.trim();assert(cleaned.length>=2&&cleaned.length<=120,'姓名需要 2–120 字符');
  return renameUser(u.id,cleaned);
 },
 createCheckout:async (_:unknown,{orgId,productId}:{orgId:string;productId:string},ctx:Context)=>
  checkoutCredits(requireUser(ctx),orgId,productId),
 createBillingPortal:async (_:unknown,_a:unknown,ctx:Context)=>createPortal(requireUser(ctx))
};
