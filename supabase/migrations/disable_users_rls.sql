-- ===================================================
-- DISABLE RLS ON USERS TABLE
-- ===================================================
-- 
-- Same issue as regions and branches - your app uses custom auth
-- so auth.uid() is always NULL, blocking all RLS policies
-- ===================================================

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';
