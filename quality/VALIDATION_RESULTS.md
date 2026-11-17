# v0.6.0 verification record

Release baseline date: 2026-11-15 (America/Los_Angeles).

| Check | Observed result | Evidence / limitation |
|---|---|---|
| TypeScript/JavaScript syntax parsing | PASS — 93 source files, 0 syntax diagnostics | TypeScript parser available globally in the build environment |
| Architecture + API static quality | PASS — 318 assertions | `node scripts/quality-gate.mjs` |
| Legacy GraphQL schema/controller/service mapping | PASS — 63 existing operations | `node scripts/check-mvc.mjs` (contract mapping, **not** functionality tests) |
| Protected high-risk modules | PASS — 11 SHA-256 hashes | `node scripts/check-protected.mjs` |
| REST resource contract | PASS — 29 operations on 25 URL patterns | `docs/openapi.json` compared with `contracts/operations.ts` |
| REST/JSON dispatcher with test doubles | PASS — 14 assertions | Actual TypeScript source transpiled into sandbox with fake database/services; includes input validation, route matching and key scope rejection |
| ZIP integrity and manifest | run at packaging time | `CHECKSUMS.sha256` + ZIP CRC |
| Complete npm dependency installation | NOT VERIFIED | npm registry request timed out in environment |
| Full TypeScript typecheck | NOT VERIFIED | Required @types/node and third-party packages unavailable |
| Full unit test suite with dependencies | NOT VERIFIED | Cannot run `tsx --test` until packages install |
| Vite production build | NOT VERIFIED | Cannot run until packages install |
| Supabase DB migrations/live login | NOT VERIFIED | No connected test Supabase instance supplied |
| Stripe test payment/refund, actual 151 video task | NOT VERIFIED | No live test service configured; payments disabled by default |

**Release status:** feature-complete source candidate for staging, **not certified production-ready**. First deployment must be a preview/staging environment followed by every quality gate and 2-tenant/Stripe integration regression.
