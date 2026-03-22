// Example using Supabase
import { supabase } from "../supabaseClient";

export const checkUniqueValue = async (tables, column, value, excludeId = null) => {
  const results = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select(table === 'customers' ? 'id' : 'id, customer_id')
        .eq(column, value);

      if (error) {
        console.error(`[UNIQUE CHECK] Error in table ${table} for ${column}=${value}:`, error);
        return { table, error: true, conflict: false }; // Fail-open
      }

      if (data && data.length > 0) {
        if (excludeId) {
          const hasOtherOwners = data.some(record =>
            (table === 'customers' && record.id !== excludeId) ||
            (record.customer_id !== excludeId)
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
    return false; // Definitely exists
  }
  
  return true; // Unique or error (fail-open)
};
