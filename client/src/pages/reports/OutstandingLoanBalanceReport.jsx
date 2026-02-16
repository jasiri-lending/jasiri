import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
} from "docx";
import { saveAs } from "file-saver";
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner

// ========== Memoized Helper Components ==========

const SearchBox = React.memo(({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search name, ID..."
      className="pl-9 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm w-48 lg:w-64 transition-all"
    />
  </div>
));
SearchBox.displayName = "SearchBox";

// Memoized row component for better performance
const OutstandingLoanRow = React.memo(({ loan, isFirstInBranch, isFirstInOfficer, branchRowSpan, officerRowSpan, branchTotal, officerTotal }) => {
  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    })
      .format(num || 0)
      .replace("KES", "")
      .trim();

  const getPercentClass = (percent, type = "paid") => {
    if (type === "paid") {
      if (percent >= 75) return "bg-green-100 text-green-800";
      if (percent >= 50) return "bg-blue-100 text-blue-800";
      if (percent >= 25) return "bg-yellow-100 text-yellow-800";
      return "bg-red-100 text-red-800";
    } else {
      if (percent <= 25) return "bg-green-100 text-green-800";
      if (percent <= 50) return "bg-blue-100 text-blue-800";
      if (percent <= 75) return "bg-yellow-100 text-yellow-800";
      return "bg-red-100 text-red-800";
    }
  };

  const getOverdueClass = (days) => {
    if (days <= 7) return "bg-yellow-100 text-yellow-800";
    if (days <= 30) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {isFirstInBranch ? (
        <>
          <td
            rowSpan={branchRowSpan}
            className="px-3 py-3 text-gray-900 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap text-xs shadow-[inset_-2px_0_0_0_rgba(191,219,254,1)]"
          >
            {loan.branch}
          </td>
          <td
            rowSpan={branchRowSpan}
            className="px-3 py-3 text-right text-blue-700 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap text-xs"
          >
            {formatCurrency(branchTotal)}
          </td>
        </>
      ) : null}

      {isFirstInOfficer ? (
        <>
          <td
            rowSpan={officerRowSpan}
            className="px-3 py-3 text-gray-800 font-semibold bg-green-50 border-r border-green-200 align-top whitespace-nowrap text-xs"
          >
            {loan.loan_officer}
          </td>
          <td
            rowSpan={officerRowSpan}
            className="px-3 py-3 text-right text-green-700 font-bold bg-green-50 border-r border-green-200 align-top whitespace-nowrap text-xs"
          >
            {formatCurrency(officerTotal)}
          </td>
        </>
      ) : null}

      <td className="px-3 py-3 text-gray-900 font-medium whitespace-nowrap text-xs">{loan.customer_name}</td>
      <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs">{loan.mobile}</td>
      <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs">{loan.customer_id}</td>
      <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap text-xs">{formatCurrency(loan.principal)}</td>
      <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap text-xs">{formatCurrency(loan.interest)}</td>
      <td className="px-3 py-3 text-right text-gray-900 font-bold whitespace-nowrap text-xs">{formatCurrency(loan.total_amount)}</td>
      <td className="px-3 py-3 text-center text-gray-700 whitespace-nowrap text-xs">{loan.outstanding_installments}</td>
      <td className="px-3 py-3 text-right text-green-700 font-medium whitespace-nowrap text-xs">{formatCurrency(loan.principal_paid)}</td>
      <td className="px-3 py-3 text-right text-green-700 font-medium whitespace-nowrap text-xs">{formatCurrency(loan.interest_paid)}</td>
      <td className="px-3 py-3 text-right text-green-800 font-bold whitespace-nowrap text-xs">{formatCurrency(loan.total_amount_paid)}</td>
      <td className="px-3 py-3 text-center whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${getPercentClass(loan.percent_paid)}`}>
          {loan.percent_paid.toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-3 text-center whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${getPercentClass(loan.percent_unpaid, "unpaid")}`}>
          {loan.percent_unpaid.toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-3 text-right text-blue-700 font-black whitespace-nowrap text-xs bg-blue-50/20">
        {formatCurrency(loan.balance)}
      </td>
      <td className="px-3 py-3 text-right text-red-700 font-black whitespace-nowrap text-xs bg-red-50/20">
        {loan.arrears_amount > 0 ? formatCurrency(loan.arrears_amount) : "-"}
      </td>
      <td className="px-3 py-3 text-center whitespace-nowrap">
        {loan.overdue_days > 0 ? (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${getOverdueClass(loan.overdue_days)}`}>
            {loan.overdue_days} DAYS
          </span>
        ) : (
          <span className="text-gray-400 font-bold text-[10px]">CURRENT</span>
        )}
      </td>
      <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-[10px] font-medium tracking-tight">{loan.disbursement_date}</td>
      <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-[10px] font-medium tracking-tight">{loan.loan_end_date}</td>
    </tr>
  );
});
OutstandingLoanRow.displayName = "OutstandingLoanRow";

