-- Migration for tenant_mpesa_config table
create table public.tenant_mpesa_config (
  id uuid not null default gen_random_uuid (),
  tenant_id uuid not null,
  paybill_number text null,
  till_number text null,
  consumer_key text null,
  consumer_secret text null,
  passkey text null,
  shortcode text null,
  confirmation_url text null,
  validation_url text null,
  callback_url text null,
  created_at timestamp without time zone null default now(),
  environment text not null default 'sandbox'::text,
  is_active boolean not null default true,
  service_type text not null default 'c2b'::text,
  initiator_name text null,
  initiator_password text null,
  security_credential text null,
  constraint tenant_mpesa_config_pkey primary key (id),
  constraint tenant_mpesa_config_tenant_id_fkey foreign KEY (tenant_id) references tenants (id),
  constraint payment_identifier_check check (
    (
      (
        (service_type = 'c2b'::text)
        and (
          (paybill_number is not null)
          or (till_number is not null)
        )
      )
      or (
        (service_type = 'b2c'::text)
        and (shortcode is not null)
      )
    )
  ),
  constraint tenant_mpesa_env_check check (
    (
      environment = any (array['sandbox'::text, 'production'::text])
    )
  ),
  constraint tenant_mpesa_service_type_check check (
    (
      service_type = any (array['c2b'::text, 'b2c'::text])
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists unique_tenant_service on public.tenant_mpesa_config using btree (tenant_id, service_type) TABLESPACE pg_default;
