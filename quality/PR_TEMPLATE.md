# Change request / review record

- **Change ID:** CR-YYYYMMDD-###
- **Business problem / acceptance criteria:**
- **Affected modules and API contract changes:**
- **GraphQL / REST / JSON compatibility assessment:**
- **Threat model: tenancy, auth, secrets, payment integrity:**
- **Database migration/backfill plan:**
- **Unit / integration / regression test evidence:**
- **Before / after measurements:**
- **Deployment, rollback and owner:**
- **Independent reviewer / acceptance:**

## Required checklist

- [ ] Standardized interfaces and type contracts reviewed
- [ ] No direct SQL in Controller/GraphQL entry points
- [ ] Tenant isolation + role enforcement reviewed for reads and writes
- [ ] Stripe Webhook and credit ledger idempotency unaffected
- [ ] Full CI gates and preview smoke tests passed
- [ ] Protected file changes approved and audit trail recorded
