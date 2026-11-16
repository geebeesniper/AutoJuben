import { useEffect,useState } from 'react';
import { Activity,ArrowUpRight,CheckCircle2,ChevronDown,Clapperboard,Cloud,FolderKanban,LayoutDashboard,ListVideo,LogOut,Menu,Plus,RefreshCw,Settings,Sparkles,Users,X,Download,Clock3,CircleAlert,ServerCog,History,CreditCard,Receipt,ShoppingBag,UserRound,UsersRound,Landmark,CloudCog,MessageSquareText,BookOpen,ScanSearch,ShieldUser } from 'lucide-react';
import { AuthPage } from './pages/Auth';
import {DemoPreview} from './pages/DemoPreview';
import {VideoCreationPreview} from './pages/VideoCreationPreview';
import {LanguageProvider,LanguageSelect,useI18n} from './i18n';
import { DashboardPage } from './pages/Dashboard';
import { Studio } from './pages/Studio';
import { ProjectsPage } from './pages/Projects';
import { TeamPage } from './pages/Team';
import { SettingsPage } from './pages/Settings';
import { LauncherPage } from './pages/Launcher';
import { PortalPage } from './pages/Portal';
import { AdminPage } from './pages/Admin';
import { JobTable } from './components/JobTable';
import { Status } from './components/Status';
import { authRequest,formatDate,getWork,gql,type AppData,type Org,type User,type VideoJob } from './lib/api';
import './pages/portal.css';
type Screen='overview'|'studio'|'projects'|'jobs'|'team'|'settings'|'launcher'|'account'|'history'|'billing'|'purchases'|'shop'|'adminUsers'|'adminOrders'|'adminPayments'|'adminApi'|'adminStaff'|'adminLedger'|'adminInvestigations'|'adminInbox';
type Section='workspace'|'customer'|'manage'|'platform';
const nav:{id:Screen;label:string;icon:React.ReactNode;section:Section}[]=[
  {id:'overview',label:'概览面板',icon:<LayoutDashboard size={19}/>,section:'workspace'},
  {id:'studio',label:'视频创作台',icon:<Sparkles size={19}/>,section:'workspace'},
  {id:'projects',label:'我的项目',icon:<FolderKanban size={19}/>,section:'workspace'},
  {id:'jobs',label:'生成任务',icon:<ListVideo size={19}/>,section:'workspace'},
  {id:'shop',label:'购买积分',icon:<ShoppingBag size={19}/>,section:'customer'},
  {id:'billing',label:'信用卡管理',icon:<CreditCard size={19}/>,section:'customer'},
  {id:'purchases',label:'购买记录',icon:<Receipt size={19}/>,section:'customer'},
  {id:'history',label:'历史活动',icon:<History size={19}/>,section:'customer'},
  {id:'account',label:'我的账户',icon:<UserRound size={19}/>,section:'customer'},
  {id:'launcher',label:'运行与部署',icon:<ServerCog size={19}/>,section:'manage'},
  {id:'team',label:'团队成员',icon:<Users size={19}/>,section:'manage'},
  {id:'settings',label:'工作区 API',icon:<Settings size={19}/>,section:'manage'},
  {id:'adminUsers',label:'用户管理',icon:<UsersRound size={19}/>,section:'platform'},
  {id:'adminStaff',label:'管理员团队',icon:<ShieldUser size={19}/>,section:'platform'},
  {id:'adminLedger',label:'账目流水',icon:<BookOpen size={19}/>,section:'platform'},
  {id:'adminInvestigations',label:'大数据排查',icon:<ScanSearch size={19}/>,section:'platform'},
  {id:'adminInbox',label:'消息中心',icon:<MessageSquareText size={19}/>,section:'platform'},
  {id:'adminOrders',label:'交易记录',icon:<Receipt size={19}/>,section:'platform'},
  {id:'adminPayments',label:'支付网关',icon:<Landmark size={19}/>,section:'platform'},
  {id:'adminApi',label:'平台 API 设置',icon:<CloudCog size={19}/>,section:'platform'}
];
const portalScreens=['account','history','billing','purchases','shop'] as const;
const adminScreens=['adminUsers','adminStaff','adminLedger','adminInvestigations','adminInbox','adminOrders','adminPayments','adminApi'] as const;
const adminScreenCapability:Partial<Record<Screen,string>>={adminUsers:'users',adminStaff:'staff',adminLedger:'ledger',adminInvestigations:'investigation',adminInbox:'messaging',adminOrders:'billing',adminPayments:'billing',adminApi:'operations'};
function initialPage():Screen {const tab=new URLSearchParams(window.location.search).get('tab') as Screen;
 return nav.some(x=>x.id===tab)?tab:window.location.pathname==='/admin'?'adminUsers':'overview';}
