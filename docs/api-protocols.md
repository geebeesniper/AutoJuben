# API contract v1 — GraphQL + RESTful + JSON command

All 3 API surfaces call the **same existing Controller → Service → Repository** operations. They do not each implement separate payment or video logic. TypeScript is the implementation language, JSON is the exchange format, RESTful and GraphQL are the API styles; the additional JSON-command protocol is explicitly defined for customers asking for a JSON-only action endpoint.

## 1. GraphQL

- **URL**: `POST /graphql`
- **Auth**: same-site browser `aj_session` HttpOnly cookie, plus `X-SaaS-Client: web` and matching `Origin` when provided. API Keys **do not** authorize GraphQL operations (not yet scope-audited for all 63 fields).
- **Schema**: `apps/api/src/graphql/schema.ts`, plus domain `graphql/*.ts` modules. Existing 63 legacy operations retained; v0.6 adds `apiKeys`, `createApiKey`, `revokeApiKey`, `apiMetrics`.
- **Bounded**: one operation, <=120 requested fields, <=9 levels, <=20K query chars; fragments and schema introspection disabled on this endpoint to reduce abusive requests.

Example with authenticated browser session (do not expose cookies in published docs):

```http
POST /graphql
Content-Type: application/json
X-SaaS-Client: web
Cookie: aj_session=SESSION_FROM_LOGIN

{"query":"query($org: ID!){projects(orgId:$org){id name}}","variables":{"org":"ORG_ID"}}
```

## 2. RESTful API

- **URL prefix**: `/api/v1/`
- **Auth**: use `Authorization: Bearer ajk_...` for tenant project/job/history operations, or same-site session cookie for customer/admin operations. State-changing cookie requests must include `X-SaaS-Client: web` and same `Origin`.
- **Contract**: `docs/openapi.json` (OpenAPI 3.1). Explicit routes only; unsupported methods are rejected.
- **Response**: `{ "ok": true, "data": ..., "meta": { "requestId": "UUID", "version": "v1" } }`.

```bash
curl -H 'Authorization: Bearer YOUR_WORKSPACE_API_KEY' \
  'https://YOUR_DOMAIN/api/v1/organizations/ORG_ID/projects'
```

Create project (write-scoped key):

```bash
curl -X POST 'https://YOUR_DOMAIN/api/v1/organizations/ORG_ID/projects' \
  -H 'Authorization: Bearer YOUR_WRITE_API_KEY' -H 'Content-Type: application/json' \
  -d '{"name":"Demo project","description":"New content"}'
```

Create video task (idempotency is preserved with clientTaskId):

```bash
curl -X POST 'https://YOUR_DOMAIN/api/v1/organizations/ORG_ID/jobs' \
  -H 'Authorization: Bearer YOUR_WRITE_API_KEY' -H 'Content-Type: application/json' \
  -d '{"input":{"clientTaskId":"order-unique-001","model":"xinghe-2.0","duration":15,"ratio":"9:16","resolution":"720p","prompt":"Studio photography","imageUrls":["https://example.org/ref.png"]}}'
```

## 3. JSON command API

- **URL**: `POST /api/json`
- **Envelope**: `{"operation":"projects","params":{"orgId":"ORG_ID"}}`.
- **Auth**: same as REST. The `operation` field must match the **explicit allowlist** in `contracts/operations.ts`; it does not accept arbitrary code, SQL, or dynamic function names.
- **Purpose**: simple single-endpoint integrations; it is not an alternative to input validation or authorization.

```bash
curl -X POST 'https://YOUR_DOMAIN/api/json' \
  -H 'Authorization: Bearer YOUR_WORKSPACE_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"operation":"jobs","params":{"orgId":"ORG_ID","limit":10}}'
```

## Security contract

- Workspaces are isolated by `orgId` and existing `requireMembership` checks in Services. Do not use global user identifiers to bypass org membership.
- Workspace API Keys are random 256-bit tokens with `ajk_` prefix; only SHA-256 hash and display prefix are stored. `createApiKey` returns plaintext **once**; it cannot be recovered.
- API Keys have read/write scopes, org binding, a maximum 365-day expiry and 60 calls/min/key. They cannot call checkout, payment methods, platform admin settings, user profile or API Key management. If the key creator loses org membership or is disabled, the key no longer authenticates.
- Do not store credit card numbers or CVV. Stripe-hosted Customer Portal manages cards and signed Stripe Webhooks update orders/credits.
- Unknown fields are rejected (mass assignment protection), JSON bodies capped at 128 KiB, all outputs have `Cache-Control: no-store`.
- Provider `X-License-Key` stays on the server, with plain HTTP disabled by default.
- API error shape: `{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "..." }, "meta": { "requestId": "UUID", "version": "v1" } }`.
- Metrics store transport, status, duration, request ID, optional tenant—not prompts, card data or request bodies.

## Versioning and compatibility

`/api/v1` and `/api/json` share the same validated operations and services. GraphQL retains legacy field names. A breaking input/output change requires an explicit new version, migration plan, contract test and reviewed change request. REST/JSON cover a **documented subset** of the GraphQL operations; launcher maintenance and some legacy admin operations remain GraphQL-only.
