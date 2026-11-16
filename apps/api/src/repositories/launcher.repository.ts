import { query } from '../db/pool.js';
export async function readLauncherEvents(orgId:string,category:string|null,limit:number){
  return (await query(`SELECT e.id,e.category,e.action,e.status,e.detail,e.created_at,u.name AS actor_name
    FROM launcher_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.org_id=$1 AND ($2::text IS NULL OR e.category=$2)
    ORDER BY e.created_at DESC LIMIT $3`,[orgId,category,limit])).rows;
}
export async function updatePreferences(orgId:string,environment:string,channel:string){
  await query('UPDATE launcher_config SET environment=$2,channel=$3,updated_at=now() WHERE org_id=$1',
    [orgId,environment,channel]);
}
