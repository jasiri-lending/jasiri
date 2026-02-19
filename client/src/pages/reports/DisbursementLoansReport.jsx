import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Download,
  Printer,
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
import Spinner from "../../components/Spinner";

// Memoized helper functions
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(amount || 0);

const getCurrentTimestamp = () => {
  const now = new Date();
  return now.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

// SearchBox component
const SearchBox = React.memo(({ value, onChange }) => {
  return (
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
  );
});

SearchBox.displayName = 'SearchBox';

const LoanTableRow = React.memo(({ row, index }) => {
  return (
    <tr key={`${row.id}-${index}`} className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-center text-gray-500">{row.branchNumber}</td>
      <td className="px-4 py-3 font-medium text-gray-900">{row.isFirstInBranch ? row.branch : ""}</td>
      <td className="px-4 py-3 font-medium text-gray-900">{row.isFirstInBranch ? formatCurrency(row.branchTotalAmount) : ""}</td>
      <td className="px-4 py-3 text-gray-600">{row.isFirstInOfficer ? row.loanOfficer : ""}</td>
      <td className="px-4 py-3 text-gray-600">{row.isFirstInOfficer ? formatCurrency(row.roTotalAmount) : ""}</td>
      <td className="px-4 py-3 text-gray-900">{row.customerName}</td>
      <td className="px-4 py-3 text-gray-600">{row.mobile}</td>
      <td className="px-4 py-3 text-gray-600">{row.idNumber}</td>
      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{row.mpesaReference || "N/A"}</td>
      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{row.loanReferenceNumber}</td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(row.appliedLoanAmount)}</td>
      <td className="px-4 py-3 text-right font-bold text-green-600 bg-green-50 rounded-sm">{formatCurrency(row.disbursedAmount)}</td>
      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.interestAmount)}</td>
      <td className="px-4 py-3 text-gray-600">{row.business_name}</td>
      <td className="px-4 py-3 text-gray-600">{row.business_type}</td>
      <td className="px-4 py-3 text-gray-600">{row.productName}</td>
      <td className="px-4 py-3 text-gray-600">{row.nextPaymentDate}</td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.disbursementDate}</td>
    </tr>
  );
});

LoanTableRow.displayName = 'LoanTableRow';

const DisbursementLoansReport = () => {
  // Get tenant from localStorage ONCE
  const [tenant] = useState(() => {
    try {
      const savedTenant = localStorage.getItem("tenant");
      return savedTenant ? JSON.parse(savedTenant) : null;
    } catch (e) {
      console.error("Error loading tenant:", e);
      return null;
    }
  });

  // State
  const [rawLoans, setRawLoans] = useState([]);
  const [loading, setLoading] = useState(true); // Start loading immediately
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Filters state
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("disbursement-filters");
      return saved ? JSON.parse(saved) : {
        search: "",
        branch: "",
        region: "",
        officer: "",
        product: "",
        dateFilter: "all",
        customStartDate: "",
        customEndDate: "",
      };
    } catch (e) {
      return {
        search: "",
        branch: "",
        region: "",
        officer: "",
        product: "",
        dateFilter: "all",
        customStartDate: "",
        customEndDate: "",
      };
    }
  });

  // Refs
  const tenantIdRef = useRef(tenant?.id);
  const itemsPerPage = 10;

  // Update tenantIdRef when tenant changes (if tenant loads asynchronously)
  useEffect(() => {
    tenantIdRef.current = tenant?.id;
  }, [tenant]);

  // Save filters to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("disbursement-filters", JSON.stringify(filters));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // ========== FETCH DATA – ONLY ONCE ==========
