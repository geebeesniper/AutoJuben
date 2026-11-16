import {useMemo,useState} from 'react';
import {Activity,AlertTriangle,CalendarDays,Clock3,CreditCard,RefreshCw,UsersRound} from 'lucide-react';
import {useI18n} from '../i18n';

export type Metric='revenue'|'alerts'|'errors'|'online'|'peak';
export type TrendBucket={key:string;revenueCents:number|null;alerts:number;errors:number;online:number|null;peak:number|null};
export type TrendWindow={from:string;to:string;fromDay:string;toDay:string;timezone:string;unit:'hour'|'day';preset:string};
type Preset='today'|'yesterday'|'previous3'|'previous7'|'custom';
const pad=(n:number)=>String(n).padStart(2,'0');
const dateKey=(d:Date)=>String(d.getFullYear())+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const localDay=(s:string)=>{const parts=s.split('-').map(Number);return new Date(parts[0],parts[1]-1,parts[2]);};
const shift=(d:Date,n:number)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
export function buildTrendWindow(preset:Preset,fromDay:string,toDay:string,now=new Date()):TrendWindow{
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 let from=today,to=today;
 if(preset==='yesterday'){from=shift(today,-1);to=from;}
 if(preset==='previous3'){from=shift(today,-3);to=shift(today,-1);}
 if(preset==='previous7'){from=shift(today,-7);to=shift(today,-1);}
 if(preset==='custom'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fromDay)||!/^\d{4}-\d{2}-\d{2}$/.test(toDay))throw new Error('Invalid dates');
  from=localDay(fromDay);to=localDay(toDay);
  if(dateKey(from)!==fromDay||dateKey(to)!==toDay)throw new Error('Invalid dates');
 }
 const count=Math.round((Date.UTC(to.getFullYear(),to.getMonth(),to.getDate())-Date.UTC(from.getFullYear(),from.getMonth(),from.getDate()))/86400000)+1;
 if(count<1||count>366||to.getTime()>today.getTime())throw new Error('Invalid date range');
 return {from:from.toISOString(),to:shift(to,1).toISOString(),fromDay:dateKey(from),toDay:dateKey(to),
  timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',unit:count<=3?'hour':'day',preset};
}
export function trendKeys(range:TrendWindow):string[]{
 const keys:string[]=[];
 if(range.unit==='hour'){
  for(let date=new Date(range.from);date.getTime()<Date.parse(range.to)&&keys.length<100;date=new Date(date.getTime()+3600000))
   keys.push(date.toISOString().slice(0,13)+':00:00Z');
 }else{
  for(let date=localDay(range.fromDay);date<=localDay(range.toDay)&&keys.length<366;date=shift(date,1))keys.push(dateKey(date));
 }
 return keys;
}
export function sampleTrends(range:TrendWindow):TrendBucket[]{
 return trendKeys(range).map((key,i)=>{
  const seed=((Math.floor(Date.parse(key.length===10?key+'T12:00:00Z':key)/3600000)%109)+109)%109;
  const v=Math.sin(i*.39)+Math.cos(i*.21);
  const scale=range.unit==='day'?12:1;
  const peak=Math.max(4,Math.round(23+seed/6+v*9));
  return {key,revenueCents:Math.max(0,Math.round((420+seed*12+v*100)*scale)),alerts:Math.max(0,Math.round((seed%5+v)*scale/2)),
   errors:Math.max(0,Math.round((seed%7+v)*scale/3)),online:Math.max(0,peak-Math.round(seed%12+2)),peak};
 });
}
export function useTrendDates(){
 const [preset,setPreset]=useState<Preset>('today');
 const [fromDay,setFromDay]=useState(dateKey(new Date()));
 const [toDay,setToDay]=useState(dateKey(new Date()));
 const [range,setRange]=useState<TrendWindow>(()=>buildTrendWindow('today','',''));
 const [error,setError]=useState(false);
 function choose(next:Preset){
  setPreset(next);setError(false);
  if(next==='custom')return;
  const value=buildTrendWindow(next,'','');setRange(value);setFromDay(value.fromDay);setToDay(value.toDay);
 }
 function apply(){
  try{setRange(buildTrendWindow('custom',fromDay,toDay));setPreset('custom');setError(false);}
  catch{setError(true);}
 }
 function refresh(){try{setRange(buildTrendWindow(preset,fromDay,toDay));setError(false);}catch{setError(true);}}
 return {preset,fromDay,toDay,range,error,choose,apply,refresh,setFromDay:(v:string)=>{setFromDay(v);setPreset('custom');},setToDay:(v:string)=>{setToDay(v);setPreset('custom');}};
}
export function TrendDateFilter({dates,busy=false,onRefresh}:{dates:ReturnType<typeof useTrendDates>;busy?:boolean;onRefresh?:()=>void}){
 const {t}=useI18n();
 const quick:[Preset,string][]=[['today','opsToday'],['yesterday','opsYesterday'],['previous3','opsPrevious3'],['previous7','opsPrevious7']];
 return <div className="ops-date-bar">
  <div className="ops-presets" role="group" aria-label={t('opsTimeRange')}>
   {quick.map(([id,key])=><button type="button" key={id} className={dates.preset===id?'selected':''} onClick={()=>dates.choose(id)}>{t(key)}</button>)}
  </div>
  <div className="ops-date-fields">
   <label>{t('opsFrom')}<input type="date" max={dateKey(new Date())} value={dates.fromDay} onChange={e=>dates.setFromDay(e.target.value)}/></label>
   <label>{t('opsTo')}<input type="date" max={dateKey(new Date())} value={dates.toDay} onChange={e=>dates.setToDay(e.target.value)}/></label>
   <button type="button" className="ops-apply" onClick={dates.apply}><CalendarDays size={15}/>{t('opsApply')}</button>
   {onRefresh&&<button type="button" className="ops-refresh" onClick={onRefresh} disabled={busy} aria-label={t('opsRefresh')}><RefreshCw size={16}/></button>}
  </div>
  {dates.error&&<p role="alert" className="ops-date-error">{t('opsDateError')}</p>}
  <div className="ops-date-caption"><Clock3 size={14}/>{dates.range.fromDay} — {dates.range.toDay} · {dates.range.timezone} · {t(dates.range.unit==='hour'?'opsHourly':'opsDaily')}</div>
 </div>;
}
const options:{metric:Metric;title:string;detail:string;color:string;unit:'money'|'count'}[]=[
 {metric:'revenue',title:'opsRevenue',detail:'opsRevenueDetail',color:'#776ad4',unit:'money'},
 {metric:'alerts',title:'opsAlerts',detail:'opsAlertsDetail',color:'#d69856',unit:'count'},
 {metric:'errors',title:'opsErrors',detail:'opsErrorsDetail',color:'#ce7888',unit:'count'},
 {metric:'online',title:'opsOnline',detail:'opsOnlineDetail',color:'#4f9dbf',unit:'count'},
 {metric:'peak',title:'opsPeak',detail:'opsPeakDetail',color:'#4d9e82',unit:'count'}
];
const icons={revenue:<CreditCard size={19}/>,alerts:<AlertTriangle size={19}/>,errors:<Activity size={19}/>,online:<UsersRound size={19}/>,peak:<UsersRound size={19}/>};
function formatValue(n:number,unit:'money'|'count',language:string){
 return unit==='money'?new Intl.NumberFormat(language==='zh'?'zh-CN':language==='es'?'es-ES':'en-US',{style:'currency',currency:'USD'}).format(n/100):Math.round(n).toLocaleString(language==='zh'?'zh-CN':language==='es'?'es-ES':'en-US');
}
function timeLabel(key:string,unit:'hour'|'day',language:string){
 if(unit==='day')return key.slice(5);
 return new Date(key).toLocaleTimeString(language==='zh'?'zh-CN':language==='es'?'es-ES':'en-US',{hour:'2-digit',minute:'2-digit'});
}
export function TrendLineCharts({range,rows,source,loading=false,error='',canRevenue=true,hasPresence=true,onOpen}:{
 range:TrendWindow;rows:TrendBucket[];source:'demo'|'live';loading?:boolean;error?:string;canRevenue?:boolean;hasPresence?:boolean;onOpen?:(metric:Metric)=>void;
}){
 const {t,locale}=useI18n();
 const ordered=useMemo(()=>{
  const lookup=new Map(rows.map(r=>[r.key,r]));
  return trendKeys(range).map(key=>lookup.get(key)??{key,revenueCents:canRevenue?0:null,alerts:0,errors:0,online:hasPresence?0:null,peak:hasPresence?0:null});
 },[range,rows,canRevenue,hasPresence]);
 return <div className="ops-chart-grid">
  {options.map(config=>{
   const metric=config.metric,visible=metric==='revenue'?canRevenue:metric==='online'||metric==='peak'?hasPresence:true;
   const numbers=ordered.map(r=>Number(metric==='revenue'?r.revenueCents:r[metric])||0);
   const total=metric==='peak'?Math.max(0,...numbers):metric==='online'?(numbers[numbers.length-1]??0):numbers.reduce((a,b)=>a+b,0);
   const max=Math.max(1,...numbers),w=540,h=143,x0=47,y0=20;
   const coords=numbers.map((n,i)=>({x:x0+(numbers.length===1?w/2:(i/(numbers.length-1))*w),y:y0+h-n/max*h,number:n,key:ordered[i].key}));
   const show=visible&&!loading&&!error&&coords.length>0;
   return <article className="ops-chart-card" key={metric}>
    <header className="ops-chart-head"><span className="ops-icon" style={{color:config.color,background:config.color+'1c'}}>{icons[metric]}</span><span><b>{t(config.title)}</b><small>{t(config.detail)}</small></span>{source==='demo'&&<em>{t('opsDemo')}</em>}</header>
    <div className="ops-chart-number">{!visible?t(metric==='revenue'?'opsRestricted':'opsUntracked'):loading?t('loading'):error?'—':formatValue(total,config.unit,locale)}<small>{t(metric==='online'?'opsLatest':metric==='peak'?'opsMaximum':'opsPeriodTotal')}</small></div>
    {show?<svg className="ops-line-svg" viewBox="0 0 610 207" role="img" aria-label={t(config.title)}>
     {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={x0} x2={x0+w} y1={y0+h-v*h} y2={y0+h-v*h} stroke="#e3e9f2" strokeDasharray="4 5"/><text x={x0-7} y={y0+h-v*h+3} fontSize="10" textAnchor="end" fill="#8d9ab0">{config.unit==='money'?'$'+Math.round(max*v/100):Math.round(max*v)}</text></g>)}
     <polyline fill="none" stroke={config.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={coords.map(p=>String(p.x)+','+String(p.y)).join(' ')}/>
     {coords.filter((_,i)=>coords.length<=36||i%Math.ceil(coords.length/24)===0||i===coords.length-1).map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="3.3" fill={config.color} stroke="#fff" strokeWidth="1.5"/><title>{timeLabel(p.key,range.unit,locale)} · {formatValue(p.number,config.unit,locale)}</title></g>)}
     {coords.filter((_,i)=>i===0||i===coords.length-1||i%Math.max(1,Math.floor(coords.length/5))===0).map((p,i)=><text key={i} x={p.x} y="192" textAnchor={p.x===x0?'start':p.x===x0+w?'end':'middle'} fontSize="10" fill="#919fb5">{timeLabel(p.key,range.unit,locale)}</text>)}
    </svg>:<div className="ops-chart-empty">{loading?t('loading'):error?t('opsUnavailable'):!visible?t(metric==='revenue'?'opsRestricted':'opsUntracked'):t('opsNoData')}</div>}
    {onOpen&&<button type="button" className="ops-chart-drill" onClick={()=>onOpen(metric)}>{t('opsDetails')} →</button>}
   </article>;
  })}
 </div>;
}
