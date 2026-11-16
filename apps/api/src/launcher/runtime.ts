import { query } from '../db/pool.js';
import { config } from '../config.js';
import { AppError,assert } from '../utils/errors.js';
export type Component='backend'|'frontend';
export type RuntimeAction='start'|'stop'|'restart';
export type Channel='stable'|'beta'|'gray';
export type RuntimeConfig={org_id:string;environment:'dev'|'prod';channel:Channel;backend_container:string|null;frontend_container:string|null;current_version:string;desired_version:string|null;deployment_state:string;updated_at:Date};
export type ContainerInfo={name:string|null;state:string;health:string;running:boolean;configured:boolean;error:string|null};
export const rolesManage=['owner','admin'];
export const isPlatformAdmin=(email:string)=>config.platformAdminEmails.includes(email.toLowerCase());
export function versionParts(v:string):number[]|null {
  if(!/^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/i.test(v))return null;
  return v.replace(/^v/i,'').split(/[+-]/)[0].split('.').map(Number);
}
export function compareVersions(a:string,b:string):number {
  const x=versionParts(a),y=versionParts(b);
  if(!x||!y)return a.localeCompare(b,undefined,{numeric:true});
  for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;
  if(/-/.test(a)!==/-/.test(b))return /-/.test(a)?-1:1;
  return a.localeCompare(b,undefined,{numeric:true});
}
export async function runtimeConfig(orgId:string):Promise<RuntimeConfig> {
  await query('INSERT INTO launcher_config(org_id) VALUES($1) ON CONFLICT DO NOTHING',[orgId]);
  const row=(await query<RuntimeConfig>('SELECT * FROM launcher_config WHERE org_id=$1',[orgId])).rows[0];
  assert(row,'运行配置不存在',404);return row;
}
export async function inspectRuntime(orgId:string) {
  const c=await runtimeConfig(orgId);
  return {
    // A successful API response proves this invocation worked, NOT that a daemon stays online.
    backend:{name:'Vercel Function',state:'request_served',health:'not_measured',running:false,configured:true,error:null},
    frontend:{name:'Vercel Static Assets',state:'deployed',health:'not_measured',running:false,configured:true,error:null},
    currentVersion:process.env.APP_VERSION??'0.3.0',environment:c.environment,channel:c.channel,managed:false
  };
}
export async function operateContainer(_orgId:string,_component:Component,_action:RuntimeAction):Promise<ContainerInfo> {
  throw new AppError(409,'Vercel 没有可启动/停止的本地 Docker 容器。部署和回滚请通过 Vercel 控制台或受信任的部署 Webhook。');
}
export async function containerLogs(_orgId:string,_component:Component,_lines:number):Promise<string[]> {
  return ['Vercel Functions 不提供通过 GraphQL 读取的本地容器日志。请打开 Vercel Project → Logs 查看真实日志。'];
}
export async function recordOp(orgId:string,actorId:string|null,category:string,action:string,status:string,detail:unknown={}) {
  await query('INSERT INTO launcher_events(org_id,actor_id,category,action,status,detail) VALUES($1,$2,$3,$4,$5,$6)',
    [orgId,actorId,category,action,status,JSON.stringify(detail)]);
}
export async function safeRecordOp(orgId:string,actorId:string|null,category:string,action:string,status:string,detail:unknown={}) {
  try{await recordOp(orgId,actorId,category,action,status,detail);}catch(e){console.warn('[operation audit unavailable]',category,action,e);}
}
// Retained for EXE parity documentation and pure tests; never used to control a container.
export function decodeDockerLogs(raw:Buffer):string {
  if(raw.length<8||![0,1,2,3].includes(raw[0])||raw[1]!==0||raw[2]!==0||raw[3]!==0)return raw.toString('utf8');
  const parts:Buffer[]=[];let offset=0;
  while(offset+8<=raw.length){const length=raw.readUInt32BE(offset+4);
    if(length>2_000_000||offset+8+length>raw.length)break;
    parts.push(raw.subarray(offset+8,offset+8+length));offset+=8+length;
  }
  return Buffer.concat(parts).toString('utf8');
}
