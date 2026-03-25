-- Add unique index for C2B and B2C separation
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_tenant_service 
ON tenant_mpesa_config (tenant_id, service_type) 
WHERE is_active = true;
