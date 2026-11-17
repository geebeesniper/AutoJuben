import { createSchema } from 'graphql-yoga';
import type { Context } from '../models/context.js';
import { apiKeyTypeDefs,apiKeyQueries,apiKeyMutations } from './api-keys.js';
import { apiMetricsTypeDefs,apiMetricQueries } from './api-metrics.js';
import { coreQueries, coreMutations } from '../controllers/core.controller.js';
import { launcherTypeDefs, launcherQueries, launcherMutations } from './launcher.js';
import { portalTypeDefs, portalQueries, portalMutations } from './portal.js';
import { adminTypeDefs, adminQueries, adminMutations } from './admin.js';
export type { Context } from '../models/context.js';
export const coreTypeDefs=/* GraphQL */`
  type User { id: ID! name: String! email: String! }
  type Organization { id: ID! name: String! slug: String! role: String! createdAt: String }
  type Project { id: ID! orgId: ID! name: String! description: String! jobCount: Int! createdAt: String }
  type Member { userId: ID! name: String! email: String! role: String! joinedAt: String }
  type ProviderApiRoutes {
    pricingPath: String! settingsPath: String! submitPath: String!
    taskPath: String! videoLinkPath: String! authMode: String!
  }
  input ProviderApiRoutesInput {
    pricingPath: String! settingsPath: String! submitPath: String!
    taskPath: String! videoLinkPath: String! authMode: String!
  }
  type ProviderInfo {
    mock: Boolean! pricing: String! settings: String! baseUrl: String! hasKey: Boolean! connectionError: String
    endpoints: ProviderApiRoutes!
  }
  type VideoJob {
    id: ID! orgId: ID! projectId: ID clientTaskId: String! providerTaskId: String
    prompt: String! model: String! duration: Int! ratio: String! resolution: String!
    status: String! progress: Int! requiredCredits: Int billingStatus: String
    platformCreditCost: Int! platformCreditState: String!
    videoUrl: String errorCode: String errorMessage: String isDemo: Boolean!
    imageUrls: [String!]! audioUrls: [String!]! videoUrls: [String!]!
    createdAt: String updatedAt: String submittedAt: String finishedAt: String
  }
  type Dashboard { total: Int! active: Int! completed: Int! failed: Int! projects: Int! }
  type AuditLog { id: ID! action: String! actorName: String detail: String! createdAt: String! }
  input VideoJobInput {
    projectId: ID clientTaskId: String prompt: String! model: String! duration: Int! ratio: String! resolution: String!
    imageUrls: [String!] audioUrls: [String!] videoUrls: [String!]
    imageAssetIds: [ID!] audioAssetIds: [ID!] videoAssetIds: [ID!]
  }
  type Query {
    me: User
    organizations: [Organization!]!
    projects(orgId: ID!): [Project!]!
    members(orgId: ID!): [Member!]!
    dashboard(orgId: ID!): Dashboard!
    jobs(orgId: ID!,projectId: ID,limit: Int=60): [VideoJob!]!
    job(orgId: ID!,id: ID!): VideoJob
    providerInfo(orgId: ID!): ProviderInfo!
    auditLogs(orgId: ID!,limit: Int=50): [AuditLog!]!
  }
  type Mutation {
    createOrganization(name: String!): Organization!
    createProject(orgId: ID!,name: String!,description: String): Project!
    updateProject(orgId: ID!,id: ID!,name: String!,description: String): Project!
    deleteProject(orgId: ID!,id: ID!): Boolean!
    addMember(orgId: ID!,email: String!,role: String!): Member!
    changeMemberRole(orgId: ID!,userId: ID!,role: String!): Member!
    removeMember(orgId: ID!,userId: ID!): Boolean!
    saveProviderKey(orgId: ID!,key: String!): Boolean!
    saveProviderApiRoutes(orgId: ID!,input: ProviderApiRoutesInput!): ProviderApiRoutes!
    createVideoJob(orgId: ID!,input: VideoJobInput!): VideoJob!
    resolveSubmission(orgId: ID!,id: ID!,providerTaskId: String,confirmedNotSubmitted: Boolean=false): VideoJob!
  }
`;
export const schema = createSchema<Context>({
  typeDefs:[coreTypeDefs,launcherTypeDefs,portalTypeDefs,adminTypeDefs,apiKeyTypeDefs,apiMetricsTypeDefs],
  resolvers:{
    Query:{...coreQueries,...launcherQueries,...portalQueries,...adminQueries,...apiKeyQueries,...apiMetricQueries},
    Mutation:{...coreMutations,...launcherMutations,...portalMutations,...adminMutations,...apiKeyMutations}
  }
});
