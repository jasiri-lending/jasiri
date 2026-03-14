-- Migration to add image_upload_enabled column to tenant_features table
-- Date: 2026-03-13

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tenant_features' 
        AND column_name = 'image_upload_enabled'
    ) THEN
        ALTER TABLE public.tenant_features 
        ADD COLUMN image_upload_enabled BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
