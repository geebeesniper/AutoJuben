# AutoJuben v0.5.0 — MVC + API migration map

## Architecture (preserving existing external API)

| Layer | Files | Responsibility |
|---|---|---|
| View | `apps/web/src/pages/{Auth,Portal,Admin,Studio,...}.tsx` | UI, no service credentials, uses `/graphql` and `/auth/*` |
| API contract | `apps/api/src/graphql/{schema,portal,admin,launcher}.ts` | GraphQL Query/Mutation SDL and schema composition; no SQL |
| Controller | `apps/api/src/controllers/*.controller.ts` | Adapt GraphQL/HTTP requests to service calls, route response codes |
| Service | `apps/api/src/services/*.service.ts` | Authorization, validation, orchestration and transactions |
| Repository | `apps/api/src/repositories/*.repository.ts` | SQL for users, orgs, projects, orders, products, authentication, media, diagnostics, launcher settings |
| Model | `apps/api/src/models/{context,view-models}.ts` | Request identity and API DTO projection |
| Integrations | `apps/api/src/billing/stripe.ts`, `apps/api/src/provider/client.ts`, `apps/api/src/serverless/storage.ts` (compat exports) | Stripe provider, video provider, Supabase Storage |

### API backwards compatibility

- 9 core queries + 10 mutations
- 7 customer portal queries + 3 mutations
- 8 platform admin queries + 7 mutations
- 7 launcher queries + 12 mutations
- **Total 63 fields**, names and argument patterns unchanged.

Other existing routes preserved: `/healthz`, `/graphql`, `/auth/:action`, `/api/uploads`, `/api/assets/:id`, `/api/jobs/:id/video`, `/api/launcher/diagnostics`, `/api/launcher/backups/:id/manifest`, `/api/stripe`, `/api/cron`.

### Critical invariants preserved

1. **Tenant boundaries** checked in Services with `requireMembership`, and repository queries scope tenant data by `org_id`. Platform admin authorization checked server-side, not inferred from the visible Admin menu.
2. **Video job idempotency** still uses `client_task_id`; task creation and local-credit reservation remain in one Postgres transaction. An upstream POST of uncertain outcome remains `submission_unknown` until manual reconciliation.
3. **Credit ledger** still makes purchase credit issuance/refunds idempotent; Stripe Webhook signing secret verifies incoming raw body.
4. **Card numbers and CVV** never enter the local API or database; the app displays only Stripe payment-method metadata and redirects to Stripe Customer Portal.
5. **Supabase private asset uploads** still require membership; signed URLs are short-lived.
6. No local filesystem or Docker socket is required for hosted SaaS functions.

### What this refactor does NOT do

- It does not reproduce missing business modules downloaded by the original EXE after installation.
- It does not add Stripe live credentials, Supabase accounts, migrations beyond the existing 001–004 scripts, or a new UI design.
- The older Stripe-ledger transaction engine, provider and worker contain some in-module SQL for high-risk atomic operations. This release does not promise every data call uses a repository; it provides a modular MVC service/repository boundary for the customer/admin/core API while preserving these established transactional subsystems.
- Real Vercel Function builds, Supabase/PostgreSQL transactions, and Stripe webhook callback tests still require an accessible network environment with test credentials.

## Notes

- Vercel Function maximum configured duration is now 60 seconds (instead of 120) to avoid exceeding the common Hobby upper limit. The Supabase `pg_net` Cron timeout is set to 55 seconds; the job batch should be observed under real load.
- PostgreSQL connection pool per warm Vercel instance is now 1 to reduce serverless pool pressure. Use the Supabase Transaction pooler URL (usually port 6543).
- No DB schema changes. Deploy the new code over an existing v0.4 installation without rerunning migrations. **Back up the database first**, test on a staging project, then promote to production.
