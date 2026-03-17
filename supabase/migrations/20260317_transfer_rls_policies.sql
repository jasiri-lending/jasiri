-- ============================================================
-- RLS POLICIES FOR CUSTOMER TRANSFER TABLES
-- ============================================================
-- WHY THIS WORKS:
--   This app stores tenant_id on public.users (NOT public.profiles).
--   public.profiles only has: branch_id, region_id, avatar_url.
--   So we must look up tenant_id from public.users WHERE id = auth.uid().
--   Using public.profiles would always return NULL → every insert fails.
-- ============================================================

-- 1. customer_transfer_requests
ALTER TABLE public.customer_transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users by tenant_id" ON public.customer_transfer_requests;
CREATE POLICY "Enable all access for authenticated users by tenant_id"
ON public.customer_transfer_requests
FOR ALL
TO authenticated
USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 2. customer_transfer_items
ALTER TABLE public.customer_transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users by tenant_id" ON public.customer_transfer_items;
CREATE POLICY "Enable all access for authenticated users by tenant_id"
ON public.customer_transfer_items
FOR ALL
TO authenticated
USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- 3. transfer_workflow_logs
ALTER TABLE public.transfer_workflow_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users by tenant_id" ON public.transfer_workflow_logs;
CREATE POLICY "Enable all access for authenticated users by tenant_id"
ON public.transfer_workflow_logs
FOR ALL
TO authenticated
USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
