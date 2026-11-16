import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {ArrowLeft,ArrowRight,Check,ChevronDown,Clapperboard,Clock3,Compass,Film,FolderOpen,Grid2X2,Image as ImageIcon,Images,Info,Layers3,Menu,PanelLeftClose,Play,Plus,Settings2,ShieldCheck,Sparkles,UploadCloud,Video,WandSparkles,X} from 'lucide-react';
import {LanguageSelect,useI18n,type Locale} from '../i18n';
import './video-creation-preview.css';

type Mode='image'|'text'|'story';
type Pane='create'|'explore'|'library';
type Asset={id:number;url:string;name:string};
type Localized={zh:string;en:string;es:string};
type Scene={id:string;title:Localized;image:string;description:Localized;color:string;tag:string};

const scenes:Scene[]=[
 {id:'city',title:{zh:'雨夜霓虹',en:'Neon After Dark',es:'Neón de medianoche'},description:{zh:'雨夜城市，霓虹灯在湿润的街面反射，镜头缓慢向前推进，电影级色调。',en:'Rain-soaked neon streets at night, luminous reflections on the pavement, slow cinematic camera push-in.',es:'Calles mojadas bajo luces de neón por la noche, reflejos brillantes y avance lento de cámara cinematográfica.'},image:'https://images.unsplash.com/photo-1668613962618-b389448296c9?auto=format&fit=crop&w=1500&q=85',color:'#aa60df',tag:'CINEMATIC'},
 {id:'desert',title:{zh:'金色沙丘',en:'Golden Dunes',es:'Dunas doradas'},description:{zh:'夕阳下的广阔沙丘，风在沙脊上流动，航拍镜头缓慢上升。',en:'Vast desert dunes at golden hour, wind across sand ridges, a slow rising aerial shot.',es:'Dunas inmensas al atardecer, viento sobre la arena y una toma aérea que asciende lentamente.'},image:'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1500&q=85',color:'#df9368',tag:'LANDSCAPE'},
 {id:'mountain',title:{zh:'山间晨雾',en:'Into the Mist',es:'Entre la niebla'},description:{zh:'晨雾笼罩高山湖泊，云层掠过山谷，摄影机轻柔横移。',en:'A mist-covered mountain lake at dawn, drifting clouds and a gentle cinematic tracking shot.',es:'Lago de montaña con niebla al amanecer, nubes en movimiento y un suave desplazamiento de cámara.'},image:'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1500&q=85',color:'#79aab8',tag:'NATURE'},
 {id:'aurora',title:{zh:'极光之夜',en:'Aurora Nights',es:'Noches de aurora'},description:{zh:'极光在星空中缓慢起伏，镜头由雪地向天空抬升。',en:'Northern lights drifting across a star-filled sky as the camera tilts up from snowy ground.',es:'Auroras boreales bajo un cielo estrellado mientras la cámara se eleva desde un paisaje nevado.'},image:'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1500&q=85',color:'#4ed6b9',tag:'FANTASY'},
 {id:'ocean',title:{zh:'海岸微光',en:'Coastal Light',es:'Luz costera'},description:{zh:'海浪拍打岩石海岸，晨光穿透云层，镜头缓慢向外拉远。',en:'Ocean waves wash against a rugged coast as dawn breaks through clouds; slow cinematic pull-back.',es:'Olas rompen en la costa rocosa mientras amanece; movimiento lento de cámara hacia atrás.'},image:'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1500&q=85',color:'#68b8e0',tag:'TRAVEL'},
 {id:'forest',title:{zh:'森林深处',en:'Forest Stories',es:'Historias del bosque'},description:{zh:'阳光穿过繁茂森林，空气中漂浮微尘，稳定器镜头穿过林间小径。',en:'Sunlight filters through a deep forest, dust motes in the air, smooth camera glide along a woodland trail.',es:'Rayos de sol atraviesan un bosque, partículas flotando y cámara deslizándose por un sendero.'},image:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1500&q=85',color:'#90b379',tag:'NATURE'}
];

const strings={
 zh:{
  newCreation:'新建创作',explore:'灵感探索',library:'我的素材',admin:'管理后台',studio:'视频创作工作台',
  work:'创作空间',title:'让想象动起来。',subtitle:'从文字、图片到连续镜头，在同一个画布中构思你的下一段作品。',
  model:'视频模型',modelDemo:'AutoJuben · 演示模式',type:'创作方式',image:'图生视频',text:'文生视频',story:'九图故事板',
  reference:'参考图片',upload:'添加图片',optional:'可选',nine:'最多 9 张',storyHelp:'依次上传至多 9 张参考图，规划镜头衔接。',imageHelp:'上传参考图片，引导视频的角色、构图和风格。',textHelp:'仅用文字描述你的场景及镜头运动。',
  prompt:'描述你想创作的画面',placeholder:'例如：雨后的东京街头，霓虹灯映在水面上。镜头缓慢推进，电影级氛围光，真实细节……',
  settings:'生成设置',ratio:'画面比例',duration:'时长',quality:'清晰度',motion:'镜头运动强度',low:'轻柔',high:'强烈',
  create:'模拟生成',notReal:'仅用于界面演示，不会调用真实生成 API 或扣费。',preview:'预览画布',sample:'示例画面 · 非生成视频',
  sampleStill:'静态样例画面',sampleOnly:'演示素材',frame:'画面',frames:'故事帧',promptDetails:'创作描述',details:'镜头设置',
  gallery:'创作灵感',gallerySub:'点击样例，自动填入创作描述并切换预览。',selected:'已选择',choose:'使用灵感',noAssets:'还没有上传素材',noAssetsDesc:'添加一些参考图，它们会临时出现在这里，不会上传至服务器。',
  simulateSuccess:'已模拟一条生成任务。演示模式不会生成真实视频。',choosePrompt:'请先填写创作描述或选择一张灵感样例。',tooMany:'最多支持 9 张图片。',fileTooBig:'每张图片不能超过 12 MB。',
  imageRemoved:'图片已移除',add:'添加',remove:'移除',more:'更多灵感',all:'全部',recent:'参考画面',sampleWorkflow:'9 帧分镜',
  status:'预览模式',login:'登录正式平台',assetNotice:'已选择的图片只保存在此浏览器页面。',new:'创建',footnote:'AutoJuben Studio · 设计预览',style:'创作方式',showPanel:'打开创作设置',hidePanel:'收起设置',credits:'积分未连接',mobilePanel:'创作设置',empty:'点击添加参考图',
  ratioNotice:'预览按所选比例展示；真实任务需连接后端。',demoLabel:'这不是实际视频播放或真实生成结果。',referenceCount:'参考图',noData:'样例演示，不是用户数据。'
 },
 en:{
  newCreation:'New creation',explore:'Explore',library:'My assets',admin:'Admin console',studio:'Video creation studio',
  work:'Creator workspace',title:'Make imagination move.',subtitle:'From a single idea to a sequence of shots, create on a canvas made for video.',
  model:'Video model',modelDemo:'AutoJuben · Demo mode',type:'Creation mode',image:'Image to Video',text:'Text to Video',story:'9-Frame Storyboard',
  reference:'Reference images',upload:'Add images',optional:'Optional',nine:'Up to 9 images',storyHelp:'Upload up to 9 reference frames in order to plan your sequence.',imageHelp:'Use reference images to guide subjects, composition and style.',textHelp:'Describe your scene and camera motion using text alone.',
  prompt:'Describe your video',placeholder:'For example: Neon reflections on Tokyo streets after rain. Slow camera push-in, cinematic lighting and realistic detail…',
  settings:'Generation settings',ratio:'Aspect ratio',duration:'Duration',quality:'Resolution',motion:'Motion intensity',low:'Subtle',high:'Dynamic',
  create:'Simulate generation',notReal:'UI demo only — no real generation API calls or credit charges.',preview:'Preview canvas',sample:'Sample artwork · Not generated video',
  sampleStill:'Static sample frame',sampleOnly:'Demo media',frame:'Frame',frames:'Storyboard frames',promptDetails:'Scene prompt',details:'Shot settings',
  gallery:'Creative inspiration',gallerySub:'Select a scene to fill in the prompt and change the preview.',selected:'Selected',choose:'Use inspiration',noAssets:'No references yet',noAssetsDesc:'Add reference images to see them here. Files stay in this browser session.',
  simulateSuccess:'Demo job simulated. No real video was generated.',choosePrompt:'Write a scene prompt or select an inspiration sample first.',tooMany:'Maximum 9 images.',fileTooBig:'Each image must be under 12 MB.',
  imageRemoved:'Image removed',add:'Add',remove:'Remove',more:'More inspiration',all:'All',recent:'Reference frames',sampleWorkflow:'9-shot sequence',
  status:'Preview mode',login:'Open live sign in',assetNotice:'Selected images are only held in this browser page.',new:'Create',footnote:'AutoJuben Studio · Design preview',style:'Creation mode',showPanel:'Open creator controls',hidePanel:'Hide controls',credits:'Credits not connected',mobilePanel:'Creator controls',empty:'Click to add reference',
  ratioNotice:'The preview reflects your chosen ratio; real jobs require the backend.',demoLabel:'Not a playable video or a real generation result.',referenceCount:'References',noData:'Sample media, not user data.'
 },
 es:{
  newCreation:'Nueva creación',explore:'Explorar',library:'Mis recursos',admin:'Panel de administración',studio:'Estudio de creación de vídeo',
  work:'Espacio creativo',title:'Da vida a tu imaginación.',subtitle:'De una idea a una secuencia de tomas, crea en un lienzo pensado para el vídeo.',
  model:'Modelo de vídeo',modelDemo:'AutoJuben · Modo demo',type:'Modo de creación',image:'Imagen a vídeo',text:'Texto a vídeo',story:'Guion de 9 fotogramas',
  reference:'Imágenes de referencia',upload:'Añadir imágenes',optional:'Opcional',nine:'Hasta 9 imágenes',storyHelp:'Sube hasta 9 fotogramas de referencia en orden para planificar tu secuencia.',imageHelp:'Usa imágenes para guiar personajes, composición y estilo.',textHelp:'Describe tu escena y el movimiento de cámara solo con texto.',
  prompt:'Describe tu vídeo',placeholder:'Por ejemplo: Reflejos de neón en Tokio tras la lluvia. Cámara avanzando lentamente, iluminación cinematográfica y detalle realista…',
  settings:'Ajustes de generación',ratio:'Relación de aspecto',duration:'Duración',quality:'Resolución',motion:'Intensidad del movimiento',low:'Suave',high:'Dinámica',
  create:'Simular generación',notReal:'Solo demostración: sin llamadas a API ni cargos de créditos.',preview:'Lienzo de vista previa',sample:'Imagen de ejemplo · No es un vídeo generado',
  sampleStill:'Fotograma de ejemplo',sampleOnly:'Medios de demostración',frame:'Fotograma',frames:'Fotogramas de guion',promptDetails:'Descripción de escena',details:'Ajustes de toma',
  gallery:'Inspiración creativa',gallerySub:'Elige una escena para completar el texto y cambiar la vista previa.',selected:'Seleccionada',choose:'Usar inspiración',noAssets:'Todavía no hay referencias',noAssetsDesc:'Añade imágenes para verlas aquí. Los archivos se quedan en el navegador.',
  simulateSuccess:'Trabajo de demostración simulado. No se generó un vídeo real.',choosePrompt:'Primero escribe una descripción o elige una escena.',tooMany:'Máximo de 9 imágenes.',fileTooBig:'Cada imagen debe pesar menos de 12 MB.',
  imageRemoved:'Imagen eliminada',add:'Añadir',remove:'Eliminar',more:'Más inspiración',all:'Todo',recent:'Fotogramas de referencia',sampleWorkflow:'Secuencia de 9 planos',
  status:'Modo de vista previa',login:'Abrir acceso real',assetNotice:'Las imágenes solo se guardan en esta página del navegador.',new:'Crear',footnote:'AutoJuben Studio · Vista previa de diseño',style:'Modo de creación',showPanel:'Abrir controles',hidePanel:'Ocultar controles',credits:'Créditos sin conectar',mobilePanel:'Controles de creación',empty:'Añadir una imagen',
  ratioNotice:'La vista respeta la proporción elegida; los trabajos reales requieren backend.',demoLabel:'No es un vídeo reproducible ni un resultado real.',referenceCount:'Referencias',noData:'Medios de ejemplo, no datos de usuario.'
 }
} as const;

type TranslationKey=keyof typeof strings.zh;
const identity=(locale:Locale,copy:Localized)=>copy[locale];
export function VideoCreationPreview(){
 const {locale}=useI18n();
 const t=(key:TranslationKey):string=>strings[locale][key];
 const [pane,setPane]=useState<Pane>('create');
 const [mode,setMode]=useState<Mode>('image');
 const [ratio,setRatio]=useState('16:9');
 const [duration,setDuration]=useState(8);
 const [quality,setQuality]=useState('1080p');
 const [motion,setMotion]=useState(45);
 const [prompt,setPrompt]=useState('');
 const [current,setCurrent]=useState(scenes[0].id);
 const [uploads,setUploads]=useState<Asset[]>([]);
 const [activeUpload,setActiveUpload]=useState<number|null>(null);
 const [panelOpen,setPanelOpen]=useState(false);
 const [notice,setNotice]=useState('');
 const uploadRef=useRef<HTMLInputElement>(null);
 const urlsRef=useRef<string[]>([]);
 const scene=scenes.find(s=>s.id===current)??scenes[0];
 const title=identity(locale,scene.title);
 const image=activeUpload===null?scene.image:uploads.find(a=>a.id===activeUpload)?.url??scene.image;
 const ratioStyle=ratio==='9:16'?'9 / 16':ratio==='1:1'?'1 / 1':'16 / 9';
 const emptySlots=Array.from({length:mode==='story'?9:1},(_,i)=>i);
 useEffect(()=>()=>{for(const url of urlsRef.current)URL.revokeObjectURL(url);},[]);
 function selectScene(s:Scene){setCurrent(s.id);setActiveUpload(null);setPrompt(identity(locale,s.description));setPane('create');setNotice('');}
 function addImages(e:ChangeEvent<HTMLInputElement>){
  const all=Array.from(e.target.files??[]).filter(f=>f.type.startsWith('image/'));
  e.currentTarget.value='';
  if(!all.length)return;
  if(uploads.length+all.length>9){setNotice(t('tooMany'));return;}
  if(all.some(f=>f.size>12*1024*1024)){setNotice(t('fileTooBig'));return;}
  const assets=all.map(f=>{const url=URL.createObjectURL(f);urlsRef.current.push(url);return {id:Date.now()+Math.floor(Math.random()*100000),url,name:f.name};});
  setUploads(old=>[...old,...assets]);setActiveUpload(assets[0].id);setNotice('');
 }
 function removeAsset(id:number){const asset=uploads.find(a=>a.id===id);if(asset){URL.revokeObjectURL(asset.url);urlsRef.current=urlsRef.current.filter(u=>u!==asset.url);}setUploads(old=>old.filter(a=>a.id!==id));if(activeUpload===id)setActiveUpload(null);setNotice(t('imageRemoved'));}
 function runDemo(){if(!prompt.trim()){setNotice(t('choosePrompt'));return;}setNotice(t('simulateSuccess'));}
 const modeButton=(key:Mode,label:string,Icon:typeof ImageIcon)=><button type="button" key={key} className={'vc-mode-btn '+(mode===key?'active':'')} onClick={()=>{setMode(key);setNotice('');}}><Icon size={16}/><span>{label}</span></button>;
 return <div className="vc-shell">
   <nav className="vc-rail" aria-label="Workspace">
     <a href="/preview/frontend" className="vc-brand" title="AutoJuben"><Clapperboard size={24}/></a>
     <div className="vc-rail-divider"/>
     <button aria-label={t('newCreation')} title={t('newCreation')} className={pane==='create'?'vc-rail-active':''} onClick={()=>{setPane('create');setPanelOpen(false);}}><Plus size={22}/></button>
     <button aria-label={t('explore')} title={t('explore')} className={pane==='explore'?'vc-rail-active':''} onClick={()=>{setPane('explore');setPanelOpen(false);}}><Compass size={21}/></button>
     <button aria-label={t('library')} title={t('library')} className={pane==='library'?'vc-rail-active':''} onClick={()=>{setPane('library');setPanelOpen(false);}}><FolderOpen size={21}/></button>
     <div className="vc-rail-bottom"><a href="/preview/backend" title={t('admin')} aria-label={t('admin')}><Settings2 size={21}/></a><a href="/" title={t('login')} aria-label={t('login')}><ArrowRight size={21}/></a></div>
   </nav>
   {pane==='create'&&<aside className={'vc-controls '+(panelOpen?'vc-controls-open':'')}>
     <div className="vc-controls-top"><span><Sparkles size={16}/>{t('newCreation')}</span><button className="vc-panel-close" onClick={()=>setPanelOpen(false)} title={t('hidePanel')}><X size={17}/></button></div>
     <div className="vc-controls-scroll">
       <div className="vc-control-group vc-control-intro"><div className="vc-group-title"><span>{t('type')}</span></div><div className="vc-modes">{modeButton('image',t('image'),ImageIcon)}{modeButton('text',t('text'),Film)}{modeButton('story',t('story'),Layers3)}</div></div>
       <div className="vc-control-group"><div className="vc-group-title"><span>{t('model')}</span></div><div className="vc-model"><span className="vc-model-orb"><Sparkles size={18}/></span><span>{t('modelDemo')}<small>{t('status')}</small></span><ChevronDown size={15}/></div></div>
       {mode!=='text'&&<div className="vc-control-group">
         <div className="vc-group-title"><span>{t('reference')}</span><span className="vc-group-meta">{uploads.length}/9</span></div>
         <p className="vc-help">{t(mode==='story'?'storyHelp':'imageHelp')}</p>
         <div className={'vc-reference-grid '+(mode==='story'?'vc-nine-grid':'')}>
           {uploads.map((asset,i)=><div className="vc-upload-item" key={asset.id}><button className="vc-upload-image" onClick={()=>{setActiveUpload(asset.id);setPane('create');}} title={asset.name}><img src={asset.url} alt={asset.name}/><span>{i+1}</span></button><button className="vc-remove" onClick={()=>removeAsset(asset.id)} aria-label={t('remove')} title={t('remove')}><X size={12}/></button></div>)}
           {uploads.length<9&&emptySlots.slice(0,Math.max(1,mode==='story'?9-uploads.length:1)).map((index)=><button type="button" className="vc-upload-empty" key={'empty-'+index} onClick={()=>uploadRef.current?.click()} title={t('upload')}><Plus size={21}/>{mode!=='story'&&<small>{t('upload')}</small>}</button>)}
         </div>
         <input ref={uploadRef} className="vc-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addImages}/>
         <div className="vc-attach-note"><UploadCloud size={13}/>{t('nine')}</div>
       </div>}
       <div className="vc-control-group"><div className="vc-group-title"><span>{t('prompt')}</span><span className="vc-group-meta">{prompt.length}/2000</span></div><textarea maxLength={2000} rows={5} placeholder={t('placeholder')} value={prompt} onChange={e=>setPrompt(e.target.value)} className="vc-prompt"/><p className="vc-help">{t(mode==='text'?'textHelp':'promptDetails')}</p></div>
       <div className="vc-control-group vc-settings"><div className="vc-group-title"><span>{t('settings')}</span><Settings2 size={14}/></div>
         <div className="vc-setting-row"><span>{t('ratio')}</span><div className="vc-chip-group">{['16:9','9:16','1:1'].map(r=><button key={r} className={ratio===r?'vc-chip-active':''} onClick={()=>setRatio(r)}>{r}</button>)}</div></div>
         <div className="vc-setting-row"><span>{t('duration')}</span><div className="vc-chip-group">{[5,8,10].map(n=><button key={n} className={duration===n?'vc-chip-active':''} onClick={()=>setDuration(n)}>{n}s</button>)}</div></div>
         <div className="vc-setting-row"><span>{t('quality')}</span><div className="vc-chip-group">{['720p','1080p'].map(q=><button key={q} className={quality===q?'vc-chip-active':''} onClick={()=>setQuality(q)}>{q}</button>)}</div></div>
         <div className="vc-motion-title"><span>{t('motion')}</span><strong>{motion}%</strong></div><input type="range" min="0" max="100" value={motion} onChange={e=>setMotion(Number(e.target.value))} aria-label={t('motion')} className="vc-motion-input"/><div className="vc-motion-ends"><span>{t('low')}</span><span>{t('high')}</span></div>
       </div>
     </div>
     <div className="vc-controls-footer"><button className="vc-generate" onClick={runDemo}><WandSparkles size={19}/><span>{t('create')}</span><ArrowRight size={17}/></button><p><ShieldCheck size={14}/>{t('notReal')}</p></div>
   </aside>}
   {panelOpen&&pane==='create'&&<button className="vc-mobile-backdrop" onClick={()=>setPanelOpen(false)} aria-label={t('hidePanel')}/>}
   <main className="vc-workspace">
     <header className="vc-topbar"><div className="vc-top-left">{pane==='create'&&<button className="vc-mobile-toggle" onClick={()=>setPanelOpen(true)} title={t('showPanel')}><Menu size={21}/></button>}<span className="vc-breadcrumb">{t('work')}</span><ChevronDown size={13}/><strong>{pane==='create'?t('newCreation'):pane==='explore'?t('explore'):t('library')}</strong></div><div className="vc-top-right"><span className="vc-preview-pill"><span/>{t('status')}</span><LanguageSelect compact/><a href="/preview/backend" className="vc-admin-link">{t('admin')}<ArrowRight size={14}/></a></div></header>
     <div className="vc-canvas-scroll">
       <div className="vc-heading"><span className="vc-eyebrow"><Sparkles size={14}/> AUTOJUBEN / CREATIVE STUDIO</span><h1>{t('title')}</h1><p>{t('subtitle')}</p></div>
       {pane==='create'&&<div className="vc-work-grid">
         <section className="vc-stage-card"><div className="vc-stage-head"><div><span className="vc-stage-head-icon"><Video size={17}/></span><b>{t('preview')}</b><small>{t('sample')}</small></div><span className="vc-render-tag"><span/>{t('sampleOnly')}</span></div>
           <div className="vc-stage-body"><div className={'vc-media-frame '+(ratio==='9:16'?'vc-portrait':ratio==='1:1'?'vc-square':'vc-landscape')} style={{aspectRatio:ratioStyle}}>
               <img className="vc-main-image" src={image} alt={title}/><span className="vc-media-gradient"/>
               <span className="vc-frame-top"><Film size={14}/>{t('sampleStill')}</span>
               <div className="vc-frame-center"><span className="vc-fake-play"><Play size={29} fill="currentColor"/></span><div className="vc-frame-warning">{t('demoLabel')}</div></div>
               <div className="vc-frame-bottom"><div><span>{t('frame')} / 01</span><h2>{activeUpload!==null?uploads.find(a=>a.id===activeUpload)?.name??title:title}</h2></div><span>{ratio} · {duration}s · {quality}</span></div>
             </div></div>
           <div className="vc-filmstrip-head"><span><Layers3 size={16}/>{t('frames')}</span><small>{t('sampleWorkflow')}</small></div>
           <div className="vc-filmstrip">{Array.from({length:9},(_,i)=>{const u=uploads[i];const s=scenes[i%scenes.length];return <button key={i} className={'vc-film-cell '+(u&&activeUpload===u.id?'vc-film-active':'')} title={u?.name??identity(locale,s.title)} onClick={()=>{if(u)setActiveUpload(u.id);else {setActiveUpload(null);setCurrent(s.id);}}}><img src={u?.url??s.image} alt={u?.name??identity(locale,s.title)}/><span>{String(i+1).padStart(2,'0')}</span></button>;})}</div>
           <div className="vc-stage-meta"><span><Info size={14}/>{t('ratioNotice')}</span><span>{t('referenceCount')}: {uploads.length}/9</span></div>
         </section>
         <section className="vc-inspiration">
           <div className="vc-section-head"><div><span className="vc-eyebrow">DISCOVER</span><h2>{t('gallery')}</h2><p>{t('gallerySub')}</p></div><button onClick={()=>setPane('explore')}>{t('more')}<ArrowRight size={14}/></button></div>
           <div className="vc-sample-grid">{scenes.slice(0,4).map(s=><button key={s.id} className={'vc-sample-tile '+(current===s.id&&activeUpload===null?'vc-sample-selected':'')} onClick={()=>selectScene(s)}><img src={s.image} loading="lazy" alt={identity(locale,s.title)}/><span className="vc-tile-overlay"/><span className="vc-tile-tag">{s.tag}</span><strong>{identity(locale,s.title)}</strong><span className="vc-tile-arrow"><ArrowRight size={15}/></span></button>)}</div>
         </section>
       </div>}
       {pane==='explore'&&<section className="vc-explore-page"><div className="vc-section-head"><div><span className="vc-eyebrow">INSPIRATION / SAMPLE FRAMES</span><h2>{t('gallery')}</h2><p>{t('gallerySub')}</p></div></div><div className="vc-discover-grid">{scenes.map(s=><button key={s.id} className="vc-discover-tile" onClick={()=>selectScene(s)}><img src={s.image} loading="lazy" alt={identity(locale,s.title)}/><span className="vc-tile-overlay"/><span className="vc-tile-tag">{s.tag}</span><span className="vc-discover-caption"><strong>{identity(locale,s.title)}</strong><small>{t('choose')} <ArrowRight size={14}/></small></span></button>)}</div></section>}
       {pane==='library'&&<section className="vc-library-page"><div className="vc-section-head"><div><span className="vc-eyebrow">ASSETS / LOCAL ONLY</span><h2>{t('library')}</h2><p>{t('assetNotice')}</p></div><button onClick={()=>{setPane('create');setPanelOpen(true);}}><Plus size={15}/>{t('add')}</button></div>{uploads.length>0?<div className="vc-discover-grid">{uploads.map(a=><button className="vc-discover-tile" key={a.id} onClick={()=>{setActiveUpload(a.id);setPane('create');}}><img src={a.url} alt={a.name}/><span className="vc-tile-overlay"/><span className="vc-discover-caption"><strong>{a.name}</strong><small>{t('choose')} <ArrowRight size={14}/></small></span></button>)}</div>:<div className="vc-empty-library"><div className="vc-empty-icon"><Images size={42}/></div><h2>{t('noAssets')}</h2><p>{t('noAssetsDesc')}</p><button onClick={()=>{setPane('create');setPanelOpen(true);}}><Plus size={17}/>{t('upload')}</button></div>}</section>}
       {notice&&<div role="status" className="vc-notice"><Info size={17}/>{notice}<button aria-label="Dismiss" onClick={()=>setNotice('')}><X size={14}/></button></div>}
       <footer className="vc-foot"><span>{t('footnote')}</span><span>{t('noData')}</span></footer>
     </div>
   </main>
 </div>;
}
