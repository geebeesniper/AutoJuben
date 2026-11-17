import { query } from '../db/pool.js';
/** Query-only data access. Caller must authorize the workspace and user first. */
/** Single owner of logged-in customer presence recording, deduplicated every 5 min. */
export async function recordPresenceSample(userId:string){
 await query("INSERT INTO platform_presence_samples(user_id,sample_at) "
  +"VALUES($1,date_bin('5 minutes',now(),'2000-01-01 00:00:00+00'::timestamptz)) "
  +"ON CONFLICT(user_id,sample_at) DO NOTHING",[userId]);
}
export async function accountActivity(userId:string,orgId:string,limit:number){
  return (await query<{id:string;action:string;detail:unknown;created_at:Date}>(`SELECT id::text,action,detail,created_at FROM audit_logs
    WHERE org_id=$1 AND actor_id=$2 ORDER BY created_at DESC LIMIT $3`,[orgId,userId,limit])).rows;
}
export async function purchaseHistory(userId:string,limit:number){
  return (await query(`SELECT id,org_id,product_name,credits,amount_cents,currency,status,refunded_amount_cents,created_at,paid_at
    FROM purchase_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,[userId,limit])).rows;
}
export async function activeCatalog(){
  return (await query('SELECT id,sku,name,description,credits,amount_cents,currency,active FROM billing_products WHERE active=true ORDER BY amount_cents')).rows;
}
/** Published Help Center articles: locale/columns are server-defined, not user SQL. */
export async function publishedHelpArticles(category:string,search:string,locale:'zh'|'en'|'es',limit:number){
 const fields={zh:['title_zh','body_zh'],en:['title_en','body_en'],es:['title_es','body_es']}[locale];
 const title=fields[0],body=fields[1];
 return (await query(`SELECT id,slug,category,${title} AS title,${body} AS answer
 FROM help_articles WHERE published=true AND ($1='' OR category=$1)
 AND ($2='' OR strpos(lower(${title}),lower($2))>0 OR strpos(lower(${body}),lower($2))>0)
 ORDER BY category,sort_order,slug LIMIT $3`,
 [category,search,limit])).rows;
}
/** Ticket queries MUST scope to the logged-in customer, never a supplied userId. */
export async function myHelpThreads(userId:string,category:string,status:string,limit:number){
 return (await query(`SELECT t.id,t.subject,t.category,t.status,t.priority,t.created_at AS "createdAt",
 t.updated_at AS "updatedAt",t.assigned_admin_id AS "assignedAdminId",
 (SELECT count(*)::int FROM platform_messages m WHERE m.thread_id=t.id AND m.internal=false) AS "messageCount"
 FROM platform_message_threads t
 WHERE t.channel='customer' AND t.customer_id=$1
 AND ($2='' OR t.category=$2) AND ($3='' OR t.status=$3)
 ORDER BY t.updated_at DESC,t.id DESC LIMIT $4`,[userId,category,status,limit])).rows;
}
export async function myHelpMessages(userId:string,threadId:string,limit:number){
 const exists=(await query(`SELECT id FROM platform_message_threads
 WHERE id=$1 AND channel='customer' AND customer_id=$2`,[threadId,userId])).rows[0];
 if(!exists)return null;
 return (await query(`SELECT m.id::text AS id,m.thread_id AS "threadId",
 u.name AS "senderName",m.content,m.created_at AS "createdAt",
 (m.sender_id=$1) AS "mine"
 FROM platform_messages m JOIN users u ON u.id=m.sender_id
 JOIN platform_message_threads t ON t.id=m.thread_id AND t.channel='customer' AND t.customer_id=$1
 WHERE m.thread_id=$2 AND m.internal=false
 ORDER BY m.id DESC LIMIT $3`,[userId,threadId,limit])).rows.reverse();
}
export async function openHelpTicket(userId:string,category:string,subject:string,content:string){
 const row=(await query<{id:string}>(`WITH ticket AS (
  INSERT INTO platform_message_threads(subject,channel,category,status,priority,customer_id,created_by)
  VALUES($2,'customer',$3,'open','normal',$1,$1) RETURNING id
 ), first_message AS (
  INSERT INTO platform_messages(thread_id,sender_id,content,internal)
  SELECT id,$1,$4,false FROM ticket RETURNING thread_id
 )
 SELECT thread_id AS id FROM first_message`,[userId,subject,category,content])).rows[0];
 return row?.id;
}
export async function replyHelpTicket(userId:string,threadId:string,content:string){
 const row=(await query(`INSERT INTO platform_messages(thread_id,sender_id,content,internal)
 SELECT id,$1,$3,false FROM platform_message_threads
 WHERE id=$2 AND channel='customer' AND customer_id=$1 AND status<>'closed'
 RETURNING id`,[userId,threadId,content])).rows[0];
 if(row)await query(`UPDATE platform_message_threads SET status='open',updated_at=now()
 WHERE id=$1 AND channel='customer' AND customer_id=$2`,[threadId,userId]);
 return Boolean(row);
}
export async function renameUser(userId:string,name:string){
  return (await query('UPDATE users SET name=$2,updated_at=now() WHERE id=$1 RETURNING id,name,email',[userId,name])).rows[0];
}
