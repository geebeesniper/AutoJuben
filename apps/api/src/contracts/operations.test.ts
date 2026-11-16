import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchRestRoute,validatedArgs,isOperationName,operations} from './operations.js';
test('REST versioned resources map to the same GraphQL controllers',()=>{
 assert.equal(matchRestRoute('GET','/organizations/aaa/projects')?.name,'projects');
 assert.equal(matchRestRoute('POST','/organizations/aaa/projects')?.name,'createProject');
 assert.equal(matchRestRoute('GET','/organizations/aaa/jobs/000')?.name,'job');
 assert.equal(matchRestRoute('DELETE','/organizations/aaa/api-keys/xyz')?.name,'revokeApiKey');
 assert.equal(matchRestRoute('GET','/admin/users')?.name,'adminSearchUsers');
 assert.equal(matchRestRoute('PUT','/admin/users'),null);
 assert.equal(matchRestRoute('GET','/internal/secrets'),null);
});
test('JSON command uses strict schema and rejects unexpected keys',()=>{
 assert.equal(validatedArgs('projects',{orgId:'org-1'}).name,'projects');
 assert.throws(()=>validatedArgs('projects',{orgId:'org-1',password:'x'}),/未知字段/);
 assert.throws(()=>validatedArgs('projects',{orgId:88}),/字符串/);
 assert.throws(()=>validatedArgs('__proto__',{}),/不支持/);
 assert.throws(()=>validatedArgs('createVideoJob',{orgId:'org-1',input:{model:'xinghe-2.0',duration:15,prompt:'test',ratio:'9:16',resolution:'720p',admin:true}}),/未知字段/);
});
test('defaults and scalar bounds match GraphQL argument intent',()=>{
 assert.deepEqual(validatedArgs('adminSearchUsers',{}).args,{search:'',limit:40,offset:0});
 assert.deepEqual(validatedArgs('myOrders',{}).args,{limit:80});
 assert.throws(()=>validatedArgs('myOrders',{limit:10001}),/整数/);
 assert.equal(isOperationName('createApiKey'),true);
 assert.equal(Object.keys(operations).length>=25,true);
});
