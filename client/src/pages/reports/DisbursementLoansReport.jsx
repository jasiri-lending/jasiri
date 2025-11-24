import { useEffect, useMemo } from "react";
import {
  Download,
  Printer,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useDisbursementStore } from "../../stores/DisbursementStore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } from "docx";
import { saveAs } from "file-saver";

const DisbursementLoansReport = () => {
  // Zustand store - destructure only what you need
  const {
    disbursedLoans,
    filters,
    dateFilter,
    customStartDate,
    customEndDate,
    exportFormat,
    showFilters,
    loading,
    currentPage,
    itemsPerPage,
    sortConfig,
    setFilters,
    setDateFilter,
    setCustomDateRange,
    setExportFormat,
    toggleFilters,
    setCurrentPage,
        clearFilters,
    fetchDisbursedLoans,
  } = useDisbursementStore();

  // Fetch data on mount
  useEffect(() => {
    fetchDisbursedLoans();
  }, [fetchDisbursedLoans]);

  // Helper functions
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);

  const getCurrentTimestamp = () => {
    const now = new Date();
    return now.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  };

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
        start = customStartDate ? new Date(customStartDate) : new Date(0);
        start.setHours(0, 0, 0, 0);
        end = customEndDate ? new Date(customEndDate) : new Date();
        end.setHours(23, 59, 59, 999);
        break;
      default:
        return null;
    }
    return { start, end };
  };

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

  // Filtered and sorted data - using useMemo for performance
  const filteredData = useMemo(() => {
    let result = [...disbursedLoans];
    const q = filters.search.toLowerCase();

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
    if (filters.branch)
      result = result.filter((i) => i.branch === filters.branch);
    if (filters.officer)
      result = result.filter((i) => i.loanOfficer === filters.officer);
    if (filters.product)
      result = result.filter((i) => i.productName === filters.product);

    // Date filter
    if (dateFilter !== "all") {
      const range = getDateRange(dateFilter);
      if (range) {
        result = result.filter((i) => {
          if (!i.rawDisbursementDate) return false;
          const disbursementDate = new Date(i.rawDisbursementDate);
          return (
            disbursementDate >= range.start && disbursementDate <= range.end
          );
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
  }, [disbursedLoans, filters, sortConfig, dateFilter, customStartDate, customEndDate]);

  // Export functions
  const exportToPDF = () => {
    if (filteredData.length === 0) return alert("No data to export");

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Mula Credit Ltd - Loan Disbursement Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${getCurrentTimestamp()}`, 14, 22);

    const headers = [
      [
        "No.", "Branch Name", "Total Amount", "Loan Officer", "RO Total Amount",
        "Customer Name", "Mobile Number", "ID Number", "Mpesa Reference",
        "Loan Reference Number", "Applied Loan Amount", "Disbursed Amount",
        "Interest Amount", "Business Name", "Business Type",
        "Product", "Next Payment Date", "Disbursement Date"
      ],
    ];

    const groupedData = groupLoansForDisplay(filteredData);
    const rows = [];
    let branchNum = 1;
    
    Object.values(groupedData).forEach(branch => {
      Object.values(branch.officers).forEach(officer => {
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

    doc.save(`loan-disbursement-report-${new Date().toISOString().split("T")[0]}.pdf`);
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
    XLSX.writeFile(wb, `loan-disbursement-report-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToCSV = () => {
    if (filteredData.length === 0) return alert("No data to export");

    const headers = [
      "No.", "Branch Name", "Total Amount", "Loan Officer", "RO Total Amount",
      "Customer Name", "Mobile Number", "ID Number", "Mpesa Reference",
      "Loan Reference Number", "Applied Loan Amount", "Disbursed Amount",
      "Interest Amount", "Business Name", "Business Type",
      "Product", "Next Payment Date", "Disbursement Date",
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
    link.download = `loan-disbursement-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToWord = async () => {
    if (filteredData.length === 0) return alert("No data to export");

    const rows = filteredData.map((d, i) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(String(i + 1))] }),
        new TableCell({ children: [new Paragraph(d.branch)] }),
        new TableCell({ children: [new Paragraph(d.loanOfficer)] }),
        new TableCell({ children: [new Paragraph(d.customerName)] }),
        new TableCell({ children: [new Paragraph(String(d.mobile))] }),
        new TableCell({ children: [new Paragraph(d.loanReferenceNumber)] }),
        new TableCell({ children: [new Paragraph(formatCurrency(d.disbursedAmount))] }),
      ]
    }));

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun({ text: "Mula Credit Ltd - Loan Disbursement Report", bold: true, size: 28 })] }),
          new Paragraph({ children: [new TextRun({ text: `Generated on: ${getCurrentTimestamp()}`, italics: true, size: 22 })] }),
          new Paragraph(" "),
          new Table({
            rows: [
              new TableRow({
                children: [
                  "No.", "Branch", "Loan Officer", "Customer Name", "Mobile", "Loan Ref", "Disbursed Amount"
                ].map(h => new TableCell({ children: [new Paragraph({ text: h, bold: true })] }))
              }),
              ...rows,
            ]
          })
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `loan-disbursement-report-${new Date().toISOString().split("T")[0]}.docx`);
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

  // Dropdown options
  const branches = [...new Set(disbursedLoans.map((i) => i.branch).filter((b) => b && b !== "N/A"))];
  const officers = [...new Set(disbursedLoans.map((i) => i.loanOfficer).filter((o) => o && o !== "N/A"))];
  const products = [...new Set(disbursedLoans.map((i) => i.productName).filter((p) => p && p !== "N/A"))];

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

  // Get grouped data for display
  const groupedData = groupLoansForDisplay(filteredData);

  // Calculate total rows for pagination
  let totalRows = 0;
  Object.values(groupedData).forEach((branch) => {
    Object.values(branch.officers).forEach((officer) => {
      totalRows += officer.customers.length;
    });
  });

  const totalPages = Math.ceil(totalRows / itemsPerPage);

  // Get current page data
  const getCurrentPageData = () => {
    const allRows = [];
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
              branchNumber:
                customerIndex === 0 && isFirstOfficerInBranch ? branchNumber : "",
              isFirstInBranch: customerIndex === 0 && isFirstOfficerInBranch,
              isFirstInOfficer: customerIndex === 0,
            });
          }
        });
        isFirstOfficerInBranch = false;
      });
      branchNumber++;
    });

    return allRows;
  };

  const currentData = getCurrentPageData();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 text-center">
        <p className="text-gray-500">Fetching disbursed loans...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-sm font-semibold" style={{ color: "#586ab1" }}>
                Disbursed Loan Report
              </h1>
              {/* <p className="text-sm text-gray-600 mt-1">
                Viewing disbursed loans for{" "}
                <span className="font-semibold text-blue-600">
                  {(() => {
                    switch (dateFilter) {
                      case "today": return "Today";
                      case "week": return "This Week";
                      case "month": return "This Month";
                      case "quarter": return "This Quarter";
                      case "year": return "This Year";
                      case "custom":
                        return customStartDate && customEndDate
                          ? `${customStartDate} to ${customEndDate}`
                          : "Custom Range";
                      default: return "All Time";
                    }
                  })()}
                </span>
              </p> */}
            </div>

           <div className="flex flex-wrap gap-3">

  {/* Filter Button */}
  <button
    onClick={toggleFilters}
    className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${
      showFilters
        ? "text-white shadow-md"
        : "text-[#586] border-2 hover:bg-[#f0f1f8]"
    }`}
    style={{
      backgroundColor: showFilters ? "#586ab1" : "white",
      borderColor: "#f0f1f8"
    }}
  >
    <Filter className="w-3 h-3" />
    <span>Filters</span>
  </button>

  {/* Export Format + Button */}
  <div className="flex gap-2 items-center">

    {/* Select Export Format */}
    <select
      value={exportFormat}
      onChange={(e) => setExportFormat(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm focus:outline-none"
      style={{
        border: "2px solid #586ab1",
        color: "#586ab1"
      }}
    >
      {exportFormatOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>

    {/* Export Button */}
    <button
      onClick={handleExport}
      className="px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all"
      style={{
        backgroundColor: "#586ab1",
        color: "white"
      }}
    >
      <Download className="w-3 h-3" />
      <span>Export</span>
    </button>
  </div>

</div>

          </div>
        </div>

        {/* Filter Section */}
        {showFilters && (
          <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
            <h3 className=" text-slate-600 text-sm">Filter Results</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {dateFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {dateFilter === "custom" && (
                <>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomDateRange(e.target.value, customEndDate)}
                    className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomDateRange(customStartDate, e.target.value)}
                    className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
                placeholder="Search name, ID, or phone"
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <select
                value={filters.branch}
                onChange={(e) => setFilters({ branch: e.target.value })}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select
                value={filters.officer}
                onChange={(e) => setFilters({ officer: e.target.value })}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Officers</option>
                {officers.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <select
                value={filters.product}
                onChange={(e) => setFilters({ product: e.target.value })}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {(filters.search || filters.branch || filters.officer || filters.product || dateFilter !== "all") && (
              <button
                onClick={clearFilters}
                className="text-red-600 text-sm font-medium flex items-center gap-1 mt-2 hover:text-red-700"
              >
                <X className="w-4 h-4" /> Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, totalRows)} of {totalRows} entries
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-sm text-left whitespace-nowrap">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 text-center font-semibold text-gray-700">No.</th>
                <th className="border p-2 font-semibold text-gray-700">Branch Name</th>
                <th className="border p-2 font-semibold text-gray-700">Total Amount</th>
                <th className="border p-2 font-semibold text-gray-700">Loan Officer</th>
                <th className="border p-2 font-semibold text-gray-700">RO Total Amount</th>
                <th className="border p-2 font-semibold text-gray-700">Customer Name</th>
                <th className="border p-2 font-semibold text-gray-700">Mobile Number</th>
                <th className="border p-2 font-semibold text-gray-700">ID Number</th>
                <th className="border p-2 font-semibold text-gray-700">Mpesa Reference</th>
                <th className="border p-2 font-semibold text-gray-700">Loan Reference</th>
                <th className="border p-2 font-semibold text-gray-700">Applied Amount</th>
                <th className="border p-2 font-semibold text-gray-700">Disbursed Amount</th>
                <th className="border p-2 font-semibold text-gray-700">Interest Amount</th>
                <th className="border p-2 font-semibold text-gray-700">Business Name</th>
                <th className="border p-2 font-semibold text-gray-700">Business Type</th>
                <th className="border p-2 font-semibold text-gray-700">Product</th>
                <th className="border p-2 font-semibold text-gray-700">Next Payment Date</th>
                <th className="border p-2 font-semibold text-gray-700">Disbursement Date</th>
              </tr>
            </thead>
            <tbody>
              {currentData.length > 0 ? (
                currentData.map((row, index) => (
                  <tr key={`${row.id}-${index}`} className="hover:bg-gray-50">
                     <td className="border p-2 text-center font-medium">
                      {row.branchNumber}
                    </td>
                    <td className="border p-2 font-semibold">
                      {row.isFirstInBranch ? row.branch : ""}
                    </td>
                    <td className="border p-2">
                      {row.isFirstInBranch ? formatCurrency(row.branchTotalAmount) : ""}
                    </td>
                    <td className="border p-2">
                      {row.isFirstInOfficer ? row.loanOfficer : ""}
                    </td>
                    <td className="border p-2">
                      {row.isFirstInOfficer ? formatCurrency(row.roTotalAmount) : ""}
                    </td>
                    <td className="border p-2">{row.customerName}</td>
                    <td className="border p-2">{row.mobile}</td>
                    <td className="border p-2">{row.idNumber}</td>
                    <td className="border p-2">{row.mpesaReference}</td>
                    <td className="border p-2">{row.loanReferenceNumber}</td>
                    <td className="border p-2">{formatCurrency(row.appliedLoanAmount)}</td>
                    <td className="border p-2">{formatCurrency(row.disbursedAmount)}</td>
                    <td className="border p-2">{formatCurrency(row.interestAmount)}</td>
                    <td className="border p-2">{row.business_name}</td>
                    <td className="border p-2">{row.business_type}</td>
                    <td className="border p-2">{row.productName}</td>
                    <td className="border p-2">{row.nextPaymentDate}</td>
                    <td className="border p-2">{row.disbursementDate}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="18" className="border p-4 text-center text-gray-500">
                    No disbursed loans found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls - Bottom */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalRows)} of {totalRows} entries
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