import { query } from '../db/pool.js';
/** Diagnostics read-only SQL; authorization belongs to the API controller. */
export async function diagnosticSnapshot(orgId:string){
  const [events,counts,releases]=await Promise.all([
    query('SELECT category,action,status,detail,created_at FROM launcher_events WHERE org_id=$1 ORDER BY created_at DESC LIMIT 150',[orgId]),
    query(`SELECT (SELECT COUNT(*)::int FROM projects WHERE org_id=$1) AS projects,
      (SELECT COUNT(*)::int FROM video_jobs WHERE org_id=$1) AS jobs,
      (SELECT COUNT(*)::int FROM uploaded_assets WHERE org_id=$1) AS assets`,[orgId]),
    query('SELECT version,channel,created_at FROM launcher_releases WHERE org_id=$1 ORDER BY created_at DESC LIMIT 20',[orgId])
  ]);
  return {counts:counts.rows[0],events:events.rows,releases:releases.rows};
}
