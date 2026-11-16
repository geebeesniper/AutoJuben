// Smoke-check a deployed Vercel + Supabase instance without creating unverified accounts.
// SMOKE_URL=https://your-project.vercel.app node scripts/smoke.mjs
const base=(process.env.SMOKE_URL??'http://localhost:3000').replace(/\/$/,'');
async function request(path, options={}){
  const res=await fetch(base+path,{redirect:'manual',...options});
  const data=await res.json().catch(()=>({}));
  return {status:res.status,data};
}
const health=await request('/healthz');
if(health.status!==200||health.data.ok!==true)throw new Error(`/healthz failed: ${JSON.stringify(health)}`);
console.log('PASS database connectivity and Vercel Function',health.data);
const auth=await request('/auth/me');
if(auth.status!==200||auth.data.user!==null)throw new Error(`/auth/me anonymous check failed: ${JSON.stringify(auth)}`);
console.log('PASS anonymous auth session is empty');
const unauthorized=await request('/graphql',{method:'POST',headers:{'Content-Type':'application/json','X-SaaS-Client':'web'},body:JSON.stringify({query:'query{organizations{id name}}'})});
if(unauthorized.status!==200 || !unauthorized.data.errors?.length)throw new Error(`Anonymous GraphQL access should fail: ${JSON.stringify(unauthorized)}`);
console.log('PASS anonymous GraphQL is tenant-protected');
console.log('SMOKE PASS (does not replace authenticated integration tests)');
