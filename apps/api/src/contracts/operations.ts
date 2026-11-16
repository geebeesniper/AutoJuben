import type { Context } from '../models/context.js';
import { coreQueries,coreMutations } from '../controllers/core.controller.js';
import { portalQueries,portalMutations } from '../controllers/portal.controller.js';
import { adminQueries,adminMutations } from '../controllers/admin.controller.js';
import { apiKeyQueries,apiKeyMutations } from '../controllers/api-key.controller.js';
import { AppError,assert } from '../utils/errors.js';

/** Schema-first common contract: GraphQL reuses the same controllers; REST/JSON validate explicit DTO fields. */
type Primitive='string'|'int'|'bool'|'object'|'stringArray';
type Rule={type:Primitive;required?:boolean;max?:number;min?:number;default?:unknown;shape?:FieldMap};
type FieldMap=Record<string,Rule>;
type Resolver=(_root:unknown,args:any,context:Context)=>unknown|Promise<unknown>;
export type Scope='read'|'write'|'session';
type Operation={scope:Scope;fields:FieldMap;resolve:Resolver};
const str=(required=true,max=160):Rule=>({type:'string',required,max});
const integer=(fallback?:number,min=0,max=10000):Rule=>({type:'int',required:fallback===undefined,default:fallback,min,max});
const optional=(max=160):Rule=>str(false,max);
const flag:Rule={type:'bool',required:true};
const list=(max=9):Rule=>({type:'stringArray',required:false,max});
const videoInput:FieldMap={
  projectId:optional(80),clientTaskId:optional(160),prompt:str(true,8000),model:str(true,80),duration:integer(undefined,4,15),
  ratio:str(true,8),resolution:str(true,12),imageUrls:list(9),audioUrls:list(3),videoUrls:list(3),
  imageAssetIds:list(9),audioAssetIds:list(3),videoAssetIds:list(3)
};
const videoRule:Rule={type:'object',required:true,shape:videoInput};
// All operations are explicitly allowlisted; no arbitrary property dispatch, SQL or reflective method invocation.
export const operations={
 me:{scope:'session',fields:{},resolve:coreQueries.me},
 organizations:{scope:'session',fields:{},resolve:coreQueries.organizations},
 projects:{scope:'read',fields:{orgId:str()},resolve:coreQueries.projects},
 createProject:{scope:'write',fields:{orgId:str(),name:str(true,160),description:optional(2000)},resolve:coreMutations.createProject},
 updateProject:{scope:'write',fields:{orgId:str(),id:str(),name:str(true,160),description:optional(2000)},resolve:coreMutations.updateProject},
 deleteProject:{scope:'write',fields:{orgId:str(),id:str()},resolve:coreMutations.deleteProject},
 jobs:{scope:'read',fields:{orgId:str(),projectId:optional(80),limit:integer(60,1,100)},resolve:coreQueries.jobs},
 job:{scope:'read',fields:{orgId:str(),id:str()},resolve:coreQueries.job},
 createVideoJob:{scope:'write',fields:{orgId:str(),input:videoRule},resolve:coreMutations.createVideoJob},
 myHistory:{scope:'read',fields:{orgId:str(),limit:integer(60,1,100)},resolve:portalQueries.myHistory},
 walletSummary:{scope:'read',fields:{orgId:str()},resolve:portalQueries.walletSummary},
 myOrders:{scope:'session',fields:{limit:integer(80,1,100)},resolve:portalQueries.myOrders},
 billingCatalog:{scope:'session',fields:{},resolve:portalQueries.billingCatalog},
 myPaymentCards:{scope:'session',fields:{},resolve:portalQueries.myPaymentCards},
 billingAvailability:{scope:'session',fields:{},resolve:portalQueries.billingAvailability},
 updateMyName:{scope:'session',fields:{name:str(true,120)},resolve:portalMutations.updateMyName},
 createCheckout:{scope:'session',fields:{orgId:str(),productId:str()},resolve:portalMutations.createCheckout},
 createBillingPortal:{scope:'session',fields:{},resolve:portalMutations.createBillingPortal},
 apiKeys:{scope:'session',fields:{orgId:str()},resolve:apiKeyQueries.apiKeys},
 createApiKey:{scope:'session',fields:{orgId:str(),label:str(true,80),scope:str(true,12),expiresInDays:integer(90,1,365)},resolve:apiKeyMutations.createApiKey},
 revokeApiKey:{scope:'session',fields:{orgId:str(),id:str()},resolve:apiKeyMutations.revokeApiKey},
 adminSearchUsers:{scope:'session',fields:{search:{type:'string',required:false,max:100,default:''},limit:integer(40,1,100),offset:integer(0,0,10000)},resolve:adminQueries.adminSearchUsers},
 adminOrders:{scope:'session',fields:{search:{type:'string',required:false,max:100,default:''},status:{type:'string',required:false,max:40,default:''},limit:integer(80,1,100)},resolve:adminQueries.adminOrders},
 adminProducts:{scope:'session',fields:{},resolve:adminQueries.adminProducts},
 adminBillingSettings:{scope:'session',fields:{},resolve:adminQueries.adminBillingSettings},
 adminApiSettings:{scope:'session',fields:{},resolve:adminQueries.adminApiSettings},
 adminTestStripe:{scope:'session',fields:{},resolve:adminQueries.adminTestStripe},
 adminTestVideoApi:{scope:'session',fields:{},resolve:adminQueries.adminTestVideoApi},
 adminSetUserDisabled:{scope:'session',fields:{userId:str(),disabled:flag},resolve:adminMutations.adminSetUserDisabled}
} satisfies Record<string,Operation>;
export type OperationName=keyof typeof operations;
export function isOperationName(name:string):name is OperationName{return Object.hasOwn(operations,name);}
export function operationScope(name:OperationName):Scope{return operations[name].scope;}

