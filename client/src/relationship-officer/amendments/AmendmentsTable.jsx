import { useState, useEffect, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  PencilSquareIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';

function AmendmentsTable({ amendments: propAmendments, loading: propLoading, onEdit, onView }) {
  const [amendments, setAmendments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Handle incoming props
  useEffect(() => {
    if (propAmendments && propAmendments.length >= 0) {
      setAmendments(propAmendments);
    }
  }, [propAmendments]);

  // Handle loading state
  useEffect(() => {
    if (propLoading !== undefined) {
      setLoading(propLoading);
    } else {
      setLoading(false);
    }
  }, [propLoading]);

  // Helper function to get status display value
  const getStatusDisplay = (status) => {
    if (!status) return 'N/A';
    
    const statusMap = {
      'sent_back_by_bm': 'Sent Back by BM',
      'sent_back_by_ca': 'Sent Back by CA',
      'sent_back_by_cso': 'Sent Back by CSO',
      'bm_review_amend': 'BM Review (Amend)',
      'ca_review_amend': 'CA Review (Amend)',
      'cso_review_amend': 'CSO Review (Amend)',
      'bm_review': 'BM Review',
      'ca_review': 'CA Review',
      'cso_review': 'CSO Review',
      'pending': 'Pending',
      'approved': 'Approved',
      'rejected': 'Rejected'
    };
    
    return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    const statusValue = typeof status === 'string' ? status.toLowerCase() : '';
    
    if (statusValue.includes('approved')) return '#10b981'; // green
    if (statusValue.includes('rejected')) return '#ef4444'; // red
    if (statusValue.includes('review') || statusValue.includes('pending')) return '#f59e0b'; // amber
    if (statusValue.includes('sent back') || statusValue.includes('amend')) return '#8b5cf6'; // purple
    
    return '#586ab1'; // default blue
  };

  // Filter amendments based on search term and selected status
  const filteredAmendments = useMemo(() => {
    if (!amendments.length) return [];

    let filtered = [...amendments];

    // Apply search term filter
    if (searchTerm.trim()) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(amendment => {
        const customer = amendment.customers || {};
        return (
          (customer.Firstname?.toLowerCase() || '').includes(lowercasedSearch) ||
          (customer.Surname?.toLowerCase() || '').includes(lowercasedSearch) ||
          (customer.id_number?.toLowerCase() || '').includes(lowercasedSearch) ||
          (customer.mobile?.toLowerCase() || '').includes(lowercasedSearch) ||
          (customer.business_name?.toLowerCase() || '').includes(lowercasedSearch) ||
          getStatusDisplay(customer.status).toLowerCase().includes(lowercasedSearch)
        );
      });
    }

    // Apply status filter
    if (selectedStatus) {
      filtered = filtered.filter(amendment => {
        const customerStatus = amendment.customers?.status;
        return customerStatus === selectedStatus;
      });
    }

    return filtered;
  }, [amendments, searchTerm, selectedStatus]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
  };

  // Get unique statuses for filter dropdown
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set();
    amendments.forEach(amendment => {
      if (amendment.customers?.status) {
        statuses.add(amendment.customers.status);
      }
    });
    return Array.from(statuses).sort();
  }, [amendments]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAmendments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAmendments = filteredAmendments.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 2) {
        endPage = 4;
      }
      
      if (currentPage >= totalPages - 1) {
        startPage = totalPages - 3;
      }
      
      if (startPage > 2) {
        pageNumbers.push('...');
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-500 text-sm">Loading amendments...</span>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Amendments / Pending Amendments
      </h1>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center gap-4">
            <div className="text-sm font-medium text-gray-700">
              Total: {filteredAmendments.length} {filteredAmendments.length === 1 ? 'amendment' : 'amendments'}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative w-96">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, business, phone..."
                  className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors border"
                style={{ 
                  backgroundColor: showFilters ? "#586ab1" : "white",
                  color: showFilters ? "white" : "#586ab1",
                  borderColor: "#586ab1"
                }}
              >
                <FunnelIcon size={14} /> Filters
                {(selectedStatus) && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white text-gray-700 rounded-full text-xs font-medium">
                    {[selectedStatus].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Filter by Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    {uniqueStatuses.map((status) => (
                      <option key={status} value={status}>
                        {getStatusDisplay(status)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters Button */}
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1"
                  >
                    <XMarkIcon size={12} />
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* Active Filters Display */}
              {selectedStatus && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  <span className="text-xs text-gray-600">Active filters:</span>
                  {selectedStatus && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#586ab1" }}>
                      Status: {getStatusDisplay(selectedStatus)}
                      <button
                        onClick={() => setSelectedStatus("")}
                        className="ml-1"
                        style={{ color: "#586ab1" }}
                      >
                        <XMarkIcon size={12} />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Amendments Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Phone</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Business Name</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentAmendments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16">
                    <div className="text-center">
                      <div className="text-gray-300 mx-auto mb-4">
                        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">No amendments found</h3>
                      <p className="text-gray-500 text-xs">
                        {searchTerm || selectedStatus
                          ? "No amendments match your search criteria."
                          : "No pending amendments available."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentAmendments.map((amendment) => {
                  const customer = amendment.customers || {};
                  const statusColor = getStatusColor(customer.status);
                  const displayStatus = getStatusDisplay(customer.status);
                  
                  return (
                    <tr 
                      key={amendment.id || amendment.customer_id} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {customer.Firstname || ''} {customer.Surname || ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{customer.id_number || "N/A"}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{customer.mobile || "N/A"}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{customer.business_name || "N/A"}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
                          style={{ backgroundColor: statusColor }}
                        >
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onView(amendment)}
                            className="p-1.5 rounded-md bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700 transition whitespace-nowrap"
                            title="View Amendment"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onEdit(amendment)}
                            className="p-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition whitespace-nowrap"
                            title="Edit Amendment"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls with Total Count */}
        {currentAmendments.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-600 whitespace-nowrap">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredAmendments.length)}</span> of <span className="font-medium">{filteredAmendments.length}</span> amendments
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* First Page */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  title="First Page"
                >
                  <ChevronDoubleLeftIcon size={16} className="text-gray-600" />
                </button>
                
                {/* Previous Page */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  title="Previous Page"
                >
                  <ChevronLeftIcon size={16} className="text-gray-600" />
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1 mx-1">
                  {getPageNumbers().map((pageNum, index) => (
                    pageNum === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-xs text-gray-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                          currentPage === pageNum
                            ? "bg-blue-500 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  ))}
                </div>
                
                {/* Next Page */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  title="Next Page"
                >
                  <ChevronRightIcon size={16} className="text-gray-600" />
                </button>
                
                {/* Last Page */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  title="Last Page"
                >
                  <ChevronDoubleRightIcon size={16} className="text-gray-600" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items Per Page Selector */}
      {currentAmendments.length > 0 && (
        <div className="mt-3 flex justify-end items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 whitespace-nowrap">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                // Note: itemsPerPage is currently not stateful
                console.log("Items per page changed to:", e.target.value);
              }}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default AmendmentsTable;