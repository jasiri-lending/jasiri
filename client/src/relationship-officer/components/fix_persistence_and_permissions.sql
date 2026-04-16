-- ============================================================
-- CRITICAL FIX: Drop unique constraints & enable RLS policies
-- Run ALL of this in your Supabase SQL Editor at once
-- ============================================================

-- ============================================================
-- STEP 1: DROP THE UNIQUE CONSTRAINTS CAUSING 409 ERRORS
-- ============================================================

-- guarantors: was only allowing ONE guarantor per customer
ALTER TABLE public.guarantors DROP CONSTRAINT IF EXISTS guarantors_customer_id_unique;
ALTER TABLE public.guarantors DROP CONSTRAINT IF EXISTS guarantors_customer_id_key;

-- next_of_kin: same problem
ALTER TABLE public.next_of_kin DROP CONSTRAINT IF EXISTS next_of_kin_customer_id_key;
ALTER TABLE public.next_of_kin DROP CONSTRAINT IF EXISTS next_of_kin_customer_id_unique;

-- ============================================================
-- STEP 2: FIX id_number COLUMN TYPE IN GUARANTORS
-- (Was INTEGER, frontend sends text like "12345678")
-- ============================================================
ALTER TABLE public.guarantors ALTER COLUMN id_number TYPE TEXT USING id_number::TEXT;

-- ============================================================
-- STEP 3: ENABLE RLS & ADD PERMISSIVE POLICIES
-- Resolves 403 Forbidden errors for all related tables
-- ============================================================

-- spouse
ALTER TABLE public.spouse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on spouse" ON public.spouse;
CREATE POLICY "Allow authenticated CRUD on spouse"
ON public.spouse FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- guarantors
ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on guarantors" ON public.guarantors;
CREATE POLICY "Allow authenticated CRUD on guarantors"
ON public.guarantors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- next_of_kin
ALTER TABLE public.next_of_kin ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on next_of_kin" ON public.next_of_kin;
CREATE POLICY "Allow authenticated CRUD on next_of_kin"
ON public.next_of_kin FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- guarantor_security
ALTER TABLE public.guarantor_security ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on guarantor_security" ON public.guarantor_security;
CREATE POLICY "Allow authenticated CRUD on guarantor_security"
ON public.guarantor_security FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- guarantor_security_images
ALTER TABLE public.guarantor_security_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on guarantor_security_images" ON public.guarantor_security_images;
CREATE POLICY "Allow authenticated CRUD on guarantor_security_images"
ON public.guarantor_security_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- security_items (borrower security)
ALTER TABLE public.security_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on security_items" ON public.security_items;
CREATE POLICY "Allow authenticated CRUD on security_items"
ON public.security_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- security_item_images
ALTER TABLE public.security_item_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on security_item_images" ON public.security_item_images;
CREATE POLICY "Allow authenticated CRUD on security_item_images"
ON public.security_item_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on documents" ON public.documents;
CREATE POLICY "Allow authenticated CRUD on documents"
ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- business_images
ALTER TABLE public.business_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated CRUD on business_images" ON public.business_images;
CREATE POLICY "Allow authenticated CRUD on business_images"
ON public.business_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- STEP 4: VERIFY (run this after to confirm constraints are gone)
-- ============================================================
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'guarantors'::regclass;
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'next_of_kin'::regclass;
