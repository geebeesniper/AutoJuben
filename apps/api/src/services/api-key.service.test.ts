import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enforceKeyScope} from './api-key.service.js';
import type {ApiPrincipal} from '../models/api.model.js';
const base={mode:'api_key' as const,user:{id:'u1',name:'u',email:'u@example.org'},orgId:'tenant-a',scopes:['read'] as Array<'read'|'write'>};
test('API key read scope is tenant bound',()=>{
 assert.doesNotThrow(()=>enforceKeyScope(base,'tenant-a','read'));
 assert.throws(()=>enforceKeyScope(base,'tenant-b','read'),/无权/);
 assert.throws(()=>enforceKeyScope(base,undefined,'read'),/无权/);
 assert.throws(()=>enforceKeyScope(base,'tenant-a','write'),/读取权限/);
 assert.throws(()=>enforceKeyScope(base,'tenant-a','session'),/无权/);
});
test('write key cannot access session-only payment or platform admin actions',()=>{
 const writer:ApiPrincipal={...base,scopes:['write']};
 assert.doesNotThrow(()=>enforceKeyScope(writer,'tenant-a','read'));
 assert.doesNotThrow(()=>enforceKeyScope(writer,'tenant-a','write'));
 assert.throws(()=>enforceKeyScope(writer,undefined,'session'),/无权/);
});
