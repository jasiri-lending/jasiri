-- Drop the overly restrictive constraint
ALTER TABLE tenant_mpesa_config
DROP CONSTRAINT IF EXISTS paybill_or_till_check;

-- Add a new conditional constraint:
-- If C2B, require paybill OR till.
-- If B2C, require shortcode.
ALTER TABLE tenant_mpesa_config
ADD CONSTRAINT payment_identifier_check 
CHECK (
  (service_type = 'c2b' AND (paybill_number IS NOT NULL OR till_number IS NOT NULL))
  OR
  (service_type = 'b2c' AND shortcode IS NOT NULL)
  OR 
  (service_type IS NULL) -- Default fallback if any
);
