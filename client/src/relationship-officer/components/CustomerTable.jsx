import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MagnifyingGlassIcon,
  EyeIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";


function CustomersTable({ customers, loading}) {
  const [searchTerm, setSearchTerm] = useState("");

  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
   const navigate = useNavigate();

  //  Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 10;

  const handleView = (customer) => {
  navigate(`/officer/${customer.id}/details`);
};


    const handleAddCustomer = () => {
    navigate('/officer/customers/add');
  };



  const getSortedCustomers = (customersList) => {
    if (!sortConfig.key) return customersList;
    return [...customersList].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("");
  };

  const filteredCustomers =
    customers?.filter((c) => {
      const matchesSearch =
        c.Firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.mobile?.toString().includes(searchTerm) ||
        c.id_number?.toString().includes(searchTerm) ||
        c.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.town?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = !selectedStatus || c.status === selectedStatus;

      return matchesSearch && matchesStatus;
    }) || [];

  const sortedCustomers = getSortedCustomers(filteredCustomers);

  //  Pagination calculations
  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = sortedCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const totalPages = Math.ceil(sortedCustomers.length / customersPerPage);

  const uniqueStatuses = [...new Set(customers?.map((c) => c.status).filter(Boolean) || [])];

  if (loading)
    return (
      <div className="p-4">
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customers...</p>
        </div>
      </div>
    );

  return (
    <div className="p-2">
      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow mb-3 mt-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Customers
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name, mobile, ID, business, or location..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-indigo-500 focus:border-indigo-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-end space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center px-4 py-2 border rounded-md transition-colors ${
                  showFilters
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FunnelIcon className="h-5 w-5 mr-2" />
                Filters
                {selectedStatus && (
                  <span className="ml-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                    1
                  </span>
                )}
              </button>
              {/* <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Export
              </button> */}
              <button
                 onClick={handleAddCustomer}
                className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                style={{ backgroundColor: "#586ab1" }}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Customer
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="border-t pt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Statuses</option>
                    {uniqueStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prefix</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Surname</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Number</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentCustomers.length > 0 ? (
                currentCustomers.map((customer, i) => (
                  <tr key={customer.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 text-sm text-gray-900">{customer.prefix || "Mr./Ms."}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{customer.Firstname || "N/A"}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{customer.Surname || "N/A"}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{customer.mobile || "N/A"}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{customer.id_number || "N/A"}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{customer.business_name || "N/A"}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{customer.town || "N/A"}</td>
                    <td className="px-3 py-2 text-sm">
                      <button
                        onClick={() => handleView(customer)}
 className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                style={{ backgroundColor: "#586ab1" }}                      >
                        <EyeIcon className="h-3 w-3 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-6 text-gray-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/*  Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex items-center space-x-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 border rounded-md text-sm ${
                  currentPage === i + 1
                    ? "bg-indigo-600 text-white"
                    : "bg-white hover:bg-gray-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}

export default CustomersTable;
