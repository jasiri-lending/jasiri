import { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  EyeIcon,
  CheckIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner";

const ApprovalPending = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // Data for filters
  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Get user profile from auth hook
  const { profile } = useAuth();
  const userRole = profile?.role;
  const userBranchId = profile?.branch_id;

  const navigate = useNavigate(); 

  // Check if user can approve based on role
  const canApprove = userRole === 'branch_manager' || userRole === 'credit_analyst_officer';

  // Fetch regions and branches for filters
  const fetchFilterData = async () => {
    try {
      if (profile?.tenant_id) {
        const [regionsResult, branchesResult] = await Promise.all([
          supabase.from("regions").select("id, name").eq("tenant_id", profile.tenant_id).order("name"),
          supabase.from("branches").select("id, name, region_id").eq("tenant_id", profile.tenant_id).order("name")
        ]);
        
        setRegions(regionsResult.data || []);
        setBranches(branchesResult.data || []);
        setAllBranches(branchesResult.data || []);
      }
    } catch (error) {
      console.error("Error fetching filter data:", error);
    }
  };

  // Fetch pending customers with related data
  const fetchPendingCustomers = async () => {
    setLoading(true);
    try {
      if (!userRole) return;

      let query = supabase
        .from("customers")
        .select(`
          *,
          branch:branches!customers_branch_id_fkey(
            id,
            name,
            region:regions!branches_region_id_fkey(
              id,
              name
            )
          ),
          created_by_user:users!customers_created_by_fkey(
            id,
            full_name
          )
        `)
        .neq("form_status", "draft")
        .order("created_at", { ascending: false });

      // Set status filter based on role
      if (userRole === 'branch_manager') {
        query = query.eq("status", "bm_review");
        // BM can only see customers from their branch
        if (userBranchId) {
          query = query.eq("branch_id", userBranchId);
        }
      } else if (userRole === 'credit_analyst_officer') {
        query = query.eq("status", "ca_review");
        // CA can see all customers with ca_review status (no branch restriction)
      } else {
        // For other roles, show all customers awaiting any approval
        query = query.in("status", ["bm_review", "ca_review"]);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching pending customers:", error.message);
      } else {
        const customersData = data || [];
        setCustomers(customersData);
        setFilteredCustomers(customersData);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    if (profile) {
      fetchPendingCustomers();
      fetchFilterData();
    }
  }, [profile?.id]);

  // Apply filters
  useEffect(() => {
    if (!customers || customers.length === 0) {
      setFilteredCustomers([]);
      return;
    }
    
    let filtered = customers;
    
    // Apply search term filter
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        (customer.Firstname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (customer.Surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (customer.id_number?.toString() || '').includes(searchTerm) ||
        (customer.mobile || '').includes(searchTerm) ||
        (customer.branch?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (customer.branch?.region?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (customer.created_by_user?.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply region filter
    if (selectedRegion) {
      filtered = filtered.filter(customer => 
        customer.branch?.region?.id === selectedRegion
      );
    }
    
    // Apply branch filter
    if (selectedBranch) {
      filtered = filtered.filter(customer => 
        customer.branch_id === selectedBranch
      );
    }
    
    // Apply status filter
    if (selectedStatus) {
      filtered = filtered.filter(customer => 
        customer.status === selectedStatus
      );
    }
    
    setFilteredCustomers(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, selectedRegion, selectedBranch, selectedStatus, customers]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRegion('');
    setSelectedBranch('');
    setSelectedStatus('');
  };

  // Handle region change - filter branches
  const handleRegionChange = (regionId) => {
    setSelectedRegion(regionId);
    setSelectedBranch(''); // Clear branch selection
    
    if (regionId) {
      // Filter branches by selected region
      const filteredBranches = allBranches.filter(
        (branch) => branch.region_id?.toString() === regionId
      );
      setBranches(filteredBranches);
    } else {
      // Reset to all branches
      setBranches(allBranches);
    }
  };

  // Updated handlers to use navigation
  const handleApprove = (customerId) => {
    navigate(`/customer/${customerId}/verify`);
  };

  const handleView = (customer) => {
    navigate(`/customer/${customer.id}/details`);
  };

  // Helper function to get full name
  const getFullName = (customer) => {
    const firstName = customer.Firstname || '';
    const lastName = customer.Surname || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  };

  // Helper function to get RO name
  const getROName = (customer) => {
    return customer.created_by_user?.full_name || 'N/A';
  };

  // Helper function to get Region name
  const getRegionName = (customer) => {
    return customer.branch?.region?.name || 'N/A';
  };

  // Helper function to get Branch name
  const getBranchName = (customer) => {
    return customer.branch?.name || 'N/A';
  };

  // Helper function to get status display value
  const getStatusDisplay = (customer) => {
    if (!customer.status) return 'N/A';
    
    const statusMap = {
      'bm_review': 'BM Review',
      'ca_review': 'CA Review',
      'sent_back_by_bm': 'Sent Back by BM',
      'sent_back_by_ca': 'Sent Back by CA'
    };
    
    return statusMap[customer.status] || customer.status;
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    const statusValue = typeof status === 'string' ? status.toLowerCase() : '';
    
    if (statusValue.includes('review')) return '#f59e0b'; // amber
    if (statusValue.includes('sent back')) return '#8b5cf6'; // purple
    
    return '#586ab1'; // default blue
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

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

  // Show loading if profile is not yet loaded
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#d9e2e8' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Spinner text="Loading ..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Approval Pending
      </h1>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID, branch, region..."
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
              {(selectedBranch || selectedRegion || selectedStatus) && (
                <span className="ml-1 px-1.5 py-0.5 bg-white text-gray-700 rounded-full text-xs font-medium">
                  {[selectedBranch, selectedRegion, selectedStatus].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Region Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Filter by Region
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Regions</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Branch Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Filter by Branch
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    disabled={!selectedRegion && branches.length > 0}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

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
                    <option value="bm_review">BM Review</option>
                    <option value="ca_review">CA Review</option>
                    <option value="sent_back_by_bm">Sent Back by BM</option>
                    <option value="sent_back_by_ca">Sent Back by CA</option>
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
              {(selectedBranch || selectedRegion || selectedStatus) && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  <span className="text-xs text-gray-600">Active filters:</span>
                  {selectedRegion && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#586ab1" }}>
                      Region: {regions.find((r) => r.id === selectedRegion)?.name}
                      <button
                        onClick={() => handleRegionChange("")}
                        className="ml-1"
                        style={{ color: "#586ab1" }}
                      >
                        <XMarkIcon size={12} />
                      </button>
                    </span>
                  )}
                  {selectedBranch && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#586ab1" }}>
                      Branch: {branches.find((b) => b.id === selectedBranch)?.name}
                      <button
                        onClick={() => setSelectedBranch("")}
                        className="ml-1"
                        style={{ color: "#586ab1" }}
                      >
                        <XMarkIcon size={12} />
                      </button>
                    </span>
                  )}
                  {selectedStatus && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#586ab1" }}>
                      Status: {getStatusDisplay({ status: selectedStatus })}
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

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">ID Number</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Region</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Branch</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">RO</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Prequalified Amount</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Mobile</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-16">
                    <div className="text-center">
                      <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">No pending approvals</h3>
                      <p className="text-gray-500 text-xs">
                        {searchTerm || selectedBranch || selectedRegion || selectedStatus
                          ? "No customers match your search criteria."
                          : "All customers have been processed."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentCustomers.map((customer) => {
                  const statusColor = getStatusColor(customer.status);
                  const displayStatus = getStatusDisplay(customer);
                  
                  return (
                    <tr 
                      key={customer.id} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 mr-2">
                            <UserIcon className="w-4 h-4 text-blue-600" />
                          </div>
                          <span>{customer.id_number || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {getFullName(customer)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPinIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                          <span>{getRegionName(customer)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        <div className="flex items-center">
                          <BuildingOfficeIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                          <span>{getBranchName(customer)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {getROName(customer)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 text-right font-medium whitespace-nowrap">
                        {customer.prequalifiedAmount ? 
                          `Ksh ${Number(customer.prequalifiedAmount).toLocaleString()}` : 
                          "N/A"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        <div className="flex items-center">
                          <PhoneIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                          <span>{customer.mobile || "N/A"}</span>
                        </div>
                      </td>
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
                          {/* View Customer */}
                          <button
                            onClick={() => handleView(customer)}
                            className="p-1.5 rounded-md bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700 transition whitespace-nowrap"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>

                          {/* Approve Button (only for authorized users) */}
                          {canApprove && (
                            <button
                              onClick={() => handleApprove(customer.id)}
                              className="p-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition whitespace-nowrap"
                              title="Approve Customer"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                          )}
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
        {filteredCustomers.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-600 whitespace-nowrap">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredCustomers.length)}</span> of <span className="font-medium">{filteredCustomers.length}</span> pending approvals
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
      {filteredCustomers.length > 0 && (
        <div className="mt-3 flex justify-end items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 whitespace-nowrap">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                // Note: itemsPerPage is currently not stateful, you might want to make it stateful
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
};

export default ApprovalPending;