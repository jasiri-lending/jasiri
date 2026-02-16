import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
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
      placeholder="Search name, ID, or phone"
      className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm w-64 text-gray-900"
    />
  </div>
));
SearchBox.displayName = "SearchBox";

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort }) => {
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 whitespace-nowrap text-left text-xs tracking-wider border-b"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        {sortConfig.key === sortKey &&
          (sortConfig.direction === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </div>
    </th>
  );
});
SortableHeader.displayName = "SortableHeader";

const StatusBadge = React.memo(({ status }) => {
  const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  let classes = "";

  switch (status?.toLowerCase()) {
    case "disbursed":
    case "completed":
    case "paid":
    case "current":
      classes = `${baseClasses} bg-emerald-100 text-emerald-800 border border-emerald-200`;
      break;
    case "approved":
      classes = `${baseClasses} bg-blue-100 text-blue-800 border border-blue-200`;
      break;
    case "pending":
    case "ca_review":
    case "processing":
      classes = `${baseClasses} bg-amber-100 text-amber-800 border border-amber-200`;
      break;
    case "rejected":
    case "defaulted":
    case "overdue":
      classes = `${baseClasses} bg-red-100 text-red-800 border border-red-200`;
      break;
    default:
      classes = `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`;
  }

  return <span className={classes}>{status?.replace(/_/g, " ")}</span>;
});
StatusBadge.displayName = "StatusBadge";

