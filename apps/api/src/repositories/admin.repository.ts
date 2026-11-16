import { query } from '../db/pool.js';
/** Admin repositories deliberately do not authorize; all callers MUST pass through admin service. */
const escapeLike=(x:string)=>x.replace(/[\\%_]/g,'\\$&');
export async function findUsers(search:string,limit:number,offset:number){
  return (await query(`SELECT u.id,u.name,u.email,u.is_disabled,u.created_at,
    (SELECT COUNT(*)::int FROM memberships m WHERE m.user_id=u.id) AS org_count,
    (SELECT COUNT(*)::int FROM purchase_orders p WHERE p.user_id=u.id) AS orders
    FROM users u WHERE ($1='' OR u.email ILIKE $2 OR u.name ILIKE $2)
    ORDER BY u.created_at DESC LIMIT $3 OFFSET $4`,[search,`%${escapeLike(search)}%`,limit,offset])).rows;
}
export async function findOrders(search:string,status:string,limit:number){
  return (await query(`SELECT p.*,o.name AS org_name,u.name AS user_name,u.email
    FROM purchase_orders p JOIN users u ON u.id=p.user_id JOIN organizations o ON o.id=p.org_id
    WHERE ($1='' OR u.email ILIKE $3 OR p.id::text=$1) AND ($2='' OR p.status=$2)
    ORDER BY p.created_at DESC LIMIT $4`,[search,status,`%${escapeLike(search)}%`,limit])).rows;
}
export async function allProducts(){return (await query('SELECT * FROM billing_products ORDER BY amount_cents')).rows;}
export async function allTariffs(){return (await query('SELECT model,resolution,credits,active FROM video_tariffs ORDER BY model,resolution')).rows;}
export async function findUserEmail(userId:string){return (await query<{email:string}>('SELECT email FROM users WHERE id=$1',[userId])).rows[0];}
export async function setUserDisabled(userId:string,disabled:boolean){
  await query('UPDATE users SET is_disabled=$2,updated_at=now() WHERE id=$1',[userId,disabled]);
  if(disabled)await query('DELETE FROM sessions WHERE user_id=$1',[userId]);
}
export async function upsertProduct(id:string,sku:string,name:string,description:string,credits:number,amountCents:number,active:boolean){
  return (await query(`INSERT INTO billing_products(id,sku,name,description,credits,amount_cents,active) VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id) DO UPDATE SET sku=excluded.sku,name=excluded.name,description=excluded.description,credits=excluded.credits,
    amount_cents=excluded.amount_cents,active=excluded.active,updated_at=now() RETURNING *`,
    [id,sku,name,description,credits,amountCents,active])).rows[0];
}
export async function upsertTariff(model:string,resolution:string,credits:number,active:boolean){
  return (await query(`INSERT INTO video_tariffs(model,resolution,credits,active) VALUES($1,$2,$3,$4)
    ON CONFLICT(model,resolution) DO UPDATE SET credits=excluded.credits,active=excluded.active,updated_at=now() RETURNING *`,
    [model,resolution,credits,active])).rows[0];
}
export async function deleteTariff(model:string,resolution:string){
  return Boolean((await query('DELETE FROM video_tariffs WHERE model=$1 AND resolution=$2',[model,resolution])).rowCount);
}
export async function hasActiveProduct(){return Boolean((await query('SELECT 1 FROM billing_products WHERE active=true LIMIT 1')).rows[0]);}
export async function hasActiveTariff(){return Boolean((await query('SELECT 1 FROM video_tariffs WHERE active=true LIMIT 1')).rows[0]);}
export async function setBillingFlags(paymentsEnabled:boolean,usageBillingEnabled:boolean,userId:string){
  await query('UPDATE platform_settings SET payments_enabled=$1,usage_billing_enabled=$2,updated_by=$3,updated_at=now() WHERE id=1',
    [paymentsEnabled,usageBillingEnabled,userId]);
}
export async function updateStripeSettings(columns:string[],values:unknown[],userId:string){
  // columns are created ONLY in admin service from fixed literals, never user-provided identifiers.
  await query(`UPDATE platform_settings SET ${columns.join(',')},updated_by=$${values.length+1},updated_at=now() WHERE id=1`,[...values,userId]);
}
export async function updateGlobalVideoKey(ciphertext:string|null,userId:string){
  await query('UPDATE platform_settings SET provider_key_ciphertext=$1,updated_by=$2,updated_at=now() WHERE id=1',[ciphertext,userId]);
}

