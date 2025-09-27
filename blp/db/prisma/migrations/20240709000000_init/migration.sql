-- Prisma shadow migration aligning with raw SQL migrations
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
BEGIN;

CREATE TYPE borrower_type AS ENUM ('individual', 'business');
CREATE TYPE loan_status AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'funded', 'closed', 'withdrawn', 'declined');
CREATE TYPE document_status AS ENUM ('pending', 'requested', 'received', 'validated', 'waived');
CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'blocked', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE public.borrowers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type borrower_type NOT NULL DEFAULT 'individual',
  legal_name text NOT NULL,
  email text,
  phone text,
  tax_identifier text,
  date_of_birth date,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  primary_borrower_id uuid NOT NULL REFERENCES public.borrowers(id),
  loan_number text NOT NULL,
  product_type text,
  purpose text,
  status loan_status NOT NULL DEFAULT 'draft',
  requested_amount numeric(16,2) NOT NULL DEFAULT 0,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  interest_rate numeric(7,4),
  submitted_at timestamptz,
  decisioned_at timestamptz,
  funded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, loan_number),
  UNIQUE (tenant_id, id)
);

ALTER TABLE public.loans
  ADD CONSTRAINT loans_primary_borrower_fkey
  FOREIGN KEY (primary_borrower_id)
  REFERENCES public.borrowers(id)
  ON DELETE RESTRICT;

