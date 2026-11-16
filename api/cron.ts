import { createHash,timingSafeEqual } from 'node:crypto';
import { config } from '../apps/api/src/config.js';
import { runScheduledTick } from '../apps/api/src/worker/runner.js';
const equalSecret=(given:string,expected:string)=>{
  const a=createHash('sha256').update(given).digest();
  const b=createHash('sha256').update(expected).digest();
  return timingSafeEqual(a,b);
};
export default {async fetch(request:Request):Promise<Response>{
  if(request.method!=='POST')return Response.json({error:'POST only'},{status:405});
  if(!config.cronSecret || config.cronSecret.length<32 ||
    !equalSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')??'',config.cronSecret))
    return Response.json({error:'Unauthorized'},{status:401});
  try {await runScheduledTick();return Response.json({ok:true,processedAt:new Date().toISOString()});}
  catch(error){console.error('[cron]',error);return Response.json({error:'Scheduled job failed'},{status:500});}
}};
