import {useMemo,useState} from 'react';
import {Activity,ArrowRight,BarChart3,Bell,BookOpen,CheckCircle2,ChevronRight,Clapperboard,Clock3,CloudCog,CreditCard,Database,Download,Filter,Globe2,KeyRound,LayoutDashboard,Menu,MessageSquareText,RefreshCw,Search,Send,ServerCog,Settings2,ShieldCheck,ShoppingBag,UsersRound,UserRound,WalletCards,X} from 'lucide-react';
import {LanguageSelect,useI18n} from '../i18n';
import {TrendDateFilter,TrendLineCharts,useTrendDates,sampleTrends,type Metric} from '../components/OperationsTrends';
import './demo-preview.css';

type Tab='overview'|'staff'|'users'|'ledger'|'investigations'|'inbox'|'apiHealth'|'settings';
type Role='super_admin'|'operations_manager'|'finance_manager'|'support_lead'|'analyst'|'auditor';
type User={id:string;name:string;email:string;workspace:string;state:string;joined:string;credits:number;orders:number};
type Ledger={id:string;userId:string;name:string;workspace:string;source:string;status:string;amount:number;credits:number;date:string;transaction:string};
type Event={id:string;userId:string;name:string;workspace:string;type:string;severity:string;status:string;summary:string;date:string;requestId:string};
type Staff={id:string;name:string;email:string;role:Role;state:string};
type Thread={id:string;channel:'internal'|'customer';subject:string;person:string;category:string;priority:string;status:string;updated:string;messages:{by:string;text:string;time:string}[]};
const people=['Sofia Martinez','Daniel Park','Ana López','Alex Morgan','Emma Chen','Carlos Rivera','Olivia Reed','Noah Kim','Maya Patel','Liam Chen','Grace Miller','Ethan Brooks'];
const workspaces=['Aurora Studio','Northstar Labs','Echo Films','Motion House','Luma Agency','Creative Works'];
const base=Date.UTC(2026,10,15,16,0);
const date=(n:number)=>new Date(base-n*3600000).toISOString();
const demoUsers:User[]=Array.from({length:240},(_,i)=>({
 id:'DEMO-U-'+String(i+1).padStart(5,'0'),name:people[i%people.length],email:'user'+String(i+1)+'@example.com',workspace:workspaces[i%workspaces.length],
 state:i%19===0?'suspended':i%11===0?'pending':'active',joined:date(i*4+12),
 credits:(i*37)%4200,orders:(i*3)%28
}));
const demoLedger:Ledger[]=Array.from({length:420},(_,i)=>({
 id:'AJ-LD-'+String(420-i).padStart(6,'0'),userId:demoUsers[i%240].id,name:demoUsers[i%240].name,
 workspace:demoUsers[i%240].workspace,source:['credit_purchase','video_generation','refund','manual_adjustment'][i%4],
 status:i%17===0?'failed':i%11===0?'pending':'paid',
 amount:i%4===0?(900+i%7*500):i%4===2?-(900+i%7*300):0,
 credits:i%4===0?100+(i%7)*100:i%4===2?50:-(10+i%6*4),
 date:date(i*2),transaction:'DEMO-TX-'+String(420-i).padStart(6,'0')
}));
const demoEvents:Event[]=Array.from({length:620},(_,i)=>({
 id:'EV-'+String(620-i).padStart(7,'0'),userId:demoUsers[i%240].id,name:demoUsers[i%240].name,
 workspace:demoUsers[i%240].workspace,type:['video','order','api','audit','login'][i%5],
 severity:i%37===0?'critical':i%17===0?'warning':'info',status:i%37===0?'failed':i%17===0?'review':'success',
 summary:['Video generation finished','Credit pack purchased','GraphQL request completed','Membership permission updated','Account session created'][i%5],
 date:date(i),requestId:'REQ-'+String(i*17+1000).padStart(9,'0')
}));
const startingStaff:Staff[]=[
 {id:'A-001',name:'System Owner',email:'owner@example.com',role:'super_admin',state:'active'},
 {id:'A-002',name:'Daniel Park',email:'ops@example.com',role:'operations_manager',state:'active'},
 {id:'A-003',name:'Priya Shah',email:'finance@example.com',role:'finance_manager',state:'active'},
 {id:'A-004',name:'Emma Chen',email:'support@example.com',role:'support_lead',state:'active'},
 {id:'A-005',name:'Liam Chen',email:'analyst@example.com',role:'analyst',state:'active'},
 {id:'A-006',name:'Grace Miller',email:'audit@example.com',role:'auditor',state:'active'}
];
const seedThreads:Thread[]=[
 {id:'CASE-1048',channel:'customer',subject:'Video generation failed at 92%',person:'Sofia Martinez',category:'technical',priority:'high',status:'open',updated:date(1),messages:[{by:'Sofia Martinez',text:'My video task did not complete.',time:'09:10'},{by:'Support Lead',text:'We are reviewing the task trace and credit hold.',time:'09:16'}]},
 {id:'CASE-1047',channel:'customer',subject:'Credit refund verification',person:'Carlos Rivera',category:'billing',priority:'urgent',status:'pending',updated:date(3),messages:[{by:'Finance Manager',text:'Reconciliation case opened. Checking the payment and ledger records.',time:'08:35'}]},
 {id:'CASE-1046',channel:'customer',subject:'Workspace member permissions',person:'Ana López',category:'support',priority:'normal',status:'open',updated:date(7),messages:[{by:'Support Lead',text:'Request received and queued for review.',time:'12:43'}]},
 {id:'CASE-1045',channel:'internal',subject:'Internal incident handoff',person:'Operations Team',category:'internal',priority:'high',status:'resolved',updated:date(15),messages:[{by:'Operations Manager',text:'Investigation report is attached to the incident record.',time:'14:22'}]}
];
const capabilities:Record<Role,string[]>={
 super_admin:['staff','users','ledger','investigations','inbox','apiHealth','settings'],
 operations_manager:['staff','users','ledger','investigations','inbox','apiHealth'],
 finance_manager:['ledger','investigations','inbox'],
 support_lead:['users','investigations','inbox'],
 analyst:['investigations','apiHealth'],
 auditor:['ledger','investigations']
};
const roleNames:Record<Role,string>={super_admin:'adminSuper',operations_manager:'adminOperations',finance_manager:'adminFinance',support_lead:'adminSupport',analyst:'adminAnalyst',auditor:'adminAuditor'};
const labels:Record<Tab,string>={overview:'adminOverview',staff:'adminStaff',users:'users',ledger:'adminLedger',investigations:'adminInvestigations',inbox:'adminInbox',apiHealth:'adminApiDiagnostics',settings:'settings'};
const time=(d:string,locale:string)=>new Date(d).toLocaleString(locale==='zh'?'zh-CN':locale==='es'?'es-ES':'en-US',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const dollar=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount/100);
const saveCsv=(filename:string,headers:string[],rows:(string|number|null)[][])=>{
 const csv=[headers,...rows].map(row=>row.map(value=>{
  const v=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';
 }).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();URL.revokeObjectURL(url);
};

export function DemoPreview({view}:{view:'backend'}){
 const {t,locale}=useI18n();
 const [tab,setTab]=useState<Tab>('overview'),[role,setRole]=useState<Role>('super_admin'),[mobile,setMobile]=useState(false);
 const overviewDates=useTrendDates();
 const overviewTrends=useMemo(()=>sampleTrends(overviewDates.range),[overviewDates.range]);
 const [text,setText]=useState(''),[status,setStatus]=useState(''),[kind,setKind]=useState(''),[workspace,setWorkspace]=useState(''),[from,setFrom]=useState(''),[until,setUntil]=useState(''),[page,setPage]=useState(0);
 const [user,setUser]=useState<User|null>(null),[staff,setStaff]=useState(startingStaff),[selectedStaff,setSelectedStaff]=useState(''),[staffRole,setStaffRole]=useState<Role>('analyst');
 const [threads,setThreads]=useState(seedThreads),[threadChannel,setThreadChannel]=useState<'internal'|'customer'>('internal'),[threadId,setThreadId]=useState(seedThreads[3].id),[message,setMessage]=useState(''),[newThread,setNewThread]=useState(''),[newThreadOpen,setNewThreadOpen]=useState(false);
 const [notice,setNotice]=useState('');
 const roleAllowed=(which:Tab)=>which==='overview'||capabilities[role].includes(which);
 const navigation:{id:Tab;icon:React.ReactNode;group:string}[]=[
  {id:'overview',icon:<LayoutDashboard size={18}/>,group:'adminOverview'},
  {id:'users',icon:<UsersRound size={18}/>,group:'adminOverview'},
  {id:'ledger',icon:<BookOpen size={18}/>,group:'adminFinancialCenter'},
  {id:'investigations',icon:<Filter size={18}/>,group:'adminStatistics'},
  {id:'inbox',icon:<MessageSquareText size={18}/>,group:'adminCollaboration'},
  {id:'staff',icon:<ShieldCheck size={18}/>,group:'adminCollaboration'},
  {id:'apiHealth',icon:<ServerCog size={18}/>,group:'adminStatistics'},
  {id:'settings',icon:<Settings2 size={18}/>,group:'adminStatistics'}
 ];
 const changeTab=(next:Tab)=>{if(!roleAllowed(next))return;setTab(next);setMobile(false);setText('');setStatus('');setKind('');setWorkspace('');setFrom('');setUntil('');setPage(0);setUser(null);setNotice('');};
 const switchRole=(next:Role)=>{setRole(next);if(!capabilities[next].includes(tab))setTab('overview');setPage(0);setNotice('');};
 const matches=(s:string)=>!text||s.toLowerCase().includes(text.toLowerCase());
 const dateMatches=(dt:string)=>(!from||dt.slice(0,10)>=from)&&(!until||dt.slice(0,10)<=until);
 const filteredUsers=useMemo(()=>demoUsers.filter(u=>(!workspace||u.workspace===workspace)&&(!status||u.state===status)&&dateMatches(u.joined)&&matches(u.name+' '+u.email+' '+u.id+' '+u.workspace)),[workspace,status,from,until,text]);
 const filteredLedger=useMemo(()=>demoLedger.filter(x=>(!workspace||x.workspace===workspace)&&(!kind||x.source===kind)&&(!status||x.status===status)&&dateMatches(x.date)&&matches(x.id+' '+x.transaction+' '+x.name+' '+x.userId+' '+x.workspace)),[workspace,kind,status,from,until,text]);
 const filteredEvents=useMemo(()=>demoEvents.filter(x=>(!workspace||x.workspace===workspace)&&(!kind||x.type===kind)&&(!status||x.status===status||x.severity===status)&&dateMatches(x.date)&&matches(x.id+' '+x.requestId+' '+x.name+' '+x.userId+' '+x.summary)),[workspace,kind,status,from,until,text]);
 const list=tab==='users'?filteredUsers:tab==='ledger'?filteredLedger:filteredEvents;
 const count=list.length,perPage=15,offset=page*perPage;
 const selectedThread=threads.find(x=>x.id===threadId&&x.channel===threadChannel);
 const stat=(icon:React.ReactNode,value:string,name:string,delta:string,color:string)=><div className="ep-kpi"><div className="ep-kpi-top"><span className={'ep-kpi-icon '+color}>{icon}</span><span className="ep-kpi-change">{delta}</span></div><b>{value}</b><small>{name}</small></div>;
 const flag=(value:string)=><span className={'ep-tag ep-'+value}>{value}</span>;
 const filterBar=(showType:boolean)=><div className="ep-filter-bar">
  <label className="ep-search"><Search size={15}/><input aria-label={t('adminSearch')} value={text} onChange={e=>{setText(e.target.value);setPage(0);}} placeholder={t('adminSearch')}/></label>
  <select aria-label={t('adminWorkspace')} value={workspace} onChange={e=>{setWorkspace(e.target.value);setPage(0);}}><option value="">{t('adminAll')} · {t('adminWorkspace')}</option>{workspaces.map(w=><option key={w}>{w}</option>)}</select>
  {showType&&<select aria-label={t('adminEventType')} value={kind} onChange={e=>{setKind(e.target.value);setPage(0);}}><option value="">{t('adminAll')} · {t('adminEventType')}</option>{(tab==='ledger'?['credit_purchase','video_generation','refund','manual_adjustment']:['video','order','api','audit','login']).map(x=><option key={x}>{x}</option>)}</select>}
  <select aria-label={t('adminStatus')} value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">{t('adminAll')} · {t('adminStatus')}</option>{(tab==='users'?['active','pending','suspended']:tab==='ledger'?['paid','pending','failed']:['success','review','failed','warning','critical']).map(x=><option key={x}>{x}</option>)}</select>
  <label className="ep-date">{t('adminFrom')}<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}}/></label>
  <label className="ep-date">{t('adminTo')}<input type="date" value={until} onChange={e=>{setUntil(e.target.value);setPage(0);}}/></label>
 </div>;
 const paginate=()=> <div className="ep-pagination"><span>{t('adminShowing')} {count===0?0:offset+1}–{Math.min(offset+perPage,count)} {t('adminOf')} {count} · {t('sampleData')}</span><div><button disabled={page===0} onClick={()=>setPage(v=>v-1)}>{t('adminPrev')}</button><button disabled={(page+1)*perPage>=count} onClick={()=>setPage(v=>v+1)}>{t('adminNext')}<ArrowRight size={14}/></button></div></div>;
 return <div className="ep-shell" data-demo={view}>
  <aside className={'ep-sidebar '+(mobile?'ep-mobile-open':'')}>
   <div className="ep-brand"><div className="ep-brand-mark"><Clapperboard size={24}/></div><div><strong>AUTOJUBEN</strong><span>ENTERPRISE CONSOLE</span></div><button className="ep-mobile-close" onClick={()=>setMobile(false)} aria-label="Close"><X size={18}/></button></div>
   <div className="ep-tenant"><span className="ep-tenant-avatar">AC</span><span><b>AutoJuben Cloud</b><small>Organization / Demo</small></span><ChevronRight size={15}/></div>
   <div className="ep-side-scroll">
    <span className="ep-menu-group">{t('adminOverview')}</span>
    {navigation.filter(n=>roleAllowed(n.id)).map((n,i)=><div key={n.id}>{i>0&&navigation.filter(x=>roleAllowed(x.id))[i-1].group!==n.group&&<span className="ep-menu-group">{t(n.group)}</span>}<button onClick={()=>changeTab(n.id)} className={'ep-nav-link '+(tab===n.id?'ep-active':'')}>{n.icon}<span>{t(labels[n.id])}</span>{n.id==='inbox'&&<span className="ep-counter">4</span>}</button></div>)}
   </div>
   <div className="ep-sidebar-bottom"><div className="ep-demo-status"><span className="ep-online"/><div><b>{t('demoOnly')}</b><small>{t('adminNoLiveDb')}</small></div></div><a href="/preview/frontend"><Globe2 size={17}/>{t('switchToFrontend')}<ArrowRight size={15}/></a></div>
  </aside>
  {mobile&&<button className="ep-mobile-shade" onClick={()=>setMobile(false)} aria-label="Close menu"/>}
  <div className="ep-main">
   <header className="ep-topbar"><div className="ep-top-left"><button className="ep-menu-btn" onClick={()=>setMobile(true)} aria-label="Open menu"><Menu size={20}/></button><span>{t('adminConsoleEnterprise')}</span><ChevronRight size={14}/><b>{t(labels[tab])}</b></div><div className="ep-top-actions"><div className="ep-role-switch"><ShieldCheck size={15}/><select aria-label={t('adminRoleDemo')} value={role} onChange={e=>switchRole(e.target.value as Role)}>{(Object.keys(roleNames) as Role[]).map(r=><option key={r} value={r}>{t(roleNames[r])}</option>)}</select></div><LanguageSelect compact/><button className="ep-notification" onClick={()=>changeTab('inbox')} title={t('adminInbox')} disabled={!roleAllowed('inbox')}><Bell size={18}/></button><span className="ep-avatar">SA</span></div></header>
   <main className="ep-content">
    <div className="ep-warning"><ShieldCheck size={16}/><span>{t('adminDemoOnly')} {t('adminNoLiveDb')}</span><span className="ep-demo-flag">DEMO</span></div>
    <div className="ep-heading"><div><span className="ep-eyebrow">AUTOJUBEN / ADMIN OPERATIONS</span><h1>{tab==='overview'?t('adminCommandCenter'):t(labels[tab])}</h1><p>{tab==='overview'?t('adminOverviewDesc'):t('adminTeamDesc')}</p></div><div className="ep-heading-aside"><span className="ep-time"><Clock3 size={15}/> {new Date().toLocaleDateString(locale==='zh'?'zh-CN':locale==='es'?'es-ES':'en-US')}</span><span className="ep-role-badge">{t(roleNames[role])}</span></div></div>
    {tab==='overview'&&<>
      <TrendDateFilter dates={overviewDates}/>
      <p className="ops-overview-note">{t('opsNotLive')}</p>
      <TrendLineCharts range={overviewDates.range} rows={overviewTrends} source="demo" canRevenue={capabilities[role].includes('ledger')}
        onOpen={(metric:Metric)=>{const next=metric==='revenue'?'ledger':metric==='online'||metric==='peak'?'users':'investigations';if(roleAllowed(next))changeTab(next);}}/>
      <section className="ep-card"><div className="ep-card-head"><div><h2>{t('recentActivity')}</h2><p>{t('sampleData')} · {t('adminUserActivity')}</p></div>
        <button className="ep-text-link" onClick={()=>changeTab('investigations')} disabled={!roleAllowed('investigations')}>{t('seeAll')}<ArrowRight size={15}/></button></div>
        <div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>{t('created')}</th><th>{t('adminEventType')}</th><th>Event ID</th><th>{t('adminUser')}</th><th>{t('adminStatus')}</th></tr></thead><tbody>
        {demoEvents.filter(e=>e.date>=overviewDates.range.from&&e.date<overviewDates.range.to).slice(0,7).map(x=><tr key={x.id}><td>{time(x.date,locale)}</td><td>{x.type}</td><td className="ep-mono">{x.id}</td><td>{x.name}</td><td>{flag(x.status)}</td></tr>)}
        </tbody></table></div></section>
    </>}
    {tab==='staff'&&<section className="ep-card"><div className="ep-card-head"><div><h2>{t('adminStaff')} · RBAC</h2><p>{t('adminTeamDesc')}</p></div><span className="ep-tag ep-active">{staff.length} Staff</span></div><div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('adminRole')}</th><th>{t('adminCapability')}</th><th>{t('adminStatus')}</th><th>{t('action')}</th></tr></thead><tbody>{staff.map(s=><tr key={s.id}><td><b>{s.name}</b><small>{s.id}</small></td><td>{s.email}</td><td>{t(roleNames[s.role])}</td><td><span className="ep-mono">{capabilities[s.role].join(', ')}</span></td><td>{flag(s.state)}</td><td><button className="ep-plain-btn" disabled={role!=='super_admin'||s.role==='super_admin'} onClick={()=>{setSelectedStaff(s.id);setStaffRole(s.role);}}>{t('details')}</button></td></tr>)}</tbody></table></div>
     {selectedStaff&&role==='super_admin'&&<div className="ep-edit-form"><span>{t('adminSaveRole')} · {selectedStaff}</span><select value={staffRole} onChange={e=>setStaffRole(e.target.value as Role)}>{(Object.keys(roleNames) as Role[]).filter(r=>r!=='super_admin').map(r=><option key={r} value={r}>{t(roleNames[r])}</option>)}</select><button onClick={()=>{setStaff(old=>old.map(s=>s.id===selectedStaff?{...s,role:staffRole}:s));setNotice(t('adminDemoOnly'));setSelectedStaff('');}}>{t('adminSaveRole')}</button><button onClick={()=>setSelectedStaff('')}>{t('backLogin')}</button></div>}
    </section>}
    {tab==='users'&&<><section className="ep-card"><div className="ep-card-head"><h2>{t('users')} · User 360</h2><span className="ep-tag ep-active">{filteredUsers.length} {t('adminTotal')}</span></div>{filterBar(false)}<div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>{t('adminUser')}</th><th>{t('adminWorkspace')}</th><th>{t('created')}</th><th>{t('balance')}</th><th>{t('orders')}</th><th>{t('status')}</th><th>{t('details')}</th></tr></thead><tbody>{filteredUsers.slice(offset,offset+perPage).map(x=><tr key={x.id}><td><b>{x.name}</b><small>{x.email} · {x.id}</small></td><td>{x.workspace}</td><td>{time(x.joined,locale)}</td><td>{x.credits.toLocaleString()}</td><td>{x.orders}</td><td>{flag(x.state)}</td><td><button className="ep-plain-btn" onClick={()=>setUser(x)}><UserRound size={15}/>{t('adminUserHistory')}</button></td></tr>)}</tbody></table></div>{paginate()}</section>
    {user&&<section className="ep-card ep-user360"><div className="ep-card-head"><div><h2>{t('adminUserHistory')} · {user.name}</h2><p>{user.email} · {user.id}</p></div><button className="ep-icon-btn" aria-label="Close" onClick={()=>setUser(null)}><X size={17}/></button></div><div className="ep-profile-data"><span>{t('adminWorkspace')}: <b>{user.workspace}</b></span><span>{t('balance')}: <b>{user.credits}</b></span><span>{t('orders')}: <b>{user.orders}</b></span></div><div className="ep-timeline">{demoEvents.filter(e=>e.userId===user.id).slice(0,15).map(e=><div className="ep-history" key={e.id}><span className="ep-history-dot"/><div><b>{e.summary}</b><small>{e.type} · {e.requestId} · {time(e.date,locale)}</small></div>{flag(e.status)}</div>)}</div></section>}</>}
    {tab==='ledger'&&<section className="ep-card"><div className="ep-card-head"><div><h2>{t('adminLedger')}</h2><p>{t('adminDemoOnly')}</p></div><button className="ep-export" onClick={()=>saveCsv('autojuben-demo-ledger.csv',['ID','Date','Customer','Workspace','Source','Status','USD cents','Credits'],filteredLedger.map(x=>[x.id,x.date,x.name,x.workspace,x.source,x.status,x.amount,x.credits]))}><Download size={15}/>{t('adminCsv')}</button></div>{filterBar(true)}<div className="ep-ledger-summary"><div><span>Transactions</span><b>{filteredLedger.length}</b></div><div><span>Net USD (sample)</span><b>{dollar(filteredLedger.reduce((a,v)=>a+v.amount,0))}</b></div><div><span>Credit delta</span><b>{filteredLedger.reduce((a,v)=>a+v.credits,0).toLocaleString()}</b></div></div><div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>ID</th><th>{t('created')}</th><th>{t('adminUser')}</th><th>{t('adminSource')}</th><th>{t('adminAmount')}</th><th>{t('adminChange')}</th><th>{t('adminStatus')}</th></tr></thead><tbody>{filteredLedger.slice(offset,offset+perPage).map(x=><tr key={x.id}><td className="ep-mono">{x.id}</td><td>{time(x.date,locale)}</td><td><b>{x.name}</b><small>{x.workspace}</small></td><td>{x.source}</td><td>{dollar(x.amount)}</td><td className={x.credits<0?'ep-negative':'ep-positive'}>{x.credits>0?'+':''}{x.credits}</td><td>{flag(x.status)}</td></tr>)}</tbody></table></div>{paginate()}</section>}
    {tab==='investigations'&&<section className="ep-card"><div className="ep-card-head"><div><h2>{t('adminInvestigations')} · Event Explorer</h2><p>{t('adminDemoOnly')} · 620 sample events · indexed filters on real API</p></div><button className="ep-export" onClick={()=>saveCsv('autojuben-demo-events.csv',['Date','Type','ID','Request','User','Workspace','Severity','Status'],filteredEvents.map(x=>[x.date,x.type,x.id,x.requestId,x.name,x.workspace,x.severity,x.status]))}><Download size={15}/>{t('adminCsv')}</button></div>{filterBar(true)}<div className="ep-table-wrap"><table className="ep-table"><thead><tr><th>{t('created')}</th><th>{t('adminEventType')}</th><th>Event / Trace</th><th>{t('adminUser')}</th><th>{t('adminWorkspace')}</th><th>{t('adminSeverity')}</th><th>{t('adminStatus')}</th></tr></thead><tbody>{filteredEvents.slice(offset,offset+perPage).map(x=><tr key={x.id}><td>{time(x.date,locale)}</td><td>{x.type}</td><td><b className="ep-mono">{x.id}</b><small className="ep-mono">{x.requestId}</small></td><td>{x.name}</td><td>{x.workspace}</td><td>{flag(x.severity)}</td><td>{flag(x.status)}</td></tr>)}</tbody></table></div>{paginate()}</section>}
    {tab==='inbox'&&<section className="ep-card"><div className="ep-card-head"><div><h2>{threadChannel==='internal'?t('helpAdminInternal'):t('helpAdminCustomer')}</h2><p>{threadChannel==='internal'?t('adminInternalOnly'):t('helpDeskIntro')}</p></div><button className="ep-export" onClick={()=>setNewThreadOpen(v=>!v)}>{t('adminNewThread')}</button></div>
    <div className="ep-channel-switch"><button type="button" className={threadChannel==='internal'?'active':''} onClick={()=>{setThreadChannel('internal');setThreadId('CASE-1045');setMessage('');}}>{t('helpAdminInternal')}</button><button type="button" className={threadChannel==='customer'?'active':''} onClick={()=>{setThreadChannel('customer');setThreadId('CASE-1048');setMessage('');}}>{t('helpAdminCustomer')}</button></div>
    {newThreadOpen&&<div className="ep-new-thread"><input value={newThread} onChange={e=>setNewThread(e.target.value)} placeholder={t('adminSubject')} maxLength={200}/><button disabled={newThread.trim().length<3} onClick={()=>{const id='CASE-DEMO-'+String(threads.length+1);setThreads(old=>[{id,channel:threadChannel,subject:newThread,person:threadChannel==='internal'?'Operations':'Demo Customer',category:threadChannel==='internal'?'internal':'general',status:'open',priority:'normal',updated:new Date().toISOString(),messages:[]},...old]);setThreadId(id);setNewThread('');setNewThreadOpen(false);setNotice(t('adminDemoOnly'));}}>{t('adminCreate')}</button></div>}
    <div className="ep-messenger"><aside className="ep-thread-list"><div className="ep-thread-search"><Search size={14}/><input value={text} onChange={e=>setText(e.target.value)} placeholder={t('adminSearch')}/></div>{threads.filter(x=>x.channel===threadChannel&&matches(x.subject+' '+x.person+' '+x.id)).map(x=><button className={'ep-thread '+(threadId===x.id?'ep-selected':'')} key={x.id} onClick={()=>setThreadId(x.id)}><div><b>{x.subject}</b>{flag(x.priority)}</div><span>{x.person} · {x.category}</span><small>{x.id} · {x.status}</small></button>)}</aside><div className="ep-conversation">{selectedThread?<><header><div><b>{selectedThread.subject}</b><small>{selectedThread.id} · {selectedThread.person}</small></div><select value={selectedThread.status} onChange={e=>setThreads(old=>old.map(x=>x.id===selectedThread.id?{...x,status:e.target.value}:x))}>{['open','pending','resolved','closed'].map(x=><option key={x}>{x}</option>)}</select></header><div className="ep-messages">{selectedThread.messages.map((m,i)=><div className="ep-message" key={i}><strong>{m.by}</strong><p>{m.text}</p><span>{m.time}</span></div>)}{!selectedThread.messages.length&&<p>{t('adminNoRecords')}</p>}</div><div className="ep-compose"><textarea rows={2} value={message} onChange={e=>setMessage(e.target.value)} placeholder={t('adminCompose')} maxLength={8000}/><button disabled={!message.trim()||selectedThread.status==='closed'} onClick={()=>{setThreads(old=>old.map(x=>x.id===selectedThread.id?{...x,messages:[...x.messages,{by:'Demo Admin',text:message.trim(),time:'now'}]}:x));setMessage('');setNotice(t('adminDemoOnly'));}}><Send size={16}/>{t('adminReply')}</button></div></>:null}</div></div></section>}
    {tab==='apiHealth'&&<><div className="ep-kpi-grid">{stat(<CloudCog size={20}/>,'99.73%','GraphQL', 'SAMPLE','blue')}{stat(<ServerCog size={20}/>,'98.91%','REST', 'SAMPLE','green')}{stat(<Database size={20}/>,'98.44%','JSON','SAMPLE','violet')}{stat(<Clock3 size={20}/>,'280ms','P95 latency','SAMPLE','orange')}</div><section className="ep-card"><div className="ep-card-head"><h2>{t('adminApiDiagnostics')}</h2></div><div className="ep-api-rows">{['/graphql','/api/v1/*','/api/json','/api/pricing','/api/generate-video'].map((p,i)=><div key={p}><code>{p}</code><span>{i<3?'AutoJuben':'151 provider'}</span><span className={i<3?'ep-tag ep-active':'ep-tag ep-warning'}>{i<3?'API route / preview':'Not connected'}</span></div>)}</div></section></>}
    {tab==='settings'&&<section className="ep-card"><div className="ep-card-head"><h2>{t('settings')} · Integrations & Governance</h2></div><div className="ep-settings-grid">{[{name:'Supabase PostgreSQL',desc:'Tenant data, role permissions, audit',icon:<Database size={22}/>},{name:'Stripe',desc:'Orders, refunds, credit ledger',icon:<CreditCard size={22}/>},{name:'151 Video Provider',desc:'GraphQL / REST / JSON mapped API',icon:<CloudCog size={22}/>},{name:'Access Policy',desc:'RBAC, least privilege, immutable audit',icon:<ShieldCheck size={22}/>}].map(x=><div key={x.name}><span>{x.icon}</span><b>{x.name}</b><small>{x.desc}</small><span className="ep-tag ep-warning">Not connected</span></div>)}</div></section>}
    {notice&&<div className="ep-notice" role="status"><CheckCircle2 size={16}/>{notice}<button aria-label="Dismiss" onClick={()=>setNotice('')}><X size={14}/></button></div>}
    <footer className="ep-footer"><span>© AutoJuben Cloud · Enterprise Administration Preview</span><span>{t('adminDemoOnly')}</span></footer>
   </main>
  </div>
 </div>;
}
