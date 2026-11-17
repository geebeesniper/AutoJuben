import { config } from '../config.js';
import { query } from '../db/pool.js';
import { decryptSecret } from '../auth/security.js';
import { platformSettings } from '../billing/common.js';
import { AppError } from '../utils/errors.js';
import { signedReadUrl } from '../serverless/storage.js';
export type ProviderAsset = {kind:'image'|'audio'|'video'; file_path:string;content_type:string;original_name:string};
export type StoredJob = {
  id:string;org_id:string;client_task_id:string;provider_task_id:string|null;
  prompt:string;model:string;duration:number;ratio:string;resolution:string;
  image_urls:string[];audio_urls:string[];video_urls:string[];
  image_asset_ids:string[];audio_asset_ids:string[];video_asset_ids:string[];
  submitted_at:Date|null;progress:number;
};
export type Submission = {taskId:string;requiredCredits:number|null;billingStatus:string|null};
export type PollResult = {status:'pending'|'polling'|'success'|'failed'; progress:number;videoUrl:string|null;billingStatus:string|null;errorCode:string|null;errorMessage:string|null};
export class ProviderError extends Error {
  constructor(message:string,public status:number,public ambiguous=false){super(message);}
}
/** Endpoint defaults match 151_9tu_api_integration.md v1.0. Routes are DATA, never code. */
export type ProviderApiRoutes={
  pricingPath:string;settingsPath:string;submitPath:string;taskPath:string;videoLinkPath:string;
  authMode:'license_key'|'bearer';
};
export const defaultProviderApiRoutes:ProviderApiRoutes={
  pricingPath:'/api/pricing',settingsPath:'/api/public-settings',submitPath:'/api/generate-video',
  taskPath:'/api/task/{task_id}',videoLinkPath:'/api/task/{task_id}/video-link',authMode:'license_key'
};
export function validateProviderApiRoutes(candidate:ProviderApiRoutes):ProviderApiRoutes {
  const staticRoute=/^\/api(?:\/[a-zA-Z0-9_-]+)+$/;
  const dynamicRoute=/^\/api(?:\/[a-zA-Z0-9_-]+)*\/\{task_id\}(?:\/[a-zA-Z0-9_-]+)*$/;
  for(const key of ['pricingPath','settingsPath','submitPath','taskPath','videoLinkPath'] as const) {
    const route=candidate[key];
    const dynamic=key==='taskPath'||key==='videoLinkPath';
    if(typeof route!=='string'||route.length>160||!(dynamic?dynamicRoute:staticRoute).test(route))
      throw new AppError(400,`无效 API 路径 ${key}：必须为 /api/... ${dynamic?'且必须包含 {task_id}':''}`);
  }
  if(!['license_key','bearer'].includes(candidate.authMode))throw new AppError(400,'不支持的 API 鉴权方式');
  return candidate;
}
export async function getGlobalProviderApiRoutes():Promise<ProviderApiRoutes>{
 const row=(await query<{provider_routes:ProviderApiRoutes|null}>(
   'SELECT provider_routes FROM platform_settings WHERE id=1')).rows[0];
 return row?.provider_routes?validateProviderApiRoutes(row.provider_routes):{...defaultProviderApiRoutes};
}
/** A tenant may override global paths. All provider operations share the same effective routes. */
export async function getProviderApiRoutes(orgId:string):Promise<ProviderApiRoutes> {
  const row=(await query<{
    pricing_path:string;settings_path:string;submit_path:string;task_path:string;video_link_path:string;auth_mode:'license_key'|'bearer';
  }>('SELECT pricing_path,settings_path,submit_path,task_path,video_link_path,auth_mode FROM provider_api_routes WHERE org_id=$1',[orgId])).rows[0];
  if(!row)return getGlobalProviderApiRoutes();
  return validateProviderApiRoutes({
    pricingPath:row.pricing_path,settingsPath:row.settings_path,submitPath:row.submit_path,
    taskPath:row.task_path,videoLinkPath:row.video_link_path,authMode:row.auth_mode
  });
}
/** Read-only GET probe: reuses the actual provider HTTP client and header/redirect rules. */
export async function testGlobalProviderConnection():Promise<{ok:boolean;message:string}>{
 if(config.mockProvider)return {ok:false,message:'当前 MOCK_VIDEO_PROVIDER=true：没有请求真实 API。请在 Vercel 环境变量改为 false 后重新测试。'};
 const global=await getGlobalProviderApiRoutes();
 const settings=await platformSettings();
 const key=settings.provider_key_ciphertext?decryptSecret(settings.provider_key_ciphertext):config.providerKey;
 if(!key)return {ok:false,message:'没有全平台默认 API Key，请先在 API 集成中心保存。'};
 try{
  const [pricing,models]=await Promise.all([
   providerFetch(global.pricingPath,key,{},10000,global.authMode),
   providerFetch(global.settingsPath,key,{},10000,global.authMode)
  ]);
  return {ok:true,message:'真实 API 请求成功：Pricing 与 Public Settings 均返回可解析的 JSON。'};
 }catch(err){
  return {ok:false,message:err instanceof Error?err.message.slice(0,180):'视频 API 连接失败'};
 }
}
function taskRoute(template:string,taskId:string):string {
  if(!taskId||taskId.length>160)throw new AppError(400,'视频任务 ID 无效');
  return template.replace('{task_id}',encodeURIComponent(taskId));
}
export async function providerKey(orgId:string):Promise<string> {
  if(config.mockProvider) return 'DEMO-NO-REAL-REQUEST';
  const r=await query<{provider_license_ciphertext:string|null}>('SELECT provider_license_ciphertext FROM organizations WHERE id=$1',[orgId]);
  if(!r.rows[0]) throw new AppError(404,'工作区不存在');
  const settings=await platformSettings();
  const key=r.rows[0].provider_license_ciphertext ? decryptSecret(r.rows[0].provider_license_ciphertext) :
    settings.provider_key_ciphertext?decryptSecret(settings.provider_key_ciphertext):config.providerKey;
  if(!key) throw new AppError(422,'请在设置中填写视频服务卡密，或由管理员配置 VIDEO_API_LICENSE_KEY');
  return key;
}
async function providerFetch(path:string,key:string,init:RequestInit={},timeout=30_000,authMode:'license_key'|'bearer'='license_key'):Promise<any> {
  if(!config.providerUrl.startsWith('https://') && !config.allowInsecureVideoHttp)
    throw new AppError(503,'视频 API 只允许 HTTPS；如确需使用 HTTP，需显式配置 ALLOW_INSECURE_VIDEO_HTTP=true（不推荐）');
  let response:Response;
  try {
    response=await fetch(`${config.providerUrl}${path}`,{...init,headers:{...(authMode==='bearer'?{Authorization:`Bearer ${key}`}:{'X-License-Key':key}),...init.headers},signal:AbortSignal.timeout(timeout),redirect:'error'});
  } catch(error) {
    throw new ProviderError(error instanceof Error?`视频服务网络异常：${error.message}`:'视频服务网络异常',0,true);
  }
  const body=await response.text();let parsed:any;
  try{parsed=body?JSON.parse(body):{};}catch{throw new ProviderError('视频服务返回非 JSON 内容',response.status,!response.ok?false:true);}
  if(!response.ok) {
    const msg=parsed?.error_message || parsed?.message || `视频服务 HTTP ${response.status}`;
    throw new ProviderError(String(msg).slice(0,400),response.status,response.status>=500);
  }
  return parsed;
}
export async function providerInfo(orgId:string):Promise<{mock:boolean;pricing:string;settings:string;endpoints:ProviderApiRoutes}> {
  const endpoints=await getProviderApiRoutes(orgId);
  if(config.mockProvider) return {mock:true,pricing:'{"demo":true,"notice":"Mock mode: zero real credits consumed"}',settings:'{"models":["xinghe-2.0","xinghe-fast"]}',endpoints};
  const key=await providerKey(orgId);
  const [price,settings]=await Promise.allSettled([
    providerFetch(endpoints.pricingPath,key,{},10_000,endpoints.authMode),
    providerFetch(endpoints.settingsPath,key,{},10_000,endpoints.authMode)
  ]);
  const asText=(x:PromiseSettledResult<unknown>)=> x.status==='fulfilled' ? JSON.stringify(x.value,null,2) : JSON.stringify({error:x.reason instanceof Error?x.reason.message:'unknown'});
  return {mock:false,pricing:asText(price),settings:asText(settings),endpoints};
}
async function loadAssets(job:StoredJob):Promise<ProviderAsset[]> {
  const ids=[...job.image_asset_ids,...job.audio_asset_ids,...job.video_asset_ids];
  if(!ids.length) return [];
  const found=(await query<{id:string}&ProviderAsset>(`SELECT id,kind,file_path,content_type,original_name FROM uploaded_assets WHERE org_id=$1 AND id=ANY($2::uuid[])`,[job.org_id,ids])).rows;
  if(found.length!==new Set(ids).size) throw new AppError(400,'某些本地素材不存在或不属于当前工作区');
  return ids.map(id=>found.find(a=>a.id===id)!);
}
export async function submitVideo(job:StoredJob):Promise<Submission> {
  if(config.mockProvider) return {taskId:`mock-${job.id}`,requiredCredits:0,billingStatus:'mock'};
  const endpoints=await getProviderApiRoutes(job.org_id);
  const key=await providerKey(job.org_id);
  const assets=await loadAssets(job);
  // Private Supabase Storage remains private; create temporary per-object HTTPS URLs
  // instead of reading files from Vercel's ephemeral filesystem or proxying large uploads.
  const urls:{image_urls:string[];audio_urls:string[];video_urls:string[]}={
    image_urls:[...job.image_urls],audio_urls:[...job.audio_urls],video_urls:[...job.video_urls]
  };
  for(const item of assets) {
    const signed=await signedReadUrl(item.file_path,14400);
    if(item.kind==='image')urls.image_urls.push(signed);
    else if(item.kind==='audio')urls.audio_urls.push(signed);
    else urls.video_urls.push(signed);
  }
  const payload={client_task_id:job.client_task_id,model:job.model,duration:job.duration,ratio:job.ratio,
    resolution:job.resolution,prompt:job.prompt,...urls};
  const init:RequestInit={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)};
  const result=await providerFetch(endpoints.submitPath,key,init,90_000,endpoints.authMode);
  if(result?.status!=='success'||typeof result.task_id!=='string') throw new ProviderError('服务端未返回有效 task_id',200,true);
  return {taskId:result.task_id,requiredCredits:Number.isFinite(Number(result.required_credits))?Number(result.required_credits):null,billingStatus:result.billing_status??'reserved'};
}
function safeVideoUrl(url:unknown):string|null {
  if(typeof url!=='string'||!url)return null;
  try {const u=new URL(url,config.providerUrl);return ['http:','https:'].includes(u.protocol)?u.toString():null;}catch{return null;}
}
export async function pollVideo(job:StoredJob):Promise<PollResult> {
  if(config.mockProvider) {
    const secs=Math.max(0,(Date.now()-(job.submitted_at?.getTime()??Date.now()))/1000);
    const progress=Math.min(100,Math.floor(secs/25*100));
    return {status:secs>=25?'success':'polling',progress,videoUrl:null,billingStatus:'mock',errorCode:null,errorMessage:secs>=25?'演示完成；未调用实际视频模型，也没有生成 MP4。':null};
  }
  const endpoints=await getProviderApiRoutes(job.org_id);
  const key=await providerKey(job.org_id);
  const result=await providerFetch(taskRoute(endpoints.taskPath,job.provider_task_id??''),key,{},30_000,endpoints.authMode);
  const status=String(result.status??'').toLowerCase();
  let videoUrl=safeVideoUrl(result.video_url??result.stable_video_url??result.mp4_url);
  if(status==='success'&&!videoUrl) {
    try {
      const fallback=await providerFetch(taskRoute(endpoints.videoLinkPath,job.provider_task_id??''),key,{},15_000,endpoints.authMode);
      videoUrl=safeVideoUrl(fallback.video_url??fallback.stable_video_url??fallback.mp4_url??fallback.url);
    }catch{/* provider may delay link publication */}
  }
  const normalized=status==='failed'?'failed':status==='success' && videoUrl?'success':status==='pending'?'pending':'polling';
  return {status:normalized,progress:normalized==='success'?100:Math.max(0,Math.min(99,Number(result.progress)||0)),videoUrl,
    billingStatus:result.billing_status??null,errorCode:result.error_code??null,errorMessage:result.error_message??null};
}
