-- Remove unique constraints on customer_id to allow one-to-many relationship
-- This allows a customer to have multiple guarantors and multiple next of kin.
-- Run this in your Supabase SQL Editor.

ALTER TABLE guarantors DROP CONSTRAINT IF EXISTS guarantors_customer_id_key;
ALTER TABLE next_of_kin DROP CONSTRAINT IF EXISTS next_of_kin_customer_id_key;
