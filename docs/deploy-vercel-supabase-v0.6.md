# Deploy v0.6.0 on Vercel + Supabase

## 0. Prerequisites

GitHub private repository, Vercel account, Supabase project, Node.js 22+, Stripe **test** account (later). No VPS, local Docker daemon or persistent Vercel worker is required.

## 1. Verify source locally (before upload)

```bash
npm install
npm run check:protected
npm run quality
npm run typecheck
npm test
npm run build:web
```

Commit generated `package-lock.json`, change CI from `npm install` to `npm ci` and repeat checks. Do not deploy paid production use with failed gates. The ZIP was produced without external npm registry access; run these in your own network environment.

## 2. Supabase setup

- New project in https://supabase.com/dashboard, enable Email sign-in.
- SQL Editor: for a **new** DB execute `sql/001_initial.sql`, `002_launcher_port.sql`, `003_supabase_vercel.sql`, `004_customer_portal_payments.sql`, `005_api_quality.sql`, and then `007_provider_api_routes.sql` (workspace-editable upstream video API paths). The independent storyboard `006_script_storyboard.sql` remains staged for review. For an existing DB, back up first and apply **only the migrations that have not already been applied**; never rerun earlier migrations blindly.
- Storage: create private bucket `autojuben-media`.
- Connect → Transaction pooler: copy the real connection string (`:6543`) into `DATABASE_URL`; use URL-encoded password. Node `pg` uses no named prepared statements. Keep DB password server-side.
- Auth → URL Configuration: set Site URL to the actual Vercel domain and allow `https://YOUR_DOMAIN/?auth=reset` callback.

## 3. GitHub + Vercel

- Push full root source to a private GitHub repository (exclude `.env`).
- Vercel → New Project → Import GitHub repo. Root directory `./`, Framework **Vite**. Build command `npm run build:web`, output `apps/web/dist`, Node 22.x. `vercel.json` retains `/graphql`, `/api/json`, `/api/v1/*`, auth, storage and Webhook routes.
- Enter environment variables from `.env.example`: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `PUBLIC_ORIGIN`, `PLATFORM_ADMIN_EMAILS`, `ENCRYPTION_KEY`, `CRON_SECRET`, `MOCK_VIDEO_PROVIDER=true` initially.
- Never add `VITE_` to secret variables. Generate unique secrets; do not commit or paste them into support tickets.

## 4. Smoke test

1. `GET https://YOUR_DOMAIN/healthz` returns JSON `ok: true`, `version: 0.6.0`.
2. `/app` register/login/reset password; `/admin` available only to configured admin email after verification.
3. User History and Purchase History load with no error. User A cannot see User B's tenant projects or jobs (staging two-account test).
4. Settings → API Access: create read-only API Key; test REST and JSON examples; assert that unknown field and cross-tenant ID return 400/403; revoke and confirm 401.
5. GraphQL `POST /graphql` works; fragments or excessive nesting rejected.
6. Admin → API: metrics display GraphQL/REST/JSON traffic after a few requests.
7. Test upload to Supabase Storage; create mock video task; confirm history and idempotent `clientTaskId`.
8. Test Stripe checkout and signed webhook **in test mode only**. Verify exactly one wallet grant per paid event and refund. Do not enable live payments until verified.

## 5. Video cron + Stripe

- Use `setup/supabase_cron.sql` with Vercel endpoint and CRON_SECRET (store secrets safely, e.g., Supabase Vault). Cron processes jobs in small bounded batches, not permanent in-memory background loops.
- Stripe webhook URL: `https://YOUR_DOMAIN/api/stripe`. Configure signing secret and exact event types from `docs/payment-security.md`. Stripe Customer Portal handles card editing; system does not store PAN/CVV.
- 151 video provider base URL currently HTTP: keep `MOCK_VIDEO_PROVIDER=true` and `ALLOW_INSECURE_VIDEO_HTTP=false` until vendor supports HTTPS and API credentials can be sent securely.

## 6. Operation + rollback

Use Vercel Preview for each PR, then promote only after CI and staging tests. For database migrations: snapshot first, review forward-only SQL, verify health, monitor 1h response error and payment ledger. Rollback frontend/API via Vercel previous deployment; do **not** roll back additive SQL destructively without a tested migration reversal. Key leaks: revoke API key / rotate secrets immediately.
