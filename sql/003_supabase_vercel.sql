-- Apply AFTER 001_initial.sql and 002_launcher_port.sql in Supabase SQL Editor.
-- Vercel API uses the privileged Postgres connection; Supabase public Data API has NO policies.
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
CREATE TABLE IF NOT EXISTS public.asset_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','audio','video')),
  mime text NOT NULL,
  expected_bytes bigint NOT NULL CHECK (expected_bytes BETWEEN 1 AND 52428800),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_uploads_org_idx ON public.asset_uploads(org_id,created_at DESC);
-- All user-specific data is accessible ONLY via the authenticated TypeScript API.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launcher_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launcher_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launcher_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launcher_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launcher_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_uploads ENABLE ROW LEVEL SECURITY;
-- Do NOT create anon/authenticated table access policies. Serverless functions use
-- the Supabase Postgres connection (postgres role) and enforce memberships in GraphQL.
-- Create a PRIVATE bucket in Supabase Dashboard → Storage → New bucket:
-- name: autojuben-media, public: false, file size <= your global Storage limit.
-- Bucket creation is a manual setup step and NOT a SQL mutation of storage.objects.
CREATE TABLE IF NOT EXISTS public.auth_throttle (
  key_hash char(64) PRIMARY KEY,
  attempts int NOT NULL,
  since timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auth_throttle ENABLE ROW LEVEL SECURITY;
