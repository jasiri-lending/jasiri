-- ===================================================
-- DISABLE RLS ON CLIENT-FACING TABLES
-- ===================================================
-- 
-- YOUR APPLICATION USES CUSTOM AUTHENTICATION (sessionToken)
-- NOT SUPABASE AUTH, SO auth.uid() IS ALWAYS NULL.
-- 
-- The following tables are accessed directly from the frontend
-- using the standard supabase client. RLS is being disabled 
-- to allow these operations to succeed, as access control is
-- handled at the application layer.
-- ===================================================

-- Lead Management
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_images DISABLE ROW LEVEL SECURITY;

-- Customer Management
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE guarantors DISABLE ROW LEVEL SECURITY;
ALTER TABLE next_of_kin DISABLE ROW LEVEL SECURITY;
ALTER TABLE spouse DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE security_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE guarantor_security DISABLE ROW LEVEL SECURITY;

-- Loan Management
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled for these tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN (
  'leads', 'customers', 'loans', 'guarantors', 
  'next_of_kin', 'spouse', 'documents', 
  'security_items', 'business_images', 'guarantor_security'
);
