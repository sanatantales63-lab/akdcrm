-- ==============================================================================
-- AKD INTERIOR (ALL KIND DECOR) — PRIVATE BUSINESS MANAGEMENT CRM
-- COMPLETE MASTER SCHEMA SETUP (ONE-CLICK DEPLOYMENT)
-- Run this script in Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. EXTENSIONS & COMMON FUNCTIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. PROFILES (OWNER ACCESS REGISTRY) & AUTO-SYNC TRIGGER
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Studio Principal',
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'owner'
      AND is_active = TRUE
  );
$$;

-- Automatically register new Supabase Auth users as active Studio Owners in profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'AKD Studio Principal'),
    'owner',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = 'owner',
      is_active = TRUE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Sync any user already created in auth.users into profiles
INSERT INTO public.profiles (id, email, full_name, role, is_active)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'AKD Studio Principal'), 'owner', TRUE
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. BUSINESS SETTINGS
CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL DEFAULT 'AKD All Kind Decor (AKD Interior)',
  authorized_signatory TEXT NOT NULL DEFAULT 'AKD All Kind Decor',
  logo_url TEXT NOT NULL DEFAULT '/logo.png',
  phone TEXT NOT NULL DEFAULT '+91 76027 72338',
  email TEXT NOT NULL DEFAULT 'owner@akdstudio.com',
  address TEXT NOT NULL DEFAULT 'Lalpur, Kharagpur, West Bengal, India',
  website TEXT NOT NULL DEFAULT 'https://www.akdinterior.in/',
  currency TEXT NOT NULL DEFAULT 'INR',
  date_format TEXT NOT NULL DEFAULT 'dd MMM yyyy',
  financial_year_start_month INTEGER NOT NULL DEFAULT 4 CHECK (financial_year_start_month BETWEEN 1 AND 12),
  project_categories JSONB NOT NULL DEFAULT '["Residential Interior", "Commercial Interior", "Office Interior", "Modular Kitchen", "Renovation", "Turnkey Project", "Other"]'::jsonb,
  expense_categories JSONB NOT NULL DEFAULT '["Materials", "Labour", "Contractor", "Transportation", "Site Expenses", "Design and Software", "Office Expenses", "Marketing", "Other"]'::jsonb,
  lead_sources JSONB NOT NULL DEFAULT '["Website (akdinterior.in)", "Client Referral", "Google Search / Maps", "Instagram / Social", "Walk-in Studio", "Architect Partner", "Direct Call / WhatsApp", "Other"]'::jsonb,
  gstin TEXT NOT NULL DEFAULT '',
  bank_account_name TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_ifsc_code TEXT NOT NULL DEFAULT '',
  bank_branch TEXT NOT NULL DEFAULT '',
  bank_upi_id TEXT NOT NULL DEFAULT '',
  signature_url TEXT NOT NULL DEFAULT '',
  default_payment_terms TEXT NOT NULL DEFAULT '',
  default_terms_and_conditions TEXT NOT NULL DEFAULT '',
  default_quotation_validity_days INTEGER NOT NULL DEFAULT 30,
  quotation_pdf_defaults JSONB NOT NULL DEFAULT '{
    "showBusinessDetails": true,
    "showClientDetails": true,
    "showProjectDetails": true,
    "showBoqTable": true,
    "showRateQtyAmount": true,
    "showDiscount": true,
    "showTax": true,
    "showScopeOfWork": true,
    "showPaymentTerms": true,
    "showTermsAndConditions": true,
    "showNotes": true,
    "showBankDetails": true,
    "showSignature": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS gstin TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_branch TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_upi_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signature_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_payment_terms TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_terms_and_conditions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_quotation_validity_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS quotation_pdf_defaults JSONB NOT NULL DEFAULT '{
    "showBusinessDetails": true,
    "showClientDetails": true,
    "showProjectDetails": true,
    "showBoqTable": true,
    "showRateQtyAmount": true,
    "showDiscount": true,
    "showTax": true,
    "showScopeOfWork": true,
    "showPaymentTerms": true,
    "showTermsAndConditions": true,
    "showNotes": true,
    "showBankDetails": true,
    "showSignature": true
  }'::jsonb;

-- Initialize default studio business settings row if none exists
INSERT INTO public.business_settings (
  id, business_name, authorized_signatory, logo_url, phone, email, address, website, currency, date_format
)
SELECT
  gen_random_uuid(),
  'AKD All Kind Decor (AKD Interior)',
  'AKD All Kind Decor',
  '/logo.png',
  '+91 76027 72338',
  'owner@akdstudio.com',
  'Lalpur, Kharagpur, West Bengal, India',
  'https://www.akdinterior.in/',
  'INR',
  'dd MMM yyyy'
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings);

