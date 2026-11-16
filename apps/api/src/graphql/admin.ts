export const adminTypeDefs=/* GraphQL */`
 type AdminUser { id: ID! name: String! email: String! disabled: Boolean! orgCount: Int! orders: Int! createdAt: String! }
 type AdminOrder { id: ID! orgId: ID! orgName: String! userId: ID! userName: String! email: String! productName: String! credits: Int! amountCents: Int! currency: String! status: String! refundedAmountCents: Int! refundedCredits: Int! stripeSessionId: String createdAt: String! paidAt: String }
 type AdminBillingSettings { paymentsEnabled: Boolean! usageBillingEnabled: Boolean! stripeSecretConfigured: Boolean! webhookSecretConfigured: Boolean! portalConfigured: Boolean! stripeMode: String! webhookUrl: String! }
 type AdminApiSettings { baseUrl: String! mock: Boolean! globalKeyConfigured: Boolean! endpointEditableInVercel: Boolean! }
 type VideoTariff { model: String! resolution: String! credits: Int! active: Boolean! }
 type AdminConnectionTest { ok: Boolean! message: String! }
 type AdminRoleInfo { role: String! capabilities: [String!]! }
 type AdminStaffMember { userId: ID! email: String! name: String! role: String! active: Boolean! updatedAt: String! }
 type AdminLedgerEntry { id: ID! orgId: ID! orgName: String! delta: Int! sourceType: String! sourceId: String! createdAt: String! }
 type AdminInvestigationEvent {
  eventType: String! eventId: ID! orgId: ID orgName: String userId: ID userEmail: String
  createdAt: String! status: String! summary: String!
 }
 type AdminInboxThread {
  id: ID! subject: String! category: String! status: String! priority: String!
  customerId: ID customerEmail: String assignedAdminId: ID assignedAdmin: String
  createdAt: String! updatedAt: String! messageCount: Int!
 }
 type AdminInboxMessage {
  id: ID! threadId: ID! senderId: ID! senderName: String! senderEmail: String!
  content: String! internal: Boolean! createdAt: String!
 }
 extend type Query {
  adminMyRole: AdminRoleInfo!
  adminStaff: [AdminStaffMember!]!
  adminLedger(orgId: String="",sourceType: String="",search: String="",from: String="",to: String="",before: String="",limit: Int=50): [AdminLedgerEntry!]!
  adminInvestigations(orgId: String="",eventType: String="",search: String="",userId: String="",from: String="",to: String="",before: String="",limit: Int=50): [AdminInvestigationEvent!]!
  adminUserTimeline(userId: ID!,from: String="",to: String="",limit: Int=50): [AdminInvestigationEvent!]!
  adminInbox(search: String="",status: String="",category: String="",limit: Int=50): [AdminInboxThread!]!
  adminMessages(threadId: ID!,limit: Int=100): [AdminInboxMessage!]!
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
  adminSetStaffRole(userId: ID!,role: String!,active: Boolean!): Boolean!
  adminCreateThread(subject: String!,category: String!,priority: String!,customerId: ID,assignedAdminId: ID): ID!
  adminSendMessage(threadId: ID!,content: String!): Boolean!
  adminUpdateThread(threadId: ID!,status: String!,priority: String!,assignedAdminId: ID): Boolean!
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