function normalize(fields:FieldMap,source:unknown,path='params'):Record<string,unknown>{
  assert(source!==null&&typeof source==='object'&&!Array.isArray(source),`${path} 必须是 JSON 对象`);
  const input=source as Record<string,unknown>;
  for(const key of Object.keys(input))assert(Object.hasOwn(fields,key),`未知字段：${path}.${key}`);
  const result:Record<string,unknown>={};
  for(const [key,rule] of Object.entries(fields)){
    const value=input[key];
    if(value===undefined||value===null||(value===''&&rule.type!=='string')){
      if(rule.default!==undefined){result[key]=rule.default;continue;}
      assert(!rule.required,`缺少字段：${path}.${key}`);
      continue;
    }
    if(rule.type==='object')result[key]=normalize(rule.shape??{},value,`${path}.${key}`);
    else if(rule.type==='string'){
      assert(typeof value==='string'&&value.length<= (rule.max??1000),`${path}.${key} 必须是字符串且不超过长度限制`);
      result[key]=value;
    }else if(rule.type==='int'){
      const parsed=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value;
      assert(typeof parsed==='number'&&Number.isInteger(parsed)&&parsed>=(rule.min??0)&&parsed<=(rule.max??Number.MAX_SAFE_INTEGER),`${path}.${key} 必须是允许范围内的整数`);
      result[key]=parsed;
    }else if(rule.type==='bool'){
      const bool=value==='true'?true:value==='false'?false:value;
      assert(typeof bool==='boolean',`${path}.${key} 必须是布尔值`);result[key]=bool;
    }else if(rule.type==='stringArray'){
      assert(Array.isArray(value)&&value.length<=(rule.max??9)&&value.every(v=>typeof v==='string'&&v.length<=2048),`${path}.${key} 必须是合法的字符串数组`);
      result[key]=value;
    }else throw new AppError(500,'不支持的契约类型');
  }
  return result;
}
export function validatedArgs(name:string,source:unknown):{name:OperationName;args:Record<string,unknown>}{
  assert(isOperationName(name),'不支持的 API 操作',404);
  return {name,args:normalize(operations[name].fields,source)};
}
export function callOperation(name:OperationName,args:Record<string,unknown>,ctx:Context){
  return operations[name].resolve(null,args,ctx);
}

/** REST contract. Route values are relative to /api/v1; exact method+segment matching. */
export const restRoutes=[
 ['GET','/me','me'],['GET','/organizations','organizations'],
 ['GET','/organizations/:orgId/projects','projects'],['POST','/organizations/:orgId/projects','createProject'],
 ['PATCH','/organizations/:orgId/projects/:id','updateProject'],['DELETE','/organizations/:orgId/projects/:id','deleteProject'],
 ['GET','/organizations/:orgId/jobs','jobs'],['POST','/organizations/:orgId/jobs','createVideoJob'],
 ['GET','/organizations/:orgId/jobs/:id','job'],
 ['GET','/organizations/:orgId/history','myHistory'],['GET','/organizations/:orgId/wallet','walletSummary'],
 ['GET','/orders','myOrders'],['GET','/catalog','billingCatalog'],['GET','/payment-methods','myPaymentCards'],
 ['GET','/billing/availability','billingAvailability'],['PATCH','/profile','updateMyName'],
 ['POST','/billing/checkout','createCheckout'],['POST','/billing/portal','createBillingPortal'],
 ['GET','/organizations/:orgId/api-keys','apiKeys'],['POST','/organizations/:orgId/api-keys','createApiKey'],
 ['DELETE','/organizations/:orgId/api-keys/:id','revokeApiKey'],
 ['GET','/admin/users','adminSearchUsers'],['PATCH','/admin/users/:userId','adminSetUserDisabled'],
 ['GET','/admin/orders','adminOrders'],['GET','/admin/products','adminProducts'],
 ['GET','/admin/billing-settings','adminBillingSettings'],['GET','/admin/api-settings','adminApiSettings'],
 ['POST','/admin/test-stripe','adminTestStripe'],['POST','/admin/test-video-api','adminTestVideoApi']
] as const satisfies ReadonlyArray<readonly [string,string,OperationName]>;
export function matchRestRoute(method:string,path:string){
  const parts=path.split('/').filter(Boolean);
  for(const [verb,template,name] of restRoutes){
    const target=template.split('/').filter(Boolean);
    if(verb!==method||target.length!==parts.length)continue;
    const params:Record<string,string>={};let valid=true;
    for(let i=0;i<target.length;i++){
      if(target[i].startsWith(':')){
        try{params[target[i].slice(1)]=decodeURIComponent(parts[i]);}catch{valid=false;break;}
      }else if(target[i]!==parts[i]){valid=false;break;}
    }
    if(valid)return {name,params};
  }
  return null;
}
