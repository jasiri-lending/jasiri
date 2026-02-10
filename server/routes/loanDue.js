import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";

const LoanDueRouter = express.Router();

const verifyTenant = async (req, res, next) => {
    try {
        const tenant_id = req.body?.tenant_id || req.query?.tenant_id;
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No session token provided' });
        }

        const sessionToken = authHeader.split(' ')[1];

        const { data: user, error: userError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("session_token", sessionToken)
            .single();

        if (userError || !user) {
            return res.status(401).json({ success: false, error: 'Invalid session token' });
        }

        if (tenant_id && user.tenant_id !== tenant_id) {
            return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("Tenant verification error:", err);
        res.status(500).json({ success: false, error: 'Tenant verification failed' });
    }
};

const getLoanDueData = async (tenant_id, filters, regionMap) => {
    const {
        region,
        branch,
        officer,
        search,
        dateRange = 'today',
        customStartDate,
        customEndDate,
        installmentsDue
    } = filters;

    let startDate, endDate;
    const today = new Date().toISOString().split("T")[0];

    switch (dateRange) {
        case "today":
            startDate = endDate = today;
            break;
        case "week":
            startDate = today;
            const weekEnd = new Date();
            weekEnd.setDate(new Date().getDate() + 6);
            endDate = weekEnd.toISOString().split("T")[0];
            break;
        case "month":
            startDate = today;
            const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
            endDate = monthEnd.toISOString().split("T")[0];
            break;
        case "quarter":
            startDate = today;
            const quarterEnd = new Date();
            quarterEnd.setMonth(new Date().getMonth() + 3);
            quarterEnd.setDate(0);
            endDate = quarterEnd.toISOString().split("T")[0];
            break;
        case "year":
            startDate = today;
            const yearEnd = new Date(new Date().getFullYear(), 11, 31);
            endDate = yearEnd.toISOString().split("T")[0];
            break;
        case "custom":
            startDate = customStartDate;
            endDate = customEndDate;
            break;
        default:
            startDate = endDate = today;
    }

    if (dateRange === "custom" && (!startDate || !endDate)) {
        return { processed: [], grandTotals: { totalDue: 0, totalPaid: 0, totalUnpaid: 0, principalDue: 0, interestDue: 0, disbursedAmount: 0 } };
    }

    let query = supabaseAdmin
        .from("loan_installments")
        .select(`
      due_date,
      due_amount,
      paid_amount,
      status,
      principal_amount,
      interest_amount,
      principal_due,
      interest_due,
      loan_id,
      loan:loans!inner(
        id,
        scored_amount,
        total_payable,
        product_name,
        product_type,
        disbursed_at,
        branch_id,
        tenant_id,
        status,
        branch:branch_id(name, region_id),
        customer:customer_id(id, Firstname, Middlename, Surname, mobile, id_number),
        loan_officer:booked_by(full_name)
      )
    `)
        .gte('due_date', `${startDate}T00:00:00`)
        .lte('due_date', `${endDate}T23:59:59`)
        .in('status', ['pending', 'partial'])
        .eq('loan.tenant_id', tenant_id)
        .eq('loan.status', 'disbursed');

    const { data, error } = await query;
    if (error) throw error;

    const loanMap = new Map();
    const queryLower = search ? search.toLowerCase() : '';

    (data || []).forEach((installment) => {
        const loan = installment.loan;
        if (!loan) return;

        const officerName = loan.loan_officer?.full_name || "N/A";
        const branchName = loan.branch?.name || "N/A";
        const regionId = loan.branch?.region_id;
        const regionName = regionId ? (regionMap.get(regionId) || "N/A") : "N/A";
        const cust = loan.customer || {};
        const fullName = [cust.Firstname, cust.Middlename, cust.Surname]
            .filter(Boolean)
            .join(" ");

        if (officer && officerName !== officer) return;
        if (branch && branchName !== branch) return;
        if (region && regionName !== region) return;
        if (search) {
            const matchesSearch =
                fullName.toLowerCase().includes(queryLower) ||
                (cust.mobile || "").includes(queryLower) ||
                (cust.id_number || "").toString().includes(queryLower);
            if (!matchesSearch) return;
        }

        const loanId = loan.id;
        if (!loanMap.has(loanId)) {
            loanMap.set(loanId, {
                branch: branchName,
                region: regionName,
                officer: officerName,
                loanId,
                customerName: fullName || "N/A",
                mobile: cust.mobile || "N/A",
                idNumber: cust.id_number || "N/A",
                productName: loan.product_name || "N/A",
                productType: loan.product_type || "N/A",
                numDueInstallments: 0,
                disbursedAmount: loan.scored_amount || 0,
                principalDue: 0,
                interestDue: 0,
                totalDue: 0,
                totalPaid: 0,
                amountUnpaid: 0,
                disbursementDate: loan.disbursed_at?.split("T")[0] || "N/A",
                totalPayable: loan.total_payable || 0,
                expectedDueDate: installment.due_date?.split("T")[0]
            });
        }

        const loanData = loanMap.get(loanId);
        loanData.numDueInstallments++;
        loanData.principalDue += Number(installment.principal_due || installment.principal_amount || 0);
        loanData.interestDue += Number(installment.interest_due || installment.interest_amount || 0);
        loanData.totalDue += Number(installment.due_amount || 0);
        loanData.totalPaid += Number(installment.paid_amount || 0);

        const currentInstDate = installment.due_date?.split("T")[0];
        if (currentInstDate < loanData.expectedDueDate) {
            loanData.expectedDueDate = currentInstDate;
        }
    });

    let processed = Array.from(loanMap.values()).map(loan => ({
        ...loan,
        amountUnpaid: loan.totalPayable - loan.totalPaid
    }));

    if (installmentsDue) {
        processed = processed.filter(l => l.numDueInstallments === Number(installmentsDue));
    }

    const grandTotals = processed.reduce(
        (acc, loan) => ({
            totalDue: acc.totalDue + (loan.totalDue || 0),
            totalPaid: acc.totalPaid + (loan.totalPaid || 0),
            totalUnpaid: acc.totalUnpaid + (loan.amountUnpaid || 0),
            principalDue: acc.principalDue + (loan.principalDue || 0),
            interestDue: acc.interestDue + (loan.interestDue || 0),
            disbursedAmount: acc.disbursedAmount + (loan.disbursedAmount || 0),
        }),
        { totalDue: 0, totalPaid: 0, totalUnpaid: 0, principalDue: 0, interestDue: 0, disbursedAmount: 0 }
    );

    return { processed, grandTotals };
};

LoanDueRouter.get("/", verifyTenant, async (req, res) => {
    try {
        const { tenant_id, page = 1, limit = 10 } = req.query;
        if (!tenant_id) return res.status(400).json({ success: false, error: "tenant_id is required" });

        const { data: regionsData } = await supabaseAdmin.from("regions").select("id, name").eq("tenant_id", tenant_id);
        const regionMap = new Map((regionsData || []).map(r => [r.id, r.name]));

        const { processed, grandTotals } = await getLoanDueData(tenant_id, req.query, regionMap);

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const totalRows = processed.length;
        const pagedData = processed.slice(startIndex, startIndex + limitNum);

        res.json({
            success: true,
            data: pagedData,
            grandTotals,
            totalRows,
            totalPages: Math.ceil(totalRows / limitNum),
            currentPage: pageNum
        });
    } catch (error) {
        console.error("Error in loan-due report:", error);
        res.status(500).json({ success: false, error: "Internal server error", details: error.message });
    }
});

LoanDueRouter.get("/export", verifyTenant, async (req, res) => {
    try {
        const { tenant_id, format = 'csv' } = req.query;
        if (!tenant_id) return res.status(400).json({ success: false, error: "tenant_id is required" });

        const { data: regionsData } = await supabaseAdmin.from("regions").select("id, name").eq("tenant_id", tenant_id);
        const regionMap = new Map((regionsData || []).map(r => [r.id, r.name]));

        const { processed } = await getLoanDueData(tenant_id, req.query, regionMap);

        if (format === 'csv') {
            const headers = [
                "No", "Branch", "Region", "Officer", "Customer Name", "Mobile", "ID Number",
                "Product Name", "# Installments", "Disbursed Amount", "Principal Due",
                "Interest Due", "Total Due", "Total Paid", "Unpaid Amount", "Due Date", "Disbursement Date"
            ];

            const rows = processed.map((loan, idx) => [
                idx + 1, loan.branch, loan.region, loan.officer, loan.customerName, loan.mobile, loan.idNumber,
                loan.productName, loan.numDueInstallments, loan.disbursedAmount, loan.principalDue,
                loan.interestDue, loan.totalDue, loan.totalPaid, loan.amountUnpaid, loan.expectedDueDate, loan.disbursementDate
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            ].join("\n");

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=loan_due_report_${new Date().toISOString().split('T')[0]}.csv`);
            return res.send(csvContent);
        }

        res.json({ success: true, data: processed });
    } catch (error) {
        console.error("Error in loan-due export:", error);
        res.status(500).json({ success: false, error: "Internal server error", details: error.message });
    }
});

export default LoanDueRouter;
