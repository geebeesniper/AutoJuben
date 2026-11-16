import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminRolePermissions} from './admin.service.js';

test('super admin has all capabilities; lower roles are least privileged',()=>{
 const root=adminRolePermissions('super_admin');
 for(const p of ['users','billing','secrets','operations','messaging','staff','ledger','investigation'])
  assert.ok(root.includes(p as never));
 for(const role of ['operations_manager','finance_manager','support_lead','analyst','auditor'] as const)
  assert.ok(!adminRolePermissions(role).includes('secrets'));
});

test('financial staff may inspect billing but not administer users or assign roles',()=>{
 const finance=adminRolePermissions('finance_manager');
 assert.ok(finance.includes('billing'));
 assert.ok(finance.includes('ledger'));
 assert.ok(!finance.includes('staff'));
 assert.ok(!finance.includes('users'));
});

test('support, analyst and auditors have scoped access',()=>{
 const support=adminRolePermissions('support_lead');
 assert.ok(support.includes('messaging'));
 assert.ok(support.includes('users'));
 assert.ok(!support.includes('ledger'));
 const analyst=adminRolePermissions('analyst');
 assert.deepEqual([...analyst],['investigation']);
 const auditor=adminRolePermissions('auditor');
 assert.ok(auditor.includes('ledger'));
 assert.ok(!auditor.includes('messaging'));
 assert.ok(!auditor.includes('staff'));
});
