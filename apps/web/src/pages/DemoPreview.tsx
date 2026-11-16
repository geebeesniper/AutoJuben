import {useMemo,useState} from 'react';
import {Activity,ArrowRight,BarChart3,CheckCircle2,ChevronRight,CircleHelp,Clapperboard,CloudCog,CreditCard,Database,FolderKanban,Globe2,KeyRound,LayoutDashboard,ListVideo,Menu,Plus,Search,ServerCog,Settings2,ShieldCheck,ShoppingBag,Sparkles,UsersRound,Video,X} from 'lucide-react';
import {LanguageSelect,useI18n} from '../i18n';
import './demo-preview.css';

type View='frontend'|'backend';
type DemoTab='overview'|'studio'|'projects'|'orders'|'users'|'payments'|'apiHealth'|'settings';
const customers=[
 {name:'Sofia Martinez',email:'sofia@example.com',role:'Owner',state:'active',last:'2026-11-15'},
 {name:'Daniel Park',email:'daniel@example.com',role:'Editor',state:'active',last:'2026-11-14'},
 {name:'Ana López',email:'ana@example.com',role:'Viewer',state:'pending',last:'2026-11-12'},
 {name:'Alex Morgan',email:'alex@example.com',role:'Owner',state:'active',last:'2026-11-11'}
];
const transactions=[
 {id:'AJ-DEMO-1082',name:'Sofia Martinez',item:'Creator · 500',price:'$19.00',status:'paid',date:'2026-11-15'},
 {id:'AJ-DEMO-1081',name:'Daniel Park',item:'Studio · 2,000',price:'$59.00',status:'paid',date:'2026-11-13'},
 {id:'AJ-DEMO-1080',name:'Ana López',item:'Creator · 500',price:'$19.00',status:'pending',date:'2026-11-12'},
 {id:'AJ-DEMO-1079',name:'Alex Morgan',item:'Starter · 100',price:'$9.00',status:'paid',date:'2026-11-11'}
];
const sampleJobs=[
 {id:'VID-0285',project:'Aurora Campaign',model:'Video 2.0',status:'completed',progress:100},
 {id:'VID-0284',project:'Product Launch',model:'Video 2.0',status:'running',progress:72},
 {id:'VID-0283',project:'Studio Collection',model:'Video 1.5',status:'completed',progress:100},
 {id:'VID-0282',project:'Social Stories',model:'Video 2.0',status:'pending',progress:0}
];
const demoProjects=[
 {name:'Aurora Campaign',tag:'Brand',count:12,accent:'indigo',initial:'AC'},
 {name:'Product Launch',tag:'Product',count:8,accent:'orange',initial:'PL'},
 {name:'Studio Collection',tag:'Creative',count:19,accent:'teal',initial:'SC'},
 {name:'Social Stories',tag:'Social',count:5,accent:'pink',initial:'SS'}
];
const statusKeys:Record<string,string>={paid:'paid',pending:'pending',completed:'completedJobs',running:'activeJobs',active:'available'};
export function DemoPreview({view}:{view:View}){
 const {t,locale}=useI18n();
 const [tab,setTab]=useState<DemoTab>('overview'),[menu,setMenu]=useState(false),[search,setSearch]=useState('');
 const [prompt,setPrompt]=useState(''),[resolution,setResolution]=useState('1080p'),[duration,setDuration]=useState('8');
 const [newJobs,setNewJobs]=useState(0),[notice,setNotice]=useState('');
 const isAdmin=view==='backend';
 const tabs: {id:DemoTab;label:string;icon:React.ReactNode}[]=isAdmin?[
   {id:'overview',label:t('overview'),icon:<LayoutDashboard size={18}/>},
   {id:'users',label:t('users'),icon:<UsersRound size={18}/>},
   {id:'payments',label:t('payments'),icon:<CreditCard size={18}/>},
   {id:'apiHealth',label:t('apiHealth'),icon:<ServerCog size={18}/>},
   {id:'settings',label:t('settings'),icon:<Settings2 size={18}/>}
 ]:[
   {id:'overview',label:t('overview'),icon:<LayoutDashboard size={18}/>},
   {id:'studio',label:t('studio'),icon:<Sparkles size={18}/>},
   {id:'projects',label:t('projects'),icon:<FolderKanban size={18}/>},
   {id:'orders',label:t('orders'),icon:<ShoppingBag size={18}/>}
 ];
 const current=tabs.find(x=>x.id===tab)?.label??t('overview');
 function selectTab(next:DemoTab){setTab(next);setMenu(false);setNotice('');}
 function simulate(e:React.FormEvent){e.preventDefault();if(!prompt.trim())return;setNewJobs(n=>n+1);setNotice(t('demoSubmitted'));setPrompt('');setTab('overview');}
 const filtered=useMemo(()=>customers.filter(c=>(c.name+' '+c.email).toLowerCase().includes(search.toLowerCase())),[search]);
 const header=(title:string,desc:string,kicker:string)=> <div className="ap-heading"><div><span className="ap-kicker">{kicker}</span><h1>{title}</h1><p>{desc}</p></div><span className="ap-version">v0.6.0 <span>•</span> PREVIEW</span></div>;
 const stat=(icon:React.ReactNode,number:string,label:string,color:string)=> <div className="ap-stat" key={label}><div className={'ap-stat-icon '+color}>{icon}</div><strong>{number}</strong><small>{label}</small></div>;
 const status=(s:string)=><span className={'ap-status ap-'+s}><span/>{t(statusKeys[s]??s)}</span>;
 return <div className="ap-shell">
   <aside className={'ap-sidebar '+(menu?'ap-open':'')}>
     <div className="ap-brand"><span className="ap-brand-icon"><Clapperboard size={22}/></span><span><b>AUTOJUBEN</b><small>{isAdmin?'ADMIN CONSOLE':'CREATIVE CLOUD'}</small></span><button className="ap-close" onClick={()=>setMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
     <div className="ap-environment"><span className="ap-env-dot"/><div><b>{t('demoOnly')}</b><small>{isAdmin?t('previewBackend'):t('previewFrontend')}</small></div></div>
     <span className="ap-sidebar-label">{isAdmin?t('platformArea'):t('workspace')}</span>
     <nav className="ap-nav" aria-label={current}>{tabs.map(x=><button type="button" key={x.id} className={'ap-nav-link '+(tab===x.id?'ap-selected':'')} onClick={()=>selectTab(x.id)}>{x.icon}<span>{x.label}</span>{tab===x.id&&<ChevronRight size={15} className="ap-nav-chevron"/>}</button>)}</nav>
     <div className="ap-sidebar-bottom"><div className="ap-env-security"><ShieldCheck size={18}/>{t('safePreview')}</div><a href={isAdmin?'/preview/frontend':'/preview/backend'} className="ap-cross"><Globe2 size={17}/>{isAdmin?t('switchToFrontend'):t('switchToBackend')}<ArrowRight size={15}/></a></div>
   </aside>
   {menu&&<button type="button" className="ap-shade" onClick={()=>setMenu(false)} aria-label="Close menu"/>}
   <div className="ap-content">
     <header className="ap-topbar"><div className="ap-topbar-left"><button type="button" className="ap-menu" onClick={()=>setMenu(true)} aria-label="Open menu"><Menu size={20}/></button><span>{isAdmin?t('adminConsole'):t('customerPortal')}</span><ChevronRight size={14}/><strong>{current}</strong></div><div className="ap-topbar-actions"><span className="ap-demo-pill">{t('sampleData')}</span><LanguageSelect compact/><span className="ap-avatar">{isAdmin?'A':'C'}</span></div></header>
     <div className="ap-main"><div className="ap-demo-alert"><CircleHelp size={18}/><span>{t('previewNotice')}</span></div>
     {tab==='overview'&&(!isAdmin?<>
       <section className="ap-hero"><div><span className="ap-hero-eyebrow"><Sparkles size={15}/> AI CREATIVE WORKSPACE</span><h1>{t('welcomeTo',{name:'AutoJuben'})}</h1><p>{t('welcomeDescription')}</p><button type="button" onClick={()=>selectTab('studio')} className="ap-primary">{t('newVideo')} <ArrowRight size={17}/></button></div><div className="ap-hero-art"><div className="ap-hero-orbit"><Video size={58}/></div></div></section>
       <div className="ap-stats">{stat(<ListVideo size={21}/>,String(48+newJobs),t('totalJobs'),'indigo')}{stat(<Activity size={21}/>,String(5+newJobs),t('activeJobs'),'orange')}{stat(<CheckCircle2 size={21}/>,String(39),t('completedJobs'),'green')}{stat(<FolderKanban size={21}/>,String(4),t('totalProjects'),'purple')}</div>
       <section className="ap-panel"><div className="ap-panel-head"><div><h2>{t('recentJobs')}</h2><p>{t('overviewHint')}</p></div><button className="ap-text-button" onClick={()=>selectTab('studio')}>{t('startCreating')} <ArrowRight size={16}/></button></div><div className="ap-table-wrap"><table className="ap-table"><thead><tr><th>ID</th><th>{t('projects')}</th><th>{t('model')}</th><th>{t('status')}</th><th>{t('details')}</th></tr></thead><tbody>{newJobs>0&&<tr><td>VID-DEMO-{newJobs}</td><td>New demo</td><td>Video 2.0</td><td>{status('pending')}</td><td>0%</td></tr>}{sampleJobs.map(x=><tr key={x.id}><td className="ap-mono">{x.id}</td><td>{x.project}</td><td>{x.model}</td><td>{status(x.status)}</td><td>{x.progress}%</td></tr>)}</tbody></table></div></section>
     </>:<>
       {header(t('adminOverviewTitle'),t('adminOverviewDesc'),'PLATFORM / ANALYTICS')}
       <div className="ap-stats">{stat(<UsersRound size={21}/>,'1,248',t('usersCount'),'indigo')}{stat(<ShoppingBag size={21}/>,'86',t('ordersCount'),'orange')}{stat(<BarChart3 size={21}/>,'99.7%',t('apiSuccess'),'green')}{stat(<Database size={21}/>,'3',t('apiRequests')+' · K','purple')}</div>
       <div className="ap-dashboard-pair"><section className="ap-panel"><div className="ap-panel-head"><div><h2>{t('recentActivity')}</h2><p>{t('overviewHint')}</p></div></div><div className="ap-timeline">{transactions.slice(0,3).map(o=><div className="ap-activity" key={o.id}><span className="ap-activity-dot"/><div><b>{o.name}</b><small>{o.id} · {o.item}</small></div>{status(o.status)}</div>)}</div></section><section className="ap-panel"><div className="ap-panel-head"><h2>{t('systemStatus')}</h2></div><div className="ap-service-list">{['GraphQL','REST / JSON','Supabase','Stripe','Video Provider'].map((x,i)=><div className="ap-service" key={x}><span>{x}</span><span className={i<2?'ap-service-sample':'ap-service-off'}>{i<2?t('sampleData'):t('serviceUnavailable')}</span></div>)}</div></section></div>
     </>)}
     {tab==='studio'&&!isAdmin&&<>{header(t('studio'),t('welcomeDescription'),'STUDIO / GENERATION')}<div className="ap-studio-grid"><section className="ap-panel ap-studio-form"><div className="ap-panel-head"><h2>{t('createdVideo')}</h2><Sparkles size={19}/></div><form onSubmit={simulate}><label htmlFor="ap-prompt">{t('prompt')}</label><textarea id="ap-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} rows={7} maxLength={2000} required placeholder={t('promptPlaceholder')}/><div className="ap-two-fields"><label>{t('resolution')}<select value={resolution} onChange={e=>setResolution(e.target.value)}><option>720p</option><option>1080p</option><option>4K</option></select></label><label>{t('duration')} ({t('seconds')})<select value={duration} onChange={e=>setDuration(e.target.value)}><option>5</option><option>8</option><option>10</option></select></label></div><button type="submit" className="ap-primary"><Plus size={17}/>{t('generateDemo')}</button></form></section><section className="ap-panel ap-studio-aside"><div className="ap-film"><Video size={56}/><span>AI VIDEO</span></div><h2>AutoJuben · Creator</h2><p>{t('previewNotice')}</p><div className="ap-service"><span>{t('mockVideo')}</span>{status('active')}</div><div className="ap-service"><span>{t('paymentDisabled')}</span>{status('active')}</div></section></div></>}
     {tab==='projects'&&!isAdmin&&<>{header(t('projects'),t('demoProjectsDesc'),'WORKSPACE / PROJECTS')}<div className="ap-project-grid">{demoProjects.map(x=><article key={x.name} className={'ap-project ap-project-'+x.accent}><span className="ap-project-mark">{x.initial}</span><span className="ap-project-tag">{x.tag}</span><h2>{x.name}</h2><p>{x.count} {t('totalJobs')}</p><div className="ap-project-bottom"><FolderKanban size={18}/><span>{t('projectReady')}</span></div></article>)}</div></>}
     {tab==='orders'&&!isAdmin&&<>{header(t('orders'),t('demoOrdersDesc'),'ACCOUNT / BILLING')}<div className="ap-stats">{stat(<CreditCard size={21}/>,'2,450',t('balance'),'indigo')}{stat(<ShoppingBag size={21}/>,'8',t('ordersCount'),'green')}</div><section className="ap-panel"><div className="ap-panel-head"><h2>{t('orders')}</h2></div><OrderTable t={t} status={status}/></section></>}
     {tab==='users'&&isAdmin&&<>{header(t('userDirectory'),t('usersDescription'),'ADMIN / USERS')}<section className="ap-panel"><div className="ap-panel-head"><h2>{t('users')}</h2><div className="ap-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('searchUsers')}/></div></div><div className="ap-table-wrap"><table className="ap-table"><thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('status')}</th><th>{t('lastActive')}</th></tr></thead><tbody>{filtered.map(x=><tr key={x.email}><td><b>{x.name}</b></td><td>{x.email}</td><td>{x.role}</td><td>{status(x.state)}</td><td>{x.last}</td></tr>)}</tbody></table></div></section></>}
     {tab==='payments'&&isAdmin&&<>{header(t('payments'),t('ordersDescription'),'ADMIN / PAYMENTS')}<section className="ap-panel"><div className="ap-panel-head"><h2>{t('orders')}</h2><span className="ap-service-off">{t('paymentDisabled')}</span></div><OrderTable t={t} status={status}/></section></>}
     {tab==='apiHealth'&&isAdmin&&<>{header(t('apiHealth'),t('apiDescription'),'ADMIN / API STATUS')}<div className="ap-api-grid">{['GraphQL','REST','JSON'].map((x,i)=><article className="ap-panel ap-api-card" key={x}><div className="ap-api-icon">{i===0?<CloudCog size={21}/>:i===1?<ServerCog size={21}/>:<Database size={21}/>}</div><h2>{x}</h2><code>{i===0?'/graphql':i===1?'/api/v1/':'/api/json'}</code><p>{t('supportNotice')}</p><span className="ap-service-sample">{t('sampleData')}</span></article>)}</div><div className="ap-panel ap-health-warning"><ShieldCheck size={20}/><span>{t('notConnected')} · Supabase / Stripe / Video Provider</span></div></>}
     {tab==='settings'&&isAdmin&&<>{header(t('systemConfiguration'),t('settingsDescription'),'ADMIN / SETTINGS')}<div className="ap-settings-grid">{[['Supabase',t('notConnected'),<Database size={21}/>],['Stripe',t('paymentDisabled'),<CreditCard size={21}/>],['Video Provider',t('mockVideo'),<Video size={21}/>],['API',t('apiStatus'),<KeyRound size={21}/>]].map(([name,detail,icon])=><section className="ap-panel ap-setting-tile" key={name as string}><div className="ap-setting-icon">{icon}</div><div><h2>{name}</h2><p>{detail}</p></div><span className="ap-service-sample">{t('sampleData')}</span></section>)}</div></>}
     {notice&&<div role="status" className="ap-notice"><CheckCircle2 size={18}/>{notice}</div>}
     <footer className="ap-footer"><span>AutoJuben Cloud · v0.6.0</span><span>{t('demoOnly')} · {t('safePreview')}</span></footer>
     </div>
   </div>
 </div>;
}
function OrderTable({t,status}:{t:(s:string)=>string;status:(s:string)=>React.ReactNode}){
 return <div className="ap-table-wrap"><table className="ap-table"><thead><tr><th>ID</th><th>{t('name')}</th><th>{t('created')}</th><th>{t('credits')}</th><th>{t('status')}</th></tr></thead><tbody>{transactions.map(x=><tr key={x.id}><td className="ap-mono">{x.id}</td><td>{x.name}<small>{x.item}</small></td><td>{x.date}</td><td>{x.price}</td><td>{status(x.status)}</td></tr>)}</tbody></table></div>;
}
