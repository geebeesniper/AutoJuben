import { Film, ArrowUpRight, Clock3 } from 'lucide-react';
import { formatDate, type Project,type VideoJob } from '../lib/api';
import { EmptyState,Status } from './Status';
export function JobTable({jobs,projects,onSelect}:{jobs:VideoJob[];projects:Project[];onSelect:(job:VideoJob)=>void}) {
  return <div className="table-wrap"><table className="job-table"><thead><tr><th>任务 / 提示词</th><th>所属项目</th><th>模型</th><th>状态</th><th>进度</th><th>创建时间</th><th/></tr></thead><tbody>
    {jobs.map(j=><tr key={j.id} onClick={()=>onSelect(j)} className="clickable"><td><div className="job-title">{j.prompt.slice(0,46)}{j.prompt.length>46?'…':''}</div><div className="job-id">#{j.id.slice(0,8)}</div></td>
      <td>{projects.find(p=>p.id===j.projectId)?.name??'未分类'}</td><td><span className="mono-small">{j.model}</span><div className="subtle">{j.resolution} · {j.duration}s</div></td>
      <td><Status value={j.status}/></td><td><div className="progress-cell"><div className="progress-track"><div style={{width:`${j.progress}%`}} className={j.status==='failed'?'progress-fill fail':'progress-fill'}/></div><span>{j.progress}%</span></div></td>
      <td className="subtle">{formatDate(j.createdAt)}</td><td><ArrowUpRight size={16}/></td></tr>)}
  </tbody></table>{!jobs.length&&<EmptyState icon={<Clock3 size={22}/>} title="还没有视频任务" detail="创建第一个生成任务后，会在这里看到进度与结果。"/>}</div>;
}
