/** Frozen core contract: fail CI if a protected file differs from the approved baseline. */
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const approved=JSON.parse(readFileSync(new URL('../quality/PROTECTED_BASELINE.json',import.meta.url),'utf8'));
let passed=0;
for(const [file,expected] of Object.entries(approved.files)){
 const url=new URL('../'+file,import.meta.url);
 if(!existsSync(url))throw Error(`Protected file missing: ${file}`);
 const actual=createHash('sha256').update(readFileSync(url)).digest('hex');
 if(actual!==expected)throw Error(`Protected file changed without approved baseline update: ${file}`);
 passed++;
}
console.log(`PASS ${passed} protected module hashes match v${approved.version} baseline.`);
