import pg from 'pg';
import { config } from '../config.js';
export const pool = new pg.Pool({
  connectionString: config.databaseUrl || undefined,
  // Vercel scales out: keep each function instance pool small. Use Supabase transaction pooler (6543).
  max: 1, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 15_000,
  allowExitOnIdle: true
});
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  return pool.query<T>(sql, params);
}
export type DbClient = pg.PoolClient;
export async function transaction<T>(callback:(db:DbClient)=>Promise<T>):Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
