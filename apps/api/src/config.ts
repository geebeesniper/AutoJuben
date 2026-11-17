import { config as loadDotEnv } from 'dotenv';
loadDotEnv({ path: '.env' });
/** Vercel Functions contain no durable local filesystem, Docker socket, or background worker. */
export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  origin: (process.env.PUBLIC_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, ''),
  supabaseUrl: (process.env.SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'autojuben-media',
  maxUploadBytes: Math.max(1,Math.min(50,Number(process.env.MAX_UPLOAD_MB ?? 45))) * 1024 * 1024,
  activeJobsLimit: Math.max(1,Number(process.env.MAX_ACTIVE_JOBS_PER_ORG ?? 3)),
  providerUrl: (process.env.VIDEO_API_BASE_URL ?? 'http://113.207.49.151:8045').replace(/\/$/, ''),
  allowedProviderOrigins: (process.env.VIDEO_API_ALLOWED_ORIGINS ?? '').split(',').map(v=>v.trim()).filter(Boolean),
  providerKey: process.env.VIDEO_API_LICENSE_KEY ?? '',
  encryptionKey: process.env.ENCRYPTION_KEY ?? '',
  mockProvider: process.env.MOCK_VIDEO_PROVIDER === 'true',
  allowHttpMedia: process.env.ALLOW_HTTP_MEDIA === 'true',
  allowInsecureVideoHttp: process.env.ALLOW_INSECURE_VIDEO_HTTP === 'true',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePortalConfiguration: process.env.STRIPE_PORTAL_CONFIGURATION_ID ?? '',
  platformAdminEmails: (process.env.PLATFORM_ADMIN_EMAILS ?? '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean),
  cronSecret: process.env.CRON_SECRET ?? '',
  vercelEnv: process.env.VERCEL_ENV ?? 'development',
  vercelUrl: process.env.VERCEL_URL ?? '',
  production: process.env.NODE_ENV === 'production',
  // EXE-specific Docker operations are intentionally unavailable on Vercel.
  dockerControlEnabled: false,
  dockerSocket: '',
  managedContainerPrefix: 'aj-',
  deployWebhookUrl: process.env.DEPLOY_WEBHOOK_URL ?? '',
  deployWebhookSecret: process.env.DEPLOY_WEBHOOK_SECRET ?? ''
};
