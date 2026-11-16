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

## Provider API mapping in Settings (151 nine-reference-video service)

The existing **`151_9tu_api_integration.md` v1.0** is the upstream contract source. The five endpoints below are **provider paths**, not public AutoJuben REST/GraphQL routes. In authenticated **Settings → Video provider API endpoints**, workspace Owner/Admin can redefine the provider paths and choose the documented authentication header. Configuration lives in PostgreSQL (`sql/007_provider_api_routes.sql`), scoped by `org_id`. Its read/write is a privileged **GraphQL session-only management operation**, like existing provider key settings; never accessible through workspace API Keys.

| Upstream operation | HTTP method | 151 default provider path |
| --- | --- | --- |
| Pricing | GET | `/api/pricing` |
| Models / public settings | GET | `/api/public-settings` |
| Submit video | POST | `/api/generate-video` |
| Job state | GET | `/api/task/{task_id}` |
| Video link fallback | GET | `/api/task/{task_id}/video-link` |

`providerInfo(orgId)` returns an `endpoints` object and readable API state. `saveProviderApiRoutes(orgId,input)` validates and saves all five paths plus `authMode`: `license_key` (`X-License-Key`) or `bearer` (`Authorization: Bearer`). All five settings affect the **existing server-side provider client**, including pricing, submission, status polling and video-link recovery. Paths must be rooted in `/api/`; task-specific paths must contain a single `{task_id}` segment. Full URLs, query strings, traversal, protocols, and custom hosts are forbidden in workspace settings. Changing endpoint configuration while the workspace has pending/in-progress video jobs is refused to prevent mismatched submissions/polling. All changes are audited without key values.

The **upstream base origin** is still configured by Vercel `VIDEO_API_BASE_URL`; arbitrary customer-defined domains are not accepted (preventing SSRF and credential exfiltration). Provider redirects are rejected to avoid sending `X-License-Key` or Bearer credentials to another host. Real upstream calls require HTTPS unless the server owner explicitly enables the unsafe HTTP development override. The 151 document's example base URL is `http://113.207.49.151:8045`, which **must not** be contacted with a license key in ordinary production without an HTTPS endpoint.

The AutoJuben public APIs remain fixed for backward compatibility: `POST /graphql`, `/api/v1/...` REST and `POST /api/json`. Changing these paths is **not** a workspace endpoint setting; a breaking platform API route change requires an explicit version, protected contract review, tests and documentation. GraphQL management mutations are session-only and excluded from API-key REST/JSON exposure.

### Provider integration verification checklist

- Apply `sql/007_provider_api_routes.sql` after `001–005` on a new Supabase project (the separate storyboard `006` is staged independently). Never re-run migrations blindly on existing production databases.
- Authenticate an Owner/Admin and verify saving/reloading route definitions across page refreshes; a Viewer may read but cannot edit. Confirm a different tenant cannot update these values.
- Compare `GET /api/pricing` and `GET /api/public-settings` results against the chosen provider paths without hardcoding model prices.
- Test reference submissions for images (up to nine), audio (up to three), and video (up to three), with total source references capped at 12, `client_task_id` idempotency and no duplicated charges.
- Verify polling and fallback video-link route behavior; no blind retries on failed/unknown submissions; settle/refund credit reservations correctly.
- Check HTTPS validation, rejection of host/query/path traversal attempts, error messages and audit logs. No real provider requests while `MOCK_VIDEO_PROVIDER=true`.

## Help Center and Help Desk: two separate messaging channels

**Knowledge base** is read-only for customers and published from PostgreSQL `help_articles` (six categories: `getting_started`, `generation`, `billing`, `account`, `api`, `troubleshooting`). The server selects a fixed `zh/en/es` translation column and searches only `published=true`. `helpArticles(category,search,locale,limit)` is the categorized FAQ query; no raw SQL or unpublished drafts are exposed.

**Customer Help Desk** uses `platform_message_threads.channel='customer'`, with exactly one `customer_id` and a required issue category `general|generation|technical|billing|account`. These authenticated GraphQL operations live in the **existing Portal controller/service/repository**:

