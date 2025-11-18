import React, { useState, useEffect } from "react";
import { Download, Filter, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search } from "lucide-react";
import { supabase } from "../../supabaseClient";

const CustomerListing = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    status: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (!error) setBranches(data);
    };
    fetchBranches();
  }, []);

  // Fetch all customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("customers")
          .select(`
            id,
            "Firstname",
            "Middlename",
            "Surname",
            gender,
            date_of_birth,
            mobile,
            id_number,
            residence_status,
            business_name,
            business_type,
            status,
            created_at,
            branch:branch_id(name),
            ro:created_by(full_name)
          `)
           .eq("form_status", "submitted")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formatted = data.map((c) => {
          const fullName = [c.Firstname, c.Middlename, c.Surname]
            .filter(Boolean)
            .join(" ");
          const age = c.date_of_birth
            ? new Date().getFullYear() - new Date(c.date_of_birth).getFullYear()
            : "N/A";

          return {
            id: c.id,
            branch: c.branch?.name || "N/A",
            relationshipOfficer: c.ro?.full_name || "N/A",
            customerName: fullName || "N/A",
            mobile: c.mobile || "N/A",
            idNumber: c.id_number || "N/A",
            gender: c.gender || "N/A",
            dateOfBirth: c.date_of_birth || "N/A",
            age,
            approvalStatus: c.status || "N/A",
            residenceType: c.residence_status || "N/A",
            businessName: c.business_name || "N/A",
            businessDescription: c.business_type || "N/A",
            createdAt: c.created_at
              ? new Date(c.created_at).toLocaleDateString()
              : "N/A",
          };
        });

        setCustomers(formatted);
        setFilteredCustomers(formatted);
      } catch (err) {
        console.error("Error fetching customers:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...customers];
    
    
// Search filter
if (filters.search) {
  const q = filters.search.toLowerCase();
  result = result.filter((item) => {
    const name = item.customerName?.toLowerCase() || "";
    const mobile = item.mobile ? String(item.mobile) : "";
    const idNumber = item.idNumber ? String(item.idNumber) : "";

    return (
      name.includes(q) ||
      mobile.includes(q) ||
      idNumber.includes(q)
    );
  });
}


    // Branch filter
    if (filters.branch)
      result = result.filter((item) => item.branch === filters.branch);

    // Status filter
    if (filters.status)
      result = result.filter(
        (item) =>
          item.approvalStatus.toLowerCase() === filters.status.toLowerCase()
      );

    // Date range filter
    if (filters.startDate)
      result = result.filter(
        (item) => new Date(item.createdAt) >= new Date(filters.startDate)
      );
    if (filters.endDate)
      result = result.filter(
        (item) => new Date(item.createdAt) <= new Date(filters.endDate)
      );

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

    setFilteredCustomers(result);
    setCurrentPage(1);
  }, [filters, customers, sortConfig]);

  const handleSort = (key) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

  const SortableHeader = ({ label, sortKey }) => (
    <th
      onClick={() => handleSort(sortKey)}
      className="px-6 py-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors whitespace-nowrap text-left"
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

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ search: "", branch: "", status: "", startDate: "", endDate: "" });
  };

  // Export CSV
  const exportToCSV = () => {
    if (filteredCustomers.length === 0) {
      alert("No data to export");
      return;
    }

    const csvData = [
      [
        "No",
        "Branch",
        "RO",
        "Customer Name",
        "Mobile",
        "ID Number",
        "Gender",
        "Date of Birth",
        "Age",
        "Status",
        "Residence",
        "Business Name",
        "Business Description",
        "Created At",
      ],
      ...filteredCustomers.map((cust, i) => [
        i + 1,
        cust.branch,
        cust.relationshipOfficer,
        `"${cust.customerName}"`,
        cust.mobile,
        cust.idNumber,
        cust.gender,
        cust.dateOfBirth,
        cust.age,
        cust.approvalStatus,
        cust.residenceType,
        cust.businessName,
        cust.businessDescription,
        cust.createdAt,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer_listing_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentData = filteredCustomers.slice(startIdx, endIdx);

  return (
    <div className="space-y-6">
    
{/* HEADER */}
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Customer Listing </h1>
      <p className="text-sm text-gray-600 mt-1">
        Viewing all registered customers in the system 
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by name, ID, or mobile..."
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
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="bm_review">BM Review</option>
              <option value="ca_review">CA Review</option>
            </select>

            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(filters.search || filters.branch || filters.status || filters.startDate || filters.endDate) && (
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
      {/* <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Records</p>
          <p className=" font-bold text-gray-900">{filteredCustomers.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Approved</p>
          <p className=" font-bold text-green-600">
            {filteredCustomers.filter(c => c.approvalStatus.toLowerCase() === "approved").length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Pending</p>
          <p className=" font-bold text-yellow-600">
            {filteredCustomers.filter(c => c.approvalStatus.toLowerCase() === "pending").length}
          </p>
        </div>
      </div> */}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No records found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200  text-sm sticky top-0">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-left whitespace-nowrap">#</th>
                    <SortableHeader label="Branch" sortKey="branch" />
                    <SortableHeader label="RO" sortKey="relationshipOfficer" />
                    <SortableHeader label="Customer Name" sortKey="customerName" />
                    <SortableHeader label="Mobile" sortKey="mobile" />
                    <SortableHeader label="ID Number" sortKey="idNumber" />
                    <SortableHeader label="Gender" sortKey="gender" />
                    <SortableHeader label="DOB" sortKey="dateOfBirth" />
                    <SortableHeader label="Age" sortKey="age" />
                    <SortableHeader label="Status" sortKey="approvalStatus" />
                    <SortableHeader label="Residence" sortKey="residenceType" />
                    <SortableHeader label="Business Name" sortKey="businessName" />
                    <SortableHeader label="Business Type" sortKey="businessDescription" />
                    <SortableHeader label="Created At" sortKey="createdAt" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentData.map((cust, i) => (
                    <tr
                      key={cust.id}
                      className="hover:bg-gray-50 transition-colors text-sm"
                    >
                      <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">{startIdx + i + 1}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{cust.branch}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{cust.relationshipOfficer}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{cust.customerName}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{cust.mobile}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{cust.idNumber}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{cust.gender}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{cust.dateOfBirth}</td>
                      <td className="px-6 py-4 text-center text-slate-600 whitespace-nowrap">{cust.age}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          cust.approvalStatus.toLowerCase() === "approved"
                            ? "bg-green-100 text-green-700"
                            : cust.approvalStatus.toLowerCase() === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : cust.approvalStatus.toLowerCase() === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {cust.approvalStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{cust.residenceType}</td>
                      <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{cust.businessName}</td>
                      <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{cust.businessDescription}</td>
                      <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{cust.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIdx + 1}</span> to{' '}
                <span className="font-semibold">{Math.min(endIdx, filteredCustomers.length)}</span> of{' '}
                <span className="font-semibold">{filteredCustomers.length}</span> customers
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
  );
};

export default CustomerListing;