import { supabaseAdmin } from './server/supabaseClient.js';

async function runTest() {
  console.log('Testing C2B and B2C separation...');

  // 1. Get a test tenant id
  const { data: tenant } = await supabaseAdmin.from('tenants').select('id').limit(1).single();
  
  if (!tenant) {
    console.log('No tenants found to test with.');
    process.exit(0);
  }

  const tenantId = tenant.id;
  console.log(`Using tenant ID: ${tenantId}`);

  // 2. Insert C2B config
  console.log('Inserting C2B Config...');
  const { error: c2bErr } = await supabaseAdmin.from('tenant_mpesa_config').upsert({
    tenant_id: tenantId,
    service_type: 'c2b',
    paybill_number: '123456',
    consumer_key: 'c2b_key',
    consumer_secret: 'c2b_sec',
    passkey: 'c2b_pass',
    is_active: true
  }, { onConflict: 'tenant_id, service_type' });

  if (c2bErr) {
    console.error('Failed to insert C2B config:', c2bErr);
    process.exit(1);
  }

  // 3. Insert B2C config
  console.log('Inserting B2C Config...');
  const { error: b2cErr } = await supabaseAdmin.from('tenant_mpesa_config').upsert({
    tenant_id: tenantId,
    service_type: 'b2c',
    shortcode: '654321',
    consumer_key: 'b2c_key',
    consumer_secret: 'b2c_sec',
    initiator_name: 'test_initiator',
    initiator_password: 'test_pass',
    security_credential: 'test_sec',
    is_active: true
  }, { onConflict: 'tenant_id, service_type' });

  if (b2cErr) {
    console.error('Failed to insert B2C config:', b2cErr);
    process.exit(1);
  }

  // 4. Retrieve configurations independently
  console.log('Retrieving configs...');
  const { data: c2bConfig } = await supabaseAdmin.from('tenant_mpesa_config').select('*').eq('tenant_id', tenantId).eq('service_type', 'c2b').single();
  const { data: b2cConfig } = await supabaseAdmin.from('tenant_mpesa_config').select('*').eq('tenant_id', tenantId).eq('service_type', 'b2c').single();

  console.log('---------------------------------');
  if (c2bConfig && c2bConfig.paybill_number === '123456') {
    console.log('✅ C2B Config retrieved successfully!');
  } else {
    console.log('❌ Failed to retrieve C2B Config.');
  }

  if (b2cConfig && b2cConfig.shortcode === '654321') {
    console.log('✅ B2C Config retrieved successfully!');
  } else {
    console.log('❌ Failed to retrieve B2C Config.');
  }
  
  console.log('Test completed successfully.');
  process.exit(0);
}

runTest();