- `myHelpThreads(category,status,limit)`: list **only** the current session user's support tickets.
- `myHelpMessages(threadId,limit)`: require ownership AND `channel='customer'`; return only messages with `internal=false`, never team notes.
- `openHelpTicket(category,subject,content)`: validate category and lengths; atomically create customer ticket + first message. Database is the persistent source of truth, not a file or localStorage.
- `replyHelpTicket(threadId,content)`: require the logged-in customer to own the open ticket; reject closed threads and foreign IDs.

**Admin Team Messenger** uses `channel='internal'`, cannot have `customer_id`, and has only internal administrator messages. Admin Inbox has distinct `channel='internal'|'customer'` selections. The platform-admin `adminInbox(channel,...)`, `adminMessages`, `adminCreateThread(channel,...)`, `adminSendMessage`, and `adminUpdateThread` stay protected by `messaging` capabilities; internal/customer category and ownership constraints are enforced by the Service and SQL 008. Admin responses on a customer ticket are stored as `internal=false`; customer-support traffic is never routed into the internal team channel.

**Security and release checks:** verify customer A cannot query, reply to or enumerate customer B's ticket; customer cannot access a staff-only conversation; a staff-only internal message is never returned even if manually inserted into a customer thread; anonymous users cannot submit tickets; disabled accounts cannot use old sessions; non-messaging staff cannot access admin threads. Run cases with two real users and separate admin roles on staging after running the unapplied `sql/008_enterprise_admin.sql`. The three public AutoJuben API transports remain backward-compatible; these new support operations are **session-authenticated GraphQL** and must not be added to the workspace API-key REST/JSON allowlist without independent contract review.

## Operations Overview — time-series metrics, presence and role-bound access

The enterprise backend's **first menu** is `adminOverview` (Operations Overview). Its read-only `adminOverview(from: String!,to: String!,timezone: String!,unit: String!)` GraphQL query returns `canRevenue`, `hasPresence`, and sparse `buckets { key revenueCents alerts errors online peak }`. The server authorizes the logged-in platform administrator with the existing `investigation` capability, validates IANA timezone, bounded date/time interval (<=366 calendar days), and hourly versus daily granularity. It also restricts revenue data to roles with `ledger` capability. This is **not** an API Key REST/JSON operation.

The WOS-style frontend date selection uses Today, Yesterday, Previous 3 complete days and Previous 7 complete days, plus From/To and explicit Apply. Previous periods exclude Today. The upper bound is exclusive (next local midnight) to capture full days even across DST. For up to three days, group by UTC hour and label in the operator's timezone; longer ranges use local calendar-day buckets. Invalid, future and >366-day date selections are rejected.

The five independent graphs are database-backed:
- **Revenue**: `purchase_orders` net amount, only paid/refunded transactions, grouped on original `paid_at`. This convention does **not** date refunds by actual refund timestamps.
- **Alerts**: video jobs currently failed (using completed/updated timestamp) plus newly created customer support tickets with high or urgent priority.
- **Errors**: one per API request with HTTP 5xx **or** GraphQL error count >0, counted once.
- **Online users**: latest 5-minute count of distinct authenticated, foreground-active users in each displayed interval.
- **User peak**: highest such 5-minute count in each interval.

`recordMyPresence` is an authenticated customer-portal GraphQL mutation. The existing frontend invokes it only while visible, approximately every 60 seconds. It writes one deduplicated `(user_id,sample_at)` row per five-minute UTC bucket to `platform_presence_samples` (SQL 008, server-side only, RLS on). Sampling cannot reconstruct past sessions that occurred before this table was enabled. `hasPresence=false` denotes not-yet-collected samples; unlike preview data, the real UI never manufactures activity or revenue figures.

The existing `apps/api/src/services/admin.service.ts` and `repositories/admin.repository.ts` own business rules and indexed aggregation respectively. Review privileges, time boundaries and high-cardinality query plans with realistic data before enabling a production rollout. This feature remains **staged** until Supabase and SQL 008 are provisioned and verified.

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
