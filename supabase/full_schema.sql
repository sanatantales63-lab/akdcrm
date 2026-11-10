-- ==============================================================================
-- AKD INTERIOR (ALL KIND DECOR) — PRIVATE BUSINESS MANAGEMENT CRM
-- COMPLETE MASTER SCHEMA SETUP (ONE-CLICK, IDEMPOTENT, RLS ENABLED)
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run on a FRESH project and also on top of an existing one
-- (it will only add what is missing and repair what is outdated).
--
-- Covers: clients, enquiries, projects, payments, expenses, quotations/BOQ,
--         team, work updates & photos, ATTENDANCE, MATERIALS, MATERIAL
--         TRANSACTIONS, PURCHASE BILLS, owner-only RLS, storage, public
--         client tracking RPC.
--
-- OPTIONAL (only if you add client-side encryption in the app):
--         run supabase/encrypted_mode.sql AFTER this script.
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

-- The FIRST Supabase Auth user becomes the active Studio Owner automatically.
-- Any later sign-up does NOT get access (protects your data if sign-ups are open).
-- Additional owners can be added manually (see the end of this file).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'owner' AND is_active = TRUE) THEN
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, NEW.id::text),
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'AKD Studio Principal'),
      'owner',
      TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = 'owner',
        is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Sync every user that ALREADY exists in auth.users (so RLS never locks you out)
INSERT INTO public.profiles (id, email, full_name, role, is_active)
SELECT id, COALESCE(email, id::text), COALESCE(raw_user_meta_data->>'full_name', 'AKD Studio Principal'), 'owner', TRUE
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'owner', is_active = TRUE;

-- 3. BUSINESS SETTINGS
CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL DEFAULT 'ALL KIND DECOR INTERIOR',
  authorized_signatory TEXT NOT NULL DEFAULT 'Sk Subrati Amin',
  logo_url TEXT NOT NULL DEFAULT '/logo.png',
  phone TEXT NOT NULL DEFAULT '+91 7602772338, 9332961522',
  email TEXT NOT NULL DEFAULT 'allkindsdecorinterior@gmail.com',
  address TEXT NOT NULL DEFAULT 'Inda North Vidyasagarpur, Kharagpur, Paschim Medinipur, West Bengal - 721305',
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

-- The app always reads/writes ONE settings row with this fixed id.
-- If an older random-id row exists, adopt the most recently edited one.
UPDATE public.business_settings
SET id = '00000000-0000-4000-8000-000000000001'
WHERE id = (SELECT id FROM public.business_settings ORDER BY updated_at DESC LIMIT 1)
  AND id <> '00000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_settings WHERE id = '00000000-0000-4000-8000-000000000001'
  );

DELETE FROM public.business_settings
WHERE id <> '00000000-0000-4000-8000-000000000001'
  AND EXISTS (
    SELECT 1 FROM public.business_settings WHERE id = '00000000-0000-4000-8000-000000000001'
  );

INSERT INTO public.business_settings (
  id, business_name, authorized_signatory, logo_url, phone, email, address, website,
  currency, date_format, bank_account_name, bank_name, bank_account_number,
  bank_ifsc_code, bank_branch, default_payment_terms, default_terms_and_conditions
)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'ALL KIND DECOR INTERIOR',
  'Sk Subrati Amin',
  '/logo.png',
  '+91 7602772338, 9332961522',
  'allkindsdecorinterior@gmail.com',
  'Inda North Vidyasagarpur, Kharagpur, Paschim Medinipur, West Bengal - 721305',
  'https://www.akdinterior.in/',
  'INR',
  'dd MMM yyyy',
  'Sk Subrati Amin',
  'Canara Bank',
  '110135860623',
  'CNRB0004983',
  'I floor pirbaba tower Inda OT Road',
  E'1. 50% advance with order confirmation.\n2. 30% upon mid-execution / carpentry fabrication milestone.\n3. 20% upon completion and site handover.',
  E'1. Material specifications and finishes are strictly as per the approved BOQ.\n2. Any additional civil, electrical, or custom carpentry changes requested during execution will be billed separately.\n3. This quotation is valid until the specified validity date.'
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
  client_noteslog JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  DROP CONSTRAINT IF EXISTS fk_enquiries_converted_project;
ALTER TABLE public.enquiries
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