/** Enterprise admin features: all access-control decisions stay in admin.service.ts. */
export async function adminStaffRole(userId:string):Promise<string|null>{
 const row=(await query<{role:string}>(`SELECT s.role FROM platform_admin_staff s
  JOIN users u ON u.id=s.user_id WHERE s.user_id=$1 AND s.active=true AND u.is_disabled=false`,[userId])).rows[0];
 return row?.role??null;
}
export async function adminStaffList(){
 return (await query(`SELECT u.id,u.name,u.email,s.role,s.active,s.created_at,s.updated_at
 FROM platform_admin_staff s JOIN users u ON u.id=s.user_id
 ORDER BY s.active DESC,s.updated_at DESC LIMIT 200`)).rows;
}
export async function adminSetStaffRole(userId:string,role:string,active:boolean,actorId:string){
 return (await query(`INSERT INTO platform_admin_staff(user_id,role,active,created_by,updated_by)
 VALUES($1,$2,$3,$4,$4) ON CONFLICT(user_id) DO UPDATE
 SET role=excluded.role,active=excluded.active,updated_by=excluded.updated_by,updated_at=now()
 RETURNING user_id,role,active`,[userId,role,active,actorId])).rows[0];
}
export async function adminAudit(actorId:string,action:string,targetType?:string,targetId?:string,metadata:Record<string,unknown>={}){
 await query(`INSERT INTO platform_admin_audit(actor_id,action,target_type,target_id,metadata)
 VALUES($1,$2,$3,$4,$5::jsonb)`,[actorId,action,targetType??null,targetId??null,JSON.stringify(metadata)]);
}
/** Cursor-based billing ledger: stable monotonic IDs, bounded 100 rows. */
export async function adminLedgerRows(args:{orgId:string;sourceType:string;search:string;from:string|null;to:string|null;before:string|null;limit:number}){
 return (await query(`SELECT l.id::text AS id,l.org_id AS "orgId",o.name AS "orgName",
 l.delta,l.source_type AS "sourceType",l.source_id AS "sourceId",
 l.created_at AS "createdAt"
 FROM credit_ledger l JOIN organizations o ON o.id=l.org_id
 WHERE ($1='' OR l.org_id::text=$1)
 AND ($2='' OR l.source_type=$2)
 AND ($3='' OR l.source_id ILIKE $3)
 AND ($4::timestamptz IS NULL OR l.created_at >= $4::timestamptz)
 AND ($5::timestamptz IS NULL OR l.created_at < $5::timestamptz)
 AND ($6::bigint IS NULL OR l.id < $6::bigint)
 ORDER BY l.id DESC LIMIT $7`,[
 args.orgId,args.sourceType,args.search?`%${escapeLike(args.search)}%`:'',
 args.from,args.to,args.before,args.limit])).rows;
}
export async function adminInvestigationRows(args:{orgId:string;eventType:string;search:string;userId:string;from:string|null;to:string|null;limit:number;before:string|null}){
 // Each branch can use its own date index; no wildcard select or customer-generated SQL.
 return (await query(`
 WITH events AS (
 SELECT 'video'::text AS "eventType",v.id::text AS "eventId",v.org_id AS "orgId",v.created_by AS "userId",
 v.created_at AS "createdAt",v.status AS status,v.model AS summary
 FROM video_jobs v
 WHERE ($1='' OR v.org_id::text=$1) AND ($2='' OR $2='video')
   AND ($4::uuid IS NULL OR v.created_by=$4)
   AND ($5::timestamptz IS NULL OR v.created_at >= $5::timestamptz)
   AND ($6::timestamptz IS NULL OR v.created_at < $6::timestamptz)
 UNION ALL
 SELECT 'order',p.id::text,p.org_id,p.user_id,p.created_at,p.status,p.product_name
 FROM purchase_orders p
 WHERE ($1='' OR p.org_id::text=$1) AND ($2='' OR $2='order')
   AND ($4::uuid IS NULL OR p.user_id=$4)
   AND ($5::timestamptz IS NULL OR p.created_at >= $5::timestamptz)
   AND ($6::timestamptz IS NULL OR p.created_at < $6::timestamptz)
 UNION ALL
 SELECT 'audit',a.id::text,a.org_id,a.actor_id,a.created_at,'recorded',a.action
 FROM audit_logs a
 WHERE ($1='' OR a.org_id::text=$1) AND ($2='' OR $2='audit')
   AND ($4::uuid IS NULL OR a.actor_id=$4)
   AND ($5::timestamptz IS NULL OR a.created_at >= $5::timestamptz)
   AND ($6::timestamptz IS NULL OR a.created_at < $6::timestamptz)
 UNION ALL
 SELECT 'api',m.id::text,m.org_id,NULL::uuid,m.occurred_at,m.http_status::text,m.operation
 FROM api_request_metrics m
 WHERE ($1='' OR m.org_id::text=$1) AND ($2='' OR $2='api')
   AND $4::uuid IS NULL
   AND ($5::timestamptz IS NULL OR m.occurred_at >= $5::timestamptz)
   AND ($6::timestamptz IS NULL OR m.occurred_at < $6::timestamptz)
 UNION ALL
 SELECT 'admin',a.id::text,NULL::uuid,a.actor_id,a.created_at,'recorded',a.action
 FROM platform_admin_audit a
 WHERE $1='' AND ($2='' OR $2='admin') AND ($4::uuid IS NULL OR a.actor_id=$4)
   AND ($5::timestamptz IS NULL OR a.created_at >= $5::timestamptz)
   AND ($6::timestamptz IS NULL OR a.created_at < $6::timestamptz)
 )
 SELECT e."eventType",e."eventId",e."orgId",o.name AS "orgName",e."userId",u.email AS "userEmail",
 e."createdAt",e.status,e.summary
 FROM events e
 LEFT JOIN organizations o ON o.id=e."orgId"
 LEFT JOIN users u ON u.id=e."userId"
 WHERE ($3='' OR e."eventId" ILIKE $3 OR e.summary ILIKE $3
 OR u.email ILIKE $3)
 AND ($7::timestamptz IS NULL OR
  (e."createdAt",e."eventType",e."eventId") < ($7::timestamptz,$8::text,$9::text))
 ORDER BY e."createdAt" DESC,e."eventType" DESC,e."eventId" DESC LIMIT $10
 `,[args.orgId,args.eventType,args.search?`%${escapeLike(args.search)}%`:'',
 args.userId||null,args.from,args.to,args.before?args.before.split('|')[0]:null,
 args.before?args.before.split('|')[1]:null,args.before?args.before.split('|')[2]:null,args.limit])).rows;
}
export async function adminThreads(args:{search:string;status:string;category:string;channel:'internal'|'customer';limit:number}){
 return (await query(`SELECT t.id,t.subject,t.channel,t.category,t.status,t.priority,
 t.customer_id AS "customerId",u.email AS "customerEmail",t.assigned_admin_id AS "assignedAdminId",
 s.name AS "assignedAdmin",t.created_at AS "createdAt",t.updated_at AS "updatedAt",
 (SELECT count(*)::int FROM platform_messages m WHERE m.thread_id=t.id) AS "messageCount"
 FROM platform_message_threads t
 LEFT JOIN users u ON u.id=t.customer_id LEFT JOIN users s ON s.id=t.assigned_admin_id
 WHERE t.channel=$5 AND ($1='' OR t.subject ILIKE $1 OR u.email ILIKE $1)
 AND ($2='' OR t.status=$2) AND ($3='' OR t.category=$3)
 ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,t.updated_at DESC
 LIMIT $4`,[args.search?`%${escapeLike(args.search)}%`:'',args.status,args.category,args.limit,args.channel])).rows;
}
export async function adminThreadMessages(threadId:string,limit:number){
 const exists=(await query('SELECT 1 FROM platform_message_threads WHERE id=$1',[threadId])).rows[0];
 if(!exists)return null;
 return (await query(`SELECT m.id::text AS id,m.thread_id AS "threadId",m.sender_id AS "senderId",
 u.name AS "senderName",u.email AS "senderEmail",m.content,m.internal,m.created_at AS "createdAt"
 FROM platform_messages m JOIN users u ON u.id=m.sender_id WHERE m.thread_id=$1
 ORDER BY m.id DESC LIMIT $2`,[threadId,limit])).rows.reverse();
}
export async function adminCreateThread(subject:string,category:string,priority:string,customerId:string|null,assignedAdminId:string|null,userId:string,channel:'internal'|'customer'){
 return (await query(`INSERT INTO platform_message_threads
 (subject,channel,category,priority,customer_id,assigned_admin_id,created_by)
 VALUES($1,$7,$2,$3,$4,$5,$6) RETURNING id`,
 [subject,category,priority,customerId,assignedAdminId,userId,channel])).rows[0];
}
export async function adminPostMessage(threadId:string,actorId:string,content:string){
 const inserted=(await query(`INSERT INTO platform_messages(thread_id,sender_id,content,internal)
 SELECT id,$2,$3,(channel='internal') FROM platform_message_threads WHERE id=$1 AND status<>'closed'
 RETURNING id`,[threadId,actorId,content])).rows[0];
 if(inserted)await query('UPDATE platform_message_threads SET updated_at=now() WHERE id=$1',[threadId]);
 return inserted;
}
export async function adminChangeThread(threadId:string,status:string,priority:string,assignee:string|null){
 return (await query(`UPDATE platform_message_threads SET status=$2,priority=$3,
 assigned_admin_id=$4,updated_at=now() WHERE id=$1 RETURNING id`,
 [threadId,status,priority,assignee])).rows[0];
}
