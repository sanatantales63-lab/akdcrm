-- ==============================================================================
-- AKD INTERIOR — OPTIONAL "ENCRYPTED DATA MODE"
--
-- Run this ONLY AFTER supabase/full_schema.sql, and ONLY when the CRM app encrypts
-- every business value in the browser (so Supabase stores unreadable text).
--
-- WHY: the normal schema has number/date columns and CHECK rules
--      (e.g. amount > 0, status IN ('New', ...), payment_date DATE).
--      Encrypted values are plain text like "gcm:AbC9...==", so those columns and
--      rules would REJECT every save. This script relaxes them.
--
-- WHAT STAYS READABLE (needed for the app to work): ids / foreign keys, *_code columns,
--      is_archived / is_active / is_visible_to_client flags, created_at / updated_at.
--      RLS + owner-only policies remain fully active.
--
-- NOTE: SQL cannot encrypt for you. Encryption/decryption must happen in the app
--       (e.g. AES-GCM via Web Crypto with a key that never leaves the owner's device).
--
-- Side effects:
--   * DB-level rules (amount > 0, allowed statuses, payment/client consistency,
--     auto progress sync) are removed -> the app must validate (it already does).
--   * The public client-tracking link shows whatever is stored, so values shown there
--     would be ciphertext unless the share page decrypts them.
--   * One-way: to go back to typed columns, restore from a backup / re-run full_schema.sql
--     on a fresh project.
-- ==============================================================================

DO $$
DECLARE
  r RECORD;
  data_tables TEXT[] := ARRAY[
    'business_settings', 'clients', 'enquiries', 'projects', 'payments', 'expenses',
    'activity_logs', 'quotations', 'quotation_items', 'team_members',
    'project_team_assignments', 'project_work_updates', 'project_photos',
    'team_attendance', 'materials', 'purchase_bills', 'purchase_bill_items',
    'material_transactions'
  ];
BEGIN
  -- 1. Triggers that read plain values
  DROP TRIGGER IF EXISTS trg_validate_payment_consistency ON public.payments;
  DROP TRIGGER IF EXISTS trg_sync_project_progress_on_work_update ON public.project_work_updates;

  -- 2. Drop every CHECK rule on the data tables (profiles keeps its owner-role rule)
  FOR r IN
    SELECT c.relname AS tbl, con.conname AS cname
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    WHERE con.contype = 'c'
      AND c.relnamespace = 'public'::regnamespace
      AND c.relname = ANY (data_tables)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.cname);
  END LOOP;

  -- 3. Turn number / date columns into TEXT so ciphertext fits
  FOR r IN
    SELECT table_name AS tbl, column_name AS col
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY (data_tables)
      AND data_type IN ('numeric', 'integer', 'bigint', 'smallint', 'date')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT', r.tbl, r.col);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE TEXT USING %I::text', r.tbl, r.col, r.col);
  END LOOP;
END;
$$;

-- 4. Re-allow any activity type / free text (no CHECK rules remain on data tables)
NOTIFY pgrst, 'reload schema';

-- VERIFY: no number/date columns should remain in the data tables
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('numeric', 'integer', 'bigint', 'smallint', 'date')
  AND table_name <> 'profiles'
ORDER BY table_name, column_name;
