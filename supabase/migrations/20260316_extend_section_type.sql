-- Migration: Extend customer_detail_edit_requests section_type to include security sections
-- Run in Supabase SQL Editor

ALTER TABLE public.customer_detail_edit_requests
  DROP CONSTRAINT IF EXISTS customer_detail_edit_requests_section_type_check;

ALTER TABLE public.customer_detail_edit_requests
  ADD CONSTRAINT customer_detail_edit_requests_section_type_check
  CHECK (
    section_type = ANY (
      ARRAY[
        'personal'::text,
        'business'::text,
        'guarantor'::text,
        'nextOfKin'::text,
        'security'::text,
        'guarantor_security'::text
      ]
    )
  );
