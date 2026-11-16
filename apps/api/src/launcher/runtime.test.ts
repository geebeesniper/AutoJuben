import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {compareVersions,decodeDockerLogs,versionParts} from './runtime.js';
test('semver comparison does not treat 1.10 as lower than 1.9',()=>{
  assert.equal(compareVersions('1.10.0','1.9.0'),1);
  assert.equal(compareVersions('1.2.4','1.2.4'),0);
  assert.equal(compareVersions('1.2.3-beta.1','1.2.3'),-1);
  assert.deepEqual(versionParts('v1.2.4'),[1,2,4]);
});
test('Docker stdout/stderr multiplexing is decoded safely',()=>{
  const body=Buffer.from('hello\n');const header=Buffer.alloc(8);header[0]=1;header.writeUInt32BE(body.length,4);
  assert.equal(decodeDockerLogs(Buffer.concat([header,body])),'hello\n');
  assert.equal(decodeDockerLogs(Buffer.from('tty output\n')),'tty output\n');
});
