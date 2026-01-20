import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  EyeIcon,
  ChevronDownIcon,
  AdjustmentsHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  CheckCircleIcon,
  CalendarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import Spinner from "../../components/Spinner";

const LoanPendingDisbursement = () => {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const hasFetchedData = useRef(false);

  const [pendingLoans, setPendingLoans] = useState([]);
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

  const isCreditAnalyst = profile?.role === "credit_analyst_officer";
  const isBranchManager = profile?.role === "branch_manager";
  const isRegionalManager = profile?.role === "regional_manager";
  const isCustomerService = profile?.role === "customer_service_officer";

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch pending loans
      let loansQuery = supabase
        .from("loans")
        .select(`
          *,
          customers (
            Firstname,
            Surname,
            Middlename,
            mobile,
            id_number,
            branches (
              id,
              name,
              region_id
            )
          )
        `)
        .eq('status', 'ca_review')
        .order('created_at', { ascending: false });

      // Filter by branch for branch managers
      if (isBranchManager && profile?.branch_id) {
        loansQuery = loansQuery.eq('branch_id', profile.branch_id);
      }
      // Filter by region for regional managers
      else if (isRegionalManager && profile?.region_id) {
        const { data: branchesInRegion } = await supabase
          .from("branches")
          .select("id")
          .eq("region_id", profile.region_id);
        
        const branchIds = branchesInRegion?.map(b => b.id) || [];
        if (branchIds.length > 0) {
          loansQuery = loansQuery.in("branch_id", branchIds);
        }
      }

      const { data: loansData, error: loansError } = await loansQuery;

      if (loansError) {
        console.error("Error fetching loans:", loansError);
        return;
      }

      // Fetch additional data for filters based on role
      if (isCreditAnalyst || isCustomerService) {
        // Fetch all data for these roles
        const [branchesResult, regionsResult, roResult] = await Promise.all([
          supabase.from("branches").select("id, name, region_id, tenant_id").eq("tenant_id", profile.tenant_id).order("name"),
          supabase.from("regions").select("id, name, tenant_id").eq("tenant_id", profile.tenant_id).order("name"),
          supabase.from("users").select("id, full_name, tenant_id").eq("role", "relationship_officer").eq("tenant_id", profile.tenant_id).order("full_name")
        ]);

        setAllBranches(branchesResult.data || []);
        setBranches(branchesResult.data || []);
        setRegions(regionsResult.data || []);
        
        // Enrich ROs with their branch and region info from loans data
        const enrichedROs = (roResult.data || []).map(ro => {
          const roLoan = loansData?.find(l => l.booked_by === ro.id);
          return {
            ...ro,
            branch_id: roLoan?.branch_id,
            region_id: roLoan?.customers?.branches?.region_id
          };
        });
        
        setAllRelationshipOfficers(enrichedROs);
        setRelationshipOfficers(enrichedROs);
      } else if (isRegionalManager && profile?.region_id) {
        // Fetch branches and ROs in their region
        const [branchesResult, roResult] = await Promise.all([
          supabase.from("branches").select("id, name, region_id, tenant_id").eq("region_id", profile.region_id).eq("tenant_id", profile.tenant_id).order("name"),
          supabase.from("users").select("id, full_name, tenant_id").eq("role", "relationship_officer").eq("tenant_id", profile.tenant_id).order("full_name")
        ]);

        setAllBranches(branchesResult.data || []);
        setBranches(branchesResult.data || []);
        
        // Filter ROs based on region from loans data
        const enrichedROs = (roResult.data || []).map(ro => {
          const roLoan = loansData?.find(l => l.booked_by === ro.id);
          return {
            ...ro,
            branch_id: roLoan?.branch_id,
            region_id: roLoan?.customers?.branches?.region_id
          };
        }).filter(ro => ro.region_id?.toString() === profile.region_id);
        
        setAllRelationshipOfficers(enrichedROs);
        setRelationshipOfficers(enrichedROs);
      } else if (isBranchManager && profile?.branch_id) {
        // Fetch ROs in their branch
        const { data: roData } = await supabase
          .from("users")
          .select("id, full_name, tenant_id")
          .eq("role", "relationship_officer")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name");

        // Filter ROs based on branch from loans data
        const enrichedROs = (roData || []).map(ro => {
          const roLoan = loansData?.find(l => l.booked_by === ro.id);
          return {
            ...ro,
            branch_id: roLoan?.branch_id,
            region_id: roLoan?.customers?.branches?.region_id
          };
        }).filter(ro => ro.branch_id?.toString() === profile.branch_id);

        setAllRelationshipOfficers(enrichedROs);
        setRelationshipOfficers(enrichedROs);
      }

      setPendingLoans(loansData || []);
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

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedBranch("");
    setSelectedRegion("");
    setSelectedRO("");
    setCurrentPage(1);
    
    // Reset cascading filters
    if (isCreditAnalyst || isCustomerService) {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    } else if (isRegionalManager) {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    } else if (isBranchManager) {
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

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
      // Reset to all branches and ROs
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
      // Reset to all ROs
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  // Filter loans
  const filteredLoans = pendingLoans.filter((loan) => {
    const firstName = loan.customers?.Firstname?.toLowerCase() || "";
    const surname = loan.customers?.Surname?.toLowerCase() || "";
    const middlename = loan.customers?.Middlename?.toLowerCase() || "";
    const fullName = `${firstName} ${middlename} ${surname}`.trim();
    const loanId = loan.id?.toString() || "";
    
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      (loan.customers?.mobile || "").toString().includes(searchTerm) ||
      (loan.customers?.id_number || "").toString().includes(searchTerm) ||
      loanId.includes(searchTerm);

    const matchesBranch =
      !selectedBranch || loan.branch_id?.toString() === selectedBranch;

    const matchesRegion =
      !selectedRegion || loan.customers?.branches?.region_id?.toString() === selectedRegion;

    const matchesRO =
      !selectedRO || loan.booked_by?.toString() === selectedRO;

    return matchesSearch && matchesBranch && matchesRegion && matchesRO;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLoans = filteredLoans.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedRegion, selectedRO]);

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

  // Get RO name by ID
  const getROName = (bookedBy) => {
    const ro = allRelationshipOfficers.find(r => r.id === bookedBy);
    return ro?.full_name || "N/A";
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  };

  const handleViewLoan = (loanId) => {
    navigate(`/view-disbursed-loans/${loanId}`);
  };

  if (authLoading || loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center">
        <Spinner text="Loading pending disbursements..." />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1 font-medium tracking-wide">
            Loans Pending Disbursement
          </h1>
        </div>
        <div className="text-xs text-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm" style={{backgroundColor:"#586ab1"}}>
          <span className="font-medium text-white">{pendingLoans.length}</span> pending loan{pendingLoans.length !== 1 ? 's' : ''}
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
                  placeholder="Search by loan ID, customer name, mobile, or ID number..."
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Region Filter (only for global roles) */}
                {(isCreditAnalyst || isCustomerService) && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Region</label>
                    <div className="relative">
                      <select
                        value={selectedRegion}
                        onChange={(e) => handleRegionChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="">All Regions</option>
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
                {(isCreditAnalyst || isCustomerService || isRegionalManager) && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Branch</label>
                    <div className="relative">
                      <select
                        value={selectedBranch}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="">All Branches</option>
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
                {(isCreditAnalyst || isCustomerService || isRegionalManager || isBranchManager) && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Relationship Officer</label>
                    <div className="relative">
                      <select
                        value={selectedRO}
                        onChange={(e) => setSelectedRO(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="">All ROs</option>
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
                        <button onClick={() => handleRegionChange("")} className="ml-1 text-gray-500 hover:text-gray-700">
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {selectedBranch && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        Branch: {branches.find((b) => b.id.toString() === selectedBranch)?.name}
                        <button onClick={() => handleBranchChange("")} className="ml-1 text-gray-500 hover:text-gray-700">
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {selectedRO && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        RO: {relationshipOfficers.find((ro) => ro.id.toString() === selectedRO)?.full_name}
                        <button onClick={() => setSelectedRO("")} className="ml-1 text-gray-500 hover:text-gray-700">
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
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Date</th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Loan ID</th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Customer</th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>ID Number</th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Mobile</th>
                {(isCreditAnalyst || isCustomerService || isRegionalManager || isBranchManager) && (
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Branch</th>
                )}
                {(isCreditAnalyst || isCustomerService || isRegionalManager || isBranchManager) && (
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Booked By</th>
                )}
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Product</th>
                <th className="px-4 py-3 text-right text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Amount</th>
                <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Weeks</th>
                <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Status</th>
                <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {currentLoans.map((loan, index) => {
                const customerName = `${loan.customers?.Firstname || ""} ${loan.customers?.Middlename || ""} ${loan.customers?.Surname || ""}`.trim();

                return (
                  <tr key={loan.id} className={`border-b transition-colors hover:bg-gray-50 ${index % 2 === 0 ? '' : 'bg-gray-50'}`}>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3 text-gray-400" />
                        {formatDate(loan.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap font-mono" style={{ color: '#0D2440' }}>
                      #{loan.id}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {customerName || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {loan.customers?.id_number || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {loan.customers?.mobile || "N/A"}
                    </td>
                    {(isCreditAnalyst || isCustomerService || isRegionalManager || isBranchManager) && (
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {loan.customers?.branches?.name || "N/A"}
                      </td>
                    )}
                    {(isCreditAnalyst || isCustomerService || isRegionalManager || isBranchManager) && (
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {getROName(loan.booked_by)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      <div className="flex flex-col">
                        <span>{loan.product_name || loan.product || "N/A"}</span>
                        {loan.is_new_loan && (
                          <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            New Customer
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-right" style={{ color: '#0D2440' }}>
                      <div className="font-medium text-emerald-600">
                        {loan.scored_amount ? `Ksh ${Number(loan.scored_amount).toLocaleString()}` : "N/A"}
                      </div>
                      {loan.weekly_payment && (
                        <div className="text-xs text-gray-500">
                          Weekly: Ksh {Number(loan.weekly_payment).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center whitespace-nowrap" style={{ color: '#0D2440' }}>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {loan.duration_weeks || "N/A"} weeks
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Ready for Disbursement
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewLoan(loan.id)}
                          className="p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
                          title="View Loan Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* No Results */}
        {filteredLoans.length === 0 && (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
              <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              {searchTerm || selectedBranch || selectedRegion ? "No loans found" : "No pending disbursements"}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchTerm || selectedBranch || selectedRegion
                ? "Try adjusting your search or filters"
                : isCreditAnalyst
                ? "All loans have been disbursed. Great work!"
                : "There are no loans pending disbursement in your area."}
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredLoans.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-800">{startIndex + 1}</span> to{" "}
                <span className="font-semibold text-gray-800">{Math.min(endIndex, filteredLoans.length)}</span> of{" "}
                <span className="font-semibold text-gray-800">{filteredLoans.length}</span> results
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

export default LoanPendingDisbursement;