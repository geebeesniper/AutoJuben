# AutoJuben v0.6.0 — CMM/CMMI-aligned engineering system

This is an **engineering practice implementation** inspired by CMM/CMMI, **not** a claim of a CMMI Level 3, 4 or 5 appraisal. Appraisal requires organization-wide evidence and formal assessment beyond a source ZIP.

## Defined (Level 3 practices)

1. **Architecture baseline**: View (`apps/web`) → GraphQL/REST/JSON API adapters → Controllers (`apps/api/src/controllers`) → Services (authorization and business rules) → Repositories (parameterized SQL) → PostgreSQL / Supabase. Contract models and transport schemas live in `models` / `contracts` / `graphql`; no controller SQL. Stripe and worker transactional paths are documented temporary exceptions with their own integrity tests.
2. **Requirements traceability**: CR template `quality/PR_TEMPLATE.md` links each change to acceptance criteria, affected APIs, migration, test, threat scenario, rollback. Do not change production behavior based only on a UI screenshot.
3. **API-first**: GraphQL schema, REST OpenAPI 3.1, JSON command allowlist. An API change must update contract, tests, and docs; never silently diverge transports.
4. **Security by default**: server-owned Supabase credentials, strict permission checks, tenant-scoped DB queries, hashed API Keys, per-key rate limits, credential encryption, webhook signature checks, audit records, no raw payment cards.
5. **Protected core**: baseline hashes in `quality/PROTECTED_BASELINE.json`. Changes require independent review and explicit manifest update, not accidental mutation. GitHub branch rules must enforce independent approval (cannot be enforced by ZIP alone).
6. **Definition of Done**: typecheck, tests, build, protected hash verification, API contract checks, staging 2-tenant tests, Stripe test webhook and credit reconciliation, rollback plan, preview smoke tests.

## Quantitatively managed (Level 4 practices)

- `api_request_metrics` captures per-transport throughput, response times and errors; Admin API panel shows volume, error rate and P95 by 1h/24h/7d.
- `quality/QUALITY_TARGETS.md` names target thresholds; distinguish business 4xx validation from infrastructure 5xx errors.
- Payment/webhook idempotency, failed video refunds and unknown-submission state require independent, repeatable reconciliation evidence. Metrics only become baselines when real production data exists.
- Measure change failure rates and recovery time from PRs/incident log. No claims of passing targets until observed data supports them.

## Optimizing (Level 5 practices)

- For recurring incidents, keep incident number, impact, root cause (RCA), prevention, changed tests, before/after quality metrics, review owner and expiry for temporary exceptions.
- Review trend reports at each release and remove confirmed bottlenecks. Introduce new controls only after recording measured effectiveness.

## Current limitations and release blockers

- Static checks and contract/unit tests cannot replace Supabase/Stripe production tests. Developer must run full `npm install`, `npm run typecheck`, `npm test`, `npm run build:web` before deploying.
- New migration `sql/005_api_quality.sql` is required; earlier SQL migrations are preserved and should not be rerun blindly on an existing production DB.
- The source zip contains a launcher reconstruction and SaaS modules; the original EXE did not contain the separately downloaded AutoJuben proprietary business backend. Do not claim feature-for-feature parity without that backend.
- Transactions embedded in `billing/stripe.ts` and `worker/runner.ts` are deliberate exceptions until full integration regression is available; changing them casually would risk money or idempotency.
- A lockfile must be generated and committed from a successful install to make CI reproducible; until then, dependency installation is a release risk.
