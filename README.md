# AutoJuben SaaS v0.6.0 — MVC + GraphQL / REST / JSON

**Target deployment:** Vercel (React + TypeScript and serverless functions) + Supabase (PostgreSQL / Auth / Private Storage / Cron). This release extends the existing v0.5 MVC codebase, preserving the old GraphQL and client pages while adding a consistent three-surface API and CMM/CMMI-aligned engineering controls.

## Read this first

- **中文部署指南:** [`docs/中文版-部署指南.md`](docs/中文版-部署指南.md)
- **Deployment guide:** [`docs/deploy-vercel-supabase-v0.6.md`](docs/deploy-vercel-supabase-v0.6.md)
- **API protocols & examples:** [`docs/api-protocols.md`](docs/api-protocols.md)
- **REST OpenAPI spec:** [`docs/openapi.json`](docs/openapi.json)
- **CMM/CMMI engineering manual:** [`docs/cmm-quality-manual.md`](docs/cmm-quality-manual.md)
- **Release process / protected files:** [`quality/CHANGE_CONTROL.md`](quality/CHANGE_CONTROL.md)
- **Validation results:** [`quality/VALIDATION_RESULTS.md`](quality/VALIDATION_RESULTS.md)
- **Quality targets:** [`quality/QUALITY_TARGETS.md`](quality/QUALITY_TARGETS.md)
- **Original EXE reconstruction limits:** [`docs/exe-reconstruction-and-parity.md`](docs/exe-reconstruction-and-parity.md)

## Enterprise Administration — multi-admin RBAC, finance, investigations and messaging

**Source requirements:** existing `docs/cmm-quality-manual.md`, `docs/api-protocols.md`, `sql/004_customer_portal_payments.sql`, `sql/005_api_quality.sql`, and operator-requested admin capabilities. The existing `Admin.tsx`, `admin.service.ts`, `admin.repository.ts`, controller and GraphQL schema are the **single implementation owners**; no second production admin backend or appended override patch.

- **Admin roles and least privilege:** the immutable root identity comes from Vercel `PLATFORM_ADMIN_EMAILS` (`super_admin`). Postgres `platform_admin_staff` stores `operations_manager`, `finance_manager`, `support_lead`, `analyst`, `auditor` with independent active flags. Staff cannot grant `super_admin` to themselves. Operations managers can assign lower scoped roles only, never finance/operations/root. Each protected resolver checks the role **server-side**. The UI only mirrors these capabilities; hiding navigation is never the access control.
- **User 360 investigations:** search by email/name/ID and inspect server-derived, time-scoped activity across video jobs, order transactions, workspace audit, and related API events. Search only returns bounded paged results; never include full prompts, card data, private tokens, raw request bodies or password hashes.
- **Finance:** preserve original `purchase_orders` / Stripe source of truth and `credit_ledger` accounting with idempotent `source_type,source_id`. New administrator ledger is read-only, filters workspace, source, source ID and date, and paginates by monotonically increasing ledger ID. The CSV action exports only the retrieved page with spreadsheet-formula escaping. It does not alter balances or issue refunds.
- **Large-volume diagnostics:** `adminInvestigations` provides category, workspace, actor, date-window and string filters, and deterministic bounded cursor pagination over video, orders, API request metrics, workspace audit and platform admin audit. Exports are per retrieved page. Use indexed timestamps and IDs and constrain investigations to a 366-day maximum per request.
- **Two isolated message channels:** `platform_message_threads.channel` is either `internal` (administrator-only, no customer linked, messages marked internal) or `customer` (a support ticket belonging to one authenticated customer; customer-visible messages are never internal). Admin Inbox separates **Team Messenger** and **Customer Support Desk** with their own lists, priorities, assignments and filters. Service and SQL enforce channel/category rules; customer reads are scoped to `ctx.user.id`, not user-supplied IDs. `adminSendMessage` replies visibly on customer tickets; never expose an internal administrator message in the customer portal.
- **Customer Help Center / Help Desk:** the original `Portal.tsx` handles `helpCenter` (published multilingual `help_articles` knowledge base, category and text search) and `helpDesk` (five support categories: general, generation, technical, billing and account; customer-owned ticket creation, history, conversation and replies). `apps/web/src/pages/VideoCreationPreview.tsx` offers clearly marked in-browser previews of both. This is database-backed in code but **cannot work with real messages until Supabase and SQL 008 are applied**; the preview never sends real support tickets.
- **CMM audit:** `platform_admin_audit` records staff authorization changes, thread creation, message sends and resolution changes, without recording message content or credentials.
- **Preview:** `/preview/backend` presents an interactive **fictional sample dataset** including role switching, filters, record drill-down, ledger export and inbox actions; preview changes are browser-local, not saved to production and are explicitly labelled. The authenticated `/admin` route is separate and uses real role-checked GraphQL services when the database is available.

