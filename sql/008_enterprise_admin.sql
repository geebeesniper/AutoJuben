-- AutoJuben enterprise operations schema 008. Append-only evolution.
-- Requires 001..005. REVIEW + BACKUP BEFORE APPLYING IN A REAL DATABASE.
-- Not deployed; account-wide admin actions must be authenticated on the server.
CREATE TABLE IF NOT EXISTS public.platform_admin_staff (
 user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('operations_manager','finance_manager','support_lead','analyst','auditor')),
 active BOOLEAN NOT NULL DEFAULT true,
 created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
 updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_admin_staff_role_active_idx ON public.platform_admin_staff(role,active);

CREATE TABLE IF NOT EXISTS public.platform_message_threads (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 200),
 category TEXT NOT NULL DEFAULT 'support' CHECK(category IN ('support','billing','technical','compliance','internal')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','pending','resolved','closed')),
 priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
 customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
 assigned_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
 created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.platform_messages (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 thread_id UUID NOT NULL REFERENCES public.platform_message_threads(id) ON DELETE CASCADE,
 sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
 content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 8000),
 internal BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_message_threads_queue_idx ON public.platform_message_threads(status,priority,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS platform_message_threads_customer_idx ON public.platform_message_threads(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS platform_messages_thread_cursor_idx ON public.platform_messages(thread_id,created_at ASC,id ASC);

CREATE TABLE IF NOT EXISTS public.platform_admin_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 action TEXT NOT NULL CHECK(length(action) BETWEEN 3 AND 120),
 target_type TEXT,
 target_id TEXT,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_admin_audit_actor_time_idx ON public.platform_admin_audit(actor_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS platform_admin_audit_target_time_idx ON public.platform_admin_audit(target_type,target_id,created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_created_cursor_idx ON public.purchase_orders(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_org_status_date_idx ON public.purchase_orders(org_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_user_time_idx ON public.video_jobs(created_by,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_source_lookup_idx ON public.credit_ledger(source_type,source_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_date_idx ON public.audit_logs(actor_id,created_at DESC,id DESC);

ALTER TABLE public.platform_admin_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated grants or permissive policies; privileged API ONLY.
-- The super admin is specified in PLATFORM_ADMIN_EMAILS and cannot be created from this table.
