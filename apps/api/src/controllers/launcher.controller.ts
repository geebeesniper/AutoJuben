import type { Context } from '../models/context.js';
import { launcherServiceQueries, launcherServiceMutations } from '../services/launcher.service.js';
/** GraphQL adapters: no SQL, side effects, or business rules here. */
export const launcherQueries = {
  launcherContainerLogs: (_root: unknown, args: any, context: Context) => launcherServiceQueries.launcherContainerLogs(_root, args, context),
  launcherStatus: (_root: unknown, args: any, context: Context) => launcherServiceQueries.launcherStatus(_root, args, context),
  launcherCheckUpdates: (_root: unknown, args: any, context: Context) => launcherServiceQueries.launcherCheckUpdates(_root, args, context),
  launcherReleases: (_root: unknown, args: any, context: Context) => launcherServiceQueries.launcherReleases(_root, args, context),
  launcherBackups: (_root: unknown, args: any, context: Context) => launcherServiceQueries.launcherBackups(_root, args, context),
  launcherEvents: (_root: unknown, args: any, context: Context) => launcherServiceQueries.launcherEvents(_root, args, context),
  launcherActivationCodes: (_root: unknown, args: any, context: Context) => launcherServiceQueries.launcherActivationCodes(_root, args, context),
};
export const launcherMutations = {
  launcherAllAction: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherAllAction(_root, args, context),
  launcherServiceAction: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherServiceAction(_root, args, context),
  launcherSavePreferences: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherSavePreferences(_root, args, context),
  launcherProvisionContainers: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherProvisionContainers(_root, args, context),
  launcherPublishRelease: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherPublishRelease(_root, args, context),
  launcherInstallRelease: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherInstallRelease(_root, args, context),
  launcherConfirmDeployment: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherConfirmDeployment(_root, args, context),
  launcherCreateBackup: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherCreateBackup(_root, args, context),
  launcherRestoreBackup: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherRestoreBackup(_root, args, context),
  launcherIssueActivation: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherIssueActivation(_root, args, context),
  launcherRevokeActivation: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherRevokeActivation(_root, args, context),
  launcherRedeemActivation: (_root: unknown, args: any, context: Context) => launcherServiceMutations.launcherRedeemActivation(_root, args, context),
};
