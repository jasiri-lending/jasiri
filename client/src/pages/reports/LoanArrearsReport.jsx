import React, { useState, useEffect } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { supabase } from "../../supabaseClient";

const LoanArrearsReport = () => {
  const [arrears, setArrears] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: "", branch: "", officer: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchLoanArrears();
  }, []);

const fetchLoanArrears = async () => {
  try {
    setLoading(true);
    setErrorMsg("");

    // First, get all loans that are disbursed
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select(`
        id,
        disbursed_date,
        duration_weeks,
        product_name,
        total_payable,
        booked_by,
        branch:branch_id(name),
        region:region_id(name),
        customer:customer_id (
          Firstname,
          Middlename,
          Surname,
          mobile,
          id_number
        ),
        loan_officer:booked_by(full_name)
      `)
      .eq("status", "disbursed")
      .not("disbursed_date", "is", null);

    if (loansError) throw loansError;

    const arrearsData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // remove time part for accurate comparison

    for (const loan of loans) {
      // Get all installments for this loan
      const { data: installments, error: installmentsError } = await supabase
        .from("loan_installments")
        .select("*")
        .eq("loan_id", loan.id)
        .order("due_date", { ascending: true });

      if (installmentsError) throw installmentsError;

      if (!installments || installments.length === 0) continue;
const elapsedInstallments = installments.filter(inst => {
  if (!inst.due_date) return false;

  const dueDate = new Date(inst.due_date);
  dueDate.setHours(0, 0, 0, 0);

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const dueAmount = parseFloat(inst.due_amount || 0);
  const paidAmount = parseFloat(inst.paid_amount || 0);

  // Overdue if unpaid amount exists and due date <= today
  return dueAmount > paidAmount && dueDate <= todayDate;
});



      if (elapsedInstallments.length === 0) continue;

      // Totals
      const totalPaid = installments.reduce((sum, inst) => sum + parseFloat(inst.paid_amount || 0), 0);
      const totalOutstanding = parseFloat(loan.total_payable || 0) - totalPaid;

      const arrearsAmount = elapsedInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.due_amount) - parseFloat(inst.paid_amount || 0)),
        0
      );

      const principalDue = elapsedInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.principal_amount) - parseFloat(inst.principal_paid || 0)),
        0
      );

      const interestDue = elapsedInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.interest_amount) - parseFloat(inst.interest_paid || 0)),
        0
      );

      // Next unpaid installment
      const nextInstallment = installments.find(inst => parseFloat(inst.paid_amount || 0) < parseFloat(inst.due_amount || 0));
      const currentTotalDue = nextInstallment
        ? parseFloat(nextInstallment.due_amount) - parseFloat(nextInstallment.paid_amount || 0)
        : 0;

      // Overdue days from first elapsed installment
      const firstElapsed = elapsedInstallments[0];
      const overdueDays = Math.floor(
        (today - new Date(firstElapsed.due_date)) / (1000 * 60 * 60 * 24)
      );

      // Loan start and end dates
      const loanStartDate = loan.disbursed_date ? new Date(loan.disbursed_date) : null;
      let loanEndDate = null;
      if (loanStartDate && loan.duration_weeks) {
        loanEndDate = new Date(loanStartDate);
        loanEndDate.setDate(loanEndDate.getDate() + (loan.duration_weeks * 7));
      }

      const nextPaymentInstallment = installments.find(inst =>
        new Date(inst.due_date) > today && parseFloat(inst.paid_amount || 0) < parseFloat(inst.due_amount || 0)
      );
      const nextPayment = nextPaymentInstallment ? new Date(nextPaymentInstallment.due_date) : null;

      arrearsData.push({
        id: loan.id,
        no: arrearsData.length + 1,
        branch_name: loan.branch?.name || "N/A",
        customer_name: [loan.customer?.Firstname, loan.customer?.Middlename, loan.customer?.Surname].filter(Boolean).join(" "),
        phone: loan.customer?.mobile || "N/A",
        id_number: loan.customer?.id_number || "N/A",
        loan_officer: loan.loan_officer?.name || "N/A",
        loan_product: loan.product_name || "N/A",
        total_payable: parseFloat(loan.total_payable || 0).toFixed(2),
        principal_due: principalDue.toFixed(2),
        interest_due: interestDue.toFixed(2),
        total_outstanding: totalOutstanding.toFixed(2),
        arrears_amount: arrearsAmount.toFixed(2),
        current_total_due: currentTotalDue.toFixed(2),
        total_paid: totalPaid.toFixed(2),
        overdue_days: overdueDays,
        no_of_installments: installments.length,
        number_elapsed_schedule: elapsedInstallments.length,
        loan_start_date: loanStartDate?.toISOString().split("T")[0] || "N/A",
        loan_end_date: loanEndDate?.toISOString().split("T")[0] || "N/A",
        next_payment: nextPayment?.toISOString().split("T")[0] || "N/A",
      });
    }

    setArrears(arrearsData);
    setFiltered(arrearsData);

    const uniqueBranches = [...new Set(arrearsData.map(r => r.branch_name))];
    setBranches(uniqueBranches);

    const uniqueOfficers = [...new Set(arrearsData.map(r => r.loan_officer))];
    setOfficers(uniqueOfficers);
  } catch (err) {
    console.error("Error fetching arrears:", err.message);
    setErrorMsg("Failed to load Loan Arrears Report. Please try again.");
  } finally {
    setLoading(false);
  }
};


  // Filtering logic
  useEffect(() => {
    let result = [...arrears];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.id_number.includes(q) ||
          r.loan_product.toLowerCase().includes(q)
      );
    }

    if (filters.branch) result = result.filter((r) => r.branch_name === filters.branch);
    if (filters.officer) result = result.filter((r) => r.loan_officer === filters.officer);

    setFiltered(result);
    setCurrentPage(1);
  }, [filters, arrears]);

  const clearFilters = () => setFilters({ search: "", branch: "", officer: "" });

  const exportToCSV = () => {
    if (filtered.length === 0) return alert("No data to export");

    const headers = [
      "No", "Branch Name", "Customer Name", "Phone", "ID Number", 
      "Loan Officer", "Loan Product", "Total Payable", "Principal Due", 
      "Interest Due", "Total Outstanding", "Arrears Amount", 
      "Current Total Due", "Total Paid", "Overdue Days", 
      "No of Installments", "Elapsed Schedules", "Loan Start Date", 
      "Loan End Date", "Next Payment"
    ];

    const csvData = filtered.map((r, i) => [
      i + 1,
      r.branch_name,
      `"${r.customer_name}"`,
      r.phone,
      r.id_number,
      r.loan_officer,
      r.loan_product,
      r.total_payable,
      r.principal_due,
      r.interest_due,
      r.total_outstanding,
      r.arrears_amount,
      r.current_total_due,
      r.total_paid,
      r.overdue_days,
      r.no_of_installments,
      r.number_elapsed_schedule,
      r.loan_start_date,
      r.loan_end_date,
      r.next_payment
    ]);

    const csv = [headers, ...csvData]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan_arrears_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentData = filtered.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Loan Arrears Report</h2>
          <p className="text-sm text-gray-600 mt-1">
            Comprehensive report showing loans with elapsed payment schedules
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
          <button
            onClick={exportToCSV}
              className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                style={{ backgroundColor: "#586ab1" }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, phone, ID, or product..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg w-full"
              />
            </div>

            <select
              value={filters.branch}
              onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
              className="border border-gray-300 px-3 py-2 rounded-lg w-full"
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
              onChange={(e) => setFilters({ ...filters, officer: e.target.value })}
              className="border border-gray-300 px-3 py-2 rounded-lg w-full"
            >
              <option value="">All Officers</option>
              {officers.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {(filters.search || filters.branch || filters.officer) && (
            <button
              onClick={clearFilters}
              className="text-red-600 flex items-center gap-1 text-sm font-medium mt-2"
            >
              <X className="w-4 h-4" /> Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading loan arrears report...</div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-red-600">{errorMsg}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No arrears found.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">No</th>
                  <th className="px-4 py-3 text-left">Branch Name</th>
                  <th className="px-4 py-3 text-left">Customer Name</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">ID Number</th>
                  <th className="px-4 py-3 text-left">Loan Officer</th>
                  <th className="px-4 py-3 text-left">Loan Product</th>
                  <th className="px-4 py-3 text-left">Total Payable</th>
                  <th className="px-4 py-3 text-left">Principal Due</th>
                  <th className="px-4 py-3 text-left">Interest Due</th>
                  <th className="px-4 py-3 text-left">Total Outstanding</th>
                  <th className="px-4 py-3 text-left">Arrears Amount</th>
                  <th className="px-4 py-3 text-left">Current Due</th>
                  <th className="px-4 py-3 text-left">Total Paid</th>
                  <th className="px-4 py-3 text-left">Overdue Days</th>
                  <th className="px-4 py-3 text-left">Total Installments</th>
                  <th className="px-4 py-3 text-left">Elapsed Schedules</th>
                  <th className="px-4 py-3 text-left">Start Date</th>
                  <th className="px-4 py-3 text-left">End Date</th>
                  <th className="px-4 py-3 text-left">Next Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentData.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{(currentPage - 1) * itemsPerPage + i + 1}</td>
                    <td className="px-4 py-3">{r.branch_name}</td>
                    <td className="px-4 py-3 font-medium">{r.customer_name}</td>
                    <td className="px-4 py-3">{r.phone}</td>
                    <td className="px-4 py-3">{r.id_number}</td>
                    <td className="px-4 py-3">{r.loan_officer}</td>
                    <td className="px-4 py-3">{r.loan_product}</td>
                    <td className="px-4 py-3">{r.total_payable}</td>
                    <td className="px-4 py-3">{r.principal_due}</td>
                    <td className="px-4 py-3">{r.interest_due}</td>
                    <td className="px-4 py-3">{r.total_outstanding}</td>
                    <td className="px-4 py-3 text-red-600 font-semibold">{r.arrears_amount}</td>
                    <td className="px-4 py-3">{r.current_total_due}</td>
                    <td className="px-4 py-3">{r.total_paid}</td>
                    <td className="px-4 py-3 text-red-600">{r.overdue_days}</td>
                    <td className="px-4 py-3">{r.no_of_installments}</td>
                    <td className="px-4 py-3 text-orange-600">{r.number_elapsed_schedule}</td>
                    <td className="px-4 py-3">{r.loan_start_date}</td>
                    <td className="px-4 py-3">{r.loan_end_date}</td>
                    <td className="px-4 py-3">{r.next_payment}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
              <span className="text-sm text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1}–
                {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-md border ${
                    currentPage === 1
                      ? "text-gray-400 bg-gray-100"
                      : "text-gray-700 bg-white hover:bg-gray-100"
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-md border ${
                    currentPage === totalPages
                      ? "text-gray-400 bg-gray-100"
                      : "text-gray-700 bg-white hover:bg-gray-100"
                  }`}
                >
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

export default LoanArrearsReport;