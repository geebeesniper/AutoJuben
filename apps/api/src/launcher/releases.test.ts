import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {releaseVersion} from './releases.js';
test('versions are validated before publishing or deploying',()=>{
  assert.equal(releaseVersion('v0.2.0'),'0.2.0');
  assert.throws(()=>releaseVersion('../etc/passwd'));
  assert.throws(()=>releaseVersion('latest'));
});
