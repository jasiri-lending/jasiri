-- 1. Drop the legacy check constraint that required paybill/till for all rows
ALTER TABLE tenant_mpesa_config 
DROP CONSTRAINT IF EXISTS paybill_or_till_check;

-- 2. Add the improved check constraint that supports B2C (Shortcode) and C2B (Paybill/Till)
ALTER TABLE tenant_mpesa_config
ADD CONSTRAINT payment_identifier_check 
CHECK (
  (service_type = 'c2b' AND (paybill_number IS NOT NULL OR till_number IS NOT NULL))
  OR
  (service_type = 'b2c' AND shortcode IS NOT NULL)
);

-- 3. Drop the old unique index if it exists
DROP INDEX IF EXISTS unique_active_tenant_service;
DROP INDEX IF EXISTS unique_tenant_service;

-- 4. Create the final unique index to ensure one C2B and one B2C per tenant
CREATE UNIQUE INDEX unique_tenant_service 
ON public.tenant_mpesa_config USING btree (tenant_id, service_type);

-- 5. Create SMS Settings table as per user request
CREATE TABLE IF NOT EXISTS public.tenant_sms_settings (
  tenant_id uuid NOT NULL,
  base_url text NOT NULL,
  api_key text NOT NULL,
  partner_id text NOT NULL,
  shortcode text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT tenant_sms_settings_pkey PRIMARY KEY (tenant_id),
  CONSTRAINT tenant_sms_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants (id)
) TABLESPACE pg_default;

-- 6. RPC: Find disbursement transaction by conversation IDs
-- Used by the Edge Function to bypass PostgREST schema cache issues with
-- conversation_id / originator_conversation_id filter columns.
CREATE OR REPLACE FUNCTION public.find_disbursement_by_conversation(
  p_conv_id text,
  p_orig_id text
)
RETURNS TABLE (
  id bigint,
  tenant_id uuid,
  customer_id bigint,
  amount numeric,
  loan_id bigint,
  status text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    id,
    tenant_id,
    customer_id,
    amount,
    loan_id,
    status
  FROM public.loan_disbursement_transactions
  WHERE conversation_id = p_conv_id
     OR originator_conversation_id = p_orig_id
  LIMIT 1;
$$;

-- 7. Refresh PostgREST schema cache so conversation_id columns are visible to filters
NOTIFY pgrst, 'reload schema';
