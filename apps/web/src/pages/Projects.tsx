import { useState } from 'react';
import { ArrowRight,FolderOpen,Plus,Trash2,X } from 'lucide-react';
import { gql,type Org,type Project } from '../lib/api';
import { EmptyState } from '../components/Status';
export function ProjectsPage({org,projects,onChanged,onNotify,onGoStudio}:{org:Org;projects:Project[];onChanged:()=>void;onNotify:(s:string,ok?:boolean)=>void;onGoStudio:()=>void}) {
  const [editing,setEditing]=useState<Project|null>(null);
  const [modal,setModal]=useState(false);const [name,setName]=useState('');const [description,setDescription]=useState('');const [busy,setBusy]=useState(false);
  const canManage=['owner','admin','editor'].includes(org.role);
  function open(project:Project|null){setEditing(project);setName(project?.name??'');setDescription(project?.description??'');setModal(true);}
  async function save(){setBusy(true);try{
    if(editing)await gql(`mutation($org:ID!,$id:ID!,$name:String!,$description:String){updateProject(orgId:$org,id:$id,name:$name,description:$description){id}}`,{org:org.id,id:editing.id,name,description});
    else await gql(`mutation($org:ID!,$name:String!,$description:String){createProject(orgId:$org,name:$name,description:$description){id}}`,{org:org.id,name,description});
    setModal(false);onNotify('项目已保存',true);onChanged();
  }catch(e){onNotify(e instanceof Error?e.message:'保存失败');}finally{setBusy(false);}}
  async function remove(p:Project){if(!window.confirm(`确定删除项目「${p.name}」？项目下的视频任务将保留但解除分类。`))return;
    try{await gql(`mutation($org:ID!,$id:ID!){deleteProject(orgId:$org,id:$id)}`,{org:org.id,id:p.id});onNotify('项目已删除',true);onChanged();}catch(e){onNotify(e instanceof Error?e.message:'删除失败');}}
  return <><div className="page-heading"><div><div className="section-kicker">PROJECT MANAGEMENT</div><h1>项目管理</h1><p>统一组织视频、素材与创作流程。</p></div>{canManage&&<button className="btn btn-primary" onClick={()=>open(null)}><Plus size={16}/> 新建项目</button>}</div>
    {projects.length?<div className="project-grid">{projects.map(p=><div key={p.id} className="panel project-card"><div className="project-icon"><FolderOpen size={23}/></div><div className="project-title-row"><h3>{p.name}</h3><span className="count-pill">{p.jobCount} 个任务</span></div><p>{p.description||'暂未添加项目描述'}</p><div className="project-actions"><button className="text-btn" onClick={onGoStudio}>新建视频 <ArrowRight size={15}/></button>{canManage&&<><button className="muted-link" onClick={()=>open(p)}>编辑</button>{['owner','admin'].includes(org.role)&&<button className="icon-btn danger-text" aria-label="删除项目" onClick={()=>void remove(p)}><Trash2 size={16}/></button>}</>}</div></div>)}</div>
    :<div className="panel"><EmptyState icon={<FolderOpen size={24}/>} title="项目列表还是空的" detail="先创建一个项目，将后续视频任务归档在一起。" action={canManage&&<button className="btn btn-primary" onClick={()=>open(null)}><Plus size={16}/> 新建第一个项目</button>}/></div>}
    {modal&&<div className="modal-backdrop" onMouseDown={()=>setModal(false)}><div className="modal mini-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><h2>{editing?'编辑项目':'新建项目'}</h2><button className="icon-btn" onClick={()=>setModal(false)}><X size={18}/></button></div><label className="field"><span>项目名称</span><input autoFocus maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="例如：产品展示片"/></label><label className="field"><span>项目描述</span><textarea value={description} maxLength={2000} onChange={e=>setDescription(e.target.value)} placeholder="可选，记录项目目标与风格说明"/></label><div className="modal-actions"><button className="btn btn-ghost" onClick={()=>setModal(false)}>取消</button><button disabled={busy||!name.trim()} className="btn btn-primary" onClick={()=>void save()}>{busy?'保存中…':'保存项目'}</button></div></div></div>}
  </>;
}
