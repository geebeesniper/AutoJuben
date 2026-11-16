-- AutoJuben v0.4.0 | Apply after sql/001, 002, 003.
-- Stripe money amounts are integer USD cents. No card PAN, CVV, or Stripe secret is stored in plaintext.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.platform_settings (
 id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),
 payments_enabled BOOLEAN NOT NULL DEFAULT false,
 usage_billing_enabled BOOLEAN NOT NULL DEFAULT false,
 provider_key_ciphertext TEXT,
 stripe_secret_ciphertext TEXT,
 stripe_webhook_ciphertext TEXT,
 stripe_portal_config TEXT,
 updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (NOT usage_billing_enabled OR payments_enabled)
);
INSERT INTO public.platform_settings(id) VALUES(1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.billing_products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 sku TEXT NOT NULL UNIQUE CHECK(length(sku) BETWEEN 2 AND 64),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
 description TEXT NOT NULL DEFAULT '',
 credits INTEGER NOT NULL CHECK(credits > 0 AND credits <= 1000000),
 amount_cents INTEGER NOT NULL CHECK(amount_cents >= 50 AND amount_cents <= 100000000),
 currency TEXT NOT NULL DEFAULT 'usd' CHECK(currency='usd'),
 active BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_products_active_idx ON public.billing_products(active,created_at);

CREATE TABLE IF NOT EXISTS public.billing_customers (
 user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 stripe_customer_id TEXT UNIQUE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 product_id UUID NOT NULL REFERENCES public.billing_products(id) ON DELETE RESTRICT,
 product_name TEXT NOT NULL,
 credits INTEGER NOT NULL CHECK(credits>0),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=50),
 currency TEXT NOT NULL DEFAULT 'usd' CHECK(currency='usd'),
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','checkout','pending','paid','failed','expired','partially_refunded','refunded')),
 stripe_session_id TEXT UNIQUE,
 stripe_customer_id TEXT,
 stripe_payment_intent_id TEXT UNIQUE,
 refunded_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK(refunded_amount_cents>=0),
 refunded_credits INTEGER NOT NULL DEFAULT 0 CHECK(refunded_credits>=0),
 error_message TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS purchase_orders_user_idx ON public.purchase_orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_org_idx ON public.purchase_orders(org_id,created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON public.purchase_orders(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
 event_id TEXT PRIMARY KEY,
 event_type TEXT NOT NULL,
 processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_refund_events (
 stripe_charge_id TEXT PRIMARY KEY,
 stripe_payment_intent_id TEXT NOT NULL,
 amount_refunded INTEGER NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_refund_events_pi_idx ON public.stripe_refund_events(stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS public.credit_wallets (
 org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
 balance BIGINT NOT NULL DEFAULT 0,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.credit_ledger (
 id BIGSERIAL PRIMARY KEY,
 org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 delta INTEGER NOT NULL CHECK(delta<>0),
 source_type TEXT NOT NULL,
 source_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (source_type,source_id)
);
CREATE INDEX IF NOT EXISTS credit_ledger_org_idx ON public.credit_ledger(org_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.video_tariffs (
 model TEXT NOT NULL CHECK(length(model) BETWEEN 1 AND 80),
 resolution TEXT NOT NULL CHECK(length(resolution) BETWEEN 1 AND 20),
 credits INTEGER NOT NULL CHECK(credits>=1 AND credits<=1000000),
 active BOOLEAN NOT NULL DEFAULT true,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(model,resolution)
);
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS platform_credit_cost INTEGER NOT NULL DEFAULT 0 CHECK(platform_credit_cost>=0);
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS platform_credit_state TEXT NOT NULL DEFAULT 'none' CHECK(platform_credit_state IN ('none','reserved','captured','released'));

-- No direct anon/authenticated Data API policies: all access is via protected Vercel API.
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_refund_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_tariffs ENABLE ROW LEVEL SECURITY;
