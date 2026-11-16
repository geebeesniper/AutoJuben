# Billing / Security Review — v0.4.0

## Trust boundaries

- Authentication: Supabase Auth validates email and password; AutoJuben creates only server-side database sessions in HttpOnly SameSite=Lax cookies.
- Authorization: platform admin via verified email allowlist `PLATFORM_ADMIN_EMAILS`, checked in every admin resolver. Customer billing records and Stripe Customer IDs are looked up only by the authenticated user ID.
- PCI minimization: complete card PAN, CVC/CVV, cardholder inputs, payment confirmation details never handled by this service; Stripe-hosted Checkout and Customer Portal handle card updates.
- Stripe secret + webhook signing secret: Vercel server env or AES-256-GCM ciphertext in `platform_settings` with `ENCRYPTION_KEY`, never returned by GraphQL.
- A purchase is never marked paid or issued local credits by a client redirect. Only a verified Stripe event with matching order ID, customer, amount, currency, and session can mint credits.
- Webhook event ID uniqueness + database transactions: duplicates do not mint credits twice.
- Video credit charge is committed with job creation; failed jobs release via same unique ledger source. Unknown upstream submission requires manual reconciliation.
- Stripe refunds: `charge.refunded` events record cumulative refund and claw back pro-rata credits; a negative wallet is allowed and blocks new paid usage.
- Browser admin page visibility does not imply privilege: all admin mutations check platform role server-side.

## Operational checks before live payments

1. Test real app sign-up/email verification and password recovery links (including mail quotas and SMTP).
2. Test Stripe test Checkout, webhook signature rejection, duplicate events, delayed events, expired sessions, refunds, and portal card update feature.
3. Confirm all SQL migrations applied; Supabase anon/authenticated roles cannot access billing tables via public Data API.
4. Validate Vercel function runtime, logging, missing secrets, SSL certificates, privacy policy, terms and tax compliance as applicable.
5. Ensure provider API uses HTTPS before forwarding X-License-Key; the documentation's HTTP address is not secure.
6. Audit platform admin allowlist, account disable + session invalidation, and billing cross-user access.
7. Monitor webhook processing failures and negative wallets; do not treat demo mode as production proof.
