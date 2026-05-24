import { useState, useEffect, useRef } from 'react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  EyeIcon,
  LockClosedIcon,
  ChevronDownIcon,
  AdjustmentsHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import ApproveLoan from "./ApproveLoan";
import Spinner from "../../components/Spinner";
import { useNavigate } from "react-router-dom";
import { SharedTable } from "../../components/SharedTable";
import { Pagination } from "../../components/Pagination";


const LoanPendingRm = () => {
  const { profile, loading: authLoading } = useAuth();
  const hasFetchedData = useRef(false);
  const navigate = useNavigate();


  const [pendingLoans, setPendingLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [relationshipOfficers, setRelationshipOfficers] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [allRelationshipOfficers, setAllRelationshipOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedRO, setSelectedRO] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const isSuperAdmin = profile?.role === "super_admin";
  const isRegionalManager = profile?.role === "regional_manager";
  const isCreditAnalyst = profile?.role === "credit_analyst_officer";
  const isCustomerService = profile?.role === "customer_service_officer";
  const isBranchManager = profile?.role === "branch_manager";
  const isRelationshipOfficer = profile?.role === "relationship_officer";

  const isGlobalRole = isSuperAdmin || isCreditAnalyst;

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
          ),
          bm:users!loans_bm_id_fkey (full_name),
          booked_by_user:users!loans_created_by_fkey (full_name)
        `)
        .eq('status', 'rn_review')
        .eq('tenant_id', profile?.tenant_id)
        .order('approved_by_bm_at', { ascending: false });

      // Filter by Relationship Officer
      if (isRelationshipOfficer && profile?.id) {
        loansQuery = loansQuery.eq('booked_by', profile.id);
      }
      // Filter by branch for branch managers and customer service officers
      else if ((isBranchManager || isCustomerService) && profile?.branch_id) {
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
        } else {
          // If no branches found in region, restrict to none to avoid unfiltered access
          loansQuery = loansQuery.eq("branch_id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { data: loansData, error: loansError } = await loansQuery;

      if (loansError) {
        console.error("Error fetching loans:", loansError);
        return;
      }

      // BM data is now fetched via join, no separate fetch needed.

      // Fetch additional data for filters based on role
      if (isGlobalRole) {
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
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);

    // Reset cascading filters
    if (isGlobalRole || isCustomerService) {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    } else if (isRegionalManager) {
      setBranches(allBranches);
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

    const createdAt = loan.created_at ? new Date(loan.created_at).setHours(0, 0, 0, 0) : null;
    const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
    const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

    const matchesDate = (!start || (createdAt && createdAt >= start)) &&
      (!end || (createdAt && createdAt <= end));

    return matchesSearch && matchesBranch && matchesRegion && matchesRO && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLoans = filteredLoans.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedRegion, selectedRO, startDate, endDate]);

  // Columns definition for SharedTable
  const columns = [
    {
      header: 'Loan ID',
      render: (row) => `#${row.id}`,
    },
    {
      header: 'Customer',
      render: (row) => `${row.customers?.Firstname || ''} ${row.customers?.Middlename || ''} ${row.customers?.Surname || ''}`.trim() || 'N/A',
    },
    {
      header: 'ID Number',
      render: (row) => row.customers?.id_number || 'N/A',
    },
    {
      header: 'Mobile',
      render: (row) => row.customers?.mobile || 'N/A',
    },
    ...(isCreditAnalyst || isCustomerService || isRegionalManager
      ? [{
          header: 'Branch',
          render: (row) => row.customers?.branches?.name || 'N/A',
        }]
      : []),
    ...(isCreditAnalyst || isCustomerService || isRegionalManager
      ? [{
          header: 'Booked By',
          render: (row) => getROName(row),
        }]
      : []),
    {
      header: 'Product',
      render: (row) => row.product_name || row.product || 'N/A',
    },
    {
      header: 'Amount',
      render: (row) => row.scored_amount ? `Ksh ${Number(row.scored_amount).toLocaleString()}` : 'N/A',
    },
    {
      header: 'Weeks',
      render: (row) => row.duration_weeks || 'N/A',
    },
    {
      header: 'Approved By',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.bm_id && <CheckCircleIcon className="h-3 w-3 text-green-500" />}
          <span className="text-xs text-slate-600 font-medium whitespace-nowrap">{getBMName(row)}</span>
        </div>
      ),
    },
    {
      header: 'Approved At',
      render: (row) => row.bm_reviewed_at ? formatDate(row.bm_reviewed_at) : 'N/A',
    },
    {
      header: 'Applied Date',
      render: (row) => row.created_at ? formatDate(row.created_at) : 'N/A',
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleViewLoan(row.id)}
            className="p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
            title="View Loan Details"
          >
            <EyeIcon className="h-3 w-3" />
          </button>
          {isRegionalManager && (
            <button
              onClick={() => setSelectedLoan(row)}
              className="p-2 rounded-lg bg-gradient-to-r from-green-50 to-green-100 border border-green-200 text-green-600 hover:from-green-100 hover:to-green-200 hover:text-green-700 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow"
              title="Review and Approve Loan"
            >
              <CheckCircleIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const handleComplete = () => {
    setSelectedLoan(null);
    fetchData();
  };

  // Get RO name - now using the joined data
  const getROName = (loan) => {
    return loan.booked_by_user?.full_name || "N/A";
  };

  // Get BM name - now using the joined data
  const getBMName = (loan) => {
    return loan.bm?.full_name || "N/A";
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  };

  // Handle view loan details
  const handleViewLoan = (loanId) => {
    navigate(`/loans/${loanId}`);
  };

  if (selectedLoan) {
    return <ApproveLoan loan={selectedLoan} onComplete={handleComplete} />;
  }

  if (!profile) return null;

  if (authLoading) {
    return (
      <div className="h-full bg-muted p-6 min-h-screen flex items-center justify-center">
        <Spinner text="Authenticating..." />
      </div>
    );
  }

  return (
    <div className="h-full bg-muted transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm text-slate-600">
            Loans Pending RM Approval
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-brand-primary">
            <span className="font-semibold">{pendingLoans.length}</span> pending loan{pendingLoans.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Search and Filters Header */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" />
                <input
                  type="text"
                  placeholder="Search by loan ID, customer name, mobile, or ID number..."
                  className="w-full pl-9 pr-8 py-2 text-xs font-body border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-all duration-200 bg-white"
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
                {(selectedBranch || selectedRegion || selectedRO || startDate || endDate) && (
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
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-body font-medium transition-all duration-200 border ${
                    showFilters
                      ? "bg-brand-surface border-brand-primary text-brand-primary"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-brand-surface hover:border-brand-secondary hover:text-brand-primary"
                  }`}
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Filters
                  {(selectedBranch || selectedRegion || selectedRO || startDate || endDate) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-brand-btn text-white rounded-full text-xs font-semibold">
                      {[selectedBranch, selectedRegion, selectedRO, startDate, endDate].filter(Boolean).length}
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
                {isGlobalRole && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Region</label>
                    <div className="relative">
                      <select
                        value={selectedRegion}
                        onChange={(e) => handleRegionChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 appearance-none bg-white"
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
                {(isGlobalRole || isRegionalManager) && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Branch</label>
                    <div className="relative">
                      <select
                        value={selectedBranch}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 appearance-none bg-white"
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
                {(isGlobalRole || isRegionalManager || isBranchManager || isCustomerService) && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Relationship Officer</label>
                    <div className="relative">
                      <select
                        value={selectedRO}
                        onChange={(e) => setSelectedRO(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white font-sans"
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

                {/* Date Range Start */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white font-sans"
                  />
                </div>

                {/* Date Range End */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 bg-white font-sans"
                  />
                </div>
              </div>

              {/* Active Filters Display */}
              {(selectedBranch || selectedRegion || selectedRO || startDate || endDate) && (
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
                    {startDate && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        From: {startDate}
                        <button onClick={() => setStartDate("")} className="ml-1 text-gray-500 hover:text-gray-700">
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {endDate && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        To: {endDate}
                        <button onClick={() => setEndDate("")} className="ml-1 text-gray-500 hover:text-gray-700">
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
        <div className="overflow-x-auto font-body">
          {/* Shared Table */}
          <SharedTable
            columns={columns}
            data={currentLoans}
            rowKey="id"
          />
        </div>

        {/* No Results */}
        {filteredLoans.length === 0 && (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
              <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              {searchTerm || selectedBranch || selectedRegion || selectedRO || startDate || endDate ? "No loans found" : "No pending approvals"}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchTerm || selectedBranch || selectedRegion || selectedRO || startDate || endDate
                ? "Try adjusting your search or filters"
                : isRegionalManager
                  ? "All loans have been reviewed by the regional manager."
                  : "There are no loans pending regional manager approval in your area."}
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredLoans.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
            <Pagination
              totalItems={filteredLoans.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />

            {/* Items Per Page Selector */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] text-gray-600">Items per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    // Handle items per page change
                    console.log("Items per page changed to:", e.target.value);
                  }}
                  className="text-[10px] border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors"
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

export default LoanPendingRm;