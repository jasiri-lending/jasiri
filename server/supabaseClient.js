import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Service role client (server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;
