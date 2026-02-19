import { useState, useEffect, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner.jsx";

const HQPending = () => {
  const [customers, setCustomers] = useState([]);
  const { profile } = useAuth();
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [relationshipOfficers, setRelationshipOfficers] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [allRelationshipOfficers, setAllRelationshipOfficers] = useState([]);

  // Filter states
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedRO, setSelectedRO] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const navigate = useNavigate();

  // Use ref to track if data has been fetched
  const hasFetchedData = useRef(false);

  // Fetch branches and regions data
  const fetchBranchesAndRegions = async () => {
    try {
      // Determine which regions to fetch based on role
      let regionsQuery = supabase
        .from('regions')
        .select('id, name, tenant_id')
        .eq('tenant_id', profile.tenant_id);

      // For regional_manager, only fetch their region
      if (profile?.role === 'regional_manager' && profile.region_id) {
        regionsQuery = regionsQuery.eq('id', profile.region_id);
      }

      // Determine which branches to fetch based on role
      let branchesQuery = supabase
        .from('branches')
        .select('id, name, region_id, tenant_id')
        .eq('tenant_id', profile.tenant_id);

      // For regional_manager, only fetch branches in their region
      if (profile?.role === 'regional_manager' && profile.region_id) {
        branchesQuery = branchesQuery.eq('region_id', profile.region_id);
      }

      // For branch_manager, only fetch their branch
      if (profile?.role === 'branch_manager' && profile.branch_id) {
        branchesQuery = branchesQuery.eq('id', profile.branch_id);
      }

      const [branchesResponse, regionsResponse, roResponse] = await Promise.all([
        branchesQuery.order('name'),
        regionsQuery.order('name'),
        supabase
          .from('users')
          .select('id, full_name, tenant_id, role, branch_id, region_id')
          .eq('role', 'relationship_officer')
          .eq('tenant_id', profile.tenant_id)
          .order('full_name')
      ]);

      if (branchesResponse.data) {
        setBranches(branchesResponse.data);
        setAllBranches(branchesResponse.data);
      }

      if (regionsResponse.data) {
        setRegions(regionsResponse.data);
      }

      if (roResponse.data) {
        // Filter ROs based on role restrictions
        let filteredROs = roResponse.data;

        if (profile?.role === 'regional_manager' && profile.region_id) {
          filteredROs = filteredROs.filter(ro =>
            ro.region_id === profile.region_id
          );
        }

        if (profile?.role === 'branch_manager' && profile.branch_id) {
          filteredROs = filteredROs.filter(ro =>
            ro.branch_id === profile.branch_id
          );
        }

        setRelationshipOfficers(filteredROs);
        setAllRelationshipOfficers(filteredROs);
      }
    } catch (error) {
      console.error("Error fetching branches and regions:", error);
    }
  };

  const fetchPendingCustomers = async () => {
    setLoading(true);
    try {
      // Build the query with joins
      let query = supabase
        .from("customers")
        .select(`
          *,
          branches (
            id,
            name
          ),
          regions (
            id,
            name
          ),
          users:created_by (
            id,
            full_name,
            tenant_id
          )
        `)
        .eq("tenant_id", profile?.tenant_id)
        .eq("status", "ca_review")
        .eq("form_status", "submitted")
        .order("created_at", { ascending: false });

      // Apply role-based filtering for initial fetch
      if (profile?.role === 'regional_manager' && profile.region_id) {
        query = query.eq("region_id", profile.region_id);
      } else if (profile?.role === 'branch_manager' && profile.branch_id) {
        query = query.eq("branch_id", profile.branch_id);
      } else if (profile?.role === 'relationship_officer') {
        query = query.eq("created_by", profile.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching pending customers:", error.message);
      } else {
        setCustomers(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch - only runs once when profile is available
  useEffect(() => {
    if (profile && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchBranchesAndRegions();
      fetchPendingCustomers();
    }
  }, [profile]);

  // Handle region change - filter branches and ROs
  const handleRegionChange = (regionId) => {
    setSelectedRegion(regionId);
    setSelectedBranch(""); // Clear branch selection
    setSelectedRO(""); // Clear RO selection

    if (regionId) {
      // Filter branches by selected region
      const filteredBranches = allBranches.filter(
        (branch) => branch.region_id?.toString() === regionId
      );
      setBranches(filteredBranches);

      // Filter ROs by selected region
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.region_id?.toString() === regionId
      );
      setRelationshipOfficers(filteredROs);
    } else {
      // Reset to all branches and ROs (within role restrictions)
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  // Handle branch change - filter ROs
  const handleBranchChange = (branchId) => {
    setSelectedBranch(branchId);
    setSelectedRO(""); // Clear RO selection

    if (branchId) {
      // Filter ROs by selected branch
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.branch_id?.toString() === branchId
      );
      setRelationshipOfficers(filteredROs);
    } else if (selectedRegion) {
      // If no branch but region is selected, show ROs for that region
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.region_id?.toString() === selectedRegion
      );
      setRelationshipOfficers(filteredROs);
    } else {
      // Reset to all ROs (within role restrictions)
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedBranch("");
    setSelectedRegion("");
    setSelectedRO("");
    setCurrentPage(1);

    // Reset cascading filters
    setBranches(allBranches);
    setRelationshipOfficers(allRelationshipOfficers);
  };

  // Apply filters
  useEffect(() => {
    if (!customers || customers.length === 0) {
      setFilteredCustomers([]);
      return;
    }

    const filtered = customers.filter(customer => {
      const fullName = `${customer.Firstname || ''} ${customer.Surname || ''}`.toLowerCase();
      const matchesSearch =
        fullName.includes(searchTerm.toLowerCase()) ||
        (customer.id_number?.toString() || '').includes(searchTerm) ||
        (customer.mobile || '').includes(searchTerm);

      const matchesBranch =
        !selectedBranch ||
        customer.branch_id?.toString() === selectedBranch ||
        customer.branches?.id?.toString() === selectedBranch;

      const matchesRegion =
        !selectedRegion ||
        customer.region_id?.toString() === selectedRegion;

      const matchesRO =
        !selectedRO ||
        customer.created_by?.toString() === selectedRO;

      return matchesSearch && matchesBranch && matchesRegion && matchesRO;
    });

    setFilteredCustomers(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, selectedBranch, selectedRegion, selectedRO, customers]);

  const handleVerify = (customerId) => {
    navigate(`/customer/${customerId}/verify`);
  };

  const handleView = (customer) => {
    navigate(`/customer/${customer.id}/details`);
  };

  const handleRefresh = () => {
    fetchPendingCustomers();
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
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);

      // Calculate start and end of visible pages
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if we're near the beginning
      if (currentPage <= 2) {
        endPage = 4;
      }

      // Adjust if we're near the end
      if (currentPage >= totalPages - 1) {
        startPage = totalPages - 3;
      }

      // Add ellipsis if needed
      if (startPage > 2) {
        pageNumbers.push('...');
      }

      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      // Add ellipsis if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }

      // Always show last page
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  // Determine if region filter should be shown
  const shouldShowRegionFilter = () => {
    return (
      profile?.role === 'credit_analyst_officer' ||
      profile?.role === 'regional_manager'
    );
  };

  // Determine if branch filter should be shown
  const shouldShowBranchFilter = () => {
    return (
      profile?.role === 'credit_analyst_officer' ||
      profile?.role === 'regional_manager' ||
      profile?.role === 'branch_manager'
    );
  };

  // Determine if RO filter should be shown
  const shouldShowROFilter = () => {
    return (
      profile?.role === 'credit_analyst_officer' ||
      profile?.role === 'regional_manager' ||
      profile?.role === 'branch_manager'
    );
  };

  // For regional_manager, set their region as selected by default
  useEffect(() => {
    if (profile?.role === 'regional_manager' && profile.region_id) {
      setSelectedRegion(profile.region_id.toString());
      // Also filter branches for their region
      const filteredBranches = allBranches.filter(
        (branch) => branch.region_id?.toString() === profile.region_id.toString()
      );
      setBranches(filteredBranches);
    }
  }, [profile, allBranches]);

  // For branch_manager, set their branch as selected by default
  useEffect(() => {
    if (profile?.role === 'branch_manager' && profile.branch_id) {
      setSelectedBranch(profile.branch_id.toString());
    }
  }, [profile]);

  // Helper function to get status color
  const getStatusColor = (status) => {
    const statusValue = typeof status === 'string' ? status.toLowerCase() : '';

    if (statusValue.includes('approved')) return '#10b981'; // green
    if (statusValue.includes('rejected')) return '#ef4444'; // red
    if (statusValue.includes('review') || statusValue.includes('pending')) return '#f59e0b'; // amber
    if (statusValue.includes('sent back') || statusValue.includes('amend')) return '#8b5cf6'; // purple

    return '#586ab1'; // default blue
  };

  // Check if user has permission to view this page
  const hasPermission = () => {
    if (!profile) return false;

    const allowedRoles = [
      'credit_analyst_officer',
      'regional_manager',
      'branch_manager',
      'relationship_officer'
    ];

    return allowedRoles.includes(profile.role);
  };

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center">
        <Spinner text="Loading pending HQ reviews..." />
      </div>
    );
  }

  // Check permission to view the page
  if (!hasPermission()) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen font-sans">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-red-100 to-red-200 flex items-center justify-center">
            <XMarkIcon className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Access Denied</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            You don't have permission to view HQ pending reviews. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1  tracking-wide">
            Registry / Pending HQ Review
          </h1>
        </div>
        <div className="text-xs text-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: "#586ab1" }}>
          <span className="font-medium text-white">{customers.length}</span> pending reviews
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Search and Filters Header */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search and Filter Container - Now on same side */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, mobile, or ID number..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Filter Button and Clear Filters */}
              <div className="flex items-center gap-2">
                {(selectedBranch || selectedRegion || selectedRO) && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1.5 border border-gray-300"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-all duration-200 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:text-gray-900"
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Filters
                  {(selectedBranch || selectedRegion || selectedRO) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-gray-700 text-white rounded-full text-xs">
                      {[selectedBranch, selectedRegion, selectedRO].filter(Boolean).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleRefresh}
                  className="px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-all duration-200 border whitespace-nowrap"
                  style={{
                    backgroundColor: "#586ab1",
                    color: "white",
                    borderColor: "#586ab1"
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#4a5a9d"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#586ab1"}
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Region Filter - Show for credit_analyst_officer and regional_manager */}
                {shouldShowRegionFilter() && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Region
                    </label>
                    <div className="relative">
                      <select
                        value={selectedRegion}
                        onChange={(e) => handleRegionChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                        disabled={profile?.role === 'regional_manager' && profile.region_id}
                      >
                        <option value="" className="text-gray-400">
                          {profile?.role === 'regional_manager' && profile.region_id
                            ? regions.find(r => r.id.toString() === selectedRegion)?.name || "Loading..."
                            : "All Regions"}
                        </option>
                        {(profile?.role !== 'regional_manager' || !profile.region_id) &&
                          regions.map((region) => (
                            <option key={region.id} value={region.id.toString()}>
                              {region.name}
                            </option>
                          ))
                        }
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDownIcon className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Branch Filter */}
                {shouldShowBranchFilter() && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Branch
                    </label>
                    <div className="relative">
                      <select
                        value={selectedBranch}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                        disabled={profile?.role === 'branch_manager' && profile.branch_id}
                      >
                        <option value="" className="text-gray-400">
                          {profile?.role === 'branch_manager' && profile.branch_id
                            ? branches.find(b => b.id.toString() === selectedBranch)?.name || "Loading..."
                            : "All Branches"}
                        </option>
                        {(profile?.role !== 'branch_manager' || !profile.branch_id) &&
                          branches.map((branch) => (
                            <option key={branch.id} value={branch.id.toString()}>
                              {branch.name}
                            </option>
                          ))
                        }
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDownIcon className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Relationship Officer Filter */}
                {shouldShowROFilter() && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Relationship Officer
                    </label>
                    <div className="relative">
                      <select
                        value={selectedRO}
                        onChange={(e) => setSelectedRO(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="" className="text-gray-400">All ROs</option>
                        {relationshipOfficers.map((ro) => (
                          <option key={ro.id} value={ro.id.toString()}>
                            {ro.full_name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDownIcon className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Filters Display */}
              {(selectedBranch || selectedRegion || selectedRO) && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs text-gray-500 mr-2">Active filters:</span>
                    {selectedRegion && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        Region: {regions.find((r) => r.id.toString() === selectedRegion)?.name}
                        <button
                          onClick={() => handleRegionChange("")}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                          disabled={profile?.role === 'regional_manager' && profile.region_id}
                        >
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {selectedBranch && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        Branch: {branches.find((b) => b.id.toString() === selectedBranch)?.name}
                        <button
                          onClick={() => handleBranchChange("")}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                          disabled={profile?.role === 'branch_manager' && profile.branch_id}
                        >
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {selectedRO && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        RO: {relationshipOfficers.find((ro) => ro.id.toString() === selectedRO)?.full_name}
                        <button
                          onClick={() => setSelectedRO("")}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto font-sans">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ backgroundColor: '#E7F0FA' }}>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Mobile
                </th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  ID Number
                </th>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Prequalified Amount
                </th>
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                  <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    RO
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Branch
                </th>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Region
                </th>
                <th className="px-4 py-3 text-center text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {currentCustomers.map((customer, index) => {
                const fullName = `${customer.Firstname || ""} ${customer.Surname || ""}`.trim();
                const statusColor = getStatusColor("ca_review"); // All are CA Review status

                return (
                  <tr
                    key={customer.id}
                    className={`border-b transition-colors hover:bg-gray-50 ${index % 2 === 0 ? '' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {fullName || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {customer.mobile || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {customer.id_number || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-right" style={{ color: '#0D2440' }}>
                      {customer.prequalifiedAmount ?
                        `Ksh ${Number(customer.prequalifiedAmount).toLocaleString()}` :
                        "N/A"}
                    </td>
                    {(profile?.role === 'credit_analyst_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {customer.users?.full_name || "N/A"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {customer.branches?.name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {customer.regions?.name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span
                        className="inline-block px-3 py-1 rounded text-xs whitespace-nowrap"
                        style={{
                          backgroundColor: statusColor,
                          color: 'white'
                        }}
                      >
                        CA Review
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View Customer */}
                        <button
                          onClick={() => handleView(customer)}
                          className="p-2 rounded-lg bg-gradient-to-r from-green-50 to-green-100 border border-green-200 text-green-600 hover:from-green-100 hover:to-green-200 hover:text-green-700 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow"
                          title="View Customer Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>

                        {/* Verify Button - Only for credit_analyst_officer */}
                        {profile?.role === "credit_analyst_officer" && (
                          <button
                            onClick={() => handleVerify(customer.id)}
                            className="p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow flex items-center gap-1"
                            title="Verify Customer"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* No Results */}
        {filteredCustomers.length === 0 && (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
              <EyeIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">No pending HQ reviews</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchTerm || selectedBranch || selectedRegion || selectedRO
                ? "Try adjusting your search or filters"
                : "All HQ reviews have been processed."}
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredCustomers.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing  <span className="font-semibold text-gray-800">{startIndex + 1}</span> to{" "}
                <span className="font-semibold text-gray-800">{Math.min(endIndex, filteredCustomers.length)}</span> of{" "}
                <span className="font-semibold text-gray-800">{filteredCustomers.length}</span> pending reviews
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  {/* First Page */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-gray-300 hover:border-gray-400 disabled:hover:border-gray-300"
                    title="First Page"
                  >
                    <ChevronDoubleLeftIcon className="h-4 w-4 text-gray-600" />
                  </button>

                  {/* Previous Page */}
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-gray-300 hover:border-gray-400 disabled:hover:border-gray-300"
                    title="Previous Page"
                  >
                    <ChevronLeftIcon className="h-4 w-4 text-gray-600" />
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1 mx-2">
                    {getPageNumbers().map((pageNum, index) => (
                      pageNum === '...' ? (
                        <span key={`ellipsis-${index}`} className="px-3 text-sm text-gray-400">
                          ...
                        </span>
                      ) : (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${currentPage === pageNum
                              ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm"
                              : "text-gray-600 hover:bg-white hover:text-gray-800 border border-gray-300 hover:border-gray-400"
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
                    className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-gray-300 hover:border-gray-400 disabled:hover:border-gray-300"
                    title="Next Page"
                  >
                    <ChevronRightIcon className="h-4 w-4 text-gray-600" />
                  </button>

                  {/* Last Page */}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-gray-300 hover:border-gray-400 disabled:hover:border-gray-300"
                    title="Last Page"
                  >
                    <ChevronDoubleRightIcon className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HQPending;