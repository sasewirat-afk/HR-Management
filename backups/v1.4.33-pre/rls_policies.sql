-- ============================================================
-- Day 4: H1 Supabase RLS Lockdown (v1.4.33)
-- Target: hr_data table (single key-value store)
-- Strategy: Option C — Ship in 1 day, block worst-case attacks
-- ============================================================
--
-- Threat model addressed:
-- ✅ Mass DELETE via leaked anon key (biggest risk)
-- ✅ Schema-level tampering
-- ⚠️  READ access still open (defense-in-depth via Day 1 hashing helps)
-- ⚠️  UPDATE of any key still allowed (full auth needed for row-level lock)
--
-- ============================================================

-- Step 1: Check current state (run first, save output)
SELECT rowsecurity FROM pg_tables WHERE tablename = 'hr_data';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'hr_data';

-- Step 2: Enable RLS on hr_data table
ALTER TABLE hr_data ENABLE ROW LEVEL SECURITY;

-- Step 3: Create SELECT policy (allow anon to read)
-- App reads all keys constantly — must allow
CREATE POLICY "hr_data_select_anon"
ON hr_data FOR SELECT
TO anon
USING (true);

-- Step 4: Create INSERT policy (allow anon to create new keys)
-- App upserts new keys as data grows
CREATE POLICY "hr_data_insert_anon"
ON hr_data FOR INSERT
TO anon
WITH CHECK (
  -- Prevent junk data — key must be non-empty and reasonable length
  length(key) BETWEEN 1 AND 100
  -- Prevent value bloat — max 50MB per key (jsonb size)
  AND octet_length(value::text) < 52428800
);

-- Step 5: Create UPDATE policy (allow anon to update existing keys)
-- This is upsert-conflict path — app updates keys with latest data
CREATE POLICY "hr_data_update_anon"
ON hr_data FOR UPDATE
TO anon
USING (true)  -- can update any row
WITH CHECK (
  length(key) BETWEEN 1 AND 100
  AND octet_length(value::text) < 52428800
);

-- Step 6: NO DELETE POLICY — this blocks anon from DELETE entirely
-- ============================================================
-- 🛑 Attacker with leaked anon key CANNOT run:
--    DELETE FROM hr_data WHERE key = 'employees';  (blocked)
--    DELETE FROM hr_data;                          (blocked)
-- ============================================================

-- Step 7: Verify policies created
SELECT policyname, cmd, roles::text, qual, with_check
FROM pg_policies
WHERE tablename = 'hr_data'
ORDER BY cmd;

-- Expected output: 3 rows (SELECT, INSERT, UPDATE) — no DELETE row
-- ============================================================

-- ROLLBACK PROCEDURE (if RLS breaks app)
-- ============================================================
-- If app is broken after applying policies, run this to disable RLS:
--
-- ALTER TABLE hr_data DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "hr_data_select_anon" ON hr_data;
-- DROP POLICY IF EXISTS "hr_data_insert_anon" ON hr_data;
-- DROP POLICY IF EXISTS "hr_data_update_anon" ON hr_data;
--
-- Then re-deploy v1.4.32 to Vercel (previous version)
-- ============================================================
