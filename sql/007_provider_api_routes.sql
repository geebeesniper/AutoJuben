-- AutoJuben v0.6.0: provider API route configuration (151_9tu_api_integration.md v1.0)
-- Requires sql/001_initial.sql, sql/003_supabase_vercel.sql. Additive schema migration;
-- do not rerun earlier migrations or alter protected baseline files.
-- Settings are server-side, tenant-scoped and have no public Data API policies.
CREATE TABLE IF NOT EXISTS public.provider_api_routes (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  pricing_path TEXT NOT NULL DEFAULT '/api/pricing' CHECK(char_length(pricing_path) <= 160),
  settings_path TEXT NOT NULL DEFAULT '/api/public-settings' CHECK(char_length(settings_path) <= 160),
  submit_path TEXT NOT NULL DEFAULT '/api/generate-video' CHECK(char_length(submit_path) <= 160),
  task_path TEXT NOT NULL DEFAULT '/api/task/{task_id}' CHECK(char_length(task_path) <= 160),
  video_link_path TEXT NOT NULL DEFAULT '/api/task/{task_id}/video-link' CHECK(char_length(video_link_path) <= 160),
  auth_mode TEXT NOT NULL DEFAULT 'license_key' CHECK(auth_mode IN ('license_key','bearer')),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.provider_api_routes ENABLE ROW LEVEL SECURITY;
-- Server-side Services MUST check org membership and Owner/Admin before writes.
-- Direct anon/authenticated table access is deliberately not granted.
