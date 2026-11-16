# AutoJuben SaaS

TypeScript + MVC + GraphQL / REST / JSON, targeting Vercel and Supabase.

## Deployment status

The Vercel project `groundcmd/autojuben` has been created, but **the complete application source is not yet committed**. Do not enable payment or production deployment until application code, environment variables, database migrations, and quality checks are verified.

## Importing v0.6.0

The verified v0.6.0 archive is `autojuben-cmm-mvc-3api-v0.6.0.zip`. It contains the `autojuben-saas/` project directory. Extract it locally and copy its contents **to the repository root** (not an extra nested directory), then commit and push to `main` or a review branch. Keep `.env` secrets out of Git. A GitHub workflow will run the project's CMM quality, TypeScript, tests and build checks when source files are added.

## CI/CD

- GitHub Actions checks source changes.
- Vercel project: https://vercel.com/groundcmd/autojuben (link GitHub account and repository in Vercel to enable deployments).
- Supabase database migrations are under `sql/001_initial.sql` to `sql/005_api_quality.sql` in the full source archive. Apply only to the intended, backed-up project after reviewing migration impact.

> The repository is not yet a deployed or production-tested application.
