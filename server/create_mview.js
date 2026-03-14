import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient('https://uoudlnyypludbdfylteo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdWRsbnl5cGx1ZGJkZnlsdGVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQwMzY1OSwiZXhwIjoyMDcyOTc5NjU5fQ.fByY03qirqqDBwprCkIg2Vd_fe-htWOiHOgJuNpMxJg');

const sql = `
DROP MATERIALIZED VIEW IF EXISTS ro_cumulative_performance_report;

CREATE MATERIALIZED VIEW ro_cumulative_performance_report AS
WITH loan_metrics AS (
  SELECT
    l.id as loan_id,
    l.tenant_id,
    l.booked_by as relationship_officer_id,
    u.full_name as relationship_officer_name,
    COALESCE(l.branch_id, '00000000-0000-0000-0000-000000000000'::uuid) as branch_id,
    COALESCE(l.region_id, '00000000-0000-0000-0000-000000000000'::uuid) as region_id,
    COALESCE(l.product_type, l.product_name, 'Unknown') as loan_product,
    DATE(l.created_at) as booked_date,
    
    1::int as is_loan,
    (CASE WHEN l.is_new_loan = true THEN 1 ELSE 0 END) as is_new_loan_count,
    (CASE WHEN l.is_new_loan = false THEN 1 ELSE 0 END) as is_repeat_loan_count,
    
    (CASE WHEN l.status = 'disbursed' THEN 1 ELSE 0 END) as is_disbursed,
    (CASE WHEN l.status = 'disbursed' THEN COALESCE(l.scored_amount, 0) ELSE 0 END) as disbursed_amount,
    
    (CASE WHEN l.status = 'disbursed' AND l.repayment_state IN ('ongoing', 'partial', 'overdue') THEN 1 ELSE 0 END) as is_active,
    
    COALESCE(l.total_payable, 0) as total_payable,
    COALESCE(l.total_interest, 0) as total_interest,
    COALESCE(l.scored_amount, 0) as principal_payable,
    
    (CASE WHEN l.repayment_state = 'overdue' THEN 1 ELSE 0 END) as is_arrears,
    
    -- Subqueries for payments
    COALESCE((SELECT SUM(paid_amount) FROM loan_payments p WHERE p.loan_id = l.id AND p.reversal_of IS NULL), 0) as total_paid,
    COALESCE((SELECT SUM(principal_paid) FROM loan_payments p WHERE p.loan_id = l.id AND p.reversal_of IS NULL), 0) as principal_paid,
    COALESCE((SELECT SUM(interest_paid) FROM loan_payments p WHERE p.loan_id = l.id AND p.reversal_of IS NULL), 0) as interest_paid,
    COALESCE((SELECT SUM(penalty_paid) FROM loan_payments p WHERE p.loan_id = l.id AND p.reversal_of IS NULL), 0) as penalties_paid,
    
    -- Subqueries for arrears
    COALESCE((
      SELECT SUM(
        (COALESCE(due_amount, 0) + COALESCE(penalty_amount, 0)) - COALESCE(paid_amount, 0)
      ) 
      FROM loan_installments i 
      WHERE i.loan_id = l.id AND i.status IN ('overdue', 'partial') AND i.due_date <= CURRENT_DATE
    ), 0) as arrears_amount,
    
    -- max days overdue for bucketing
    COALESCE((
      SELECT MAX(CURRENT_DATE - i.due_date)
      FROM loan_installments i 
      WHERE i.loan_id = l.id AND i.status IN ('overdue', 'partial') AND i.due_date <= CURRENT_DATE
    ), 0) as max_days_overdue

  FROM loans l
  LEFT JOIN users u ON l.booked_by = u.id
)
SELECT 
  tenant_id,
  relationship_officer_id,
  relationship_officer_name,
  branch_id,
  region_id,
  loan_product,
  booked_date,
  
  COUNT(loan_id) as loan_count,
  SUM(is_new_loan_count) as new_loans,
  SUM(is_repeat_loan_count) as repeat_loans,
  SUM(is_disbursed) as disbursed_loans,
  SUM(disbursed_amount) as total_disbursed,
  
  SUM(is_active) as active_loans,
  SUM(CASE WHEN is_active = 1 THEN GREATEST(0, total_payable - total_paid) ELSE 0 END) as outstanding_balance,
  
  SUM(total_payable) as total_payable,
  SUM(principal_payable) as principal_payable,
  SUM(total_interest) as total_interest,
  
  SUM(is_arrears) as arrears_count,
  SUM(arrears_amount) as arrears_amount,
  
  SUM(CASE WHEN max_days_overdue > 0 AND max_days_overdue <= 30 THEN 1 ELSE 0 END) as overdue_30_days,
  SUM(CASE WHEN max_days_overdue > 30 AND max_days_overdue <= 60 THEN 1 ELSE 0 END) as overdue_60_days,
  SUM(CASE WHEN max_days_overdue > 60 AND max_days_overdue <= 90 THEN 1 ELSE 0 END) as overdue_90_days,
  SUM(CASE WHEN max_days_overdue > 90 THEN 1 ELSE 0 END) as overdue_90_plus_days,
  
  SUM(total_paid) as total_paid,
  SUM(principal_paid) as principal_paid,
  SUM(interest_paid) as interest_paid,
  SUM(penalties_paid) as penalties_paid

FROM loan_metrics
GROUP BY 
  tenant_id,
  relationship_officer_id,
  relationship_officer_name,
  branch_id,
  region_id,
  loan_product,
  booked_date;
`;

// Supabase REST API does not support running arbitrary DDL out of the box unless via postgres connection string.
// Wait, I can execute via an RPC if one exists, but probably not. Let me use the pg module instead using DB URL.
