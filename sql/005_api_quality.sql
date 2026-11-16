-- v0.6.0: additive migration. Apply once AFTER 001..004; do not wipe production data.
-- Server-only tables. Do not expose token hashes through Supabase's public Data API.
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 80),
  token_hash CHAR(64) NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rate_window TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute',now()),
  rate_count INTEGER NOT NULL DEFAULT 0 CHECK(rate_count>=0),
  CHECK (scopes <@ ARRAY['read','write']::TEXT[]),
  CHECK (cardinality(scopes)>=1)
);
CREATE INDEX IF NOT EXISTS api_keys_org_created_idx ON public.api_keys(org_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.api_request_metrics (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id UUID NOT NULL,
  transport TEXT NOT NULL CHECK(transport IN ('graphql','rest','json')),
  operation TEXT NOT NULL,
  http_status INTEGER NOT NULL CHECK(http_status BETWEEN 100 AND 599),
  graphql_errors INTEGER NOT NULL DEFAULT 0 CHECK(graphql_errors>=0),
  elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms>=0),
  auth_mode TEXT NOT NULL CHECK(auth_mode IN ('anonymous','session','api_key')),
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS api_metrics_time_idx ON public.api_request_metrics(occurred_at DESC);
CREATE INDEX IF NOT EXISTS api_metrics_org_idx ON public.api_request_metrics(org_id,occurred_at DESC);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_metrics ENABLE ROW LEVEL SECURITY;
-- These are server-only tables and intentionally have no anon/authenticated policies.
-- Restrict Data API roles even if future RLS policies change.
REVOKE ALL ON TABLE public.api_keys, public.api_request_metrics FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.api_request_metrics_id_seq FROM anon, authenticated;
