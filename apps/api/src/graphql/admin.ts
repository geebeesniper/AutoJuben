export const adminTypeDefs=/* GraphQL */`
 type AdminUser { id: ID! name: String! email: String! disabled: Boolean! orgCount: Int! orders: Int! createdAt: String! }
 type AdminOrder { id: ID! orgId: ID! orgName: String! userId: ID! userName: String! email: String! productName: String! credits: Int! amountCents: Int! currency: String! status: String! refundedAmountCents: Int! refundedCredits: Int! stripeSessionId: String createdAt: String! paidAt: String }
 type AdminBillingSettings { paymentsEnabled: Boolean! usageBillingEnabled: Boolean! stripeSecretConfigured: Boolean! webhookSecretConfigured: Boolean! portalConfigured: Boolean! stripeMode: String! webhookUrl: String! }
 type AdminApiSettings { baseUrl: String! mock: Boolean! globalKeyConfigured: Boolean! endpointEditableInVercel: Boolean! }
 type VideoTariff { model: String! resolution: String! credits: Int! active: Boolean! }
 type AdminConnectionTest { ok: Boolean! message: String! }
 extend type Query {
  adminSearchUsers(search: String="",limit: Int=40,offset: Int=0): [AdminUser!]!
  adminOrders(search: String="",status: String="",limit: Int=80): [AdminOrder!]!
  adminProducts: [BillingProduct!]!
  adminTariffs: [VideoTariff!]!
  adminBillingSettings: AdminBillingSettings!
  adminApiSettings: AdminApiSettings!
  adminTestStripe: AdminConnectionTest!
  adminTestVideoApi: AdminConnectionTest!
 }
 extend type Mutation {
  adminSetUserDisabled(userId: ID!,disabled: Boolean!): Boolean!
  adminSaveProduct(id: ID,sku: String!,name: String!,description: String!,credits: Int!,amountCents: Int!,active: Boolean!): BillingProduct!
  adminSaveTariff(model: String!,resolution: String!,credits: Int!,active: Boolean!): VideoTariff!
  adminDeleteTariff(model: String!,resolution: String!): Boolean!
  adminSetBillingFlags(paymentsEnabled: Boolean!,usageBillingEnabled: Boolean!): AdminBillingSettings!
  adminSaveStripeIntegration(secretKey: String,webhookSecret: String,portalConfig: String): AdminBillingSettings!
  adminSaveGlobalVideoKey(key: String!): AdminApiSettings!
 }
`;
export { adminQueries, adminMutations } from '../controllers/admin.controller.js';
