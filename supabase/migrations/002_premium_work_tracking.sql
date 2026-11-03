-- ==============================================================================
-- AKD INTERIOR (ALL KIND DECOR) — PRIVATE BUSINESS MANAGEMENT CRM
-- Migration: 002_premium_work_tracking.sql
-- Description: Quotations & BOQ, Team Management & Assignments, Work Updates,
--              Project Photographs, and Secure Client Tracking Portal.
-- ==============================================================================

-- 1. EXTEND PROJECTS TABLE WITH SECURE CLIENT SHARING & WORK STAGE
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sharing_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sharing_token_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_work_stage TEXT DEFAULT 'Planning';

CREATE INDEX IF NOT EXISTS idx_projects_sharing_token
  ON public.projects (sharing_token)
  WHERE is_sharing_enabled = TRUE;

-- ==============================================================================
-- 2. QUOTATIONS & BOQ
-- ==============================================================================
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
  terms_and_conditions TEXT,
  notes TEXT,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
  tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON public.quotations (client_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_quotations_project_id ON public.quotations (project_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations (quotation_number);

-- Quotation Line Items (BOQ)
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

-- ==============================================================================
-- 3. TEAM DIRECTORY & PROJECT ASSIGNMENTS
-- ==============================================================================
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

-- ==============================================================================
-- 4. PROJECT WORK UPDATES & TIMELINE
-- ==============================================================================
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

-- ==============================================================================
-- 5. PROJECT PHOTOGRAPHS & GALLERIES
-- ==============================================================================
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

-- ==============================================================================
-- 6. ATTACH UPDATED_AT TRIGGERS
-- ==============================================================================
DROP TRIGGER IF EXISTS set_updated_at_quotations ON public.quotations;
CREATE TRIGGER set_updated_at_quotations BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_quotation_items ON public.quotation_items;
CREATE TRIGGER set_updated_at_quotation_items BEFORE UPDATE ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_team_members ON public.team_members;
CREATE TRIGGER set_updated_at_team_members BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_project_work_updates ON public.project_work_updates;
CREATE TRIGGER set_updated_at_project_work_updates BEFORE UPDATE ON public.project_work_updates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) — OWNER-ONLY PRIVILEGES
-- ==============================================================================
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_work_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access to quotations"
  ON public.quotations FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner full access to quotation_items"
  ON public.quotation_items FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner full access to team_members"
  ON public.team_members FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner full access to project_team_assignments"
  ON public.project_team_assignments FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner full access to project_work_updates"
  ON public.project_work_updates FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner full access to project_photos"
  ON public.project_photos FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- ==============================================================================
-- 8. SECURE PUBLIC CLIENT TRACKING RPC (SECURITY DEFINER)
-- Strictly returns client-approved progress and photographs. Internal notes,
-- phone numbers of team members, financial figures, and other client records
-- are NEVER exposed.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_public_project_tracking(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'project_name', p.project_name,
    'property_location', p.property_location,
    'site_address', p.site_address,
    'status', p.status,
    'current_work_stage', COALESCE(p.current_work_stage, p.status),
    'progress_percentage', p.progress_percentage,
    'estimated_start_date', p.estimated_start_date,
    'expected_completion_date', p.expected_completion_date,
    'client_name', c.full_name,
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
  WHERE p.sharing_token = p_token
    AND p.is_sharing_enabled = TRUE
    AND p.is_archived = FALSE;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_project_tracking(TEXT) TO anon, authenticated;
