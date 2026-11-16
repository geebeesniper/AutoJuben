import { statuses } from '../lib/api';
export function Status({value}:{value:string}) {
  const s=statuses[value]??{label:value,className:'queued'};
  return <span className={`status-pill ${s.className}`}><span className="status-dot"/>{s.label}</span>;
}
export function EmptyState({icon,title,detail,action}:{icon:React.ReactNode;title:string;detail:string;action?:React.ReactNode}){
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
