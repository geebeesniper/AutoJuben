import { useEffect,useRef,useState } from 'react';
import { createClient,type SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft,ArrowRight,Clapperboard,KeyRound,LockKeyhole,PlayCircle,Sparkles,ShieldCheck,WandSparkles } from 'lucide-react';
import { authRequest,type Org,type User } from '../lib/api';
type Mode='login'|'register'|'forgot'|'reset';
function defaultMode():Mode {return new URLSearchParams(window.location.search).get('auth')==='reset'||window.location.hash.includes('type=recovery')?'reset':'login';}
export function AuthPage({onAuth}:{onAuth:(user:User,orgs:Org[])=>void}){
 const [mode,setMode]=useState<Mode>(defaultMode);
 const [name,setName]=useState(''),[orgName,setOrgName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[recoveryReady,setRecoveryReady]=useState(false);
 const recoveryClient=useRef<SupabaseClient|null>(null);
 function select(value:Mode){setMode(value);setError('');setNotice('');setPassword('');}
 useEffect(()=>{
  if(mode!=='reset')return;
  const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key){setError('缺少公开 Supabase Auth 配置');return;}
  const client=createClient(url,key,{auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
  recoveryClient.current=client;
  const {data:listener}=client.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'||(session?.user&&session.access_token))setRecoveryReady(true);
  });
  void client.auth.getSession().then(x=>{if(x.data.session?.user)setRecoveryReady(true);}).catch(()=>{});
  return()=>listener.subscription.unsubscribe();
 },[mode]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  if(mode==='reset'){
   if(!recoveryReady||!recoveryClient.current)throw new Error('重置链接无效或已过期，请重新发送找回密码邮件。');
   if(password.length<12)throw new Error('新密码至少需要 12 个字符');
   const {error:err}=await recoveryClient.current.auth.updateUser({password});if(err)throw err;
   const {data:verified}=await recoveryClient.current.auth.getSession();
   let revoked=true;
   try {
     if(!verified.session?.access_token)throw new Error('重置会话无法读取');
     await authRequest('revoke-sessions',{accessToken:verified.session.access_token});
   } catch {revoked=false;}
   await recoveryClient.current.auth.signOut();window.history.replaceState({},'',window.location.pathname);
   select('login');setNotice(revoked?'密码已修改，其他设备的旧会话也已注销。请重新登录。':'密码已修改，但旧会话注销未确认，请联系管理员检查现有会话。');return;
  }
  if(mode==='forgot'){
   await authRequest('forgot-password',{email});setNotice('如果邮箱存在且可以接收邮件，你将收到重置密码链接。');return;
  }
  const body=mode==='register'?{name,orgName,email,password}:{email,password};
  const payload=await authRequest(mode==='register'?'register':'login',body);
  if(payload.user)onAuth(payload.user,payload.organizations);
  else if(payload.confirmationRequired)setNotice('注册已提交。请先在邮箱中完成账户验证，然后回来登录。');
 }catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}}
 const title={login:'欢迎回来',register:'创建你的创作空间',forgot:'找回密码',reset:'设置新密码'}[mode];
 const desc={login:'登录账户，查看创作任务、购买记录和付款方式。',register:'注册账号并建立第一个专属工作区。',forgot:'输入注册邮箱，我们将发送安全的密码重置邮件。',reset:'验证邮箱链接后，为你的账户设置新密码。'}[mode];
 return <div className="auth-shell"><aside className="auth-brand"><div className="auth-logo"><span className="logo-mark"><Clapperboard size={24}/></span><span>AUTOJUBEN <b>CLOUD</b></span></div><div className="auth-pitch"><span><Sparkles size={16}/> THE NEXT CREATIVE WORKSPACE</span><h1>灵感有无限可能。<br/><em>创作，更简单。</em></h1><p>让 AI 视频制作、创作历史、账号与支付全部集中在一个安全的 SaaS 平台。</p><div className="auth-highlights"><div><WandSparkles size={21}/> 9 图 + 音视频多模态生成</div><div><ShieldCheck size={21}/> 账户与支付数据安全隔离</div><div><PlayCircle size={21}/> 创作历史、积分与购买记录</div></div></div><div className="auth-bottom">AutoJuben SaaS / TypeScript + GraphQL <span>v0.4.0</span></div></aside>
 <main className="auth-side"><div className="auth-form"><div className="auth-welcome-icon">{mode==='forgot'||mode==='reset'?<KeyRound size={26}/>:<LockKeyhole size={26}/>}</div><div className="section-kicker">SECURE CUSTOMER ACCOUNT</div><h2>{title}</h2><p>{desc}</p><form onSubmit={e=>void submit(e)}>
 {mode==='register'&&<><label className="field"><span>显示名称</span><input minLength={2} maxLength={120} required value={name} onChange={e=>setName(e.target.value)} placeholder="你的姓名"/></label><label className="field"><span>工作区名称</span><input minLength={2} maxLength={160} required value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="例如：Creative Studio"/></label></>}
 {mode!=='reset'&&<label className="field"><span>邮箱</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label>}
 {mode!=='forgot'&&<label className="field"><span>{mode==='reset'?'新密码':'密码'}</span><input type="password" minLength={['register','reset'].includes(mode)?12:1} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={['register','reset'].includes(mode)?'至少 12 个字符':'输入登录密码'} autoComplete={['register','reset'].includes(mode)?'new-password':'current-password'}/></label>}
 {mode==='login'&&<div className="auth-forgot"><button type="button" onClick={()=>select('forgot')}>忘记密码？</button></div>}
 {error&&<div className="auth-error" role="alert">{error}</div>}{notice&&<div className="auth-error auth-success-notice" role="status">{notice}</div>}
 <button disabled={busy||(mode==='reset'&&!recoveryReady)} className="btn btn-primary wide auth-submit" type="submit">{busy?'正在处理…':mode==='login'?'登录平台':mode==='register'?'创建工作区':mode==='forgot'?'发送重置邮件':'设置新密码'} <ArrowRight size={17}/></button>
 </form>{mode==='reset'&&!recoveryReady&&<p className="portal-help">正在验证密码重置链接。如果一直无法验证，请重新发送邮件。</p>}
 <div className="auth-switch">{mode==='login'?'还没有账户？':mode==='register'?'已经有账户？':'返回登录'} <button type="button" onClick={()=>select(mode==='login'?'register':'login')}>{mode==='login'?'免费创建工作区':mode==='register'?'立即登录':'返回登录'}</button></div><p className="auth-footnote">账户验证由 Supabase Auth 负责；信用卡信息由 Stripe 安全托管。</p></div></main></div>;
}
