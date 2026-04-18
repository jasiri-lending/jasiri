-- ============================================================
-- REFACTOR UNIQUENESS CONSTRAINTS FOR MULTI-TENANCY
-- ============================================================
-- This script removes global uniqueness on ID/Mobile and 
-- replaces it with tenant-scoped uniqueness.
-- ============================================================

-- 1. DROP GLOBAL CONSTRAINTS ON CUSTOMERS
-- We drop these so that Tenant B can add a customer that Tenant A already has.
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_id_number_key;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_mobile_key;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_id_number_unique;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_mobile_unique;

-- 2. ADD COMPOSITE CONSTRAINTS ON CUSTOMERS
-- This ensures that WITHIN A TENANT, ID and Mobile remain unique.
ALTER TABLE public.customers 
ADD CONSTRAINT customers_tenant_id_number_unique UNIQUE (tenant_id, id_number);

ALTER TABLE public.customers 
ADD CONSTRAINT customers_tenant_mobile_unique UNIQUE (tenant_id, mobile);

-- 3. DROP GLOBAL CONSTRAINTS ON GUARANTORS
-- This allows one person to be a guarantor for multiple customers/loans.
ALTER TABLE public.guarantors DROP CONSTRAINT IF EXISTS guarantors_id_number_key;
ALTER TABLE public.guarantors DROP CONSTRAINT IF EXISTS guarantors_mobile_key;
ALTER TABLE public.guarantors DROP CONSTRAINT IF EXISTS guarantors_id_number_unique;
ALTER TABLE public.guarantors DROP CONSTRAINT IF EXISTS guarantors_mobile_unique;

-- 4. DROP GLOBAL CONSTRAINTS ON NEXT OF KIN
ALTER TABLE public.next_of_kin DROP CONSTRAINT IF EXISTS next_of_kin_id_number_key;
ALTER TABLE public.next_of_kin DROP CONSTRAINT IF EXISTS next_of_kin_mobile_key;
ALTER TABLE public.next_of_kin DROP CONSTRAINT IF EXISTS next_of_kin_id_number_unique;
ALTER TABLE public.next_of_kin DROP CONSTRAINT IF EXISTS next_of_kin_mobile_unique;

-- 5. VERIFICATION (Optional)
-- Check current constraints to ensure they are set correctly
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'customers'::regclass;
