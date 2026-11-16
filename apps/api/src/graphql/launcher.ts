export const launcherTypeDefs=/* GraphQL */`
  type LauncherComponent {name:String state:String! health:String! running:Boolean! configured:Boolean! error:String}
  type LauncherStatus { backend:LauncherComponent! frontend:LauncherComponent! currentVersion:String! environment:String! channel:String! managed:Boolean! }
  type LauncherUpdateCheck {currentVersion:String! latestVersion:String available:Boolean! channel:String! notes:String! deploymentState:String desiredVersion:String}
  type LauncherRelease {id:ID! version:String! channel:String! notes:String! createdAt:String!}
  type LauncherBackup {id:ID! name:String! bytes:Float! assetCount:Int! projectCount:Int! jobCount:Int! checksum:String! createdAt:String!}
  type LauncherRestoreResult {restoredBackupId:ID! safetyBackupId:ID! projects:Int! jobs:Int! assets:Int!}
  type LauncherActivation {id:ID! label:String! role:String! expiresAt:String! uses:Int! maxUses:Int! revoked:Boolean! createdAt:String!}
  type LauncherIssuedCode {id:ID! code:String! label:String! role:String! expiresAt:String! uses:Int! maxUses:Int!}
  type LauncherRedeemed {orgId:ID! role:String!}
  type LauncherEvent {id:ID! category:String! action:String! status:String! detail:String! actorName:String createdAt:String!}
  extend type Query {
    launcherStatus(orgId:ID!):LauncherStatus!
    launcherContainerLogs(orgId:ID!,component:String!,lines:Int=200):[String!]!
    launcherCheckUpdates(orgId:ID!):LauncherUpdateCheck!
    launcherReleases(orgId:ID!):[LauncherRelease!]!
    launcherBackups(orgId:ID!):[LauncherBackup!]!
    launcherEvents(orgId:ID!,category:String,limit:Int=100):[LauncherEvent!]!
    launcherActivationCodes(orgId:ID!):[LauncherActivation!]!
  }
  extend type Mutation {
    launcherServiceAction(orgId:ID!,component:String!,action:String!):LauncherComponent!
    launcherAllAction(orgId:ID!,action:String!):LauncherStatus!
    launcherSavePreferences(orgId:ID!,environment:String!,channel:String!):Boolean!
    launcherProvisionContainers(orgId:ID!,backendContainer:String,frontendContainer:String):Boolean!
    launcherPublishRelease(orgId:ID!,version:String!,channel:String!,notes:String!):LauncherRelease!
    launcherInstallRelease(orgId:ID!,version:String!):LauncherUpdateCheck!
    launcherConfirmDeployment(orgId:ID!,actualVersion:String!):LauncherUpdateCheck!
    launcherCreateBackup(orgId:ID!,name:String!):LauncherBackup!
    launcherRestoreBackup(orgId:ID!,backupId:ID!,confirmation:String!):LauncherRestoreResult!
    launcherIssueActivation(orgId:ID!,label:String!,role:String!,expiresDays:Int!,maxUses:Int!):LauncherIssuedCode!
    launcherRevokeActivation(orgId:ID!,activationId:ID!):Boolean!
    launcherRedeemActivation(code:String!):LauncherRedeemed!
  }
`;
export { launcherQueries, launcherMutations } from '../controllers/launcher.controller.js';
