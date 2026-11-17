import { useEffect,useState } from 'react';
import { Activity,AlertTriangle,Check,CloudCog,Coins,CreditCard,KeyRound,Plus,RefreshCw,Save,Search,ShieldAlert,ShieldCheck,UsersRound,Webhook,X,BookOpen,Download,MessageSquareText,Send,ScanSearch,ServerCog,ArrowLeft,ArrowRight,Clock3,Filter,UserRound } from 'lucide-react';
import { formatDate,gql,type User } from '../lib/api';
import { ApiMetricsPanel } from '../components/ApiMetricsPanel';
import {useI18n} from '../i18n';
import {TrendDateFilter,TrendLineCharts,useTrendDates,type TrendBucket,type Metric} from '../components/OperationsTrends';
type Area='adminOverview'|'adminUsers'|'adminOrders'|'adminPayments'|'adminApi'|'adminStaff'|'adminLedger'|'adminInvestigations'|'adminInbox';
type AdminUser={id:string;name:string;email:string;disabled:boolean;orgCount:number;orders:number;createdAt:string};
type InvestigationEvent={eventType:string;eventId:string;orgId:string|null;orgName:string|null;userId:string|null;userEmail:string|null;createdAt:string;status:string;summary:string};
type StaffMember={userId:string;name:string;email:string;role:string;active:boolean;updatedAt:string};
type LedgerEntry={id:string;orgId:string;orgName:string;delta:number;sourceType:string;sourceId:string;createdAt:string};
type InboxThread={id:string;subject:string;channel:'internal'|'customer';category:string;status:string;priority:string;customerId:string|null;customerEmail:string|null;assignedAdminId:string|null;assignedAdmin:string|null;createdAt:string;updatedAt:string;messageCount:number};
type InboxMessage={id:string;threadId:string;senderId:string;senderName:string;senderEmail:string;content:string;internal:boolean;createdAt:string};
type RoleInfo={role:string;capabilities:string[]};
type Order={id:string;userName:string;email:string;orgId:string;orgName:string;productName:string;credits:number;amountCents:number;currency:string;status:string;refundedAmountCents:number;refundedCredits:number;stripeSessionId:string|null;createdAt:string;paidAt:string|null};
type Product={id:string;sku:string;name:string;description:string;credits:number;amountCents:number;currency:string;active:boolean};
type Tariff={model:string;resolution:string;credits:number;active:boolean};
type Gateway={paymentsEnabled:boolean;usageBillingEnabled:boolean;stripeSecretConfigured:boolean;webhookSecretConfigured:boolean;portalConfigured:boolean;stripeMode:string;webhookUrl:string};
type ProviderRoutes={pricingPath:string;settingsPath:string;submitPath:string;taskPath:string;videoLinkPath:string;authMode:'license_key'|'bearer'};
const defaultRoutes:ProviderRoutes={pricingPath:'/api/pricing',settingsPath:'/api/public-settings',submitPath:'/api/generate-video',taskPath:'/api/task/{task_id}',videoLinkPath:'/api/task/{task_id}/video-link',authMode:'license_key'};
type ApiInfo={baseUrl:string;mock:boolean;globalKeyConfigured:boolean;endpointEditableInVercel:boolean;routes:ProviderRoutes};
const money=(n:number)=>'$'+(n/100).toFixed(2);

const validDateEnd=(s:string)=>s?new Date(Date.parse(s)+86400000).toISOString():'';
const roles=[['operations_manager','adminOperations'],['finance_manager','adminFinance'],['support_lead','adminSupport'],['analyst','adminAnalyst'],['auditor','adminAuditor']] as const;
function csvDownload(filename:string,headers:string[],records:(string|number|null|undefined)[][]){
 const csv=[headers,...records].map(row=>row.map(v=>{
  const value=String(v??'');
  const safe=/^[=+\-@\t\r]/.test(value)?"'"+value:value;
  return '"'+safe.replaceAll('"','""')+'"';
 }).join(',')).join('\r\n');
 const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}