function JobDetails({j,org,onClose,onResolved,onNotify}:{j:VideoJob;org:Org;onClose:()=>void;onResolved:()=>void;onNotify:(s:string,ok?:boolean)=>void}){
  const [providerTaskId,setProviderTaskId]=useState('');
  const [busy,setBusy]=useState(false);
  async function reconcile(confirmedNotSubmitted:boolean) {
    if(confirmedNotSubmitted&&!window.confirm('只有在确认上游没有受理任务时，才能标记失败。确认继续？'))return;
    setBusy(true);try{await gql(`mutation($orgId:ID!,$id:ID!,$providerTaskId:String,$confirmedNotSubmitted:Boolean){resolveSubmission(orgId:$orgId,id:$id,providerTaskId:$providerTaskId,confirmedNotSubmitted:$confirmedNotSubmitted){id status}}`,{orgId:org.id,id:j.id,providerTaskId:confirmedNotSubmitted?null:providerTaskId,confirmedNotSubmitted});onNotify('任务状态已人工核实',true);onResolved();}catch(e){onNotify(e instanceof Error?e.message:'核实失败');}finally{setBusy(false);}
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal job-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><div className="section-kicker">VIDEO JOB / {j.id.slice(0,8)}</div><h2>任务详情</h2></div><button className="icon-btn" onClick={onClose} aria-label="关闭"><X size={21}/></button></div>
    <div className="job-modal-row"><Status value={j.status}/><span>{formatDate(j.createdAt)}</span></div>
    <div className="job-progress"><div style={{width:`${j.progress}%`}}/></div><p className="small-note">生成进度 {j.progress}% · {j.model} · {j.resolution} · {j.duration} 秒</p>
    <h3>视频描述</h3><p className="prompt-detail">{j.prompt}</p>
    <div className="job-properties"><div><small>任务编号</small><code>{j.id}</code></div><div><small>上游任务编号</small><code>{j.providerTaskId??'等待提交'}</code></div><div><small>费用积分</small><b>{j.requiredCredits??'未获取'}</b></div><div><small>计费状态</small><b>{j.billingStatus??'—'}</b></div></div>
    {j.errorMessage&&<div className={`notice ${j.status==='failed'||j.status==='submission_unknown'?'danger':'warning'} inline`}><CircleAlert size={18}/><span>{j.errorMessage}</span></div>}
    {j.videoUrl?<div className="video-result"><h3>生成的视频</h3><video src={j.videoUrl} controls preload="metadata"/><a className="btn btn-primary" href={j.videoUrl} target="_blank" rel="noopener noreferrer"><Download size={16}/> 打开 / 下载视频 <ArrowUpRight size={15}/></a></div>:j.status==='success'&&j.isDemo?<div className="demo-tip">这是模拟任务，未调用真实模型，因此不包含 MP4 文件。</div>:null}
    {j.status==='submission_unknown'&&<><p className="small-note">为了避免重复计费，此状态不会自动重新提交。请联系服务商确认对应 client_task_id：{j.clientTaskId}</p>{['owner','admin'].includes(org.role)&&<div className="reconcile-box"><b>管理员人工核实</b><p>如果找到上游 task_id，可以恢复轮询；如果明确确认未受理，可标记失败并释放本系统的活动任务配额（不会修改上游积分）。</p><input value={providerTaskId} onChange={e=>setProviderTaskId(e.target.value)} placeholder="上游 provider task_id"/><div className="reconcile-actions"><button disabled={busy||providerTaskId.trim().length<5} className="btn btn-primary" onClick={()=>void reconcile(false)}>继续查询任务</button><button disabled={busy} className="btn btn-ghost" onClick={()=>void reconcile(true)}>确认未受理</button></div></div>}</>}
  </div></div>;
}
function MainApp() {
  const {t}=useI18n();
  const [user,setUser]=useState<User|null>(null);const [orgs,setOrgs]=useState<Org[]>([]);const [orgId,setOrgId]=useState('');
  const [page,setPage]=useState<Screen>(initialPage);const [data,setData]=useState<AppData|null>(null);const [booting,setBooting]=useState(true);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [toast,setToast]=useState<{text:string;ok:boolean}|null>(null);
  const [platformAdmin,setPlatformAdmin]=useState(false);
  const [adminCapabilities,setAdminCapabilities]=useState<string[]>([]);
  const [openJob,setOpenJob]=useState<VideoJob|null>(null);const [mobile,setMobile]=useState(false);const [demo,setDemo]=useState<boolean|null>(null);
  const org=orgs.find(o=>o.id===orgId)??orgs[0]??null;
  const notify=(text:string,ok=false)=>setToast({text,ok});
  useEffect(()=>{authRequest('me').then(r=>{setUser(r.user);setOrgs(r.organizations);setOrgId(r.organizations[0]?.id??'');if(r.user)void gql<{viewerCapabilities:{platformAdmin:boolean;adminCapabilities:string[]}}>('query{viewerCapabilities{platformAdmin adminCapabilities}}').then(x=>{setPlatformAdmin(x.viewerCapabilities.platformAdmin);setAdminCapabilities(x.viewerCapabilities.adminCapabilities);}).catch(()=>{setPlatformAdmin(false);setAdminCapabilities([]);});}).catch(()=>{}).finally(()=>setBooting(false));
    fetch('/healthz').then(r=>r.json()).then(r=>setDemo(r.mode==='demo')).catch(()=>{});
  },[]);
  async function refresh(silent=false){if(!orgId)return;if(!silent)setLoading(true);try{const fresh=await getWork(orgId);setData(fresh);setError('');}catch(e){if(!silent)setError(e instanceof Error?e.message:'读取失败');}finally{if(!silent)setLoading(false);}}
  useEffect(()=>{if(!user||!orgId)return;setData(null);void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh(true);},8_000);return()=>clearInterval(timer);},[user?.id,orgId]);
  function onAuth(u:User,list:Org[]){setUser(u);setOrgs(list);setOrgId(list[0]?.id??'');setPage(initialPage());void gql<{viewerCapabilities:{platformAdmin:boolean}}>('query{viewerCapabilities{platformAdmin}}').then(x=>setPlatformAdmin(x.viewerCapabilities.platformAdmin)).catch(()=>{});}
  async function logout(){try{await authRequest('logout',{});}finally{setUser(null);setData(null);setOrgId('');setOrgs([]);setPlatformAdmin(false);setAdminCapabilities([]);}}
  async function addOrg(){const name=window.prompt('请输入新工作区名称：');if(!name?.trim())return;try{const r=await gql<{createOrganization:Org}>(`mutation($name:String!){createOrganization(name:$name){id name slug role createdAt}}`,{name});setOrgs(prev=>[...prev,r.createOrganization]);setOrgId(r.createOrganization.id);setPage('overview');notify('工作区已建立',true);}catch(e){notify(e instanceof Error?e.message:'创建工作区失败');}}
  function navigate(p:string){setPage(p as Screen);setMobile(false);window.history.replaceState({},'',`${adminScreens.includes(p as typeof adminScreens[number])?'/admin':'/app'}?tab=${p}`);window.scrollTo({top:0,behavior:'smooth'});}
  if(booting)return <div className="boot-screen"><span className="logo-mark"><Clapperboard size={26}/></span><p>AutoJuben Cloud · {t('loading')}</p></div>;
  if(!user||new URLSearchParams(window.location.search).get('auth')==='reset'||window.location.hash.includes('type=recovery'))return <AuthPage onAuth={onAuth}/>;
  return <div className="app-shell"><aside className={`sidebar ${mobile?'show':''}`}><div className="sidebar-brand"><span className="logo-mark"><Clapperboard size={24}/></span><div><b>AUTOJUBEN</b><small>CREATIVE CLOUD</small></div><button className="mobile-close" onClick={()=>setMobile(false)}><X size={20}/></button></div>
    <div className="workspace-picker"><span>{t('currentWorkspace')}</span><div className="workspace-picker-row"><div className="workspace-square">{org?.name?.slice(0,1).toUpperCase()??'A'}</div><select value={org?.id??''} onChange={e=>setOrgId(e.target.value)} aria-label="切换工作区">{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><ChevronDown size={14}/></div></div>
    <div className="nav-scroll">{(['workspace','customer','manage','platform'] as Section[]).filter(section=>section!=='platform'||platformAdmin).map(section=><div key={section}>
        <div className="nav-label manage-label">{t(({workspace:'workspace',customer:'customerArea',manage:'management',platform:'platformArea'} as const)[section])}</div>
        {nav.filter(n=>n.section===section).filter(n=>n.section!=='manage'||['owner','admin'].includes(org?.role??'')).filter(n=>n.section!=='platform'||adminCapabilities.includes(adminScreenCapability[n.id]??'')).map(n=><button key={n.id} className={`nav-link ${page===n.id?'active':''}`} onClick={()=>navigate(n.id)}>{n.icon}<span>{t('nav_'+n.id)}</span>{page===n.id&&<span className="nav-active-dot"/>}</button>)}
      </div>)}
      <button className="nav-link create-workspace" onClick={()=>void addOrg()}><Plus size={18}/><span>{t('createWorkspace')}</span></button>
    </div>
    <div className="sidebar-bottom"><div className="sidebar-info"><span className="sidebar-glow"/><Cloud size={18}/><div><b>Cloud Workspace</b><small>{demo?t('demoEnvironment'):t('online')}</small></div><CheckCircle2 size={16}/></div>
      <div className="sidebar-user"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div className="sidebar-user-details"><b>{user.name}</b><small>{org?.role??'—'}</small></div><button title={t('logout')} onClick={()=>void logout()} className="icon-btn"><LogOut size={18}/></button></div></div>
  </aside>
    {mobile&&<div className="mobile-overlay" onClick={()=>setMobile(false)}/>}
    <main className="app-main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-btn" onClick={()=>setMobile(true)} aria-label="打开菜单"><Menu size={22}/></button><span className="breadcrumb">Workspace</span><span className="slash">/</span><b>{t('nav_'+page)}</b></div><div className="topbar-right"><LanguageSelect compact/>{demo===true&&<span className="demo-badge"><span/> DEMO MODE</span>}<button className="icon-btn refresh-top" title="刷新工作区数据" onClick={()=>void refresh()}><RefreshCw size={18} className={loading?'spin':''}/></button><span className="topbar-divider"/><div className="avatar top-avatar">{user.name.slice(0,1).toUpperCase()}</div></div></header>
    <div className="page-content">{error&&<div className="notice danger"><CircleAlert size={17}/><span>{error}</span><button onClick={()=>void refresh()}>重试</button></div>}
      {org&&(data||portalScreens.some(x=>x===page)||adminScreens.some(x=>x===page))?<>
        {data&&page==='overview'&&<DashboardPage org={org} data={data} onNavigate={navigate} onSelect={setOpenJob}/>}
        {data&&page==='studio'&&<Studio org={org} projects={data.projects} onNotify={notify} onCreated={j=>{notify('视频任务创建成功，后台正在处理',true);void refresh();setOpenJob(j);}}/>}
        {data&&page==='projects'&&<ProjectsPage org={org} projects={data.projects} onNotify={notify} onChanged={()=>void refresh()} onGoStudio={()=>navigate('studio')}/>}
        {data&&page==='jobs'&&<><div className="page-heading"><div><div className="section-kicker">GENERATION QUEUE</div><h1>生成任务</h1><p>实时查看视频制作进度、结果与异常。</p></div><button className="btn btn-primary" onClick={()=>navigate('studio')}><Plus size={16}/> 新建视频</button></div><div className="panel"><JobTable jobs={data.jobs} projects={data.projects} onSelect={setOpenJob}/></div><p className="small-note list-note"><Clock3 size={14}/> 任务列表自动更新；长时间的视频任务由 Supabase Cron 定时触发轮询，不需要一直打开此页面。</p></>}
        {data&&page==='team'&&<TeamPage org={org} members={data.members} currentUserId={user.id} onNotify={notify} onChanged={()=>void refresh()}/>}
        {page==='settings'&&<SettingsPage org={org} onNotify={notify}/>}
        {page==='launcher'&&<LauncherPage org={org} onNotify={notify}/>}
        {portalScreens.some(x=>x===page)&&<PortalPage section={page as typeof portalScreens[number]} org={org} user={user} onUpdate={setUser} onNotify={notify}/>}
        {platformAdmin&&adminScreens.some(x=>x===page)&&adminCapabilities.includes(adminScreenCapability[page]??'')&&<AdminPage section={page as typeof adminScreens[number]} user={user} onNotify={notify}/>}
        {adminScreens.some(x=>x===page)&&(!platformAdmin||!adminCapabilities.includes(adminScreenCapability[page]??''))&&<div className="notice danger">{t('adminPermissionDenied')}</div>}
      </>:!loading&&!error?<div className="loading-panel"><Activity size={30} className="spin"/><p>正在加载你的工作区…</p></div>:null}</div>
    <footer className="app-footer"><span>© AutoJuben Cloud · TypeScript / GraphQL</span><span>{t('workspace')} · v0.6.0</span></footer>
    </main>{openJob&&org&&<JobDetails j={data?.jobs.find(x=>x.id===openJob.id)??openJob} org={org} onClose={()=>setOpenJob(null)} onResolved={()=>void refresh()} onNotify={notify}/>} {toast&&<div className={`toast ${toast.ok?'toast-ok':'toast-err'}`} role="status"><span>{toast.ok?<CheckCircle2 size={17}/>:<CircleAlert size={17}/>}</span>{toast.text}<button onClick={()=>setToast(null)} aria-label="关闭提醒"><X size={15}/></button></div>}
  </div>;
}

export default function App(){
 const path=window.location.pathname;
 const isFrontend=['/preview/frontend','/preview/customer'].includes(path);
 const isBackend=['/preview/backend','/preview/admin'].includes(path);
 return <LanguageProvider>{isFrontend?<VideoCreationPreview/>:isBackend?<DemoPreview view="backend"/>:<MainApp/>}</LanguageProvider>;
}