-- 4. CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  client_type TEXT NOT NULL DEFAULT 'Residential' CHECK (client_type IN ('Residential', 'Commercial')),
  property_type TEXT,
  property_location TEXT,
  full_address TEXT,
  project_budget NUMERIC(14, 2) CHECK (project_budget IS NULL OR project_budget >= 0),
  lead_source TEXT,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Active Client', 'Completed', 'Lost')),
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  client_notesLog JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients (LOWER(full_name));
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients (phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients (status) WHERE is_archived = FALSE;

-- 5. ENQUIRIES
CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  project_type TEXT NOT NULL DEFAULT 'Residential Interior',
  property_location TEXT,
  estimated_budget NUMERIC(14, 2) CHECK (estimated_budget IS NULL OR estimated_budget >= 0),
  lead_source TEXT,
  enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  follow_up_date DATE,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Follow-up Required', 'Site Visit', 'Quotation Sent', 'Converted', 'Lost')),
  notes TEXT,
  follow_up_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  converted_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  converted_project_id UUID,
  converted_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON public.enquiries (status) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_enquiries_follow_up ON public.enquiries (follow_up_date) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_enquiries_phone ON public.enquiries (phone);

-- 6. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  category TEXT NOT NULL DEFAULT 'Residential Interior',
  property_location TEXT NOT NULL,
  site_address TEXT,
  description TEXT,
  total_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_value >= 0),
  estimated_start_date DATE,
  expected_completion_date DATE,
  actual_completion_date DATE,
  status TEXT NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'Design', 'Quotation', 'Approved', 'In Progress', 'On Hold', 'Completed', 'Cancelled')),
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  payment_terms TEXT,
  internal_notes TEXT,
  source_enquiry_id UUID REFERENCES public.enquiries(id) ON DELETE SET NULL,
  sharing_token TEXT UNIQUE,
  is_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sharing_token_created_at TIMESTAMPTZ,
  current_work_stage TEXT DEFAULT 'Planning',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sharing_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sharing_token_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_work_stage TEXT DEFAULT 'Planning';

