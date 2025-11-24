import React, { useState, useEffect } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { supabase } from "../../supabaseClient";

const LoanListing = () => {
  const [loans, setLoans] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [statusTypes, setStatusTypes] = useState([]);
  const [repaymentStates, setRepaymentStates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    loanOfficer: "",
    productType: "all",
    status: "all",
    repaymentState: "all",
  });

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name");
      if (!error) setBranches(data);
    };
    fetchBranches();
  }, []);

 useEffect(() => {
  const fetchAllLoans = async () => {
    try {
      setLoading(true);

      // Fetch all relevant data
      const [
        loansRes,
        c2bRes,
        customersRes,
        usersRes,
        branchesRes,
        b2cRes,
      ] = await Promise.all([
        supabase
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
            rm_decision
          `)
          .order("booked_at", { ascending: false }),

        supabase
          .from("mpesa_c2b_transactions")
          .select("loan_id, amount, payment_type")
          .eq("payment_type", "repayment"),

        supabase
          .from("customers")
          .select("id, Firstname, Middlename, Surname, id_number, mobile, prequalifiedAmount"),

        supabase.from("users").select("id, full_name"),

        supabase.from("branches").select("id, name"),

        supabase.from("mpesa_b2c_transactions").select("loan_id, amount"),
      ]);

      // Error checking
      if (
        loansRes.error ||
        c2bRes.error ||
        customersRes.error ||
        usersRes.error ||
        branchesRes.error ||
        b2cRes.error
      ) {
        throw new Error("Error fetching one or more tables.");
      }

      const loansData = loansRes.data || [];
      const customers = customersRes.data || [];
      const users = usersRes.data || [];
      const branches = branchesRes.data || [];
      const disbursements = b2cRes.data || [];
      const repayments = c2bRes.data || [];

      const processedLoans = loansData.map((loan) => {
        const customer = customers.find((c) => c.id === loan.customer_id);
        const branch = branches.find((b) => b.id === loan.branch_id);
        const loanOfficer = users.find((u) => u.id === loan.booked_by);
        const branchManager = users.find((u) => u.id === loan.approved_by_bm);
        const regionManager = users.find((u) => u.id === loan.approved_by_rm);

        // Calculate total repaid for this loan
        const totalRepaid = repayments
          .filter((tx) => tx.loan_id === loan.id)
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        // Get disbursed amount
        const disbursedTx = disbursements.find((tx) => tx.loan_id === loan.id);
        const disbursedAmount = disbursedTx ? Number(disbursedTx.amount) : 0;

        // Get applied amount from prequalified
        const appliedAmount = customer?.prequalifiedAmount
          ? Number(customer.prequalifiedAmount)
          : 0;

        const customerName = customer
          ? `${customer.Firstname || ""} ${customer.Middlename || ""} ${
              customer.Surname || ""
            }`.trim()
          : "N/A";

        return {
          id: loan.id,
          customer_name: customerName,
          customer_id: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          branch: branch?.name || "N/A",
          loan_officer: loanOfficer?.full_name || "N/A",
          branch_manager: branchManager?.full_name || "N/A",
          region_manager: regionManager?.full_name || "N/A",
          loan_product: loan.product_name || "N/A",
          product_type: loan.product_type || "N/A",
          applied_amount: appliedAmount,
          disbursed_amount: disbursedAmount,
          total_repaid: totalRepaid,
          total_payable: Number(loan.total_payable) || 0,
          weekly_payment: Number(loan.weekly_payment) || 0,
          duration_weeks: loan.duration_weeks || 0,
          interest_rate: Number(loan.interest_rate) || 0,
          booked_date: loan.booked_at ? new Date(loan.booked_at).toLocaleDateString() : "N/A",
          disbursed_date: loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : "N/A",
          status: loan.status || "N/A",
          repayment_state: loan.repayment_state || "N/A",
        };
      });

      setLoans(processedLoans);
      setFiltered(processedLoans);

      // Generate unique filter options
      setOfficers([...new Set(processedLoans.map((r) => r.loan_officer).filter((o) => o !== "N/A"))]);
      setProductTypes([...new Set(processedLoans.map((r) => r.product_type).filter(Boolean))]);
      setStatusTypes([...new Set(processedLoans.map((r) => r.status).filter(Boolean))]);
      setRepaymentStates([...new Set(processedLoans.map((r) => r.repayment_state).filter(Boolean))]);
    } catch (err) {
      console.error("Error fetching loan listings:", err.message);
    } finally {
      setLoading(false);
    }
  };

  fetchAllLoans();
}, []);


  // Filters and sorting
  useEffect(() => {
    let result = [...loans];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          r.customer_id.includes(q)
      );
    }

    if (filters.branch) {
      result = result.filter((r) => r.branch === filters.branch);
    }

    if (filters.loanOfficer) {
      result = result.filter((r) => r.loan_officer === filters.loanOfficer);
    }

    if (filters.productType !== "all") {
      result = result.filter((r) => r.product_type === filters.productType);
    }

    if (filters.status !== "all") {
      result = result.filter((r) => r.status === filters.status);
    }

    if (filters.repaymentState !== "all") {
      result = result.filter(
        (r) => r.repayment_state === filters.repaymentState
      );
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFiltered(result);
    setCurrentPage(1);
  }, [filters, loans, sortConfig]);

  const handleSort = (key) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

  const SortableHeader = ({ label, sortKey }) => (
    <th
      onClick={() => handleSort(sortKey)}
      className="px-4 py-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors whitespace-nowrap text-left text-sm"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortConfig.key === sortKey &&
          (sortConfig.direction === "asc" ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          ))}
      </div>
    </th>
  );

  const handleFilterChange = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () =>
    setFilters({
      search: "",
      branch: "",
      loanOfficer: "",
      productType: "all",
      status: "all",
      repaymentState: "all",
    });

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  const exportToCSV = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const csv = [
      [
        "No",
        "Customer Name",
        "ID Number",
        "Mobile",
        "Branch",
        "Loan Officer",
        "Branch Manager",
        "Region Manager",
        "Loan Product",
        "Product Type",
        "Scored Amount",
        "Processing Fee",
        "Registration Fee",
        "Net Disbursement",
        "Total Payable",
        "Weekly Payment",
        "Duration (Weeks)",
        "Interest Rate (%)",
        "Booked Date",
        "Disbursed Date",
        "BM Approved Date",
        "RM Approved Date",
        "Days Since Booking",
        "Days Since Disbursement",
        "Days Since BM Approval",
        "Days Since RM Approval",
        "BM Decision",
        "RM Decision",
        "Status",
        "Repayment State",
      ],
      ...filtered.map((r, i) => [
        i + 1,
        `"${r.customer_name}"`,
        r.customer_id,
        r.mobile,
        r.branch,
        r.loan_officer,
        r.branch_manager,
        r.region_manager,
        r.loan_product,
        r.product_type,
        r.scored_amount.toFixed(2),
        r.processing_fee.toFixed(2),
        r.registration_fee.toFixed(2),
        r.net_disbursement.toFixed(2),
        r.total_payable.toFixed(2),
        r.weekly_payment.toFixed(2),
        r.duration_weeks,
        r.interest_rate.toFixed(2),
        r.booked_date,
        r.disbursed_date,
        r.bm_approved_date,
        r.rm_approved_date,
        r.days_since_booking,
        r.days_since_disbursement || "N/A",
        r.days_since_bm_approval || "N/A",
        r.days_since_rm_approval || "N/A",
        r.bm_decision,
        r.rm_decision,
        r.status,
        r.repayment_state,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan_listing_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getStatusBadge = (status) => {
    const baseClasses =
      "px-2.5 py-1 rounded-full text-xs font-semibold uppercase";

    switch (status?.toLowerCase()) {
      case "disbursed":
      case "completed":
      case "paid":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "approved":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "pending":
      case "ca_review":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case "rejected":
      case "defaulted":
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentData = filtered.slice(startIdx, endIdx);

  // Calculate summary statistics
  const totalLoans = filtered.length;


 

  // Total payable (principal + interest, etc.)
  const totalPayable = filtered.reduce(
    (sum, r) => sum + (r.total_payable || 0),
    0
  );

  // Total principal (scored amount) thus should be total of applied_amount
 const totalPrincipal = filtered.reduce(
  (sum, r) => sum + (r.disbursed_amount || 0),
  0
);

  // Total repaid (from c2b_transactions with payment_type = 'repayment')
  const totalRepaid = filtered.reduce(
    (sum, r) => sum + (r.total_repaid || 0),
    0
  );

  // Outstanding balance
  const totalOutstanding = totalPayable - totalRepaid;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
              Complete Loan Listing
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Comprehensive view of all loans in the system
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

      {/* Filters */}
      {showFilters && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Filter Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by customer, ID, or mobile..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange("branch", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={filters.loanOfficer}
              onChange={(e) =>
                handleFilterChange("loanOfficer", e.target.value)
              }
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Officers</option>
              {officers.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            <select
              value={filters.productType}
              onChange={(e) =>
                handleFilterChange("productType", e.target.value)
              }
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onChange={(e) =>
                handleFilterChange("repaymentState", e.target.value)
              }
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            filters.branch ||
            filters.loanOfficer ||
            filters.productType !== "all" ||
            filters.status !== "all" ||
            filters.repaymentState !== "all") && (
            <button
              onClick={clearFilters}
              className="text-red-600 text-sm font-medium flex items-center gap-1 mt-2 hover:text-red-700"
            >
              <X className="w-4 h-4" /> Clear Filters
            </button>
          )}
        </div>
      )}

    
      {/* Data Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Loans</p>
          <p className="text-2xl font-bold text-gray-900">{totalLoans}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Disbursed</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(totalPrincipal)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Payable</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalPayable)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Repaid</p>
          <p className="text-2xl font-bold text-green-700">
            {formatCurrency(totalRepaid)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">
            Outstanding Balance
          </p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Loading loan listings...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No loans found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-4 font-semibold text-gray-700 text-left whitespace-nowrap">
                      #
                    </th>
                    <SortableHeader
                      label="Customer Name"
                      sortKey="customer_name"
                    />
                    <SortableHeader label="ID Number" sortKey="customer_id" />
                    <SortableHeader label="Mobile" sortKey="mobile" />
                    <SortableHeader label="Branch" sortKey="branch" />
                    <SortableHeader
                      label="Loan Officer"
                      sortKey="loan_officer"
                    />
                    <SortableHeader label="Product" sortKey="loan_product" />
                    <SortableHeader label="Type" sortKey="product_type" />
                    <SortableHeader
                      label="Applied Amount"
                      sortKey="applied_amount"
                    />
                    <SortableHeader
                      label="Disbursed Amount"
                      sortKey="disbursed_amount"
                    />
                    <SortableHeader
                      label="Processing  Fee"
                      sortKey="registration_fee"
                    />
                    <SortableHeader
                      label="Total Payable"
                      sortKey="total_payable"
                    />
                    <SortableHeader
                      label="Weekly Payment"
                      sortKey="weekly_payment"
                    />
                    <SortableHeader
                      label="Duration (Weeks)"
                      sortKey="duration_weeks"
                    />
                    <SortableHeader
                      label="Interest Rate (%)"
                      sortKey="interest_rate"
                    />
                    <SortableHeader label="Booked Date" sortKey="booked_date" />
                    <SortableHeader
                      label="Disbursed Date"
                      sortKey="disbursed_date"
                    />

                    <SortableHeader
                      label="Repayment State"
                      sortKey="repayment_state"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentData.map((loan, i) => (
                    <tr
                      key={loan.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4 text-gray-900 font-medium whitespace-nowrap">
                        {startIdx + i + 1}
                      </td>
                      <td className="px-4 py-4 text-gray-900 font-medium whitespace-nowrap">
                        {loan.customer_name}
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {loan.customer_id}
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {loan.mobile}
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {loan.branch}
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {loan.loan_officer}
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {loan.loan_product}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                          {loan.product_type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-900 font-semibold whitespace-nowrap">
                        {formatCurrency(loan.applied_amount)}
                      </td>
                      <td className="px-4 py-4 text-right text-green-700 font-semibold whitespace-nowrap">
                        {formatCurrency(loan.disbursed_amount)}
                      </td>

                      <td className="px-4 py-4 text-right text-red-700 font-semibold whitespace-nowrap">
                        {formatCurrency(loan.processing_fee)}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-900 whitespace-nowrap">
                        {formatCurrency(loan.total_payable)}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-900 whitespace-nowrap">
                        {formatCurrency(loan.weekly_payment)}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700 whitespace-nowrap">
                        {loan.duration_weeks}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700 whitespace-nowrap">
                        {loan.interest_rate.toFixed(2)}%
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {loan.booked_date}
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {loan.disbursed_date !== "N/A"
                          ? loan.disbursed_date
                          : "Pending"}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(loan.repayment_state)}>
                          {loan.repayment_state.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIdx + 1}</span> to{" "}
                <span className="font-semibold">
                  {Math.min(endIdx, filtered.length)}
                </span>{" "}
                of <span className="font-semibold">{filtered.length}</span>{" "}
                loans
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${
                    currentPage === 1
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }).map(
                    (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white font-semibold"
                              : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
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
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${
                    currentPage === totalPages
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoanListing;
