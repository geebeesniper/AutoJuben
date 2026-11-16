import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { diagnosticSnapshot } from '../repositories/diagnostics.repository.js';
import { inspectRuntime } from '../launcher/runtime.js';
/** Service builds portable JSON data, independent of HTTP Response. */
export async function buildDiagnostics(orgId:string){
  const [runtime,records]=await Promise.all([inspectRuntime(orgId),diagnosticSnapshot(orgId)]);
  return Buffer.from(JSON.stringify({
    type:'autojuben-saas-diagnostics',schema:3,referenceId:randomUUID(),createdAt:new Date().toISOString(),
    orgId,runtime,app:{version:'0.5.0',platform:'Vercel + Supabase',mode:config.mockProvider?'mock':'live',
      database:'reachable',storageBucket:config.storageBucket},...records
  },null,2));
}
