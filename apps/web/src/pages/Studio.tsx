import { useEffect,useMemo,useRef,useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Activity, AlertTriangle, Check, CircleCheck, Clock3, RefreshCw, Clapperboard, Film, Headphones, Image as ImageIcon, Plus, Sparkles, Trash2, UploadCloud, WandSparkles } from 'lucide-react';
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
type ProviderStatus={mock:boolean;hasKey:boolean;connectionError:string|null;baseUrl:string;pricing:string;settings:string};
type ProviderModel={id:string;active:boolean;resolutions:string[]|null};
function parseModelList(raw:string):ProviderModel[]|null{
 try{
  const payload:unknown=JSON.parse(raw);
  if(!payload||typeof payload!=='object'||!('models' in payload))return null;
  const models=(payload as {models:unknown}).models;
  if(!Array.isArray(models))return null;
  return models.map(item=>{
   if(typeof item==='string')return {id:item,active:true,resolutions:null};
   if(!item||typeof item!=='object')return null;
   const model=item as Record<string,unknown>;
   const id=typeof model.id==='string'?model.id:typeof model.model==='string'?model.model:null;
   if(!id)return null;
   const rs=Array.isArray(model.resolutions)?model.resolutions.filter((x):x is string=>typeof x==='string'):null;
   return {id,active:model.enabled!==false&&model.active!==false,resolutions:rs};
  }).filter((x):x is ProviderModel=>x!==null);
 }catch{return null;}
}
const studioSteps=['项目与描述','参考素材','生成参数','确认提交'] as const;
const allowedUrls=(value:string)=>lines(value).every(item=>{try{const url=new URL(item);return url.protocol==='https:';}catch{return false;}});

