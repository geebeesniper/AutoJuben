import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultProviderApiRoutes,validateProviderApiRoutes,validateProviderBaseUrl} from './client.js';

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

test('global API base origins reject plaintext, embedded keys, query strings, internal hosts and unapproved domains',()=>{
 for(const origin of [
  'http://video.example.net:8045',
  'https://video.example.net/path',
  'https://user:password@video.example.net',
  'https://video.example.net/?token=secret',
  'https://video.example.net/#fragment',
  'https://127.0.0.1',
  'https://169.254.169.254',
  'file:///etc/passwd',
  'https://attacker.invalid'
 ]){
  assert.throws(()=>validateProviderBaseUrl(origin));
 }
});

test('provider API path validation rejects unsafe customer-controlled URLs',()=>{
 for(const path of ['/api/generate-video?key=123','/api/..','/api/generate-video#frag','https://private.invalid/api','//private.invalid/api']){
  assert.throws(()=>validateProviderApiRoutes({...defaultProviderApiRoutes,submitPath:path}),/无效 API 路径/);
 }
});
