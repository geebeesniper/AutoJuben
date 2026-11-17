/** Offline-enforceable, testable CMM Level 3 process checks; no network or secrets. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,relative,resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
let tested=0;const pass=(flag,message)=>{assert(flag,message);tested++;};
const file=p=>{pass(existsSync(join(root,p)),`Missing contract: ${p}`);return read(p);};
const controllerFiles=[];const paths=[];
function walk(dir){for(const d of readdirSync(dir,{withFileTypes:true})){
 if(['node_modules','.git','dist'].includes(d.name))continue;
 const path=join(dir,d.name);
 if(d.isDirectory())walk(path);else if(/\.(ts|tsx|js|mjs)$/.test(d.name))paths.push(path);
}}
walk(join(root,'apps'));
for(const p of paths){
 const rel=relative(root,p).replaceAll('\\','/'),s=readFileSync(p,'utf8');
 if(rel.includes('/controllers/')){
  controllerFiles.push(rel);
  pass(!/from\s+['"][^'"]*(?:db\/pool|repositories\/)/.test(s),`Controller must not import database/repository: ${rel}`);
 }
 if(rel.includes('/graphql/'))pass(!/from\s+['"][^'"]*(?:db\/pool|repositories\/)/.test(s),`GraphQL must not access database directly: ${rel}`);
 if(rel.startsWith('apps/web/'))pass(!/process\.env\.(?:DATABASE_URL|STRIPE_SECRET_KEY|SUPABASE_SECRET_KEY)|import\s+.*apps\/api/.test(s),`Server secret leaked into web: ${rel}`);
 // Every relative import must resolve to a file in this repository.
 const imports=[...s.matchAll(/from\s+['"](\.[^'"]+)['"]/g)];
 for(const [,spec] of imports){const raw=resolve(dirname(p),spec);const base=raw.replace(/\.(js|jsx|ts|tsx)$/, '');
  pass([raw,base+'.ts',base+'.tsx',base+'.js',base+'.jsx',base+'/index.ts',base+'/index.tsx'].some(existsSync),`Broken import ${spec} from ${rel}`);
 }
}
pass(controllerFiles.length>=8,'Missing MVC controllers');
const packageJSON=JSON.parse(file('package.json'));
pass(packageJSON.version==='0.6.0','Incorrect release version');
const vercel=JSON.parse(file('vercel.json'));
for(const source of ['/graphql','/api/json','/api/v1/:path*','/auth/:action'])
 pass(vercel.rewrites.some(x=>x.source===source),`Missing Vercel route ${source}`);
for(const f of ['sql/005_api_quality.sql','docs/openapi.json','docs/api-protocols.md','docs/cmm-quality-manual.md','quality/CHANGE_CONTROL.md','.github/workflows/quality.yml'])file(f);
pass(/REVOKE ALL ON TABLE public.api_keys/.test(read('sql/005_api_quality.sql')),'New sensitive tables must not be exposed to anon');
pass(/findAndCountKey/.test(read('apps/api/src/services/api-key.service.ts')),'No API-key authentication');
pass(/enforceKeyScope/.test(read('apps/api/src/controllers/transport.controller.ts')),'Tenant-bound API-key scope enforcement missing');
pass(/sha256\(raw\)/.test(read('apps/api/src/services/api-key.service.ts')),'API Key must be stored hashed');
pass(/guardGraphqlDocument/.test(read('apps/api/src/controllers/http.controller.ts')),'GraphQL complexity guard missing');
pass(/stripe\.webhooks\.constructEvent/.test(read('apps/api/src/billing/stripe.ts')),'Stripe signature verification missing');
pass(/UNIQUE\s*\(org_id,\s*client_task_id\)/.test(read('sql/001_initial.sql')),'Video idempotency constraint missing');
const openapi=JSON.parse(read('docs/openapi.json'));
pass(openapi.openapi.startsWith('3.1.'),'Invalid OpenAPI version');
const apiContract=read('apps/api/src/contracts/operations.ts');
for(const path of Object.keys(openapi.paths)){
 const quoted=path.replace(/^\/api\/v1/,'').replaceAll('{',':').replaceAll('}','');
 pass(apiContract.includes(`'${quoted}'`),`OpenAPI contract has unknown route: ${path}`);
}
console.log(`PASS CMM quality gate: ${tested} architecture, API, security, module and deployment checks.`);