useEffect(() => {
  if (!tenant?.id) {
    setLoading(false);
    return;
  }

  const controller = new AbortController();
  const tenantId = tenant.id;
  const cacheKey = `disbursement-raw-data-${tenantId}`;

  const fetchDisbursedLoans = async () => {
    try {
      setLoading(true);
      setError(null);

      // 🔹 Try cache first (5 minutes)
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isFresh = Date.now() - timestamp < 5 * 60 * 1000;

        if (isFresh) {
          setRawLoans(data || []);
          setLoading(false);
          return;
        }
      }

      // 🔹 Fetch loans
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select(`
          id,
          scored_amount,
          total_interest,
          total_payable,
          product_name,
          product_type,
          disbursed_at,
          repayment_state,
          status,
          branch:branch_id(name, region_id),
          loan_officer:booked_by(full_name),
          customer:customer_id(
            id,
            Firstname,
            Middlename,
            Surname,
            mobile,
            id_number,
            business_name,
            business_type
          ),
          installments:loan_installments(
            due_date,
            status,
            loan_id
          ),
          mpesa:mpesa_b2c_transactions(
            transaction_id,
            loan_id,
            status
          )
        `)
        .eq("status", "disbursed")
        .eq("tenant_id", tenantId)
        .order("disbursed_at", { ascending: false })
        .abortSignal(controller.signal);

      if (loansError) throw loansError;

      // 🔹 Fetch regions
      const regionIds = [
        ...new Set(
          loansData.map((loan) => loan.branch?.region_id).filter(Boolean)
        ),
      ];

      let regionMap = {};

      if (regionIds.length > 0) {
        const { data: regionsData } = await supabase
          .from("regions")
          .select("id, name")
          .in("id", regionIds)
          .eq("tenant_id", tenantId)
          .abortSignal(controller.signal);

        if (regionsData) {
          regionMap = regionsData.reduce((acc, r) => {
            acc[r.id] = r.name;
            return acc;
          }, {});
        }
      }

      // 🔹 Format data
      const formatted = loansData.map((loan) => {
        const customer = loan.customer || {};
        const fullName =
          [customer.Firstname, customer.Middlename, customer.Surname]
            .filter(Boolean)
            .join(" ") || "N/A";

        const pendingInstallment = Array.isArray(loan.installments)
          ? loan.installments.find((i) => i.status === "pending")
          : null;

        const mpesaTx =
          Array.isArray(loan.mpesa) &&
          loan.mpesa.find((tx) => tx.status === "success");

        return {
          id: loan.id,
          branch: loan.branch?.name || "N/A",
          region: regionMap[loan.branch?.region_id] || "N/A",
          loanOfficer: loan.loan_officer?.full_name || "N/A",
          customerName: fullName,
          mobile: customer.mobile || "N/A",
          idNumber: customer.id_number || "N/A",
          mpesaReference: mpesaTx?.transaction_id || "N/A",
          loanReferenceNumber: `LN${String(loan.id).padStart(5, "0")}`,
          appliedLoanAmount: loan.scored_amount ?? 0,
          disbursedAmount: loan.total_payable ?? 0,
          interestAmount: loan.total_interest || 0,
          business_name: customer.business_name || "N/A",
          business_type: customer.business_type || "N/A",
          productName: loan.product_name || loan.product_type || "N/A",
          product_type: loan.product_type || "N/A",
          nextPaymentDate: pendingInstallment?.due_date
            ? new Date(pendingInstallment.due_date).toLocaleDateString()
            : "N/A",
          disbursementDate: loan.disbursed_at
            ? new Date(loan.disbursed_at).toLocaleDateString()
            : "N/A",
          rawDisbursementDate: loan.disbursed_at,
          repaymentStatus: loan.repayment_state || "N/A",
        };
      });

      // 🔹 Update state
      setRawLoans(formatted);
      setLoading(false);

      // 🔹 Cache result
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: formatted,
          timestamp: Date.now(),
        })
      );
    } catch (err) {
      if (err.name === "AbortError") return;

      console.error("Fetch error:", err);
      setError(err.message || "Failed to load data");
      setLoading(false);
    }
  };

  fetchDisbursedLoans();

  return () => {
    controller.abort();
  };
}, [tenant?.id]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    const tenantId = tenant?.id;
    if (!tenantId || loading) return;

    console.log("🔄 Manual refresh triggered");

    try {
      setLoading(true);
      setError(null);
      
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select(`
          id,
          scored_amount,
          total_interest,
          total_payable,
          product_name,
          product_type,
          disbursed_at,
          repayment_state,
          status,
          branch:branch_id(name, region_id),
          loan_officer:booked_by(full_name),
          customer:customer_id(
            id,
            Firstname,
            Middlename,
            Surname,
            mobile,
            id_number,
            business_name,
            business_type
          ),
          installments:loan_installments(
            due_date,
            status,
            loan_id
          ),
          mpesa:mpesa_b2c_transactions(
            transaction_id,
            loan_id,
            status
          )
        `)
        .eq("status", "disbursed")
        .eq("tenant_id", tenantId)
        .order("disbursed_at", { ascending: false });

      if (loansError) throw loansError;

      // Fetch regions
      const regionIds = [...new Set(loansData.map(loan => loan.branch?.region_id).filter(Boolean))];
      let regionMap = {};

      if (regionIds.length > 0) {
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .in('id', regionIds)
          .eq('tenant_id', tenantId);

        if (!regionsError && regionsData) {
          regionMap = regionsData.reduce((acc, region) => {
            acc[region.id] = region.name;
            return acc;
          }, {});
        }
      }

      const formatted = loansData.map((loan) => {
        const customer = loan.customer || {};
        const fullName = [customer.Firstname, customer.Middlename, customer.Surname]
          .filter(Boolean)
          .join(" ") || "N/A";

        const pendingInstallment = Array.isArray(loan.installments)
          ? loan.installments.find((inst) => inst.status === "pending")
          : null;
        const nextPaymentDate = pendingInstallment?.due_date
          ? new Date(pendingInstallment.due_date).toLocaleDateString()
          : "N/A";

        const mpesaTx = Array.isArray(loan.mpesa) && loan.mpesa.length > 0
          ? loan.mpesa.find((tx) => tx.status === "success")
          : null;
        const mpesaReference = mpesaTx?.transaction_id || "N/A";

        const regionName = loan.branch?.region_id ? regionMap[loan.branch.region_id] || "N/A" : "N/A";

        return {
          id: loan.id,
          branch: loan.branch?.name || "N/A",
          region: regionName,
          loanOfficer: loan.loan_officer?.full_name || "N/A",
          customerName: fullName,
          mobile: customer.mobile || "N/A",
          idNumber: customer.id_number || "N/A",
          mpesaReference,
          loanNumber: `LN${String(loan.id).padStart(5, "0")}`,
          loanReferenceNumber: `LN${String(loan.id).padStart(5, "0")}`,
          appliedLoanAmount: loan.scored_amount ?? 0,
          disbursedAmount: loan.total_payable ?? 0,
          interestAmount: loan.total_interest || 0,
          business_name: customer.business_name || "N/A",
          business_type: customer.business_type || "N/A",
          productName: loan.product_name || loan.product_type || "N/A",
          product_type: loan.product_type || "N/A",
          nextPaymentDate,
          disbursementDate: loan.disbursed_at
            ? new Date(loan.disbursed_at).toLocaleDateString()
            : "N/A",
          rawDisbursementDate: loan.disbursed_at,
          repaymentStatus: loan.repayment_state || "N/A",
        };
      });

      setRawLoans(formatted || []);
      
      const cacheKey = `disbursement-raw-data-${tenantId}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ 
          data: formatted || [], 
          timestamp: Date.now() 
        }));
      } catch (e) {
        console.error("Cache write error:", e);
      }

      console.log("✅ Manual refresh complete");
      
    } catch (err) {
      console.error("❌ Error refreshing disbursed loans:", err);
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // Get date range
  const getDateRange = (filter) => {
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
  };

  // Group loans for display
  const groupLoansForDisplay = (loans) => {
    const branchTotals = {};
    const officerTotals = {};

    loans.forEach((loan) => {
      if (!branchTotals[loan.branch]) {
        branchTotals[loan.branch] = 0;
      }
      branchTotals[loan.branch] += loan.disbursedAmount || 0;

      const officerKey = `${loan.branch}-${loan.loanOfficer}`;
      if (!officerTotals[officerKey]) {
        officerTotals[officerKey] = 0;
      }
      officerTotals[officerKey] += loan.disbursedAmount || 0;
    });

    const groupedByBranch = {};

    loans.forEach((loan) => {
      if (!groupedByBranch[loan.branch]) {
        groupedByBranch[loan.branch] = {
          branch: loan.branch,
          totalAmount: branchTotals[loan.branch] || 0,
          officers: {},
        };
      }

      if (!groupedByBranch[loan.branch].officers[loan.loanOfficer]) {
        const officerKey = `${loan.branch}-${loan.loanOfficer}`;
        groupedByBranch[loan.branch].officers[loan.loanOfficer] = {
          officer: loan.loanOfficer,
          roTotalAmount: officerTotals[officerKey] || 0,
          customers: [],
        };
      }

      groupedByBranch[loan.branch].officers[loan.loanOfficer].customers.push(loan);
    });

    return groupedByBranch;
  };

  // Process and filter data
  const filteredData = useMemo(() => {
    let result = [...rawLoans];
    const q = (filters.search || "").toLowerCase();

    // Text search
    if (filters.search) {
      result = result.filter((i) => {
        const idNum = i.idNumber ? String(i.idNumber) : "";
        const mobile = i.mobile ? String(i.mobile) : "";
        const loanNum = i.loanNumber ? String(i.loanNumber).toLowerCase() : "";
        const name = i.customerName ? i.customerName.toLowerCase() : "";

        return (
          name.includes(q) ||
          loanNum.includes(q) ||
          mobile.includes(q) ||
          idNum.includes(q)
        );
      });
    }

    // Dropdown filters
    if (filters.branch) result = result.filter((i) => i.branch === filters.branch);
    if (filters.region) result = result.filter((i) => i.region === filters.region);
    if (filters.officer) result = result.filter((i) => i.loanOfficer === filters.officer);
    if (filters.product) result = result.filter((i) => i.productName === filters.product);

    // Date filter
    if (filters.dateFilter !== "all") {
      const range = getDateRange(filters.dateFilter);
      if (range) {
        result = result.filter((i) => {
          if (!i.rawDisbursementDate) return false;
          const disbursementDate = new Date(i.rawDisbursementDate);
          return disbursementDate >= range.start && disbursementDate <= range.end;
        });
      }
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawLoans, filters, sortConfig]);

  // Get grouped data for display
  const groupedData = useMemo(() => groupLoansForDisplay(filteredData), [filteredData]);

  // Get dropdown options from data
  const branches = useMemo(() => [
    ...new Set(rawLoans.map((i) => i.branch).filter((b) => b && b !== "N/A")),
  ], [rawLoans]);

  const officers = useMemo(() => [
    ...new Set(rawLoans.map((i) => i.loanOfficer).filter((o) => o && o !== "N/A")),
  ], [rawLoans]);

  const products = useMemo(() => [
    ...new Set(rawLoans.map((i) => i.productName).filter((p) => p && p !== "N/A")),
  ], [rawLoans]);

  const regions = useMemo(() => [
    ...new Set(rawLoans.map((i) => i.region).filter((r) => r && r !== "N/A")),
  ], [rawLoans]);

  // Date filter options
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

  // Calculate total rows for pagination
  const { totalRows, totalPages, currentData } = useMemo(() => {
    let allRows = [];
    let globalIndex = 0;
    let branchNumber = 1;

    Object.values(groupedData).forEach((branch) => {
      let isFirstOfficerInBranch = true;

      Object.values(branch.officers).forEach((officer) => {
        officer.customers.forEach((customer, customerIndex) => {
          globalIndex++;

          if (
            globalIndex > (currentPage - 1) * itemsPerPage &&
            globalIndex <= currentPage * itemsPerPage
          ) {
            allRows.push({
              ...customer,
              branch: branch.branch,
              branchTotalAmount: branch.totalAmount,
              loanOfficer: officer.officer,
              roTotalAmount: officer.roTotalAmount,
              branchNumber: customerIndex === 0 && isFirstOfficerInBranch ? branchNumber : "",
              isFirstInBranch: customerIndex === 0 && isFirstOfficerInBranch,
              isFirstInOfficer: customerIndex === 0,
            });
          }
        });
        isFirstOfficerInBranch = false;
      });
      branchNumber++;
    });

    const totalRows = globalIndex;
    const totalPages = Math.ceil(totalRows / itemsPerPage);

    return { totalRows, totalPages, currentData: allRows };
  }, [groupedData, currentPage]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalPayable = filteredData.reduce((sum, item) => sum + (item.disbursedAmount || 0), 0);
    const totalPrincipal = filteredData.reduce((sum, item) => sum + (item.appliedLoanAmount || 0), 0);
    const totalLoans = filteredData.length;

    return { totalPayable, totalPrincipal, totalLoans };
  }, [filteredData]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Handle search change
  const handleSearchChange = (val) => {
    setFilters(prev => ({ ...prev, search: val }));
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: "",
      branch: "",
      region: "",
      officer: "",
      product: "",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    });
    setCurrentPage(1);
  };

  // Export functions (unchanged)
  const exportToPDF = () => {
    if (filteredData.length === 0) return alert("No data to export");

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${tenant?.company_name || "Company"} - Loan Disbursement Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${getCurrentTimestamp()}`, 14, 22);

    const headers = [
      [
        "No.",
        "Branch Name",
        "Total Amount",
        "Loan Officer",
        "RO Total Amount",
        "Customer Name",
        "Mobile Number",
        "ID Number",
        "Mpesa Reference",
        "Loan Reference Number",
        "Applied Loan Amount",
        "Disbursed Amount",
        "Interest Amount",
        "Business Name",
        "Business Type",
        "Product",
        "Next Payment Date",
        "Disbursement Date",
      ],
    ];

    const groupedData = groupLoansForDisplay(filteredData);
    const rows = [];
    let branchNum = 1;

    Object.values(groupedData).forEach((branch) => {
      Object.values(branch.officers).forEach((officer) => {
        officer.customers.forEach((cust, i) => {
          rows.push([
            i === 0 ? branchNum : "",
            i === 0 ? branch.branch : "",
            i === 0 ? formatCurrency(branch.totalAmount) : "",
            i === 0 ? officer.officer : "",
            i === 0 ? formatCurrency(officer.roTotalAmount) : "",
            cust.customerName,
            cust.mobile,
            cust.idNumber,
            cust.mpesaReference,
            cust.loanReferenceNumber,
            formatCurrency(cust.appliedLoanAmount),
            formatCurrency(cust.disbursedAmount),
            formatCurrency(cust.interestAmount),
            cust.business_name,
            cust.business_type,
            cust.productName,
            cust.nextPaymentDate,
            cust.disbursementDate,
          ]);
        });
      });
      branchNum++;
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 28,
      styles: { fontSize: 8 },
    });

    doc.save(
      `loan-disbursement-report-${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const exportToExcel = () => {
    if (filteredData.length === 0) return alert("No data to export");

    const ws = XLSX.utils.json_to_sheet(
      filteredData.map((d, index) => ({
        No: index + 1,
        Branch: d.branch,
        "Loan Officer": d.loanOfficer,
        "Customer Name": d.customerName,
        Mobile: d.mobile,
        "ID Number": d.idNumber,
        "Mpesa Reference": d.mpesaReference,
        "Loan Ref": d.loanReferenceNumber,
        "Applied Amount": d.appliedLoanAmount,
        "Disbursed Amount": d.disbursedAmount,
        "Interest Amount": d.interestAmount,
        "Business Name": d.business_name,
        "Business Type": d.business_type,
        Product: d.productName,
        "Next Payment Date": d.nextPaymentDate,
        "Disbursement Date": d.disbursementDate,
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Disbursement Report");
    const companySlug = (tenant?.company_name || "Company").toLowerCase().replace(/ /g, '-');
    XLSX.writeFile(
      wb,
      `${companySlug}-disbursement-report-${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const exportToCSV = () => {
    if (filteredData.length === 0) return alert("No data to export");

    const headers = [
      "No.",
      "Branch Name",
      "Total Amount",
      "Loan Officer",
      "RO Total Amount",
      "Customer Name",
      "Mobile Number",
      "ID Number",
      "Mpesa Reference",
      "Loan Reference Number",
      "Applied Loan Amount",
      "Disbursed Amount",
      "Interest Amount",
      "Business Name",
      "Business Type",
      "Product",
      "Next Payment Date",
      "Disbursement Date",
    ];

    const groupedData = groupLoansForDisplay(filteredData);
    let flattenedData = [];
    let branchNumber = 1;

    Object.values(groupedData).forEach((branch) => {
      Object.values(branch.officers).forEach((officer) => {
        officer.customers.forEach((customer, customerIndex) => {
          flattenedData.push([
            customerIndex === 0 ? branchNumber : "",
            customerIndex === 0 ? branch.branch : "",
            customerIndex === 0 ? formatCurrency(branch.totalAmount) : "",
            customerIndex === 0 ? officer.officer : "",
            customerIndex === 0 ? formatCurrency(officer.roTotalAmount) : "",
            customer.customerName,
            customer.mobile,
            customer.idNumber,
            customer.mpesaReference,
            customer.loanReferenceNumber,
            formatCurrency(customer.appliedLoanAmount),
            formatCurrency(customer.disbursedAmount),
            formatCurrency(customer.interestAmount),
            customer.business_name,
            customer.business_type,
            customer.productName,
            customer.nextPaymentDate,
            customer.disbursementDate,
          ]);
        });
      });
      branchNumber++;
    });

    const csv = [
      headers.join(","),
      ...flattenedData.map((row) =>
        row
          .map((field) =>
            typeof field === "string" && field.includes(",")
              ? `"${field}"`
              : field
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const companySlug = (tenant?.company_name || "Company").toLowerCase().replace(/ /g, '-');
    link.download = `${companySlug}-disbursement-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToWord = async () => {
    if (filteredData.length === 0) return alert("No data to export");

    const rows = filteredData.map(
      (d, i) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(i + 1))] }),
            new TableCell({ children: [new Paragraph(d.branch)] }),
            new TableCell({ children: [new Paragraph(d.loanOfficer)] }),
            new TableCell({ children: [new Paragraph(d.customerName)] }),
            new TableCell({ children: [new Paragraph(String(d.mobile))] }),
            new TableCell({ children: [new Paragraph(d.loanReferenceNumber)] }),
            new TableCell({
              children: [new Paragraph(formatCurrency(d.disbursedAmount))],
            }),
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
                  text: `${tenant?.company_name || "Company"} - Loan Disbursement Report`,
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
            new Paragraph(" "),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    "No.",
                    "Branch",
                    "Loan Officer",
                    "Customer Name",
                    "Mobile",
                    "Loan Ref",
                    "Disbursed Amount",
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
    saveAs(
      blob,
      `loan-disbursement-report-${new Date().toISOString().split("T")[0]}.docx`
    );
  };

  const handleExport = () => {
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
  };

  // ✅ Show loading state with custom Spinner (only once)
  if (loading && rawLoans.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading Disbursement Report..." />
      </div>
    );
  }

  // ✅ Show error state with retry option (only once)
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
        <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-sm font-bold text-stone-600">{tenant?.company_name || "Company Name"}</h1>
                <h2 className="text-lg font-semibold text-white mt-1">
                  Disbursed Loans Report
                </h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <SearchBox value={filters.search} onChange={handleSearchChange} />
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border
                    ${showFilters
                      ? "bg-accent text-white shadow-md border-transparent hover:bg-brand-secondary"
                      : "text-gray-600 border-gray-200 hover:bg-brand-secondary hover:text-white"
                    }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-amber-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Payable</p>
            <p className="text-2xl font-bold mt-1 text-primary">{formatCurrency(summaryStats.totalPayable)}</p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Principal</p>
            <p className="text-2xl font-bold mt-1 text-accent">{formatCurrency(summaryStats.totalPrincipal)}</p>
          </div>
          <div className="bg-purple-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Number of Loans</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">{summaryStats.totalLoans}</p>
          </div>
        </div>

        {/* Filter Section */}
        {showFilters && (
          <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm space-y-4">
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
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={filters.branch}
                onChange={(e) => handleFilterChange("branch", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <select
                value={filters.officer}
                onChange={(e) => handleFilterChange("officer", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Relationship Officers</option>
                {officers.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <select
                value={filters.product}
                onChange={(e) => handleFilterChange("product", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {(filters.search ||
              filters.region ||
              filters.branch ||
              filters.officer ||
              filters.product ||
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
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">No.</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Branch Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Total Amount</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Loan Officer</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">RO Total</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Customer Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Mobile</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">ID Number</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Mpesa Ref</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Loan Ref</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap text-right">Applied</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap text-right">Disbursed</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap text-right">Interest</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Business</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Product</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Next Payment</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Disbursement Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="18" className="px-4 py-8 text-center text-gray-500">
                      <div className="flex justify-center">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan="18" className="px-4 py-8 text-center text-gray-500 bg-gray-50">
                      <div className="flex flex-col items-center justify-center">
                        <Filter className="w-8 h-8 text-gray-300 mb-2" />
                        <p>No disbursed loans found matching your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentData.map((row, index) => (
                    <LoanTableRow key={`${row.id}-${index}`} row={row} index={index} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls - Bottom */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalRows)} of {totalRows}{" "}
              entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DisbursementLoansReport;