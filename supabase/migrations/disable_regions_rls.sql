-- ===================================================
-- DISABLE RLS ON REGIONS TABLE
-- ===================================================
-- 
-- YOUR APPLICATION USES CUSTOM AUTHENTICATION (sessionToken)
-- NOT SUPABASE AUTH, SO auth.uid() IS ALWAYS NULL
-- 
-- This script disables RLS which was blocking all access to regions.
-- Your app already handles access control at the application layer.
-- ===================================================

-- Disable RLS on regions table
ALTER TABLE regions DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'regions';
