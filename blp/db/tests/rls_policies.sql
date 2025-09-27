\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  borrower_a uuid := gen_random_uuid();
  borrower_b uuid := gen_random_uuid();
  loan_a uuid := gen_random_uuid();
  loan_b uuid := gen_random_uuid();
  category_a uuid := gen_random_uuid();
  category_b uuid := gen_random_uuid();
  doc_a uuid := gen_random_uuid();
  doc_b uuid := gen_random_uuid();
  task_a uuid := gen_random_uuid();
  task_b uuid := gen_random_uuid();
  rows_changed integer;
BEGIN
  -- Reset scoping configuration
  PERFORM set_config('app.tenant_id', '', true);
  PERFORM set_config('app.user_id', '', true);

  -- Seed tenants
  PERFORM set_config('app.tenant_id', tenant_a::text, true);
  INSERT INTO public.tenants (id, slug, display_name, timezone)
  VALUES (tenant_a, 'rls-a', 'RLS Tenant A', 'UTC')
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.tenant_id', tenant_b::text, true);
  INSERT INTO public.tenants (id, slug, display_name, timezone)
  VALUES (tenant_b, 'rls-b', 'RLS Tenant B', 'UTC')
  ON CONFLICT DO NOTHING;

  -- Seed users
  PERFORM set_config('app.user_id', user_a::text, true);
  INSERT INTO public.users (id, email, full_name)
  VALUES (user_a, 'rls-a@example.test', 'Tenant A User')
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.user_id', user_b::text, true);
  INSERT INTO public.users (id, email, full_name)
  VALUES (user_b, 'rls-b@example.test', 'Tenant B User')
  ON CONFLICT DO NOTHING;

  -- Tenant memberships and categories
  PERFORM set_config('app.user_id', '', true);

  PERFORM set_config('app.tenant_id', tenant_a::text, true);
  INSERT INTO public.tenant_users (tenant_id, user_id, role, invited_at, accepted_at)
  VALUES (tenant_a, user_a, 'owner', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO public.document_categories (id, tenant_id, code, display_name)
  VALUES (category_a, tenant_a, 'rls_income', 'RLS Income A')
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.tenant_id', tenant_b::text, true);
  INSERT INTO public.tenant_users (tenant_id, user_id, role, invited_at, accepted_at)
  VALUES (tenant_b, user_b, 'owner', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO public.document_categories (id, tenant_id, code, display_name)
  VALUES (category_b, tenant_b, 'rls_income', 'RLS Income B')
  ON CONFLICT DO NOTHING;

  -- Create borrower, loan, document, and task per tenant
  PERFORM set_config('app.user_id', user_a::text, true);
  PERFORM set_config('app.tenant_id', tenant_a::text, true);
  INSERT INTO public.borrowers (id, tenant_id, legal_name)
  VALUES (borrower_a, tenant_a, 'Borrower A')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loans (id, tenant_id, primary_borrower_id, loan_number, status, requested_amount)
  VALUES (loan_a, tenant_a, borrower_a, 'A-001', 'submitted', 100000)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loan_borrowers (tenant_id, loan_id, borrower_id, is_primary)
  VALUES (tenant_a, loan_a, borrower_a, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loan_documents (id, tenant_id, loan_id, borrower_id, document_category_id, file_name, storage_uri, status, uploaded_by_user_id)
  VALUES (doc_a, tenant_a, loan_a, borrower_a, category_a, 'income.pdf', 's3://a/income.pdf', 'received', user_a)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loan_tasks (id, tenant_id, loan_id, title, assigned_to_user_id)
  VALUES (task_a, tenant_a, loan_a, 'Collect updated income docs', user_a)
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.user_id', user_b::text, true);
  PERFORM set_config('app.tenant_id', tenant_b::text, true);
  INSERT INTO public.borrowers (id, tenant_id, legal_name)
  VALUES (borrower_b, tenant_b, 'Borrower B')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loans (id, tenant_id, primary_borrower_id, loan_number, status, requested_amount)
  VALUES (loan_b, tenant_b, borrower_b, 'B-001', 'submitted', 150000)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loan_borrowers (tenant_id, loan_id, borrower_id, is_primary)
  VALUES (tenant_b, loan_b, borrower_b, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loan_documents (id, tenant_id, loan_id, borrower_id, document_category_id, file_name, storage_uri, status, uploaded_by_user_id)
  VALUES (doc_b, tenant_b, loan_b, borrower_b, category_b, 'income.pdf', 's3://b/income.pdf', 'received', user_b)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loan_tasks (id, tenant_id, loan_id, title, assigned_to_user_id)
  VALUES (task_b, tenant_b, loan_b, 'Collect compliance certificate', user_b)
  ON CONFLICT DO NOTHING;

  -- Assertions: tenant A cannot see tenant B data
  PERFORM set_config('app.user_id', user_a::text, true);
  PERFORM set_config('app.tenant_id', tenant_a::text, true);

  IF (SELECT COUNT(*) FROM public.loans WHERE id = loan_b) > 0 THEN
    RAISE EXCEPTION 'Tenant A unexpectedly read tenant B loan';
  END IF;

  UPDATE public.loans SET purpose = 'illegal update' WHERE id = loan_b;
  GET DIAGNOSTICS rows_changed = ROW_COUNT;
  IF rows_changed > 0 THEN
    RAISE EXCEPTION 'Tenant A updated tenant B loan through RLS';
  END IF;

  DELETE FROM public.loan_documents WHERE id = doc_b;
  GET DIAGNOSTICS rows_changed = ROW_COUNT;
  IF rows_changed > 0 THEN
    RAISE EXCEPTION 'Tenant A deleted tenant B document through RLS';
  END IF;

  BEGIN
    INSERT INTO public.loan_documents (id, tenant_id, loan_id, document_category_id, file_name, storage_uri)
    VALUES (gen_random_uuid(), tenant_b, loan_b, category_b, 'bad.pdf', 's3://bad.pdf');
    RAISE EXCEPTION 'Tenant scoping trigger failed to reject mismatched tenant insert';
  EXCEPTION
    WHEN others THEN
      -- Expected: tenant mismatch should raise an error
      NULL;
  END;

  -- Assertions: tenant B cannot see tenant A data
  PERFORM set_config('app.user_id', user_b::text, true);
  PERFORM set_config('app.tenant_id', tenant_b::text, true);

  IF (SELECT COUNT(*) FROM public.borrowers WHERE id = borrower_a) > 0 THEN
    RAISE EXCEPTION 'Tenant B unexpectedly read tenant A borrower';
  END IF;

  UPDATE public.loan_tasks SET status = 'completed' WHERE id = task_a;
  GET DIAGNOSTICS rows_changed = ROW_COUNT;
  IF rows_changed > 0 THEN
    RAISE EXCEPTION 'Tenant B updated tenant A task through RLS';
  END IF;

  -- Clean up scope
  PERFORM set_config('app.tenant_id', '', true);
  PERFORM set_config('app.user_id', '', true);
END;
$$;

ROLLBACK;
