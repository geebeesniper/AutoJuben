-- Real SaaS replacements for Wails Service operations extracted from the supplied executable.
-- Tenant scope is enforced in resolvers; platform provisioning is separately restricted.
CREATE TABLE IF NOT EXISTS launcher_config (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'prod' CHECK (environment IN ('prod','dev')),
  channel TEXT NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable','beta','gray')),
  backend_container TEXT,
  frontend_container TEXT,
  current_version TEXT NOT NULL DEFAULT '0.2.0',
  desired_version TEXT,
  deployment_state TEXT NOT NULL DEFAULT 'idle' CHECK (deployment_state IN ('idle','submitting','unknown','failed','deployed')),
  last_deployed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS launcher_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version TEXT NOT NULL CHECK (char_length(version) BETWEEN 1 AND 60),
  channel TEXT NOT NULL CHECK (channel IN ('stable','beta','gray')),
  notes TEXT NOT NULL DEFAULT '',
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id,version,channel)
);
CREATE INDEX IF NOT EXISTS launcher_releases_org_idx ON launcher_releases(org_id,created_at DESC);
CREATE TABLE IF NOT EXISTS launcher_events (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'info',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launcher_events_org_idx ON launcher_events(org_id, created_at DESC);
CREATE TABLE IF NOT EXISTS launcher_backups (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '手动备份',
  checksum CHAR(64) NOT NULL,
  bytes BIGINT NOT NULL,
  asset_count INT NOT NULL DEFAULT 0,
  project_count INT NOT NULL DEFAULT 0,
  job_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launcher_backups_org_idx ON launcher_backups(org_id,created_at DESC);
CREATE TABLE IF NOT EXISTS launcher_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code_hash CHAR(64) NOT NULL UNIQUE,
  label TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
  expires_at TIMESTAMPTZ NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 100),
  revoked_at TIMESTAMPTZ,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launcher_activations_org_idx ON launcher_activations(org_id,created_at DESC);
