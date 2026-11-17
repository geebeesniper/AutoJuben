import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { platformSettings } from '../billing/common.js';
import { transaction } from '../db/pool.js';
import { requireMembership,memberships } from '../auth/sessions.js';
import { encryptSecret } from '../auth/security.js';
import { providerInfo,validateProviderApiRoutes,type ProviderApiRoutes } from '../provider/client.js';
import { AppError,assert } from '../utils/errors.js';
import type { Context } from '../models/context.js';
import { isoDate,organizationView,projectView,videoJobView } from '../models/view-models.js';
import { listProjects,listMembers,dashboardSummary,listJobs,findJob,hasProviderKey,listAudit,appendAudit,
  insertProject,modifyProject,removeProject,findUserByEmail,addMember,memberRole,updateMemberRole,
  findUserById,removeMember,storeProviderKey,storeProviderApiRoutes,hasInFlightVideoJobs } from '../repositories/core.repository.js';
import { videoJobServiceMutations } from './video-job.service.js';
const manageRoles=['owner','admin'];
const editRoles=['owner','admin','editor'];
async function actor(ctx:Context){assert(ctx.user,'请先登录',401);return ctx.user;}
export const coreServiceQueries = {
  me:(_root:unknown,_args:unknown,{user}:Context)=>user,
  organizations:async (_root:unknown,_args:unknown,ctx:Context)=>{const u=await actor(ctx);return (await memberships(u.id)).map(organizationView);},
  projects:async (_root:unknown,{orgId}:any,ctx:Context)=>{
    await requireMembership(ctx.user,orgId);return (await listProjects(orgId)).map(projectView);
  },
  members:async (_root:unknown,{orgId}:any,ctx:Context)=>{
    await requireMembership(ctx.user,orgId);
    return (await listMembers(orgId)).map((m:any)=>({...m,joinedAt:isoDate(m.joined_at)}));
  },
  dashboard:async (_root:unknown,{orgId}:any,ctx:Context)=>{
    await requireMembership(ctx.user,orgId);return dashboardSummary(orgId);
  },
  jobs:async (_root:unknown,{orgId,projectId,limit}:any,ctx:Context)=>{
    await requireMembership(ctx.user,orgId);
    assert(Number.isInteger(limit)&&limit>=1&&limit<=100,'每页最大 100 条');
    return (await listJobs(orgId,projectId??null,limit)).map(videoJobView);
  },
  job:async (_root:unknown,{orgId,id}:any,ctx:Context)=>{
    await requireMembership(ctx.user,orgId);const row=await findJob(orgId,id);return row?videoJobView(row):null;
  },
  providerInfo:async (_root:unknown,{orgId}:any,ctx:Context)=>{
    await requireMembership(ctx.user,orgId);const info=await providerInfo(orgId);
    const global=await platformSettings();
    return {...info,baseUrl:config.providerUrl,hasKey:await hasProviderKey(orgId)||Boolean(global.provider_key_ciphertext||config.providerKey)};
  },
  auditLogs:async (_root:unknown,{orgId,limit}:any,ctx:Context)=>{
    await requireMembership(ctx.user,orgId,manageRoles);
    assert(Number.isInteger(limit)&&limit>=1&&limit<=100,'最多查看 100 条');
    return (await listAudit(orgId,limit)).map((x:any)=>({id:x.id,action:x.action,actorName:x.actor_name,
      detail:JSON.stringify(x.detail),createdAt:isoDate(x.created_at)}));
  }
};
export const coreServiceMutations = {
  createOrganization:async (_root:unknown,{name}:any,ctx:Context)=>{
    const u=await actor(ctx);const cleaned=String(name).trim();
    assert(cleaned.length>=2&&cleaned.length<=160,'名称需要 2–160 字符');
    const id=randomUUID(),slug=`org-${id.slice(0,12)}`;
    await transaction(async db=>{
      await db.query('INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)',[id,cleaned,slug]);
      await db.query('INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,$3)',[id,u.id,'owner']);
    });
    await appendAudit(id,u.id,'org.created');
    return organizationView({id,name:cleaned,slug,role:'owner',created_at:new Date()});
  },
  createProject:async (_root:unknown,{orgId,name,description}:any,ctx:Context)=>{
    const u=await actor(ctx);await requireMembership(u,orgId,editRoles);
    const cleaned=String(name).trim();assert(cleaned.length>=1&&cleaned.length<=160,'项目名称需要 1–160 字符');
    const row=await insertProject(orgId,cleaned,String(description??'').slice(0,2000),u.id);
    await appendAudit(orgId,u.id,'project.created',{projectId:row.id});return projectView(row);
  },
  updateProject:async (_root:unknown,{orgId,id,name,description}:any,ctx:Context)=>{
    const u=await actor(ctx);await requireMembership(u,orgId,editRoles);
    assert(String(name).trim().length>=1&&String(name).length<=160,'项目名称无效');
    const row=await modifyProject(orgId,id,String(name).trim(),String(description??'').slice(0,2000));
    assert(row,'项目不存在',404);await appendAudit(orgId,u.id,'project.updated',{projectId:id});return projectView(row);
  },
  deleteProject:async (_root:unknown,{orgId,id}:any,ctx:Context)=>{
    const u=await actor(ctx);await requireMembership(u,orgId,manageRoles);
    const result=await removeProject(orgId,id);if(result)await appendAudit(orgId,u.id,'project.deleted',{projectId:id});return result;
  },
  addMember:async (_root:unknown,{orgId,email,role}:any,ctx:Context)=>{
    const u=await actor(ctx);await requireMembership(u,orgId,manageRoles);
    assert(['admin','editor','viewer'].includes(role),'不能直接邀请 owner 角色');
    const found=await findUserByEmail(String(email).trim().toLowerCase());
    assert(found,'该邮箱尚未注册，请对方先创建账户',404);
    try{await addMember(orgId,found.id,role);}catch(err:any){if(err?.code==='23505')throw new AppError(409,'用户已在此工作区');throw err;}
    await appendAudit(orgId,u.id,'member.added',{memberId:found.id,role});
    return {...found,userId:found.id,role,joinedAt:new Date().toISOString()};
  },
  changeMemberRole:async (_root:unknown,{orgId,userId,role}:any,ctx:Context)=>{
    const u=await actor(ctx);await requireMembership(u,orgId,manageRoles);
    assert(['admin','editor','viewer'].includes(role),'不支持该角色');
    const target=await memberRole(orgId,userId);
    assert(target,'成员不存在',404);assert(target.role!=='owner','不能修改工作区所有者角色',403);
    const member=await updateMemberRole(orgId,userId,role);
    const who=await findUserById(userId);
    assert(who,'成员用户不存在',404);
    await appendAudit(orgId,u.id,'member.roleChanged',{memberId:userId,role});
    return {userId,name:who.name,email:who.email,role,joinedAt:isoDate(member.joined_at)};
  },
  removeMember:async (_root:unknown,{orgId,userId}:any,ctx:Context)=>{
    const u=await actor(ctx);await requireMembership(u,orgId,manageRoles);
    const target=await memberRole(orgId,userId);
    assert(target,'成员不存在',404);assert(target.role!=='owner','不能移除工作区所有者',403);
    const removed=await removeMember(orgId,userId);
    await appendAudit(orgId,u.id,'member.removed',{memberId:userId});return removed;
  },
  saveProviderKey:async (_root:unknown,{orgId,key}:any,ctx:Context)=>{
    const u=await actor(ctx);await requireMembership(u,orgId,manageRoles);
    const trimmed=String(key??'').trim();assert(trimmed.length<=1024,'卡密过长');
    await storeProviderKey(orgId,trimmed?encryptSecret(trimmed):null);
    await appendAudit(orgId,u.id,trimmed?'provider.keyConfigured':'provider.keyCleared');return true;
  },
  saveProviderApiRoutes:async (_root:unknown,{orgId,input}:{orgId:string;input:ProviderApiRoutes},ctx:Context)=>{
    const u=await actor(ctx);await requireMembership(u,orgId,manageRoles);
    const safe=validateProviderApiRoutes(input);
    assert(!(await hasInFlightVideoJobs(orgId)),
      '该工作区仍有正在运行或等待提交的视频任务，须先完成任务再修改上游接口',409);
    await storeProviderApiRoutes(orgId,safe,u.id);
    await appendAudit(orgId,u.id,'provider.apiRoutesUpdated',{routes:safe});
    return safe;
  },
    ...videoJobServiceMutations
};
