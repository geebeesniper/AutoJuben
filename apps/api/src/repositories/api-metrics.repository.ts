import { query } from '../db/pool.js';
export type ApiMetric={requestId:string;transport:'graphql'|'json'|'rest';operation:string;status:number;ms:number;
 authMode:'anonymous'|'session'|'api_key';orgId?:string;graphqlErrors?:number};
/** Metrics never contain prompts, card details, secrets, request bodies or identifying email addresses. */
export async function recordApiMetric(m:ApiMetric):Promise<void>{
 await query(`INSERT INTO api_request_metrics(request_id,transport,operation,http_status,elapsed_ms,auth_mode,org_id,graphql_errors)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[m.requestId,m.transport,m.operation.slice(0,100),m.status,m.ms,m.authMode,
    m.orgId&&/^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(m.orgId)?m.orgId:null,m.graphqlErrors??0]);
}
export async function platformMetricSummary(minutes:number){
 const result=await query<{transport:string;total:number;errors:number;p95_ms:number|null;avg_ms:number|null}>(`
  SELECT transport,COUNT(*)::int AS total,COUNT(*) FILTER (WHERE http_status>=400 OR graphql_errors>0)::int AS errors,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY elapsed_ms)::float8 AS p95_ms,
    AVG(elapsed_ms)::float8 AS avg_ms
  FROM api_request_metrics WHERE occurred_at>now()-($1::int*interval '1 minute')
  GROUP BY transport ORDER BY transport`,[minutes]);return result.rows;
}
