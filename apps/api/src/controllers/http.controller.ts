import { GraphQLError } from 'graphql';
import { createYoga,maskError } from 'graphql-yoga';
import { config } from '../config.js';
import { schema } from '../graphql/schema.js';
import { checkDatabase } from '../services/health.service.js';
import { guardGraphqlDocument } from '../services/graphql-guard.service.js';
import { buildDiagnostics } from '../services/diagnostics.service.js';
import { getCurrentUser,requireMembership } from '../auth/sessions.js';
import { guardWebWrite,handleAuth } from './auth.controller.js';
import { handleAssetUpload,handleAssetDownload } from './storage.controller.js';
import { handleVideo } from './video.controller.js';
import { backupManifestForDownload } from '../launcher/backups.js';
import { AppError,assert } from '../utils/errors.js';
import { handleTransport } from './transport.controller.js';
import { randomUUID } from 'node:crypto';
import { recordMetricSafely } from '../services/api-metrics.service.js';

const yoga=createYoga({
  schema,graphqlEndpoint:'/graphql',graphiql:!config.production,
  context:async ({request})=>({user:await getCurrentUser(request.headers.get('cookie')??'')}),
  maskedErrors:{isDev:false,maskError(error,message,isDev){
    const original=error instanceof GraphQLError?error.originalError:error;
    if(original instanceof AppError)return new GraphQLError(original.message,{extensions:{code:original.code}});
    return maskError(error,message,isDev);
  }}
});
function download(name:string,buf:Buffer):Response {
  return new Response(new Uint8Array(buf),{status:200,headers:{'Content-Type':'application/json; charset=utf-8',
    'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store'}});
}
async function handleDownload(request:Request,kind:'diagnostics'|'manifest',id:string):Promise<Response> {
  assert(request.method==='GET','方法不允许',405);
  const orgId=new URL(request.url).searchParams.get('orgId')??'';
  const user=await getCurrentUser(request.headers.get('cookie')??'');
  await requireMembership(user,orgId,['owner','admin']);
  if(kind==='manifest')return download(`autojuben-backup-${id}-metadata.json`,await backupManifestForDownload(orgId,id));
  return download(`autojuben-vercel-diagnostics-${Date.now()}.json`,await buildDiagnostics(orgId));
}
/** One Web-standard Vercel Function serves GraphQL, Auth and authorized Storage routes. */
export async function handleRequest(request:Request):Promise<Response> {
  try {
    const url=new URL(request.url);const pathname=url.pathname;
    const target=url.searchParams.get('target')??(
      pathname==='/graphql'?'graphql':pathname.startsWith('/auth/')?'auth':pathname==='/healthz'?'health':
      pathname==='/api/json'?'json':pathname.startsWith('/api/v1/')?'rest':
      pathname==='/api/uploads'?'uploads':/^\/api\/assets\//.test(pathname)?'asset':
      /^\/api\/jobs\/.+\/video$/.test(pathname)?'video':
      pathname==='/api/launcher/diagnostics'?'diagnostics':pathname.endsWith('/manifest')?'manifest':'');
    let response:Response;
    if(target==='rest'||target==='json'){
      return await handleTransport(request,target);
    }else if(target==='health') {
      await checkDatabase();
      response=Response.json({ok:true,platform:'vercel-supabase',version:'0.6.0',mode:config.mockProvider?'demo':'live'});
    }else if(target==='graphql') {
      guardWebWrite(request);await guardGraphqlDocument(request);
      const started=performance.now();
      const endpoint=new URL(request.url);endpoint.pathname='/graphql';
      response=await yoga.fetch(new Request(endpoint,request));
      let graphErrors=0;
      try{const result=await response.clone().json() as {errors?:unknown[]};graphErrors=Array.isArray(result.errors)?result.errors.length:0;}catch{}
      try {await recordMetricSafely({requestId:randomUUID(),transport:'graphql',operation:'graphql',status:response.status,
        ms:Math.round(performance.now()-started),authMode:'session',graphqlErrors:graphErrors});}catch(e){console.warn('[GraphQL metric skipped]',e instanceof Error?e.message:'unknown');}
    }else if(target==='auth'){
      response=await handleAuth(request,url.searchParams.get('action')??pathname.split('/').at(-1)??'');
    }else if(target==='uploads'){
      response=await handleAssetUpload(request,await getCurrentUser(request.headers.get('cookie')??''));
    }else if(target==='asset'){
      response=await handleAssetDownload(await getCurrentUser(request.headers.get('cookie')??''),url.searchParams.get('id')??pathname.split('/')[3]??'');
    }else if(target==='video'){
      response=await handleVideo(request,await getCurrentUser(request.headers.get('cookie')??''),url.searchParams.get('id')??pathname.split('/')[3]??'');
    }else if(target==='diagnostics'||target==='manifest'){
      response=await handleDownload(request,target,url.searchParams.get('id')??pathname.split('/')[4]??'');
    }else throw new AppError(404,'接口不存在');
    const headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');
    headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('Cache-Control','no-store');
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,statusText:response.statusText,headers});
  }catch(error){
    const status=error instanceof AppError?error.status:500;
    if(status>=500)console.error('[serverless]',error);
    return Response.json({error:error instanceof AppError?error.message:'服务器内部错误'},
      {status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
}
