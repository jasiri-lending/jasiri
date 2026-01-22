// Example using Supabase
import { supabase } from "../supabaseClient";

export const checkUniqueValue = async (tables, column, value, excludeId = null) => {
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select(table === 'customers' ? 'id' : 'id, customer_id')
      .eq(column, value);

    if (error) {
      console.error("Error checking uniqueness:", error);
      return false;
    }

    if (data && data.length > 0) {
      if (excludeId) {
        const hasOtherOwners = data.some(record =>
          (table === 'customers' && record.id !== excludeId) ||
          (record.customer_id !== excludeId)
        );
        if (hasOtherOwners) return false;
        continue; // Only owned records found in this table
      }
      return false;
    }
  }
  return true;
};
