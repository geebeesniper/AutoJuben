import {useCallback,useEffect,useState} from 'react';
import {Activity,AlertCircle,ArchiveRestore,BookOpen,CheckCircle2,Clock3,CloudCog,Download,FileDown,
  HardDrive,KeyRound,Play,RefreshCw,RotateCcw,Server,ShieldCheck,Square,Terminal,Upload,Users,Workflow} from 'lucide-react';
import {authRequest,formatDate,gql,type Org} from '../lib/api';
import './launcher.css';

type ComponentState={name:string|null;state:string;health:string;running:boolean;configured:boolean;error:string|null};
type Status={backend:ComponentState;frontend:ComponentState;currentVersion:string;environment:string;channel:string;managed:boolean};
type Update={currentVersion:string;latestVersion:string|null;available:boolean;channel:string;notes:string;deploymentState:string|null;desiredVersion:string|null};
type Release={id:string;version:string;channel:string;notes:string;createdAt:string};
type Backup={id:string;name:string;bytes:number;projectCount:number;assetCount:number;jobCount:number;checksum:string;createdAt:string};
type Activation={id:string;label:string;role:string;expiresAt:string;uses:number;maxUses:number;revoked:boolean;createdAt:string};
type Event={id:string;category:string;action:string;status:string;detail:string;actorName:string|null;createdAt:string};
type Data={status:Status;update:Update;releases:Release[];backups:Backup[];activations:Activation[];events:Event[]};
type Tab='services'|'updates'|'backups'|'licenses'|'logs'|'deployment';
const baseQuery=`query($orgId:ID!){
  status:launcherStatus(orgId:$orgId){managed currentVersion environment channel backend{name state health running configured error} frontend{name state health running configured error}}
  update:launcherCheckUpdates(orgId:$orgId){currentVersion latestVersion available channel notes deploymentState desiredVersion}
  releases:launcherReleases(orgId:$orgId){id version channel notes createdAt}
}`;
const adminQuery=`query($orgId:ID!){
  backups:launcherBackups(orgId:$orgId){id name bytes assetCount projectCount jobCount checksum createdAt}
  activations:launcherActivationCodes(orgId:$orgId){id label role expiresAt uses maxUses revoked createdAt}
  events:launcherEvents(orgId:$orgId,limit:120){id category action status detail actorName createdAt}
}`;
const formatBytes=(b:number)=>b>1024**2?`${(b/1024**2).toFixed(1)} MB`:`${Math.round(b/1024)} KB`;
function StateTag({c}:{c:ComponentState}) {
  if(['request_served','deployed'].includes(c.state))return <span className="ops-tag on">云端托管</span>;
  const ok=c.running&&(!c.health||['healthy','running'].includes(c.health));
  return <span className={`ops-tag ${!c.configured?'unconfigured':ok?'on':c.running?'warn':'off'}`}>{!c.configured?'未配置':ok?'运行中':c.running?'健康状态待确认':'未运行'}</span>;
}
const tabs:{id:Tab;label:string;icon:React.ReactNode}[]=[
  {id:'services',label:'服务控制',icon:<Server size={16}/>},
  {id:'updates',label:'更新中心',icon:<RefreshCw size={16}/>},
  {id:'backups',label:'数据库备份',icon:<HardDrive size={16}/>},
  {id:'licenses',label:'许可证',icon:<KeyRound size={16}/>},
  {id:'logs',label:'运行日志',icon:<Terminal size={16}/>},
  {id:'deployment',label:'部署设置',icon:<CloudCog size={16}/>}
];
export function LauncherPage({org,onNotify}:{org:Org;onNotify:(s:string,ok?:boolean)=>void}) {
  const admin=['owner','admin'].includes(org.role),owner=org.role==='owner';
  const [data,setData]=useState<Data|null>(null),[tab,setTab]=useState<Tab>('services');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[issueCode,setIssueCode]=useState('');
  const [env,setEnv]=useState('prod'),[channel,setChannel]=useState('stable'),[name,setName]=useState('手动备份');
  const [activeLabel,setActiveLabel]=useState('新用户邀请'),[activeRole,setActiveRole]=useState('editor');
  const [days,setDays]=useState(14),[uses,setUses]=useState(1),[redeem,setRedeem]=useState('');
  const [releaseVersion,setReleaseVersion]=useState(''),[releaseNotes,setReleaseNotes]=useState(''),[actualVersion,setActualVersion]=useState('');
  const [serviceLogs,setServiceLogs]=useState<string[]>([]),[logsFor,setLogsFor]=useState<'backend'|'frontend'>('backend');
  const [message,setMessage]=useState('');
  const refresh=useCallback(async(quiet=false)=>{
    if(!quiet)setLoading(true);
    try {
      const publicData=await gql<Pick<Data,'status'|'update'|'releases'>>(baseQuery,{orgId:org.id});
      const management=admin?await gql<Pick<Data,'backups'|'activations'|'events'>>(adminQuery,{orgId:org.id}):{backups:[],activations:[],events:[]};
      setData({...publicData,...management});
      setEnv(publicData.status.environment);setChannel(publicData.status.channel);
      setMessage('');
    }catch(e){if(!quiet)setMessage(e instanceof Error?e.message:'服务中心读取失败');}
    finally{if(!quiet)setLoading(false);}
  },[org.id,admin]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh(true);},20_000);return()=>clearInterval(timer);},[refresh]);
  async function run<T>(key:string,operation:()=>Promise<T>,done:string,after?:(_:T)=>void){
    setBusy(key);try{const result=await operation();after?.(result);onNotify(done,true);await refresh(true);}
    catch(e){onNotify(e instanceof Error?e.message:'操作失败');}
    finally{setBusy('');}
  }
  const mutate=<T,>(q:string,args:Record<string,unknown>)=>gql<T>(q,{orgId:org.id,...args});
  function manageService(component:'backend'|'frontend',action:'start'|'stop'|'restart') {
    const label=component==='backend'?'后端':'前端';
    if(action==='stop'&&!window.confirm(`确定停止 ${label} 服务吗？可能会导致正在使用的用户断开连接。`))return;
    void run(`${component}.${action}`,()=>mutate(`mutation($orgId:ID!,$component:String!,$action:String!){launcherServiceAction(orgId:$orgId,component:$component,action:$action){name state health running configured error}}`,{component,action}),`${label}已发送 ${action} 操作`);
  }
  function manageAll(action:'start'|'stop'){
    if(!window.confirm(`确定${action==='start'?'启动':'停止'}前端和后端服务？`))return;
    void run(`all.${action}`,()=>mutate(`mutation($orgId:ID!,$action:String!){launcherAllAction(orgId:$orgId,action:$action){currentVersion}}`,{action}),
      `前端和后端已${action==='start'?'启动':'停止'}`);
  }
  function backupNow() {void run('backup',()=>mutate<{launcherCreateBackup:Backup}>(`mutation($orgId:ID!,$name:String!){launcherCreateBackup(orgId:$orgId,name:$name){id name bytes assetCount projectCount jobCount checksum createdAt}}`,{name}), '备份已写入 Supabase 私有 Storage');}
  function restore(b:Backup){
    const confirm=window.prompt(`确认恢复备份 ${b.name}？恢复前将自动备份当前数据。\n请输入：RESTORE ${b.id}`);
    if(!confirm)return;
    void run(`restore-${b.id}`,()=>mutate(`mutation($orgId:ID!,$backupId:ID!,$confirmation:String!){launcherRestoreBackup(orgId:$orgId,backupId:$backupId,confirmation:$confirmation){safetyBackupId jobs projects assets}}`,{backupId:b.id,confirmation:confirm}),'数据已恢复，并保留了恢复前快照');
  }
  function savePrefs(){void run('preferences',()=>mutate(`mutation($orgId:ID!,$environment:String!,$channel:String!){launcherSavePreferences(orgId:$orgId,environment:$environment,channel:$channel)}`,{environment:env,channel}),'运行偏好已保存');}
  function issueActivation(){void run('issue',()=>mutate<{launcherIssueActivation:{code:string}}>(`mutation($orgId:ID!,$label:String!,$role:String!,$expiresDays:Int!,$maxUses:Int!){launcherIssueActivation(orgId:$orgId,label:$label,role:$role,expiresDays:$expiresDays,maxUses:$maxUses){code}}`,{label:activeLabel,role:activeRole,expiresDays:days,maxUses:uses}), '新激活码已签发（仅显示一次）',r=>setIssueCode(r.launcherIssueActivation.code));}
  function redeemCode(){void run('redeem',()=>gql(`mutation($code:String!){launcherRedeemActivation(code:$code){orgId role}}`,{code:redeem.trim()}),'激活成功，已加入工作区',()=>{void authRequest('me').then(()=>window.location.reload());});}
  function loadLogs(comp:'backend'|'frontend') {setLogsFor(comp);void run('logs',async()=>{
    const result=await mutate<{launcherContainerLogs:string[]}>(`query($orgId:ID!,$component:String!,$lines:Int!){launcherContainerLogs(orgId:$orgId,component:$component,lines:$lines)}`,{component:comp,lines:200});
    setServiceLogs(result.launcherContainerLogs);return result;},'服务日志已刷新');}
  return <div className="ops-root">
    <div className="page-heading"><div><div className="section-kicker">AUTOJUBEN LAUNCHER → CLOUD</div><h1>运行与部署中心</h1><p>迁移原 Windows 启动器管理能力：部署状态、版本记录、云端备份、许可证与诊断。</p></div>
      <button className="btn btn-ghost" onClick={()=>void refresh()} disabled={loading||!!busy}><RefreshCw size={16}/> 刷新状态</button></div>
    <div className="ops-disclaimer"><AlertCircle size={18}/><span>这里管理的是 <b>SaaS 服务和租户</b>，不再操作用户电脑的 8000/3000 端口。Vercel 静态页面和 Functions 不允许按租户手动启动或停止；版本发布与回滚需在 Vercel 控制台执行。</span></div>
    <div className="ops-tabs">{tabs.filter(t=>admin||!['backups','logs','deployment'].includes(t.id)).map(t=><button key={t.id} className={tab===t.id?'selected':''} onClick={()=>setTab(t.id)}>{t.icon}{t.label}</button>)}</div>
    {loading&&<div className="ops-panel ops-empty"><Activity size={23} className="spin"/> 正在读取运行状态...</div>}
    {message&&<div className="notice danger"><AlertCircle size={17}/>{message}<button onClick={()=>void refresh()}>重试</button></div>}
    {!loading&&data&&<>
      {tab==='services'&&<>
        <div className="ops-stats"><div><span>部署版本</span><b>v{data.status.currentVersion}</b></div><div><span>当前环境</span><b>{data.status.environment==='dev'?'开发 Dev':'正式 Prod'}</b></div><div><span>更新通道</span><b>{data.status.channel.toUpperCase()}</b></div><div><span>控制方式</span><b>Vercel 托管</b></div></div>
        {admin&&<div className="ops-all-actions"><span>服务控制由 Vercel 托管</span><button className="btn btn-primary" disabled={!!busy||!data.status.managed||!data.status.backend.configured||!data.status.frontend.configured} onClick={()=>manageAll('start')}><Play size={14}/> 全部启动</button><button className="btn btn-ghost" disabled={!!busy||!data.status.managed||!data.status.backend.configured||!data.status.frontend.configured} onClick={()=>manageAll('stop')}><Square size={14}/> 全部停止</button><button className="btn btn-ghost" onClick={()=>{void navigator.clipboard.writeText(window.location.origin);onNotify('云端访问地址已复制',true);}}>复制访问链接</button></div>}
        <div className="ops-cards">{(['backend','frontend'] as const).map(comp=>{const c=data.status[comp];return <div className="ops-panel ops-service" key={comp}>
          <div className="ops-service-top"><span className="ops-round"><Server size={19}/></span><div><h2>{comp==='backend'?'后端服务':'前端服务'}</h2><p>{comp==='backend'?'Backend API':'Frontend Web'} · Vercel 托管</p></div><StateTag c={c}/></div>
          <div className="ops-stat-row"><span>部署组件</span><code>{c.name??'未配置'}</code></div><div className="ops-stat-row"><span>运行状态</span><b>{c.state}</b></div><div className="ops-stat-row"><span>健康状态</span><b>{c.health}</b></div>
          {c.error&&<div className="ops-inline-error">{c.error}</div>}
          <div className="ops-actions"><button className="btn btn-primary" disabled={!admin||!c.configured||!data.status.managed||!!busy} onClick={()=>manageService(comp,'start')}><Play size={14}/> 启动</button><button className="btn btn-ghost" disabled={!admin||!c.configured||!data.status.managed||!!busy} onClick={()=>manageService(comp,'stop')}><Square size={13}/> 停止</button><button className="btn btn-ghost" disabled={!admin||!c.configured||!data.status.managed||!!busy} onClick={()=>manageService(comp,'restart')}><RotateCcw size={14}/> 重启</button></div>
        </div>;})}</div>
        <div className="ops-panel ops-padding"><h2><Workflow size={18}/> SaaS 化的服务流程</h2><p className="ops-muted">原 EXE 负责本地安装、启动和杀端口；Vercel 不运行常驻进程。前端通过 CDN 发布，GraphQL 由按请求运行的 Function 执行，服务启停由云平台托管。请使用 Vercel Deployments 和 Logs 管理运行版本。</p></div>
      </>}
      {tab==='updates'&&<><div className="ops-panel ops-padding">
        <h2><RefreshCw size={19}/> 版本更新</h2><div className="ops-update-grid"><div><span>当前部署版本</span><b>v{data.update.currentVersion}</b></div><div><span>可用版本</span><b>{data.update.latestVersion?`v${data.update.latestVersion}`:'尚未发布'}</b></div><div><span>部署状态</span><b>{data.update.deploymentState??'idle'}</b></div></div>
        {data.update.desiredVersion&&<p className="ops-muted">待核实版本：{data.update.desiredVersion}</p>}
        {data.update.available?<div className="ops-update-call"><CheckCircle2 size={19}/> 有新的可用版本 <b>v{data.update.latestVersion}</b>{owner&&<button className="btn btn-primary" disabled={!!busy} onClick={()=>{if(window.confirm('确认向部署执行器提交版本更新？该操作会影响真实服务。'))void run('install',()=>mutate(`mutation($orgId:ID!,$version:String!){launcherInstallRelease(orgId:$orgId,version:$version){currentVersion deploymentState}}`,{version:data.update.latestVersion}),'版本部署已确认');}}>立即更新</button>}</div>:<p className="ops-muted">当前通道没有更高版本。真实版本由平台运维发布。</p>}
        <div className="ops-form-grid"><label>环境<select value={env} onChange={e=>setEnv(e.target.value)} disabled={!admin}><option value="prod">正式环境 (Prod)</option><option value="dev">开发环境 (Dev)</option></select></label>
        <label>更新通道<select value={channel} onChange={e=>setChannel(e.target.value)} disabled={!admin}><option value="stable">稳定版 Stable</option><option value="beta">测试版 Beta</option><option value="gray">灰度测试 Gray</option></select></label></div>
        {admin&&<button className="btn btn-primary" disabled={!!busy} onClick={savePrefs}>保存设置</button>}
      </div><div className="ops-panel ops-padding"><h2>发布版本记录</h2>{data.releases.length===0?<p className="ops-muted">暂无发布记录，不能执行真实更新。</p>:data.releases.map(r=><div className="ops-listrow" key={r.id}><b>v{r.version}</b><span>{r.channel}</span><small>{formatDate(r.createdAt)}</small><p>{r.notes||'未提供更新说明'}</p></div>)}</div></>}
      {tab==='backups'&&admin&&<><div className="ops-panel ops-padding"><h2><HardDrive size={18}/> 创建工作区备份</h2><p className="ops-muted">备份工作区项目、任务及媒体文件，数据库快照和媒体副本均保存在 Supabase 私有 Storage。单次最多 60 个素材、5000 个任务；大型备份请使用 Supabase 专业备份方案。不会备份密码或视频服务卡密。</p>
        <div className="ops-inline-form"><input value={name} maxLength={100} onChange={e=>setName(e.target.value)} aria-label="备份名称" placeholder="备份名称"/><button className="btn btn-primary" disabled={!!busy||!name.trim()} onClick={backupNow}><HardDrive size={16}/> 立即备份</button></div></div>
        <div className="ops-panel ops-padding"><h2><ArchiveRestore size={18}/> 历史备份</h2>{data.backups.length===0?<p className="ops-muted">当前没有备份。</p>:data.backups.map(b=><div className="ops-listrow ops-backup" key={b.id}><div className="ops-backup-main"><b>{b.name}</b><small>{formatDate(b.createdAt)} · {formatBytes(b.bytes)} · {b.projectCount} 项目 · {b.jobCount} 任务 · {b.assetCount} 素材</small></div>
          <a className="btn btn-ghost" href={`/api/launcher/backups/${b.id}/manifest?orgId=${encodeURIComponent(org.id)}`}><FileDown size={14}/> 元数据</a>
          {owner&&<button className="btn btn-outline-danger" disabled={!!busy} onClick={()=>restore(b)}><ArchiveRestore size={15}/> 恢复</button>}
        </div>)}<p className="ops-muted">元数据下载不含二进制素材。完整备份/恢复使用 Supabase Storage 私有 bucket 中的媒体副本；恢复前创建安全快照，存在活动任务时禁止恢复。</p></div>
      </>}
      {tab==='licenses'&&<>
        <div className="ops-panel ops-padding"><h2><KeyRound size={18}/> 使用激活码加入工作区</h2><p className="ops-muted">原版许可证是设备绑定的本地授权；云端使用独立的新邀请激活码，不兼容旧程序卡密。</p><div className="ops-inline-form"><input value={redeem} onChange={e=>setRedeem(e.target.value)} placeholder="AJ-XXXXXXXX-XXXXXXXX-..." aria-label="SaaS 工作区激活码"/><button className="btn btn-primary" disabled={!!busy||!redeem.trim()} onClick={redeemCode}>激活并加入</button></div></div>
        {admin&&<><div className="ops-panel ops-padding"><h2><Users size={18}/> 签发工作区激活码</h2><div className="ops-form-grid"><label>名称<input value={activeLabel} onChange={e=>setActiveLabel(e.target.value)} maxLength={100}/></label><label>加入后角色<select value={activeRole} onChange={e=>setActiveRole(e.target.value)}><option value="editor">编辑者</option><option value="viewer">查看者</option><option value="admin">管理员</option></select></label><label>有效期（天）<input type="number" min={1} max={365} value={days} onChange={e=>setDays(Number(e.target.value))}/></label><label>允许激活次数<input type="number" min={1} max={100} value={uses} onChange={e=>setUses(Number(e.target.value))}/></label></div>
          <button className="btn btn-primary" disabled={!!busy} onClick={issueActivation}><KeyRound size={16}/> 签发新激活码</button>
          {issueCode&&<div className="ops-code"><b>新激活码（只会显示这一次）</b><code>{issueCode}</code><button className="btn btn-ghost" onClick={()=>void navigator.clipboard.writeText(issueCode)}>复制激活码</button></div>}
        </div><div className="ops-panel ops-padding"><h2>已经签发的激活码</h2>{data.activations.length===0?<p className="ops-muted">暂无激活码。</p>:data.activations.map(a=><div className="ops-listrow ops-backup" key={a.id}><div className="ops-backup-main"><b>{a.label} <span className="ops-mini">{a.role}</span></b><small>已用 {a.uses}/{a.maxUses} · 截止 {formatDate(a.expiresAt)} · {a.revoked?'已撤销':'正常'}</small></div><button className="btn btn-outline-danger" disabled={a.revoked||!!busy} onClick={()=>{if(window.confirm('确定撤销这个激活码？'))void run('revoke',()=>mutate(`mutation($orgId:ID!,$activationId:ID!){launcherRevokeActivation(orgId:$orgId,activationId:$activationId)}`,{activationId:a.id}),'激活码已撤销');}}>撤销</button></div>)}</div></>}
      </>}
      {tab==='logs'&&admin&&<><div className="ops-panel ops-padding"><div className="ops-title-actions"><h2><Terminal size={18}/> 操作记录与诊断</h2><a className="btn btn-ghost" href={`/api/launcher/diagnostics?orgId=${encodeURIComponent(org.id)}`}><Download size={15}/> 导出诊断包</a></div><p className="ops-muted">操作事件写入数据库，按工作区隔离；部署/函数的实时日志请到 Vercel → Logs 查看；此处保留按工作区隔离的业务审计记录。</p>
        <div className="ops-log-list">{data.events.length===0?<div className="ops-muted">暂无日志</div>:data.events.map(ev=><div key={ev.id}><span>{formatDate(ev.createdAt)}</span> <b>{ev.category}.{ev.action}</b> <span className={ev.status==='failed'?'ops-red':''}>{ev.status}</span><small>{ev.detail}</small></div>)}</div></div>
        <div className="ops-panel ops-padding"><div className="ops-title-actions"><h2>Vercel 运行日志入口</h2><div className="ops-actions"><button className="btn btn-ghost" disabled={!!busy} onClick={()=>loadLogs('backend')}>后端</button><button className="btn btn-ghost" disabled={!!busy} onClick={()=>loadLogs('frontend')}>前端</button></div></div><p className="ops-muted">当前选择：{logsFor==='backend'?'后端':'前端'} · 最多 200 行</p><pre className="ops-terminal">{serviceLogs.length?serviceLogs.join('\n'):'真正的云函数日志需要从 Vercel 控制台查看。'}</pre></div>
      </>}
      {tab==='deployment'&&admin&&<div className="ops-panel ops-padding"><h2><CloudCog size={18}/> Vercel / Supabase 部署管理</h2><p className="ops-muted">Vercel + Supabase 无容器绑定：通过 Vercel Git 集成进行部署/回滚，在 Vercel Settings 配置环境变量，在 Supabase Dashboard 管理数据库和 Storage。此页保留原 EXE 的发布记录兼容性。</p>
        
        
        <div className="ops-separator"/><h2><Upload size={18}/> 平台发布新版本</h2><p className="ops-muted">版本记录只显示应用元数据。真实上线应在 Vercel 通过 Git 部署；如要启用自动更新，必须单独配置经过授权、能验证完成状态的 DEPLOY_WEBHOOK_URL。</p><div className="ops-form-grid"><label>版本号<input value={releaseVersion} onChange={e=>setReleaseVersion(e.target.value)} placeholder="0.3.1"/></label><label>发布通道<select value={channel} onChange={e=>setChannel(e.target.value)}><option value="stable">稳定版</option><option value="beta">测试版</option><option value="gray">灰度版</option></select></label></div>
        <label className="ops-full-label">发布说明<textarea rows={4} value={releaseNotes} maxLength={10000} onChange={e=>setReleaseNotes(e.target.value)}/></label>
        {owner&&<button className="btn btn-primary" disabled={!!busy||!releaseVersion} onClick={()=>void run('publish',()=>mutate(`mutation($orgId:ID!,$version:String!,$channel:String!,$notes:String!){launcherPublishRelease(orgId:$orgId,version:$version,channel:$channel,notes:$notes){id version}}`,{version:releaseVersion,channel,notes:releaseNotes}),'新版本已发布至此工作区')}>发布版本记录</button>}
        <div className="ops-separator"/><h2>人工核实部署结果</h2><p className="ops-muted">若执行器超时或结果不明确，先在真实部署平台确认实际版本，再输入该版本解除阻塞。只有平台运维管理员可以执行。</p>
        <div className="ops-inline-form"><input value={actualVersion} onChange={e=>setActualVersion(e.target.value)} placeholder="当前实际版本，例如 0.2.0"/>
        {owner&&<button className="btn btn-ghost" disabled={!!busy||!actualVersion.trim()} onClick={()=>{if(window.confirm('已经通过运维平台确认当前实际部署版本了吗？'))void run('reconcileDeployment',()=>mutate(`mutation($orgId:ID!,$actualVersion:String!){launcherConfirmDeployment(orgId:$orgId,actualVersion:$actualVersion){currentVersion deploymentState}}`,{actualVersion}),'已核实真实部署版本');}}>确认实际版本</button>}</div>
      </div>}
      <p className="ops-end-note"><ShieldCheck size={14}/> 所有操作均通过 TypeScript / GraphQL 后端鉴权，按工作区隔离；不会执行上传的任意脚本或远程 EXE。</p>
    </>}
  </div>;
}
