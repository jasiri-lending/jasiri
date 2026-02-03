import { supabase } from "../supabaseClient";

export const getNextCode = async (type, tenantId) => {
    if (!type || !tenantId) return "";

    const ranges = {
        ASSET: [1000, 1999],
        LIABILITY: [2000, 2999],
        EQUITY: [3000, 3999],
        INCOME: [4000, 4999],
        EXPENSE: [5000, 5999],
    };

    const range = ranges[type.toUpperCase()];
    if (!range) return "";

    const [min, max] = range;

    // Find the highest existing code in this range
    const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("code")
        .eq("tenant_id", tenantId)
        .gte("code", min)
        .lte("code", max)
        .order("code", { ascending: false }) // Get highest first
        .limit(1);

    if (error) {
        console.error("Error fetching next code:", error);
        return min.toString();
    }

    if (!data || data.length === 0) {
        return min.toString();
    }

    // Ensure we treat code as number for calculation
    const lastCode = parseInt(data[0].code);

    if (isNaN(lastCode)) {
        return min.toString();
    }

    const nextCode = lastCode + 10;

    if (nextCode > max) {
        console.warn("Account code range exhausted for type:", type);
        return ""; // Or handle overflow appropriately
    }

    return nextCode.toString();
};