-- 9. ACTIVITY LOGS  (entity_type list includes quotation/team/attendance/material/... —
--    the older script was missing these, which made some inserts fail)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_entity_type_check;

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_entity_type_check
  CHECK (
    entity_type IN (
      'client', 'project', 'enquiry', 'payment', 'expense', 'settings', 'auth',
      'quotation', 'team', 'work_update', 'attendance', 'material', 'purchase_bill'
    )
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
  IF TG_OP = 'DELETE' THEN
    v_project_id := OLD.project_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;

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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
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

-- 13. PROJECT-WISE TEAM ATTENDANCE
CREATE TABLE IF NOT EXISTS public.team_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Half Day')),
  in_time TEXT,
  out_time TEXT,
  working_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (working_hours >= 0 AND working_hours <= 24),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_team_attendance_member_project_date UNIQUE (team_member_id, project_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_team_attendance_project_date ON public.team_attendance (project_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_attendance_member_date ON public.team_attendance (team_member_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_attendance_date ON public.team_attendance (attendance_date DESC);

-- 14. MATERIALS & STOCK CATALOGUE
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Plywood & Boards',
  unit TEXT NOT NULL DEFAULT 'Sheet',
  available_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (available_quantity >= 0),
  purchase_rate NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_rate >= 0),
  supplier TEXT,
  low_stock_level NUMERIC(12, 2) NOT NULL DEFAULT 5.00 CHECK (low_stock_level >= 0),
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_item_name ON public.materials (LOWER(item_name)) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials (category) WHERE is_archived = FALSE;

-- Optional link from BOQ line items to the materials catalogue (never deducts stock)
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL;

-- 15. PURCHASE BILLS & ITEMS
--     (columns invoice_reference / subtotal / tax_amount / description are used by the
--      app but were missing in the older scripts; bill_code is no longer required)
CREATE TABLE IF NOT EXISTS public.purchase_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_code TEXT UNIQUE DEFAULT ('PB-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  bill_number TEXT NOT NULL,
  invoice_reference TEXT,
  supplier_name TEXT NOT NULL,
  supplier_phone TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer' CHECK (payment_method IN ('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other')),
  payment_status TEXT NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Pending', 'Partial')),
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  linked_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repair path: purchase_bills created earlier by migration 004 / older full_schema
ALTER TABLE public.purchase_bills
  ADD COLUMN IF NOT EXISTS invoice_reference TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.purchase_bills
  ALTER COLUMN bill_code DROP NOT NULL,
  ALTER COLUMN bill_code SET DEFAULT ('PB-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

CREATE INDEX IF NOT EXISTS idx_purchase_bills_project_id ON public.purchase_bills (project_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_bills_date ON public.purchase_bills (bill_date DESC) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_purchase_bills_supplier ON public.purchase_bills (LOWER(supplier_name)) WHERE is_archived = FALSE;

CREATE TABLE IF NOT EXISTS public.purchase_bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_bill_id UUID NOT NULL REFERENCES public.purchase_bills(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'Piece',
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
  rate NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (rate >= 0),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
  update_stock BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.purchase_bill_items
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_bill_id ON public.purchase_bill_items (purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_material_id ON public.purchase_bill_items (material_id);

-- 16. MATERIAL TRANSACTIONS (purchase / project usage / adjustment)
CREATE TABLE IF NOT EXISTS public.material_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  purchase_bill_id UUID REFERENCES public.purchase_bills(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'adjustment')),
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit_rate NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (unit_rate >= 0),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  supplier TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_transactions_material_id ON public.material_transactions (material_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_transactions_project_id ON public.material_transactions (project_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_transactions_bill_id ON public.material_transactions (purchase_bill_id);

-- 17. ATTACH UPDATED_AT TRIGGERS
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

DROP TRIGGER IF EXISTS set_updated_at_team_attendance ON public.team_attendance;
CREATE TRIGGER set_updated_at_team_attendance BEFORE UPDATE ON public.team_attendance FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_materials ON public.materials;
CREATE TRIGGER set_updated_at_materials BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_purchase_bills ON public.purchase_bills;
CREATE TRIGGER set_updated_at_purchase_bills BEFORE UPDATE ON public.purchase_bills FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_material_transactions ON public.material_transactions;
CREATE TRIGGER set_updated_at_material_transactions BEFORE UPDATE ON public.material_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 18. TABLE PRIVILEGES (RLS decides WHICH rows; GRANT decides WHETHER the role may try)
--     anon (not logged in) gets NO direct table access. Only the logged-in owner does.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- 19. ROW LEVEL SECURITY (RLS) — STRICT OWNER-ONLY ACCESS
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
ALTER TABLE public.team_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_transactions ENABLE ROW LEVEL SECURITY;

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
  WITH CHECK (id = auth.uid() AND role = 'owner' AND is_active = TRUE);

-- One owner-only "FULL ACCESS" policy per data table (SELECT / INSERT / UPDATE / DELETE)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'business_settings', 'clients', 'enquiries', 'projects', 'payments', 'expenses',
    'activity_logs', 'quotations', 'quotation_items', 'team_members',
    'project_team_assignments', 'project_work_updates', 'project_photos',
    'team_attendance', 'materials', 'purchase_bills', 'purchase_bill_items',
    'material_transactions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Owner full access to ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner())',
      'Owner full access to ' || t, t
    );
  END LOOP;
END;
$$;

-- 20. STORAGE BUCKET & STORAGE RLS POLICIES
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

-- 21. SECURE PUBLIC CLIENT TRACKING RPC
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

-- 22. REFRESH THE API SCHEMA CACHE
--     (without this, new tables/columns can answer "schema cache" errors and the app
--      silently falls back to browser-only storage)
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 23. VERIFY (the result grid below should show rls_enabled = true for every table)
-- ==============================================================================
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       (SELECT COUNT(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- ------------------------------------------------------------------------------
-- OPTIONAL HELPERS (run separately when needed)
--
-- A) Which login is the owner?  (every row must have a profile with is_active = true)
--    SELECT u.email, p.role, p.is_active
--    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id;
--
-- B) Make a specific login an owner manually:
--    INSERT INTO public.profiles (id, email, full_name, role, is_active)
--    SELECT id, email, 'AKD Studio Principal', 'owner', TRUE
--    FROM auth.users WHERE email = 'YOUR-LOGIN-EMAIL'
--    ON CONFLICT (id) DO UPDATE SET role = 'owner', is_active = TRUE;
--
-- C) Also switch OFF "Allow new users to sign up" in
--    Supabase Dashboard -> Authentication -> Sign In / Providers.
-- ------------------------------------------------------------------------------
