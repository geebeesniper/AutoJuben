import type { Context } from '../models/context.js';
import { coreServiceQueries, coreServiceMutations } from '../services/core.service.js';
/** GraphQL adapters: no SQL, side effects, or business rules here. */
export const coreQueries = {
  me: (_root: unknown, args: any, context: Context) => coreServiceQueries.me(_root, args, context),
  organizations: (_root: unknown, args: any, context: Context) => coreServiceQueries.organizations(_root, args, context),
  projects: (_root: unknown, args: any, context: Context) => coreServiceQueries.projects(_root, args, context),
  members: (_root: unknown, args: any, context: Context) => coreServiceQueries.members(_root, args, context),
  dashboard: (_root: unknown, args: any, context: Context) => coreServiceQueries.dashboard(_root, args, context),
  jobs: (_root: unknown, args: any, context: Context) => coreServiceQueries.jobs(_root, args, context),
  job: (_root: unknown, args: any, context: Context) => coreServiceQueries.job(_root, args, context),
  providerInfo: (_root: unknown, args: any, context: Context) => coreServiceQueries.providerInfo(_root, args, context),
  auditLogs: (_root: unknown, args: any, context: Context) => coreServiceQueries.auditLogs(_root, args, context),
};
export const coreMutations = {
  createOrganization: (_root: unknown, args: any, context: Context) => coreServiceMutations.createOrganization(_root, args, context),
  createProject: (_root: unknown, args: any, context: Context) => coreServiceMutations.createProject(_root, args, context),
  updateProject: (_root: unknown, args: any, context: Context) => coreServiceMutations.updateProject(_root, args, context),
  deleteProject: (_root: unknown, args: any, context: Context) => coreServiceMutations.deleteProject(_root, args, context),
  addMember: (_root: unknown, args: any, context: Context) => coreServiceMutations.addMember(_root, args, context),
  changeMemberRole: (_root: unknown, args: any, context: Context) => coreServiceMutations.changeMemberRole(_root, args, context),
  removeMember: (_root: unknown, args: any, context: Context) => coreServiceMutations.removeMember(_root, args, context),
  saveProviderKey: (_root: unknown, args: any, context: Context) => coreServiceMutations.saveProviderKey(_root, args, context),
  saveProviderApiRoutes: (_root: unknown, args: any, context: Context) => coreServiceMutations.saveProviderApiRoutes(_root, args, context),
  resolveSubmission: (_root: unknown, args: any, context: Context) => coreServiceMutations.resolveSubmission(_root, args, context),
  createVideoJob: (_root: unknown, args: any, context: Context) => coreServiceMutations.createVideoJob(_root, args, context),
};
