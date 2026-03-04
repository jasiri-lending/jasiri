-- Migration to add company_phone column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_phone TEXT;
