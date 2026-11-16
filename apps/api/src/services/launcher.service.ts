import {assert} from '../utils/errors.js';
import {config} from '../config.js';
import { readLauncherEvents,updatePreferences } from '../repositories/launcher.repository.js';
import {requireMembership,type User} from '../auth/sessions.js';
import {inspectRuntime,operateContainer,containerLogs,safeRecordOp,runtimeConfig,isPlatformAdmin,rolesManage,type Channel,type Component,type RuntimeAction} from '../launcher/runtime.js';
import {checkReleases,releases,publishRelease,deployRelease,resolveDeployment} from '../launcher/releases.js';
import {createBackup,listBackups,restoreBackup} from '../launcher/backups.js';
import {issueActivation,activationList,revokeActivation,redeemActivation} from '../launcher/activations.js';
export type LauncherContext={user:User|null};
const member=async(ctx:LauncherContext,orgId:string,roles?:string[])=>requireMembership(ctx.user,orgId,roles);
async function platformOwner(ctx:LauncherContext,orgId:string) {
  await member(ctx,orgId,['owner']);
  assert(ctx.user&&isPlatformAdmin(ctx.user.email),'只有平台运维管理员可以绑定容器和发布服务版本',403);
  return ctx.user;
}

export const launcherServiceQueries={
  launcherContainerLogs:async(_:unknown,{orgId,component,lines}:{orgId:string;component:Component;lines:number},ctx:LauncherContext)=>{
    await member(ctx,orgId,rolesManage);assert(['backend','frontend'].includes(component),'未知服务');
    return containerLogs(orgId,component,lines);
  },
  launcherStatus:async(_:unknown,{orgId}:{orgId:string},ctx:LauncherContext)=>{await member(ctx,orgId);return inspectRuntime(orgId);},
  launcherCheckUpdates:async(_:unknown,{orgId}:{orgId:string},ctx:LauncherContext)=>{await member(ctx,orgId);return checkReleases(orgId);},
  launcherReleases:async(_:unknown,{orgId}:{orgId:string},ctx:LauncherContext)=>{await member(ctx,orgId);return releases(orgId);},
  launcherBackups:async(_:unknown,{orgId}:{orgId:string},ctx:LauncherContext)=>{await member(ctx,orgId,rolesManage);return listBackups(orgId);},
  launcherEvents:async(_:unknown,{orgId,category,limit}:{orgId:string;category?:string;limit:number},ctx:LauncherContext)=>{
    await member(ctx,orgId,rolesManage);assert(Number.isInteger(limit)&&limit>=1&&limit<=200,'日志记录上限 200');
    return (await readLauncherEvents(orgId,category??null,limit)).map((x:any)=>({id:x.id,category:x.category,action:x.action,status:x.status,
      detail:JSON.stringify(x.detail),actorName:x.actor_name,createdAt:x.created_at.toISOString()}));
  },
  launcherActivationCodes:async(_:unknown,{orgId}:{orgId:string},ctx:LauncherContext)=>{await member(ctx,orgId,rolesManage);return activationList(orgId);}
};
export const launcherServiceMutations={
  launcherAllAction:async(_:unknown,{orgId,action}:{orgId:string;action:'start'|'stop'},ctx:LauncherContext)=>{
    await member(ctx,orgId,rolesManage);assert(['start','stop'].includes(action),'整体服务操作只能为 start 或 stop');
    const c=await runtimeConfig(orgId);
    assert(c.backend_container&&c.frontend_container,'必须先绑定前后端容器才能操作全部服务',409);
    const sequence:Component[]=action==='start'?['backend','frontend']:['frontend','backend'];
    for(const component of sequence){
      try{const result=await operateContainer(orgId,component,action);
        await safeRecordOp(orgId,ctx.user!.id,'service',`${component}.${action}`,'success',{container:result.name});}
      catch(e){await safeRecordOp(orgId,ctx.user!.id,'service',`all.${action}`,'failed',{component,error:String(e)});throw e;}
    }
    return inspectRuntime(orgId);
  },
  launcherServiceAction:async(_:unknown,{orgId,component,action}:{orgId:string;component:Component;action:RuntimeAction},ctx:LauncherContext)=>{
    await member(ctx,orgId,rolesManage);
    assert(['backend','frontend'].includes(component),'未知服务',400);
    assert(['start','stop','restart'].includes(action),'未知操作',400);
    try {
      const result=await operateContainer(orgId,component,action);
      await safeRecordOp(orgId,ctx.user!.id,'service',`${component}.${action}`,'success',{container:result.name});return result;
    }catch(e){await safeRecordOp(orgId,ctx.user!.id,'service',`${component}.${action}`,'failed',{error:String(e)});throw e;}
  },
  launcherSavePreferences:async(_:unknown,{orgId,environment,channel}:{orgId:string;environment:string;channel:Channel},ctx:LauncherContext)=>{
    await member(ctx,orgId,rolesManage);
    assert(['prod','dev'].includes(environment),'环境必须是 prod 或 dev');
    assert(['stable','beta','gray'].includes(channel),'更新通道无效');
    await runtimeConfig(orgId);
    await updatePreferences(orgId,environment,channel);
    await safeRecordOp(orgId,ctx.user!.id,'settings','saved','success',{environment,channel});return true;
  },
  launcherProvisionContainers:async(_:unknown,{orgId}:{orgId:string},ctx:LauncherContext)=>{
    await member(ctx,orgId,['owner']);
    throw new Error('Vercel + Supabase 部署没有容器绑定。请在 Vercel 项目设置连接 Supabase 与 Git 仓库。');
  },
  launcherPublishRelease:async(_:unknown,{orgId,version,channel,notes}:{orgId:string;version:string;channel:Channel;notes:string},ctx:LauncherContext)=>{
    const user=await platformOwner(ctx,orgId);return publishRelease(orgId,user.id,version,channel,notes);
  },
  launcherInstallRelease:async(_:unknown,{orgId,version}:{orgId:string;version:string},ctx:LauncherContext)=>{
    await member(ctx,orgId,['owner']);return deployRelease(orgId,ctx.user!.id,version);
  },
  launcherConfirmDeployment:async(_:unknown,{orgId,actualVersion}:{orgId:string;actualVersion:string},ctx:LauncherContext)=>{
    const user=await platformOwner(ctx,orgId);return resolveDeployment(orgId,user.id,actualVersion);
  },
  launcherCreateBackup:async(_:unknown,{orgId,name}:{orgId:string;name:string},ctx:LauncherContext)=>{
    await member(ctx,orgId,rolesManage);return createBackup(orgId,ctx.user!.id,name);
  },
  launcherRestoreBackup:async(_:unknown,{orgId,backupId,confirmation}:{orgId:string;backupId:string;confirmation:string},ctx:LauncherContext)=>{
    await member(ctx,orgId,['owner']);return restoreBackup(orgId,ctx.user!.id,backupId,confirmation);
  },
  launcherIssueActivation:async(_:unknown,{orgId,label,role,expiresDays,maxUses}:{orgId:string;label:string;role:string;expiresDays:number;maxUses:number},ctx:LauncherContext)=>{
    await member(ctx,orgId,rolesManage);return issueActivation(orgId,ctx.user!.id,label,role,expiresDays,maxUses);
  },
  launcherRevokeActivation:async(_:unknown,{orgId,activationId}:{orgId:string;activationId:string},ctx:LauncherContext)=>{
    await member(ctx,orgId,rolesManage);return revokeActivation(orgId,ctx.user!.id,activationId);
  },
  launcherRedeemActivation:async(_:unknown,{code}:{code:string},ctx:LauncherContext)=>{
    assert(ctx.user,'必须先注册并登录 SaaS 账户',401);return redeemActivation(ctx.user.id,code);
  }
};
