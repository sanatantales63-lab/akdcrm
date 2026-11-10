-- ==============================================================================
-- AKD INTERIOR (ALL KIND DECOR) — PRIVATE BUSINESS MANAGEMENT CRM
-- Migration: 004_attendance_materials_and_purchase_bills.sql
-- Description: Project-wise Team Attendance, Interior Materials & Stock
--              Catalogue, Material Transactions (Stock Purchases & Project
--              Material Usage), Purchase Bills & Line Items, Optional Quotation
--              Catalogue Item Reference, and Owner-Only Row Level Security.
-- ==============================================================================

-- 1. EXTEND ACTIVITY LOGS ENTITY TYPES (BACKWARD-COMPATIBLE)
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_entity_type_check;

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_entity_type_check
  CHECK (
    entity_type IN (
      'client',
      'project',
      'enquiry',
      'payment',
      'expense',
      'settings',
      'auth',
      'quotation',
      'team',
      'work_update',
      'attendance',
      'material',
      'purchase_bill'
    )
  );

-- ==============================================================================
-- 2. PROJECT-WISE TEAM ATTENDANCE
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_team_attendance_project_date
  ON public.team_attendance (project_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_team_attendance_member_date
  ON public.team_attendance (team_member_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_team_attendance_date
  ON public.team_attendance (attendance_date DESC);

-- ==============================================================================
-- 3. INTERIOR MATERIALS & STOCK CATALOGUE
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_materials_item_name
  ON public.materials (LOWER(item_name)) WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_materials_category
  ON public.materials (category) WHERE is_archived = FALSE;

-- Optional reference from quotation_items to materials catalogue (never deducts stock)
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL;

-- ==============================================================================
-- 4. PURCHASE BILLS & PURCHASE BILL ITEMS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_code TEXT UNIQUE NOT NULL,
  bill_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_phone TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer' CHECK (payment_method IN ('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other')),
  payment_status TEXT NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Pending', 'Partial')),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  linked_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_bills_project_id
  ON public.purchase_bills (project_id) WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_purchase_bills_date
  ON public.purchase_bills (bill_date DESC) WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_purchase_bills_supplier
  ON public.purchase_bills (LOWER(supplier_name)) WHERE is_archived = FALSE;

CREATE TABLE IF NOT EXISTS public.purchase_bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_bill_id UUID NOT NULL REFERENCES public.purchase_bills(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Piece',
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
  rate NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (rate >= 0),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
  update_stock BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_bill_id
  ON public.purchase_bill_items (purchase_bill_id);

CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_material_id
  ON public.purchase_bill_items (material_id);

-- ==============================================================================
-- 5. MATERIAL TRANSACTIONS (STOCK PURCHASES, PROJECT USAGE & ADJUSTMENTS)
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_material_transactions_material_id
  ON public.material_transactions (material_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_material_transactions_project_id
  ON public.material_transactions (project_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_material_transactions_bill_id
  ON public.material_transactions (purchase_bill_id);

-- ==============================================================================
-- 6. UPDATED_AT TRIGGERS
-- ==============================================================================
DROP TRIGGER IF EXISTS set_updated_at_team_attendance ON public.team_attendance;
CREATE TRIGGER set_updated_at_team_attendance
  BEFORE UPDATE ON public.team_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_materials ON public.materials;
CREATE TRIGGER set_updated_at_materials
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_purchase_bills ON public.purchase_bills;
CREATE TRIGGER set_updated_at_purchase_bills
  BEFORE UPDATE ON public.purchase_bills
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_material_transactions ON public.material_transactions;
CREATE TRIGGER set_updated_at_material_transactions
  BEFORE UPDATE ON public.material_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) — STRICT OWNER-ONLY ACCESS
-- ==============================================================================
ALTER TABLE public.team_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full access to team_attendance" ON public.team_attendance;
CREATE POLICY "Owner full access to team_attendance"
  ON public.team_attendance FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to materials" ON public.materials;
CREATE POLICY "Owner full access to materials"
  ON public.materials FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to purchase_bills" ON public.purchase_bills;
CREATE POLICY "Owner full access to purchase_bills"
  ON public.purchase_bills FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to purchase_bill_items" ON public.purchase_bill_items;
CREATE POLICY "Owner full access to purchase_bill_items"
  ON public.purchase_bill_items FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Owner full access to material_transactions" ON public.material_transactions;
CREATE POLICY "Owner full access to material_transactions"
  ON public.material_transactions FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());