CREATE TABLE public.loan_borrowers (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  ownership_percent numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (loan_id, borrower_id),
  CONSTRAINT loan_borrowers_tenant_fk FOREIGN KEY (tenant_id, loan_id)
    REFERENCES public.loans(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT loan_borrowers_borrower_fk FOREIGN KEY (tenant_id, borrower_id)
    REFERENCES public.borrowers(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  description text,
  retention_category_code text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE public.loan_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL,
  borrower_id uuid,
  document_category_id uuid NOT NULL REFERENCES public.document_categories(id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  storage_uri text NOT NULL,
  file_size bigint,
  checksum text,
  status document_status NOT NULL DEFAULT 'pending',
  uploaded_by_user_id uuid REFERENCES public.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT NOW(),
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  CONSTRAINT loan_documents_tenant_fk FOREIGN KEY (tenant_id, loan_id)
    REFERENCES public.loans(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT loan_documents_borrower_fk FOREIGN KEY (tenant_id, borrower_id)
    REFERENCES public.borrowers(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT loan_documents_uploader_fk FOREIGN KEY (tenant_id, uploaded_by_user_id)
    REFERENCES public.tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE TABLE public.loan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'open',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date date,
  assigned_to_user_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, id),
  CONSTRAINT loan_tasks_tenant_fk FOREIGN KEY (tenant_id, loan_id)
    REFERENCES public.loans(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT loan_tasks_assignee_fk FOREIGN KEY (tenant_id, assigned_to_user_id)
    REFERENCES public.tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE INDEX idx_loans_tenant_status ON public.loans(tenant_id, status);
CREATE INDEX idx_loans_primary_borrower ON public.loans(primary_borrower_id);
CREATE INDEX idx_loan_documents_loan_id ON public.loan_documents(loan_id);
CREATE INDEX idx_loan_documents_status ON public.loan_documents(status);
CREATE INDEX idx_loan_tasks_status ON public.loan_tasks(status);
CREATE INDEX idx_loan_tasks_due_date ON public.loan_tasks(due_date);

CREATE TRIGGER borrowers_set_updated_at
BEFORE UPDATE ON public.borrowers
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER loans_set_updated_at
BEFORE UPDATE ON public.loans
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER loan_borrowers_set_updated_at
BEFORE UPDATE ON public.loan_borrowers
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER document_categories_set_updated_at
BEFORE UPDATE ON public.document_categories
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER loan_documents_set_updated_at
BEFORE UPDATE ON public.loan_documents
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER loan_tasks_set_updated_at
BEFORE UPDATE ON public.loan_tasks
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER borrowers_set_tenant
BEFORE INSERT OR UPDATE ON public.borrowers
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER loans_set_tenant
BEFORE INSERT OR UPDATE ON public.loans
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER loan_borrowers_set_tenant
BEFORE INSERT OR UPDATE ON public.loan_borrowers
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER document_categories_set_tenant
BEFORE INSERT OR UPDATE ON public.document_categories
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER loan_documents_set_tenant
BEFORE INSERT OR UPDATE ON public.loan_documents
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER loan_tasks_set_tenant
BEFORE INSERT OR UPDATE ON public.loan_tasks
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY borrowers_tenant_isolation
ON public.borrowers
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY loans_tenant_isolation
ON public.loans
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY loan_borrowers_tenant_isolation
ON public.loan_borrowers
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY document_categories_tenant_isolation
ON public.document_categories
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY loan_documents_tenant_isolation
ON public.loan_documents
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY loan_tasks_tenant_isolation
ON public.loan_tasks
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

COMMIT;
BEGIN;

CREATE TYPE rule_effect AS ENUM ('approve', 'manual_review', 'decline', 'notify');
CREATE TYPE rule_severity AS ENUM ('info', 'warning', 'critical');

CREATE TABLE public.rule_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.rule_categories(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

ALTER TABLE public.rule_sets
  ADD CONSTRAINT rule_sets_category_tenant_fk
  FOREIGN KEY (tenant_id, category_id)
  REFERENCES public.rule_categories(tenant_id, id);

CREATE TABLE public.rule_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_set_id uuid NOT NULL REFERENCES public.rule_sets(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  effect rule_effect NOT NULL,
  severity rule_severity NOT NULL DEFAULT 'info',
  condition jsonb NOT NULL,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  active_from timestamptz,
  active_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, rule_set_id, name),
  UNIQUE (tenant_id, id)
);

ALTER TABLE public.rule_definitions
  ADD CONSTRAINT rule_definitions_set_tenant_fk
  FOREIGN KEY (tenant_id, rule_set_id)
  REFERENCES public.rule_sets(tenant_id, id)
  ON DELETE CASCADE;

CREATE TABLE public.rule_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_definition_id uuid NOT NULL REFERENCES public.rule_definitions(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text,
  value_type text NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'date', 'enum')),
  is_required boolean NOT NULL DEFAULT false,
  default_value jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, rule_definition_id, key)
);

ALTER TABLE public.rule_parameters
  ADD CONSTRAINT rule_parameters_definition_tenant_fk
  FOREIGN KEY (tenant_id, rule_definition_id)
  REFERENCES public.rule_definitions(tenant_id, id)
  ON DELETE CASCADE;

CREATE INDEX idx_rule_sets_event_active ON public.rule_sets(tenant_id, trigger_event, is_active);
CREATE INDEX idx_rule_definitions_priority ON public.rule_definitions(rule_set_id, priority DESC);
CREATE INDEX idx_rule_definitions_trigger_event ON public.rule_definitions(tenant_id, trigger_event);

CREATE TRIGGER rule_categories_set_updated_at
BEFORE UPDATE ON public.rule_categories
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER rule_sets_set_updated_at
BEFORE UPDATE ON public.rule_sets
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER rule_definitions_set_updated_at
BEFORE UPDATE ON public.rule_definitions
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER rule_parameters_set_updated_at
BEFORE UPDATE ON public.rule_parameters
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER rule_categories_set_tenant
BEFORE INSERT OR UPDATE ON public.rule_categories
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER rule_sets_set_tenant
BEFORE INSERT OR UPDATE ON public.rule_sets
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER rule_definitions_set_tenant
BEFORE INSERT OR UPDATE ON public.rule_definitions
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER rule_parameters_set_tenant
BEFORE INSERT OR UPDATE ON public.rule_parameters
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

ALTER TABLE public.rule_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY rule_categories_tenant_isolation
ON public.rule_categories
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY rule_sets_tenant_isolation
ON public.rule_sets
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY rule_definitions_tenant_isolation
ON public.rule_definitions
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY rule_parameters_tenant_isolation
ON public.rule_parameters
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

COMMIT;
BEGIN;

CREATE TABLE public.retention_categories (
  code text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  default_retention_months integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_code text NOT NULL REFERENCES public.retention_categories(code) ON DELETE RESTRICT,
  name text NOT NULL,
  retention_months integer NOT NULL CHECK (retention_months >= 0),
  review_interval_months integer CHECK (review_interval_months >= 0),
  disposition text NOT NULL,
  hold_until_event text,
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.retention_policy_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.retention_policies(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, resource_type, resource_identifier)
);

ALTER TABLE public.retention_policy_assignments
  ADD CONSTRAINT retention_policy_assignments_policy_fk
  FOREIGN KEY (tenant_id, policy_id)
  REFERENCES public.retention_policies(tenant_id, id)
  ON DELETE CASCADE;

CREATE TABLE public.data_retention_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_identifier text NOT NULL,
  policy_id uuid REFERENCES public.retention_policies(id) ON DELETE SET NULL,
  reason text NOT NULL,
  granted_by_user_id uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, resource_type, resource_identifier)
);

ALTER TABLE public.data_retention_exemptions
  ADD CONSTRAINT data_retention_exemptions_granter_fk
  FOREIGN KEY (tenant_id, granted_by_user_id)
  REFERENCES public.tenant_users(tenant_id, user_id)
  ON DELETE SET NULL;

ALTER TABLE public.data_retention_exemptions
  ADD CONSTRAINT data_retention_exemptions_policy_fk
  FOREIGN KEY (tenant_id, policy_id)
  REFERENCES public.retention_policies(tenant_id, id)
  ON DELETE SET NULL;

CREATE TABLE public.holiday_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  timezone text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name),
  UNIQUE (tenant_id, id)
);

CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES public.holiday_calendars(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  label text NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (calendar_id, holiday_date, label)
);

ALTER TABLE public.holidays
  ADD CONSTRAINT holidays_calendar_tenant_fk
  FOREIGN KEY (tenant_id, calendar_id)
  REFERENCES public.holiday_calendars(tenant_id, id)
  ON DELETE CASCADE;

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_type text NOT NULL DEFAULT 'user',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_events
  ADD CONSTRAINT audit_events_actor_fk
  FOREIGN KEY (tenant_id, actor_id)
  REFERENCES public.tenant_users(tenant_id, user_id)
  ON DELETE SET NULL;

ALTER TABLE public.document_categories
  ADD CONSTRAINT document_categories_retention_category_fk
  FOREIGN KEY (retention_category_code)
  REFERENCES public.retention_categories(code)
  ON DELETE SET NULL;

CREATE INDEX idx_retention_policies_category ON public.retention_policies(tenant_id, category_code);
CREATE INDEX idx_retention_policy_assignments_policy ON public.retention_policy_assignments(policy_id);
CREATE INDEX idx_data_retention_exemptions_resource ON public.data_retention_exemptions(tenant_id, resource_type, resource_identifier);
CREATE INDEX idx_holiday_calendars_default ON public.holiday_calendars(tenant_id, is_default) WHERE is_default = true;
CREATE INDEX idx_holidays_date ON public.holidays(tenant_id, holiday_date);
CREATE INDEX idx_audit_events_entity ON public.audit_events(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_events_request ON public.audit_events(tenant_id, request_id);

CREATE TRIGGER retention_categories_set_updated_at
BEFORE UPDATE ON public.retention_categories
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER retention_policies_set_updated_at
BEFORE UPDATE ON public.retention_policies
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER data_retention_exemptions_set_updated_at
BEFORE UPDATE ON public.data_retention_exemptions
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER holiday_calendars_set_updated_at
BEFORE UPDATE ON public.holiday_calendars
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER holidays_set_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER retention_policies_set_tenant
BEFORE INSERT OR UPDATE ON public.retention_policies
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER retention_policy_assignments_set_tenant
BEFORE INSERT OR UPDATE ON public.retention_policy_assignments
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER data_retention_exemptions_set_tenant
BEFORE INSERT OR UPDATE ON public.data_retention_exemptions
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER holiday_calendars_set_tenant
BEFORE INSERT OR UPDATE ON public.holiday_calendars
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER holidays_set_tenant
BEFORE INSERT OR UPDATE ON public.holidays
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

CREATE TRIGGER audit_events_set_tenant
BEFORE INSERT OR UPDATE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION app.apply_tenant_id();

ALTER TABLE public.retention_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY retention_categories_public_read
ON public.retention_categories
FOR ALL USING (true)
WITH CHECK (false);

CREATE POLICY retention_policies_tenant_isolation
ON public.retention_policies
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY retention_policy_assignments_tenant_isolation
ON public.retention_policy_assignments
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY data_retention_exemptions_tenant_isolation
ON public.data_retention_exemptions
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY holiday_calendars_tenant_isolation
ON public.holiday_calendars
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY holidays_tenant_isolation
ON public.holidays
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY audit_events_tenant_isolation
ON public.audit_events
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

COMMIT;
