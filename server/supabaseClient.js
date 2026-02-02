import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables!");
  console.log("SUPABASE_URL:", !!supabaseUrl);
  console.log("SUPABASE_ANON_KEY:", !!supabaseAnonKey);
  console.log("SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceKey);
  throw new Error("Missing Supabase environment variables. Check your .env file.");
}

// Regular client for database operations (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Admin client for storage operations (uses service role key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default supabase;