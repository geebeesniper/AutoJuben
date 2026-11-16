import { Activity, ArrowRight, CheckCircle2, CircleAlert, Clapperboard, FolderOpen, Layers3, Sparkles, WandSparkles } from 'lucide-react';
import { JobTable } from '../components/JobTable';
import { type AppData,type Org,type VideoJob } from '../lib/api';
export function DashboardPage({org,data,onNavigate,onSelect}:{org:Org;data:AppData;onNavigate:(p:string)=>void;onSelect:(j:VideoJob)=>void}) {
  const tiles=[
    {icon:<Clapperboard size={20}/>,title:'全部视频任务',value:data.dashboard.total,kind:'blue'},
    {icon:<Activity size={20}/>,title:'进行中 / 待处理',value:data.dashboard.active,kind:'purple'},
    {icon:<CheckCircle2 size={20}/>,title:'生成完成',value:data.dashboard.completed,kind:'green'},
    {icon:<Layers3 size={20}/>,title:'工作项目',value:data.dashboard.projects,kind:'amber'}
  ];
  return <><div className="hero"><div className="hero-copy"><span className="hero-overline"><Sparkles size={14}/> CREATIVE WORKSPACE</span><h1>欢迎回到 <span>{org.name}</span></h1><p>从灵感到视频，让每一次创作都有清晰的流程和可追踪的结果。</p><button className="btn btn-light" onClick={()=>onNavigate('studio')}><WandSparkles size={17}/> 创建新视频 <ArrowRight size={16}/></button></div><div className="hero-art"><div className="hero-film one"/><div className="hero-film two"/><div className="hero-glow"/><Clapperboard className="hero-main-icon" size={84} strokeWidth={1.2}/></div></div>
    <div className="stat-grid">{tiles.map(t=><div key={t.title} className="stat-card"><div className={`stat-icon ${t.kind}`}>{t.icon}</div><div className="stat-value">{t.value}</div><div className="stat-title">{t.title}</div></div>)}</div>
    {data.dashboard.failed>0&&<div className="notice danger"><CircleAlert size={18}/><span>最近有 <b>{data.dashboard.failed}</b> 个失败任务。建议在任务详情中检查错误信息与计费状态。</span><button onClick={()=>onNavigate('jobs')}>查看任务 <ArrowRight size={14}/></button></div>}
    <div className="section-heading"><div><h2>最近生成任务</h2><p>掌握生成状态、进度与输出结果</p></div><button className="btn btn-ghost" onClick={()=>onNavigate('jobs')}>查看全部 <ArrowRight size={15}/></button></div>
    <div className="panel"><JobTable jobs={data.jobs.slice(0,6)} projects={data.projects} onSelect={onSelect}/></div>
    <div className="quick-grid"><button className="quick-card" onClick={()=>onNavigate('studio')}><span className="quick-icon"><WandSparkles size={22}/></span><b>开始创作</b><small>上传参考素材，生成新的视频镜头</small><ArrowRight size={16}/></button>
      <button className="quick-card" onClick={()=>onNavigate('projects')}><span className="quick-icon"><FolderOpen size={22}/></span><b>管理项目</b><small>以项目为单位整理视频任务</small><ArrowRight size={16}/></button></div>
  </>;
}
