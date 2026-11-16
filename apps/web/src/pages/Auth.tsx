import { useEffect,useRef,useState } from 'react';
import { createClient,type SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft,ArrowRight,Clapperboard,KeyRound,LockKeyhole,PlayCircle,Sparkles,ShieldCheck,WandSparkles } from 'lucide-react';
import { authRequest,type Org,type User } from '../lib/api';
import {LanguageSelect,useI18n} from '../i18n';
type Mode='login'|'register'|'forgot'|'reset';
function defaultMode():Mode {return new URLSearchParams(window.location.search).get('auth')==='reset'||window.location.hash.includes('type=recovery')?'reset':'login';}
export function AuthPage({onAuth}:{onAuth:(user:User,orgs:Org[])=>void}){
 const {t}=useI18n();
 const [mode,setMode]=useState<Mode>(defaultMode);
 const [name,setName]=useState(''),[orgName,setOrgName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[recoveryReady,setRecoveryReady]=useState(false);
 const recoveryClient=useRef<SupabaseClient|null>(null);
 function select(value:Mode){setMode(value);setError('');setNotice('');setPassword('');}
 useEffect(()=>{
  if(mode!=='reset')return;
  const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key){setError(t('serviceUnavailable')+': Supabase Auth');return;}
  const client=createClient(url,key,{auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
  recoveryClient.current=client;
  const {data:listener}=client.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'||(session?.user&&session.access_token))setRecoveryReady(true);
  });
  void client.auth.getSession().then(x=>{if(x.data.session?.user)setRecoveryReady(true);}).catch(()=>{});
  return()=>listener.subscription.unsubscribe();
 },[mode,t]);
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
  const body: Record<string,string>={email,password};
  if(mode==='register'){body.name=name;body.orgName=orgName;}
  const payload=await authRequest(mode==='register'?'register':'login',body);
  if(payload.user)onAuth(payload.user,payload.organizations);
  else if(payload.confirmationRequired)setNotice('注册已提交。请先在邮箱中完成账户验证，然后回来登录。');
 }catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}}
 const title={login:t('authWelcome'),register:t('authCreate'),forgot:t('authForgot'),reset:t('authReset')}[mode];
 const desc={login:t('authLoginDesc'),register:t('authCreateDesc'),forgot:t('authForgotDesc'),reset:t('authResetDesc')}[mode];
 return <div className="auth-shell"><aside className="auth-brand"><div className="auth-logo"><span className="logo-mark"><Clapperboard size={24}/></span><span>AUTOJUBEN <b>CLOUD</b></span></div><div className="auth-pitch"><span><Sparkles size={16}/> AI CREATIVE CLOUD</span><h1>{t('authTagline')}</h1><p>{t('authPitch')}</p><div className="auth-highlights"><div><WandSparkles size={21}/> {t('createdVideo')}</div><div><ShieldCheck size={21}/> {t('security')}</div><div><PlayCircle size={21}/> {t('recentJobs')}</div></div></div><div className="auth-bottom">AutoJuben SaaS / TypeScript + GraphQL <span>v0.6.0</span></div></aside>
 <main className="auth-side"><div className="auth-lang-wrap"><LanguageSelect/></div><div className="auth-form"><div className="auth-welcome-icon">{mode==='forgot'||mode==='reset'?<KeyRound size={26}/>:<LockKeyhole size={26}/>}</div><div className="section-kicker">{t('authSecure')}</div><h2>{title}</h2><p>{desc}</p><form onSubmit={e=>void submit(e)}>
 {mode==='register'&&<><label className="field"><span>{t('displayName')}</span><input minLength={2} maxLength={120} required value={name} onChange={e=>setName(e.target.value)} placeholder={t('displayName')}/></label><label className="field"><span>{t('workspaceName')}</span><input minLength={2} maxLength={160} required value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder={t('workspaceName')}/></label></>}
 {mode!=='reset'&&<label className="field"><span>{t('email')}</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label>}
 {mode!=='forgot'&&<label className="field"><span>{mode==='reset'?t('newPassword'):t('password')}</span><input type="password" minLength={['register','reset'].includes(mode)?12:1} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={['register','reset'].includes(mode)?'12+ characters':t('password')} autoComplete={['register','reset'].includes(mode)?'new-password':'current-password'}/></label>}
 {mode==='login'&&<div className="auth-forgot"><button type="button" onClick={()=>select('forgot')}>{t('forgotPassword')}</button></div>}
 {error&&<div className="auth-error" role="alert">{error}</div>}{notice&&<div className="auth-error auth-success-notice" role="status">{notice}</div>}
 <button disabled={busy||(mode==='reset'&&!recoveryReady)} className="btn btn-primary wide auth-submit" type="submit">{busy?t('processing'):mode==='login'?t('login'):mode==='register'?t('register'):mode==='forgot'?t('sendReset'):t('setPassword')} <ArrowRight size={17}/></button>
 </form>{mode==='reset'&&!recoveryReady&&<p className="portal-help">正在验证密码重置链接。如果一直无法验证，请重新发送邮件。</p>}
 <div className="auth-switch">{mode==='login'?t('noAccount'):mode==='register'?t('haveAccount'):t('backLogin')} <button type="button" onClick={()=>select(mode==='login'?'register':'login')}>{mode==='login'?t('joinNow'):mode==='register'?t('loginNow'):t('backLogin')}</button></div><p className="auth-footnote">{t('authFoot')}</p><div className="auth-demo-links"><a href="/preview/frontend">{t('previewFrontend')}</a><a href="/preview/backend">{t('previewBackend')}</a></div></div></main></div>;
}
