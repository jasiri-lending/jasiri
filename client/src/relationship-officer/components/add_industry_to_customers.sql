-- Add industry and business_type columns to the customers table
-- Run this in your Supabase SQL Editor
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_type TEXT;
