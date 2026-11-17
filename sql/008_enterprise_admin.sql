-- AutoJuben enterprise operations schema 008. Append-only evolution.
-- Requires 001..005. REVIEW + BACKUP BEFORE APPLYING IN A REAL DATABASE.
-- Not deployed; account-wide admin actions must be authenticated on the server.
-- Global provider API route defaults are editable by super admin and persisted on the existing platform settings owner.
-- Workspace-specific overrides in SQL 007 take precedence. SQL 004 remains protected/frozen.
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS provider_routes JSONB;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS provider_base_url TEXT;
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_provider_routes_is_object
  CHECK(provider_routes IS NULL OR jsonb_typeof(provider_routes)='object');

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
 channel TEXT NOT NULL DEFAULT 'internal' CHECK(channel IN ('internal','customer')),
 category TEXT NOT NULL DEFAULT 'internal' CHECK(category IN ('internal','support','billing','technical','compliance','generation','account','general')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','pending','resolved','closed')),
 priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
 customer_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
 assigned_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
 created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT platform_thread_channel_check CHECK(
  (channel='internal' AND customer_id IS NULL AND category IN ('internal','support','billing','technical','compliance'))
  OR (channel='customer' AND customer_id IS NOT NULL AND category IN ('general','generation','technical','billing','account'))
 )
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
CREATE INDEX IF NOT EXISTS platform_message_threads_queue_idx ON public.platform_message_threads(channel,status,priority,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS platform_message_threads_customer_idx ON public.platform_message_threads(customer_id,channel,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS platform_messages_thread_cursor_idx ON public.platform_messages(thread_id,created_at ASC,id ASC);

-- Help Center is a published, searchable, trilingual knowledge base, not a hard-coded UI list.
CREATE TABLE IF NOT EXISTS public.help_articles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 slug TEXT NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9][a-z0-9-]{2,100}
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
CREATE INDEX IF NOT EXISTS purchase_orders_paid_time_idx ON public.purchase_orders(paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS video_jobs_failure_time_idx ON public.video_jobs(finished_at DESC,updated_at DESC) WHERE status='failed';
CREATE INDEX IF NOT EXISTS platform_message_threads_urgent_idx ON public.platform_message_threads(created_at DESC) WHERE channel='customer' AND priority IN ('urgent','high');
CREATE INDEX IF NOT EXISTS api_request_metrics_error_time_idx ON public.api_request_metrics(occurred_at DESC) WHERE http_status>=500 OR graphql_errors>0;
CREATE INDEX IF NOT EXISTS purchase_orders_org_status_date_idx ON public.purchase_orders(org_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_user_time_idx ON public.video_jobs(created_by,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_source_lookup_idx ON public.credit_ledger(source_type,source_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_date_idx ON public.audit_logs(actor_id,created_at DESC,id DESC);

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_presence_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_presence_samples FROM anon, authenticated;
ALTER TABLE public.platform_admin_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated grants or permissive policies; privileged API ONLY.
-- The super admin is specified in PLATFORM_ADMIN_EMAILS and cannot be created from this table.
),
 category TEXT NOT NULL CHECK(category IN ('getting_started','generation','billing','account','api','troubleshooting')),
 title_zh TEXT NOT NULL, title_en TEXT NOT NULL, title_es TEXT NOT NULL,
 body_zh TEXT NOT NULL, body_en TEXT NOT NULL, body_es TEXT NOT NULL,
 published BOOLEAN NOT NULL DEFAULT false,
 sort_order INTEGER NOT NULL DEFAULT 0,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS help_articles_public_listing_idx ON public.help_articles(category,sort_order,slug) WHERE published=true;
INSERT INTO public.help_articles(slug,category,title_zh,title_en,title_es,body_zh,body_en,body_es,published,sort_order) VALUES
('starting-a-video','getting_started','如何开始创建视频？','How do I start a video?','¿Cómo empiezo un vídeo?','在 Studio 中选择项目、输入描述、上传参考素材并选择当前可用的模型。是否能真正生成取决于管理员配置的视频服务。','Open Studio, choose a project, enter a prompt, upload references and select an available model. Live generation requires a configured provider.','Abre Studio, elige un proyecto, escribe una descripción y añade referencias. La generación real requiere configurar un proveedor.',true,10),
('nine-images','generation','九图参考如何使用？','How do I use nine reference images?','¿Cómo uso nueve imágenes de referencia?','可添加最多九张图片，并在工作台调整排列顺序；音频和视频参考的限制请以最新接口为准。','You can add up to nine images and reorder them in Studio. Check the current provider contract for audio/video limits.','Puedes añadir hasta nueve imágenes y reordenarlas en Studio. Consulta el contrato actual para límites de audio/vídeo.',true,10),
('video-stuck','troubleshooting','生成任务一直等待怎么办？','Why is my video job pending?','¿Por qué sigue pendiente mi vídeo?','在历史记录中查看任务状态。不要用相同的 client_task_id 重复提交；可以联系 Help Desk 并提供任务编号。','Check the job status in History. Do not resubmit the same client_task_id; contact Help Desk with the task ID.','Consulta el estado en el historial. No reenvíes el mismo client_task_id; contacta Help Desk con el ID.',true,10),
('credit-ledger','billing','如何查看积分和支付账目？','Where are my credits and payments?','¿Dónde están mis créditos y pagos?','账户购买记录包含订单状态。工作区积分与视频服务商的积分是不同账本；账目争议请在 Help Desk 中选择 Billing。','Purchase History lists order status. Workspace and upstream provider credits are separate ledgers. For disputes choose Billing in Help Desk.','El historial muestra los pedidos. Los créditos de la plataforma y el proveedor son distintos. Para disputas elige Facturación.',true,10),
('account-help','account','账户登录遇到问题怎么办？','I cannot sign in. What should I do?','No puedo iniciar sesión. ¿Qué hago?','先尝试登录页的找回密码流程。如仍然失败，请在 Help Desk 选择 Account。切勿发送密码或 API 密钥。','Try password recovery from the sign-in page. If it still fails, choose Account in Help Desk. Never send passwords or API keys.','Usa la recuperación de contraseña. Si falla, elige Cuenta en Help Desk. Nunca envíes contraseñas ni claves API.',true,10),
('api-integration','api','在哪里找到 API 接口？','Where are API endpoints?','¿Dónde están los endpoints de API?','工作区管理员可在 Settings 查看 GraphQL、REST、JSON 接口示例；上游视频 API 的路径是另一套独立配置。','Workspace admins can find GraphQL, REST and JSON examples in Settings. Upstream video API routes are configured separately.','Los administradores encuentran ejemplos GraphQL, REST y JSON en Ajustes. Las rutas del proveedor se configuran aparte.',true,10)
ON CONFLICT(slug) DO NOTHING;

-- Presence sampling for historical online and peak-user line charts.
-- Each authenticated user contributes at most one record per five-minute UTC interval.
-- Server-only writes. A valid session must be checked by the Portal service.
CREATE TABLE IF NOT EXISTS public.platform_presence_samples (
 user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 sample_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(user_id,sample_at)
);
CREATE INDEX IF NOT EXISTS platform_presence_samples_time_idx ON public.platform_presence_samples(sample_at DESC);

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