const LoanTableRow = React.memo(({ loan, index, startIdx, formatCurrency, formatDate }) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{startIdx + index + 1}</td>
      <td className="px-4 py-3 text-xs text-gray-700 font-medium min-w-[150px] max-w-xs break-words">
        {loan.customer_name}
      </td>
      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{loan.customer_id}</td>
      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap w-36">{loan.mobile}</td>
      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{loan.branch}</td>
      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{loan.loan_officer}</td>
      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{loan.loan_product}</td>
      <td className="px-4 py-3 text-center whitespace-nowrap">
        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
          {loan.product_type}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
        {formatCurrency(loan.applied_amount)}
      </td>
      <td className="px-4 py-3 text-right text-xs font-semibold text-green-700 whitespace-nowrap">
        {formatCurrency(loan.disbursed_amount)}
      </td>
      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
        {formatCurrency(loan.total_payable)}
      </td>
      <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 whitespace-nowrap">
        {formatCurrency(loan.total_repaid)}
      </td>
      <td className="px-4 py-3 text-right text-xs text-gray-700 whitespace-nowrap">
        {formatCurrency(loan.weekly_payment)}
      </td>
      <td className="px-4 py-3 text-center text-xs text-gray-700 whitespace-nowrap">
        {loan.duration_weeks} weeks
      </td>
      <td className="px-4 py-3 text-center text-xs text-gray-700 whitespace-nowrap">
        {loan.interest_rate.toFixed(2)}%
      </td>
      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
        {formatDate(loan.booked_date)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
        {loan.disbursed_date ? formatDate(loan.disbursed_date) : "Pending"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={loan.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={loan.repayment_state} />
      </td>
    </tr>
  );
});
LoanTableRow.displayName = "LoanTableRow";

// ========== Main Component ==========

const LoanListing = () => {
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
  const [rawLoans, setRawLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [statusTypes, setStatusTypes] = useState([]);
  const [repaymentStates, setRepaymentStates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // ✅ Add error state
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "booked_date", direction: "desc" });
  const [exportFormat, setExportFormat] = useState("csv");

  const itemsPerPage = 50;

  // ========== Combined Filters State (persisted) ==========
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("loan-listing-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          search: parsed.search || "",
          region: parsed.region || "",
          branch: parsed.branch || "",
          loanOfficer: parsed.loanOfficer || "",
          productType: parsed.productType || "all",
          status: parsed.status || "all",
          repaymentState: parsed.repaymentState || "all",
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
      productType: "all",
      status: "all",
      repaymentState: "all",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    };
  });

  // ========== Refs ==========
  const hasFetchedLoansRef = useRef(false);
  const hasFetchedBranchesRef = useRef(false);
  const isMountedRef = useRef(true); // ✅ Track mount state

  // ========== Debounced Save Filters ==========
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("loan-listing-filters", JSON.stringify(filters));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // ========== FIXED: Fetch Branches and Regions (ONCE) ==========
  useEffect(() => {
    const tenantId = tenant?.id;
    
    // Early return if no tenant or already fetched
    if (!tenantId || hasFetchedBranchesRef.current) {
      console.log("⏭️ Skipping branches fetch - tenantId:", tenantId, "hasFetched:", hasFetchedBranchesRef.current);
      return;
    }

    // Mark as fetched IMMEDIATELY
    hasFetchedBranchesRef.current = true;
    isMountedRef.current = true;

    const fetchBranchesAndRegions = async () => {
      console.log("🔄 Fetching branches and regions for tenant:", tenantId);
      
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Branches fetch timeout')), 15000)
        );

        const fetchPromise = supabase
          .from("branches")
          .select(`
            id,
            name,
            region_id,
            regions (
              name
            )
          `)
          .eq("tenant_id", tenantId)
          .order("name");

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) throw error;

        if (!isMountedRef.current) {
          console.log("🧹 Component unmounted during branches fetch");
          return;
        }

        const flattened = data.map(b => ({
          ...b,
          region: b.regions?.name || "N/A"
        }));
        
        setBranches(flattened);
        
        const uniqueRegions = [...new Set(flattened.map(b => b.region).filter(r => r && r !== "N/A"))];
        setRegions(uniqueRegions);
        
        console.log("✅ Branches loaded:", flattened.length);
        console.log("✅ Regions loaded:", uniqueRegions.length);
      } catch (err) {
        console.error("❌ Error fetching branches/regions:", err);
        // Non-critical error - continue without branches/regions
      }
    };

    fetchBranchesAndRegions();

    return () => { 
      isMountedRef.current = false; 
    };
  }, [tenant?.id]);

  // ========== FIXED: Fetch All Loans (ONCE with Caching) ==========
  useEffect(() => {
    const tenantId = tenant?.id;
    
    // Early return if no tenant or already fetched
    if (!tenantId || hasFetchedLoansRef.current) {
      console.log("⏭️ Skipping loans fetch - tenantId:", tenantId, "hasFetched:", hasFetchedLoansRef.current);
      return;
    }

    // Mark as fetched IMMEDIATELY to prevent duplicate calls
    hasFetchedLoansRef.current = true;
    isMountedRef.current = true;

    const fetchAllLoans = async () => {
      console.log("🔄 Starting loans fetch for tenant:", tenantId);
      
      try {
        const cacheKey = `loan-listing-raw-data-${tenantId}`;

        // Try cache first
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const cacheAge = Date.now() - timestamp;
            
            if (cacheAge < 24 * 60 * 60 * 1000) { // 24 hours cache
              console.log("✅ Using cached loan listings data");
              if (isMountedRef.current) {
                setRawLoans(data.loans || []);
                setOfficers(data.officers || []);
                setProductTypes(data.productTypes || []);
                setStatusTypes(data.statusTypes || []);
                setRepaymentStates(data.repaymentStates || []);
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

        console.log("🌐 Fetching loans from database...");

        // Fetch with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 45000)
        );

        const fetchPromise = supabase
          .from("loans")
          .select(`
            id,
            customer_id,
            branch_id,
            booked_by,
            product_name,
            product_type,
            status,
            repayment_state,
            total_payable,
            duration_weeks,
            interest_rate,
            disbursed_at,
            booked_at,
            processing_fee,
            registration_fee,
            weekly_payment,
            approved_by_bm,
            approved_by_bm_at,
            approved_by_rm,
            approved_by_rm_at,
            bm_decision,
            rm_decision,
            scored_amount,
            prequalified_amount,
            customers (
              id,
              Firstname,
              Middlename,
              Surname,
              id_number,
              mobile
            ),
            branches (
              id,
              name,
              regions (
                name
              )
            ),
            booked_by_user:users!loans_created_by_fkey (id, full_name),
            bm_user:users!loans_approved_by_bm_fkey (id, full_name),
            rm_user:users!loans_approved_by_rm_fkey (id, full_name),
            loan_installments (
              loan_id,
              paid_amount,
              due_amount,
              status
            )
          `)
          .eq("tenant_id", tenantId)
          .order("booked_at", { ascending: false });

        const { data, error: fetchError } = await Promise.race([fetchPromise, timeoutPromise]);

        if (fetchError) throw fetchError;

        console.log("✅ Loans fetched:", data?.length || 0);

        if (!isMountedRef.current) {
          console.log("🧹 Component unmounted during fetch");
          return;
        }

        const loansData = data || [];

        console.log("🔄 Processing loans data...");

        const processedLoans = loansData.map((loan) => {
          const customer = loan.customers;
          const branch = loan.branches;
          const loanOfficer = loan.booked_by_user;
          const branchManager = loan.bm_user;
          const regionManager = loan.rm_user;

          const loanInstallments = loan.loan_installments || [];
          const totalRepaid = loanInstallments.reduce((sum, inst) => sum + (Number(inst.paid_amount) || 0), 0);
          const totalDue = loanInstallments.reduce((sum, inst) => sum + (Number(inst.due_amount) || 0), 0);
          const overdueInstallments = loanInstallments.filter(
            (inst) => inst.status === 'overdue' || inst.status === 'defaulted'
          ).length;

          const customerName = customer
            ? `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim()
            : "N/A";

          const prequalifiedAmount = Number(loan.prequalified_amount) || 0;
          const disbursedAmount = Number(loan.scored_amount) || 0;

          const bookedDate = loan.booked_at ? new Date(loan.booked_at) : null;
          const disbursedDate = loan.disbursed_at ? new Date(loan.disbursed_at) : null;
          const bmApprovedDate = loan.approved_by_bm_at ? new Date(loan.approved_by_bm_at) : null;
          const rmApprovedDate = loan.approved_by_rm_at ? new Date(loan.approved_by_rm_at) : null;

          const now = new Date();
          const daysSinceBooking = bookedDate ? Math.floor((now - bookedDate) / (1000 * 60 * 60 * 24)) : 0;
          const daysSinceDisbursement = disbursedDate ? Math.floor((now - disbursedDate) / (1000 * 60 * 60 * 24)) : null;
          const daysSinceBMApproval = bmApprovedDate ? Math.floor((now - bmApprovedDate) / (1000 * 60 * 60 * 24)) : null;
          const daysSinceRMApproval = rmApprovedDate ? Math.floor((now - rmApprovedDate) / (1000 * 60 * 60 * 24)) : null;

          return {
            id: loan.id,
            customer_name: customerName,
            customer_id: customer?.id_number || "N/A",
            mobile: customer?.mobile || "N/A",
            branch: branch?.name || "N/A",
            region: branch?.regions?.name || "N/A",
            loan_officer: loanOfficer?.full_name || "N/A",
            branch_manager: branchManager?.full_name || "N/A",
            region_manager: regionManager?.full_name || "N/A",
            loan_product: loan.product_name || "N/A",
            product_type: loan.product_type || "N/A",
            applied_amount: prequalifiedAmount,
            disbursed_amount: disbursedAmount,
            total_repaid: totalRepaid,
            total_payable: Number(loan.total_payable) || 0,
            weekly_payment: Number(loan.weekly_payment) || 0,
            duration_weeks: loan.duration_weeks || 0,
            interest_rate: Number(loan.interest_rate) || 0,
            booked_date: loan.booked_at,
            disbursed_date: loan.disbursed_at,
            status: loan.status || "N/A",
            repayment_state: loan.repayment_state || "N/A",
            total_due: totalDue,
            overdue_installments: overdueInstallments,
            total_installments: loanInstallments.length,
            processing_fee: Number(loan.processing_fee) || 0,
            registration_fee: Number(loan.registration_fee) || 0,
            net_disbursement: disbursedAmount - (Number(loan.processing_fee) || 0) - (Number(loan.registration_fee) || 0),
            bm_approved_date: loan.approved_by_bm_at,
            rm_approved_date: loan.approved_by_rm_at,
            days_since_booking: daysSinceBooking,
            days_since_disbursement: daysSinceDisbursement,
            days_since_bm_approval: daysSinceBMApproval,
            days_since_rm_approval: daysSinceRMApproval,
            bm_decision: loan.bm_decision || "N/A",
            rm_decision: loan.rm_decision || "N/A",
            raw_booked_date: loan.booked_at,
          };
        });

        console.log("✅ Loans processed:", processedLoans.length);

        // Generate unique filter options
        const uniqueOfficers = [...new Set(processedLoans.map(r => r.loan_officer).filter(o => o !== "N/A"))];
        const uniqueProductTypes = [...new Set(processedLoans.map(r => r.product_type).filter(Boolean))];
        const uniqueStatusTypes = [...new Set(processedLoans.map(r => r.status).filter(Boolean))];
        const uniqueRepaymentStates = [...new Set(processedLoans.map(r => r.repayment_state).filter(Boolean))];

        const cacheData = {
          loans: processedLoans,
          officers: uniqueOfficers,
          productTypes: uniqueProductTypes,
          statusTypes: uniqueStatusTypes,
          repaymentStates: uniqueRepaymentStates,
        };

        if (isMountedRef.current) {
          setRawLoans(processedLoans);
          setOfficers(uniqueOfficers);
          setProductTypes(uniqueProductTypes);
          setStatusTypes(uniqueStatusTypes);
          setRepaymentStates(uniqueRepaymentStates);
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
        console.error("❌ Error fetching loan listings:", err);
        if (isMountedRef.current) {
          setError(err.message || "Failed to load loan listings");
          setLoading(false);
          setRawLoans([]); // ✅ Set empty array on error
        }
      }
    };

    fetchAllLoans();

    // Cleanup function
    return () => {
      console.log("🧹 Cleanup: Component unmounting");
      isMountedRef.current = false;
    };
  }, [tenant?.id]);

  // ========== Manual Refresh ==========
  const handleManualRefresh = useCallback(async () => {
    const tenantId = tenant?.id;
    if (!tenantId || loading) return;

    console.log("🔄 Manual refresh triggered");

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("loans")
        .select(`
          id,
          customer_id,
          branch_id,
          booked_by,
          product_name,
          product_type,
          status,
          repayment_state,
          total_payable,
          duration_weeks,
          interest_rate,
          disbursed_at,
          booked_at,
          processing_fee,
          registration_fee,
          weekly_payment,
          approved_by_bm,
          approved_by_bm_at,
          approved_by_rm,
          approved_by_rm_at,
          bm_decision,
          rm_decision,
          scored_amount,
          prequalified_amount,
          customers (
            id,
            Firstname,
            Middlename,
            Surname,
            id_number,
            mobile
          ),
          branches (
            id,
            name,
            regions (
              name
            )
          ),
          booked_by_user:users!loans_created_by_fkey (id, full_name),
          bm_user:users!loans_approved_by_bm_fkey (id, full_name),
          rm_user:users!loans_approved_by_rm_fkey (id, full_name),
          loan_installments (
            loan_id,
            paid_amount,
            due_amount,
            status
          )
        `)
        .eq("tenant_id", tenantId)
        .order("booked_at", { ascending: false });

      if (fetchError) throw fetchError;

      const loansData = data || [];

      const processedLoans = loansData.map((loan) => {
        const customer = loan.customers;
        const branch = loan.branches;
        const loanOfficer = loan.booked_by_user;
        const branchManager = loan.bm_user;
        const regionManager = loan.rm_user;

        const loanInstallments = loan.loan_installments || [];
        const totalRepaid = loanInstallments.reduce((sum, inst) => sum + (Number(inst.paid_amount) || 0), 0);
        const totalDue = loanInstallments.reduce((sum, inst) => sum + (Number(inst.due_amount) || 0), 0);
        const overdueInstallments = loanInstallments.filter(
          (inst) => inst.status === 'overdue' || inst.status === 'defaulted'
        ).length;

        const customerName = customer
          ? `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim()
          : "N/A";

        const prequalifiedAmount = Number(loan.prequalified_amount) || 0;
        const disbursedAmount = Number(loan.scored_amount) || 0;

        const bookedDate = loan.booked_at ? new Date(loan.booked_at) : null;
        const disbursedDate = loan.disbursed_at ? new Date(loan.disbursed_at) : null;
        const bmApprovedDate = loan.approved_by_bm_at ? new Date(loan.approved_by_bm_at) : null;
        const rmApprovedDate = loan.approved_by_rm_at ? new Date(loan.approved_by_rm_at) : null;

        const now = new Date();
        const daysSinceBooking = bookedDate ? Math.floor((now - bookedDate) / (1000 * 60 * 60 * 24)) : 0;
        const daysSinceDisbursement = disbursedDate ? Math.floor((now - disbursedDate) / (1000 * 60 * 60 * 24)) : null;
        const daysSinceBMApproval = bmApprovedDate ? Math.floor((now - bmApprovedDate) / (1000 * 60 * 60 * 24)) : null;
        const daysSinceRMApproval = rmApprovedDate ? Math.floor((now - rmApprovedDate) / (1000 * 60 * 60 * 24)) : null;

        return {
          id: loan.id,
          customer_name: customerName,
          customer_id: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          branch: branch?.name || "N/A",
          region: branch?.regions?.name || "N/A",
          loan_officer: loanOfficer?.full_name || "N/A",
          branch_manager: branchManager?.full_name || "N/A",
          region_manager: regionManager?.full_name || "N/A",
          loan_product: loan.product_name || "N/A",
          product_type: loan.product_type || "N/A",
          applied_amount: prequalifiedAmount,
          disbursed_amount: disbursedAmount,
          total_repaid: totalRepaid,
          total_payable: Number(loan.total_payable) || 0,
          weekly_payment: Number(loan.weekly_payment) || 0,
          duration_weeks: loan.duration_weeks || 0,
          interest_rate: Number(loan.interest_rate) || 0,
          booked_date: loan.booked_at,
          disbursed_date: loan.disbursed_at,
          status: loan.status || "N/A",
          repayment_state: loan.repayment_state || "N/A",
          total_due: totalDue,
          overdue_installments: overdueInstallments,
          total_installments: loanInstallments.length,
          processing_fee: Number(loan.processing_fee) || 0,
          registration_fee: Number(loan.registration_fee) || 0,
          net_disbursement: disbursedAmount - (Number(loan.processing_fee) || 0) - (Number(loan.registration_fee) || 0),
          bm_approved_date: loan.approved_by_bm_at,
          rm_approved_date: loan.approved_by_rm_at,
          days_since_booking: daysSinceBooking,
          days_since_disbursement: daysSinceDisbursement,
          days_since_bm_approval: daysSinceBMApproval,
          days_since_rm_approval: daysSinceRMApproval,
          bm_decision: loan.bm_decision || "N/A",
          rm_decision: loan.rm_decision || "N/A",
          raw_booked_date: loan.booked_at,
        };
      });

      const uniqueOfficers = [...new Set(processedLoans.map(r => r.loan_officer).filter(o => o !== "N/A"))];
      const uniqueProductTypes = [...new Set(processedLoans.map(r => r.product_type).filter(Boolean))];
      const uniqueStatusTypes = [...new Set(processedLoans.map(r => r.status).filter(Boolean))];
      const uniqueRepaymentStates = [...new Set(processedLoans.map(r => r.repayment_state).filter(Boolean))];

      setRawLoans(processedLoans);
      setOfficers(uniqueOfficers);
      setProductTypes(uniqueProductTypes);
      setStatusTypes(uniqueStatusTypes);
      setRepaymentStates(uniqueRepaymentStates);

      const cacheKey = `loan-listing-raw-data-${tenantId}`;
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data: {
              loans: processedLoans,
              officers: uniqueOfficers,
              productTypes: uniqueProductTypes,
              statusTypes: uniqueStatusTypes,
              repaymentStates: uniqueRepaymentStates,
            },
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.error("Cache write error:", e);
      }

      console.log("✅ Manual refresh complete");
    } catch (err) {
      console.error("❌ Error refreshing loan listings:", err);
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  }, [loading, tenant?.id]);

  // ========== Helper: Get Date Range ==========
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

  // ========== Filtered Data ==========
  const filteredData = useMemo(() => {
    let result = [...rawLoans];
    const q = filters.search.toLowerCase();

    // Text search
    if (filters.search) {
      result = result.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          r.customer_id.includes(q)
      );
    }

    // Region filter
    if (filters.region) {
      result = result.filter((r) => r.region === filters.region);
    }

    // Branch filter
    if (filters.branch) {
      result = result.filter((r) => r.branch === filters.branch);
    }

    // Loan officer filter
    if (filters.loanOfficer) {
      result = result.filter((r) => r.loan_officer === filters.loanOfficer);
    }

    // Product type filter
    if (filters.productType !== "all") {
      result = result.filter((r) => r.product_type === filters.productType);
    }

    // Status filter
    if (filters.status !== "all") {
      result = result.filter((r) => r.status === filters.status);
    }

    // Repayment state filter
    if (filters.repaymentState !== "all") {
      result = result.filter((r) => r.repayment_state === filters.repaymentState);
    }

    // Date filter
    if (filters.dateFilter !== "all") {
      const range = getDateRange(filters.dateFilter);
      if (range) {
        result = result.filter((loan) => {
          if (!loan.raw_booked_date) return false;
          const bookedDate = new Date(loan.raw_booked_date);
          return bookedDate >= range.start && bookedDate <= range.end;
        });
      }
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawLoans, filters, sortConfig, getDateRange]);

  // ========== Summary Statistics ==========
  const stats = useMemo(() => {
    const totalLoans = filteredData.length;

    const disbursedLoans = filteredData.filter((r) => r.status.toLowerCase() === "disbursed");

    const totalPrincipal = disbursedLoans.reduce((sum, r) => sum + (r.disbursed_amount || 0), 0);
    const totalPayable = disbursedLoans.reduce((sum, r) => sum + (r.total_payable || 0), 0);
    const totalRepaid = disbursedLoans.reduce((sum, r) => sum + (r.total_repaid || 0), 0);
    const totalDue = disbursedLoans.reduce((sum, r) => sum + (r.total_due || 0), 0);
    const totalOutstanding = totalPayable - totalRepaid;
    const activeLoans = disbursedLoans.length;
    const overdueLoans = disbursedLoans.filter(
      (r) =>
        r.repayment_state.toLowerCase() === "overdue" ||
        r.repayment_state.toLowerCase() === "defaulted"
    ).length;

    return {
      totalLoans,
      totalPrincipal,
      totalPayable,
      totalRepaid,
      totalDue,
      totalOutstanding,
      activeLoans,
      overdueLoans,
    };
  }, [filteredData]);

  // ========== Pagination ==========
  const pagination = useMemo(() => {
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    const currentData = filteredData.slice(startIdx, endIdx);
    return { totalRows, totalPages, startIdx, endIdx, currentData };
  }, [filteredData, currentPage]);

  // ========== Filtered Branches / Officers for Dropdowns ==========
  const filteredBranches = useMemo(() => {
    if (!filters.region) return branches;
    return branches.filter((b) => b.region === filters.region);
  }, [branches, filters.region]);

  const filteredOfficers = useMemo(() => {
    if (filters.branch) {
      return officers.filter((o) =>
        rawLoans.some((r) => r.branch === filters.branch && r.loan_officer === o)
      );
    }
    if (filters.region) {
      return officers.filter((o) =>
        rawLoans.some(
          (r) => r.region === filters.region && r.loan_officer === o
        )
      );
    }
    return officers;
  }, [officers, filters.branch, filters.region, rawLoans]);

  // ========== Handlers ==========
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

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
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      region: "",
      branch: "",
      loanOfficer: "",
      productType: "all",
      status: "all",
      repaymentState: "all",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    });
    setCurrentPage(1);
  }, []);

  // ========== Formatting Helpers ==========
  const formatCurrency = useCallback((num) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  const getCurrentTimestamp = useCallback(() => {
    const now = new Date();
    return now.toLocaleString("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, []);

  // ========== Export Functions (keeping implementations the same) ==========
  const exportToPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "pt" });
    const companyName = tenant?.company_name || "Jasiri";
    const reportTitle = "Loan Listing Report";

    autoTable(doc, {
      head: [
        [
          "No",
          "Customer Name",
          "ID Number",
          "Mobile",
          "Region",
          "Branch",
          "Loan Officer",
          "Loan Product",
          "Product Type",
          "Prequalified Amt",
          "Disbursed Amt",
          "Total Payable",
          "Total Repaid",
          "Weekly Payment",
          "Weeks",
          "Rate (%)",
          "Booked",
          "Disbursed",
          "Status",
          "Repayment",
        ],
      ],
      body: filteredData.map((r, i) => [
        i + 1,
        r.customer_name,
        r.customer_id,
        r.mobile,
        r.region,
        r.branch,
        r.loan_officer,
        r.loan_product,
        r.product_type,
        formatCurrency(r.applied_amount),
        formatCurrency(r.disbursed_amount),
        formatCurrency(r.total_payable),
        formatCurrency(r.total_repaid),
        formatCurrency(r.weekly_payment),
        r.duration_weeks,
        r.interest_rate.toFixed(2) + "%",
        formatDate(r.booked_date),
        r.disbursed_date ? formatDate(r.disbursed_date) : "Pending",
        r.status,
        r.repayment_state,
      ]),
      didDrawPage: (data) => {
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(companyName, data.settings.margin.left, 40);
        doc.setFontSize(12);
        doc.text(reportTitle, data.settings.margin.left, 60);
        doc.setFontSize(10);
        doc.text(
          `Generated on: ${getCurrentTimestamp()} | Total Loans: ${filteredData.length}`,
          data.settings.margin.left,
          80
        );
      },
      startY: 100,
      margin: { top: 100 },
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [46, 94, 153], textColor: [255, 255, 255] },
    });

    const fileName = `${companyName.toLowerCase().replace(/ /g, "_")}_loans_${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    doc.save(fileName);
  }, [filteredData, tenant, formatCurrency, formatDate, getCurrentTimestamp]);

  const exportToExcel = useCallback(() => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(
      filteredData.map((r, index) => ({
        No: index + 1,
        "Customer Name": r.customer_name,
        "ID Number": r.customer_id,
        Mobile: r.mobile,
        Region: r.region,
        Branch: r.branch,
        "Loan Officer": r.loan_officer,
        "Loan Product": r.loan_product,
        "Product Type": r.product_type,
        "Prequalified Amount": r.applied_amount,
        "Disbursed Amount": r.disbursed_amount,
        "Total Payable": r.total_payable,
        "Total Repaid": r.total_repaid,
        "Weekly Payment": r.weekly_payment,
        "Duration (Weeks)": r.duration_weeks,
        "Interest Rate (%)": r.interest_rate,
        "Booked Date": formatDate(r.booked_date),
        "Disbursed Date": r.disbursed_date ? formatDate(r.disbursed_date) : "Pending",
        Status: r.status,
        "Repayment State": r.repayment_state,
      }))
    );

    const companyName = tenant?.company_name || "Jasiri";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loan Listing");
    XLSX.writeFile(
      wb,
      `${companyName.toLowerCase().replace(/ /g, "_")}_loans_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );
  }, [filteredData, tenant, formatDate]);

  const exportToCSV = useCallback(() => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "No",
      "Customer Name",
      "ID Number",
      "Mobile",
      "Region",
      "Branch",
      "Loan Officer",
      "Loan Product",
      "Product Type",
      "Prequalified Amount",
      "Disbursed Amount",
      "Total Payable",
      "Total Repaid",
      "Weekly Payment",
      "Duration (Weeks)",
      "Interest Rate (%)",
      "Booked Date",
      "Disbursed Date",
      "Status",
      "Repayment State",
    ];

    const rows = filteredData.map((r, i) => [
      i + 1,
      r.customer_name,
      r.customer_id,
      r.mobile,
      r.region,
      r.branch,
      r.loan_officer,
      r.loan_product,
      r.product_type,
      r.applied_amount.toFixed(2),
      r.disbursed_amount.toFixed(2),
      r.total_payable.toFixed(2),
      r.total_repaid.toFixed(2),
      r.weekly_payment.toFixed(2),
      r.duration_weeks,
      r.interest_rate.toFixed(2),
      formatDate(r.booked_date),
      r.disbursed_date ? formatDate(r.disbursed_date) : "N/A",
      r.status,
      r.repayment_state,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((field) =>
            typeof field === "string" && field.includes(",") ? `"${field}"` : field
          )
          .join(",")
      ),
    ].join("\n");

    const companyName = tenant?.company_name || "Jasiri";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `${companyName.toLowerCase().replace(/ /g, "_")}_loans_${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
  }, [filteredData, tenant, formatDate]);

  const exportToWord = useCallback(async () => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    const rows = filteredData.slice(0, 50).map(
      (r, i) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(i + 1))] }),
            new TableCell({ children: [new Paragraph(r.customer_name)] }),
            new TableCell({ children: [new Paragraph(r.customer_id)] }),
            new TableCell({ children: [new Paragraph(r.mobile)] }),
            new TableCell({ children: [new Paragraph(r.branch)] }),
            new TableCell({ children: [new Paragraph(r.loan_officer)] }),
            new TableCell({ children: [new Paragraph(r.loan_product)] }),
            new TableCell({ children: [new Paragraph(formatCurrency(r.disbursed_amount))] }),
            new TableCell({ children: [new Paragraph(formatCurrency(r.total_payable))] }),
            new TableCell({ children: [new Paragraph(r.status)] }),
          ],
        })
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${tenant?.company_name || "Company"} - Loan Listing Report`,
                  bold: true,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on: ${getCurrentTimestamp()}`,
                  italics: true,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Total Loans: ${filteredData.length}`,
                  size: 22,
                }),
              ],
            }),
            new Paragraph(" "),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    "No.",
                    "Customer Name",
                    "ID Number",
                    "Mobile",
                    "Branch",
                    "Loan Officer",
                    "Product",
                    "Disbursed Amount",
                    "Total Payable",
                    "Status",
                  ].map(
                    (h) =>
                      new TableCell({
                        children: [new Paragraph({ text: h, bold: true })],
                      })
                  ),
                }),
                ...rows,
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const companyName = tenant?.company_name || "Jasiri";
    saveAs(
      blob,
      `${companyName.toLowerCase().replace(/ /g, "_")}_loans_${
        new Date().toISOString().split("T")[0]
      }.docx`
    );
  }, [filteredData, tenant, formatCurrency, getCurrentTimestamp]);

  const handleExport = useCallback(() => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    switch (exportFormat) {
      case "pdf":
        exportToPDF();
        break;
      case "word":
        exportToWord();
        break;
      case "excel":
        exportToExcel();
        break;
      case "csv":
      default:
        exportToCSV();
        break;
    }
  }, [exportFormat, filteredData, exportToPDF, exportToWord, exportToExcel, exportToCSV]);

  // ========== Options ==========
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
    { value: "word", label: "Word" },
    { value: "pdf", label: "PDF" },
  ];

  //  Show loading state with custom Spinner
  if (loading && rawLoans.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading Loan Listing Report..." />
      </div>
    );
  }

  // Show error state with retry option
  if (error && rawLoans.length === 0) {
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
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-brand-secondary rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt=" Logo"
                  className="h-16 w-auto object-contain"
                />
              ) : (
                <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xl">
                  {tenant?.company_name?.charAt(0) || "C"}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">{tenant?.company_name || "Company Name"}</h1>
                <h2 className="text-lg font-semibold text-white mt-1">
                  Complete Loan Listing Report
                </h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
             
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <SearchBox value={filters.search} onChange={(val) => handleFilterChange("search", val)} />

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border
                    ${
                      showFilters
                        ? "bg-accent text-white shadow-md border-transparent hover:bg-brand-secondary"
                        : "text-gray-600 border-gray-200 hover:bg-brand-secondary hover:text-white"
                    }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  {Object.values(filters).some((val) => val && val !== "all") && (
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </button>

              

                <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="bg-transparent text-sm font-medium text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
                  >
                    {exportFormatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleExport}
                    className="ml-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium 
                             hover:bg-brand-secondary transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-amber-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Loans</p>
            <p className="text-2xl font-bold mt-1 text-primary">{stats.totalLoans}</p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Disbursed</p>
            <p className="text-2xl font-bold mt-1 text-accent">{formatCurrency(stats.totalPrincipal)}</p>
          </div>
          <div className="bg-purple-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Payable</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(stats.totalPayable)}</p>
          </div>
          <div className="bg-blue-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Repaid</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{formatCurrency(stats.totalRepaid)}</p>
          </div>
          <div className="bg-red-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Outstanding Balance</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(stats.totalOutstanding)}</p>
          </div>
        </div>

        {/* Filter Section */}
        {showFilters && (
          <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-slate-600 text-sm">Filter Results</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={filters.dateFilter}
                onChange={(e) => handleFilterChange("dateFilter", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                {dateFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {filters.dateFilter === "custom" && (
                <>
                  <input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => handleFilterChange("customStartDate", e.target.value)}
                    className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  <input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => handleFilterChange("customEndDate", e.target.value)}
                    className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={filters.region}
                onChange={(e) => handleFilterChange("region", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Regions</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>

              <select
                value={filters.branch}
                onChange={(e) => handleFilterChange("branch", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Branches</option>
                {filteredBranches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.loanOfficer}
                onChange={(e) => handleFilterChange("loanOfficer", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Relationship Officers</option>
                {filteredOfficers.map((officer) => (
                  <option key={officer} value={officer}>
                    {officer}
                  </option>
                ))}
              </select>

              <select
                value={filters.productType}
                onChange={(e) => handleFilterChange("productType", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Products</option>
                {productTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Statuses</option>
                {statusTypes.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                value={filters.repaymentState}
                onChange={(e) => handleFilterChange("repaymentState", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Repayment States</option>
                {repaymentStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            {(filters.search ||
              filters.region ||
              filters.branch ||
              filters.loanOfficer ||
              filters.productType !== "all" ||
              filters.status !== "all" ||
              filters.repaymentState !== "all" ||
              filters.dateFilter !== "all") && (
              <button
                onClick={clearFilters}
                className="text-red-600 text-sm font-medium flex items-center gap-1 mt-2 hover:text-red-700"
              >
                <X className="w-4 h-4" /> Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">#</th>
                  <SortableHeader label="Customer Name" sortKey="customer_name" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="ID Number" sortKey="customer_id" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Mobile" sortKey="mobile" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Branch" sortKey="branch" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Loan Officer" sortKey="loan_officer" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Product" sortKey="loan_product" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Type" sortKey="product_type" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Prequalified Amount" sortKey="applied_amount" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Disbursed Amount" sortKey="disbursed_amount" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Total Payable" sortKey="total_payable" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Total Repaid" sortKey="total_repaid" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Weekly Payment" sortKey="weekly_payment" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Duration" sortKey="duration_weeks" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Interest" sortKey="interest_rate" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Booked Date" sortKey="booked_date" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Disbursed Date" sortKey="disbursed_date" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Repayment State" sortKey="repayment_state" sortConfig={sortConfig} onSort={handleSort} />
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={19} className="px-4 py-12 text-center">
                      <div className="flex justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Loading loan listings...</p>
                    </td>
                  </tr>
                ) : pagination.currentData.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-500">No loans found</p>
                        {(filters.search ||
                          filters.region ||
                          filters.branch ||
                          filters.loanOfficer ||
                          filters.productType !== "all" ||
                          filters.status !== "all" ||
                          filters.repaymentState !== "all" ||
                          filters.dateFilter !== "all") && (
                          <button
                            onClick={clearFilters}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                          >
                            Clear filters to see all loans
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagination.currentData.map((loan, i) => (
                    <LoanTableRow
                      key={loan.id}
                      loan={loan}
                      index={i}
                      startIdx={pagination.startIdx}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                    />
                  ))
                )}
              </tbody>

              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan="8" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                    Totals ({filteredData.length} loans):
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700 text-right">
                    {formatCurrency(stats.totalPrincipal)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700 text-right">
                    {formatCurrency(stats.totalPayable)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-emerald-700 text-right">
                    {formatCurrency(stats.totalRepaid)}
                  </td>
                  <td colSpan="7" className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 bg-white border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {pagination.startIdx + 1} to{" "}
                {Math.min(pagination.endIdx, pagination.totalRows)} of {pagination.totalRows}{" "}
                entries
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                  disabled={currentPage === pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanListing;