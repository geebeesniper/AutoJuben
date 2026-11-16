import {useEffect,useState} from 'react';
import {gql} from '../lib/api';
type Metric={transport:string;total:number;errors:number;p95_ms:number|null;avg_ms:number|null};
export function ApiMetricsPanel(){
 const [minutes,setMinutes]=useState(60),[rows,setRows]=useState<Metric[]>([]),[error,setError]=useState('');
 async function refresh(){try{const result=await gql<{apiMetrics:Metric[]}>(`query($minutes:Int!){apiMetrics(minutes:$minutes){transport total errors p95_ms avg_ms}}`,{minutes});setRows(result.apiMetrics);setError('');}
 catch(e){setError(e instanceof Error?e.message:'无法加载接口指标');}}
 useEffect(()=>{void refresh();},[minutes]);
 return <section className="panel portal-card" style={{marginTop:18}}>
  <div className="portal-card-heading"><h2>API 质量指标 · CMM 量化管理</h2></div>
  <p className="portal-help">统计 GraphQL / REST / JSON 请求数量、API 错误及 P95 响应时间。不记录用户内容或支付密钥。</p>
  <div className="portal-btn-row"><select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}><option value={60}>最近 1 小时</option><option value={1440}>最近 24 小时</option><option value={10080}>最近 7 天</option></select><button className="btn btn-ghost" onClick={()=>void refresh()}>刷新指标</button></div>
  {error?<div className="notice danger inline">{error}</div>:<div className="portal-scroll"><table className="portal-table"><thead><tr><th>接口</th><th>请求数</th><th>API 错误</th><th>错误率</th><th>P95</th><th>平均</th></tr></thead><tbody>{rows.map(x=><tr key={x.transport}><td>{x.transport.toUpperCase()}</td><td>{x.total}</td><td>{x.errors}</td><td>{x.total?(x.errors/x.total*100).toFixed(2):'0.00'}%</td><td>{x.p95_ms===null?'—':`${Math.round(x.p95_ms)} ms`}</td><td>{x.avg_ms===null?'—':`${Math.round(x.avg_ms)} ms`}</td></tr>)}</tbody></table>{rows.length===0&&<p className="portal-help">当前时间窗口暂无数据。</p>}</div>}
 </section>;
}
