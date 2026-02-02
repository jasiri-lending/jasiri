-- ===================================================
-- FIX REGIONS RLS POLICIES
-- ===================================================
-- This script enables RLS and creates policies for the regions table
-- Run this in your Supabase SQL Editor

-- Enable RLS on regions table
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Regions are viewable by users of the same tenant" ON regions;
DROP POLICY IF EXISTS "Regions can be created by admins" ON regions;
DROP POLICY IF EXISTS "Regions can be updated by admins" ON regions;
DROP POLICY IF EXISTS "Regions can be deleted by admins" ON regions;

-- Policy 1: Allow users to view regions of their tenant
CREATE POLICY "Regions are viewable by users of the same tenant"
ON regions FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
);

-- Policy 2: Allow admins and superadmins to insert regions
CREATE POLICY "Regions can be created by admins"
ON regions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
    AND (
      role = 'superadmin' 
      OR tenant_id = regions.tenant_id
    )
  )
);

-- Policy 3: Allow admins and superadmins to update regions
CREATE POLICY "Regions can be updated by admins"
ON regions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
    AND (
      role = 'superadmin' 
      OR tenant_id = regions.tenant_id
    )
  )
);

-- Policy 4: Allow admins and superadmins to delete regions
CREATE POLICY "Regions can be deleted by admins"
ON regions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
    AND (
      role = 'superadmin' 
      OR tenant_id = regions.tenant_id
    )
  )
);

