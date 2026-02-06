-- Create loan_products table
create table if not exists loan_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,

  product_name text not null,
  product_code text,      -- Made nullable as it's not populated by current app logic

  min_amount numeric(12,2) not null,
  max_amount numeric(12,2),

  created_at timestamp default now(),

  unique(tenant_id, product_name)
);

-- Create loan_product_types table
create table if not exists loan_product_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  loan_product_id uuid references loan_products(id) on delete cascade,

  product_type text not null,
  duration_weeks int not null,

  interest_rate numeric(5,2) not null,
  processing_fee_rate numeric(5,2) default 0,
  registration_fee numeric(5,2) default 0,
  penalty_rate numeric(5,2) default 0,

  created_at timestamp default now(),

  unique(loan_product_id, duration_weeks)
);

-- Enable RLS (Row Level Security) - Optional but recommended
alter table loan_products enable row level security;
alter table loan_product_types enable row level security;

-- Add policies if needed (e.g., allow all for now based on other migrations seen)
create policy "Enable all access for now" on loan_products for all using (true);
create policy "Enable all access for now" on loan_product_types for all using (true);
