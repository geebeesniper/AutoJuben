export const portalTypeDefs=/* GraphQL */`
 type ViewerCapabilities { platformAdmin: Boolean! }
 type AccountActivity { id: ID! action: String! detail: String! createdAt: String! }
 type PurchaseOrder { id: ID! orgId: ID! productName: String! credits: Int! amountCents: Int! currency: String! status: String! refundedAmountCents: Int! createdAt: String! paidAt: String }
 type BillingProduct { id: ID! sku: String! name: String! description: String! credits: Int! amountCents: Int! currency: String! active: Boolean! }
 type PaymentCard { id: ID! brand: String! last4: String! expMonth: Int! expYear: Int! }
 type PaymentLink { url: String! orderId: ID }
 type WalletSummary { balance: Float! usageBillingEnabled: Boolean! }
 type BillingAvailability { enabled: Boolean! gateway: String! message: String! }
 extend type Query {
   viewerCapabilities: ViewerCapabilities!
   myHistory(orgId: ID!,limit: Int=60): [AccountActivity!]!
   myOrders(limit: Int=80): [PurchaseOrder!]!
   billingCatalog: [BillingProduct!]!
   myPaymentCards: [PaymentCard!]!
   walletSummary(orgId: ID!): WalletSummary!
   billingAvailability: BillingAvailability!
 }
 extend type Mutation {
   updateMyName(name: String!): User!
   createCheckout(orgId: ID!,productId: ID!): PaymentLink!
   createBillingPortal: PaymentLink!
 }
`;
export { portalQueries, portalMutations } from '../controllers/portal.controller.js';