ALTER TABLE public.enquiries
  DROP CONSTRAINT IF EXISTS fk_enquiries_converted_project,
  ADD CONSTRAINT fk_enquiries_converted_project
  FOREIGN KEY (converted_project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects (client_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_expected_completion ON public.projects (expected_completion_date) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_sharing_token ON public.projects (sharing_token) WHERE is_sharing_enabled = TRUE;

-- 7. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_code TEXT UNIQUE NOT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Advance', 'Instalment', 'Milestone Payment', 'Final Payment', 'Other')),
  transaction_reference TEXT,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_project_id ON public.payments (project_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments (client_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments (payment_date) WHERE is_archived = FALSE;

CREATE OR REPLACE FUNCTION public.validate_payment_client_project_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_client_id UUID;
BEGIN
  SELECT client_id INTO v_project_client_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_project_client_id IS NULL THEN
    RAISE EXCEPTION 'Referenced project (%) does not exist.', NEW.project_id;
  END IF;

  IF v_project_client_id <> NEW.client_id THEN
    RAISE EXCEPTION 'Payment client_id (%) does not match the project client_id (%).', NEW.client_id, v_project_client_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_consistency ON public.payments;
CREATE TRIGGER trg_validate_payment_consistency
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_client_project_consistency();

-- 8. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_name TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other')),
  reference_number TEXT,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON public.expenses (project_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (expense_date) WHERE is_archived = FALSE;

-- 9. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'project', 'enquiry', 'payment', 'expense', 'settings', 'auth')),
  entity_id UUID,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- 10. QUOTATIONS & BOQ
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 1,
  parent_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Revised')),
  scope_of_work TEXT,
  payment_terms TEXT,
  terms_and_conditions TEXT,
  notes TEXT,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  pdf_sections JSONB,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS pdf_sections JSONB;

CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON public.quotations (client_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_quotations_project_id ON public.quotations (project_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations (quotation_number);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'Sq. ft.',
  rate NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (rate >= 0),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items (quotation_id);

-- 11. TEAM MEMBERS & PROJECT ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Carpenter',
  skill TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_active ON public.team_members (is_active);

CREATE TABLE IF NOT EXISTS public.project_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  role_on_project TEXT,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, team_member_id)
);

CREATE INDEX IF NOT EXISTS idx_project_team_project ON public.project_team_assignments (project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_member ON public.project_team_assignments (team_member_id);

-- 12. WORK UPDATES & PROJECT PHOTOS
CREATE TABLE IF NOT EXISTS public.project_work_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_stage TEXT NOT NULL DEFAULT 'Work in Progress',
  work_completed TEXT NOT NULL,
  progress_percentage INTEGER NOT NULL CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  work_remaining TEXT,
  client_note TEXT,
  internal_note TEXT,
  is_visible_to_client BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_updates_project_id ON public.project_work_updates (project_id);
CREATE INDEX IF NOT EXISTS idx_work_updates_date ON public.project_work_updates (update_date DESC);

CREATE OR REPLACE FUNCTION public.sync_project_progress_from_work_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_latest_progress INTEGER;
  v_latest_stage TEXT;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);

  SELECT u.progress_percentage, u.work_stage
    INTO v_latest_progress, v_latest_stage
  FROM public.project_work_updates u
  WHERE u.project_id = v_project_id
  ORDER BY u.update_date DESC, u.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.projects
    SET progress_percentage = v_latest_progress,
        current_work_stage = v_latest_stage,
        updated_at = NOW()
    WHERE id = v_project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_progress_on_work_update ON public.project_work_updates;
CREATE TRIGGER trg_sync_project_progress_on_work_update
  AFTER INSERT OR UPDATE OR DELETE ON public.project_work_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_progress_from_work_updates();

CREATE TABLE IF NOT EXISTS public.project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_update_id UUID REFERENCES public.project_work_updates(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  storage_path TEXT,
  caption TEXT,
  file_size BIGINT,
  file_type TEXT,
  is_visible_to_client BOOLEAN NOT NULL DEFAULT TRUE,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_photos_project_id ON public.project_photos (project_id);
CREATE INDEX IF NOT EXISTS idx_project_photos_work_update ON public.project_photos (work_update_id);

-- 13. ATTACH UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_business_settings ON public.business_settings;
CREATE TRIGGER set_updated_at_business_settings BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_clients ON public.clients;
CREATE TRIGGER set_updated_at_clients BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_enquiries ON public.enquiries;
CREATE TRIGGER set_updated_at_enquiries BEFORE UPDATE ON public.enquiries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_projects ON public.projects;
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_payments ON public.payments;
CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_expenses ON public.expenses;
CREATE TRIGGER set_updated_at_expenses BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_quotations ON public.quotations;
CREATE TRIGGER set_updated_at_quotations BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_quotation_items ON public.quotation_items;
CREATE TRIGGER set_updated_at_quotation_items BEFORE UPDATE ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_team_members ON public.team_members;
CREATE TRIGGER set_updated_at_team_members BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_project_work_updates ON public.project_work_updates;
CREATE TRIGGER set_updated_at_project_work_updates BEFORE UPDATE ON public.project_work_updates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 14. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_work_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read own profile" ON public.profiles;
CREATE POLICY "Owner can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND is_active = TRUE);

DROP POLICY IF EXISTS "Owner can update own profile" ON public.profiles;
CREATE POLICY "Owner can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND is_active = TRUE)
  WITH CHECK (id = auth.uid() AND role = 'owner');

DROP POLICY IF EXISTS "Owner full access to business_settings" ON public.business_settings;
CREATE POLICY "Owner full access to business_settings"
  ON public.business_settings FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to clients" ON public.clients;
CREATE POLICY "Owner full access to clients"
  ON public.clients FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to enquiries" ON public.enquiries;
CREATE POLICY "Owner full access to enquiries"
  ON public.enquiries FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to projects" ON public.projects;
CREATE POLICY "Owner full access to projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to payments" ON public.payments;
CREATE POLICY "Owner full access to payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to expenses" ON public.expenses;
CREATE POLICY "Owner full access to expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to activity_logs" ON public.activity_logs;
CREATE POLICY "Owner full access to activity_logs"
  ON public.activity_logs FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to quotations" ON public.quotations;
CREATE POLICY "Owner full access to quotations"
  ON public.quotations FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to quotation_items" ON public.quotation_items;
CREATE POLICY "Owner full access to quotation_items"
  ON public.quotation_items FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to team_members" ON public.team_members;
CREATE POLICY "Owner full access to team_members"
  ON public.team_members FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to project_team_assignments" ON public.project_team_assignments;
CREATE POLICY "Owner full access to project_team_assignments"
  ON public.project_team_assignments FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to project_work_updates" ON public.project_work_updates;
CREATE POLICY "Owner full access to project_work_updates"
  ON public.project_work_updates FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to project_photos" ON public.project_photos;
CREATE POLICY "Owner full access to project_photos"
  ON public.project_photos FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- 15. STORAGE BUCKET & STORAGE RLS POLICIES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-photos',
  'project-photos',
  TRUE,
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_view_shared_project_photo(p_storage_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_photos ph
    JOIN public.projects p ON p.id = ph.project_id
    LEFT JOIN public.project_work_updates u ON u.id = ph.work_update_id
    WHERE ph.storage_path = p_storage_path
      AND ph.is_visible_to_client = TRUE
      AND p.is_sharing_enabled = TRUE
      AND p.is_archived = FALSE
      AND (ph.work_update_id IS NULL OR u.is_visible_to_client = TRUE)
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_shared_project_photo(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "Owner full access to project-photos objects" ON storage.objects;
CREATE POLICY "Owner full access to project-photos objects"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'project-photos' AND public.is_owner())
  WITH CHECK (bucket_id = 'project-photos' AND public.is_owner());

DROP POLICY IF EXISTS "Public read approved shared project-photos objects" ON storage.objects;
CREATE POLICY "Public read approved shared project-photos objects"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'project-photos'
    AND public.can_view_shared_project_photo(name)
  );

-- 16. SECURE PUBLIC CLIENT TRACKING RPC
CREATE OR REPLACE FUNCTION public.get_public_project_tracking(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_studio JSONB;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 12 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'business_name', bs.business_name,
    'logo_url', bs.logo_url,
    'phone', bs.phone,
    'email', bs.email,
    'address', bs.address,
    'website', bs.website,
    'date_format', bs.date_format
  )
  INTO v_studio
  FROM public.business_settings bs
  ORDER BY bs.updated_at DESC
  LIMIT 1;

  SELECT jsonb_build_object(
    'project_name', p.project_name,
    'property_location', p.property_location,
    'site_address', p.site_address,
    'category', p.category,
    'status', p.status,
    'current_work_stage', COALESCE(
      (
        SELECT u_latest.work_stage
        FROM public.project_work_updates u_latest
        WHERE u_latest.project_id = p.id
          AND u_latest.is_visible_to_client = TRUE
        ORDER BY u_latest.update_date DESC, u_latest.created_at DESC
        LIMIT 1
      ),
      p.current_work_stage,
      p.status
    ),
    'progress_percentage', p.progress_percentage,
    'estimated_start_date', p.estimated_start_date,
    'expected_completion_date', p.expected_completion_date,
    'client_name', c.full_name,
    'studio', COALESCE(v_studio, '{}'::jsonb),
    'updates', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'update_date', u.update_date,
          'work_stage', u.work_stage,
          'work_completed', u.work_completed,
          'progress_percentage', u.progress_percentage,
          'work_remaining', u.work_remaining,
          'client_note', u.client_note,
          'photos', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', ph.id,
                'photo_url', ph.photo_url,
                'caption', ph.caption,
                'upload_date', ph.upload_date
              ) ORDER BY ph.upload_date DESC
            )
            FROM public.project_photos ph
            WHERE ph.work_update_id = u.id
              AND ph.is_visible_to_client = TRUE
          ), '[]'::jsonb)
        ) ORDER BY u.update_date DESC, u.created_at DESC
      )
      FROM public.project_work_updates u
      WHERE u.project_id = p.id
        AND u.is_visible_to_client = TRUE
    ), '[]'::jsonb),
    'standalone_photos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ph2.id,
          'photo_url', ph2.photo_url,
          'caption', ph2.caption,
          'upload_date', ph2.upload_date
        ) ORDER BY ph2.upload_date DESC
      )
      FROM public.project_photos ph2
      WHERE ph2.project_id = p.id
        AND ph2.work_update_id IS NULL
        AND ph2.is_visible_to_client = TRUE
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.projects p
  JOIN public.clients c ON c.id = p.client_id
  WHERE p.sharing_token = trim(p_token)
    AND p.is_sharing_enabled = TRUE
    AND p.is_archived = FALSE
    AND c.is_archived = FALSE;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_project_tracking(TEXT) TO anon, authenticated;
