import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../../../../sql/008_enterprise_admin.sql',import.meta.url),'utf8');
const portalRepo=readFileSync(new URL('../repositories/portal.repository.ts',import.meta.url),'utf8');
const adminRepo=readFileSync(new URL('../repositories/admin.repository.ts',import.meta.url),'utf8');
const portal=readFileSync(new URL('portal.service.ts',import.meta.url),'utf8');
const admin=readFileSync(new URL('admin.service.ts',import.meta.url),'utf8');

test('Help Desk and internal Team Messenger have separate persistent database channels',()=>{
 assert.match(migration,/channel TEXT NOT NULL DEFAULT 'internal'/);
 assert.match(migration,/channel IN \('internal','customer'\)/);
 assert.match(migration,/channel='internal' AND customer_id IS NULL/);
 assert.match(migration,/channel='customer' AND customer_id IS NOT NULL/);
 assert.match(migration,/help_articles ENABLE ROW LEVEL SECURITY/);
});
test('customer ticket queries are scoped to the session user and hide internal messages',()=>{
 assert.match(portalRepo,/t\.channel='customer' AND t\.customer_id=\$1/);
 assert.match(portalRepo,/id=\$1 AND channel='customer' AND customer_id=\$2/);
 assert.match(portalRepo,/m\.internal=false/);
 assert.match(portalRepo,/sender_id,content,internal\)/);
 assert.match(portal,/const u=requireUser\(ctx\)/);
 assert.match(portal,/ticketCategories\.includes\(category\)/);
});
test('admin message creation and inbox queries always use explicit channel',()=>{
 assert.match(adminRepo,/WHERE t\.channel=\$5/);
 assert.match(adminRepo,/\(channel='internal'\)/);
 assert.match(admin,/channel==='customer'\?Boolean\(customerId\):!customerId/);
 assert.match(admin,/await asAdmin\(ctx,'messaging'\)/);
});
test('Help Center serves published knowledge in a whitelisted language',()=>{
 assert.match(portalRepo,/WHERE published=true/);
 assert.match(portal,/\['zh','en','es'\]\.includes\(locale\)/);
 assert.match(migration,/category IN \('getting_started','generation','billing','account','api','troubleshooting'\)/);
});
