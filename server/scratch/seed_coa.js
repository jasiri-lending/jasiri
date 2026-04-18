import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const STANDARD_ACCOUNTS = [
  { account_name: 'Loan Insurance Fee Income', account_type: 'Income', account_category: 'Loan Income', code: '4030', status: 'Active' },
  { account_name: 'Registration Fees Receivable', account_type: 'Asset', account_category: 'Receivables', code: '1140', status: 'Active' },
  { account_name: 'Accounts Payable', account_type: 'Liability', account_category: 'Operations', code: '2200', status: 'Active' },
  { account_name: 'Withdrawal Fee Income', account_type: 'Income', account_category: 'Wallet Income', code: '4040', status: 'Active' },
  { account_name: 'Payment Gateway Clearing Account', account_type: 'Asset', account_category: 'Current Asset', code: '1030', status: 'Active' },
  { account_name: 'Bank Account', account_type: 'Asset', account_category: 'Current Asset', code: '1010', status: 'Active' },
  { account_name: 'Accrued Expenses', account_type: 'Liability', account_category: 'Operations', code: '2300', status: 'Active' },
  { account_name: 'Customer Wallet Balances', account_type: 'Liability', account_category: 'Customer Funds', code: '2000', status: 'Active' },
  { account_name: 'Loan Interest Receivable', account_type: 'Asset', account_category: 'Loan Assets', code: '1110', status: 'Active' },
  { account_name: 'Marketing & Advertising Expense', account_type: 'Expense', account_category: 'Growth', code: '5400', status: 'Active' },
  { account_name: 'Commission Income', account_type: 'Income', account_category: 'Platform Income', code: '4070', status: 'Active' },
  { account_name: 'Provision for Bad Debts', account_type: 'Expense', account_category: 'Credit Risk', code: '5010', status: 'Active' },
  { account_name: 'Staff Advances', account_type: 'Asset', account_category: 'Other Assets', code: '1200', status: 'Active' },
  { account_name: 'Late Payment Penalty Income', account_type: 'Income', account_category: 'Loan Income', code: '4020', status: 'Active' },
  { account_name: 'Retained Earnings', account_type: 'Equity', account_category: 'Equity', code: '3100', status: 'Active' },
  { account_name: 'Account Maintenance Fee Income', account_type: 'Income', account_category: 'Platform Income', code: '4090', status: 'Active' },
  { account_name: 'Agent Commission Expense', account_type: 'Expense', account_category: 'Operations', code: '5110', status: 'Active' },
  { account_name: 'SMS & Communication Expense', account_type: 'Expense', account_category: 'IT', code: '5210', status: 'Active' },
  { account_name: 'Customer Loan Receivables – Principal', account_type: 'Asset', account_category: 'Loan Assets', code: '1100', status: 'Active' },
  { account_name: 'Loan Processing Fee Income', account_type: 'Income', account_category: 'Loan Income', code: '4010', status: 'Active' },
  { account_name: 'Cash on Hand', account_type: 'Asset', account_category: 'Current Asset', code: '1000', status: 'Active' },
  { account_name: 'Loans Payable (Borrowed Capital)', account_type: 'Liability', account_category: 'Financing', code: '2100', status: 'Active' },
  { account_name: 'Customer Savings Deposits', account_type: 'Liability', account_category: 'Customer Funds', code: '2010', status: 'Active' },
  { account_name: 'Owner Capital', account_type: 'Equity', account_category: 'Equity', code: '3000', status: 'Active' },
  { account_name: 'Staff Salaries Expense', account_type: 'Expense', account_category: 'Operations', code: '5100', status: 'Active' },
  { account_name: 'Loan Penalty Receivable', account_type: 'Asset', account_category: 'Loan Assets', code: '1120', status: 'Active' },
  { account_name: 'Customer Registration Fee Income', account_type: 'Income', account_category: 'Platform Income', code: '4080', status: 'Active' },
  { account_name: 'Agent Float Account', account_type: 'Asset', account_category: 'Current Asset', code: '1040', status: 'Active' },
  { account_name: 'Current Year Earnings', account_type: 'Equity', account_category: 'Equity', code: '3200', status: 'Active' },
  { account_name: 'Refunds Payable to Customers', account_type: 'Liability', account_category: 'Customer Funds', code: '2030', status: 'Active' },
  { account_name: 'Loan Processing Fees Receivable', account_type: 'Asset', account_category: 'Loan Assets', code: '1130', status: 'Active' },
  { account_name: 'Loan Loss Expense', account_type: 'Expense', account_category: 'Credit Risk', code: '5000', status: 'Active' },
  { account_name: 'Deposit Fee Income', account_type: 'Income', account_category: 'Wallet Income', code: '4050', status: 'Active' },
  { account_name: 'Prepaid Expenses', account_type: 'Asset', account_category: 'Other Assets', code: '1300', status: 'Active' },
  { account_name: 'Service Charge Income', account_type: 'Income', account_category: 'Platform Income', code: '4060', status: 'Active' },
  { account_name: 'Payment Gateway Charges', account_type: 'Expense', account_category: 'Finance', code: '5220', status: 'Active' },
  { account_name: 'Unallocated Customer Payments', account_type: 'Liability', account_category: 'Customer Funds', code: '2020', status: 'Active' },
  { account_name: 'Loan Interest Income', account_type: 'Income', account_category: 'Loan Income', code: '4000', status: 'Active' },
  { account_name: 'Taxes Payable', account_type: 'Liability', account_category: 'Tax', code: '2400', status: 'Active' },
  { account_name: 'Mobile Money Paybill Balance', account_type: 'Asset', account_category: 'Current Asset', code: '1020', status: 'Active' },
  { account_name: 'System Hosting Expense', account_type: 'Expense', account_category: 'IT', code: '5200', status: 'Active' }
];

async function seedCOA() {
  console.log('Fetching all tenants...');
  const { data: tenants, error: tErr } = await supabaseAdmin.from('tenants').select('id, name');
  
  if (tErr) {
    console.error('Error fetching tenants:', tErr);
    return;
  }

  console.log(`Found ${tenants.length} tenants. Checking existing COA...`);

  for (const tenant of tenants) {
    console.log(`\nProcessing tenant: ${tenant.name} (${tenant.id})`);
    
    // Check if COA already exists for this tenant
    const { count, error: countErr } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id);
      
    if (countErr) {
      console.error(`Error checking COA for ${tenant.name}:`, countErr);
      continue;
    }
    
    if (count > 0) {
       console.log(`- Tenant ${tenant.name} already has ${count} accounts. Skipping to prevent duplicate unique IDs.`);
       // Note: if some tenants have partial accounts, this script skips them. 
       // For a fully robust backfill, we map existing codes and insert missing.
       continue;
    }
    
    console.log(`- Inserting ${STANDARD_ACCOUNTS.length} standard accounts...`);
    const tenantPayload = STANDARD_ACCOUNTS.map(acc => ({ ...acc, tenant_id: tenant.id }));
    
    const { error: insertErr } = await supabaseAdmin.from('chart_of_accounts').insert(tenantPayload);
    if (insertErr) {
      console.error(`- Failed to insert for ${tenant.name}:`, insertErr);
    } else {
      console.log(`- Success! Added standard COA payload to ${tenant.name}.`);
    }
  }
  
  console.log('\n✅ All tenants processed.');
}

seedCOA();
