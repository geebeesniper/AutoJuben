import type { Context } from '../models/context.js';
import { portalServiceQueries, portalServiceMutations } from '../services/portal.service.js';
/** GraphQL adapters: no SQL, side effects, or business rules here. */
export const portalQueries = {
  helpArticles: (_root: unknown, args: any, context: Context) => portalServiceQueries.helpArticles(_root, args, context),
  myHelpThreads: (_root: unknown, args: any, context: Context) => portalServiceQueries.myHelpThreads(_root, args, context),
  myHelpMessages: (_root: unknown, args: any, context: Context) => portalServiceQueries.myHelpMessages(_root, args, context),
  viewerCapabilities: (_root: unknown, args: any, context: Context) => portalServiceQueries.viewerCapabilities(_root, args, context),
  myHistory: (_root: unknown, args: any, context: Context) => portalServiceQueries.myHistory(_root, args, context),
  myOrders: (_root: unknown, args: any, context: Context) => portalServiceQueries.myOrders(_root, args, context),
  billingCatalog: (_root: unknown, args: any, context: Context) => portalServiceQueries.billingCatalog(_root, args, context),
  myPaymentCards: (_root: unknown, args: any, context: Context) => portalServiceQueries.myPaymentCards(_root, args, context),
  walletSummary: (_root: unknown, args: any, context: Context) => portalServiceQueries.walletSummary(_root, args, context),
  billingAvailability: (_root: unknown, args: any, context: Context) => portalServiceQueries.billingAvailability(_root, args, context),
};
export const portalMutations = {
  openHelpTicket: (_root: unknown, args: any, context: Context) => portalServiceMutations.openHelpTicket(_root, args, context),
  replyHelpTicket: (_root: unknown, args: any, context: Context) => portalServiceMutations.replyHelpTicket(_root, args, context),
  updateMyName: (_root: unknown, args: any, context: Context) => portalServiceMutations.updateMyName(_root, args, context),
  createCheckout: (_root: unknown, args: any, context: Context) => portalServiceMutations.createCheckout(_root, args, context),
  createBillingPortal: (_root: unknown, args: any, context: Context) => portalServiceMutations.createBillingPortal(_root, args, context),
};
