BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.apply_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  configured_tenant uuid;
BEGIN
  configured_tenant := app.current_tenant_id();

  IF TG_OP = 'UPDATE' AND NEW.tenant_id <> OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;

  IF configured_tenant IS NULL THEN
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'app.tenant_id must be configured before writing tenant scoped data';
    END IF;
  ELSE
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := configured_tenant;
    ELSIF NEW.tenant_id <> configured_tenant THEN
      RAISE EXCEPTION 'tenant scope violation (expected % but received %)', configured_tenant, NEW.tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'loan_officer', 'processor', 'viewer');

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  full_name text NOT NULL,
  locale text NOT NULL DEFAULT 'en-US',
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tenant_users (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'viewer',
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_user_id ON public.tenant_users(user_id);

CREATE TRIGGER tenants_set_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER tenant_users_set_updated_at
BEFORE UPDATE ON public.tenant_users
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select
ON public.tenants
FOR SELECT USING (id = app.current_tenant_id());

CREATE POLICY tenant_isolation_write
ON public.tenants
FOR ALL USING (id = app.current_tenant_id())
WITH CHECK (id = app.current_tenant_id());

CREATE POLICY users_isolation
ON public.users
FOR ALL
USING (
  id = app.current_user_id()
  OR EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = public.users.id
      AND tu.tenant_id = app.current_tenant_id()
  )
)
WITH CHECK (
  id = app.current_user_id()
  OR EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = public.users.id
      AND tu.tenant_id = app.current_tenant_id()
  )
);

CREATE POLICY tenant_users_isolation
ON public.tenant_users
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

COMMIT;
