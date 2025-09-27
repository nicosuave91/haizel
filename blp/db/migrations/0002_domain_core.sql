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
