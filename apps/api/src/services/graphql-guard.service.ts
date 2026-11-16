import {parse,Kind} from 'graphql';
import type {SelectionSetNode} from 'graphql';
import {AppError,assert} from '../utils/errors.js';
/** Bounded GraphQL payload, field count and selection depth. Fragment usage is intentionally disallowed. */
export async function guardGraphqlDocument(request:Request){
 assert(request.method==='POST','GraphQL 仅允许 POST 请求',405);
 const type=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
 assert(type==='application/json','GraphQL 必须使用 application/json',415);
 const source=await request.clone().text();assert(source.length<=32768,'GraphQL 请求过大',413);
 let payload:unknown;
 try{payload=JSON.parse(source);}catch{throw new AppError(400,'GraphQL JSON 无效');}
 assert(payload&&typeof payload==='object'&&!Array.isArray(payload),'不允许 GraphQL 批量请求');
 const query=(payload as Record<string,unknown>).query;
 assert(typeof query==='string'&&query.length>0&&query.length<=20000,'GraphQL query 无效');
 let document;try{document=parse(query);}catch{throw new AppError(400,'GraphQL 文档无效');}
 assert(document.definitions.length===1 && document.definitions[0].kind===Kind.OPERATION_DEFINITION,
  '每个请求仅允许一个 GraphQL operation，不支持 fragment',400);
 let fieldCount=0;
 function walk(selections:SelectionSetNode,depth:number){
  assert(depth<=9,'GraphQL 查询嵌套层级超过限制',400);
  for(const sel of selections.selections){
   assert(sel.kind===Kind.FIELD,'不允许 GraphQL fragments',400);
   fieldCount++;assert(fieldCount<=120,'GraphQL 字段数超过限制',400);
   if(sel.name.value==='__schema'||sel.name.value==='__type')throw new AppError(403,'禁止远程 schema introspection');
   if(sel.selectionSet)walk(sel.selectionSet,depth+1);
  }
 }
 walk(document.definitions[0].selectionSet,1);
 return true;
}
