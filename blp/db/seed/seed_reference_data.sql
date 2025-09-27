BEGIN;

-- Baseline retention categories shared across tenants
INSERT INTO public.retention_categories (code, display_name, description, default_retention_months, is_active)
VALUES
  ('loan_application', 'Loan Applications', 'Completed loan application packages.', 84, true),
  ('supporting_document', 'Supporting Documents', 'Documents supplied to support underwriting decisions.', 60, true),
  ('compliance', 'Compliance Artifacts', 'Regulatory filings, disclosures, and compliance evidence.', 120, true),
  ('communication', 'Borrower Communications', 'Borrower-facing messages and disclosures.', 24, true)
ON CONFLICT (code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_retention_months = EXCLUDED.default_retention_months,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Tenant fixtures for local development
INSERT INTO public.tenants (id, slug, display_name, timezone, contact_email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'acme', 'Acme Lending', 'America/New_York', 'ops@acme.test'),
  ('22222222-2222-4222-8222-222222222222', 'summit', 'Summit Capital', 'America/Los_Angeles', 'support@summit.test')
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    timezone = EXCLUDED.timezone,
    contact_email = EXCLUDED.contact_email,
    updated_at = NOW();

-- User fixtures
SELECT set_config('app.user_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
INSERT INTO public.users (id, email, full_name, locale)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@acme.test', 'Ada Admin', 'en-US')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    locale = EXCLUDED.locale,
    updated_at = NOW();

SELECT set_config('app.user_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
INSERT INTO public.users (id, email, full_name, locale)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'officer@acme.test', 'Owen Officer', 'en-US')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    locale = EXCLUDED.locale,
    updated_at = NOW();

SELECT set_config('app.user_id', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
INSERT INTO public.users (id, email, full_name, locale)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'owner@summit.test', 'Sierra Owner', 'en-US')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    locale = EXCLUDED.locale,
    updated_at = NOW();

SELECT set_config('app.user_id', '', true);

-- Tenant memberships
SELECT set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.tenant_users (tenant_id, user_id, role, invited_at, accepted_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner', NOW(), NOW()),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'loan_officer', NOW(), NOW())
ON CONFLICT (tenant_id, user_id) DO UPDATE
SET role = EXCLUDED.role,
    accepted_at = COALESCE(EXCLUDED.accepted_at, public.tenant_users.accepted_at),
    updated_at = NOW();

SELECT set_config('app.tenant_id', '22222222-2222-4222-8222-222222222222', true);
INSERT INTO public.tenant_users (tenant_id, user_id, role, invited_at, accepted_at)
VALUES ('22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'owner', NOW(), NOW())
ON CONFLICT (tenant_id, user_id) DO UPDATE
SET role = EXCLUDED.role,
    accepted_at = COALESCE(EXCLUDED.accepted_at, public.tenant_users.accepted_at),
    updated_at = NOW();

-- Document categories per tenant
SELECT set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.document_categories (id, tenant_id, code, display_name, description, retention_category_code)
VALUES
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', 'income_verification', 'Income Verification', 'Income statements, W-2s, and related documentation.', 'supporting_document'),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', 'identity', 'Identity', 'Borrower identification and KYC documents.', 'compliance'),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'compliance_report', 'Compliance Report', 'Annual compliance and audit reports.', 'compliance')
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    retention_category_code = EXCLUDED.retention_category_code,
    updated_at = NOW();

SELECT set_config('app.tenant_id', '22222222-2222-4222-8222-222222222222', true);
INSERT INTO public.document_categories (id, tenant_id, code, display_name, description, retention_category_code)
VALUES
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222222', 'income_verification', 'Income Verification', 'Documents supporting borrower income.', 'supporting_document'),
  ('44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222', 'collateral', 'Collateral', 'Appraisals and collateral documentation.', 'supporting_document'),
  ('44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222222', 'compliance_report', 'Compliance Report', 'Compliance documents requiring extended retention.', 'compliance')
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    retention_category_code = EXCLUDED.retention_category_code,
    updated_at = NOW();

-- Retention policies and assignments
SELECT set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.retention_policies (id, tenant_id, category_code, name, retention_months, review_interval_months, disposition, hold_until_event, is_default, notes)
VALUES
  ('55555555-5555-4555-8555-555555555551', '11111111-1111-4111-8111-111111111111', 'supporting_document', 'Acme Supporting Docs', 72, 24, 'secure_destroy', NULL, true, 'Extended to meet investor guidelines.'),
  ('55555555-5555-4555-8555-555555555552', '11111111-1111-4111-8111-111111111111', 'compliance', 'Acme Compliance Archive', 120, 36, 'archive', NULL, false, 'Long-term compliance retention policy.')
ON CONFLICT (id) DO UPDATE
SET category_code = EXCLUDED.category_code,
    name = EXCLUDED.name,
    retention_months = EXCLUDED.retention_months,
    review_interval_months = EXCLUDED.review_interval_months,
    disposition = EXCLUDED.disposition,
    hold_until_event = EXCLUDED.hold_until_event,
    is_default = EXCLUDED.is_default,
    notes = EXCLUDED.notes,
    updated_at = NOW();

INSERT INTO public.retention_policy_assignments (id, tenant_id, policy_id, resource_type, resource_identifier)
VALUES
  ('99999999-9999-4999-8999-999999999991', '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555551', 'document_category', '33333333-3333-4333-8333-333333333331'),
  ('99999999-9999-4999-8999-999999999992', '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555552', 'document_category', '33333333-3333-4333-8333-333333333333')
ON CONFLICT (id) DO UPDATE
SET policy_id = EXCLUDED.policy_id,
    resource_type = EXCLUDED.resource_type,
    resource_identifier = EXCLUDED.resource_identifier;

SELECT set_config('app.tenant_id', '22222222-2222-4222-8222-222222222222', true);
INSERT INTO public.retention_policies (id, tenant_id, category_code, name, retention_months, review_interval_months, disposition, hold_until_event, is_default, notes)
VALUES
  ('66666666-6666-4666-8666-666666666661', '22222222-2222-4222-8222-222222222222', 'supporting_document', 'Summit Supporting Docs', 60, 24, 'secure_destroy', NULL, true, 'Aligns with state lending regulations.'),
  ('66666666-6666-4666-8666-666666666662', '22222222-2222-4222-8222-222222222222', 'communication', 'Summit Communications', 36, 12, 'archive', NULL, false, 'Retention policy for outbound communications.')
ON CONFLICT (id) DO UPDATE
SET category_code = EXCLUDED.category_code,
    name = EXCLUDED.name,
    retention_months = EXCLUDED.retention_months,
    review_interval_months = EXCLUDED.review_interval_months,
    disposition = EXCLUDED.disposition,
    hold_until_event = EXCLUDED.hold_until_event,
    is_default = EXCLUDED.is_default,
    notes = EXCLUDED.notes,
    updated_at = NOW();

INSERT INTO public.retention_policy_assignments (id, tenant_id, policy_id, resource_type, resource_identifier)
VALUES
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1', '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666661', 'document_category', '44444444-4444-4444-8444-444444444441'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2', '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666662', 'document_category', '44444444-4444-4444-8444-444444444443')
ON CONFLICT (id) DO UPDATE
SET policy_id = EXCLUDED.policy_id,
    resource_type = EXCLUDED.resource_type,
    resource_identifier = EXCLUDED.resource_identifier;

-- Sample retention exemption
SELECT set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.data_retention_exemptions (id, tenant_id, resource_type, resource_identifier, policy_id, reason, granted_by_user_id, expires_at)
VALUES
  ('bbbbbbbb-cccc-4ddd-8eee-fffffffffff1', '11111111-1111-4111-8111-111111111111', 'loan_document', 'legacy-audit-2021', '55555555-5555-4555-8555-555555555552', 'Litigation hold for 2021 audit.', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NOW() + INTERVAL '18 months')
ON CONFLICT (id) DO UPDATE
SET policy_id = EXCLUDED.policy_id,
    reason = EXCLUDED.reason,
    granted_by_user_id = EXCLUDED.granted_by_user_id,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW();

-- Holiday calendars and key observances
SELECT set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.holiday_calendars (id, tenant_id, name, timezone, is_default)
VALUES ('77777777-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111', 'US Federal Holidays', 'America/New_York', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    timezone = EXCLUDED.timezone,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

INSERT INTO public.holidays (id, tenant_id, calendar_id, holiday_date, label, is_recurring)
VALUES
  ('77777777-7777-4777-8777-777777777772', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777771', DATE '2024-01-01', 'New Year''s Day', true),
  ('77777777-7777-4777-8777-777777777773', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777771', DATE '2024-07-04', 'Independence Day', true),
  ('77777777-7777-4777-8777-777777777774', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777771', DATE '2024-11-28', 'Thanksgiving Day', false),
  ('77777777-7777-4777-8777-777777777775', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777771', DATE '2024-12-25', 'Christmas Day', true)
ON CONFLICT (id) DO UPDATE
SET holiday_date = EXCLUDED.holiday_date,
    label = EXCLUDED.label,
    is_recurring = EXCLUDED.is_recurring;

SELECT set_config('app.tenant_id', '22222222-2222-4222-8222-222222222222', true);
INSERT INTO public.holiday_calendars (id, tenant_id, name, timezone, is_default)
VALUES ('88888888-8888-4888-8888-888888888881', '22222222-2222-4222-8222-222222222222', 'CA Operational Holidays', 'America/Los_Angeles', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    timezone = EXCLUDED.timezone,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

INSERT INTO public.holidays (id, tenant_id, calendar_id, holiday_date, label, is_recurring)
VALUES
  ('88888888-8888-4888-8888-888888888882', '22222222-2222-4222-8222-222222222222', '88888888-8888-4888-8888-888888888881', DATE '2024-02-19', 'Presidents'' Day', true),
  ('88888888-8888-4888-8888-888888888883', '22222222-2222-4222-8222-222222222222', '88888888-8888-4888-8888-888888888881', DATE '2024-09-02', 'Labor Day', true),
  ('88888888-8888-4888-8888-888888888884', '22222222-2222-4222-8222-222222222222', '88888888-8888-4888-8888-888888888881', DATE '2024-11-29', 'Day After Thanksgiving', false),
  ('88888888-8888-4888-8888-888888888885', '22222222-2222-4222-8222-222222222222', '88888888-8888-4888-8888-888888888881', DATE '2024-12-25', 'Christmas Day', true)
ON CONFLICT (id) DO UPDATE
SET holiday_date = EXCLUDED.holiday_date,
    label = EXCLUDED.label,
    is_recurring = EXCLUDED.is_recurring;

-- Reset tenant scope
SELECT set_config('app.tenant_id', '', true);
SELECT set_config('app.user_id', '', true);

COMMIT;
