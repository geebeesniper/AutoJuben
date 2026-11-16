import { useRef,useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Clapperboard, Film, Headphones, Image as ImageIcon, Plus, Sparkles, Trash2, UploadCloud, WandSparkles } from 'lucide-react';
import { gql,uploadAsset,type Org,type Project,type UploadedAsset,type VideoJob } from '../lib/api';
import {useI18n} from '../i18n';
const hints={image:'角色、场景和风格参考，最多 9 张',audio:'旁白、配音或音效参考，最多 3 个',video:'动作、镜头和节奏参考，最多 3 个'};
type Kind='image'|'audio'|'video';
const mediaTypes:{kind:Kind;title:string;icon:React.ReactNode;accept:string;max:number}[]=[
  {kind:'image',title:'图片参考',icon:<ImageIcon size={17}/>,accept:'image/jpeg,image/png,image/webp',max:9},
  {kind:'audio',title:'音频参考',icon:<Headphones size={17}/>,accept:'.mp3,.wav,.m4a',max:3},
  {kind:'video',title:'视频参考',icon:<Film size={17}/>,accept:'.mp4,.mov,.webm',max:3}
];
const lines=(value:string)=>value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
export function Studio({org,projects,onCreated,onNotify}:{org:Org;projects:Project[];onCreated:(job:VideoJob)=>void;onNotify:(msg:string,success?:boolean)=>void}) {
  const {t}=useI18n();
  const [prompt,setPrompt]=useState('');const [projectId,setProjectId]=useState('');const [model,setModel]=useState('xinghe-2.0');
  const [ratio,setRatio]=useState('9:16');const [duration,setDuration]=useState(15);const [resolution,setResolution]=useState('720p');
  const [mediaUrls,setMediaUrls]=useState<Record<Kind,string>>({image:'',audio:'',video:''});
  const [uploads,setUploads]=useState<Record<Kind,UploadedAsset[]>>({image:[],audio:[],video:[]});
  const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState<Kind|null>(null);
  const taskId=useRef(crypto.randomUUID());
  const totalMedia=Object.values(mediaUrls).reduce((n,s)=>n+lines(s).length,0)+Object.values(uploads).reduce((n,files)=>n+files.length,0);
  async function onFiles(kind:Kind,files:FileList|null) {
    if(!files?.length)return;
    const limit=mediaTypes.find(m=>m.kind===kind)!.max;
    if(files.length+lines(mediaUrls[kind]).length+uploads[kind].length>limit){onNotify(`${kind} 素材超出上限 ${limit} 个`);return;}
    setUploading(kind);
    try{
      for(const file of Array.from(files)){
        const item=await uploadAsset(org.id,file);
        if(item.kind!==kind)throw new Error('文件类型与素材栏目不一致');
        setUploads(prev=>({...prev,[kind]:[...prev[kind],item]}));
      }
      onNotify('文件上传成功',true);
    }catch(error){onNotify(error instanceof Error?error.message:'文件上传失败');}
    finally{setUploading(null);}
  }
  function reorderImage(from:number,to:number) {
    setUploads(prev=>{
      if(from<0||to<0||from>=prev.image.length||to>=prev.image.length)return prev;
      const image=[...prev.image];
      const [item]=image.splice(from,1);
      image.splice(to,0,item);
      return {...prev,image};
    });
  }
  async function create() {
    if(!prompt.trim()){onNotify('请先输入视频内容提示词');return;}
    if(totalMedia>12){onNotify('所有参考素材合计最多 12 个');return;}
    setBusy(true);
    try {
      const input={clientTaskId:taskId.current,projectId:projectId||null,prompt,model,ratio,duration,resolution,
        imageUrls:lines(mediaUrls.image),audioUrls:lines(mediaUrls.audio),videoUrls:lines(mediaUrls.video),
        imageAssetIds:uploads.image.map(f=>f.id),audioAssetIds:uploads.audio.map(f=>f.id),videoAssetIds:uploads.video.map(f=>f.id)};
      const result=await gql<{createVideoJob:VideoJob}>(`mutation Create($orgId:ID!,$input:VideoJobInput!){createVideoJob(orgId:$orgId,input:$input){id orgId projectId clientTaskId providerTaskId prompt model duration ratio resolution status progress requiredCredits billingStatus videoUrl errorCode errorMessage isDemo imageUrls audioUrls videoUrls createdAt submittedAt finishedAt updatedAt}}`,{orgId:org.id,input});
      taskId.current=crypto.randomUUID();onCreated(result.createVideoJob);
    }catch(error){onNotify(error instanceof Error?error.message:'任务创建失败');}
    finally{setBusy(false);}
  }
  return <div className="studio-grid"><div className="studio-main">
    <div className="section-kicker"><Sparkles size={14}/> AI VIDEO STUDIO</div>
    <h1>创建视频 <span className="gradient-text">让创意动起来</span></h1>
    <p className="page-intro">使用文字与多模态参考素材，生成一致性更高的视频镜头。</p>
    <section className="panel studio-panel"><div className="panel-heading"><div><h2><WandSparkles size={18}/> 视频描述</h2><p>说明主体、场景、镜头运动与需要保留的细节</p></div><span className="info-chip">必填</span></div>
      <textarea className="prompt-editor" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={5000} placeholder="例如：雨后的城市街道，固定角色从咖啡店走出。采用电影级写实光照，镜头缓缓推进，保留参考图片中的角色服装、五官与环境细节。无需字幕。"/>
      <div className="text-counter">{prompt.length} / 5000</div>
    </section>
    <section className="panel studio-panel"><div className="panel-heading"><div><h2><ImageIcon size={18}/> 参考素材</h2><p>支持直接上传文件，或提供可公开访问的素材链接（建议 HTTPS）</p></div><span className="info-chip">{totalMedia}/12</span></div>
      <div className="media-stack">{mediaTypes.map(m=><div key={m.kind} className="media-card"><div className="media-card-heading"><div className="media-icon">{m.icon}</div><div><h3>{m.title}</h3><p>{hints[m.kind]}</p></div><span>{lines(mediaUrls[m.kind]).length+uploads[m.kind].length}/{m.max}</span></div>
        <textarea className="url-editor" placeholder={`每行一个素材 URL（https://…）`} value={mediaUrls[m.kind]} onChange={e=>setMediaUrls(prev=>({...prev,[m.kind]:e.target.value}))}/>
        {!!uploads[m.kind].length&&<div className="asset-list">{uploads[m.kind].map((a,index)=><div className="asset-chip" key={a.id}>
          {m.kind==='image'&&<span className="asset-order-index" aria-label={`${t('referenceFrame')} ${index+1}`}>{index+1}</span>}
          <Check size={13}/><span title={a.name}>{a.name}</span>
          {m.kind==='image'&&<div className="asset-move-controls">
            <button type="button" disabled={index===0} title={t('moveUp')} aria-label={`${t('moveUp')}: ${a.name}`} onClick={()=>reorderImage(index,index-1)}><ArrowUp size={13}/></button>
            <button type="button" disabled={index===uploads.image.length-1} title={t('moveDown')} aria-label={`${t('moveDown')}: ${a.name}`} onClick={()=>reorderImage(index,index+1)}><ArrowDown size={13}/></button>
          </div>}
          <button type="button" aria-label="移除素材" onClick={()=>setUploads(prev=>({...prev,[m.kind]:prev[m.kind].filter(x=>x.id!==a.id)}))}><Trash2 size={13}/></button>
        </div>)}</div>}
        <label className="upload-btn"><UploadCloud size={15}/>{uploading===m.kind?'上传中…':'上传本地文件'}<input type="file" multiple accept={m.accept} disabled={uploading!==null} onChange={e=>{void onFiles(m.kind,e.target.files);e.currentTarget.value='';}}/></label>
      </div>)}</div>
    </section>
  </div><aside className="studio-aside"><div className="panel setting-card sticky"><div className="panel-heading"><div><h2><Clapperboard size={18}/> 生成设置</h2><p>配置模型、时长与输出格式</p></div></div>
    <label className="field"><span>所属项目</span><select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">未分类任务</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="field"><span>视频模型</span><div className="segmented two"><button type="button" className={model==='xinghe-2.0'?'selected':''} onClick={()=>{setModel('xinghe-2.0');setResolution('720p');}}>星核 2.0</button><button type="button" className={model==='xinghe-fast'?'selected':''} onClick={()=>{setModel('xinghe-fast');setResolution('480p');}}>Fast</button></div></label>
    <label className="field"><span>画面比例</span><div className="segmented two"><button type="button" className={ratio==='9:16'?'selected':''} onClick={()=>setRatio('9:16')}>▯ 9:16 竖屏</button><button type="button" className={ratio==='16:9'?'selected':''} onClick={()=>setRatio('16:9')}>▭ 16:9 横屏</button></div></label>
    <label className="field"><div className="field-inline"><span>视频时长</span><b>{duration} 秒</b></div><input type="range" min="4" max="15" value={duration} onChange={e=>setDuration(Number(e.target.value))}/><div className="field-hint"><span>4 秒</span><span>15 秒</span></div></label>
    <label className="field"><span>分辨率</span><select value={resolution} onChange={e=>setResolution(e.target.value)}>{(model==='xinghe-fast'?['480p']:['480p','720p','1080p','4k']).map(r=><option key={r} value={r}>{r}</option>)}</select></label>
    <div className="studio-summary"><div><span>模型</span><b>{model}</b></div><div><span>参考素材</span><b>{totalMedia} 个</b></div><div><span>输出</span><b>{resolution} · {ratio}</b></div></div>
    <button className="btn btn-primary wide create-btn" disabled={busy} onClick={()=>void create()}>{busy?'正在创建任务…':<><Sparkles size={17}/> 开始生成 <ArrowRight size={17}/></>}</button>
    <p className="small-note">实际积分消耗以视频服务定价接口返回为准。创建后可以离开页面，后台继续查询任务进度。</p>
  </div></aside></div>;
}
