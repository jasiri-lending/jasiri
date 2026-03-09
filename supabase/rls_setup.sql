-- 🔒 Database Security: Row Level Security (RLS) & Multi-Tenant Isolation

-- 1️⃣ Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- Add more tables as needed

-- 2️⃣ Helper Function to get tenant_id from JWT
CREATE OR REPLACE FUNCTION auth.get_tenant_id()
RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$ LANGUAGE sql STABLE;

-- 3️⃣ Tenant Isolation Policies

-- 🏢 tenants table: Users can only see their own tenant
CREATE POLICY "Users can view their own tenant"
ON tenants
FOR SELECT
USING (id = auth.get_tenant_id());

-- 👤 users table: Users can view others only in the same tenant
CREATE POLICY "Users can view users in same tenant"
ON users
FOR SELECT
USING (tenant_id = auth.get_tenant_id());

CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE
USING (auth.uid() = id);

-- 📋 profiles table: Isolation by tenant
CREATE POLICY "Tenant isolation for profiles"
ON profiles
FOR ALL
USING (EXISTS (
  SELECT 1 FROM users WHERE users.id = profiles.id AND users.tenant_id = auth.get_tenant_id()
));

-- 🏦 branches table: Isolation by tenant
CREATE POLICY "Tenant isolation for branches"
ON branches
FOR ALL
USING (tenant_id = auth.get_tenant_id());

-- 👥 customers table: Isolation by tenant
CREATE POLICY "Tenant isolation for customers"
ON customers
FOR ALL
USING (tenant_id = auth.get_tenant_id());

-- 4️⃣ Service Role access (Bypass RLS for backend admin tasks)
-- The service_role key ignores RLS by default, so no extra policy needed for it.
