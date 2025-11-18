import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Filter, Download, X, Calendar } from "lucide-react";
import React from "react";

const LoanDueReport = () => {
  const [dueLoans, setDueLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [filters, setFilters] = useState({
    officer: "",
    branch: "",
    customerQuery: "",
    dateRange: "today",
    customStartDate: "",
    customEndDate: "",
     installmentsDue: "",
  });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (!error) setBranches(data || []);
    };
    fetchBranches();
  }, []);

  const getDateRange = () => {
    const today = new Date();
    let startDate, endDate;

    switch (filters.dateRange) {
      case "today":
        startDate = endDate = today.toISOString().split("T")[0];
        break;
      case "week":
        startDate = today.toISOString().split("T")[0];
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 6);
        endDate = weekEnd.toISOString().split("T")[0];
        break;
      case "month":
        startDate = today.toISOString().split("T")[0];
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate = monthEnd.toISOString().split("T")[0];
        break;
      case "quarter":
        startDate = today.toISOString().split("T")[0];
        const quarterEnd = new Date(today);
        quarterEnd.setMonth(today.getMonth() + 3);
        endDate = quarterEnd.toISOString().split("T")[0];
        break;
      case "year":
        startDate = today.toISOString().split("T")[0];
        const yearEnd = new Date(today.getFullYear(), 11, 31);
        endDate = yearEnd.toISOString().split("T")[0];
        break;
      case "custom":
        startDate = filters.customStartDate;
        endDate = filters.customEndDate;
        break;
      default:
        startDate = endDate = today.toISOString().split("T")[0];
    }

    return { startDate, endDate };
  };

  useEffect(() => {
    const fetchDueLoans = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange();

        if (filters.dateRange === "custom" && (!startDate || !endDate)) {
          setDueLoans([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("loans")
          .select(`
            id,
            scored_amount,
            total_payable,
            product_name,
            product_type,
            disbursed_at,
            branch_id,
            branch:branch_id(name),
            customer:customer_id(id, "Firstname", "Middlename", "Surname", mobile, id_number),
            loan_officer:booked_by(full_name),
            installments:loan_installments(
              due_date,
              due_amount,
              paid_amount,
              status,
              principal_amount,
              interest_amount,
              principal_due,
              interest_due
            )
          `)
          .eq("status", "disbursed");

        if (error) throw error;

        const processed = data
          .map((loan) => {
            const branch = loan.branch?.name || "N/A";
            const officer = loan.loan_officer?.full_name || "N/A";
            const cust = loan.customer || {};
            const fullName = [cust.Firstname, cust.Middlename, cust.Surname].filter(Boolean).join(" ");

            // Filter installments within date range
            const dueInRange = (loan.installments || []).filter((i) => {
              const dueDate = i.due_date?.split("T")[0];
              return (
                dueDate >= startDate &&
                dueDate <= endDate &&
                ["pending", "partial"].includes(i.status)
              );
            });

            if (dueInRange.length === 0) return null;

            const totalDueInRange = dueInRange.reduce((sum, i) => sum + Number(i.due_amount || 0), 0);
            const principalDue = dueInRange.reduce((sum, i) => sum + Number(i.principal_due || i.principal_amount || 0), 0);
            const interestDue = dueInRange.reduce((sum, i) => sum + Number(i.interest_due || i.interest_amount || 0), 0);
            const numDueInstallments = dueInRange.length;
            const totalPaid = loan.installments.reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
            const unpaidAmount = loan.total_payable - totalPaid;

            return {
              branch,
              officer,
              loanId: loan.id,
              customerName: fullName || "N/A",
              mobile: cust.mobile || "N/A",
              idNumber: cust.id_number || "N/A",
              productName: loan.product_name || "N/A",
              productType: loan.product_type || "N/A",
              numDueInstallments,
              disbursedAmount: loan.scored_amount || 0,
              principalDue,
              interestDue,
              totalDue: totalDueInRange,
              totalPaid,
              amountUnpaid: unpaidAmount,
              disbursementDate: loan.disbursed_at?.split("T")[0] || "N/A",
              expectedDueDate: dueInRange[0]?.due_date?.split("T")[0] || "N/A",
            };
          })
          .filter(Boolean);

        setDueLoans(processed);

        // Populate filter dropdowns
        const uniqueOfficers = [...new Set(processed.map((l) => l.officer))];
        setOfficers(uniqueOfficers);
      } catch (err) {
        console.error("Error fetching due loans:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDueLoans();
  }, [filters.dateRange, filters.customStartDate, filters.customEndDate]);

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);



const filteredData = dueLoans.filter((l) => {
  const { officer, branch, customerQuery, installmentsDue } = filters;
  const query = customerQuery.toLowerCase();
  return (
    (!officer || l.officer === officer) &&
    (!branch || l.branch === branch) &&
    (!customerQuery ||
      l.customerName.toLowerCase().includes(query) ||
      l.mobile.includes(query) ||
      l.idNumber.includes(query)) &&
    (!installmentsDue || l.numDueInstallments === Number(installmentsDue))
  );
});


  // Group by branch, then by officer
  const grouped = filteredData.reduce((acc, loan) => {
    if (!acc[loan.branch]) {
      acc[loan.branch] = {
        branch: loan.branch,
        totalDue: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        count: 0,
        officers: {},
      };
    }

    if (!acc[loan.branch].officers[loan.officer]) {
      acc[loan.branch].officers[loan.officer] = {
        officer: loan.officer,
        loans: [],
      };
    }

    acc[loan.branch].totalDue += loan.totalDue;
    acc[loan.branch].totalPaid += loan.totalPaid;
    acc[loan.branch].totalUnpaid += loan.amountUnpaid;
    acc[loan.branch].count += 1;
    acc[loan.branch].officers[loan.officer].loans.push(loan);

    return acc;
  }, {});

  const getDateRangeLabel = () => {
    switch (filters.dateRange) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "quarter":
        return "This Quarter";
      case "year":
        return "This Year";
      case "custom":
        return "Custom Range";
      default:
        return "Today";
    }
  };

  const exportToCSV = () => {
    const headers = [
      "No",
      "Branch",
      "Officer",
      "Customer Name",
      "Mobile",
      "ID Number",
      "Product Name",
      "Product Type",
      "# Installments",
      "Disbursed Amount",
      "Principal Due",
      "Interest Due",
      "Total Due",
      "Total Paid",
      "Unpaid Amount",
      "Expected Date",
      "Disbursed At",
    ];

    let rowNum = 0;
    const rows = [];

    Object.values(grouped).forEach((branchGroup) => {
      Object.values(branchGroup.officers).forEach((officerGroup) => {
        officerGroup.loans.forEach((loan) => {
          rowNum++;
          rows.push([
            rowNum,
            loan.branch,
            loan.officer,
            loan.customerName,
            loan.mobile,
            loan.idNumber,
            loan.productName,
            loan.productType,
            loan.numDueInstallments,
            loan.disbursedAmount,
            loan.principalDue,
            loan.interestDue,
            loan.totalDue,
            loan.totalPaid,
            loan.amountUnpaid,
            loan.expectedDueDate,
            loan.disbursementDate,
          ]);
        });
      });
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan-due-report-${getDateRangeLabel()}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate grand totals
  const grandTotals = filteredData.reduce(
    (acc, loan) => ({
      totalDue: acc.totalDue + loan.totalDue,
      totalPaid: acc.totalPaid + loan.totalPaid,
      totalUnpaid: acc.totalUnpaid + loan.amountUnpaid,
      principalDue: acc.principalDue + loan.principalDue,
      interestDue: acc.interestDue + loan.interestDue,
      disbursedAmount: acc.disbursedAmount + loan.disbursedAmount,
    }),
    {
      totalDue: 0,
      totalPaid: 0,
      totalUnpaid: 0,
      principalDue: 0,
      interestDue: 0,
      disbursedAmount: 0,
    }
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-sm font-semibold" style={{ color: "#586ab1" }}>Loan Due Report</h1>
              <p className="text-sm text-gray-600 mt-1">
                Viewing loans due: <span className="font-semibold text-blue-600">{getDateRangeLabel()}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${
                  showFilters
                    ? "bg-blue-300 text-white shadow-md"
                    : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
              <button
                onClick={exportToCSV}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium shadow-md transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text font-semibold text-gray-900">Filter Options</h3>
              {(filters.customerQuery || filters.officer || filters.branch) && (
                <button
                  onClick={() => setFilters((p) => ({ ...p, customerQuery: "", officer: "", branch: "" }))}
                  className="text-red-600 text-sm flex items-center gap-1.5 hover:text-red-700 font-medium"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              )}
            </div>

            {/* Date Range Filter */}
            <div className="space-y-3">
              <label className="flex items-center text-sm font-semibold text-gray-700 gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Date Range
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters((p) => ({ ...p, dateRange: e.target.value }))}
                  className="w-full border-2 border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="today">Loans Due Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Date Range</option>
                </select>

                {filters.dateRange === "custom" && (
                  <>
                    <input
                      type="date"
                      value={filters.customStartDate}
                      onChange={(e) => setFilters((p) => ({ ...p, customStartDate: e.target.value }))}
                      className="w-full border-2 border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Start Date"
                    />
                    <input
                      type="date"
                      value={filters.customEndDate}
                      onChange={(e) => setFilters((p) => ({ ...p, customEndDate: e.target.value }))}
                      className="w-full border-2 border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="End Date"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Other Filters */}
            <div className="pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Search Customer</label>
                  <input
                    type="text"
                    placeholder="Name, mobile, or ID number"
                    value={filters.customerQuery}
                    onChange={(e) => setFilters((p) => ({ ...p, customerQuery: e.target.value }))}
                    className="w-full border-2 border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Loan Officer</label>
                  <select
                    value={filters.officer}
                    onChange={(e) => setFilters((p) => ({ ...p, officer: e.target.value }))}
                    className="w-full border-2 border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">All Officers</option>
                    {officers.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Branch</label>
                  <select
                    value={filters.branch}
                    onChange={(e) => setFilters((p) => ({ ...p, branch: e.target.value }))}
                    className="w-full border-2 border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">Installments Due</label>
  <select
    value={filters.installmentsDue}
    onChange={(e) => setFilters((p) => ({ ...p, installmentsDue: e.target.value }))}
    className="w-full border-2 border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
  >
    <option value="">All</option>
    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
      <option key={n} value={n}>{n}</option>
    ))}
  </select>
</div>

              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Loans Due</div>
            <div className="text font-bold text-slate-600">{filteredData.length}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Amount Due</div>
            <div className=" font-bold text-red-600">{formatCurrency(grandTotals.totalDue)}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Unpaid Balance</div>
            <div className=" font-bold text-orange-600">{formatCurrency(grandTotals.totalUnpaid)}</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
  <table className="min-w-full">
    {/* === Table Head === */}
    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
      <tr>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">No</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Branch</th>
        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Total Due</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Officer</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Customer Name</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Mobile</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">ID Number</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Product Name</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Product Type</th>
        <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap"># Inst.</th>
        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Disbursed</th>
        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Principal Due</th>
        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Interest Due</th>
        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Paid</th>
        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Unpaid</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Expected Date</th>
        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Disbursed At</th>
      </tr>
    </thead>

    {/* === Table Body === */}
    <tbody className="bg-white divide-y divide-gray-200">
      {Object.entries(grouped).map(([branchName, branchGroup], branchIdx) => {
        let rowNum = Object.entries(grouped)
          .slice(0, branchIdx)
          .reduce((sum, [, bg]) => sum + bg.count, 0);

        return (
          <React.Fragment key={branchName}>
            {/* Officers and their loans */}
            {Object.entries(branchGroup.officers).map(([officerName, officerGroup]) => (
              <React.Fragment key={officerName}>
                {officerGroup.loans.map((loan, loanIdx) => {
                  rowNum++;
                  return (
                    <tr key={loan.loanId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{rowNum}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {loanIdx === 0 ? loan.branch : ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 font-semibold whitespace-nowrap">
                        {formatCurrency(loan.totalDue)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {loanIdx === 0 ? loan.officer : ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                        {loan.customerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{loan.mobile}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{loan.idNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{loan.productName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{loan.productType}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900 whitespace-nowrap">
                        {loan.numDueInstallments}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                        {formatCurrency(loan.disbursedAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                        {formatCurrency(loan.principalDue)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                        {formatCurrency(loan.interestDue)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold whitespace-nowrap">
                        {formatCurrency(loan.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600 font-semibold whitespace-nowrap">
                        {formatCurrency(loan.amountUnpaid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {loan.expectedDueDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {loan.disbursementDate}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      })}

      {/* === Grand Totals Row === */}
      <tr className=" text-white font-bold border-t-4 border-gray-400">
        <td colSpan="2" className="px-4 py-4 text-right text-sm uppercase tracking-wider">
          Totals:
        </td>
        <td className="px-4 py-4 text-right text-red-500 whitespace-nowrap">
          {formatCurrency(grandTotals.totalDue)}
        </td>
        <td colSpan="10"></td>
        <td className="px-4 py-4 text-right text-green-600 whitespace-nowrap">
          {formatCurrency(grandTotals.totalPaid)}
        </td>
        <td className="px-4 py-4 text-right text-orange-500 whitespace-nowrap">
          {formatCurrency(grandTotals.totalUnpaid)}
        </td>
        <td colSpan="2"></td>
      </tr>
    </tbody>
  </table>
</div>

      </div>
    </div>
  );
};

export default LoanDueReport;