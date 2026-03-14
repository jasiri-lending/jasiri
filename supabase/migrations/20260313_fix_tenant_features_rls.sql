-- Migration to fix RLS policies for tenant_features table
-- Date: 2026-03-13

-- 1. Enable RLS
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure a clean state
DROP POLICY IF EXISTS "Superadmin can manage all tenant features" ON public.tenant_features;
DROP POLICY IF EXISTS "Tenants can view their own features" ON public.tenant_features;
DROP POLICY IF EXISTS "Admin can manage own tenant features" ON public.tenant_features;

-- 3. Policy: Superadmin can do everything
-- This checks the 'role' column in the public.users table for the current authenticated user
CREATE POLICY "Superadmin can manage all tenant features" 
ON public.tenant_features
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'superadmin'
  )
);

-- 4. Policy: Users can view their own tenant's features
CREATE POLICY "Tenants can view their own features" 
ON public.tenant_features
FOR SELECT 
TO authenticated 
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

-- 5. Policy: Admin can also manage their own tenant features (if needed)
CREATE POLICY "Admin can manage own tenant features" 
ON public.tenant_features
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND tenant_id = public.tenant_features.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND tenant_id = public.tenant_features.tenant_id
  )
);
