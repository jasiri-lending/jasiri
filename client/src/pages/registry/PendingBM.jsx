import { useState, useEffect, useRef } from "react";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  EyeIcon,
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner";

const PendingBM = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [relationshipOfficers, setRelationshipOfficers] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [allRelationshipOfficers, setAllRelationshipOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedRO, setSelectedRO] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const hasFetchedData = useRef(false);
  
  // Fetch pending customers with related data
  const fetchData = async () => {
    try {
      setLoading(true);
      
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
            tenant_id,
            role
          )
        `)
        .eq("status", "bm_review")
        .neq("form_status", "draft")
        .order("created_at", { ascending: false });

      // BM can only see customers from their branch
      if (profile?.role === 'branch_manager' && profile.branch_id) {
        query = query.eq("branch_id", profile.branch_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching pending customers:", error);
        return;
      }

      // Filter by tenant_id
      const filteredByTenant = data?.filter(customer => {
        return customer.users?.tenant_id === profile?.tenant_id;
      }) || [];

      // Apply role-based filtering
      let roleFilteredCustomers = filteredByTenant;

      if (profile?.role === 'regional_manager' && profile.region_id) {
        roleFilteredCustomers = roleFilteredCustomers.filter(
          c => c.region_id?.toString() === profile.region_id
        );
      } else if (profile?.role === 'branch_manager' && profile.branch_id) {
        roleFilteredCustomers = roleFilteredCustomers.filter(
          c => c.branch_id?.toString() === profile.branch_id
        );
      } else if (profile?.role === 'relationship_officer' && profile.id) {
        roleFilteredCustomers = roleFilteredCustomers.filter(
          c => c.created_by?.toString() === profile.id
        );
      }

      // Fetch additional data for filters
      if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
        const [branchesResult, regionsResult, roResult] = await Promise.all([
          supabase.from("branches").select("id, name, region_id, tenant_id").eq("tenant_id", profile.tenant_id).order("name"),
          supabase.from("regions").select("id, name, tenant_id").eq("tenant_id", profile.tenant_id).order("name"),
          supabase.from("users").select("id, full_name, tenant_id").eq("role", "relationship_officer").eq("tenant_id", profile.tenant_id).order("full_name")
        ]);

        setAllBranches(branchesResult.data || []);
        setBranches(branchesResult.data || []);
        setRegions(regionsResult.data || []);
        
        const enrichedROs = (roResult.data || []).map(ro => {
          const roCustomer = roleFilteredCustomers.find(c => c.created_by === ro.id);
          return {
            ...ro,
            branch_id: roCustomer?.branch_id,
            region_id: roCustomer?.region_id
          };
        });
        
        setAllRelationshipOfficers(enrichedROs);
        setRelationshipOfficers(enrichedROs);
      } else if (profile?.role === 'regional_manager') {
        if (profile.region_id) {
          const [branchesResult, roResult] = await Promise.all([
            supabase.from("branches").select("id, name, region_id, tenant_id").eq("region_id", profile.region_id).eq("tenant_id", profile.tenant_id).order("name"),
            supabase
              .from("users")
              .select("id, full_name, tenant_id")
              .eq("role", "relationship_officer")
              .eq("tenant_id", profile.tenant_id)
              .order("full_name")
          ]);

          setAllBranches(branchesResult.data || []);
          setBranches(branchesResult.data || []);
          
          const enrichedROs = (roResult.data || []).map(ro => {
            const roCustomer = roleFilteredCustomers.find(c => c.created_by === ro.id);
            return {
              ...ro,
              branch_id: roCustomer?.branch_id,
              region_id: roCustomer?.region_id
            };
          }).filter(ro => ro.region_id?.toString() === profile.region_id);
          
          setAllRelationshipOfficers(enrichedROs);
          setRelationshipOfficers(enrichedROs);
        }
      } else if (profile?.role === 'branch_manager') {
        if (profile.branch_id) {
          const { data: roData } = await supabase
            .from("users")
            .select("id, full_name, tenant_id")
            .eq("role", "relationship_officer")
            .eq("tenant_id", profile.tenant_id)
            .order("full_name");

          const enrichedROs = (roData || []).map(ro => {
            const roCustomer = roleFilteredCustomers.find(c => c.created_by === ro.id);
            return {
              ...ro,
              branch_id: roCustomer?.branch_id,
              region_id: roCustomer?.region_id
            };
          }).filter(ro => ro.branch_id?.toString() === profile.branch_id);

          setAllRelationshipOfficers(enrichedROs);
          setRelationshipOfficers(enrichedROs);
        }
      }

      // Process customers data
      if (roleFilteredCustomers && roleFilteredCustomers.length > 0) {
        setCustomers(roleFilteredCustomers);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchData();
    }
  }, [profile]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedBranch("");
    setSelectedRegion("");
    setSelectedRO("");
    setCurrentPage(1);
    
    if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    } else if (profile?.role === 'regional_manager') {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  // Handle region change
  const handleRegionChange = (regionId) => {
    setSelectedRegion(regionId);
    setSelectedBranch("");
    setSelectedRO("");
    
    if (regionId) {
      const filteredBranches = allBranches.filter(
        (branch) => branch.region_id?.toString() === regionId
      );
      setBranches(filteredBranches);
      
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.region_id?.toString() === regionId
      );
      setRelationshipOfficers(filteredROs);
    } else {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  // Handle branch change
  const handleBranchChange = (branchId) => {
    setSelectedBranch(branchId);
    setSelectedRO("");
    
    if (branchId) {
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.branch_id?.toString() === branchId
      );
      setRelationshipOfficers(filteredROs);
    } else if (selectedRegion) {
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.region_id?.toString() === selectedRegion
      );
      setRelationshipOfficers(filteredROs);
    } else {
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  // Filter customers
  useEffect(() => {
    const filtered = customers.filter((customer) => {
      const fullName = `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.toLowerCase();
      const matchesSearch =
        fullName.includes(searchTerm.toLowerCase()) ||
        (customer.mobile || "").toString().includes(searchTerm) ||
        (customer.id_number || "").toString().includes(searchTerm) ||
        (customer.branches?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (customer.regions?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (customer.users?.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase());

      const matchesBranch =
        !selectedBranch ||
        customer.branch_id?.toString() === selectedBranch;

      const matchesRegion =
        !selectedRegion ||
        customer.region_id?.toString() === selectedRegion;

      const matchesRO =
        !selectedRO ||
        customer.created_by?.toString() === selectedRO;

      return matchesSearch && matchesBranch && matchesRegion && matchesRO;
    });
    setFilteredCustomers(filtered);
  }, [searchTerm, selectedBranch, selectedRegion, selectedRO, customers]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedRegion, selectedRO]);

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

  // Handler functions
  const handleVerify = (customerId) => {
    navigate(`/customer/${customerId}/verify`);
  };

  const handleView = (customer) => {
    navigate(`/customer/${customer.id}/details`);
  };

  // Helper function to get full name
  const getFullName = (customer) => {
    const firstName = customer.Firstname || '';
    const lastName = customer.Surname || '';
    const middleName = customer.Middlename || '';
    return `${firstName} ${middleName} ${lastName}`.trim() || 'N/A';
  };

  // Get status color
  const getStatusColor = () => {
    return '#f59e0b'; // amber color for pending status
  };

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center">
        <Spinner text="Loading ..." />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-500">Loading user information...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1 font-medium  tracking-wide">
            Registry / Pending BM Review
          </h1>
        </div>
        <div className="text-xs text-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm" style={{backgroundColor:"#586ab1"}}>
          <span className="font-medium text-white">{filteredCustomers.length}</span> pending customers
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Search and Filters Header */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
              </div>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Region Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Region
                    </label>
                    <div className="relative">
                      <select
                        value={selectedRegion}
                        onChange={(e) => handleRegionChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="" className="text-gray-400">All Regions</option>
                        {regions.map((region) => (
                          <option key={region.id} value={region.id.toString()}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDownIcon className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Branch Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager') && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Branch
                    </label>
                    <div className="relative">
                      <select
                        value={selectedBranch}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="" className="text-gray-400">All Branches</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDownIcon className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Relationship Officer Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
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
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Mobile
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  ID Number
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Prequalified Amount
                </th>
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    RO
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Branch
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Region
                </th>
                <th className="px-4 py-3 text-center text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {currentCustomers.map((customer, index) => {
                const fullName = getFullName(customer);
                const statusColor = getStatusColor();
                
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
                    {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
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
                        BM Review
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleView(customer)}
                          className="p-2 rounded-lg bg-gradient-to-r from-green-50 to-green-100 border border-green-200 text-green-600 hover:from-green-100 hover:to-green-200 hover:text-green-700 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow"
                          title="View Customer"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        
                        {(profile?.role === 'branch_manager') && (
                          <button
                            onClick={() => handleVerify(customer.id)}
                            className="px-3 py-1.5 text-xs  text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow" style={{backgroundColor:"#586ab1"}}
                          >
                            Verify
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
        {filteredCustomers.length === 0 && !loading && (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
              <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">No pending customers found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchTerm || selectedBranch || selectedRegion || selectedRO 
                ? "Try adjusting your search or filters"
                : "No customers pending BM review"}
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
                <span className="font-semibold text-gray-800">{filteredCustomers.length}</span> results
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
                          className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                            currentPage === pageNum
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

            {/* Items Per Page Selector */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-gray-600">Items per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    // Note: itemsPerPage is currently not stateful
                    console.log("Items per page changed to:", e.target.value);
                  }}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingBM;