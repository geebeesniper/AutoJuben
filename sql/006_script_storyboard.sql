-- AutoJuben / GS-One requirements migration 006
-- Append-only schema evolution, NOT an overlay, hook, or code patch.
-- Apply once AFTER 001..005, only following owner-reviewed migration and backup.
-- All rows are tenant-scoped; application services must authorize memberships.
-- Do not grant direct anon/authenticated Data API access to these tables.

CREATE UNIQUE INDEX IF NOT EXISTS projects_org_id_id_unique
  ON public.projects(org_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS asset_uploads_org_id_id_unique
  ON public.asset_uploads(org_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS video_jobs_org_id_id_unique
  ON public.video_jobs(org_id, id);

-- Script source and structure, separate from short project descriptions.
CREATE TABLE IF NOT EXISTS public.project_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK(char_length(title) BETWEEN 1 AND 200),
  source_filename TEXT,
  source_storage_path TEXT,
  original_language TEXT NOT NULL DEFAULT 'zh' CHECK(original_language IN ('zh','en','es','other')),
  source_text TEXT NOT NULL DEFAULT '' CHECK(char_length(source_text) <= 2000000),
  outline TEXT NOT NULL DEFAULT '',
  detected_structure JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(detected_structure)='object'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','ready','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_scripts_project_tenant_fk
    FOREIGN KEY(org_id,project_id) REFERENCES public.projects(org_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS project_scripts_org_project_idx ON public.project_scripts(org_id,project_id,created_at DESC);

-- One script project has ordered episodes, each containing ordered storyboard shots.
CREATE TABLE IF NOT EXISTS public.project_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  script_id UUID REFERENCES public.project_scripts(id) ON DELETE SET NULL,
  episode_number INTEGER NOT NULL CHECK(episode_number BETWEEN 1 AND 100000),
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  estimated_seconds INTEGER CHECK(estimated_seconds BETWEEN 1 AND 86400),
  split_strategy TEXT NOT NULL DEFAULT 'manual'
    CHECK(split_strategy IN ('manual','automatic','assisted')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','ready','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_episodes_project_tenant_fk
    FOREIGN KEY(org_id,project_id) REFERENCES public.projects(org_id,id) ON DELETE CASCADE,
  CONSTRAINT project_episodes_number_unique UNIQUE(org_id,project_id,episode_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS project_episodes_org_id_id_unique ON public.project_episodes(org_id,id);
CREATE INDEX IF NOT EXISTS project_episodes_org_project_idx ON public.project_episodes(org_id,project_id,episode_number);

-- Explicit scene/storyboard storage. Never hide scene data inside a single video prompt.
CREATE TABLE IF NOT EXISTS public.storyboard_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL,
  sequence_number INTEGER NOT NULL CHECK(sequence_number BETWEEN 1 AND 100000),
  scene_description TEXT NOT NULL DEFAULT '',
  dialogue TEXT NOT NULL DEFAULT '',
  action_description TEXT NOT NULL DEFAULT '',
  emotion TEXT NOT NULL DEFAULT '',
  camera_notes TEXT NOT NULL DEFAULT '',
  script_excerpt TEXT NOT NULL DEFAULT '',
  associated_roles JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(associated_roles)='array'),
  dismissed_reference_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(dismissed_reference_ids)='array'),
  active_prompt_version INTEGER NOT NULL DEFAULT 1 CHECK(active_prompt_version>0),
  duration_seconds INTEGER CHECK(duration_seconds BETWEEN 1 AND 300),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','ready','generating','complete','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT storyboard_shots_episode_tenant_fk
    FOREIGN KEY(org_id,episode_id) REFERENCES public.project_episodes(org_id,id) ON DELETE CASCADE,
  CONSTRAINT storyboard_shots_sequence_unique UNIQUE(org_id,episode_id,sequence_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS storyboard_shots_org_id_id_unique ON public.storyboard_shots(org_id,id);
CREATE INDEX IF NOT EXISTS storyboard_shots_episode_idx ON public.storyboard_shots(org_id,episode_id,sequence_number);

-- Version history from GS-One: append/activate/revert prompt revisions, no silent overwrites.
CREATE TABLE IF NOT EXISTS public.shot_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL,
  version_number INTEGER NOT NULL CHECK(version_number>0),
  prompt_text TEXT NOT NULL,
  negative_prompt TEXT NOT NULL DEFAULT '',
  model_id TEXT,
  generation_settings JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(generation_settings)='object'),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shot_prompt_versions_shot_tenant_fk
    FOREIGN KEY(org_id,shot_id) REFERENCES public.storyboard_shots(org_id,id) ON DELETE CASCADE,
  CONSTRAINT shot_prompt_versions_number_unique UNIQUE(org_id,shot_id,version_number)
);
CREATE INDEX IF NOT EXISTS shot_prompt_versions_shot_idx ON public.shot_prompt_versions(org_id,shot_id,version_number DESC);

-- Reference assets and role/scene provenance, backed by PRIVATE asset_uploads storage.
CREATE TABLE IF NOT EXISTS public.storyboard_references (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  reference_order INTEGER NOT NULL CHECK(reference_order BETWEEN 0 AND 100000),
  reference_role TEXT NOT NULL DEFAULT 'style'
    CHECK(reference_role IN ('style','character','scene','motion','audio','video','other')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(org_id,shot_id,asset_id),
  CONSTRAINT storyboard_references_shot_tenant_fk
    FOREIGN KEY(org_id,shot_id) REFERENCES public.storyboard_shots(org_id,id) ON DELETE CASCADE,
  CONSTRAINT storyboard_references_asset_tenant_fk
    FOREIGN KEY(org_id,asset_id) REFERENCES public.asset_uploads(org_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS storyboard_references_asset_idx ON public.storyboard_references(org_id,asset_id);

-- Director/editor/splitting jobs are separate from external video_jobs.
-- No worker should run until the corresponding service, guards and idempotency tests are present.
CREATE TABLE IF NOT EXISTS public.storyboard_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  episode_id UUID,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  client_request_id TEXT NOT NULL CHECK(char_length(client_request_id) BETWEEN 1 AND 160),
  kind TEXT NOT NULL CHECK(kind IN ('split','subsplit','director','editor','video','render','export')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued','running','submission_unknown','success','failed','canceled')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(settings)='object'),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  result JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(result)='object'),
  error_code TEXT,
  error_message TEXT,
  cancel_requested_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT storyboard_pipeline_project_tenant_fk
    FOREIGN KEY(org_id,project_id) REFERENCES public.projects(org_id,id) ON DELETE CASCADE,
  CONSTRAINT storyboard_pipeline_episode_tenant_fk
    FOREIGN KEY(org_id,episode_id) REFERENCES public.project_episodes(org_id,id) ON DELETE SET NULL,
  CONSTRAINT storyboard_pipeline_client_request_unique UNIQUE(org_id,client_request_id)
);
CREATE INDEX IF NOT EXISTS storyboard_pipeline_queue_idx
  ON public.storyboard_pipeline_runs(org_id,status,created_at);

CREATE TABLE IF NOT EXISTS public.storyboard_video_job_links (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL,
  video_job_id UUID NOT NULL,
  prompt_version_number INTEGER NOT NULL CHECK(prompt_version_number>0),
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(org_id,shot_id,video_job_id),
  CONSTRAINT storyboard_video_link_shot_tenant_fk
    FOREIGN KEY(org_id,shot_id) REFERENCES public.storyboard_shots(org_id,id) ON DELETE CASCADE,
  CONSTRAINT storyboard_video_link_job_tenant_fk
    FOREIGN KEY(org_id,video_job_id) REFERENCES public.video_jobs(org_id,id) ON DELETE CASCADE,
  CONSTRAINT storyboard_video_link_prompt_tenant_fk
    FOREIGN KEY(org_id,shot_id,prompt_version_number)
    REFERENCES public.shot_prompt_versions(org_id,shot_id,version_number) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS storyboard_video_job_idx ON public.storyboard_video_job_links(org_id,video_job_id);

ALTER TABLE public.project_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyboard_shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shot_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyboard_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyboard_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyboard_video_job_links ENABLE ROW LEVEL SECURITY;
-- There are intentionally NO public/anon/authenticated policies.
-- Server-side services must enforce membership and roles before using privileged SQL.
