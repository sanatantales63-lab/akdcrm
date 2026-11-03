-- ==============================================================================
-- AKD INTERIOR (ALL KIND DECOR) — PRIVATE BUSINESS MANAGEMENT CRM
-- Migration: 003_refinements_and_storage_security.sql
-- Description: Backward-compatible schema refinements for Quotation PDF options,
--              Business Bank & Signature settings, Automatic Project Progress
--              Synchronization, Storage Bucket policies, and Hardened Public
--              Client Tracking RPC.
-- ==============================================================================

-- 1. EXTEND BUSINESS SETTINGS WITH BANK DETAILS, SIGNATURE & QUOTATION DEFAULTS
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

-- 2. EXTEND QUOTATIONS WITH DEDICATED PAYMENT TERMS & PDF SECTION OVERRIDES
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS pdf_sections JSONB;

-- 3. AUTOMATIC SYNCHRONIZATION OF PROJECT PROGRESS FROM WORK UPDATES
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

-- 4. SUPABASE STORAGE BUCKET & NARROW ROW-LEVEL SECURITY FOR PROJECT PHOTOS
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

-- Helper function verifying that a storage object belongs to an active shared project
-- and is explicitly marked visible to the client (along with its parent work update).
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

-- 5. HARDENED PUBLIC CLIENT TRACKING RPC
-- Returns only approved project details, public studio branding/contact info,
-- and client-visible updates/photos for an active, unarchived project & client.
-- Never exposes internal notes, team phone numbers, financials, or bank details.
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
