# Changelog

## v0.6.0 — MVC + API Contracts + Quality Engineering

- Adds RESTful `/api/v1` and JSON command `/api/json` surfaces; existing GraphQL retained.
- Adds tenant-bound, hashed API Keys and revocation/expiry/read-write scopes with one-minute per-key rate limit.
- Adds schema-first input validation shared by REST/JSON and GraphQL depth/field count guard.
- Adds API metric storage and admin screen for volume, error rate, P95/average latency.
- Adds migration 005 (no destructive changes), OpenAPI description, CI, protected baseline, review templates and quantified quality goals.
- Preserves core Stripe transactions, video job idempotency and previously implemented launcher functions; their production integration still requires testing.

## v0.5.0 — MVC baseline

See `docs/mvc-architecture-v0.5.0.md` for the prior refactor and migration limits.