// ========== Main Component ==========

const OutstandingLoanBalanceReport = () => {
  // ✅ Get tenant from localStorage ONCE
  const [tenant] = useState(() => {
    try {
      const savedTenant = localStorage.getItem("tenant");
      return savedTenant ? JSON.parse(savedTenant) : null;
    } catch (e) {
      console.error("Error loading tenant:", e);
      return null;
    }
  });

  // ========== State ==========
  const [rawReports, setRawReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // ✅ Add error state
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [exportFormat, setExportFormat] = useState("csv");

  const itemsPerPage = 20;

  // Combined filters state (saved to localStorage)
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("outstanding-balance-filters-combined");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          search: parsed.search || "",
          region: parsed.region || "",
          branch: parsed.branch || "",
          loanOfficer: parsed.loanOfficer || "",
          status: parsed.status || "all",
          product: parsed.product || "",
          dateFilter: parsed.dateFilter || "all",
          customStartDate: parsed.customStartDate || "",
          customEndDate: parsed.customEndDate || "",
        };
      }
    } catch (e) {}
    return {
      search: "",
      region: "",
      branch: "",
      loanOfficer: "",
      status: "all",
      product: "",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    };
  });

  // Refs
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(true); // ✅ Track mount state

  // ========== Debounced Save Filters ==========
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(
          "outstanding-balance-filters-combined",
          JSON.stringify(filters)
        );
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // ========== Helper: Calculate Arrears and Overdue ==========
  const calculateArrearsAndOverdue = useCallback((installments) => {
    let arrearsAmount = 0;
    let maxOverdueDays = 0;
    const today = new Date();

    installments.forEach((inst) => {
      if (inst.status === "overdue" || inst.status === "defaulted") {
        const unpaidAmount = Math.max(0, (inst.due_amount || 0) - (inst.paid_amount || 0));
        arrearsAmount += unpaidAmount;

        if (inst.due_date) {
          const dueDate = new Date(inst.due_date);
          const daysOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
          maxOverdueDays = Math.max(maxOverdueDays, daysOverdue);
        }
        if (inst.days_overdue > maxOverdueDays) {
          maxOverdueDays = inst.days_overdue;
        }
      }
    });

    return { arrearsAmount, overdueDays: maxOverdueDays };
  }, []);

  // ========== FIXED: Fetch All Data (ONCE with Caching) ==========
  useEffect(() => {
    const tenantId = tenant?.id;
    
    // Early return if no tenant or already fetched
    if (!tenantId || hasFetchedRef.current) {
      console.log("⏭️ Skipping fetch - tenantId:", tenantId, "hasFetched:", hasFetchedRef.current);
      return;
    }

    // Mark as fetched IMMEDIATELY to prevent duplicate calls
    hasFetchedRef.current = true;
    isMountedRef.current = true;

    const fetchAllData = async () => {
      console.log("🔄 Starting outstanding loans data fetch for tenant:", tenantId);
      
      try {
        const cacheKey = `outstanding-balance-raw-data-${tenantId}`;

        // Try cache first
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const cacheAge = Date.now() - timestamp;
            
            if (cacheAge < 24 * 60 * 60 * 1000) { // 24 hours cache
              console.log("✅ Using cached outstanding loans data");
              if (isMountedRef.current) {
                setRawReports(data.reports || []);
                setBranches(data.branches || []);
                setRegions(data.regions || []);
                setOfficers(data.officers || []);
                setLoading(false);
              }
              return;
            } else {
              console.log("⏰ Cache expired, fetching fresh data");
            }
          }
        } catch (e) {
          console.error("Cache read error:", e);
        }

        // Set loading state
        if (isMountedRef.current) {
          setLoading(true);
          setError(null);
        }

        console.log("🌐 Fetching all tables from database...");

        // Fetch with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 45000)
        );

        // Parallel fetch all required tables with tenant filter
        const fetchPromise = Promise.all([
          supabase
            .from("loans")
            .select(
              "id, customer_id, booked_by, branch_id, product_name, scored_amount, disbursed_at, status, repayment_state, duration_weeks, total_interest, total_payable, weekly_payment"
            )
            .eq("tenant_id", tenantId)
            .in("status", ["active", "disbursed"])
            .neq("repayment_state", "completed"),
          supabase
            .from("loan_installments")
            .select(
              "loan_id, installment_number, due_date, due_amount, principal_amount, interest_amount, paid_amount, status, days_overdue, interest_paid, principal_paid"
            )
            .eq("tenant_id", tenantId),
          supabase
            .from("customers")
            .select("id, Firstname, Middlename, Surname, id_number, mobile")
            .eq("tenant_id", tenantId),
          supabase
            .from("users")
            .select("id, full_name")
            .eq("tenant_id", tenantId),
          supabase
            .from("branches")
            .select("id, name, region_id")
            .eq("tenant_id", tenantId),
          supabase
            .from("regions")
            .select("id, name")
            .eq("tenant_id", tenantId),
        ]);

        const results = await Promise.race([fetchPromise, timeoutPromise]);
        
        const [
          loansRes,
          installmentsRes,
          customersRes,
          usersRes,
          branchesRes,
          regionsRes,
        ] = results;

        // Check for errors
        if (loansRes.error) throw loansRes.error;
        if (installmentsRes.error) throw installmentsRes.error;
        if (customersRes.error) throw customersRes.error;
        if (usersRes.error) throw usersRes.error;
        if (branchesRes.error) throw branchesRes.error;
        if (regionsRes.error) throw regionsRes.error;

        console.log("✅ All tables fetched successfully");
        console.log("- Loans:", loansRes.data?.length || 0);
        console.log("- Installments:", installmentsRes.data?.length || 0);
        console.log("- Customers:", customersRes.data?.length || 0);

        if (!isMountedRef.current) {
          console.log("🧹 Component unmounted during fetch");
          return;
        }

        const loans = loansRes.data || [];
        const installments = installmentsRes.data || [];
        const customers = customersRes.data || [];
        const users = usersRes.data || [];
        const branchData = branchesRes.data || [];
        const regionData = regionsRes.data || [];

        console.log("🔄 Processing loans into reports...");

        // Process loans into reports
        const processedReports = loans.map((loan) => {
          const customer = customers.find((c) => c.id === loan.customer_id);
          const loanOfficer = users.find((u) => u.id === loan.booked_by);
          const branch = branchData.find((b) => b.id === loan.branch_id);

          const fullName = customer
            ? `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim()
            : "N/A";

          const loanInstallments = installments.filter((i) => i.loan_id === loan.id);
          const { arrearsAmount, overdueDays } = calculateArrearsAndOverdue(loanInstallments);

          let totalPrincipalOutstanding = 0;
          let totalInterestOutstanding = 0;
          let totalInterestPaid = 0;
          let totalPrincipalPaid = 0;
          let outstandingInstallments = 0;

          loanInstallments.forEach((inst) => {
            const principalAmount = Number(inst.principal_amount) || 0;
            const interestAmount = Number(inst.interest_amount) || 0;
            const interestPaid = Number(inst.interest_paid) || 0;
            const principalPaid = Number(inst.principal_paid) || 0;

            const principalBalance = principalAmount - principalPaid;
            const interestBalance = interestAmount - interestPaid;

            if (inst.status !== "paid" && (principalBalance > 0 || interestBalance > 0)) {
              outstandingInstallments += 1;
            }

            totalPrincipalOutstanding += principalBalance;
            totalInterestOutstanding += interestBalance;
            totalInterestPaid += interestPaid;
            totalPrincipalPaid += principalPaid;
          });

          const totalOutstanding = totalPrincipalOutstanding + totalInterestOutstanding;
          const principal = Number(loan.scored_amount) || 0;
          const interest = Number(loan.total_interest) || 0;
          const total_amount = Number(loan.total_payable) || 0;
          const total_amount_paid = totalPrincipalPaid + totalInterestPaid;
          const percent_paid = total_amount > 0 ? (total_amount_paid / total_amount) * 100 : 0;
          const percent_unpaid = total_amount > 0 ? (totalOutstanding / total_amount) * 100 : 0;

          return {
            id: loan.id,
            customer_name: fullName,
            customer_id: customer?.id_number || "N/A",
            mobile: customer?.mobile || "N/A",
            branch: branch?.name || "N/A",
            branch_id: branch?.id || "N/A",
            region: regionData.find((r) => r.id === branch?.region_id)?.name || "N/A",
            region_id: branch?.region_id || "N/A",
            loan_officer: loanOfficer?.full_name || "N/A",
            loan_officer_id: loanOfficer?.id || "N/A",
            principal_outstanding: totalPrincipalOutstanding,
            interest_outstanding: totalInterestOutstanding,
            outstanding_installments: outstandingInstallments,
            balance: totalOutstanding,
            disbursement_date: loan.disbursed_at
              ? new Date(loan.disbursed_at).toLocaleDateString()
              : "N/A",
            loan_end_date:
              loan.duration_weeks && loan.disbursed_at
                ? new Date(
                    new Date(loan.disbursed_at).getTime() +
                      loan.duration_weeks * 7 * 24 * 60 * 60 * 1000
                  ).toLocaleDateString()
                : "N/A",
            repayment_state: loan.repayment_state,
            status: loan.status,
            principal,
            interest,
            total_amount,
            num_installments: loan.duration_weeks || 0,
            principal_due: totalPrincipalOutstanding,
            interest_due: totalInterestOutstanding,
            recurring_charge: Number(loan.weekly_payment) || 0,
            principal_paid: totalPrincipalPaid,
            total_amount_due: total_amount,
            total_amount_paid,
            percent_paid,
            interest_paid: totalInterestPaid,
            percent_unpaid,
            arrears_amount: arrearsAmount,
            overdue_days: overdueDays,
            loan_product: loan.product_name,
          };
        });

        console.log("✅ Reports processed:", processedReports.length);

        const cacheData = {
          reports: processedReports,
          branches: branchData,
          regions: regionData,
          officers: users,
        };

        if (isMountedRef.current) {
          setRawReports(processedReports);
          setBranches(branchData);
          setRegions(regionData);
          setOfficers(users);
          setLoading(false);
          setError(null);

          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                data: cacheData,
                timestamp: Date.now(),
              })
            );
            console.log("✅ Data cached successfully");
          } catch (e) {
            console.error("Cache write error:", e);
          }
        }
      } catch (err) {
        console.error("❌ Error fetching outstanding loans:", err);
        if (isMountedRef.current) {
          setError(err.message || "Failed to load outstanding loans data");
          setLoading(false);
          setRawReports([]); // ✅ Set empty array on error
        }
      }
    };

    fetchAllData();

    // Cleanup function
    return () => {
      console.log("🧹 Cleanup: Component unmounting");
      isMountedRef.current = false;
    };
  }, [tenant?.id, calculateArrearsAndOverdue]);

  // ========== Manual Refresh ==========
  const handleManualRefresh = async () => {
    const tenantId = tenant?.id;
    if (!tenantId || loading) return;

    console.log("🔄 Manual refresh triggered");

    try {
      setLoading(true);
      setError(null);

      const [
        loansRes,
        installmentsRes,
        customersRes,
        usersRes,
        branchesRes,
        regionsRes,
      ] = await Promise.all([
        supabase
          .from("loans")
          .select(
            "id, customer_id, booked_by, branch_id, product_name, scored_amount, disbursed_at, status, repayment_state, duration_weeks, total_interest, total_payable, weekly_payment"
          )
          .eq("tenant_id", tenantId)
          .in("status", ["active", "disbursed"])
          .neq("repayment_state", "completed"),
        supabase
          .from("loan_installments")
          .select(
            "loan_id, installment_number, due_date, due_amount, principal_amount, interest_amount, paid_amount, status, days_overdue, interest_paid, principal_paid"
          )
          .eq("tenant_id", tenantId),
        supabase
          .from("customers")
          .select("id, Firstname, Middlename, Surname, id_number, mobile")
          .eq("tenant_id", tenantId),
        supabase
          .from("users")
          .select("id, full_name")
          .eq("tenant_id", tenantId),
        supabase
          .from("branches")
          .select("id, name, region_id")
          .eq("tenant_id", tenantId),
        supabase
          .from("regions")
          .select("id, name")
          .eq("tenant_id", tenantId),
      ]);

      if (loansRes.error) throw loansRes.error;
      if (installmentsRes.error) throw installmentsRes.error;
      if (customersRes.error) throw customersRes.error;
      if (usersRes.error) throw usersRes.error;
      if (branchesRes.error) throw branchesRes.error;
      if (regionsRes.error) throw regionsRes.error;

      const loans = loansRes.data || [];
      const installments = installmentsRes.data || [];
      const customers = customersRes.data || [];
      const users = usersRes.data || [];
      const branchData = branchesRes.data || [];
      const regionData = regionsRes.data || [];

      const processedReports = loans.map((loan) => {
        const customer = customers.find((c) => c.id === loan.customer_id);
        const loanOfficer = users.find((u) => u.id === loan.booked_by);
        const branch = branchData.find((b) => b.id === loan.branch_id);
        const fullName = customer
          ? `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim()
          : "N/A";
        const loanInstallments = installments.filter((i) => i.loan_id === loan.id);
        const { arrearsAmount, overdueDays } = calculateArrearsAndOverdue(loanInstallments);

        let totalPrincipalOutstanding = 0;
        let totalInterestOutstanding = 0;
        let totalInterestPaid = 0;
        let totalPrincipalPaid = 0;
        let outstandingInstallments = 0;

        loanInstallments.forEach((inst) => {
          const principalAmount = Number(inst.principal_amount) || 0;
          const interestAmount = Number(inst.interest_amount) || 0;
          const interestPaid = Number(inst.interest_paid) || 0;
          const principalPaid = Number(inst.principal_paid) || 0;
          const principalBalance = principalAmount - principalPaid;
          const interestBalance = interestAmount - interestPaid;

          if (inst.status !== "paid" && (principalBalance > 0 || interestBalance > 0)) {
            outstandingInstallments += 1;
          }

          totalPrincipalOutstanding += principalBalance;
          totalInterestOutstanding += interestBalance;
          totalInterestPaid += interestPaid;
          totalPrincipalPaid += principalPaid;
        });

        const totalOutstanding = totalPrincipalOutstanding + totalInterestOutstanding;
        const principal = Number(loan.scored_amount) || 0;
        const interest = Number(loan.total_interest) || 0;
        const total_amount = Number(loan.total_payable) || 0;
        const total_amount_paid = totalPrincipalPaid + totalInterestPaid;
        const percent_paid = total_amount > 0 ? (total_amount_paid / total_amount) * 100 : 0;
        const percent_unpaid = total_amount > 0 ? (totalOutstanding / total_amount) * 100 : 0;

        return {
          id: loan.id,
          customer_name: fullName,
          customer_id: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          branch: branch?.name || "N/A",
          branch_id: branch?.id || "N/A",
          region: regionData.find((r) => r.id === branch?.region_id)?.name || "N/A",
          region_id: branch?.region_id || "N/A",
          loan_officer: loanOfficer?.full_name || "N/A",
          loan_officer_id: loanOfficer?.id || "N/A",
          principal_outstanding: totalPrincipalOutstanding,
          interest_outstanding: totalInterestOutstanding,
          outstanding_installments: outstandingInstallments,
          balance: totalOutstanding,
          disbursement_date: loan.disbursed_at
            ? new Date(loan.disbursed_at).toLocaleDateString()
            : "N/A",
          loan_end_date:
            loan.duration_weeks && loan.disbursed_at
              ? new Date(
                  new Date(loan.disbursed_at).getTime() +
                    loan.duration_weeks * 7 * 24 * 60 * 60 * 1000
                ).toLocaleDateString()
              : "N/A",
          repayment_state: loan.repayment_state,
          status: loan.status,
          principal,
          interest,
          total_amount,
          num_installments: loan.duration_weeks || 0,
          principal_due: totalPrincipalOutstanding,
          interest_due: totalInterestOutstanding,
          recurring_charge: Number(loan.weekly_payment) || 0,
          principal_paid: totalPrincipalPaid,
          total_amount_due: total_amount,
          total_amount_paid,
          percent_paid,
          interest_paid: totalInterestPaid,
          percent_unpaid,
          arrears_amount: arrearsAmount,
          overdue_days: overdueDays,
          loan_product: loan.product_name,
        };
      });

      setRawReports(processedReports);
      setBranches(branchData);
      setRegions(regionData);
      setOfficers(users);

      const cacheKey = `outstanding-balance-raw-data-${tenantId}`;
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data: {
              reports: processedReports,
              branches: branchData,
              regions: regionData,
              officers: users,
            },
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.error("Cache write error:", e);
      }

      console.log("✅ Manual refresh complete");
    } catch (err) {
      console.error("❌ Error refreshing outstanding loans:", err);
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // ========== Helper: Date Range ==========
  const getDateRange = useCallback(
    (filter) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let start, end;

      switch (filter) {
        case "today":
          start = new Date(today);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case "week":
          start = new Date(today);
          start.setDate(start.getDate() - start.getDay());
          end = new Date(start);
          end.setDate(end.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "month":
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case "quarter":
          const currentQuarter = Math.floor(today.getMonth() / 3);
          start = new Date(today.getFullYear(), currentQuarter * 3, 1);
          end = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case "year":
          start = new Date(today.getFullYear(), 0, 1);
          end = new Date(today.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          break;
        case "custom":
          start = filters.customStartDate ? new Date(filters.customStartDate) : new Date(0);
          start.setHours(0, 0, 0, 0);
          end = filters.customEndDate ? new Date(filters.customEndDate) : new Date();
          end.setHours(23, 59, 59, 999);
          break;
        default:
          return null;
      }
      return { start, end };
    },
    [filters.customStartDate, filters.customEndDate]
  );

  // ========== Filtered and Grouped Data ==========
  const filteredData = useMemo(() => {
    let result = [...rawReports];

    // Text search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          r.customer_id.includes(q)
      );
    }

    // Hierarchical filters
    if (filters.region) result = result.filter((r) => r.region_id === filters.region);
    if (filters.branch) result = result.filter((r) => r.branch_id === filters.branch);
    if (filters.loanOfficer) result = result.filter((r) => r.loan_officer_id === filters.loanOfficer);
    if (filters.status !== "all") result = result.filter((r) => r.repayment_state === filters.status);
    if (filters.product) result = result.filter((r) => r.loan_product === filters.product);

    // Date filter
    if (filters.dateFilter !== "all") {
      const range = getDateRange(filters.dateFilter);
      if (range) {
        result = result.filter((r) => {
          const loanDate = new Date(r.disbursement_date);
          return loanDate >= range.start && loanDate <= range.end;
        });
      }
    }

    // Group by branch -> officer
    const grouped = {};
    result.forEach((loan) => {
      const branchName = loan.branch;
      const officerName = loan.loan_officer;

      if (!grouped[branchName]) {
        grouped[branchName] = {
          branchName,
          totalOutstanding: 0,
          officers: {},
        };
      }

      if (!grouped[branchName].officers[officerName]) {
        grouped[branchName].officers[officerName] = {
          officerName,
          totalOutstanding: 0,
          loans: [],
        };
      }

      grouped[branchName].officers[officerName].loans.push(loan);
      grouped[branchName].officers[officerName].totalOutstanding += loan.balance;
      grouped[branchName].totalOutstanding += loan.balance;
    });

    // Convert to array
    return Object.values(grouped).map((branch) => ({
      ...branch,
      officers: Object.values(branch.officers),
    }));
  }, [rawReports, filters, getDateRange]);

  // ========== All Loans Flat Array ==========
  const allLoans = useMemo(() => {
    return filteredData.flatMap((branch) =>
      branch.officers.flatMap((officer) => officer.loans)
    );
  }, [filteredData]);

  // ========== Totals ==========
  const totals = useMemo(() => {
    return {
      outstanding: allLoans.reduce((sum, r) => sum + r.balance, 0),
      principal: allLoans.reduce((sum, r) => sum + r.principal_outstanding, 0),
      count: allLoans.length,
    };
  }, [allLoans]);

  // ========== Pagination ==========
  const pagination = useMemo(() => {
    const totalRows = allLoans.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    return { totalRows, totalPages, startIdx, endIdx };
  }, [allLoans, currentPage]);

  // ========== Filtered Branches / Officers for Dropdowns ==========
  const getFilteredBranches = useCallback(() => {
    if (!filters.region) return branches;
    return branches.filter((b) => b.region_id === filters.region);
  }, [branches, filters.region]);

  const getFilteredOfficers = useCallback(() => {
    if (filters.branch) {
      return officers.filter((o) =>
        rawReports.some((r) => r.branch_id === filters.branch && r.loan_officer_id === o.id)
      );
    }
    if (filters.region) {
      const branchIds = branches.filter((b) => b.region_id === filters.region).map((b) => b.id);
      return officers.filter((o) =>
        rawReports.some((r) => branchIds.includes(r.branch_id) && r.loan_officer_id === o.id)
      );
    }
    return officers;
  }, [branches, filters.branch, filters.region, rawReports, officers]);

  const allProducts = useMemo(() => {
    return [...new Set(rawReports.map((r) => r.loan_product).filter(Boolean))];
  }, [rawReports]);

  // ========== Reset Page on Filter Change ==========
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // ========== Handlers ==========
  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      if (key === "region") {
        newFilters.branch = "";
        newFilters.loanOfficer = "";
      }
      if (key === "branch") {
        newFilters.loanOfficer = "";
      }
      return newFilters;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      region: "",
      branch: "",
      loanOfficer: "",
      status: "all",
      product: "",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    });
  }, []);

  // ========== Export Functions ==========
  const getCurrentTimestamp = useCallback(() => {
    const now = new Date();
    return now.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  }, []);

  const formatCurrency = useCallback((num) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);
  }, []);

  const handleExport = useCallback(async () => {
    if (allLoans.length === 0) return alert("No data to export");
    const companyName = tenant?.company_name || "Company";
    const companySlug = companyName.toLowerCase().replace(/ /g, "-");
    const dateStr = new Date().toISOString().split("T")[0];

    if (exportFormat === "csv") exportToCSV(companySlug, dateStr);
    else if (exportFormat === "excel") exportToExcel(companySlug, dateStr);
    else if (exportFormat === "pdf") exportToPDF(companyName, dateStr);
    else if (exportFormat === "word") exportToWord(companyName, dateStr);
  }, [allLoans, exportFormat, tenant]);

  const exportToPDF = (companyName, dateStr) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${companyName} - Outstanding Loan Balance Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${getCurrentTimestamp()}`, 14, 22);

    const headers = [[
      "No.", "Branch", "Officer", "Customer", "ID Number", "Mobile",
      "Principal", "Interest", "Total", "Paid", "Balance", "Arrears", "Status"
    ]];
    const rows = allLoans.map((r, i) => [
      i + 1, r.branch, r.loan_officer, r.customer_name, r.customer_id, r.mobile,
      formatCurrency(r.principal).replace("KES", ""),
      formatCurrency(r.interest).replace("KES", ""),
      formatCurrency(r.total_amount).replace("KES", ""),
      formatCurrency(r.total_amount_paid).replace("KES", ""),
      formatCurrency(r.balance).replace("KES", ""),
      formatCurrency(r.arrears_amount).replace("KES", ""),
      r.repayment_state
    ]);

    autoTable(doc, { head: headers, body: rows, startY: 28, styles: { fontSize: 7 } });
    doc.save(`${companyName.replace(/ /g, "_")}_Outstanding_Balance_${dateStr}.pdf`);
  };

  const exportToExcel = (companySlug, dateStr) => {
    const ws = XLSX.utils.json_to_sheet(
      allLoans.map((r, i) => ({
        No: i + 1,
        Branch: r.branch,
        Officer: r.loan_officer,
        Customer: r.customer_name,
        ID: r.customer_id,
        Mobile: r.mobile,
        Principal: r.principal,
        Interest: r.interest,
        Total: r.total_amount,
        Paid: r.total_amount_paid,
        Balance: r.balance,
        Arrears: r.arrears_amount,
        Status: r.repayment_state,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding Balance");
    XLSX.writeFile(wb, `${companySlug}-outstanding-balance-${dateStr}.xlsx`);
  };

  const exportToWord = async (companyName, dateStr) => {
    const tableRows = allLoans.slice(0, 50).map((r, i) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(String(i + 1))] }),
          new TableCell({ children: [new Paragraph(r.customer_name)] }),
          new TableCell({ children: [new Paragraph(r.loan_officer)] }),
          new TableCell({ children: [new Paragraph(formatCurrency(r.total_amount))] }),
          new TableCell({ children: [new Paragraph(formatCurrency(r.balance))] }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${companyName} - Outstanding Balance`,
                  bold: true,
                  size: 28,
                }),
              ],
            }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph("No")] }),
                    new TableCell({ children: [new Paragraph("Customer")] }),
                    new TableCell({ children: [new Paragraph("Officer")] }),
                    new TableCell({ children: [new Paragraph("Total Amount")] }),
                    new TableCell({ children: [new Paragraph("Balance")] }),
                  ],
                }),
                ...tableRows,
              ],
            }),
          ],
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${companyName.replace(/ /g, "_")}_Outstanding_Balance_${dateStr}.docx`);
  };

  const exportToCSV = (companySlug, dateStr) => {
    const headers = [
      "Branch",
      "Officer",
      "Customer",
      "Mobile",
      "ID",
      "Principal",
      "Interest",
      "Total",
      "Paid",
      "Balance",
      "Arrears",
      "Overdue Days",
      "Disbursement",
      "End Date",
    ];
    const csvContent = [
      headers.join(","),
      ...allLoans.map((r) =>
        [
          r.branch,
          r.loan_officer,
          `"${r.customer_name}"`,
          r.mobile,
          r.customer_id,
          r.principal,
          r.interest,
          r.total_amount,
          r.total_amount_paid,
          r.balance,
          r.arrears_amount,
          r.overdue_days,
          r.disbursement_date,
          r.loan_end_date,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${companySlug}-outstanding-balance-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ========== Date Filter Options ==========
  const dateFilterOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
    { value: "custom", label: "Custom Range" },
  ];

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "pdf", label: "PDF" },
    { value: "word", label: "Word" },
  ];

  // ✅ Show loading state with custom Spinner
  if (loading && rawReports.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading Outstanding Loan Balance Report..." />
      </div>
    );
  }

  // ✅ Show error state with retry option
  if (error && rawReports.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <X className="w-16 h-16 mx-auto mb-2" />
            <p className="text-lg font-semibold">Failed to load report</p>
            <p className="text-sm text-gray-600 mt-2">{error}</p>
          </div>
          <button
            onClick={handleManualRefresh}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-brand-secondary transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface p-4 sm:p-6 lg:p-8">
      <div className="max-w-full mx-auto space-y-8">
        {/* COMPACT HEADER */}
        <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt="Company Logo"
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 font-bold text-lg">
                  {tenant?.company_name?.charAt(0) || "C"}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">
                  {tenant?.company_name || "Jasiri Capital"}
                </h1>
                <h2 className="text-sm font-semibold text-white/90">OLB Report</h2>
              </div>
            </div>

            {/* CONSOLIDATED CONTROLS */}
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox
                value={filters.search}
                onChange={(val) => handleFilterChange("search", val)}
              />
              <button
                onClick={handleManualRefresh}
                disabled={loading}
                className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border text-gray-600 border-gray-200 hover:bg-brand-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border ${
                  showFilters
                    ? "bg-accent text-white border-transparent"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>

              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
                >
                  {exportFormatOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleExport}
                  className="ml-1 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-amber-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Balance</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(totals.outstanding)}
            </p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Principal Outstanding</p>
            <p className="text-2xl font-bold mt-1 text-accent">
              {formatCurrency(totals.principal)}
            </p>
          </div>
          <div className="bg-purple-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted font-medium">Number of Loans</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                ACTIVE
              </span>
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-900">{totals.count}</p>
          </div>
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                Advanced Filtering
              </h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Date Range
                </label>
                <select
                  value={filters.dateFilter}
                  onChange={(e) => handleFilterChange("dateFilter", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  {dateFilterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {filters.dateFilter === "custom" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={filters.customStartDate}
                      onChange={(e) => handleFilterChange("customStartDate", e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={filters.customEndDate}
                      onChange={(e) => handleFilterChange("customEndDate", e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Region
                </label>
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange("region", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="">All Regions</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Branch
                </label>
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="">All Branches</option>
                  {getFilteredBranches().map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Officer
                </label>
                <select
                  value={filters.loanOfficer}
                  onChange={(e) => handleFilterChange("loanOfficer", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="">All Officers</option>
                  {getFilteredOfficers().map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Product
                </label>
                <select
                  value={filters.product}
                  onChange={(e) => handleFilterChange("product", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="">All Products</option>
                  {allProducts.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="all">All States</option>
                  <option value="current">Current</option>
                  <option value="overdue">Overdue</option>
                  <option value="defaulted">Defaulted</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={clearFilters}
                className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5 ml-1"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </button>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Showing {allLoans.length} matches
              </p>
            </div>
          </div>
        )}

        {/* GRANULAR DATA TABLE */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {loading ? (
            <div className="p-8 text-center bg-slate-50/50">
              <div className="flex justify-center">
                <RefreshCw className="w-10 h-10 animate-spin text-brand-primary" />
              </div>
              <p className="text-gray-500 font-medium mt-4">Loading outstanding loans data...</p>
            </div>
          ) : allLoans.length === 0 ? (
            <div className="p-8 text-center py-20">
              <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-bold">No outstanding loans found.</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-brand-primary text-sm font-bold hover:underline"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-20">
                    <tr>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs border-r border-gray-200">
                        Branch
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs border-r border-gray-200">
                        Branch Total
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs border-r border-gray-200">
                        Loan Officer
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs border-r border-gray-200">
                        Officer Portfolio
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">
                        Customer Name
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">
                        Phone
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">
                        ID Number
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">
                        Principal
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">
                        Interest
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">
                        Total Amount
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">
                        Instal.
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">
                        Prin Paid
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">
                        Int Paid
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">
                        Total Paid
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">
                        % Paid
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">
                        % Unpaid
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs font-bold text-blue-800">
                        Balance
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs font-bold text-red-800">
                        Arrears
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">
                        Overdue
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">
                        Disbursed
                      </th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">
                        End Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.map((branch) => {
                      let loanCounter = 0;
                      const branchRowSpan = branch.officers.reduce(
                        (sum, o) => sum + o.loans.length,
                        0
                      );
                      return branch.officers.map((officer, officerIdx) => {
                        const officerRowSpan = officer.loans.length;
                        const officerLoans = officer.loans.slice(
                          Math.max(0, pagination.startIdx - loanCounter),
                          Math.max(0, pagination.endIdx - loanCounter)
                        );
                        loanCounter += officer.loans.length;

                        if (officerLoans.length === 0) return null;

                        return officerLoans.map((loan, loanIdx) => {
                          const isFirstInBranch = officerIdx === 0 && loanIdx === 0;
                          const isFirstInOfficer = loanIdx === 0;

                          return (
                            <OutstandingLoanRow
                              key={loan.id}
                              loan={loan}
                              isFirstInBranch={isFirstInBranch}
                              isFirstInOfficer={isFirstInOfficer}
                              branchRowSpan={branchRowSpan}
                              officerRowSpan={officerRowSpan}
                              branchTotal={branch.totalOutstanding}
                              officerTotal={officer.totalOutstanding}
                            />
                          );
                        });
                      });
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="bg-slate-50/50 px-6 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm font-medium text-slate-500">
                  Showing{" "}
                  <span className="font-bold text-slate-700">
                    {pagination.startIdx + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-bold text-slate-700">
                    {Math.min(pagination.endIdx, pagination.totalRows)}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-slate-900">
                    {pagination.totalRows}
                  </span>{" "}
                  entries
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }).map(
                      (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= pagination.totalPages - 2)
                          pageNum = pagination.totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`min-w-[40px] h-10 rounded-xl font-bold transition-all shadow-sm ${
                              currentPage === pageNum
                                ? "bg-brand-primary text-white scale-105 shadow-brand-primary/20"
                                : "bg-white border border-slate-200 text-slate-600 hover:border-brand-primary/30 hover:bg-slate-50"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))
                    }
                    disabled={currentPage === pagination.totalPages}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutstandingLoanBalanceReport;