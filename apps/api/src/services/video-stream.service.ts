import { config } from '../config.js';
import { videoForUser } from '../repositories/storage.repository.js';
import { providerKey } from '../provider/client.js';
import type { User } from '../auth/sessions.js';
import { assert } from '../utils/errors.js';
export async function handleVideo(request:Request,user:User|null,id:string):Promise<Response> {
  assert(request.method==='GET'||request.method==='HEAD','方法不允许',405);
  assert(user,'请先登录',401);
  assert(/^[0-9a-f-]{36}$/i.test(id),'视频任务 ID 无效',400);
  const row=await videoForUser(id,user.id);assert(row?.video_url,'视频尚未准备好',404);
  const url=new URL(row.video_url,config.providerUrl);assert(['http:','https:'].includes(url.protocol),'视频 URL 无效',502);
  // Never forward the upstream license header to a third-party CDN on redirects.
  if(url.origin!==new URL(config.providerUrl).origin)return Response.redirect(url.toString(),302);
  assert(url.pathname.startsWith('/api/video/')||url.pathname.startsWith('/api/task/'),'不支持的上游视频地址',502);
  const key=await providerKey(row.org_id);
  const headers:HeadersInit={'X-License-Key':key};
  if(request.headers.has('range'))headers.Range=request.headers.get('range')!;
  const upstream=await fetch(url.toString(),{headers,method:request.method,redirect:'manual',signal:AbortSignal.timeout(60_000)});
  if(upstream.status>=300&&upstream.status<400){
    const loc=upstream.headers.get('location');assert(loc,'上游视频跳转缺少地址',502);
    const target=new URL(loc,url);assert(['https:','http:'].includes(target.protocol),'上游跳转无效',502);
    return Response.redirect(target.toString(),302);
  }
  assert(upstream.ok,'上游视频暂不可下载',502);
  const responseHeaders=new Headers({'Content-Type':upstream.headers.get('content-type')??'video/mp4',
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  for(const h of ['content-length','content-range','accept-ranges']){const v=upstream.headers.get(h);if(v)responseHeaders.set(h,v);}
  return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:responseHeaders});
}
