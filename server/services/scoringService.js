import { supabase, supabaseAdmin } from "../supabaseClient.js";

/**
 * Scoring Service
 * Evaluates customer credit risk and recommends limits.
 */

/**
 * Calculates credit score for a customer based on tenant rules.
 * @param {string} customerId - UUID of the customer
 * @param {string} tenantId - UUID of the tenant
 */
export const calculateCreditScore = async (customerId, tenantId) => {
  try {
    // 1. Fetch customer data (repayment history, loans, etc.)
    // Note: We'll fetch from 'loans' and 'repayments' tables (assuming these exist based on context)
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", tenantId);

    if (loansError) throw loansError;

    // Basic data extraction
    const totalLoans = loans?.length || 0;
    const completedLoans = loans?.filter(l => l.status === 'completed' || l.status === 'closed').length || 0;
    const missedPayments = loans?.reduce((acc, l) => acc + (l.missed_installments || 0), 0);
    const completionRate = totalLoans > 0 ? (completedLoans / totalLoans) * 100 : 0;

    // 2. Fetch active scoring rules for tenant
    const { data: rules, error: rulesError } = await supabase
      .from("scoring_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (rulesError) {
      console.warn("No scoring rules found or error fetching rules. Using default score.");
    }

    // 3. Loop through rules and apply score impact
    let score = 600; // Base score

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        const { condition, score_impact } = rule;
        
        // Evaluate condition (Simple JSONB-based evaluation)
        // Supported formats: { "field": "repayment_rate", "operator": ">", "value": 90 }
        if (evaluateCondition(condition, { totalLoans, completedLoans, missedPayments, completionRate })) {
          score += score_impact;
        }
      }
    }

    // Cap score between 300 and 850 (FICO-like range)
    score = Math.max(300, Math.min(850, score));

    // 4. Assign risk grade
    let risk_grade = 'D';
    if (score >= 750) risk_grade = 'A';
    else if (score >= 650) risk_grade = 'B';
    else if (score >= 500) risk_grade = 'C';

    // 5. Determine eligibility
    let eligibility_status = 'rejected';
    if (risk_grade === 'A' || risk_grade === 'B') eligibility_status = 'approved';
    else if (risk_grade === 'C') eligibility_status = 'review';

    // 6. Calculate recommended limit
    const recommended_limit = calculateRecommendedLimit(score);

    // 7. Save to database
    const { data: scoreRecord, error: saveError } = await supabaseAdmin
      .from("credit_scores")
      .upsert({
        customer_id: customerId,
        tenant_id: tenantId,
        score,
        risk_grade,
        calculated_at: new Date().toISOString()
      }, { onConflict: 'customer_id, tenant_id' })
      .select()
      .single();

    if (saveError) throw saveError;

    return {
      success: true,
      data: {
        score,
        risk_grade,
        recommended_limit,
        eligibility_status,
        calculated_at: scoreRecord.calculated_at
      }
    };
  } catch (error) {
    console.error("Error in calculateCreditScore:", error);
    throw error;
  }
};

/**
 * Simple condition evaluator
 */
const evaluateCondition = (condition, data) => {
  const { field, operator, value } = condition;
  const actualValue = data[field];

  switch (operator) {
    case '>': return actualValue > value;
    case '<': return actualValue < value;
    case '>=': return actualValue >= value;
    case '<=': return actualValue <= value;
    case '==': return actualValue == value;
    case '!=': return actualValue != value;
    default: return false;
  }
};

/**
 * Recommends a limit based on score
 */
export const calculateRecommendedLimit = (score) => {
  if (score >= 750) return 50000;
  if (score >= 650) return 20000;
  if (score >= 500) return 5000;
  return 0;
};
