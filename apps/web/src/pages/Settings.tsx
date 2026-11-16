import { useEffect,useState } from 'react';
import { Activity,ArrowRight,CheckCircle2,Eye,EyeOff,KeyRound,RefreshCw,ServerCog,Shield,TriangleAlert } from 'lucide-react';
import { gql,type Org } from '../lib/api';
import { ApiAccessPanel } from '../components/ApiAccessPanel';
import './settings-api.css';
type Info={mock:boolean;pricing:string;settings:string;baseUrl:string;hasKey:boolean};
export function SettingsPage({org,onNotify}:{org:Org;onNotify:(s:string,ok?:boolean)=>void}) {
  const [info,setInfo]=useState<Info|null>(null);const [loading,setLoading]=useState(false);const [key,setKey]=useState('');const [showKey,setShowKey]=useState(false);const [busy,setBusy]=useState(false);
  const canManage=['owner','admin'].includes(org.role);
  async function load(){setLoading(true);try{const r=await gql<{providerInfo:Info}>(`query($org:ID!){providerInfo(orgId:$org){mock pricing settings baseUrl hasKey}}`,{org:org.id});setInfo(r.providerInfo);}catch(e){onNotify(e instanceof Error?e.message:'无法读取接口状态');}finally{setLoading(false);}}
  useEffect(()=>{void load();},[org.id]);
  async function save(){setBusy(true);try{await gql(`mutation($org:ID!,$key:String!){saveProviderKey(orgId:$org,key:$key)}`,{org:org.id,key});setKey('');onNotify('API 卡密已加密保存',true);await load();}catch(e){onNotify(e instanceof Error?e.message:'保存失败');}finally{setBusy(false);}}
  return <><div className="page-heading"><div><div className="section-kicker">PLATFORM CONFIGURATION</div><h1>系统设置</h1><p>配置上游视频 API，并查看当前运行环境。</p></div><button className="btn btn-ghost" onClick={()=>void load()} disabled={loading}><RefreshCw size={16} className={loading?'spin':''}/> 刷新信息</button></div>
    <div className="settings-grid"><section className="panel settings-box"><div className="setting-block-title"><div className="circle-icon purple"><ServerCog size={19}/></div><div><h2>视频生成服务</h2><p>由后端调用，卡密不会发送到浏览器</p></div></div>
      <div className="setting-row"><span>API 基础地址</span><code>{info?.baseUrl??'读取中…'}</code></div>
      <div className="setting-row"><span>服务模式</span><span className={`status-pill ${info?.mock?'warning':'success'}`}>{info?.mock?'演示模式（不生成真实视频）':'实时 API 模式'}</span></div>
      <div className="setting-row"><span>服务凭据</span><span className={`status-pill ${info?.hasKey?'success':'queued'}`}>{info?.hasKey?'已配置':'尚未配置'}</span></div>
      {info?.baseUrl.startsWith('http:')&&!info.mock&&<div className="notice danger inline"><TriangleAlert size={17}/>该上游地址使用 HTTP 明文传输，部署前建议让提供商启用 HTTPS。</div>}
      <div className="setting-divider"/>
      <h3><KeyRound size={17}/> 工作区视频 API 卡密</h3><p className="form-hint">可覆盖环境变量中的全局卡密。使用 AES-256-GCM 加密后保存在 PostgreSQL。</p>
      {canManage?<div className="key-entry"><div className="input-with-icon"><input type={showKey?'text':'password'} value={key} onChange={e=>setKey(e.target.value)} placeholder="填写新的 X-License-Key" autoComplete="off"/><button className="icon-btn" aria-label="切换卡密显示" onClick={()=>setShowKey(x=>!x)}>{showKey?<EyeOff size={17}/>:<Eye size={17}/>}</button></div><div className="key-actions"><span>输入空字符串并保存可清除工作区专属卡密</span><button className="btn btn-primary" disabled={busy} onClick={()=>void save()}>{busy?'保存中…':'保存卡密'}</button></div></div>:<div className="notice">仅工作区管理员可以修改密钥。</div>}
    </section>
    <section className="panel settings-box"><div className="setting-block-title"><div className="circle-icon blue"><Activity size={19}/></div><div><h2>实时模型及定价</h2><p>直接从上游读取，不在代码里写死积分价格</p></div></div>
      <div className="setting-json-heading"><b>GET /api/pricing</b><span>提供商返回</span></div><pre className="code-surface">{info?.pricing??'读取中…'}</pre>
      <div className="setting-json-heading"><b>GET /api/public-settings</b><span>模型开放状态</span></div><pre className="code-surface">{info?.settings??'读取中…'}</pre>
    </section></div>
    <ApiAccessPanel org={org} onNotify={onNotify}/>
    <div className="security-note"><Shield size={20}/><div><b>安全与运行说明</b><p>每次生成由后端使用工作区密钥请求上游，客户端仅通过 GraphQL 操作任务；素材文件存储于私有 Supabase Storage；用户权限按组织隔离。生产环境仍需 HTTPS、备份、监控和外部安全审计。</p></div></div>
  </>;
}
