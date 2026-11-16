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
