import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVideoInput, validatePublicUrl } from './validation.js';
const base={prompt:'cinematic scene with a dog',model:'xinghe-2.0',duration:12,ratio:'9:16',resolution:'720p'};
test('accept valid video input',()=>assert.equal(validateVideoInput({...base,imageUrls:['https://example.com/a.jpg']}).imageUrls.length,1));
test('reject fast model with 720p',()=>assert.throws(()=>validateVideoInput({...base,model:'xinghe-fast'}),/分辨率/));
test('enforce 9 image limit across links and local uploads',()=>assert.throws(()=>validateVideoInput({...base,imageUrls:Array(9).fill('https://example.com/a.jpg'),imageAssetIds:['a']}),/9/));
test('enforce 12 total media limit',()=>assert.throws(()=>validateVideoInput({...base,imageUrls:Array(9).fill('https://example.com/a.jpg'),audioUrls:Array(3).fill('https://example.com/a.mp3'),videoUrls:['https://example.com/a.mp4']}),/12/));
test('reject local URL',()=>assert.throws(()=>validatePublicUrl('https://127.0.0.1/private'),/内网/));
test('reject insecure HTTP by default',()=>assert.throws(()=>validatePublicUrl('http://example.com/a.jpg'),/HTTPS/));
test('allow explicitly trusted public HTTP',()=>assert.match(validatePublicUrl('http://example.com/a.jpg',true),/^http:/));

test('safe model identifiers from current provider settings can be submitted without static model allowlist',()=>{
 assert.equal(validateVideoInput({...base,model:'xinghe-next.3'}).model,'xinghe-next.3');
});
test('dynamic provider model ID cannot contain URLs, whitespace or injected content',()=>{
 for(const model of ['https://internal.example/api','../secret','unknown model','bad/model','a'.repeat(90)]){
  assert.throws(()=>validateVideoInput({...base,model}),/模型 ID/);
 }
});
