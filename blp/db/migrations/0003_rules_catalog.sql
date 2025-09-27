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
