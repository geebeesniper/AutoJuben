import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { createUploadRecord,discardUploadRecord,readUploadRecord,completeUploadRecord,assetPathForUser } from '../repositories/storage.repository.js';
import { requireMembership, type User } from '../auth/sessions.js';
import { AppError,assert } from '../utils/errors.js';
import { guardWebWrite } from './auth.service.js';

const types:Record<string,{kind:'image'|'audio'|'video';mime:string}>={
 '.jpg':{kind:'image',mime:'image/jpeg'},'.jpeg':{kind:'image',mime:'image/jpeg'},'.png':{kind:'image',mime:'image/png'},
 '.webp':{kind:'image',mime:'image/webp'},'.mp3':{kind:'audio',mime:'audio/mpeg'},'.wav':{kind:'audio',mime:'audio/wav'},
 '.m4a':{kind:'audio',mime:'audio/mp4'},'.mp4':{kind:'video',mime:'video/mp4'},'.mov':{kind:'video',mime:'video/quicktime'},
 '.webm':{kind:'video',mime:'video/webm'}
};
export function storageClient() {
  assert(config.supabaseUrl&&config.supabaseSecretKey,'Supabase Storage 服务端凭据未配置',503);
  return createClient(config.supabaseUrl,config.supabaseSecretKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}
export const bucket=()=>storageClient().storage.from(config.storageBucket);
export function signatureOk(bytes:Uint8Array,ext:string):boolean {
 const ascii=(at:number,len:number)=>Buffer.from(bytes).toString('ascii',at,at+len);
 if(ext==='.jpg'||ext==='.jpeg')return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(ext==='.png')return Buffer.from(bytes).subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
 if(ext==='.webp')return ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP';
 if(ext==='.wav')return ascii(0,4)==='RIFF'&&ascii(8,4)==='WAVE';
 if(ext==='.webm')return Buffer.from(bytes).subarray(0,4).equals(Buffer.from('1a45dfa3','hex'));
 if(['.mp4','.mov','.m4a'].includes(ext))return ascii(4,4)==='ftyp';
 if(ext==='.mp3')return ascii(0,3)==='ID3'||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0);
 return false;
}
export async function signedReadUrl(path:string,expiresSeconds=14400) {
  const {data,error}=await bucket().createSignedUrl(path,expiresSeconds);
  assert(!error && data?.signedUrl,'无法生成素材读取链接',502);
  return data.signedUrl;
}
async function verifySignature(path:string,ext:string):Promise<void> {
  const url=await signedReadUrl(path,120);
  const response=await fetch(url,{headers:{Range:'bytes=0-63'},signal:AbortSignal.timeout(12_000)});
  assert(response.ok&&response.body,'无法读取上传的素材文件',502);
  const reader=response.body.getReader();let part=new Uint8Array(0);
  try {while(part.length<32){const result=await reader.read();if(result.done)break;const b=result.value;part=Uint8Array.from([...part,...b.subarray(0,Math.max(0,64-part.length))]);if(part.length>=32)break;}}
  finally{await reader.cancel().catch(()=>{});}
  assert(signatureOk(part,ext),'文件内容与扩展名不匹配',415);
}
export async function handleAssetUpload(request:Request,user:User|null):Promise<Response> {
  assert(request.method==='POST','方法不允许',405);guardWebWrite(request);
  assert(user,'请先登录',401);
  const body=await request.json() as Record<string,unknown>;
  const orgId=String(body.orgId??'');await requireMembership(user,orgId,['owner','admin','editor']);
  if(body.action==='prepare') {
    const name=String(body.name??'').replace(/[/\\\x00-\x1f]/g,'').slice(0,180);
    const ext=extname(name).toLowerCase();const type=types[ext];
    const bytes=Number(body.bytes);
    assert(type,'仅支持 JPG/PNG/WebP、MP3/WAV/M4A、MP4/MOV/WebM',415);
    assert(Number.isSafeInteger(bytes)&&bytes>0&&bytes<=config.maxUploadBytes,`文件不能超过 ${Math.floor(config.maxUploadBytes/1024/1024)} MB`,413);
    const mime=String(body.mime??'').split(';')[0].trim();
    assert(mime===type.mime || (mime==='application/octet-stream'&&type.kind!=='image'), '素材 MIME 与扩展名不一致',415);
    const id=randomUUID();const path=`${orgId}/uploads/${id}${ext}`;
    await createUploadRecord(id,orgId,user.id,path,name,type.kind,type.mime,bytes);
    const {data,error}=await bucket().createSignedUploadUrl(path);
    if(error||!data?.token){await discardUploadRecord(id);throw new AppError(502,'无法创建 Supabase 上传签名');}
    return Response.json({id,path,token:data.token,kind:type.kind,name,bytes,bucket:config.storageBucket},{status:201});
  }
  if(body.action==='complete') {
    const id=String(body.id??'');
    const pending=await readUploadRecord(id,orgId,user.id);
    assert(pending,'上传会话不存在或不属于当前用户',404);
    const storage=bucket();const {data,error}=await storage.info(pending.storage_path);
    assert(!error&&data,'尚未在 Supabase Storage 中找到该文件',409);
    const size=Number(data.size);const contentType=String(data.contentType??'').split(';')[0].toLowerCase();
    assert(size===Number(pending.expected_bytes)&&size>0&&size<=config.maxUploadBytes,'上传文件大小与登记值不一致',409);
    assert(contentType===pending.mime,'实际上传的 MIME 类型不匹配',415);
    if(!pending.completed_at)await verifySignature(pending.storage_path,extname(pending.name).toLowerCase());
    await completeUploadRecord(id,orgId,user.id,{kind:pending.kind,path:pending.storage_path,name:pending.name,mime:pending.mime,size});
    return Response.json({id,kind:pending.kind,name:pending.name,bytes:size},{status:200});
  }
  throw new AppError(400,'未知上传操作');
}
export async function handleAssetDownload(user:User|null,id:string):Promise<Response> {
  assert(user,'请先登录',401);
  assert(/^[0-9a-f-]{36}$/i.test(id),'素材 ID 无效');
  const path=await assetPathForUser(id,user.id);
  assert(path,'素材不存在或无权访问',404);
  return Response.redirect(await signedReadUrl(path,60),302);
}
