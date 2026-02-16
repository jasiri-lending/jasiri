import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
} from "docx";
import { saveAs } from "file-saver";


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

const Spinner = ({ text }) => (
  <div className="flex flex-col items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    {text && <p className="mt-4 text-gray-600">{text}</p>}
  </div>
);

// Memoized row component for better performance
const PendingRow = React.memo(({ row, isFirstInBranch, isFirstInOfficer, branchRowSpan, officerRowSpan, branchTotal, officerTotal, formatCurrency }) => {
  return (
    <tr className="group hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-4 text-center text-slate-400 font-medium whitespace-nowrap">
        {row.branchNumber}
      </td>
      <td className="px-4 py-4 font-bold text-slate-900 whitespace-nowrap">
        {isFirstInBranch ? row.branchName : ""}
      </td>
      <td className="px-4 py-4 text-right font-black text-slate-900 bg-slate-50/30 whitespace-nowrap">
        {isFirstInBranch ? formatCurrency(branchTotal) : ""}
      </td>
      <td className="px-4 py-4 font-semibold text-slate-600 whitespace-nowrap">
        {isFirstInOfficer ? row.officerName : ""}
      </td>
      <td className="px-4 py-4 text-right font-bold text-slate-600 whitespace-nowrap">
        {isFirstInOfficer ? formatCurrency(officerTotal) : ""}
      </td>
      <td className="px-4 py-4 font-bold text-slate-900 whitespace-nowrap">
        {row.customer_name}
      </td>
      <td className="px-4 py-4 text-slate-600 font-medium whitespace-nowrap tabular-nums">
        {row.customer_id_num}
      </td>
      <td className="px-4 py-4 text-slate-600 font-medium whitespace-nowrap tabular-nums">
        {row.mobile}
      </td>
      <td className="px-4 py-4 text-right font-black text-accent whitespace-nowrap">
        {formatCurrency(row.net_disbursement)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-700 whitespace-nowrap">
            {row.product_name}
          </span>
          <span className="text-[10px] text-slate-400 font-medium uppercase whitespace-nowrap">
            {row.product_type}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 text-center whitespace-nowrap">
        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-tighter">
          {row.status?.replace(/_/g, " ")}
        </span>
      </td>
      <td className="px-4 py-4 text-right text-slate-500 font-medium tabular-nums whitespace-nowrap">
        {row.booked_at_date
          ? row.booked_at_date.toLocaleDateString()
          : "N/A"}
      </td>
    </tr>
  );
});
PendingRow.displayName = "PendingRow";

// ========== Main Component ==========

const PendingDisbursementReport = () => {
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
  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allOfficers, setAllOfficers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "booked_at", direction: "desc" });
  const [exportFormat, setExportFormat] = useState("csv");

  const itemsPerPage = 15;

  // ========== Combined Filters State (persisted) ==========
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("pending-disbursement-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          search: parsed.search || "",
          region: parsed.region || "",
          branch: parsed.branch || "",
          loanOfficer: parsed.loanOfficer || "",
          product: parsed.product || "",
          status: parsed.status || "all",
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
      product: "",
      status: "all",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    };
  });


  // ========== Debounced Save Filters ==========
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(
          "pending-disbursement-filters",
          JSON.stringify(filters)
        );
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // ========== Fetch All Data (ONCE with Caching) ==========
useEffect(() => {
  const tenantId = tenant?.id;

  if (!tenantId) {
    setIsInitialLoad(false);
    return;
  }

  let mounted = true;

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [
        loansRes,
        customersRes,
        usersRes,
        branchesRes,
        regionsRes,
      ] = await Promise.all([
        supabase
          .from("loans")
          .select(`
            id,
            customer_id,
            booked_by,
            branch_id,
            region_id,
            product_name,
            product_type,
            scored_amount,
            processing_fee,
            registration_fee,
            total_payable,
            weekly_payment,
            duration_weeks,
            interest_rate,
            booked_at,
            status
          `)
          .eq("status", "ca_review")
          .eq("tenant_id", tenantId),

        supabase
          .from("customers")
          .select("id, Firstname, Middlename, Surname, id_number, mobile")
          .eq("tenant_id", tenantId),

        supabase
          .from("users")
          .select("id, full_name, role")
          .eq("tenant_id", tenantId)
          .eq("role", "relationship_officer"),

        supabase
          .from("branches")
          .select("id, name, region_id")
          .eq("tenant_id", tenantId),

        supabase
          .from("regions")
          .select("id, name")
          .eq("tenant_id", tenantId),
      ]);

      if (
        loansRes.error ||
        customersRes.error ||
        usersRes.error ||
        branchesRes.error ||
        regionsRes.error
      ) {
        throw (
          loansRes.error ||
          customersRes.error ||
          usersRes.error ||
          branchesRes.error ||
          regionsRes.error
        );
      }

      if (!mounted) return;

      const loans = loansRes.data || [];
      const customers = customersRes.data || [];
      const officers = usersRes.data || [];
      const branchList = branchesRes.data || [];
      const regionList = regionsRes.data || [];

      // Create lookup maps
      const customerMap = Object.fromEntries(
        customers.map((c) => [c.id, c])
      );

      const officerMap = Object.fromEntries(
        officers.map((o) => [o.id, o])
      );

      const branchMap = Object.fromEntries(
        branchList.map((b) => [b.id, b])
      );

      const regionMap = Object.fromEntries(
        regionList.map((r) => [r.id, r])
      );

      const mapped = loans.map((loan) => {
        const customer = customerMap[loan.customer_id] || {};
        const officer = officerMap[loan.booked_by] || {};
        const branch = branchMap[loan.branch_id] || {};
        const region = regionMap[loan.region_id] || {};

        const net =
          (loan.scored_amount || 0) -
          (loan.processing_fee || 0) -
          (loan.registration_fee || 0);

        return {
          ...loan,
          customer_name: `${customer.Firstname || ""} ${
            customer.Middlename || ""
          } ${customer.Surname || ""}`.trim(),
          customer_id_num: customer.id_number || "",
          mobile: customer.mobile || "",
          officer_name: officer.full_name || "N/A",
          branch_name: branch.name || "N/A",
          region_name: region.name || "N/A",
          booked_at_date: loan.booked_at
            ? new Date(loan.booked_at)
            : null,
          net_disbursement: net,
        };
      });

      const products = [...new Set(mapped.map((m) => m.product_name))];

      setRawReports(mapped);
      setRegions(regionList);
      setBranches(branchList);
      setAllOfficers(officers);
      setAllProducts(products);
    } catch (err) {
      console.error("Error fetching pending disbursements:", err);
    } finally {
      if (mounted) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  };

  fetchAllData();

  return () => {
    mounted = false;
  };
}, [tenant?.id]);




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
          if (isNaN(start.getTime())) start = new Date(0);
          start.setHours(0, 0, 0, 0);
          end = filters.customEndDate ? new Date(filters.customEndDate) : new Date();
          if (isNaN(end.getTime())) end = new Date();
          end.setHours(23, 59, 59, 999);
          break;
        default:
          return null;
      }
      return { start, end };
    },
    [filters.customStartDate, filters.customEndDate]
  );

  // ========== Filtered Data (Memoized) ==========
  const filteredData = useMemo(() => {
    let result = [...rawReports];
    const q = filters.search.toLowerCase();

    if (filters.search) {
      result = result.filter((i) =>
        i.customer_name.toLowerCase().includes(q) ||
        i.mobile.includes(q) ||
        i.customer_id_num.includes(q)
      );
    }

    if (filters.region) result = result.filter((i) => i.region_id === filters.region);
    if (filters.branch) result = result.filter((i) => i.branch_id === filters.branch);
    if (filters.loanOfficer) result = result.filter((i) => i.booked_by === filters.loanOfficer);
    if (filters.product) result = result.filter((i) => i.product_name === filters.product);
    if (filters.status !== "all") result = result.filter((i) => i.status === filters.status);

    if (filters.dateFilter !== "all") {
      const range = getDateRange(filters.dateFilter);
      if (range) {
        result = result.filter((i) => {
          if (!i.booked_at_date) return false;
          return i.booked_at_date >= range.start && i.booked_at_date <= range.end;
        });
      }
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'customer_name') {
          aVal = aVal?.toLowerCase() || '';
          bVal = bVal?.toLowerCase() || '';
        }

        if (sortConfig.key.includes('date') && aVal instanceof Date && bVal instanceof Date) {
          return sortConfig.direction === "asc" 
            ? aVal.getTime() - bVal.getTime()
            : bVal.getTime() - aVal.getTime();
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawReports, filters, sortConfig, getDateRange]);

  // ========== Grouped Data for Display ==========
const displayData = useMemo(() => {
  const grouped = {};
  let branchCounter = 0;

  filteredData.forEach((item) => {
    if (!grouped[item.branch_name]) {
      grouped[item.branch_name] = {
        officers: {},
        total: 0,
      };
    }

    if (!grouped[item.branch_name].officers[item.officer_name]) {
      grouped[item.branch_name].officers[item.officer_name] = {
        loans: [],
        total: 0,
      };
    }

    grouped[item.branch_name].officers[item.officer_name].loans.push(item);
    grouped[item.branch_name].officers[item.officer_name].total +=
      item.net_disbursement;

    grouped[item.branch_name].total += item.net_disbursement;
  });

  const result = [];

  Object.keys(grouped)
    .sort()
    .forEach((branchName) => {
      branchCounter++;
      const branchObj = grouped[branchName];
      const branchLoansCount = Object.values(branchObj.officers).reduce(
        (sum, o) => sum + o.loans.length,
        0
      );

      Object.keys(branchObj.officers)
        .sort()
        .forEach((officerName) => {
          const officerObj = branchObj.officers[officerName];
          const officerLoansCount = officerObj.loans.length;

          officerObj.loans.forEach((loan, index) => {
            result.push({
              ...loan,
              branchNumber: branchCounter,
              branchName: branchName,
              officerName: officerName,
              branchTotalAmount: branchObj.total,
              roTotalAmount: officerObj.total,
              isFirstInBranch: index === 0,
              isFirstInOfficer: index === 0,
              branchRowSpan: branchLoansCount,
              officerRowSpan: officerLoansCount,
            });
          });
        });
    });

  return result;
}, [filteredData]);


  // ========== Summary Statistics ==========
  const summaryStats = useMemo(() => {
    const totalAmount = filteredData.reduce((sum, r) => sum + (r.scored_amount || 0), 0);
    const totalNet = filteredData.reduce((sum, r) => sum + (r.net_disbursement || 0), 0);
    const totalFees = filteredData.reduce((sum, r) => sum + (r.processing_fee || 0) + (r.registration_fee || 0), 0);
    return { totalAmount, totalNet, totalFees, count: filteredData.length };
  }, [filteredData]);

  // ========== Pagination ==========
  const pagination = useMemo(() => {
    const totalRows = displayData.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    const currentData = displayData.slice(startIdx, endIdx);
    return { totalRows, totalPages, startIdx, endIdx, currentData };
  }, [displayData, currentPage]);

  // ========== Filtered Branches / Officers ==========
  const getFilteredBranches = useCallback(() => {
    if (!filters.region) return branches;
    return branches.filter(b => b.region_id === filters.region);
  }, [branches, filters.region]);

  const getFilteredOfficers = useCallback(() => {
    // Since users table doesn't have branch_id, return all officers
    // The filtering will happen via loan data when branch is selected
    return allOfficers;
  }, [allOfficers]);

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
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      region: "",
      branch: "",
      loanOfficer: "",
      product: "",
      status: "all",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    });
    setCurrentPage(1);
  }, []);

  // ========== Formatting Helpers ==========
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  }, []);

  const getCurrentTimestamp = useCallback(() => {
    const now = new Date();
    return now.toLocaleString("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, []);

  // ========== Export Functions ==========
  const handleExport = useCallback(async () => {
    if (filteredData.length === 0) return alert("No data to export");
    const timestamp = new Date().toISOString().split("T")[0];
    const companyName = tenant?.company_name || "Jasiri Capital";
    const companySlug = companyName.toLowerCase().replace(/ /g, '-');
    const filename = `${companySlug}-pending-disbursement-${timestamp}`;

    switch (exportFormat) {
      case "pdf":
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        doc.text(`${companyName} - Pending Disbursement Report`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${getCurrentTimestamp()}`, 14, 22);

        const tableHeaders = [
          ["No", "Customer Name", "ID Number", "Mobile", "Branch", "Officer", "Product", "Scored Amount", "Net Disbursement", "Booked Date"]
        ];

        const tableRows = filteredData.map((r, i) => [
          i + 1,
          r.customer_name,
          r.customer_id_num,
          r.mobile,
          r.branch_name,
          r.officer_name,
          r.product_name,
          formatCurrency(r.scored_amount),
          formatCurrency(r.net_disbursement),
          r.booked_at_date ? r.booked_at_date.toLocaleDateString() : "N/A"
        ]);

        autoTable(doc, {
          head: tableHeaders,
          body: tableRows,
          startY: 28,
          styles: { fontSize: 8 },
        });

        doc.save(`${filename}.pdf`);
        break;

      case "excel":
        const ws = XLSX.utils.json_to_sheet(filteredData.map((r, i) => ({
          No: i + 1,
          "Customer Name": r.customer_name,
          "ID Number": r.customer_id_num,
          "Mobile": r.mobile,
          "Branch": r.branch_name,
          "Region": r.region_name,
          "Loan Officer": r.officer_name,
          "Product": r.product_name,
          "Scored Amount": r.scored_amount,
          "Processing Fee": r.processing_fee,
          "Registration Fee": r.registration_fee,
          "Net Disbursement": r.net_disbursement,
          "Status": r.status,
          "Booked Date": r.booked_at_date ? r.booked_at_date.toLocaleDateString() : "N/A"
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pending Disbursement");
        XLSX.writeFile(wb, `${filename}.xlsx`);
        break;

      case "word":
        const wordRows = filteredData.slice(0, 50).map((r, i) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(i + 1))] }),
            new TableCell({ children: [new Paragraph(r.customer_name)] }),
            new TableCell({ children: [new Paragraph(r.branch_name)] }),
            new TableCell({ children: [new Paragraph(formatCurrency(r.net_disbursement))] }),
            new TableCell({ children: [new Paragraph(r.status)] }),
          ]
        }));

        const wordDoc = new Document({
          sections: [{
            children: [
              new Paragraph({ text: `${companyName} - Pending Disbursement`, bold: true, size: 28 }),
              new Paragraph(`Generated on: ${getCurrentTimestamp()}`),
              new Paragraph(" "),
              new Table({
                rows: [
                  new TableRow({
                    children: ["No", "Customer", "Branch", "Net Disbursement", "Status"].map(h =>
                      new TableCell({ children: [new Paragraph({ text: h, bold: true })] })
                    )
                  }),
                  ...wordRows
                ]
              })
            ]
          }]
        });

        const blob = await Packer.toBlob(wordDoc);
        saveAs(blob, `${filename}.docx`);
        break;

      case "csv":
      default:
        const csvHeaders = ["No", "Customer Name", "ID Number", "Mobile", "Branch", "Region", "Officer", "Product", "Scored Amount", "Net Disbursement", "Status", "Booked Date"];
        const csvRows = filteredData.map((r, i) => [
          i + 1,
          `"${r.customer_name}"`,
          r.customer_id_num,
          r.mobile,
          r.branch_name,
          r.region_name,
          r.officer_name,
          `"${r.product_name}"`,
          r.scored_amount,
          r.net_disbursement,
          r.status,
          r.booked_at_date ? r.booked_at_date.toLocaleDateString() : "N/A"
        ]);

        const csvContent = [csvHeaders.join(","), ...csvRows.map(row => row.join(","))].join("\n");
        const csvBlob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        saveAs(csvBlob, `${filename}.csv`);
        break;
    }
  }, [filteredData, exportFormat, tenant, formatCurrency, getCurrentTimestamp]);

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

  if (loading && isInitialLoad) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading Pending Disbursement Report..." />
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
                <h2 className="text-sm font-semibold text-white/90">
                  Pending Disbursement Report
                </h2>
              </div>
            </div>

            {/* CONSOLIDATED CONTROLS */}
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox
                value={filters.search}
                onChange={(val) => handleFilterChange("search", val)}
              />
           
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-amber-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Scored Amount</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(summaryStats.totalAmount)}
            </p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Net Disbursement</p>
            <p className="text-2xl font-bold mt-1 text-accent">
              {formatCurrency(summaryStats.totalNet)}
            </p>
          </div>
          <div className="bg-red-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Fees</p>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {formatCurrency(summaryStats.totalFees)}
            </p>
          </div>
          <div className="bg-purple-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted font-medium">Number of Loans</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                PENDING
              </span>
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-900">{summaryStats.count}</p>
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
                  onChange={(e) => {
                    handleFilterChange("region", e.target.value);
                    handleFilterChange("branch", "");
                    handleFilterChange("loanOfficer", "");
                  }}
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
                  onChange={(e) => {
                    handleFilterChange("branch", e.target.value);
                    handleFilterChange("loanOfficer", "");
                  }}
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
                Showing {filteredData.length} matches
              </p>
            </div>
          </div>
        )}

        {/* STANDARDIZED TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-slate-500 mt-4 font-medium italic">
                Preparing disbursement data...
              </p>
            </div>
          ) : displayData.length === 0 ? (
            <div className="p-12 text-center">
              <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No pending disbursements found.</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-brand-primary font-bold text-sm hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-center w-12 whitespace-nowrap">
                        No.
                      </th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Branch
                      </th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">
                        Branch Total
                      </th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Relationship Officer
                      </th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">
                        RO Total
                      </th>
                      <th className="px-4 py-4 font-black text-brand-primary uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Customer Name
                      </th>
                      <th className="px-4 py-4 font-black text-brand-primary uppercase tracking-wider text-[11px] whitespace-nowrap">
                        ID Number
                      </th>
                      <th className="px-4 py-4 font-black text-brand-primary uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Phone
                      </th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">
                        Net Amount
                      </th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Product
                      </th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-center whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">
                        Booked At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagination.currentData.map((row, idx) => {
                      const isFirstInBranch = row.isFirstInBranch;
                      const isFirstInOfficer = row.isFirstInOfficer;
                                           const branchRowSpan = displayData.filter(d => d.branchName === row.branchName).length;
                      const officerRowSpan = displayData.filter(d => d.branchName === row.branchName && d.officerName === row.officerName).length;

                      return (
                        <PendingRow
                          key={`${row.id}-${idx}`}
                          row={row}
                          isFirstInBranch={isFirstInBranch}
                          isFirstInOfficer={isFirstInOfficer}
                          branchRowSpan={branchRowSpan}
                          officerRowSpan={officerRowSpan}
                          branchTotal={row.branchTotalAmount}
                          officerTotal={row.roTotalAmount}
                          formatCurrency={formatCurrency}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Page {currentPage} of {pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: pagination.totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                            currentPage === i + 1
                              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-110"
                              : "bg-white text-slate-400 hover:text-slate-600 border border-slate-100"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                      className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingDisbursementReport;