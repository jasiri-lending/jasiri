// Example using Supabase
import { supabase } from "../supabaseClient";

export const checkUniqueValue = async (tables, column, value, tenantId, excludeId = null) => {
  if (!tenantId) {
    console.error("[UNIQUE CHECK] tenantId is required for validation.");
    return true; // Fail-open to prevent blocking if tenantId is missing
  }

  const results = await Promise.all(
    tables.map(async (table) => {
      const query = supabase
        .from(table)
        .select(table === 'customers' ? 'id' : 'id, customer_id')
        .eq(column, value)
        .eq('tenant_id', tenantId);

      const { data, error } = await query;

      if (error) {
        console.error(`[UNIQUE CHECK] Error in table ${table} for ${column}=${value}:`, error);
        return { table, error: true, conflict: false }; // Fail-open
      }

      if (data && data.length > 0) {
        if (excludeId) {
          const hasOtherOwners = data.some(record =>
            (table === 'customers' && String(record.id) !== String(excludeId)) ||
            (record.customer_id && String(record.customer_id) !== String(excludeId))
          );
          if (hasOtherOwners) return { table, conflict: true };
          return { table, conflict: false }; // Owned records only
        }
        return { table, conflict: true };
      }
      return { table, conflict: false };
    })
  );

  const conflictFound = results.find(r => r.conflict);
  const errorFound = results.find(r => r.error);

  if (errorFound) {
    console.warn(`[UNIQUE CHECK] One or more tables failed validation, but allowing through to prevent blocking user.`);
  }

  if (conflictFound) {
    return false; // Definitely exists in the same tenant
  }
  
  return true; // Unique or error (fail-open)
};
