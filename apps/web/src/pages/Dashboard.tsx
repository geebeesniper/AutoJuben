import { Activity, ArrowRight, CheckCircle2, CircleAlert, Clapperboard, FolderOpen, Layers3, Sparkles, WandSparkles } from 'lucide-react';
import { JobTable } from '../components/JobTable';
import {useI18n} from '../i18n';
import { type AppData,type Org,type VideoJob } from '../lib/api';
export function DashboardPage({org,data,onNavigate,onSelect}:{org:Org;data:AppData;onNavigate:(p:string)=>void;onSelect:(j:VideoJob)=>void}) {
  const {t}=useI18n();
  const tiles=[
    {icon:<Clapperboard size={20}/>,title:t('totalJobs'),value:data.dashboard.total,kind:'blue'},
    {icon:<Activity size={20}/>,title:t('activeJobs'),value:data.dashboard.active,kind:'purple'},
    {icon:<CheckCircle2 size={20}/>,title:t('completedJobs'),value:data.dashboard.completed,kind:'green'},
    {icon:<Layers3 size={20}/>,title:t('totalProjects'),value:data.dashboard.projects,kind:'amber'}
  ];
  return <><div className="hero"><div className="hero-copy"><span className="hero-overline"><Sparkles size={14}/> CREATIVE WORKSPACE</span><h1>{t('welcomeTo',{name:org.name})}</h1><p>{t('welcomeDescription')}</p><button className="btn btn-light" onClick={()=>onNavigate('studio')}><WandSparkles size={17}/> {t('newVideo')} <ArrowRight size={16}/></button></div><div className="hero-art"><div className="hero-film one"/><div className="hero-film two"/><div className="hero-glow"/><Clapperboard className="hero-main-icon" size={84} strokeWidth={1.2}/></div></div>
    <div className="stat-grid">{tiles.map(t=><div key={t.title} className="stat-card"><div className={`stat-icon ${t.kind}`}>{t.icon}</div><div className="stat-value">{t.value}</div><div className="stat-title">{t.title}</div></div>)}</div>
    {data.dashboard.failed>0&&<div className="notice danger"><CircleAlert size={18}/><span>最近有 <b>{data.dashboard.failed}</b> 个失败任务。建议在任务详情中检查错误信息与计费状态。</span><button onClick={()=>onNavigate('jobs')}>查看任务 <ArrowRight size={14}/></button></div>}
    <div className="section-heading"><div><h2>{t('recentJobs')}</h2><p>{t('overviewHint')}</p></div><button className="btn btn-ghost" onClick={()=>onNavigate('jobs')}>{t('seeAll')} <ArrowRight size={15}/></button></div>
    <div className="panel"><JobTable jobs={data.jobs.slice(0,6)} projects={data.projects} onSelect={onSelect}/></div>
    <div className="quick-grid"><button className="quick-card" onClick={()=>onNavigate('studio')}><span className="quick-icon"><WandSparkles size={22}/></span><b>{t('startCreating')}</b><small>上传参考素材，生成新的视频镜头</small><ArrowRight size={16}/></button>
      <button className="quick-card" onClick={()=>onNavigate('projects')}><span className="quick-icon"><FolderOpen size={22}/></span><b>{t('manageProjects')}</b><small>以项目为单位整理视频任务</small><ArrowRight size={16}/></button></div>
  </>;
}
