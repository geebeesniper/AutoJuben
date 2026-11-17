import { query } from '../db/pool.js';
import type { ProviderApiRoutes } from '../provider/client.js';
/** Every query that returns tenant data is scoped by org_id. Authorization is enforced in services. */
export async function listProjects(orgId:string){
  return (await query(`SELECT p.*,COUNT(v.id)::integer AS job_count FROM projects p LEFT JOIN video_jobs v ON v.project_id=p.id
    WHERE p.org_id=$1 GROUP BY p.id ORDER BY p.created_at DESC`,[orgId])).rows;
}
export async function listMembers(orgId:string){
  return (await query(`SELECT u.id AS "userId",u.name,u.email,m.role,m.joined_at FROM memberships m
    JOIN users u ON u.id=m.user_id WHERE m.org_id=$1 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,m.joined_at`,[orgId])).rows;
}
export async function dashboardSummary(orgId:string){
  const [counts,projects]=await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER(WHERE status IN ('queued','submitting','pending','polling','submission_unknown'))::int AS active,
      COUNT(*) FILTER(WHERE status='success')::int AS completed,
      COUNT(*) FILTER(WHERE status='failed')::int AS failed
      FROM video_jobs WHERE org_id=$1`,[orgId]),
    query('SELECT COUNT(*)::int AS total FROM projects WHERE org_id=$1',[orgId])
  ]);
  return {...counts.rows[0],projects:projects.rows[0].total};
}
export async function listJobs(orgId:string,projectId:string|null,limit:number){
  return (await query(`SELECT * FROM video_jobs WHERE org_id=$1 AND ($2::uuid IS NULL OR project_id=$2::uuid)
    ORDER BY created_at DESC LIMIT $3`,[orgId,projectId,limit])).rows;
}
export async function findJob(orgId:string,id:string){return (await query('SELECT * FROM video_jobs WHERE org_id=$1 AND id=$2',[orgId,id])).rows[0];}
export async function hasProviderKey(orgId:string){
  const row=(await query<{key_exists:boolean}>('SELECT provider_license_ciphertext IS NOT NULL AS key_exists FROM organizations WHERE id=$1',[orgId])).rows[0];
  return Boolean(row?.key_exists);
}
export async function listAudit(orgId:string,limit:number){
  return (await query(`SELECT a.id,a.action,a.detail,a.created_at,u.name AS actor_name FROM audit_logs a
    LEFT JOIN users u ON a.actor_id=u.id WHERE a.org_id=$1 ORDER BY a.created_at DESC LIMIT $2`,[orgId,limit])).rows;
}
export async function appendAudit(orgId:string,userId:string,action:string,detail:unknown={}){
  await query('INSERT INTO audit_logs(org_id,actor_id,action,detail) VALUES($1,$2,$3,$4)',[orgId,userId,action,JSON.stringify(detail)]);
}
export async function insertProject(orgId:string,name:string,description:string,userId:string){
  return (await query('INSERT INTO projects(org_id,name,description,created_by) VALUES($1,$2,$3,$4) RETURNING *',
    [orgId,name,description,userId])).rows[0];
}
export async function modifyProject(orgId:string,id:string,name:string,description:string){
  return (await query('UPDATE projects SET name=$3,description=$4 WHERE org_id=$1 AND id=$2 RETURNING *',
    [orgId,id,name,description])).rows[0];
}
export async function removeProject(orgId:string,id:string){
  return Boolean((await query('DELETE FROM projects WHERE org_id=$1 AND id=$2',[orgId,id])).rowCount);
}
export async function findUserByEmail(email:string){
  return (await query<{id:string;name:string;email:string}>('SELECT id,name,email FROM users WHERE email=$1',[email])).rows[0];
}
export async function addMember(orgId:string,userId:string,role:string){
  await query('INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,$3)',[orgId,userId,role]);
}
export async function memberRole(orgId:string,userId:string){
  return (await query<{role:string}>('SELECT role FROM memberships WHERE org_id=$1 AND user_id=$2',[orgId,userId])).rows[0];
}
export async function updateMemberRole(orgId:string,userId:string,role:string){
  return (await query<{joined_at:Date}>('UPDATE memberships SET role=$3 WHERE org_id=$1 AND user_id=$2 RETURNING joined_at',[orgId,userId,role])).rows[0];
}
export async function findUserById(userId:string){
  return (await query<{name:string;email:string}>('SELECT name,email FROM users WHERE id=$1',[userId])).rows[0];
}
export async function removeMember(orgId:string,userId:string){
  return Boolean((await query('DELETE FROM memberships WHERE org_id=$1 AND user_id=$2',[orgId,userId])).rowCount);
}
export async function storeProviderKey(orgId:string,ciphertext:string|null){
  await query('UPDATE organizations SET provider_license_ciphertext=$2 WHERE id=$1',[orgId,ciphertext]);
}
/** Provider interface settings are tenant-owned and kept in PostgreSQL, not Vercel files. */
export async function hasInFlightVideoJobs(orgId:string):Promise<boolean>{
  const row=(await query<{active:boolean}>(`SELECT EXISTS(
    SELECT 1 FROM video_jobs WHERE org_id=$1 AND status IN
    ('queued','submitting','submission_unknown','pending','polling')
  ) AS active`,[orgId])).rows[0];
  return Boolean(row?.active);
}
export async function storeProviderApiRoutes(orgId:string,routes:ProviderApiRoutes,userId:string){
  await query(`INSERT INTO provider_api_routes
    (org_id,pricing_path,settings_path,submit_path,task_path,video_link_path,auth_mode,updated_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT(org_id) DO UPDATE SET
      pricing_path=excluded.pricing_path,settings_path=excluded.settings_path,
      submit_path=excluded.submit_path,task_path=excluded.task_path,
      video_link_path=excluded.video_link_path,auth_mode=excluded.auth_mode,
      updated_by=excluded.updated_by,updated_at=NOW()`,[
    orgId,routes.pricingPath,routes.settingsPath,routes.submitPath,
    routes.taskPath,routes.videoLinkPath,routes.authMode,userId
  ]);
}
