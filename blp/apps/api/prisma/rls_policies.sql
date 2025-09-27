-- Tenant scoped row level security policies for the Haizel pipeline tables.
-- Requires the application to SET LOCAL app.tenant_id before queries.

CREATE OR REPLACE FUNCTION haizel.current_tenant_id() RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true)::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- Tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_self_access ON tenants
  USING (id = haizel.current_tenant_id())
  WITH CHECK (id = haizel.current_tenant_id());

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_scope ON users
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Policies
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY policies_tenant_scope ON policies
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Borrowers
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
CREATE POLICY borrowers_tenant_scope ON borrowers
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Loans
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY loans_tenant_scope ON loans
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Loan parties (via loan)
ALTER TABLE loan_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_parties_tenant_scope ON loan_parties
  USING (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = loan_parties.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = loan_parties.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  );

-- Loan notes
ALTER TABLE loan_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_notes_tenant_scope ON loan_notes
  USING (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = loan_notes.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = loan_notes.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  );

-- Workflow steps
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_steps_tenant_scope ON workflow_steps
  USING (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = workflow_steps.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = workflow_steps.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  );

-- Conditions
ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY conditions_tenant_scope ON conditions
  USING (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = conditions.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = conditions.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  );

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_tenant_scope ON documents
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Doc manifest
ALTER TABLE doc_manifest ENABLE ROW LEVEL SECURITY;
CREATE POLICY doc_manifest_tenant_scope ON doc_manifest
  USING (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = doc_manifest.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans l
      WHERE l.id = doc_manifest.loan_id AND l.tenant_id = haizel.current_tenant_id()
    )
  );

-- Vendor integrations
ALTER TABLE vendor_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_integrations_tenant_scope ON vendor_integrations
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Vendor calls
ALTER TABLE vendor_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_calls_tenant_scope ON vendor_calls
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Compliance events
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_events_tenant_scope ON compliance_events
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Audit events
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_events_tenant_scope ON audit_events
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Outbox
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbox_tenant_scope ON outbox
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());

-- Idempotency keys
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY idempotency_keys_tenant_scope ON idempotency_keys
  USING (tenant_id = haizel.current_tenant_id())
  WITH CHECK (tenant_id = haizel.current_tenant_id());
