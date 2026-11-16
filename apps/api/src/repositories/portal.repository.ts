import { query } from '../db/pool.js';
/** Query-only data access. Caller must authorize the workspace and user first. */
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
export async function renameUser(userId:string,name:string){
  return (await query('UPDATE users SET name=$2,updated_at=now() WHERE id=$1 RETURNING id,name,email',[userId,name])).rows[0];
}
