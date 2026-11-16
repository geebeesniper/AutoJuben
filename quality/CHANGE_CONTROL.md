# Changes and protected baseline (CMM Level 3 process)

Every PR/change request must state: request ID, purpose, affected modules, dependency impact, threat/tenant data impact, database change plan, tests, rollback, and independent reviewer. See `quality/PR_TEMPLATE.md`.

Protected baseline `quality/PROTECTED_BASELINE.json` is generated at release acceptance for high-risk modules (auth, billing, worker, contract, migrations). `npm run check:protected` blocks unnoticed local changes. Updating the baseline JSON is **not a self-approval mechanism**: require a second independent reviewer via GitHub branch-protection rules + CODEOWNERS outside this repository and record the approval in the PR. Do not blindly regenerate hashes to make failures disappear.

Deploy through GitHub PR → CI green → preview smoke tests → migration backup + application → staged production deploy → observability window → rollback. For database releases, use additive forward migrations instead of destructive SQL. Do not deploy with a failed typecheck or payment integration test.

Exceptions: historical SQL inside `billing/stripe.ts` and `worker/runner.ts` remains temporarily due to transaction atomicity. Any redesign must preserve credits, webhook idempotency, retry/unknown state behavior, and tenant scoping; treat these as protected integration boundaries.
