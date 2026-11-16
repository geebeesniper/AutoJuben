import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { incrementAuthThrottle,accountDisabled,ensureUserWorkspace,auditLogin,persistSession,revokeAllSessions,revokeSessionHash } from '../repositories/auth.repository.js';
import { getCurrentUser,memberships } from '../auth/sessions.js';
import { sessionToken,sha256 } from '../auth/security.js';
import { AppError,assert } from '../utils/errors.js';

const jsonify=(body:unknown,status=200,extra:HeadersInit={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
const sessionCookie=(token:string|null,request:Request)=>{
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  return `aj_session=${token??''}; HttpOnly; SameSite=Lax; Path=/; ${token?'Max-Age=604800':'Max-Age=0'}${secure}`;
};
export function guardWebWrite(request:Request) {
  const origin=request.headers.get('origin');
  const local=new URL(request.url).origin;
  assert(!origin||origin===local,'Origin 不匹配',403);
  assert(request.headers.get('x-saas-client')==='web','请求缺少 X-SaaS-Client',403);
  const len=Number(request.headers.get('content-length')??0);
  assert(len<=128*1024,'请求体过大',413);
}
async function limitedJson(request:Request):Promise<Record<string,any>> {
  const text=await request.text();assert(text.length<=128*1024,'请求体过大',413);
  try {const obj=JSON.parse(text);assert(obj&&typeof obj==='object'&&!Array.isArray(obj),'请求体必须是 JSON 对象');return obj;}catch(e){if(e instanceof AppError)throw e;throw new AppError(400,'JSON 格式错误');}
}
const cleanString=(input:unknown,max:number)=>typeof input==='string'?input.trim().slice(0,max+1):'';
async function throttle(email:string){assert(await incrementAuthThrottle(email)<=20,'登录请求过多，请稍后重试',429);}
function newAuthClient() {
  assert(config.supabaseUrl && config.supabasePublishableKey,'Supabase Auth 未配置',503);
  // New client per request; never share authenticated session state between Vercel invocations.
  return createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}
async function ensureProfile(id:string,email:string,metadata:Record<string,unknown>){
  assert(!await accountDisabled(id),'此账号已被管理员停用',403);
  const name=cleanString(metadata.name,120)||email.split('@')[0];
  const orgName=cleanString(metadata.orgName,160)||`${name} 的工作区`;
  await ensureUserWorkspace(id,email,name,orgName);
}
async function issueSession(id:string){
  const raw=sessionToken();await persistSession(id,sha256(raw));return raw;
}
export async function handleAuth(request:Request,action:string):Promise<Response> {
  if(action==='me' && request.method==='GET') {
    const user=await getCurrentUser(request.headers.get('cookie')??'');
    return jsonify({user,organizations:user?await memberships(user.id):[]});
  }
  assert(request.method==='POST','方法不允许',405);
  guardWebWrite(request);
  if(action==='logout') {
    const match=(request.headers.get('cookie')??'').match(/(?:^|;\s*)aj_session=([^;]+)/);
    if(match)await revokeSessionHash(sha256(match[1]));
    return jsonify({ok:true},200,{'Set-Cookie':sessionCookie(null,request)});
  }
  const body=await limitedJson(request);
  if(action==='revoke-sessions') {
    // After a successful Supabase password reset, require a verified Supabase bearer
    // from the recovery flow before revoking every legacy server-side session.
    const token=typeof body.accessToken==='string'?body.accessToken:'';
    assert(token.length>=30&&token.length<=8192,'验证令牌无效',401);
    const {data,error}=await newAuthClient().auth.getUser(token);
    assert(!error && data.user?.id,'登录会话验证失败',401);
    await revokeAllSessions(data.user.id);
    return jsonify({ok:true},200,{'Set-Cookie':sessionCookie(null,request)});
  }
  const email=cleanString(body.email,240).toLowerCase();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=240,'邮箱格式不正确');
  await throttle(email);
  const auth=newAuthClient();
  if(action==='forgot-password') {
    // Supabase deliberately does not reveal whether the email exists.
    await auth.auth.resetPasswordForEmail(email,{redirectTo:`${config.origin}/?auth=reset`});
    return jsonify({ok:true,message:'如果邮箱已注册，你将收到重置密码的邮件。'});
  }
  const password=String(body.password??'');
  assert(password.length>0 && password.length<=128,'密码长度无效');
  if(action==='register') {
    const name=cleanString(body.name,120);const orgName=cleanString(body.orgName,160);
    assert(name.length>=2&&name.length<=120,'名称需要 2–120 字符');
    assert(orgName.length>=2&&orgName.length<=160,'工作区名称需要 2–160 字符');
    assert(password.length>=12,'密码长度至少 12 字符');
    const {data,error}=await auth.auth.signUp({email,password,options:{data:{name,orgName}}});
    if(error)throw new AppError(400,'注册失败：'+error.message);
    if(!data.session?.access_token||!data.user?.email) {
      return jsonify({user:null,organizations:[],confirmationRequired:true,message:'已提交注册；请先在邮箱中完成 Supabase 验证，然后回来登录。'},202);
    }
    await ensureProfile(data.user.id,data.user.email,data.user.user_metadata??{});
    const raw=await issueSession(data.user.id);
    const user=await getCurrentUser(`aj_session=${raw}`);
    return jsonify({user,organizations:await memberships(data.user.id)},201,{'Set-Cookie':sessionCookie(raw,request)});
  }
  if(action==='login') {
    const {data,error}=await auth.auth.signInWithPassword({email,password});
    if(error||!data.user?.email||!data.session?.access_token)throw new AppError(401,'邮箱或密码不正确，或邮箱尚未验证');
    await ensureProfile(data.user.id,data.user.email,data.user.user_metadata??{});
    const raw=await issueSession(data.user.id);
    await auditLogin(data.user.id);
    const user=await getCurrentUser(`aj_session=${raw}`);
    return jsonify({user,organizations:await memberships(data.user.id)},200,{'Set-Cookie':sessionCookie(raw,request)});
  }
  throw new AppError(404,'接口不存在');
}
