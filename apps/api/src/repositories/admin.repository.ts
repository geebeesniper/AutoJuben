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
