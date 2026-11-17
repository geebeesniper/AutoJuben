# Quality measurement goals (targets, not certified outcomes)

| Metric | Target | Collection method | Escalation |
|---|---|---|---|
| REST / JSON / GraphQL 4xx/5xx or GraphQL resolver error rate | < 1% for stable authenticated business traffic | api_request_metrics (1h, 24h, 7d) | Review by engineering; distinguish validation errors from platform faults |
| API request P95 (excluding video generation) | < 1000 ms | API metrics P95 | Investigate N+1, Supabase pool, external dependencies |
| Duplicate Stripe credit grant | 0 | Unique event IDs and ledger source IDs; payment reconciliation | Block new paid deployments |
| Cross-tenant read/write access | 0 | BOLA tests with 2 tenants, manually on Supabase staging | Release blocker |
| CI quality gate failure in production release | 0 | GitHub required checks | Deployment blocked |
| Backup restore test before migration | 100% for destructive/migration-high-risk changes | Staging restore checklist | Release blocker |
| Repeated provider submission under unknown state | 0 | Idempotent client_task_id + submission_unknown workflow | Incident RCA |

These metrics implement a path toward **Quantitatively Managed (Level 4)**. They do not prove an organization's CMMI appraisal level. Track baselines over several release cycles before claiming stable performance. For **Optimizing (Level 5)**, trend failures, run RCA, revise preventive controls, and compare before/after data with dated evidence.
