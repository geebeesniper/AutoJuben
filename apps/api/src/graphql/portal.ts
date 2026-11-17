export const portalTypeDefs=/* GraphQL */`
 type HelpArticle { id: ID! slug: String! category: String! title: String! answer: String! }
 type CustomerHelpThread { id: ID! subject: String! category: String! status: String! priority: String! createdAt: String! updatedAt: String! assignedAdminId: ID messageCount: Int! }
 type CustomerHelpMessage { id: ID! threadId: ID! senderName: String! content: String! mine: Boolean! createdAt: String! }
 type ViewerCapabilities { platformAdmin: Boolean! adminRole: String! adminCapabilities: [String!]! }
 type AccountActivity { id: ID! action: String! detail: String! createdAt: String! }
 type PurchaseOrder { id: ID! orgId: ID! productName: String! credits: Int! amountCents: Int! currency: String! status: String! refundedAmountCents: Int! createdAt: String! paidAt: String }
 type BillingProduct { id: ID! sku: String! name: String! description: String! credits: Int! amountCents: Int! currency: String! active: Boolean! }
 type PaymentCard { id: ID! brand: String! last4: String! expMonth: Int! expYear: Int! }
 type PaymentLink { url: String! orderId: ID }
 type WalletSummary { balance: Float! usageBillingEnabled: Boolean! }
 type BillingAvailability { enabled: Boolean! gateway: String! message: String! }
 extend type Query {
   helpArticles(category: String="",search: String="",locale: String="zh",limit: Int=60): [HelpArticle!]!
   myHelpThreads(category: String="",status: String="",limit: Int=60): [CustomerHelpThread!]!
   myHelpMessages(threadId: ID!,limit: Int=100): [CustomerHelpMessage!]!
   viewerCapabilities: ViewerCapabilities!
   myHistory(orgId: ID!,limit: Int=60): [AccountActivity!]!
   myOrders(limit: Int=80): [PurchaseOrder!]!
   billingCatalog: [BillingProduct!]!
   myPaymentCards: [PaymentCard!]!
   walletSummary(orgId: ID!): WalletSummary!
   billingAvailability: BillingAvailability!
 }
 extend type Mutation {
   recordMyPresence: Boolean!
   openHelpTicket(category: String!,subject: String!,content: String!): ID!
   replyHelpTicket(threadId: ID!,content: String!): Boolean!
   updateMyName(name: String!): User!
   createCheckout(orgId: ID!,productId: ID!): PaymentLink!
   createBillingPortal: PaymentLink!
 }
`;
export { portalQueries, portalMutations } from '../controllers/portal.controller.js';
