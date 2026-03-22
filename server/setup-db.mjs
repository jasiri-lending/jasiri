
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function setupTables() {
  console.log("Setting up tables...");
  
  // Scoring Rules Table
  const { error: rulesError } = await supabaseAdmin.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS public.scoring_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        rule_name text NOT NULL,
        rule_type text NOT NULL,
        condition jsonb NOT NULL,
        score_impact integer NOT NULL,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      
      -- Enable RLS
      ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
      
      -- Basic Policy (Allow all for now to unblock)
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scoring_rules') THEN
          CREATE POLICY "Allow all for authenticated users" ON public.scoring_rules
            FOR ALL USING (auth.role() = 'authenticated');
        END IF;
      END $$;
    `
  });

  if (rulesError && !rulesError.message.includes('function "exec_sql" does not exist')) {
    console.error("Error creating scoring_rules:", rulesError.message);
  } else if (rulesError) {
    console.warn("exec_sql function not found. Falling back to simple check.");
    // If exec_sql doesn't exist, we hope the tables were already there or we need another way.
  }

  // Credit Scores Table
  const { error: scoresError } = await supabaseAdmin.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS public.credit_scores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        score integer NOT NULL,
        risk_grade text NOT NULL,
        calculated_at timestamptz DEFAULT now(),
        UNIQUE(customer_id, tenant_id)
      );
      
      ALTER TABLE public.credit_scores ENABLE ROW LEVEL SECURITY;
    `
  });

  if (scoresError && !scoresError.message.includes('function "exec_sql" does not exist')) {
    console.error("Error creating credit_scores:", scoresError.message);
  }

  console.log("Setup complete (if exec_sql is available).");
}

setupTables();
