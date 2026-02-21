-- Add processing_fee_mode to loan_product_types
alter table loan_product_types 
add column if not exists processing_fee_mode text not null default 'percentage' 
check (processing_fee_mode in ('percentage', 'fixed'));

-- Comment on column for clarity
comment on column loan_product_types.processing_fee_mode is 'Determines if processing_fee_rate is a percentage or a fixed amount';
