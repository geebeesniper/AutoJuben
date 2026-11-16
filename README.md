# AutoJuben SaaS

TypeScript / MVC / GraphQL + REST + JSON, targeting Vercel and Supabase.

## Status

**Source import pending.** GitHub and Vercel project have been initialized, but the complete application source is not yet committed, and no production deployment has been validated.

- GitHub: https://github.com/geebeesniper/AutoJuben
- Vercel: https://vercel.com/groundcmd/autojuben (Vite, Node 22)
- Supabase: the presently authorized organization does not list a project. Do **not** run migrations until the correct project is identified.

## Upload the complete v0.6.0 archive (one manual upload)

1. Download `autojuben-cmm-mvc-3api-v0.6.0.zip` from the ChatGPT conversation. Do **not** unzip it for this automated import.
2. On GitHub, use **Add file → Upload files** and upload the ZIP at **`imports/autojuben-cmm-mvc-3api-v0.6.0.zip`**. If the web uploader cannot specify a subfolder, create the `imports` folder via a placeholder file first, then open that folder and upload the ZIP.
3. Commit to `main`. The workflow [Import verified AutoJuben v0.6.0 archive](.github/workflows/import-v0.6.0.yml) verifies its fixed SHA-256 checksum, safely extracts the app source into the repository root, installs dependencies, runs CMM protected file checks, architecture/API checks, TypeScript typecheck, unit tests and build, **then** commits the verified source automatically.
4. Inspect the Actions tab. If checks fail, code is NOT committed to `main`. Review the logs and fix the blocking issue.

Expected archive SHA-256: `f1b7df7a50f15c203c5f83f438b5b622ccde9bc8a837f2d3efffe88cd7977359`.

Alternative: unzip the archive locally, copy **contents of `autojuben-saas/`** into your GitHub Desktop local repository root, and commit/push. Never commit `.env` or private keys.

## Deployment

Vercel cannot link this repository automatically until you connect the **GitHub login provider to your Vercel account**, which is distinct from ChatGPT's GitHub plugin authorization. In Vercel dashboard → Account Settings → Authentication / Login Connections, connect the `geebeesniper` GitHub account; then connect this repo to the existing Vercel project.

All production credentials belong in Vercel encrypted project environment variables; do not place secrets in the repository. `MOCK_VIDEO_PROVIDER=true` is set as a safe default.

The complete source archive contains `sql/001_initial.sql` through `sql/005_api_quality.sql`. Only apply to a confirmed, backed-up Supabase project. GitHub Actions does not automatically alter the production database.

**Not a production-ready release until full CI, Supabase migrations, user login, video jobs, and Stripe test-mode end-to-end tests are verified.**
