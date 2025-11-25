import { useState, useEffect, useMemo, useCallback } from "react";
import { Download, Filter, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";


const CustomerAccountModal = () => {
  const [customerAccountData, setCustomerAccountData] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    customerQuery: "",
    branch: "",
    status: "",
    startDate: "",
    endDate: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
   const navigate = useNavigate(); 
  
 
  // Fetch branches - only once on mount
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (!error) setBranches(data || []);
    };
    fetchBranches();
  }, []);

  // Fetch customer loan data - only once on mount
  useEffect(() => {
    let isMounted = true;

    const fetchCustomerAccounts = async () => {
      try {
        setLoading(true);

        const { data: loans, error } = await supabase
          .from("loans")
          .select(`
            id,
            scored_amount,
            total_interest,
            total_payable,
            status,
            disbursed_date,
            customer:customer_id(
              id,
              "Firstname",
              "Middlename",
              "Surname",
              mobile,
              branch:branch_id(name)
            ),
            installments:loan_installments(
              paid_amount
            )
          `);

        if (error) throw error;

        // Only update state if component is still mounted
        if (isMounted) {
          const customerSummary = {};

          loans.forEach((loan) => {
            const cust = loan.customer || {};
            const custId = cust.id;
            const fullName = [cust.Firstname, cust.Middlename, cust.Surname]
              .filter(Boolean)
              .join(" ");

            const totalPaid = loan.installments?.reduce(
              (sum, i) => sum + (i.paid_amount || 0),
              0
            );

            const outstanding =
              (loan.total_payable || 0) - totalPaid > 0
                ? (loan.total_payable || 0) - totalPaid
                : 0;

            if (!customerSummary[custId]) {
              customerSummary[custId] = {
                customerId: custId,
                customerName: fullName || "N/A",
                phone: cust.mobile || "N/A",
                branch: cust.branch?.name || "N/A",
                totalLoanApplied: 0,
                loanAmount: 0,
                interest: 0,
                totalPayable: 0,
                totalPaid: 0,
                outstanding: 0,
                latestDisbursed: loan.disbursed_date,
                status: "Active",
              };
            }

            const custRec = customerSummary[custId];
            custRec.totalLoanApplied += loan.scored_amount || 0;
            custRec.loanAmount += loan.scored_amount || 0;
            custRec.interest += loan.total_interest || 0;
            custRec.totalPayable += loan.total_payable || 0;
            custRec.totalPaid += totalPaid;
            custRec.outstanding += outstanding;
          });

          const formatted = Object.values(customerSummary).map((c) => ({
            ...c,
            status: c.outstanding === 0 ? "Closed" : "Active",
          }));

          setCustomerAccountData(formatted);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error("Error fetching customer accounts:", err.message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCustomerAccounts();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - runs only once

  // Use useMemo for filtered data to prevent unnecessary re-renders
  const filteredData = useMemo(() => {
    let result = [...customerAccountData];

    if (filters.customerQuery) {
      const q = filters.customerQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.customerName.toLowerCase().includes(q) ||
          item.phone.includes(q)
      );
    }

    if (filters.branch)
      result = result.filter((item) => item.branch === filters.branch);

    if (filters.status)
      result = result.filter((item) => item.status === filters.status);

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      result = result.filter((item) => {
        if (!item.latestDisbursed) return false;
        const d = new Date(item.latestDisbursed);
        return d >= start && d <= end;
      });
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

    return result;
  }, [customerAccountData, filters, sortConfig]);

  // Memoize the sort handler
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

const handleViewStatement = useCallback((customer) => {
  console.log("log full customer object",customer); 
  navigate(`/reports/customer-statement/${customer.customerId}`);
}, [navigate]);



  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  const SortableHeader = ({ label, sortKey }) => (
    <th 
      onClick={() => handleSort(sortKey)}
      className="px-6 py-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors whitespace-nowrap"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortConfig.key === sortKey && (
          sortConfig.direction === "asc" ? 
            <ChevronUp className="w-4 h-4" /> : 
            <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentData = filteredData.slice(startIdx, endIdx);

  return (
    <>
      <div className="space-y-6">
     
      {/* Header Section */}
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
        Customer Account Statements 
      </h1>
      <p className="text-sm text-gray-600 mt-1">
        Viewing statement summary for{" "}
        <span className="font-semibold text-blue-600">
          all customers
        </span>
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

    </div>
  </div>
</div>


        {/* Filter Panel */}
        {showFilters && (
          <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">Filter Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Search customer or phone..."
                value={filters.customerQuery}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    customerQuery: e.target.value,
                  }))
                }
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={filters.branch}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, branch: e.target.value }))
                }
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
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
              </select>

              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
{/* Data Summary */}
{/* <div className="flex justify-between items-stretch gap-2 w-full">
  <div className="bg-white p-3 rounded-lg border border-gray-200 flex-1 text-center">
    <p className="text-gray-600 text-sm font-medium">Total Records</p>
    <p className="text-2xl font-bold text-gray-900">
      {filteredData.length}
    </p>
  </div>

  <div className="bg-white p-3 rounded-lg border border-gray-200 flex-1 text-center">
    <p className="text-gray-600 text-sm font-medium">Total Payable</p>
    <p className="text-2xl font-bold text-blue-600">
      {formatCurrency(
        filteredData.reduce((sum, c) => sum + c.totalPayable, 0)
      )}
    </p>
  </div>

  <div className="bg-white p-3 rounded-lg border border-gray-200 flex-1 text-center">
    <p className="text-gray-600 text-sm font-medium">Total Principal</p>
    <p className="text-2xl font-bold text-blue-600">
      {formatCurrency(
        filteredData.reduce((sum, c) => sum + c.loanAmount, 0)
      )}
    </p>
  </div>

  <div className="bg-white p-3 rounded-lg border border-gray-200 flex-1 text-center">
    <p className="text-gray-600 text-sm font-medium">Total Paid</p>
    <p className="text-2xl font-bold text-green-600">
      {formatCurrency(
        filteredData.reduce((sum, c) => sum + c.totalPaid, 0)
      )}
    </p>
  </div>

  <div className="bg-white p-3 rounded-lg border border-gray-200 flex-1 text-center">
    <p className="text-gray-600 text-sm font-medium">Total Outstanding</p>
    <p className="text-2xl font-bold text-red-600">
      {formatCurrency(
        filteredData.reduce((sum, c) => sum + c.outstanding, 0)
      )}
    </p>
  </div>
</div> */}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Loading data...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No records found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 text-sm">
                    <tr>
                      <th className="px-6 py-4  text-slate-600 text-left whitespace-nowrap">#</th>
                      <SortableHeader label="Customer Details" sortKey="customerName" />
                      <SortableHeader label="Phone" sortKey="phone" />
                      <SortableHeader label="Branch" sortKey="branch" />
                      <SortableHeader label="Principal Amount" sortKey="loanAmount" />
                      <SortableHeader label="Interest" sortKey="interest" />
                      <SortableHeader label="Total Payable" sortKey="totalPayable" />
                      <SortableHeader label="Paid" sortKey="totalPaid" />
                      <SortableHeader label="Outstanding" sortKey="outstanding" />
                      <SortableHeader label="Status" sortKey="status" />
                      <th className="px-6 py-4 font-semibold text-gray-700 text-left whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentData.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors text-sm">
                        <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">{startIdx + i + 1}</td>
                        <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">{c.customerName}</td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{c.phone}</td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{c.branch}</td>
                      
                        <td className="px-6 py-4 text-right text-gray-900 font-medium whitespace-nowrap">
                          {formatCurrency(c.loanAmount)}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900 font-medium whitespace-nowrap">
                          {formatCurrency(c.interest)}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-900 font-medium whitespace-nowrap">
                          {formatCurrency(c.totalPayable)}
                        </td>
                        <td className="px-6 py-4 text-right text-green-700 font-semibold whitespace-nowrap">
                          {formatCurrency(c.totalPaid)}
                        </td>
                        <td className="px-6 py-4 text-right text-red-700 font-semibold whitespace-nowrap">
                          {formatCurrency(c.outstanding)}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            c.status === "Active" 
                              ? "bg-green-100 text-green-700" 
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleViewStatement(c)}
   className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                style={{ backgroundColor: "#586ab1" }}
                          >
                            <Eye className="w-4 h-4" />
                            Statement
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-semibold">{startIdx + 1}</span> to{' '}
                  <span className="font-semibold">{Math.min(endIdx, filteredData.length)}</span> of{' '}
                  <span className="font-semibold">{filteredData.length}</span> records
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${
                      currentPage === 1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
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
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${
                      currentPage === totalPages
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
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

    
    </>
  );
};

export default CustomerAccountModal;