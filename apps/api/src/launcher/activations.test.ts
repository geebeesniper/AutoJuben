import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {activationCode} from './activations.js';
test('new workspaces codes are high entropy and have a stable format',()=>{
  const a=activationCode(),b=activationCode();
  assert.match(a,/^AJ-(?:[0-9A-F]{8}-){4}[0-9A-F]{8}$/);
  assert.notEqual(a,b);
});
