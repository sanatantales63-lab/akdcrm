-- ==============================================================================
-- AKD INTERIOR (ALL KIND DECOR) — PRIVATE BUSINESS MANAGEMENT CRM
-- Migration: 001_initial_schema.sql
-- Description: Normalized PostgreSQL schema, data integrity triggers, indexes,
--              atomic RPC functions, and Owner-Only Row Level Security (RLS).
-- ==============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PROFILES (OWNER ACCESS REGISTRY)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Studio Principal',
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper security-definer function to verify authenticated Owner access in RLS
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

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 2. BUSINESS SETTINGS
-- ==============================================================================
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. CLIENTS
-- ==============================================================================
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

-- ==============================================================================
-- 4. ENQUIRIES
-- ==============================================================================
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

-- ==============================================================================
-- 5. PROJECTS
-- ==============================================================================
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
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key from enquiries.converted_project_id to projects.id
ALTER TABLE public.enquiries
  DROP CONSTRAINT IF EXISTS fk_enquiries_converted_project,
  ADD CONSTRAINT fk_enquiries_converted_project
  FOREIGN KEY (converted_project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects (client_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_projects_expected_completion ON public.projects (expected_completion_date) WHERE is_archived = FALSE;

-- ==============================================================================
-- 6. PAYMENTS
-- ==============================================================================
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

-- Enforce that payment.client_id strictly matches project.client_id
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

-- ==============================================================================
-- 7. EXPENSES
-- ==============================================================================
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

-- ==============================================================================
-- 8. ACTIVITY LOGS
-- ==============================================================================
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

-- ==============================================================================
-- 9. ATTACH UPDATED_AT TRIGGERS
-- ==============================================================================
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

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) — STRICT OWNER-ONLY ACCESS
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Owner can view and update their own profile
CREATE POLICY "Owner can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND is_active = TRUE);

CREATE POLICY "Owner can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND is_active = TRUE)
  WITH CHECK (id = auth.uid() AND role = 'owner');

-- Business Settings: Owner-only CRUD
CREATE POLICY "Owner full access to business_settings"
  ON public.business_settings FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Clients: Owner-only CRUD
CREATE POLICY "Owner full access to clients"
  ON public.clients FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Enquiries: Owner-only CRUD
CREATE POLICY "Owner full access to enquiries"
  ON public.enquiries FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Projects: Owner-only CRUD
CREATE POLICY "Owner full access to projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Payments: Owner-only CRUD
CREATE POLICY "Owner full access to payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Expenses: Owner-only CRUD
CREATE POLICY "Owner full access to expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Activity Logs: Owner-only CRUD
CREATE POLICY "Owner full access to activity_logs"
  ON public.activity_logs FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());
