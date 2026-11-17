import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../../../../sql/008_enterprise_admin.sql',import.meta.url),'utf8');
const graphql=readFileSync(new URL('../graphql/admin.ts',import.meta.url),'utf8');
const adminService=readFileSync(new URL('admin.service.ts',import.meta.url),'utf8');
const adminRepository=readFileSync(new URL('../repositories/admin.repository.ts',import.meta.url),'utf8');
const portalRepository=readFileSync(new URL('../repositories/portal.repository.ts',import.meta.url),'utf8');
const portalService=readFileSync(new URL('portal.service.ts',import.meta.url),'utf8');

test('Operations Overview contract exposes five separate trend values and role flags',()=>{
 assert.match(graphql,/type AdminOperationsTrendBucket/);
 for(const key of ['revenueCents','alerts','errors','online','peak'])
  assert.match(graphql,new RegExp(key+': Float'));
 assert.match(graphql,/canRevenue: Boolean!/);
 assert.match(graphql,/hasPresence: Boolean!/);
});
test('operations overview uses authorized and bounded timezone-aware service',()=>{
 assert.match(adminService,/await asAdmin\(ctx,'investigation'\)/);
 assert.match(adminService,/permissions\[actor\.role\]\.includes\('ledger'\)/);
 assert.match(adminService,/args\.timezone\.length<=80/);
 assert.match(adminService,/366\*86400000/);
 assert.match(adminService,/args\.unit==='hour'/);
 assert.match(adminService,/withRevenue:canRevenue/);
});
test('SQL time-series sources are indexed and explicitly account for refunds',()=>{
 assert.match(adminRepository,/GREATEST\(o\.amount_cents-o\.refunded_amount_cents,0\)/);
 assert.match(adminRepository,/o\.paid_at/);
 assert.match(adminRepository,/v\.status='failed'/);
 assert.match(adminRepository,/t\.priority IN \('high','urgent'\)/);
 assert.match(adminRepository,/m\.http_status>=500 OR m\.graphql_errors>0/);
 assert.match(migration,/purchase_orders_paid_time_idx/);
 assert.match(migration,/api_request_metrics_error_time_idx/);
});
test('sampled live online and peak users use authorized, deduplicated 5-minute heartbeats',()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.platform_presence_samples/);
 assert.match(migration,/PRIMARY KEY\(user_id,sample_at\)/);
 assert.match(migration,/platform_presence_samples ENABLE ROW LEVEL SECURITY/);
 assert.match(portalRepository,/ON CONFLICT\(user_id,sample_at\) DO NOTHING/);
 assert.match(portalService,/recordMyPresence:async/);
 assert.match(portalService,/const user=requireUser\(ctx\)/);
 assert.match(adminService,/point\.peak=Math\.max/);
});
