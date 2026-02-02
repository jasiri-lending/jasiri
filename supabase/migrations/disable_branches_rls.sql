-- ===================================================
-- DISABLE RLS ON BRANCHES TABLE
-- ===================================================
-- 
-- Same issue as regions - your app uses custom auth
-- so auth.uid() is always NULL, blocking all RLS policies
-- ===================================================

-- Disable RLS on branches table
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'branches';
