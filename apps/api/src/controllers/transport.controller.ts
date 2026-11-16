import {randomUUID} from 'node:crypto';
import {getCurrentUser} from '../auth/sessions.js';
import {guardWebWrite} from '../services/auth.service.js';
import {principalFromBearer,enforceKeyScope} from '../services/api-key.service.js';
import {callOperation,matchRestRoute,operationScope,validatedArgs} from '../contracts/operations.js';
import type {ApiPrincipal} from '../models/api.model.js';
import {recordMetricSafely} from '../services/api-metrics.service.js';
import {AppError,assert} from '../utils/errors.js';

const version='v1' as const;
const withJSON=(body:unknown,status:number,requestId:string)=>Response.json(body,{status,headers:{
 'Cache-Control':'no-store','X-Request-ID':requestId,'X-Content-Type-Options':'nosniff'}});
async function readJson(request:Request):Promise<Record<string,unknown>>{
 assert(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json',
   'Content-Type 必须是 application/json',415);
 const len=Number(request.headers.get('content-length')??0);assert(Number.isFinite(len)&&len<=131072,'请求过大',413);
 const raw=await request.text();assert(raw.length<=131072,'请求过大',413);
 try{
  const body=JSON.parse(raw) as unknown;
  assert(body!==null&&typeof body==='object'&&!Array.isArray(body),'请求体必须是 JSON 对象');
  return body as Record<string,unknown>;
 }catch(e){if(e instanceof AppError)throw e;throw new AppError(400,'请求不是有效的 JSON');}
}
async function principal(request:Request):Promise<ApiPrincipal>{
 const bearer=request.headers.get('authorization');
 if(bearer){const key=await principalFromBearer(bearer);assert(key,'Authorization 格式无效',401);return key;}
 const user=await getCurrentUser(request.headers.get('cookie')??'');assert(user,'请先登录',401);
 return {mode:'session',user};
}
function toQuery(url:URL):Record<string,string>{
 const params:Record<string,string>={};
 for(const [key,value] of url.searchParams)if(!['target','path','action'].includes(key)){
  assert(!(key in params),'重复查询参数',400);params[key]=value;
 }
 return params;
}
/** Request dispatch -> controller -> service -> repository. Routes never write SQL. */
export async function handleTransport(request:Request,kind:'rest'|'json'):Promise<Response>{
 const requestId=randomUUID(),start=performance.now(),url=new URL(request.url);
 let status=200,operation='unknown',authMode:'anonymous'|'session'|'api_key'='anonymous',orgId:string|undefined;
 try{
  let name:string,params:Record<string,unknown>;
  if(kind==='json'){
   assert(request.method==='POST','JSON 命令接口只允许 POST',405);
   const body=await readJson(request);
   assert(Object.keys(body).every(k=>['operation','params'].includes(k)),'命令信封存在未知字段');
   assert(typeof body.operation==='string'&&body.operation.length<=100,'operation 必须是字符串');
   name=body.operation;params=(body.params??{}) as Record<string,unknown>;
  }else{
   const routePath=url.searchParams.get('path')??
     (url.pathname.startsWith('/api/v1')?url.pathname.slice('/api/v1'.length):'');
   assert(routePath.length<=500,'URL 过长',414);
   const matched=matchRestRoute(request.method,routePath);
   assert(matched, 'REST 路由不存在或 HTTP Method 不匹配',404);
   name=matched.name;
   params={...(request.method==='GET'?toQuery(url):
     ['POST','PATCH','PUT'].includes(request.method)?await readJson(request):{}),...matched.params};
  }
  operation=name;
  const validated=validatedArgs(name,params);
  orgId=typeof validated.args.orgId==='string'?validated.args.orgId:undefined;
  const auth=await principal(request);authMode=auth.mode;
  enforceKeyScope(auth,orgId,operationScope(validated.name));
  if(auth.mode==='session' && (kind==='json'||!['GET','HEAD'].includes(request.method))){
    // Anti-CSRF for cookie-backed APIs; bearer API key requests are not cookie-authenticated.
    guardWebWrite(request);
  }
  const data=await callOperation(validated.name,validated.args,{user:auth.user});
  status=kind==='rest'&&request.method==='POST'?201:200;
  return withJSON({ok:true,data,meta:{requestId,version}},status,requestId);
 }catch(e){
  status=e instanceof AppError?e.status:500;
  if(status>=500)console.error('[API] requestId=',requestId,'transport=',kind,'error=',e);
  return withJSON({ok:false,error:{code:e instanceof AppError?e.code:'INTERNAL_ERROR',message:e instanceof AppError?e.message:'服务器内部错误'},meta:{requestId,version}},status,requestId);
 }finally{
  // Best effort: metrics outage must never change payment or video transaction responses.
  try{await recordMetricSafely({requestId,transport:kind,operation,status,ms:Math.max(0,Math.round(performance.now()-start)),authMode,orgId});}
  catch(e){console.warn('[API metric skipped]',e instanceof Error?e.message:'unknown');}
 }
}
