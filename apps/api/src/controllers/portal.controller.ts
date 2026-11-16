import type { Context } from '../models/context.js';
import { portalServiceQueries, portalServiceMutations } from '../services/portal.service.js';
/** GraphQL adapters: no SQL, side effects, or business rules here. */
export const portalQueries = {
  viewerCapabilities: (_root: unknown, args: any, context: Context) => portalServiceQueries.viewerCapabilities(_root, args, context),
  myHistory: (_root: unknown, args: any, context: Context) => portalServiceQueries.myHistory(_root, args, context),
  myOrders: (_root: unknown, args: any, context: Context) => portalServiceQueries.myOrders(_root, args, context),
  billingCatalog: (_root: unknown, args: any, context: Context) => portalServiceQueries.billingCatalog(_root, args, context),
  myPaymentCards: (_root: unknown, args: any, context: Context) => portalServiceQueries.myPaymentCards(_root, args, context),
  walletSummary: (_root: unknown, args: any, context: Context) => portalServiceQueries.walletSummary(_root, args, context),
  billingAvailability: (_root: unknown, args: any, context: Context) => portalServiceQueries.billingAvailability(_root, args, context),
};
export const portalMutations = {
  updateMyName: (_root: unknown, args: any, context: Context) => portalServiceMutations.updateMyName(_root, args, context),
  createCheckout: (_root: unknown, args: any, context: Context) => portalServiceMutations.createCheckout(_root, args, context),
  createBillingPortal: (_root: unknown, args: any, context: Context) => portalServiceMutations.createBillingPortal(_root, args, context),
};
