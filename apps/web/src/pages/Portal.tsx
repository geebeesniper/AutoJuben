import { useEffect,useState } from 'react';
import { ArrowLeft,ArrowUpRight,Banknote,BookOpen,Check,Clock3,CreditCard,KeyRound,LifeBuoy,LockKeyhole,MessageSquareText,Package,Plus,RefreshCw,Receipt,Search,Send,ShoppingBag,UserRound } from 'lucide-react';
import { authRequest,formatDate,gql,type Org,type User } from '../lib/api';
import {useI18n} from '../i18n';

type Area='account'|'history'|'billing'|'purchases'|'shop'|'helpCenter'|'helpDesk';
type HelpArticle={id:string;slug:string;category:string;title:string;answer:string};
type HelpThread={id:string;subject:string;category:string;status:string;priority:string;createdAt:string;updatedAt:string;messageCount:number};
type HelpMessage={id:string;threadId:string;senderName:string;content:string;mine:boolean;createdAt:string};
type History={id:string;action:string;detail:string;createdAt:string};
type Product={id:string;sku:string;name:string;description:string;credits:number;amountCents:number;currency:string;active:boolean};
type Order={id:string;orgId:string;productName:string;credits:number;amountCents:number;currency:string;status:string;refundedAmountCents:number;createdAt:string;paidAt:string|null};
type CardInfo={id:string;brand:string;last4:string;expMonth:number;expYear:number};
type Wallet={balance:number;usageBillingEnabled:boolean};
type Availability={enabled:boolean;gateway:string;message:string};
const dollars=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const statuses:Record<string,string>={created:'待创建结账',checkout:'待支付',pending:'支付处理中',paid:'已支付',failed:'支付失败',expired:'结账已过期',partially_refunded:'部分退款',refunded:'已退款'};
const activities:Record<string,string>={'auth.login':'账户登录','job.created':'创建视频任务','job.manualReconcile':'人工核实任务','project.created':'创建项目','project.updated':'修改项目','project.deleted':'删除项目','provider.keyConfigured':'设置 API 密钥','provider.keyCleared':'清除 API 密钥','member.added':'添加成员','member.roleChanged':'修改成员权限','member.removed':'移除成员','purchase.paid':'购买积分','org.created':'创建工作区'};
const H=({kicker,title,description}:{kicker:string;title:string;description:string})=><div className="page-heading"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1><p>{description}</p></div></div>;
function ErrorView({error}:{error:string}){return error?<div className="notice danger inline">{error}</div>:null;}
function WalletDisplay({org}:{org:Org}){
 const [wallet,setWallet]=useState<Wallet|null>(null);
 useEffect(()=>{void gql<{walletSummary:Wallet}>(`query($orgId:ID!){walletSummary(orgId:$orgId){balance usageBillingEnabled}}`,{orgId:org.id}).then(x=>setWallet(x.walletSummary)).catch(()=>setWallet(null));},[org.id]);
 return <div className="portal-wallet"><div><span className="portal-overline">WORKSPACE BALANCE</span><b>{wallet?wallet.balance.toLocaleString():'—'} <small>Credits</small></b><p>{wallet?.usageBillingEnabled?'已启用视频任务积分扣费':'目前视频任务不按本平台积分扣费'}</p></div><span className="portal-wallet-icon"><Banknote size={24}/></span></div>;
}
function Account({user,onUpdate,onNotify}:{user:User;onUpdate:(u:User)=>void;onNotify:(m:string,ok?:boolean)=>void}){
 const [name,setName]=useState(user.name);const [saving,setSaving]=useState(false);const [mailing,setMailing]=useState(false);
 async function save(e:React.FormEvent){e.preventDefault();setSaving(true);try{const r=await gql<{updateMyName:User}>(`mutation($name:String!){updateMyName(name:$name){id name email}}`,{name});onUpdate(r.updateMyName);onNotify('个人资料已保存',true);}catch(e){onNotify(e instanceof Error?e.message:'保存失败');}finally{setSaving(false);}}
 async function reset(){setMailing(true);try{await authRequest('forgot-password',{email:user.email});onNotify('如果邮箱可用，密码重置邮件将发送到你的邮箱。',true);}catch(e){onNotify(e instanceof Error?e.message:'发送失败');}finally{setMailing(false);}}
 return <><H kicker="ACCOUNT / PROFILE" title="我的账户" description="管理账户资料与登录安全。"/><div className="portal-two-columns"><section className="panel portal-card"><div className="portal-card-heading"><UserRound size={22}/><h2>个人资料</h2></div><form onSubmit={e=>void save(e)}><label className="field"><span>显示名称</span><input value={name} minLength={2} maxLength={120} onChange={e=>setName(e.target.value)} required/></label><label className="field"><span>登录邮箱</span><input value={user.email} readOnly className="read-only-input"/></label><p className="portal-help">登录邮箱由 Supabase Auth 管理，不能在这里直接替换。</p><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'保存中…':'保存更改'} <Check size={16}/></button></form></section>
 <section className="panel portal-card"><div className="portal-card-heading"><LockKeyhole size={22}/><h2>密码与安全</h2></div><div className="portal-security-item"><span className="portal-security-icon"><KeyRound size={19}/></span><div><b>修改密码</b><p>通过 Supabase 的验证邮件安全重设密码，旧密码不会明文存储在 AutoJuben。</p></div></div><button className="btn btn-ghost" disabled={mailing} onClick={()=>void reset()}>{mailing?'正在发送…':'发送密码重置邮件'}</button><div className="portal-divider"/><p className="portal-help">如果管理员停用账户，现有登录会话会失效。建议启用 Supabase 邮箱验证和自定义 SMTP。</p></section></div></>;
}
function HistoryPage({org}:{org:Org}){
 const [items,setItems]=useState<History[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function refresh(){setBusy(true);try{const r=await gql<{myHistory:History[]}>(`query($orgId:ID!){myHistory(orgId:$orgId,limit:100){id action detail createdAt}}`,{orgId:org.id});setItems(r.myHistory);setError('');}catch(e){setError(e instanceof Error?e.message:'获取记录失败');}finally{setBusy(false);}}
 useEffect(()=>{void refresh();},[org.id]);
 return <><H kicker="ACCOUNT / HISTORY" title="历史活动记录" description="查看你在当前工作区的登录、创作、项目及管理操作。"/><section className="panel portal-card"><div className="portal-list-toolbar"><b>最近活动 · {items.length} 条</b><button className="btn btn-ghost" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={15} className={busy?'spin':''}/>刷新</button></div><ErrorView error={error}/>{items.length? <div className="portal-activity">{items.map(item=><div className="portal-activity-row" key={item.id}><div className="portal-activity-dot"/><div><b>{activities[item.action]??item.action}</b><small>{item.action}</small></div><span>{formatDate(item.createdAt)}</span></div>)}</div>:<div className="portal-empty"><Clock3 size={23}/>当前工作区暂无个人活动记录。</div>}</section></>;
}
function Purchases(){
 const [orders,setOrders]=useState<Order[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function load(){setBusy(true);try{setOrders((await gql<{myOrders:Order[]}>(`query{myOrders(limit:100){id orgId productName credits amountCents currency status refundedAmountCents createdAt paidAt}}`)).myOrders);setError('');}catch(e){setError(e instanceof Error?e.message:'获取订单失败');}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 return <><H kicker="BILLING / PURCHASE HISTORY" title="购买记录" description="查看支付状态、购买金额及到账积分。支付状态只会在 Stripe Webhook 核实后更新。"/><section className="panel portal-card"><div className="portal-list-toolbar"><b>我的订单 · {orders.length}</b><button className="btn btn-ghost" onClick={()=>void load()} disabled={busy}><RefreshCw size={15} className={busy?'spin':''}/> 刷新</button></div><ErrorView error={error}/>{orders.length?<div className="portal-scroll"><table className="portal-table"><thead><tr><th>订单 / 日期</th><th>商品</th><th>积分</th><th>金额</th><th>状态</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><b className="portal-mono">{o.id.slice(0,12)}</b><small>{formatDate(o.createdAt)}</small></td><td>{o.productName}</td><td>{o.credits.toLocaleString()}</td><td>{dollars(o.amountCents)}{o.refundedAmountCents>0&&<small>已退 {dollars(o.refundedAmountCents)}</small>}</td><td><span className={`portal-status ${o.status}`}>{statuses[o.status]??o.status}</span></td></tr>)}</tbody></table></div>:<div className="portal-empty"><Receipt size={24}/>暂无购买记录。完成 Stripe 付款后，记录会出现在这里。</div>}</section></>;
}
function Billing({org,onNotify}:{org:Org;onNotify:(m:string,ok?:boolean)=>void}){
 const [cards,setCards]=useState<CardInfo[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [opening,setOpening]=useState(false);
 async function load(){setBusy(true);try{const r=await gql<{myPaymentCards:CardInfo[]}>(`query{myPaymentCards{id brand last4 expMonth expYear}}`);setCards(r.myPaymentCards);setError('');}catch(e){setError(e instanceof Error?e.message:'获取支付方式失败');}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 async function portal(){setOpening(true);try{const r=await gql<{createBillingPortal:{url:string}}>(`mutation{createBillingPortal{url}}`);window.location.assign(r.createBillingPortal.url);}catch(e){onNotify(e instanceof Error?e.message:'无法打开支付管理');setOpening(false);}}
 return <><H kicker="BILLING / PAYMENT METHODS" title="信用卡与付款方式" description="安全地查看已保存信用卡，并通过 Stripe 更换或删除付款方式。"/><WalletDisplay org={org}/><section className="panel portal-card"><div className="portal-list-toolbar"><b>我的已保存付款方式</b><button className="btn btn-ghost" onClick={()=>void load()} disabled={busy}><RefreshCw size={15} className={busy?'spin':''}/>刷新</button></div><ErrorView error={error}/><div className="portal-card-grid">{cards.map(c=><div className="portal-payment-card" key={c.id}><CreditCard size={26}/><div><strong>{c.brand.toUpperCase()} ···· {c.last4}</strong><span>有效期 {String(c.expMonth).padStart(2,'0')}/{c.expYear}</span></div><span className="portal-secure">STRIPE</span></div>)}</div>{cards.length===0&&<div className="portal-empty"><CreditCard size={24}/>尚未保存信用卡。可以在 Stripe 付款或支付管理中心添加付款方式。</div>}<div className="portal-card-footer"><p>AutoJuben 仅接收银行卡品牌、末四位与有效期，不存储完整卡号或 CVV。</p><button className="btn btn-primary" onClick={()=>void portal()} disabled={opening}>{opening?'正在打开…':'在 Stripe 管理信用卡'} <ArrowUpRight size={16}/></button></div></section></>;
}
function Shop({org,onNotify}:{org:Org;onNotify:(m:string,ok?:boolean)=>void}){
 const [products,setProducts]=useState<Product[]>([]);const [availability,setAvailability]=useState<Availability|null>(null);const [busy,setBusy]=useState('');const [error,setError]=useState('');
 useEffect(()=>{void Promise.all([gql<{billingCatalog:Product[]}>(`query{billingCatalog{id sku name description credits amountCents currency active}}`),gql<{billingAvailability:Availability}>(`query{billingAvailability{enabled gateway message}}`)]).then(([a,b])=>{setProducts(a.billingCatalog);setAvailability(b.billingAvailability);setError('');}).catch(e=>setError(e instanceof Error?e.message:'商品加载失败'));},[org.id]);
 async function buy(id:string){setBusy(id);try{const r=await gql<{createCheckout:{url:string;orderId:string}}>(`mutation($orgId:ID!,$productId:ID!){createCheckout(orgId:$orgId,productId:$productId){url orderId}}`,{orgId:org.id,productId:id});window.location.assign(r.createCheckout.url);}catch(e){onNotify(e instanceof Error?e.message:'创建支付失败');setBusy('');}}
 const canBuy=['owner','admin'].includes(org.role);
 return <><H kicker="BILLING / CREDIT STORE" title="购买积分" description="选择积分包，跳转到 Stripe 安全结账。到账时间以支付成功回调为准。"/><WalletDisplay org={org}/><ErrorView error={error}/>{availability&&!availability.enabled&&<div className="notice warning inline">{availability.message}</div>}<div className="portal-product-grid">{products.map(p=><article className="panel portal-product" key={p.id}><div className="portal-product-icon"><Package size={24}/></div><div className="portal-overline">ONE-TIME PURCHASE · {p.sku}</div><h2>{p.name}</h2><p>{p.description||'适用于 AutoJuben 工作区的视频创作。'}</p><div className="portal-product-credits">{p.credits.toLocaleString()} <span>Credits</span></div><div className="portal-product-bottom"><b>{dollars(p.amountCents)}</b><button className="btn btn-primary" disabled={!availability?.enabled||!canBuy||Boolean(busy)} onClick={()=>void buy(p.id)}>{busy===p.id?'处理中…':'立即购买'} <ShoppingBag size={16}/></button></div></article>)}</div>{!products.length&&<div className="panel portal-empty"><ShoppingBag size={25}/>目前没有已上架的积分包，管理员可在支付网关设置中添加。</div>}<p className="portal-help">仅工作区 Owner/Admin 可购买共享积分。Stripe 收取美元付款；本地积分与上游视频 API 的积分是不同账本。管理员开启任务扣费后才会消耗本地积分。</p></>;
}

const helpKnowledgeCategories=['getting_started','generation','billing','account','api','troubleshooting'];
const helpTicketCategories=['general','generation','technical','billing','account'] as const;
function categoryName(category:string,t:(s:string)=>string){
 const mapping:Record<string,string>={getting_started:'helpGettingStarted',generation:'helpGeneration',billing:'helpBilling',account:'helpAccount',api:'helpApi',troubleshooting:'helpTroubleshooting',general:'helpGeneral',technical:'helpTechnical'};
 return t(mapping[category]??category);
}
function HelpCenter(){
 const {t,locale}=useI18n();
 const [articles,setArticles]=useState<HelpArticle[]>([]),[category,setCategory]=useState(''),[text,setText]=useState(''),[open,setOpen]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;setBusy(true);
  const handle=setTimeout(()=>{
   void gql<{helpArticles:HelpArticle[]}>(`query($category:String!,$search:String!,$locale:String!){helpArticles(category:$category,search:$search,locale:$locale,limit:60){id slug category title answer}}`,{category,search:text,locale})
    .then(r=>{if(active){setArticles(r.helpArticles);setError('');}})
    .catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load articles');})
    .finally(()=>{if(active)setBusy(false);});
  },250);
  return ()=>{active=false;clearTimeout(handle);};
 },[category,text,locale]);
 return <><H kicker="CUSTOMER SUPPORT / KNOWLEDGE" title={t('helpCenterTitle')} description={t('helpCenterIntro')}/>
 <section className="panel portal-card">
  <div className="help-search"><Search size={19}/><input aria-label={t('helpSearch')} placeholder={t('helpSearch')} value={text} onChange={e=>setText(e.target.value)}/></div>
  <div className="help-categories"><button className={!category?'selected':''} onClick={()=>setCategory('')}>{t('helpAllCategories')}</button>{helpKnowledgeCategories.map(cat=><button key={cat} className={category===cat?'selected':''} onClick={()=>setCategory(cat)}>{categoryName(cat,t)}</button>)}</div>
  <ErrorView error={error}/>{busy&&<p className="portal-help">Loading…</p>}
  <div className="help-articles">{articles.map(article=><article key={article.id} className="help-article"><button aria-expanded={open===article.id} onClick={()=>setOpen(open===article.id?'':article.id)}><span><small>{categoryName(article.category,t)}</small><b>{article.title}</b></span><Plus size={18}/></button>{open===article.id&&<p>{article.answer}</p>}</article>)}</div>
  {!busy&&!articles.length&&!error&&<div className="portal-empty">{t('helpNoArticles')}</div>}
 </section><div className="portal-advisory"><LifeBuoy size={19}/><p>{t('helpDeskIntro')} <a href="?tab=helpDesk">{t('nav_helpDesk')}</a></p></div></>;
}
function HelpDesk({onNotify}:{onNotify:(msg:string,ok?:boolean)=>void}){
 const {t}=useI18n();
 const [items,setItems]=useState<HelpThread[]>([]),[messages,setMessages]=useState<HelpMessage[]>([]),[current,setCurrent]=useState<string|null>(null);
 const [category,setCategory]=useState<'general'|'generation'|'technical'|'billing'|'account'>('general');
 const [filter,setFilter]=useState(''),[status,setStatus]=useState(''),[subject,setSubject]=useState(''),[details,setDetails]=useState(''),[reply,setReply]=useState('');
 const [creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){
  setBusy(true);
  try{const r=await gql<{myHelpThreads:HelpThread[]}>(`query($category:String!,$status:String!){myHelpThreads(category:$category,status:$status,limit:80){id subject category status priority createdAt updatedAt messageCount}}`,{category:filter,status});setItems(r.myHelpThreads);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to load tickets');}
  finally{setBusy(false);}
 }
 async function openThread(id:string){
  setCurrent(id);setMessages([]);setBusy(true);
  try{const r=await gql<{myHelpMessages:HelpMessage[]}>(`query($id:ID!){myHelpMessages(threadId:$id,limit:100){id threadId senderName content mine createdAt}}`,{id});setMessages(r.myHelpMessages);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to read messages');}
  finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[filter,status]);
 async function create(){
  if(subject.trim().length<3||details.trim().length<5)return;
  setBusy(true);
  try{
   const r=await gql<{openHelpTicket:string}>(`mutation($category:String!,$subject:String!,$content:String!){openHelpTicket(category:$category,subject:$subject,content:$content)}`,{category,subject:subject.trim(),content:details.trim()});
   setSubject('');setDetails('');setCreating(false);onNotify(t('helpSaved'),true);
   await load();await openThread(r.openHelpTicket);
  }catch(e){setError(e instanceof Error?e.message:'Unable to create ticket');}finally{setBusy(false);}
 }
 async function send(){
  if(!current||!reply.trim())return;
  setBusy(true);
  try{await gql(`mutation($threadId:ID!,$content:String!){replyHelpTicket(threadId:$threadId,content:$content)}`,{threadId:current,content:reply.trim()});
   setReply('');onNotify(t('helpReplied'),true);await openThread(current);await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to reply');}finally{setBusy(false);}
 }
 const selected=items.find(x=>x.id===current);
 return <><H kicker="CUSTOMER SUPPORT / HELP DESK" title={t('helpDeskTitle')} description={t('helpDeskIntro')}/>
 <section className="panel portal-card">
 <div className="portal-list-toolbar"><b>{t('helpMyTickets')}</b><button className="btn btn-primary" onClick={()=>setCreating(x=>!x)}><Plus size={16}/>{t('helpCreateTicket')}</button></div>
 <ErrorView error={error}/>
 {creating&&<div className="help-create-form">
  <label>{t('helpCategory')}<select value={category} onChange={e=>setCategory(e.target.value as typeof category)}>{helpTicketCategories.map(cat=><option value={cat} key={cat}>{categoryName(cat,t)}</option>)}</select></label>
  <label>{t('helpSubject')}<input value={subject} maxLength={200} onChange={e=>setSubject(e.target.value)}/></label>
  <label className="help-wide">{t('helpDescription')}<textarea value={details} maxLength={8000} rows={4} onChange={e=>setDetails(e.target.value)}/></label>
  <button type="button" className="btn btn-primary" disabled={busy||subject.trim().length<3||details.trim().length<5} onClick={()=>void create()}><Send size={15}/>{t('helpSubmit')}</button>
 </div>}
 <div className="help-filter-bar"><select aria-label={t('helpCategory')} value={filter} onChange={e=>{setFilter(e.target.value);setCurrent(null);}}><option value="">{t('helpAllCategories')}</option>{helpTicketCategories.map(cat=><option key={cat} value={cat}>{categoryName(cat,t)}</option>)}</select><select aria-label="Status" value={status} onChange={e=>{setStatus(e.target.value);setCurrent(null);}}><option value="">{t('helpAllCategories')}</option>{['open','pending','resolved','closed'].map(s=><option key={s} value={s}>{s}</option>)}</select><button className="btn btn-ghost" onClick={()=>void load()} disabled={busy}><RefreshCw size={14}/></button></div>
 <div className="help-desk-layout"><div className="help-ticket-list">{items.map(item=><button key={item.id} type="button" className={current===item.id?'selected':''} onClick={()=>void openThread(item.id)}><strong>{item.subject}</strong><span>{categoryName(item.category,t)} · {item.status}</span><small>{formatDate(item.updatedAt)} · {item.messageCount} {t('helpMessages')}</small></button>)}{!items.length&&!busy&&<p className="portal-empty">{t('helpNoTickets')}</p>}</div>
 <div className="help-ticket-chat">{selected?<><header><b>{selected.subject}</b><span>{selected.status} · {categoryName(selected.category,t)}</span></header><div className="help-chat-history">{messages.map(msg=><article key={msg.id} className={msg.mine?'mine':'support'}><b>{msg.senderName}</b><p>{msg.content}</p><small>{formatDate(msg.createdAt)}</small></article>)}{!messages.length&&<p>{t('helpChooseThread')}</p>}</div><div className="help-chat-compose"><textarea value={reply} onChange={e=>setReply(e.target.value)} maxLength={8000} rows={3} disabled={selected.status==='closed'} placeholder={t('helpReply')}/><button className="btn btn-primary" disabled={busy||!reply.trim()||selected.status==='closed'} onClick={()=>void send()}><Send size={15}/>{t('helpReply')}</button></div></>:<p className="portal-empty">{t('helpChooseThread')}</p>}</div></div>
 <p className="portal-help">{t('helpSupportNotice')}</p>
 </section></>;
}
export function PortalPage({section,org,user,onUpdate,onNotify}:{section:Area;org:Org;user:User;onUpdate:(u:User)=>void;onNotify:(m:string,ok?:boolean)=>void}){
 if(section==='helpCenter')return <HelpCenter/>;
 if(section==='helpDesk')return <HelpDesk onNotify={onNotify}/>;
 if(section==='account')return <Account user={user} onUpdate={onUpdate} onNotify={onNotify}/>;
 if(section==='history')return <HistoryPage org={org}/>;
 if(section==='purchases')return <Purchases/>;
 if(section==='billing')return <Billing org={org} onNotify={onNotify}/>;
 return <Shop org={org} onNotify={onNotify}/>;
}
