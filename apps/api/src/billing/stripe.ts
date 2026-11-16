import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { query,transaction, type DbClient } from '../db/pool.js';
import { assert,AppError } from '../utils/errors.js';
import type { User } from '../auth/sessions.js';
import { requireMembership } from '../auth/sessions.js';
import { platformSettings,postCredit,stripeCredentials,safeStripeUrl } from './common.js';
import { refundCreditTotal } from './rules.js';

export async function stripeClient():Promise<Stripe> {
 const {secret}=await stripeCredentials();
 assert(/^sk_(test|live)_/.test(secret),'请先在管理员支付设置中配置 Stripe Secret Key',503);
 return new Stripe(secret,{maxNetworkRetries:1,timeout:12000});
}
async function ensureCustomer(stripe:Stripe,user:User):Promise<string>{
 const r=await query<{stripe_customer_id:string}>('SELECT stripe_customer_id FROM billing_customers WHERE user_id=$1',[user.id]);
 if(r.rows[0])return r.rows[0].stripe_customer_id;
 const c=await stripe.customers.create({email:user.email,name:user.name,metadata:{autojuben_user_id:user.id}},
  {idempotencyKey:`aj-customer-${user.id}`});
 await query(`INSERT INTO billing_customers(user_id,stripe_customer_id) VALUES($1,$2)
  ON CONFLICT (user_id) DO NOTHING`,[user.id,c.id]);
 const again=(await query<{stripe_customer_id:string}>('SELECT stripe_customer_id FROM billing_customers WHERE user_id=$1',[user.id])).rows[0];
 return again.stripe_customer_id;
}
export async function myCards(user:User){
 const linked=(await query<{stripe_customer_id:string}>('SELECT stripe_customer_id FROM billing_customers WHERE user_id=$1',[user.id])).rows[0];
 if(!linked)return [];
 const stripe=await stripeClient();
 const methods=await stripe.paymentMethods.list({customer:linked.stripe_customer_id,type:'card',limit:30});
 return methods.data.map(x=>({id:x.id,brand:x.card?.brand??'card',last4:x.card?.last4??'••••',expMonth:x.card?.exp_month??0,expYear:x.card?.exp_year??0}));
}
export async function createPortal(user:User):Promise<{url:string}>{
 const stripe=await stripeClient();
 const customer=await ensureCustomer(stripe,user);
 const {portal}=await stripeCredentials();
 const session=await stripe.billingPortal.sessions.create({customer,return_url:`${config.origin}/?tab=billing`,...(portal?{configuration:portal}:{})});
 return {url:safeStripeUrl(session.url)};
}
export async function checkoutCredits(user:User,orgId:string,productId:string):Promise<{url:string;orderId:string}>{
 await requireMembership(user,orgId,['owner','admin']);
 const settings=await platformSettings();
 assert(settings.payments_enabled,'平台尚未开放购买',409);
 const p=(await query<{id:string;name:string;description:string;credits:number;amount_cents:number;currency:string}>(
  'SELECT id,name,description,credits,amount_cents,currency FROM billing_products WHERE id=$1 AND active=true',[productId])).rows[0];
 assert(p,'商品不存在或已下架',404);
 const stripe=await stripeClient();
 const customer=await ensureCustomer(stripe,user);
 const orderId=randomUUID();
 await query(`INSERT INTO purchase_orders(id,user_id,org_id,product_id,product_name,credits,amount_cents,currency,stripe_customer_id)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[orderId,user.id,orgId,p.id,p.name,p.credits,p.amount_cents,p.currency,customer]);
 try {
  const session=await stripe.checkout.sessions.create({
   customer,mode:'payment',client_reference_id:orderId,
   line_items:[{quantity:1,price_data:{currency:p.currency,unit_amount:p.amount_cents,
     product_data:{name:p.name,description:p.description||undefined}}}],
   payment_method_types:['card'],
   payment_intent_data:{metadata:{autojuben_order_id:orderId}},
   metadata:{autojuben_order_id:orderId,autojuben_org_id:orgId,autojuben_user_id:user.id},
   success_url:`${config.origin}/?tab=purchases&payment=return`,
   cancel_url:`${config.origin}/?tab=shop&payment=cancel`
  },{idempotencyKey:`aj-checkout-${orderId}`});
  assert(session.url,'Stripe 没有返回 Checkout URL',502);
  await query(`UPDATE purchase_orders SET stripe_session_id=$2,status='checkout',updated_at=now() WHERE id=$1`,[orderId,session.id]);
  return {url:safeStripeUrl(session.url),orderId};
 }catch(e){
  // A network timeout does not prove Stripe did not accept the request. Never issue credits here.
  await query(`UPDATE purchase_orders SET error_message=$2,updated_at=now() WHERE id=$1`,[orderId,'结账创建未确认，请通过 Stripe 后台核实订单']);
  throw e;
 }
}

export type PurchaseRow={id:string;org_id:string;user_id:string;status:string;amount_cents:number;currency:string;credits:number;refunded_amount_cents:number;refunded_credits:number;stripe_session_id:string|null;stripe_customer_id:string|null;stripe_payment_intent_id:string|null};
async function recordPayment(db:DbClient,session:Stripe.Checkout.Session){
 const id=session.metadata?.autojuben_order_id||session.client_reference_id;
 assert(id && /^[0-9a-f-]{36}$/i.test(id),'Stripe 订单标识无效',422);
 const r=await db.query<PurchaseRow>('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[id]);
 const order=r.rows[0];assert(order,'Stripe 订单不存在',404);
 assert(!order.stripe_session_id||order.stripe_session_id===session.id,'Stripe Checkout session 不匹配',409);
 assert(session.currency?.toLowerCase()===order.currency && session.amount_total===order.amount_cents,'Stripe 金额或币种与订单不一致',409);
 const customer=typeof session.customer==='string'?session.customer:session.customer?.id;
 assert(customer===order.stripe_customer_id,'Stripe Customer 不匹配',409);
 const intent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id??null;
 if(session.payment_status!=='paid'){
  if(!['paid','partially_refunded','refunded'].includes(order.status))
   await db.query(`UPDATE purchase_orders SET status='pending',stripe_session_id=$2,updated_at=now() WHERE id=$1`,[id,session.id]);
  return;
 }
 if(!['paid','partially_refunded','refunded'].includes(order.status)){
  await db.query(`UPDATE purchase_orders SET status='paid',paid_at=now(),stripe_session_id=$2,stripe_payment_intent_id=$3,
   error_message=NULL,updated_at=now() WHERE id=$1`,[id,session.id,intent]);
  await postCredit(db,order.org_id,order.credits,'purchase_paid',id);
  await db.query('INSERT INTO audit_logs(org_id,actor_id,action,detail) VALUES($1,$2,$3,$4)',
   [order.org_id,order.user_id,'purchase.paid',JSON.stringify({orderId:id,credits:order.credits})]);
 }else if(intent && !order.stripe_payment_intent_id) {
  await db.query('UPDATE purchase_orders SET stripe_payment_intent_id=$2 WHERE id=$1',[id,intent]);
 }
 if(intent){
  const refunds=await db.query<{amount_refunded:number}>(`SELECT MAX(amount_refunded) AS amount_refunded FROM stripe_refund_events WHERE stripe_payment_intent_id=$1`,[intent]);
  const amount=Number(refunds.rows[0]?.amount_refunded||0);
  if(amount>0)await applyRefund(db,id,amount);
 }
}
async function applyRefund(db:DbClient,orderId:string,refunded:number){
 const order=(await db.query<PurchaseRow>('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
 if(!order||!['paid','partially_refunded','refunded'].includes(order.status))return;
 const amount=Math.max(order.refunded_amount_cents,Math.min(order.amount_cents,refunded));
 const credited=refundCreditTotal(order.credits,order.amount_cents,amount);
 const revoke=credited-order.refunded_credits;
 if(revoke>0)await postCredit(db,order.org_id,-revoke,'purchase_refund',`${orderId}:${amount}`);
 await db.query(`UPDATE purchase_orders SET refunded_amount_cents=$2,refunded_credits=$3,
  status=CASE WHEN $2>=amount_cents THEN 'refunded' WHEN $2>0 THEN 'partially_refunded' ELSE 'paid' END,
  updated_at=now() WHERE id=$1`,[orderId,amount,credited]);
}
/** Valid Stripe event from verified raw request body; all effects and event id committed together. */
export async function processStripeEvent(event:Stripe.Event){
 await transaction(async db=>{
  const inserted=await db.query(`INSERT INTO stripe_webhook_events(event_id,event_type) VALUES($1,$2)
   ON CONFLICT DO NOTHING RETURNING event_id`,[event.id,event.type]);
  if(!inserted.rowCount)return;
  const obj=event.data.object;
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   await recordPayment(db,obj as Stripe.Checkout.Session);
  }else if(event.type==='checkout.session.async_payment_failed'||event.type==='checkout.session.expired'){
   const sess=obj as Stripe.Checkout.Session;
   const id=sess.metadata?.autojuben_order_id||sess.client_reference_id;
   if(id){await db.query(`UPDATE purchase_orders SET status=$2,updated_at=now()
     WHERE id=$1 AND status NOT IN ('paid','partially_refunded','refunded')`,[id,event.type.endsWith('expired')?'expired':'failed']);}
  }else if(event.type==='charge.refunded'){
   const ch=obj as Stripe.Charge;
   const pi=typeof ch.payment_intent==='string'?ch.payment_intent:ch.payment_intent?.id;
   if(pi){
    await db.query(`INSERT INTO stripe_refund_events(stripe_charge_id,stripe_payment_intent_id,amount_refunded) VALUES($1,$2,$3)
     ON CONFLICT (stripe_charge_id) DO UPDATE SET amount_refunded=GREATEST(stripe_refund_events.amount_refunded,excluded.amount_refunded),updated_at=now()`,
     [ch.id,pi,ch.amount_refunded]);
    const found=(await db.query<PurchaseRow>('SELECT * FROM purchase_orders WHERE stripe_payment_intent_id=$1',[pi])).rows[0];
    if(found)await applyRefund(db,found.id,ch.amount_refunded);
   }
  }
 });
}
export async function handleStripeWebhook(request:Request):Promise<Response>{
 if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try{
  const sig=request.headers.get('stripe-signature');assert(sig,'Stripe signature missing',400);
  const {webhook}=await stripeCredentials();assert(webhook,'Stripe Webhook Secret 未配置',503);
  const raw=await request.text();assert(raw.length<=2_000_000,'Webhook body too large',413);
  const stripe=await stripeClient();
  let event:Stripe.Event;
  try{event=stripe.webhooks.constructEvent(raw,sig,webhook);}catch{throw new AppError(400,'Invalid Stripe webhook signature');}
  await processStripeEvent(event);
  return Response.json({received:true},{headers:{'Cache-Control':'no-store'}});
 }catch(err){
  const status=err instanceof AppError?err.status:500;
  if(status===500)console.error('[stripe-webhook]',err);
  return Response.json({error:status===500?'Webhook processing failed':(err as Error).message},
   {status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
}

/** Handles a rare race where the refund webhook commits before the checkout-paid event. */
export async function reconcilePendingRefunds():Promise<number>{
 const q=await query<{id:string;amount:number}>(`SELECT p.id,MAX(r.amount_refunded)::int AS amount
  FROM purchase_orders p JOIN stripe_refund_events r ON r.stripe_payment_intent_id=p.stripe_payment_intent_id
  WHERE p.status IN ('paid','partially_refunded') AND r.amount_refunded>p.refunded_amount_cents
  GROUP BY p.id ORDER BY p.id LIMIT 25`);
 for(const row of q.rows)await transaction(db=>applyRefund(db,row.id,row.amount));
 return q.rows.length;
}
