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
