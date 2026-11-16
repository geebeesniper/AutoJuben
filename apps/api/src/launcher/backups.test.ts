import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {isOwnedStoragePath} from './backups.js';
test('cloud backup files must belong to the same Supabase tenant',()=>{
  const org='04fd3c30-9b80-4f38-9f02-65b74ba4dba3';
  assert.equal(isOwnedStoragePath(`${org}/uploads/a.mp4`,org),true);
  assert.equal(isOwnedStoragePath(`${org}/restores/id/a.mp4`,org),true);
  assert.equal(isOwnedStoragePath(`another-org/uploads/a.mp4`,org),false);
  assert.equal(isOwnedStoragePath(`another-org/backups/manifest.json`,org),false);
});
