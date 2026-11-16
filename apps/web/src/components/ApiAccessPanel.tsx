import {useEffect,useState} from 'react';
import {Copy,KeyRound,RefreshCw,Trash2} from 'lucide-react';
import {gql,type Org} from '../lib/api';
type ApiKey={id:string;orgId:string;label:string;prefix:string;scopes:string[];createdAt:string;expiresAt:string;lastUsedAt:string|null;revokedAt:string|null};
type Issued=ApiKey&{token:string};
export function ApiAccessPanel({org,onNotify}:{org:Org;onNotify:(msg:string,ok?:boolean)=>void}){
 const canManage=['owner','admin'].includes(org.role);
 const [keys,setKeys]=useState<ApiKey[]>([]),[newToken,setNewToken]=useState(''),[label,setLabel]=useState('Integration'),
 [scope,setScope]=useState<'read'|'write'>('read'),[days,setDays]=useState(90),[busy,setBusy]=useState(false),
 [protocol,setProtocol]=useState<'REST'|'JSON'|'GraphQL'>('REST');
 async function reload(){if(!canManage)return;
  try{const r=await gql<{apiKeys:ApiKey[]}>(`query($orgId:ID!){apiKeys(orgId:$orgId){id orgId label prefix scopes createdAt expiresAt lastUsedAt revokedAt}}`,{orgId:org.id});setKeys(r.apiKeys);}
  catch(e){onNotify(e instanceof Error?e.message:'无法加载 API Keys');}}
 useEffect(()=>{setNewToken('');void reload();},[org.id,canManage]);
 async function create(){setBusy(true);try{
  const r=await gql<{createApiKey:Issued}>(`mutation($orgId:ID!,$label:String!,$scope:String!,$days:Int!){createApiKey(orgId:$orgId,label:$label,scope:$scope,expiresInDays:$days){id token}}`,{orgId:org.id,label,scope,days});
  setNewToken(r.createApiKey.token);onNotify('API Key 已签发，只会显示一次。',true);await reload();
 }catch(e){onNotify(e instanceof Error?e.message:'API Key 创建失败');}finally{setBusy(false);}}
 async function revoke(id:string){setBusy(true);try{
  await gql(`mutation($orgId:ID!,$id:ID!){revokeApiKey(orgId:$orgId,id:$id)}`,{orgId:org.id,id});
  setNewToken('');await reload();onNotify('API Key 已撤销',true);
 }catch(e){onNotify(e instanceof Error?e.message:'撤销失败');}finally{setBusy(false);}}
 const snippets:{[K in typeof protocol]:string}={
 REST:`curl -H "Authorization: Bearer YOUR_API_KEY" \\\n  "https://YOUR_DOMAIN/api/v1/organizations/${org.id}/projects"`,
 JSON:`curl -X POST "https://YOUR_DOMAIN/api/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"operation":"projects","params":{"orgId":"${org.id}"}}'`,
 GraphQL:`curl -X POST "https://YOUR_DOMAIN/graphql" \\\n  -H "Content-Type: application/json" \\\n  -H "X-SaaS-Client: web" -H "Cookie: aj_session=YOUR_SESSION" \\\n  -d '{"query":"query($id:ID!){projects(orgId:$id){id name}}","variables":{"id":"${org.id}"}}'`
 };
 return <section className="panel api-access-panel">
  <div className="setting-block-title"><div className="circle-icon blue"><KeyRound size={19}/></div>
   <div><h2>API Access · REST / JSON / GraphQL</h2><p>同一套 TypeScript Service 和权限校验；REST/JSON 可使用工作区 API Key，GraphQL 使用登录会话。</p></div></div>
  <div className="api-protocols">{(['REST','JSON','GraphQL'] as const).map(p=><button key={p} type="button" className={`btn ${protocol===p?'btn-primary':'btn-ghost'}`} onClick={()=>setProtocol(p)}>{p}</button>)}</div>
  <pre className="code-surface api-example">{snippets[protocol]}</pre>
  <p className="form-hint">API Key 只允许访问所属工作区，最高每分钟 60 次；Stripe、付款方式与管理员设置禁止使用 API Key。密钥不要放进浏览器源码。</p>
  {canManage?<>
   <div className="setting-divider"/><h3>创建工作区 API Key</h3>
   <div className="api-key-form"><label>名称<input value={label} maxLength={80} onChange={e=>setLabel(e.target.value)}/></label>
    <label>权限<select value={scope} onChange={e=>setScope(e.target.value as 'read'|'write')}><option value="read">Read-only</option><option value="write">Read + Write</option></select></label>
    <label>过期天数<input type="number" value={days} min={1} max={365} onChange={e=>setDays(Number(e.target.value))}/></label>
    <button className="btn btn-primary" disabled={busy} onClick={()=>void create()}>生成 API Key</button></div>
   {newToken&&<div className="api-issued"><b>只显示一次：请安全保存这段密钥</b><div className="api-token-row"><code>{newToken}</code><button className="btn btn-ghost" onClick={()=>void navigator.clipboard?.writeText(newToken)}><Copy size={15}/> 复制</button></div></div>}
   <div className="setting-divider"/><div className="api-row-heading"><h3>已签发密钥</h3><button className="btn btn-ghost" onClick={()=>void reload()}><RefreshCw size={14}/> 刷新</button></div>
   <div className="api-key-list">{keys.length?keys.map(k=><div key={k.id} className="api-key-item"><div><b>{k.label}</b> <code>{k.prefix}…</code><small>{k.scopes.join(', ')} · 到期 {new Date(k.expiresAt).toLocaleDateString('zh-CN')}{k.revokedAt?' · 已撤销':''}</small></div>
    {!k.revokedAt&&<button className="btn btn-ghost" disabled={busy} onClick={()=>void revoke(k.id)}><Trash2 size={14}/> 撤销</button>}</div>):<p className="form-hint">暂无 API Key。</p>}</div>
  </>:<p className="form-hint">只有工作区 Owner/Admin 可以签发或撤销 API Key。</p>}
 </section>;
}