export function Studio({org,projects,onCreated,onNotify}:{org:Org;projects:Project[];onCreated:(job:VideoJob)=>void;onNotify:(msg:string,success?:boolean)=>void}) {
  const {t}=useI18n();
  const [step,setStep]=useState(0);
  const [provider,setProvider]=useState<ProviderStatus|null>(null),[providerLoading,setProviderLoading]=useState(true),[providerFailure,setProviderFailure]=useState('');
  async function refreshProvider(){
    setProviderLoading(true);
    try{
      const r=await gql<{providerInfo:ProviderStatus}>(`query($orgId:ID!){providerInfo(orgId:$orgId){mock hasKey connectionError baseUrl pricing settings}}`,{orgId:org.id});
      setProvider(r.providerInfo);setProviderFailure('');
    }catch(e){setProvider(null);setProviderFailure(e instanceof Error?e.message:'接口配置读取失败');}
    finally{setProviderLoading(false);}
  }
  useEffect(()=>{setStep(0);setProvider(null);void refreshProvider();},[org.id]);
  const knownModels=useMemo(()=>provider?parseModelList(provider.settings):null,[provider?.settings]);
  const modelOptions=knownModels?knownModels.filter(x=>x.active).map(x=>x.id):['xinghe-2.0','xinghe-fast'];
  const availableResolutions=knownModels?.find(x=>x.id===model)?.resolutions;
  const resolutionOptions=availableResolutions?.length?availableResolutions:model==='xinghe-fast'?['480p']:['480p','720p','1080p','4k'];
  const configured=Boolean(provider&&!provider.mock&&provider.hasKey&&!provider.connectionError&&!providerFailure);

  const [prompt,setPrompt]=useState('');const [projectId,setProjectId]=useState('');const [model,setModel]=useState('xinghe-2.0');
  const [ratio,setRatio]=useState('9:16');const [duration,setDuration]=useState(15);const [resolution,setResolution]=useState('720p');
  const [mediaUrls,setMediaUrls]=useState<Record<Kind,string>>({image:'',audio:'',video:''});
  const [uploads,setUploads]=useState<Record<Kind,UploadedAsset[]>>({image:[],audio:[],video:[]});
  const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState<Kind|null>(null);
  const taskId=useRef(crypto.randomUUID());
  const totalMedia=Object.values(mediaUrls).reduce((n,s)=>n+lines(s).length,0)+Object.values(uploads).reduce((n,files)=>n+files.length,0);
  const imageCount=lines(mediaUrls.image).length+uploads.image.length;
  const audioCount=lines(mediaUrls.audio).length+uploads.audio.length;
  const videoCount=lines(mediaUrls.video).length+uploads.video.length;
  function validateStep(current:number):string|null{
    if(current===0&&prompt.trim().length<5)return '视频描述至少需要 5 个字符。';
    if(current===1){
      if(imageCount>9||audioCount>3||videoCount>3||totalMedia>12)return '图片最多 9、音频最多 3、视频最多 3，总共不能超过 12。';
      if(!allowedUrls(mediaUrls.image)||!allowedUrls(mediaUrls.audio)||!allowedUrls(mediaUrls.video))return '参考素材 URL 必须是可公开访问的 HTTPS 链接。';
      if(uploading)return '文件还在上传，请在上传完成后继续。';
    }
    if(current===2){
      if(!['9:16','16:9'].includes(ratio)||duration<4||duration>15)return '请检查视频比例和时长。';
      if(model==='xinghe-fast'&&resolution!=='480p')return 'xinghe-fast 只能使用 480p。';
      if(knownModels){
       const choice=knownModels.find(x=>x.id===model);
       if(!choice||!choice.active)return '所选视频模型未在当前上游开放，请刷新模型配置或更换模型。';
       if(choice.resolutions?.length&&!choice.resolutions.includes(resolution))return '所选分辨率不在当前模型允许列表。';
      }
    }
    return null;
  }
  function nextStep(){
    const reason=validateStep(step);if(reason){onNotify(reason);return;}
    setStep(s=>Math.min(3,s+1));
  }
  const ready=step===3&&configured&&!busy&&!uploading&&[0,1,2].every(s=>!validateStep(s));

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
    if(!configured){onNotify('真实 API 尚不可用：请先在后台连接服务并关闭 MOCK 模式。');return;}
    const reason=[0,1,2].map(validateStep).find(Boolean);
    if(reason){onNotify(reason);return;}
    if(!prompt.trim()){onNotify('请先输入视频内容提示词');return;}
    if(totalMedia>12){onNotify('所有参考素材合计最多 12 个');return;}
    setBusy(true);
    try {
      const input={clientTaskId:taskId.current,projectId:projectId||null,prompt,model,ratio,duration,resolution,
        imageUrls:lines(mediaUrls.image),audioUrls:lines(mediaUrls.audio),videoUrls:lines(mediaUrls.video),
        imageAssetIds:uploads.image.map(f=>f.id),audioAssetIds:uploads.audio.map(f=>f.id),videoAssetIds:uploads.video.map(f=>f.id)};
      const result=await gql<{createVideoJob:VideoJob}>(`mutation Create($orgId:ID!,$input:VideoJobInput!){createVideoJob(orgId:$orgId,input:$input){id orgId projectId clientTaskId providerTaskId prompt model duration ratio resolution status progress requiredCredits billingStatus videoUrl errorCode errorMessage isDemo imageUrls audioUrls videoUrls createdAt submittedAt finishedAt updatedAt}}`,{orgId:org.id,input});
      taskId.current=crypto.randomUUID();onCreated(result.createVideoJob);setStep(0);
    }catch(error){onNotify(error instanceof Error?error.message:'任务创建失败');}
    finally{setBusy(false);}
  }
  return <div className="studio-grid"><div className="studio-main">
    <nav className="studio-workflow-steps" aria-label="视频生成步骤">
      {studioSteps.map((title,index)=><button type="button" key={title} disabled={index>step}
        className={index===step?'active':index<step?'done':''} onClick={()=>setStep(index)}>
        <span>{index<step?<Check size={14}/>:index+1}</span>{title}</button>)}
    </nav>
    <section className="studio-provider-bar" aria-live="polite"><div><Activity size={18}/>
      <b>{providerLoading?'检查 API 连接…':configured?'实时生成服务已连接':provider?.mock?'MOCK 演示模式（不会生成真实视频）':'实时 API 尚未就绪'}</b>
      <small>{providerFailure||provider?.connectionError||(configured?'定价与模型配置已从服务器读取':'请在 Admin API Integration 配置密钥、路由与 HTTPS 服务')}</small>
    </div><button className="btn btn-ghost" type="button" disabled={providerLoading} onClick={()=>void refreshProvider()}><RefreshCw size={14}/>刷新接口</button></section>
    {step===0&&<>
    <div className="section-kicker"><Sparkles size={14}/> AI VIDEO STUDIO</div>
    <h1>创建视频 <span className="gradient-text">让创意动起来</span></h1>
    <p className="page-intro">使用文字与多模态参考素材，生成一致性更高的视频镜头。</p>
    <section className="panel studio-panel"><div className="panel-heading"><div><h2><WandSparkles size={18}/> 视频描述</h2><p>说明主体、场景、镜头运动与需要保留的细节</p></div><span className="info-chip">必填</span></div>
      <textarea className="prompt-editor" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={5000} placeholder="例如：雨后的城市街道，固定角色从咖啡店走出。采用电影级写实光照，镜头缓缓推进，保留参考图片中的角色服装、五官与环境细节。无需字幕。"/>
      <div className="text-counter">{prompt.length} / 5000</div>
    </section>
    <div className="studio-step-actions"><button className="btn btn-primary" type="button" onClick={nextStep}>下一步：参考素材 <ArrowRight size={16}/></button></div></>}
    {step===1&&<section className="panel studio-panel"><div className="panel-heading"><div><h2><ImageIcon size={18}/> 参考素材</h2><p>支持直接上传文件，或提供可公开访问的素材链接（建议 HTTPS）</p></div><span className="info-chip">{totalMedia}/12</span></div>
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
    </section>}
    {step===1&&<div className="studio-step-actions"><button className="btn btn-ghost" type="button" onClick={()=>setStep(0)}><ArrowLeft size={15}/>上一步</button><button className="btn btn-primary" type="button" onClick={nextStep}>下一步：生成设置 <ArrowRight size={16}/></button></div>}
    {step===2&&<section className="panel studio-panel"><div className="panel-heading"><div><h2><Clapperboard size={18}/> 生成参数</h2><p>右侧生成设置与所选项目将用于创建真实视频任务。</p></div></div>
      <p className="small-note">参考素材：图片 {imageCount}/9 · 音频 {audioCount}/3 · 视频 {videoCount}/3 · 合计 {totalMedia}/12。</p>
      <p className="small-note">支持的模型和定价必须以上游 /api/public-settings 与 /api/pricing 实际响应为准；不会写死收费数字。</p>
      {provider&&<details className="studio-raw-provider"><summary>查看上游模型配置与价格（真实接口返回）</summary><b>Public Settings</b><pre>{provider.settings}</pre><b>Pricing</b><pre>{provider.pricing}</pre></details>}
      <div className="studio-step-actions"><button className="btn btn-ghost" type="button" onClick={()=>setStep(1)}><ArrowLeft size={15}/>上一步</button><button className="btn btn-primary" type="button" onClick={nextStep}>下一步：确认提交 <ArrowRight size={16}/></button></div>
    </section>}
    {step===3&&<section className="panel studio-panel"><div className="panel-heading"><div><h2><CircleCheck size={18}/> 提交前检查</h2><p>这一步会向真实后端发起创建任务，不是预览按钮。</p></div></div>
      <div className="studio-review-list"><div><span>所属项目</span><b>{projects.find(p=>p.id===projectId)?.name??'未分类任务'}</b></div>
      <div><span>视频模型</span><b>{model}</b></div><div><span>输出参数</span><b>{duration} 秒 · {ratio} · {resolution}</b></div>
      <div><span>参考素材</span><b>图片 {imageCount} / 音频 {audioCount} / 视频 {videoCount}</b></div>
      <div><span>任务请求 ID</span><code>{taskId.current}</code></div></div>
      {!configured&&<div className="notice danger inline"><AlertTriangle size={16}/>不能发起真实生成：服务模式、上游认证或 API 连接尚未就绪。</div>}
      <p className="small-note"><Clock3 size={14}/> 提交成功后任务会显示在「生成任务」中。提交不等于视频已完成；状态需后台轮询。网络异常时保持任务 ID，不要反复点击制造重复计费。</p>
      <div className="studio-step-actions"><button className="btn btn-ghost" type="button" onClick={()=>setStep(2)}><ArrowLeft size={15}/>修改参数</button></div>
    </section>}
  </div><aside className="studio-aside"><div className="panel setting-card sticky"><div className="panel-heading"><div><h2><Clapperboard size={18}/> 生成设置</h2><p>配置模型、时长与输出格式</p></div></div>
    <label className="field"><span>所属项目</span><select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">未分类任务</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="field"><span>视频模型 · {knownModels?'上游开放列表':'151 推荐模型'}</span><select value={model} disabled={!modelOptions.length} onChange={e=>{const id=e.target.value;setModel(id);const available=knownModels?.find(m=>m.id===id)?.resolutions;setResolution(available?.[0]??(id==='xinghe-fast'?'480p':'720p'));}}>
      {!modelOptions.includes(model)&&<option value={model}>{model} · 当前不可用</option>}
      {modelOptions.map(id=><option key={id} value={id}>{id}</option>)}
    </select></label>
    <label className="field"><span>画面比例</span><div className="segmented two"><button type="button" className={ratio==='9:16'?'selected':''} onClick={()=>setRatio('9:16')}>▯ 9:16 竖屏</button><button type="button" className={ratio==='16:9'?'selected':''} onClick={()=>setRatio('16:9')}>▭ 16:9 横屏</button></div></label>
    <label className="field"><div className="field-inline"><span>视频时长</span><b>{duration} 秒</b></div><input type="range" min="4" max="15" value={duration} onChange={e=>setDuration(Number(e.target.value))}/><div className="field-hint"><span>4 秒</span><span>15 秒</span></div></label>
    <label className="field"><span>分辨率</span><select value={resolution} onChange={e=>setResolution(e.target.value)}>{!resolutionOptions.includes(resolution)&&<option value={resolution}>{resolution} · 当前不支持</option>}{resolutionOptions.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
    <div className="studio-summary"><div><span>模型</span><b>{model}</b></div><div><span>参考素材</span><b>{totalMedia} 个</b></div><div><span>输出</span><b>{resolution} · {ratio}</b></div></div>
    {step===2&&<button className="btn btn-primary wide create-btn" onClick={nextStep}>确认生成参数 <ArrowRight size={17}/></button>}
    {step===3&&<button className="btn btn-primary wide create-btn" disabled={!ready} onClick={()=>void create()}>{busy?'提交中…':<><Sparkles size={17}/> 提交真实生成任务 <ArrowRight size={17}/></>}</button>}
    {step!==2&&step!==3&&<p className="small-note">先完成左侧创作步骤，再确认并提交任务。</p>}
    <p className="small-note">实际积分消耗以视频服务定价接口返回为准。创建后可以离开页面，后台继续查询任务进度。</p>
  </div></aside></div>;
}
