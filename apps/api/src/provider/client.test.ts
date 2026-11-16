import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultProviderApiRoutes,validateProviderApiRoutes} from './client.js';

test('151 API defaults exactly match the integration markdown contract',()=>{
 const p=validateProviderApiRoutes({...defaultProviderApiRoutes});
 assert.deepEqual(p,{
  pricingPath:'/api/pricing',
  settingsPath:'/api/public-settings',
  submitPath:'/api/generate-video',
  taskPath:'/api/task/{task_id}',
  videoLinkPath:'/api/task/{task_id}/video-link',
  authMode:'license_key'
 });
});

test('workspace can change provider endpoint paths without changing API base host',()=>{
 const p=validateProviderApiRoutes({...defaultProviderApiRoutes,
  pricingPath:'/api/v2/pricing',submitPath:'/api/v2/generate',
  taskPath:'/api/v2/jobs/{task_id}',videoLinkPath:'/api/v2/jobs/{task_id}/link',authMode:'bearer'});
 assert.equal(p.submitPath,'/api/v2/generate');
 assert.equal(p.authMode,'bearer');
});

test('reject unsafe provider paths to prevent credential leakage and SSRF',()=>{
 for(const path of [
  'https://evil.example/steal','//evil.example/steal','/api/../metadata',
  '/api/task?url=https://evil.example','/api/task%2Fcredentials',
  '/api/task#fragment','/api\\task','/internal/secrets'
 ]){
  assert.throws(()=>validateProviderApiRoutes({...defaultProviderApiRoutes,pricingPath:path}),/无效 API 路径/);
 }
 assert.throws(()=>validateProviderApiRoutes({...defaultProviderApiRoutes,taskPath:'/api/task'}),/taskPath/);
 assert.throws(()=>validateProviderApiRoutes({...defaultProviderApiRoutes,videoLinkPath:'/api/task/{task_id}/link/{task_id}'}),/videoLinkPath/);
 assert.throws(()=>validateProviderApiRoutes({...defaultProviderApiRoutes,authMode:'unsafe' as 'bearer'}),/鉴权方式/);
});
