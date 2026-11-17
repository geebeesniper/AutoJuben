import type { Context } from '../models/context.js';
import { adminServiceQueries, adminServiceMutations } from '../services/admin.service.js';
/** GraphQL adapters: no SQL, side effects, or business rules here. */
export const adminQueries = {
  adminMyRole: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminMyRole(_root, args, context),
  adminOverview: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminOverview(_root, args, context),
  adminStaff: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminStaff(_root, args, context),
  adminLedger: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminLedger(_root, args, context),
  adminInvestigations: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminInvestigations(_root, args, context),
  adminUserTimeline: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminUserTimeline(_root, args, context),
  adminInbox: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminInbox(_root, args, context),
  adminMessages: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminMessages(_root, args, context),
  adminSearchUsers: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminSearchUsers(_root, args, context),
  adminOrders: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminOrders(_root, args, context),
  adminProducts: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminProducts(_root, args, context),
  adminTariffs: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminTariffs(_root, args, context),
  adminBillingSettings: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminBillingSettings(_root, args, context),
  adminApiSettings: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminApiSettings(_root, args, context),
  adminTestStripe: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminTestStripe(_root, args, context),
  adminTestVideoApi: (_root: unknown, args: any, context: Context) => adminServiceQueries.adminTestVideoApi(_root, args, context),
};
export const adminMutations = {
  adminSetStaffRole: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSetStaffRole(_root, args, context),
  adminCreateThread: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminCreateThread(_root, args, context),
  adminSendMessage: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSendMessage(_root, args, context),
  adminUpdateThread: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminUpdateThread(_root, args, context),
  adminSetUserDisabled: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSetUserDisabled(_root, args, context),
  adminSaveProduct: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSaveProduct(_root, args, context),
  adminSaveTariff: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSaveTariff(_root, args, context),
  adminDeleteTariff: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminDeleteTariff(_root, args, context),
  adminSetBillingFlags: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSetBillingFlags(_root, args, context),
  adminSaveStripeIntegration: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSaveStripeIntegration(_root, args, context),
  adminSaveGlobalVideoKey: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSaveGlobalVideoKey(_root, args, context),
  adminSaveGlobalApiRoutes: (_root: unknown, args: any, context: Context) => adminServiceMutations.adminSaveGlobalApiRoutes(_root, args, context),
};