const Head=({tag,title,body}:{tag:string;title:string;body:string})=><div className="page-heading"><div><div className="section-kicker">{tag}</div><h1>{title}</h1><p>{body}</p></div></div>;
function OperationsOverviewPage({onNavigate}:{onNavigate?:(screen:string)=>void}){
 const {t}=useI18n(),dates=useTrendDates();
 const [rows,setRows]=useState<TrendBucket[]>([]),[canRevenue,setCanRevenue]=useState(false),[hasPresence,setHasPresence]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  async function load(){
   if(!active||document.visibilityState!=='visible')return;
   setBusy(true);
   try{
    const result=await gql<{adminOverview:{canRevenue:boolean;hasPresence:boolean;buckets:TrendBucket[]}}>(
     'query($from:String!,$to:String!,$timezone:String!,$unit:String!){adminOverview(from:$from,to:$to,timezone:$timezone,unit:$unit){canRevenue hasPresence buckets{key revenueCents alerts errors online peak}}}',
     {from:dates.range.from,to:dates.range.to,timezone:dates.range.timezone,unit:dates.range.unit}
    );
    if(active){setRows(result.adminOverview.buckets);setCanRevenue(result.adminOverview.canRevenue);setHasPresence(result.adminOverview.hasPresence);setError('');}
   }catch(e){if(active){setRows([]);setError(e instanceof Error?e.message:t('opsUnavailable'));}}
   finally{if(active)setBusy(false);}
  }
  void load();
  const interval=window.setInterval(()=>void load(),120000);
  return ()=>{active=false;window.clearInterval(interval);};
 },[dates.range.from,dates.range.to,dates.range.timezone,dates.range.unit,dates.refreshTick]);
 function detail(metric:Metric){
  if(!onNavigate)return;
  onNavigate(metric==='revenue'?'adminLedger':'adminInvestigations');
 }
 return <>
  <Head tag="PLATFORM / OPERATIONS" title={t('adminCommandCenter')} body={t('adminOverviewDesc')}/>
  <TrendDateFilter dates={dates} onRefresh={dates.refresh} busy={busy}/>
  <p className="ops-overview-note">{t('opsActual')}</p>
  {error&&<div className="notice danger" role="alert"><AlertTriangle size={16}/>{error}</div>}
  <TrendLineCharts range={dates.range} rows={rows} source="live" loading={busy} error={error}
    canRevenue={canRevenue} hasPresence={hasPresence} onOpen={onNavigate?detail:undefined}/>
 </>;
}
function AdminUsers({current,onNotify}:{current:User;onNotify:(m:string,ok?:boolean)=>void}){
 const {t}=useI18n();
 const [selected,setSelected]=useState<AdminUser|null>(null),[timeline,setTimeline]=useState<InvestigationEvent[]>([]),[historyBusy,setHistoryBusy]=useState(false),[historyFrom,setHistoryFrom]=useState(''),[historyTo,setHistoryTo]=useState('');
 const [users,setUsers]=useState<AdminUser[]>([]),[text,setText]=useState(''),[loading,setLoading]=useState(false),[pending,setPending]=useState('');
 async function search(){setLoading(true);try{setUsers((await gql<{adminSearchUsers:AdminUser[]}>(`query($search:String!){adminSearchUsers(search:$search,limit:80){id name email disabled orgCount orders createdAt}}`,{search:text})).adminSearchUsers);}catch(e){onNotify(e instanceof Error?e.message:'无法搜索用户');}finally{setLoading(false);}}
 useEffect(()=>{void search();},[]);
 async function disable(u:AdminUser){if(pending!==u.id){setPending(u.id);return;}
  try{await gql(`mutation($id:ID!,$disabled:Boolean!){adminSetUserDisabled(userId:$id,disabled:$disabled)}`,{id:u.id,disabled:!u.disabled});setPending('');onNotify(u.disabled?'用户已恢复':'用户已禁用',true);await search();}catch(e){onNotify(e instanceof Error?e.message:'操作失败');}}
 async function loadHistory(user:AdminUser) {
   setSelected(user);setHistoryBusy(true);
   try {
    const r=await gql<{adminUserTimeline:InvestigationEvent[]}>('query($userId:ID!,$from:String!,$to:String!){adminUserTimeline(userId:$userId,from:$from,to:$to,limit:100){eventType eventId orgId orgName userId userEmail createdAt status summary}}',{userId:user.id,from:historyFrom,to:validDateEnd(historyTo)});
    setTimeline(r.adminUserTimeline);
   }catch(e){onNotify(e instanceof Error?e.message:'用户历史读取失败');}finally{setHistoryBusy(false);}
 }
 return <><Head tag="ADMIN / USER DIRECTORY" title="用户搜索与管理" body="按邮箱、姓名查找用户，检查工作区与订单数量，并管理账户访问。"/><section className="panel portal-card"><form className="portal-search-bar" onSubmit={e=>{e.preventDefault();void search();}}><Search size={19}/><input placeholder="搜索邮箱或姓名" value={text} onChange={e=>setText(e.target.value)} maxLength={100}/><button className="btn btn-primary" disabled={loading} type="submit">{loading?'搜索中…':'搜索用户'}</button></form><div className="portal-scroll"><table className="portal-table"><thead><tr><th>用户</th><th>工作区</th><th>购买次数</th><th>状态</th><th>管理</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.name}</b><small>{u.email}</small><small className="portal-mono">{u.id.slice(0,8)} · {formatDate(u.createdAt)}</small></td><td>{u.orgCount}</td><td>{u.orders}</td><td><span className={`portal-status ${u.disabled?'failed':'paid'}`}>{u.disabled?'已禁用':'正常'}</span></td><td><div className="portal-table-actions"><button type="button" className="btn btn-ghost" onClick={()=>void loadHistory(u)}><Clock3 size={14}/>{t('adminUserHistory')}</button>{u.id===current.id?<span className="portal-muted">当前账户</span>:<div className="portal-table-actions"><button className={`btn ${pending===u.id?'btn-primary':'btn-ghost'}`} onClick={()=>void disable(u)}>{pending===u.id?(u.disabled?'确认恢复':'确认禁用'):(u.disabled?'恢复账户':'禁用账户')}</button>{pending===u.id&&<button className="icon-btn" onClick={()=>setPending('')} title="取消"><X size={17}/></button>}</div>}</div></td></tr>)}</tbody></table></div>{!users.length&&<p className="portal-empty">未找到匹配用户。</p>}</section><p className="portal-help">停用账户会立即删除该用户的服务端会话；历史订单、数据与审计记录不会被删除。</p>
 {selected&&<section className="panel portal-card admin-detail-panel">
  <div className="portal-card-heading"><UserRound size={20}/><h2>{t('adminUserHistory')} · {selected.name}</h2><button className="icon-btn" onClick={()=>setSelected(null)} aria-label="Close"><X size={18}/></button></div>
  <p className="portal-help">{selected.email} · {selected.id}</p>
  <div className="admin-filter-bar"><label>{t('adminFrom')}<input type="date" value={historyFrom} onChange={e=>setHistoryFrom(e.target.value)}/></label>
   <label>{t('adminTo')}<input type="date" value={historyTo} onChange={e=>setHistoryTo(e.target.value)}/></label>
   <button className="btn btn-primary" disabled={historyBusy} onClick={()=>void loadHistory(selected)}><Search size={15}/>{t('adminReload')}</button></div>
  <div className="portal-scroll"><table className="portal-table"><thead><tr><th>{t('created')}</th><th>{t('adminEventType')}</th><th>{t('adminWorkspace')}</th><th>{t('adminStatus')}</th><th>{t('details')}</th></tr></thead>
   <tbody>{timeline.map(ev=><tr key={ev.eventType+ev.eventId}><td>{formatDate(ev.createdAt)}</td><td><code>{ev.eventType}</code></td><td>{ev.orgName??'—'}</td><td>{ev.status}</td><td>{ev.summary}</td></tr>)}</tbody></table></div>
  {!timeline.length&&<p className="portal-help">{historyBusy?'加载中…':t('adminNoRecords')}</p>}
 </section>}</>;
}
function AdminOrders({onNotify}:{onNotify:(m:string,ok?:boolean)=>void}){
 const [items,setItems]=useState<Order[]>([]),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);try{setItems((await gql<{adminOrders:Order[]}>(`query($search:String!,$status:String!){adminOrders(search:$search,status:$status,limit:100){id orgId orgName userId userName email productName credits amountCents currency status refundedAmountCents refundedCredits stripeSessionId createdAt paidAt}}`,{search,status})).adminOrders);}catch(e){onNotify(e instanceof Error?e.message:'订单查询失败');}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 return <><Head tag="ADMIN / PAYMENT RECORDS" title="交易与订单管理" body="查看全平台订单、支付状态与退款金额。财务状态以 Stripe Webhook 为准。"/><section className="panel portal-card"><form className="portal-search-bar" onSubmit={e=>{e.preventDefault();void load();}}><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="邮箱或完整订单 ID"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">所有状态</option>{['created','checkout','pending','paid','partially_refunded','refunded','expired','failed'].map(x=><option key={x} value={x}>{x}</option>)}</select><button className="btn btn-primary" disabled={busy} type="submit">查询</button></form><div className="portal-scroll"><table className="portal-table"><thead><tr><th>订单</th><th>客户 / 工作区</th><th>商品</th><th>金额</th><th>状态</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td><b className="portal-mono">{x.id.slice(0,12)}</b><small>{formatDate(x.createdAt)}</small></td><td><b>{x.userName}</b><small>{x.email}</small><small>{x.orgName}</small></td><td>{x.productName}<small>{x.credits} Credits</small></td><td>{money(x.amountCents)}{x.refundedAmountCents>0&&<small>退款 {money(x.refundedAmountCents)}</small>}</td><td><span className={`portal-status ${x.status}`}>{x.status}</span></td></tr>)}</tbody></table></div>{items.length===0&&<div className="portal-empty">暂无匹配订单。</div>}</section><div className="portal-advisory"><ShieldCheck size={19}/><p>如需退款，请在 Stripe Dashboard 找到对应 PaymentIntent 退款。`charge.refunded` Webhook 会同步订单状态并扣回相应工作区积分，余额可能暂时为负数。</p></div></>;
}
function GatewayPage({onNotify}:{onNotify:(m:string,ok?:boolean)=>void}){
 const [gateway,setGateway]=useState<Gateway|null>(null),[products,setProducts]=useState<Product[]>([]),[tariffs,setTariffs]=useState<Tariff[]>([]),[loading,setLoading]=useState(true);
 const [secret,setSecret]=useState(''),[webhook,setWebhook]=useState(''),[portal,setPortal]=useState(''),[showKeys,setShowKeys]=useState(false);
 const [payments,setPayments]=useState(false),[usage,setUsage]=useState(false);
 const [product,setProduct]=useState({id:'',sku:'',name:'',description:'',credits:100,amountCents:1000,active:false});
 const [tariff,setTariff]=useState({model:'xinghe-2.0',resolution:'720p',credits:1,active:true});
 const [busy,setBusy]=useState('');
 async function load(){setLoading(true);try{const r=await gql<{adminBillingSettings:Gateway;adminProducts:Product[];adminTariffs:Tariff[]}>(`query{adminBillingSettings{paymentsEnabled usageBillingEnabled stripeSecretConfigured webhookSecretConfigured portalConfigured stripeMode webhookUrl} adminProducts{id sku name description credits amountCents currency active} adminTariffs{model resolution credits active}}`);setGateway(r.adminBillingSettings);setPayments(r.adminBillingSettings.paymentsEnabled);setUsage(r.adminBillingSettings.usageBillingEnabled);setProducts(r.adminProducts);setTariffs(r.adminTariffs);}catch(e){onNotify(e instanceof Error?e.message:'网关配置读取失败');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function testStripe(){setBusy('test');try{const r=await gql<{adminTestStripe:{ok:boolean;message:string}}>('query{adminTestStripe{ok message}}');onNotify(r.adminTestStripe.message,r.adminTestStripe.ok);}catch(e){onNotify(e instanceof Error?e.message:'Stripe 连接测试失败');}finally{setBusy('');}}
 async function saveKeys(){setBusy('keys');try{const vars:{secretKey?:string;webhookSecret?:string;portalConfig?:string}={};if(secret)vars.secretKey=secret;if(webhook)vars.webhookSecret=webhook;if(portal)vars.portalConfig=portal;
  if(!Object.keys(vars).length){onNotify('没有新配置需要保存');return;}
  await gql(`mutation($secretKey:String,$webhookSecret:String,$portalConfig:String){adminSaveStripeIntegration(secretKey:$secretKey,webhookSecret:$webhookSecret,portalConfig:$portalConfig){stripeSecretConfigured webhookSecretConfigured}}`,vars);setSecret('');setWebhook('');setPortal('');onNotify('网关配置已加密保存',true);await load();}catch(e){onNotify(e instanceof Error?e.message:'保存失败');}finally{setBusy('');}}
 async function saveFlags(){setBusy('flags');try{await gql(`mutation($p:Boolean!,$u:Boolean!){adminSetBillingFlags(paymentsEnabled:$p,usageBillingEnabled:$u){paymentsEnabled usageBillingEnabled}}`,{p:payments,u:usage});onNotify('支付和计费开关已保存',true);await load();}catch(e){onNotify(e instanceof Error?e.message:'保存失败');}finally{setBusy('');}}
 async function saveProduct(e:React.FormEvent){e.preventDefault();setBusy('product');try{await gql(`mutation($id:ID,$sku:String!,$name:String!,$description:String!,$credits:Int!,$amountCents:Int!,$active:Boolean!){adminSaveProduct(id:$id,sku:$sku,name:$name,description:$description,credits:$credits,amountCents:$amountCents,active:$active){id}}`,{...product,id:product.id||null});onNotify('商品已保存',true);setProduct({id:'',sku:'',name:'',description:'',credits:100,amountCents:1000,active:false});await load();}catch(e){onNotify(e instanceof Error?e.message:'商品保存失败');}finally{setBusy('');}}
 async function saveTariff(e:React.FormEvent){e.preventDefault();setBusy('tariff');try{await gql(`mutation($model:String!,$resolution:String!,$credits:Int!,$active:Boolean!){adminSaveTariff(model:$model,resolution:$resolution,credits:$credits,active:$active){model}}`,tariff);onNotify('计费价格已保存',true);await load();}catch(e){onNotify(e instanceof Error?e.message:'计费价格保存失败');}finally{setBusy('');}}
 return <><Head tag="ADMIN / PAYMENT GATEWAY" title="Stripe 支付网关" body="配置 Stripe 密钥、Webhook、积分商品和模型扣费价格，统一管理支付启用状态。"/>
 <div className="portal-admin-status"><div><CreditCard size={20}/><span>Gateway</span><b>Stripe</b></div><div><ShieldCheck size={20}/><span>Connection</span><b>{gateway?.stripeSecretConfigured?'密钥已配置':'未配置密钥'}</b></div><div><Webhook size={20}/><span>Webhook</span><b>{gateway?.webhookSecretConfigured?'签名密钥已配置':'未配置'}</b></div><div><Activity size={20}/><span>Mode</span><b>{gateway?.stripeMode??'—'}</b></div></div>
 <div className="portal-btn-row portal-test-row"><button className="btn btn-ghost" onClick={()=>void testStripe()} disabled={busy==='test'}><RefreshCw size={16}/>测试 Stripe 连接</button></div>
 <div className="portal-two-columns"><section className="panel portal-card"><div className="portal-card-heading"><KeyRound size={21}/><h2>支付接口密钥</h2></div><p className="portal-help">Secret Key 和 Webhook Secret 使用 AES-256-GCM 保存在 Supabase。密钥不会返回前端；也支持 Vercel 环境变量。</p><label className="field"><span>Stripe Secret Key（sk_test_ / sk_live_）</span><input type={showKeys?'text':'password'} value={secret} onChange={e=>setSecret(e.target.value)} placeholder={gateway?.stripeSecretConfigured?'已配置 · 输入新值替换':'粘贴 Secret Key'} autoComplete="off"/></label><label className="field"><span>Webhook Signing Secret（whsec_）</span><input type={showKeys?'text':'password'} value={webhook} onChange={e=>setWebhook(e.target.value)} placeholder={gateway?.webhookSecretConfigured?'已配置 · 输入新值替换':'粘贴 Webhook Signing Secret'} autoComplete="off"/></label><label className="field"><span>Customer Portal Configuration ID（可选）</span><input value={portal} onChange={e=>setPortal(e.target.value)} placeholder={gateway?.portalConfigured?'已配置 · 输入新值替换':'bpc_…'}/></label><div className="portal-btn-row"><button className="btn btn-ghost" onClick={()=>setShowKeys(x=>!x)}>{showKeys?'隐藏密钥':'显示输入内容'}</button><button className="btn btn-primary" disabled={busy==='keys'} onClick={()=>void saveKeys()}><Save size={15}/>保存密钥</button></div><div className="portal-divider"/><div className="portal-overline">WEBHOOK ENDPOINT</div><code className="portal-code-line">{gateway?.webhookUrl??'加载中…'}</code><p className="portal-help">Stripe Dashboard 添加事件：checkout.session.completed、checkout.session.async_payment_succeeded、checkout.session.async_payment_failed、checkout.session.expired、charge.refunded。</p></section>
 <section className="panel portal-card"><div className="portal-card-heading"><CloudCog size={21}/><h2>支付开关与计费</h2></div><div className="portal-setting-switch"><div><b>开放积分购买</b><p>允许工作区 Owner/Admin 购买商品，进入 Stripe Checkout。</p></div><input aria-label="允许购买" type="checkbox" checked={payments} onChange={e=>{setPayments(e.target.checked);if(!e.target.checked)setUsage(false);}}/></div><div className="portal-setting-switch"><div><b>按视频任务扣除本地积分</b><p>将根据下方模型价格表在创建任务时预留积分；失败时释放。</p></div><input aria-label="视频任务扣费" type="checkbox" checked={usage} disabled={!payments} onChange={e=>setUsage(e.target.checked)}/></div><div className="portal-btn-row"><button className="btn btn-primary" disabled={busy==='flags'||loading} onClick={()=>void saveFlags()}>保存网关设置</button></div><div className="portal-divider"/><div className="portal-advisory"><AlertTriangle size={19}/><p>只有配置了密钥、Webhook 和至少一个上架商品，才能启用购买；任务扣费还需要配置视频积分价格。上线前先用 Stripe Test Mode 测试支付和退款。</p></div></section></div>
 <div className="portal-two-columns"><section className="panel portal-card"><div className="portal-card-heading"><Coins size={21}/><h2>积分商品目录</h2></div><div className="portal-mini-list">{products.map(p=><button key={p.id} type="button" className="portal-edit-row" onClick={()=>setProduct({id:p.id,sku:p.sku,name:p.name,description:p.description,credits:p.credits,amountCents:p.amountCents,active:p.active})}><div><b>{p.name}</b><small>{p.sku} · {p.credits} Credits · {money(p.amountCents)}</small></div><span className={`portal-status ${p.active?'paid':'checkout'}`}>{p.active?'上架':'隐藏'}</span></button>)}{!products.length&&<p className="portal-help">尚无商品。</p>}</div><form className="portal-editor" onSubmit={e=>void saveProduct(e)}><b>{product.id?'编辑商品':'新增积分商品'}</b><label className="field"><span>SKU</span><input required pattern="[a-z0-9][a-z0-9_-]+" value={product.sku} onChange={e=>setProduct({...product,sku:e.target.value})} placeholder="starter-100"/></label><label className="field"><span>商品名称</span><input required minLength={2} value={product.name} onChange={e=>setProduct({...product,name:e.target.value})} placeholder="100 Credits Pack"/></label><label className="field"><span>商品描述</span><input value={product.description} onChange={e=>setProduct({...product,description:e.target.value})}/></label><div className="portal-form-dual"><label className="field"><span>积分数</span><input type="number" min={1} value={product.credits} onChange={e=>setProduct({...product,credits:Number(e.target.value)})}/></label><label className="field"><span>美元价格（美分）</span><input type="number" min={50} value={product.amountCents} onChange={e=>setProduct({...product,amountCents:Number(e.target.value)})}/></label></div><label className="portal-checkbox"><input type="checkbox" checked={product.active} onChange={e=>setProduct({...product,active:e.target.checked})}/> 上架销售</label><div className="portal-btn-row"><button className="btn btn-ghost" type="button" onClick={()=>setProduct({id:'',sku:'',name:'',description:'',credits:100,amountCents:1000,active:false})}>清空</button><button className="btn btn-primary" type="submit" disabled={busy==='product'}><Plus size={15}/>保存商品</button></div></form></section>
 <section className="panel portal-card"><div className="portal-card-heading"><Coins size={21}/><h2>视频任务积分价格</h2></div><div className="portal-mini-list">{tariffs.map(t=><button key={`${t.model}-${t.resolution}`} className="portal-edit-row" onClick={()=>setTariff(t)}><div><b>{t.model} / {t.resolution}</b><small>{t.credits} Credits / Task</small></div><span className={`portal-status ${t.active?'paid':'checkout'}`}>{t.active?'启用':'停用'}</span></button>)}{!tariffs.length&&<p className="portal-help">未设置任何视频任务计费价格。</p>}</div><form className="portal-editor" onSubmit={e=>void saveTariff(e)}><b>模型计费规则</b><label className="field"><span>模型</span><select value={tariff.model} onChange={e=>setTariff({...tariff,model:e.target.value})}><option value="xinghe-2.0">xinghe-2.0</option><option value="xinghe-fast">xinghe-fast</option></select></label><label className="field"><span>清晰度</span><select value={tariff.resolution} onChange={e=>setTariff({...tariff,resolution:e.target.value})}>{['480p','720p','1080p','4k'].map(v=><option key={v} value={v}>{v}</option>)}</select></label><label className="field"><span>每任务使用积分</span><input type="number" min={1} value={tariff.credits} onChange={e=>setTariff({...tariff,credits:Number(e.target.value)})}/></label><label className="portal-checkbox"><input type="checkbox" checked={tariff.active} onChange={e=>setTariff({...tariff,active:e.target.checked})}/> 启用此价格</label><div className="portal-btn-row"><button className="btn btn-primary" type="submit" disabled={busy==='tariff'}><Save size={16}/>保存价格</button></div></form><p className="portal-help">这是本平台积分规则，不是 151 视频提供商的实时报价。请自行设置售价与服务成本，不建议直接写死上游价格。</p></section></div></>;
}
function ApiPage({onNotify}:{onNotify:(m:string,ok?:boolean)=>void}){
 const [info,setInfo]=useState<ApiInfo|null>(null),[role,setRole]=useState<RoleInfo|null>(null);
 const [routes,setRoutes]=useState<ProviderRoutes>(defaultRoutes),[key,setKey]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[show,setShow]=useState(false),[error,setError]=useState('');
 const canEdit=role?.capabilities.includes('secrets')??false;
 const routeFields:{field:keyof Omit<ProviderRoutes,'authMode'>;method:string;label:string}[]=[
   {field:'pricingPath',method:'GET',label:'Pricing · 价格查询'},
   {field:'settingsPath',method:'GET',label:'Public Settings · 模型列表'},
   {field:'submitPath',method:'POST',label:'Generate Video · 提交任务'},
   {field:'taskPath',method:'GET',label:'Task Status · 进度轮询'},
   {field:'videoLinkPath',method:'GET',label:'Video Link · 视频结果'}
 ];
 const dirty=!!info&&JSON.stringify(info.routes)!==JSON.stringify(routes);
 async function load(){
  setLoading(true);
  try{
   const r=await gql<{adminApiSettings:ApiInfo;adminMyRole:RoleInfo}>(`query{adminApiSettings{baseUrl mock globalKeyConfigured endpointEditableInVercel routes{pricingPath settingsPath submitPath taskPath videoLinkPath authMode}} adminMyRole{role capabilities}}`);
   setInfo(r.adminApiSettings);setRole(r.adminMyRole);setRoutes(r.adminApiSettings.routes);setError('');
  }catch(e){setError(e instanceof Error?e.message:'API 集成配置读取失败');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function saveKey(){
  if(!canEdit)return;
  setBusy('key');
  try{await gql(`mutation($key:String!){adminSaveGlobalVideoKey(key:$key){globalKeyConfigured}}`,{key});
   setKey('');onNotify('全平台默认 API 密钥已加密保存',true);await load();
  }catch(e){setError(e instanceof Error?e.message:'API Key 保存失败');}
  finally{setBusy('');}
 }
 async function saveRoutes(){
  if(!canEdit||!dirty)return;
  setBusy('routes');
  try{
   await gql(`mutation($input:ProviderApiRoutesInput!){adminSaveGlobalApiRoutes(input:$input){routes{pricingPath settingsPath submitPath taskPath videoLinkPath authMode}}}`,{input:routes});
   onNotify('接口定义已保存到平台数据库并记录审计',true);await load();
  }catch(e){setError(e instanceof Error?e.message:'接口定义保存失败');}
  finally{setBusy('');}
 }
 async function test(){
  setBusy('test');
  try{
   const r=await gql<{adminTestVideoApi:{ok:boolean;message:string}}>(`query{adminTestVideoApi{ok message}}`);
   onNotify(r.adminTestVideoApi.message,r.adminTestVideoApi.ok);
   if(!r.adminTestVideoApi.ok)setError(r.adminTestVideoApi.message);
   else setError('');
  }catch(e){setError(e instanceof Error?e.message:'连接测试失败');}
  finally{setBusy('');}
 }
 return <><Head tag="ADMIN / API INTEGRATIONS" title="API 集成中心" body="全局默认上游 API 设置。修改会实际影响未设置独立接口的工作区；工作区专属配置优先。"/>
  {error&&<div className="notice danger" role="alert"><ShieldAlert size={17}/>{error}</div>}
  <section className="panel portal-card">
   <div className="portal-card-heading"><CloudCog size={22}/><h2>上游视频服务 · 全局配置</h2><button className="btn btn-ghost" disabled={loading||!!busy} onClick={()=>void load()}><RefreshCw size={15}/>刷新</button></div>
   <div className="admin-api-status-grid">
    <div><small>运行模式</small><b>{!info?'尚未连接':info.mock?'MOCK — 不请求真实 API':'LIVE — 连接真实服务'}</b></div>
    <div><small>默认凭据</small><b>{info?.globalKeyConfigured?'已配置（不显示明文）':'未配置'}</b></div>
    <div><small>管理员权限</small><b>{role?.role??'读取中'} · {canEdit?'可编辑':'只读'}</b></div>
   </div>
   <div className="portal-info-row"><span>API Base URL（Vercel 服务器配置）</span><code>{info?.baseUrl??'正在读取…'}</code></div>
   <p className="portal-help">基础域名仍由服务器的 VIDEO_API_BASE_URL 控制，禁止在网页填入任意主机以免泄漏密钥。下方五个路径及鉴权 Header 可以直接保存至数据库。</p>
   <div className="portal-divider"/>
   <div className="portal-card-heading"><ServerCog size={20}/><h2>接口定义 · 151 API</h2><span className="portal-status pending">{dirty?'有未保存修改':'与数据库一致'}</span></div>
   <div className="admin-api-routes">
    {routeFields.map(({field,method,label})=><label key={field}>
      <span><b>{label}</b><small>{method}</small></span>
      <input value={routes[field]} maxLength={160} spellCheck={false} autoComplete="off"
       disabled={!canEdit||loading||!!busy||!info}
       onChange={e=>setRoutes(p=>({...p,[field]:e.target.value}))}/>
    </label>)}
    <label><span><b>认证模式 Authentication</b><small>HEADER</small></span><select value={routes.authMode} disabled={!canEdit||loading||!!busy||!info}
       onChange={e=>setRoutes(p=>({...p,authMode:e.target.value as ProviderRoutes['authMode']}))}>
       <option value="license_key">X-License-Key</option><option value="bearer">Authorization: Bearer</option>
    </select></label>
   </div>
   <p className="portal-help">路径格式必须是 /api/…；Task Status 和 Video Link 必须包含 {'{task_id}'}。为防止丢失任务，平台仍有待处理/状态未知的视频时禁止修改全局接口。此处不执行视频 POST，也不自动扣费。</p>
   <div className="portal-btn-row">
    <button className="btn btn-ghost" disabled={!canEdit||!!busy||loading} onClick={()=>setRoutes({...defaultRoutes})}>恢复 151 默认路径（未保存）</button>
    <button className="btn btn-ghost" disabled={!dirty||!!busy} onClick={()=>setRoutes(info?{...info.routes}:{...defaultRoutes})}>取消修改</button>
    <button className="btn btn-primary" disabled={!canEdit||!dirty||!!busy||loading} onClick={()=>void saveRoutes()}><Save size={15}/>{busy==='routes'?'保存中…':'保存接口配置'}</button>
   </div>
  </section>
  <div className="portal-two-columns">
   <section className="panel portal-card">
    <div className="portal-card-heading"><KeyRound size={20}/><h2>全平台默认 API Key</h2></div>
    <p className="portal-help">密钥由服务器加密保存；仅 Super Admin 可写入。工作区有自己的 API Key 时优先使用工作区密钥。</p>
    <label className="field"><span>默认密钥（仅输入新值）</span><div className="portal-input-suffix"><input type={show?'text':'password'} value={key} maxLength={1024} autoComplete="new-password" disabled={!canEdit||!!busy}
     onChange={e=>setKey(e.target.value)} placeholder={info?.globalKeyConfigured?'已配置，输入新值以替换':'尚未配置'}/><button type="button" className="icon-btn" aria-label="显示或隐藏新密钥" onClick={()=>setShow(v=>!v)}>{show?'隐藏':'显示'}</button></div></label>
    <div className="portal-btn-row"><button className="btn btn-primary" disabled={!canEdit||!!busy||loading||!key.trim()} onClick={()=>void saveKey()}><Save size={15}/>保存密钥</button></div>
    <p className="portal-help">不显示现有密钥，也不会把密钥写入浏览器 Local Storage、源码或审计记录。</p>
   </section>
   <section className="panel portal-card">
    <div className="portal-card-heading"><Activity size={20}/><h2>连接诊断 · Read-only</h2></div>
    <p className="portal-help">测试时调用服务器实际的 Pricing GET 和 Public Settings GET，使用已保存的路径与鉴权方式。不创建视频任务、不触发收费。</p>
    {info?.mock&&<div className="notice"><ShieldAlert size={16}/>MOCK_VIDEO_PROVIDER=true；真实测试不可执行。必须在 Vercel 改成 LIVE 才能发起真实请求。</div>}
    {info?.baseUrl.startsWith('http://')&&!info.mock&&<div className="notice danger"><ShieldAlert size={16}/>当前基础地址使用 HTTP。除非服务器明确允许，否则不会发送任何 API 密钥。</div>}
    <div className="portal-btn-row"><button className="btn btn-primary" disabled={!!busy||loading||!info||dirty||info.mock||!info.globalKeyConfigured} onClick={()=>void test()}><Activity size={16}/>{busy==='test'?'测试中…':'测试实际 API 连接'}</button></div>
   </section>
  </div>
 </>;
}

function StaffPage({onNotify}:{onNotify:(s:string,ok?:boolean)=>void}){
 const {t}=useI18n();
 const [items,setItems]=useState<StaffMember[]>([]),[roleInfo,setRoleInfo]=useState<RoleInfo|null>(null);
 const [userId,setUserId]=useState(''),[role,setRole]=useState('analyst'),[active,setActive]=useState(true),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);
  try{const r=await gql<{adminStaff:StaffMember[];adminMyRole:RoleInfo}>('query{adminStaff{userId name email role active updatedAt} adminMyRole{role capabilities}}');
   setItems(r.adminStaff);setRoleInfo(r.adminMyRole);
  }catch(e){onNotify(e instanceof Error?e.message:'管理员团队读取失败');}
  finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 async function save(){
  setBusy(true);
  try{await gql('mutation($userId:ID!,$role:String!,$active:Boolean!){adminSetStaffRole(userId:$userId,role:$role,active:$active)}',{userId,role,active});
   onNotify('管理员权限已保存并记录审计',true);setUserId('');await load();
  }catch(e){onNotify(e instanceof Error?e.message:'权限保存失败');}finally{setBusy(false);}
 }
 return <><Head tag="GOVERNANCE / RBAC" title={t('adminStaff')} body={t('adminTeamDesc')}/>
 <section className="panel portal-card">
  <div className="portal-card-heading"><ShieldCheck size={20}/><h2>{t('adminRole')} · {roleInfo?.role??'—'}</h2><button className="btn btn-ghost" disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/>{t('adminRefresh')}</button></div>
  <div className="admin-role-summary">{roles.map(([id,label])=><span key={id}>{t(label)} · {id}</span>)}</div>
  <div className="portal-scroll"><table className="portal-table"><thead><tr><th>{t('name')}</th><th>Email</th><th>{t('adminRole')}</th><th>{t('status')}</th><th>{t('lastActive')}</th><th>{t('action')}</th></tr></thead>
   <tbody>{items.map(item=><tr key={item.userId}><td>{item.name}<small className="portal-mono">{item.userId}</small></td><td>{item.email}</td><td><b>{t(roles.find(r=>r[0]===item.role)?.[1]??item.role)}</b></td><td><span className={'portal-status '+(item.active?'paid':'failed')}>{item.active?t('adminActive'):t('adminInactive')}</span></td><td>{formatDate(item.updatedAt)}</td><td><button className="btn btn-ghost" onClick={()=>{setUserId(item.userId);setRole(item.role);setActive(item.active);}}>{t('details')}</button></td></tr>)}</tbody>
  </table></div>
 </section>
 <section className="panel portal-card admin-detail-panel"><h2>{t('adminSaveRole')}</h2>
  <p className="portal-help">管理员必须先注册，再通过用户 UUID 分配权限。超级管理员只从服务器环境变量指定。</p>
  <div className="admin-filter-bar"><label>User UUID<input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="Registered user UUID"/></label>
  <label>{t('adminRole')}<select value={role} onChange={e=>setRole(e.target.value)}>{roles.filter(([id])=>roleInfo?.role==='super_admin'||['support_lead','analyst','auditor'].includes(id)).map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</select></label>
  <label>{t('adminActive')}<select value={active?'yes':'no'} onChange={e=>setActive(e.target.value==='yes')}><option value="yes">{t('adminActive')}</option><option value="no">{t('adminInactive')}</option></select></label>
  <button className="btn btn-primary" disabled={busy||!/^[\da-f-]{36}$/i.test(userId)} onClick={()=>void save()}><Save size={15}/>{t('adminSaveRole')}</button></div>
 </section></>;
}


function LedgerPage({onNotify}:{onNotify:(s:string,ok?:boolean)=>void}){
 const {t}=useI18n();
 const [items,setItems]=useState<LedgerEntry[]>([]),[orgId,setOrgId]=useState(''),[search,setSearch]=useState(''),[source,setSource]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[before,setBefore]=useState(''),[stack,setStack]=useState<string[]>([]),[busy,setBusy]=useState(false);
 async function load(cursor=''){
  setBusy(true);
  try{
   const r=await gql<{adminLedger:LedgerEntry[]}>('query($orgId:String!,$sourceType:String!,$search:String!,$from:String!,$to:String!,$before:String!){adminLedger(orgId:$orgId,sourceType:$sourceType,search:$search,from:$from,to:$to,before:$before,limit:50){id orgId orgName delta sourceType sourceId createdAt}}',
    {orgId,sourceType:source,search,from,to:validDateEnd(to),before:cursor});
   setItems(r.adminLedger);setBefore(cursor);
  }catch(e){onNotify(e instanceof Error?e.message:'流水查询失败');}
  finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 const credits=items.reduce((total,item)=>total+item.delta,0);
 return <><Head tag="FINANCE / CREDIT LEDGER" title={t('adminLedger')} body="按工作区、时间、来源和业务 ID 查询积分流水。支付金额记录在订单模块；此处追踪积分入账、扣费及退回。"/>
 <section className="panel portal-card">
  <div className="portal-card-heading"><BookOpen size={19}/><h2>{t('adminFilters')}</h2>
   <button className="btn btn-ghost" disabled={!items.length} onClick={()=>csvDownload('autojuben-ledger-page.csv',['ID','Workspace','Delta','Source','Source ID','Date'],items.map(x=>[x.id,x.orgName,x.delta,x.sourceType,x.sourceId,x.createdAt]))}><Download size={16}/>{t('adminCsv')}</button>
  </div>
  <form className="admin-filter-bar" onSubmit={e=>{e.preventDefault();setStack([]);void load('');}}>
   <label>{t('adminWorkspace')}<input value={orgId} onChange={e=>setOrgId(e.target.value)} placeholder="Org UUID / All"/></label>
   <label>{t('adminSource')}<input value={source} onChange={e=>setSource(e.target.value)} placeholder="Source type"/></label>
   <label>{t('adminSearch')}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Source ID"/></label>
   <label>{t('adminFrom')}<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>{t('adminTo')}<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <button type="submit" className="btn btn-primary" disabled={busy}><Search size={15}/>{t('adminReload')}</button>
  </form>
  <div className="admin-ledger-summary"><span>{t('adminShowing')}: <b>{items.length}</b></span><span>{t('adminChange')} (page): <b className={credits<0?'admin-negative':'admin-positive'}>{credits>0?'+':''}{credits}</b></span><span>Cursor: {before||'latest'}</span></div>
  <div className="portal-scroll"><table className="portal-table"><thead><tr><th>ID</th><th>{t('adminWorkspace')}</th><th>{t('adminChange')}</th><th>{t('adminSource')}</th><th>Source ID</th><th>{t('created')}</th></tr></thead>
   <tbody>{items.map(x=><tr key={x.id}><td className="portal-mono">{x.id}</td><td>{x.orgName}<small>{x.orgId.slice(0,8)}</small></td><td><b className={x.delta<0?'admin-negative':'admin-positive'}>{x.delta>0?'+':''}{x.delta}</b></td><td>{x.sourceType}</td><td className="portal-mono">{x.sourceId}</td><td>{formatDate(x.createdAt)}</td></tr>)}</tbody>
  </table></div>
  {!items.length&&<p className="portal-empty">{t('adminNoRecords')}</p>}
  <div className="admin-pager"><button className="btn btn-ghost" disabled={busy||!stack.length} onClick={()=>{const prev=stack[stack.length-1];setStack(x=>x.slice(0,-1));void load(prev);}}><ArrowLeft size={15}/>{t('adminPrev')}</button><span>{t('adminShowing')} {items.length} / page</span><button className="btn btn-ghost" disabled={busy||items.length<50} onClick={()=>{setStack(s=>[...s,before]);void load(items[items.length-1].id);}}>{t('adminNext')}<ArrowRight size={15}/></button></div>
 </section></>;
}


function InvestigationsPage({onNotify}:{onNotify:(s:string,ok?:boolean)=>void}){
 const {t}=useI18n();
 const [events,setEvents]=useState<InvestigationEvent[]>([]),[search,setSearch]=useState(''),[orgId,setOrgId]=useState(''),[userId,setUserId]=useState(''),[eventType,setEventType]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[before,setBefore]=useState(''),[stack,setStack]=useState<string[]>([]),[busy,setBusy]=useState(false),[selected,setSelected]=useState<InvestigationEvent|null>(null);
 async function load(cursor=''){
  setBusy(true);
  try{const r=await gql<{adminInvestigations:InvestigationEvent[]}>('query($orgId:String!,$eventType:String!,$search:String!,$userId:String!,$from:String!,$to:String!,$before:String!){adminInvestigations(orgId:$orgId,eventType:$eventType,search:$search,userId:$userId,from:$from,to:$to,before:$before,limit:50){eventType eventId orgId orgName userId userEmail createdAt status summary}}',
   {orgId,eventType,search,userId,from,to:validDateEnd(to),before:cursor});
   setEvents(r.adminInvestigations);setBefore(cursor);
  }catch(e){onNotify(e instanceof Error?e.message:'大数据排查失败');}
  finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 return <><Head tag="OPERATIONS / FORENSICS" title={t('adminInvestigations')} body="使用时间、工作区、用户 UUID、事件类别和关键字排查视频、订单、审计和 API 请求。使用服务器端复合游标分页，每次最多100条。"/>
 <section className="panel portal-card">
  <div className="portal-card-heading"><ScanSearch size={20}/><h2>{t('adminFilters')}</h2><button disabled={!events.length} className="btn btn-ghost" onClick={()=>csvDownload('autojuben-investigations-page.csv',['Date','Type','ID','Workspace','User','Status','Summary'],events.map(e=>[e.createdAt,e.eventType,e.eventId,e.orgName,e.userEmail,e.status,e.summary]))}><Download size={15}/>{t('adminCsv')}</button></div>
  <form className="admin-filter-bar" onSubmit={e=>{e.preventDefault();setStack([]);void load('');}}>
   <label>{t('adminSearch')}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Request / Task ID / email"/></label>
   <label>{t('adminEventType')}<select value={eventType} onChange={e=>setEventType(e.target.value)}><option value="">{t('adminAll')}</option>{['video','order','audit','api','admin'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <label>{t('adminWorkspace')}<input value={orgId} onChange={e=>setOrgId(e.target.value)} placeholder="Org UUID"/></label>
   <label>{t('adminUser')}<input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="User UUID"/></label>
   <label>{t('adminFrom')}<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>{t('adminTo')}<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <button className="btn btn-primary" disabled={busy} type="submit"><Filter size={15}/>{t('adminReload')}</button>
  </form>
  <div className="portal-scroll"><table className="portal-table"><thead><tr><th>{t('created')}</th><th>{t('adminEventType')}</th><th>Event ID</th><th>{t('adminUser')}</th><th>{t('adminWorkspace')}</th><th>{t('adminStatus')}</th><th>{t('details')}</th></tr></thead>
  <tbody>{events.map(e=><tr key={e.eventType+e.eventId}><td>{formatDate(e.createdAt)}</td><td><span className="portal-status checkout">{e.eventType}</span></td><td className="portal-mono">{e.eventId.slice(0,18)}</td><td>{e.userEmail??'—'}</td><td>{e.orgName??'—'}</td><td>{e.status}</td><td><button className="btn btn-ghost" onClick={()=>setSelected(e)}>{t('details')}</button></td></tr>)}</tbody></table></div>
  {!events.length&&<p className="portal-empty">{t('adminNoRecords')}</p>}
  <div className="admin-pager"><button className="btn btn-ghost" disabled={busy||!stack.length} onClick={()=>{const prev=stack[stack.length-1];setStack(x=>x.slice(0,-1));void load(prev);}}><ArrowLeft size={15}/>{t('adminPrev')}</button><span>{events.length} / 50</span><button className="btn btn-ghost" disabled={busy||events.length<50} onClick={()=>{setStack(x=>[...x,before]);const e=events[events.length-1];void load(e.createdAt+'|'+e.eventType+'|'+e.eventId);}}>{t('adminNext')}<ArrowRight size={15}/></button></div>
 </section>
 {selected&&<section className="panel portal-card admin-detail-panel"><div className="portal-card-heading"><ScanSearch size={18}/><h2>{selected.eventType} / {selected.eventId}</h2><button className="icon-btn" onClick={()=>setSelected(null)} aria-label="Close"><X size={17}/></button></div><div className="admin-details-grid">{[['Date',selected.createdAt],['Status',selected.status],['User',selected.userEmail],['Org',selected.orgName],['Summary',selected.summary],['Event ID',selected.eventId]].map(([k,v])=><div key={k}><small>{k}</small><b>{v??'—'}</b></div>)}</div></section>}
 </>;
}


function InboxPage({onNotify}:{onNotify:(s:string,ok?:boolean)=>void}){
 const {t}=useI18n();
 const [threads,setThreads]=useState<InboxThread[]>([]),[selected,setSelected]=useState<InboxThread|null>(null),[messages,setMessages]=useState<InboxMessage[]>([]);
 const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[category,setCategory]=useState(''),[channel,setChannel]=useState<'internal'|'customer'>('internal'),[busy,setBusy]=useState(false);
 const [draft,setDraft]=useState(''),[subject,setSubject]=useState(''),[customerId,setCustomerId]=useState(''),[priority,setPriority]=useState('normal'),[adding,setAdding]=useState(false);
 async function load(){
  setBusy(true);
  try{const r=await gql<{adminInbox:InboxThread[]}>('query($search:String!,$status:String!,$category:String!,$channel:String!){adminInbox(search:$search,status:$status,category:$category,channel:$channel,limit:80){id channel subject category status priority customerId customerEmail assignedAdminId assignedAdmin createdAt updatedAt messageCount}}',{search,status,category,channel});
   setThreads(r.adminInbox);
  }catch(e){onNotify(e instanceof Error?e.message:'站内消息读取失败');}finally{setBusy(false);}
 }
 async function open(thread:InboxThread){
  setSelected(thread);setBusy(true);
  try{const r=await gql<{adminMessages:InboxMessage[]}>('query($threadId:ID!){adminMessages(threadId:$threadId,limit:100){id threadId senderId senderName senderEmail content internal createdAt}}',{threadId:thread.id});
   setMessages(r.adminMessages);
  }catch(e){onNotify(e instanceof Error?e.message:'消息查询失败');}finally{setBusy(false);}
 }
 useEffect(()=>{setSelected(null);setMessages([]);void load();},[channel]);
 async function create(){
  if(subject.trim().length<3)return;
  setBusy(true);
  try{
   const r=await gql<{adminCreateThread:string}>('mutation($subject:String!,$category:String!,$priority:String!,$customerId:ID,$channel:String!){adminCreateThread(subject:$subject,category:$category,priority:$priority,customerId:$customerId,channel:$channel)}',
   {subject:subject.trim(),category:category||(channel==='internal'?'internal':'general'),priority,customerId:channel==='customer'?(customerId||null):null,channel});
   setSubject('');setAdding(false);onNotify('内部会话已创建',true);
   const latest=await gql<{adminInbox:InboxThread[]}>('query($channel:String!){adminInbox(channel:$channel,limit:80){id channel subject category status priority customerId customerEmail assignedAdminId assignedAdmin createdAt updatedAt messageCount}}',{channel});
   setThreads(latest.adminInbox);const found=latest.adminInbox.find(x=>x.id===r.adminCreateThread);if(found)await open(found);
  }catch(e){onNotify(e instanceof Error?e.message:'创建失败');}finally{setBusy(false);}
 }
 async function send(){
  if(!selected||!draft.trim())return;
  setBusy(true);
  try{await gql('mutation($threadId:ID!,$content:String!){adminSendMessage(threadId:$threadId,content:$content)}',{threadId:selected.id,content:draft});
   setDraft('');await open(selected);await load();
  }catch(e){onNotify(e instanceof Error?e.message:'发送失败');}finally{setBusy(false);}
 }
 async function update(next:string){
  if(!selected)return;
  setBusy(true);
  try{await gql('mutation($threadId:ID!,$status:String!,$priority:String!){adminUpdateThread(threadId:$threadId,status:$status,priority:$priority)}',{threadId:selected.id,status:next,priority:selected.priority});
   setSelected({...selected,status:next});await load();
  }catch(e){onNotify(e instanceof Error?e.message:'状态修改失败');}finally{setBusy(false);}
 }
 return <><Head tag="COLLABORATION / MESSENGER" title={t('adminInbox')} body={channel==='internal'?t('helpAdminInternal'):t('helpAdminCustomer')}/>
 <section className="panel portal-card">
  <div className="admin-messenger-channels"><button type="button" className={channel==='internal'?'selected':''} onClick={()=>{setChannel('internal');setSelected(null);setMessages([]);setCategory('');setAdding(false);setThreads([]);}}>{t('helpAdminInternal')}</button><button type="button" className={channel==='customer'?'selected':''} onClick={()=>{setChannel('customer');setSelected(null);setMessages([]);setCategory('');setAdding(false);setThreads([]);}}>{t('helpAdminCustomer')}</button></div>
  <div className="portal-card-heading"><MessageSquareText size={20}/><h2>{channel==='internal'?t('helpAdminInternal'):t('helpAdminCustomer')}</h2><button className="btn btn-primary" onClick={()=>setAdding(x=>!x)}><Plus size={15}/>{t('adminNewThread')}</button></div>
  {adding&&<div className="admin-filter-bar">
   <label>{t('adminSubject')}<input value={subject} maxLength={200} onChange={e=>setSubject(e.target.value)}/></label>
   <label>{t('adminCategory')}<select value={category||(channel==='internal'?'internal':'general')} onChange={e=>setCategory(e.target.value)}>{(channel==='internal'?['internal','support','billing','technical','compliance']:['general','generation','technical','billing','account']).map(x=><option key={x}>{x}</option>)}</select></label>
   <label>{t('adminPriority')}<select value={priority} onChange={e=>setPriority(e.target.value)}>{['low','normal','high','urgent'].map(x=><option key={x}>{x}</option>)}</select></label>
   {channel==='customer'&&<label>Customer UUID<input value={customerId} onChange={e=>setCustomerId(e.target.value)} placeholder="Existing user UUID"/></label>}
   <button className="btn btn-primary" disabled={busy||subject.trim().length<3||(channel==='customer'&&!customerId.trim())} onClick={()=>void create()}>{t('adminCreate')}</button>
  </div>}
  <form className="admin-filter-bar" onSubmit={e=>{e.preventDefault();void load();}}>
   <label>{t('adminSearch')}<input value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label>{t('adminStatus')}<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">{t('adminAll')}</option>{['open','pending','resolved','closed'].map(x=><option key={x}>{x}</option>)}</select></label>
   <button className="btn btn-ghost" disabled={busy} type="submit"><Search size={15}/>{t('adminReload')}</button>
  </form>
  <div className="admin-messenger-layout"><div className="admin-thread-list">
   {threads.map(x=><button type="button" key={x.id} className={'admin-thread '+(selected?.id===x.id?'selected':'')} onClick={()=>void open(x)}>
    <span className="admin-thread-title"><b>{x.subject}</b><small>{x.messageCount}</small></span><span>{x.category} · {x.priority}</span><small>{formatDate(x.updatedAt)} · {x.status}</small></button>)}
   {!threads.length&&<p className="portal-empty">{t('adminNoRecords')}</p>}
  </div><div className="admin-chat-pane">
   {selected?<><div className="admin-chat-head"><strong>{selected.subject}</strong><div><span className="portal-status checkout">{selected.priority}</span>
    <select value={selected.status} onChange={e=>void update(e.target.value)} disabled={busy}>{['open','pending','resolved','closed'].map(x=><option key={x} value={x}>{x}</option>)}</select></div></div>
   <div className="admin-chat-messages">{messages.map(x=><article key={x.id} className="admin-chat-bubble"><div><strong>{x.senderName}</strong><small>{formatDate(x.createdAt)}</small></div><p>{x.content}</p></article>)}
    {!messages.length&&<p className="portal-help">{t('adminNoRecords')}</p>}</div>
   <div className="admin-chat-compose"><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder={t('adminCompose')} maxLength={8000} rows={3}/>
    <button className="btn btn-primary" disabled={busy||!draft.trim()||selected.status==='closed'} onClick={()=>void send()}><Send size={16}/>{t('adminReply')}</button></div></>
   :<p className="portal-empty">{t('adminNoSelection')}</p>}
  </div></div>
  <p className="portal-help"><ShieldCheck size={14}/> {channel==='internal'?t('adminInternalOnly'):t('helpAdminCustomer')}</p>
 </section></>;
}

export function AdminPage({section,user,onNotify,onNavigate}:{section:Area;user:User;onNotify:(m:string,ok?:boolean)=>void;onNavigate?:(screen:string)=>void}){
 if(section==='adminOverview')return <OperationsOverviewPage onNavigate={onNavigate}/>;
 if(section==='adminUsers')return <AdminUsers current={user} onNotify={onNotify}/>;
 if(section==='adminStaff')return <StaffPage onNotify={onNotify}/>;
 if(section==='adminLedger')return <LedgerPage onNotify={onNotify}/>;
 if(section==='adminInvestigations')return <InvestigationsPage onNotify={onNotify}/>;
 if(section==='adminInbox')return <InboxPage onNotify={onNotify}/>;
 if(section==='adminOrders')return <AdminOrders onNotify={onNotify}/>;
 if(section==='adminPayments')return <GatewayPage onNotify={onNotify}/>;
 return <><ApiPage onNotify={onNotify}/><ApiMetricsPanel/></>;
}
