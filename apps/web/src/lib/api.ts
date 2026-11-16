export type User={id:string;name:string;email:string};
export type Org={id:string;name:string;slug:string;role:string};
export type Project={id:string;orgId:string;name:string;description:string;jobCount:number;createdAt:string};
export type Member={userId:string;name:string;email:string;role:string;joinedAt:string};
export type VideoJob={
  id:string;orgId:string;projectId:string|null;clientTaskId:string;providerTaskId:string|null;
  prompt:string;model:string;duration:number;ratio:string;resolution:string;status:string;progress:number;
  requiredCredits:number|null;billingStatus:string|null;videoUrl:string|null;errorCode:string|null;errorMessage:string|null;isDemo:boolean;
  imageUrls:string[];audioUrls:string[];videoUrls:string[];
  platformCreditCost:number;platformCreditState:string;
  createdAt:string;updatedAt:string;submittedAt:string|null;finishedAt:string|null;
};
export type Dashboard={total:number;active:number;completed:number;failed:number;projects:number};
export type AppData={dashboard:Dashboard;projects:Project[];jobs:VideoJob[];members:Member[]};
export type UploadedAsset={id:string;kind:'image'|'audio'|'video';name:string;bytes:number};
import { createClient } from '@supabase/supabase-js';
const workQuery=`query Work($orgId:ID!){ dashboard(orgId:$orgId){total active completed failed projects}
  projects(orgId:$orgId){id orgId name description jobCount createdAt}
  jobs(orgId:$orgId,limit:100){id orgId projectId clientTaskId providerTaskId prompt model duration ratio resolution status progress requiredCredits billingStatus videoUrl errorCode errorMessage isDemo platformCreditCost platformCreditState imageUrls audioUrls videoUrls createdAt submittedAt finishedAt updatedAt}
  members(orgId:$orgId){userId name email role joinedAt}
}`;
export async function gql<T>(query:string,variables:Record<string,unknown>={}):Promise<T> {
  const response=await fetch('/graphql',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-SaaS-Client':'web'},body:JSON.stringify({query,variables})});
  const payload=await response.json().catch(()=>({}));
  if(payload.errors?.length)throw new Error(payload.errors.map((e:{message:string})=>e.message).join('；'));
  if(!response.ok)throw new Error(payload.error??`HTTP ${response.status}`);
  return payload.data as T;
}
export async function getWork(orgId:string):Promise<AppData>{return await gql<AppData>(workQuery,{orgId});}
export async function authRequest(path:string,data?:Record<string,string>) {
  const response=await fetch(`/auth/${path}`,{method:data?'POST':'GET',credentials:'include',headers:data?{'Content-Type':'application/json','X-SaaS-Client':'web'}:{},body:data?JSON.stringify(data):undefined});
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error??`HTTP ${response.status}`);
  return payload as {user:User|null;organizations:Org[];confirmationRequired?:boolean;message?:string};
}
export async function uploadAsset(orgId:string,file:File):Promise<UploadedAsset> {
  const endpoint='/api/uploads';
  async function step(payload:Record<string,unknown>) {
    const response=await fetch(endpoint,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-SaaS-Client':'web'},body:JSON.stringify({...payload,orgId})});
    const body=await response.json();
    if(!response.ok)throw new Error(body.error??`上传接口 HTTP ${response.status}`);
    return body;
  }
  const ticket=await step({action:'prepare',name:file.name,bytes:file.size,mime:file.type||'application/octet-stream'});
  const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
  const publicKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!supabaseUrl||!publicKey)throw new Error('Vercel 没有设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY');
  const storage=createClient(supabaseUrl,publicKey,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from(ticket.bucket);
  // The browser uploads directly to Supabase via a short-lived, one-object token.
  // The service secret remains exclusively in the Vercel Function.
  const result=await storage.uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:file.type||'application/octet-stream'});
  if(result.error)throw new Error(`Supabase 上传失败：${result.error.message}`);
  return await step({action:'complete',id:ticket.id}) as UploadedAsset;
}
export function formatDate(iso:string|null|undefined){if(!iso)return '—';return new Date(iso).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
export const statuses:Record<string,{label:string;className:string}>={
  queued:{label:'排队中',className:'queued'},submitting:{label:'提交中',className:'running'},
  submission_unknown:{label:'提交待核实',className:'warning'},pending:{label:'已受理',className:'running'},
  polling:{label:'生成中',className:'running'},success:{label:'已完成',className:'success'},failed:{label:'失败',className:'failed'}
};