**Role matrix:**

| Role | Staff | Users | Ledger | Orders/billing | Investigations | Internal messages | Platform secrets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Super Admin (env-only) | Full | Full | Read | Full | Read | Full | Full |
| Operations Manager | Scoped delegation | Manage | Read | No | Read | Full | No |
| Finance Manager | No | No | Read | Manage | Read | Full | No |
| Support Lead | No | Manage | No | No | Read | Full | No |
| Analyst | No | No | No | No | Read | No | No |
| Auditor | No | No | Read | No | Read | No | No |

**Implementation/deployment state:** on `candidate/v0.6.0`; versioned schema `sql/008_enterprise_admin.sql` is committed but **not applied** because Supabase project is not provisioned. No real staff accounts, messages, financial queries or login credentials are active. Do not interpret successful TypeScript, CI or Vercel preview as successful backend integration. Apply 008 after verified earlier migrations, test two non-admin tenants, all role-denied paths, message access, ledger reconciliation and indexed cursor integrity before permitting production use. The existing Core/Kernel/protected files are not intentionally altered.

## GS-One / seedancecreat feature parity (source-backed migration)

**Legacy source:** [geebeesniper/seedancecreat](https://github.com/geebeesniper/seedancecreat) (GS-One SaaS; last observed source uses TypeScript business services, original Vue frontend and Wails method bridge). This migration is **feature parity, not a wholesale code/DOM copy**. The existing AutoJuben MVC ownership, protected core and three API transports remain authoritative.

These features were identified by inspecting the legacy repository's `src/services/dispatcher.ts`, `src/services/appService.ts`, `src/services/paymentService.ts`, `src/db/types.ts`, `public/wails-bridge.js`, and `README.md`. A legacy Wails method name alone is **not proof that its backend handler was implemented**. Original source scripts and templates must be preserved until their behavior is verified and matched.

| Domain / original behavior | Existing AutoJuben owner | Migration state and acceptance criterion |
| --- | --- | --- |
| Tenant login, logout, profile, authorization | Auth / memberships / sessions | Existing implementation; requires Supabase DB and end-to-end customer/admin login tests; no hard-coded credentials. |
| Create/rename/delete script project and list project episodes | Projects UI → core service → repository | Project CRUD already exists; **episode CRUD missing**. Persist episodes per project and tenant. |
| Script selection / upload and structure detection (`SelectScriptFile`, `DetectScriptStructure`) | Projects + script service/repository (future) | **Schema staged in 006**; create server-side import/validation for txt/docx and explicit detection results. Do not store full scripts inside a short project description. |
| Episode content, sequence and configuration (`GetProjectEpisodes`, `AddManualEpisode`, `UpdateEpisodeContent`, `SaveEpisodeConfig`) | Episode CRUD in existing Projects workflow (future) | **Schema staged in 006**; ordered episode list, edits, duration/splitting options and audit trail must be persisted. |
| Scene/segment storyboard: dialogue, action, emotion, camera notes, shot order, insertion/removal | Storyboard in existing Studio / Project workflow (future) | **Schema staged in 006**; scene/shot records with stable IDs, sortable order, tenant verification and draft status. |
| Automated split/subsplit, director/editor ranges, cancellation and retry (`StartPhysicalSplit`, `StartSubSplitEpisode`, `StartDirectorPipelineV2`, `StartEditorPipelineRange`) | Queue/worker services + repositories (future) | **Schema staged in 006**. Implement idempotent jobs and status reconciliation; no workflow is considered operational without a real handler and tests. |
| Shot prompt versions, active version, references and role continuity (`AppendSegmentPromptVersion`, `SetSegmentActiveVersion`, `ReinjectSegmentRefs`) | Storyboard + prompt-version service (future) | **Schema staged in 006**; append-only revisions and explicit active-version selection; keep original source data. |
| Character / scene / style assets and nine-image references; audio/video uploads | Existing Studio and private asset service | Media uploads exist; shot reference linkage is **staged in 006**. Verify asset permissions and preserve story/character consistency. |
| Provider model mapping, generation tasks, queue progress, failures, project video library | Existing video-jobs service/provider and asset models | Exists in part. Map shot IDs to provider jobs, preserve failure recovery, history and source prompt versions. The provider's pricing/settings/submit/status/video-link paths and auth-header mode are now configurable per workspace via Settings, following `151_9tu_api_integration.md` v1.0, staged in SQL 007. |
| Wallet, recharge, Card/Alipay and Stripe orders | Existing credit/billing/portal services | Existing Stripe credit and order system; **legacy Alipay behavior is not yet implemented/matched**. No live payments or hidden charge simulations. |
| SaaS account/admin, user/roles/credit/history and usage logs | Existing Admin + Portal + metrics | Existing surfaces require DB, real role-based authorization checks, and no exposed secrets. |
| Video/music/film workflow, lip-sync, timeline edit, scene replacement, high-resolution export | Media-production roadmap, not existing API | Product requirements recorded from earlier work, **not verified as implemented in legacy repository**; require supported upstream provider capabilities and independent acceptance tests. |
| Responsive frontend and Chinese/English/Spanish | Existing customer Studio, Admin, shared i18n | Locale switch is present; still requires per-screen translation audit and real authenticated UI checks. |

### Migration and engineering constraints

1. **In-place only:** modify existing Projects / Studio / API owners instead of adding parallel UI routers, duplicate event handlers, appended CSS overrides or Wails bridge wrappers. Use narrowly scoped, versioned **database schema migrations** for additive relational tables; they are not runtime code patches.
2. **Frozen files:** `quality/PROTECTED_BASELINE.json` is authoritative for Core / auth / billing / operation contract and SQL 001–005. Do not change protected files or rebaseline hashes without explicit approval. The new `sql/006_script_storyboard.sql` is staged for review, **not applied**, and does not authorize altering earlier SQL.
3. **One source of truth:** Projects → Episodes → Storyboard Shots → Prompt Versions → Video Jobs, with tenant-scoped foreign keys, private assets, server-side permissions and persistent database settings.
4. **API parity:** any new operation must be implemented through the shared service once and surfaced consistently through GraphQL, REST and typed JSON command API, with contract tests and OpenAPI / schema updates.
5. **Deploy gate:** install/typecheck/tests/build + protected hashes, multi-tenant authorization tests, Supabase migrations, Stripe test-mode ledger verification, production promotion review. A Preview HTTP 200 is never a claim that backend features work.
6. **No fake functionality:** sample-only preview routes can remain available but cannot substitute for authenticated customer/admin accounts or a working video pipeline.

### Legacy migration status

- ✅ Legacy repository inspected and requirements traced to source modules (specification only).
- ✅ Additive tenant-scoped database draft `sql/006_script_storyboard.sql` committed to candidate branch.
- ⏳ Supabase project/database not yet provisioned or migrated; no live login credentials issued.
- ⏳ Episode/shot services, CRUD APIs, pipeline workers, frontend editing controls and tests not yet implemented.
- ⏳ Core contract changes require explicit independent review under frozen-baseline policy.

## Architecture

```text
React / TypeScript (View: /app and /admin)
              |
    HTTP API adapters / schema
     /graphql | /api/v1/* | /api/json
              |
   Controllers (HTTP and GraphQL adapters)
              |
   Services (RBAC / tenant / business logic)
              |
   Repositories (parameterized SQL)
              |
Supabase PostgreSQL + Auth + Storage
              |
  Stripe webhooks / 151 video provider (server-side)
```

**REST** resource URL + HTTP method, **JSON** typed action envelope, **GraphQL** schema query/mutation. The services are shared. JSON is a data format; the third transport is a JSON command interface. REST and GraphQL also use JSON for request/response bodies.

### Structure

```text
api/                         # Vercel Function entrypoints incl. Stripe/Cron
apps/web/                    # React customer portal, admin, API Key management
apps/api/src/
  graphql/                   # Schema-first GraphQL
  controllers/               # HTTP / GraphQL controller adapters
  contracts/                 # REST/JSON operation DTO and allowlist
  services/                  # Business logic and access control
  repositories/              # SQL queries, key hashes, metrics
  models/                    # Context, DTO, response envelope
  auth/ billing/ provider/   # Core security, money, video provider
  worker/ launcher/          # Async cron worker, launcher migration
sql/001..005                 # Ordered Supabase schema migrations
.github/workflows/quality.yml # CI quality gates
quality/                     # Freeze, change control, quantified targets
```

### Full features retained

Client: email signup/login, password recovery, profile, project/video history, saved payment card metadata via Stripe Customer Portal, purchase history, wallet and checkout. Platform admin: search/disable users, orders, Stripe gateway settings, product catalog, tariff configuration, 151 video key/health. Workspace admin: video key, project/member permissions, API Key issue/revoke. Launcher migration: diagnostics, release preferences, backed-up metadata and cloud operator flows subject to original EXE limitations.

### New in 0.6

- `GET/POST/PATCH/DELETE /api/v1/*`: 29 versioned REST operations.
- `POST /api/json` with `{ "operation": "projects", "params": { "orgId": "..." } }`.
- `POST /graphql`: original schema plus new `apiKeys`, `createApiKey`, `revokeApiKey`, and `apiMetrics` operations.
- One transport-independent validator, strict DTO whitelist, tenant-restricted hashed API Keys (60/min, read/write), no admin/payment API Key scope.
- Supabase `005_api_quality.sql`: api_keys and api_request_metrics. Admin observability for error rate, volume and P95.
- Protected baseline hashes, change templates, API contract tests and CI quality checks.

## Pre-deployment verification

```bash
npm install
npm run quality
npm run typecheck
npm test
npm run build:web
```

`npm run quality` checks architecture, source contract mapping, protected hashes and security invariants. It is **not** a replacement for integration tests. Source ZIP generation environment has no complete npm dependency installation, so **production build and end-to-end payment verification are not claimed**. Install dependencies, run CI, then test against a staging Supabase before production.

## Supabase migration (critical)

- New project: `sql/001_initial.sql` → `002_launcher_port.sql` → `003_supabase_vercel.sql` → `004_customer_portal_payments.sql` → **`005_api_quality.sql`**.
- Existing v0.5 project: back up DB, execute **only `005_api_quality.sql`**.
- New tables are server-only, with RLS enabled and no anon/authenticated grants.

## Launch safety

`MOCK_VIDEO_PROVIDER=true` and payment flags off initially. Stripe **test mode** must pass full signed Webhook payment and refund reconciliation before any real payments. Original 151 API uses HTTP; do not send a production license unless upstream HTTPS becomes available.

**CMM/CMMI note:** the repository implements engineering practices aligned with Level 3–5, but formal maturity certification and measured compliance cannot be conferred by shipping source code.
