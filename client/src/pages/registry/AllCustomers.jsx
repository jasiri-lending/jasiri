// src/pages/registry/Customers.jsx
import { useState, useEffect, useRef } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  BanknotesIcon,
  HandRaisedIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner.jsx";

const AllCustomers = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [customers, setCustomers] = useState([]);
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
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Use ref to track if data has been fetched
  const hasFetchedData = useRef(false);

  const handleOpenInteractions = (customer) => {
    navigate(`/customer/${customer.id}/interactions`);
  };

  const handleOpenLoanDetails = (customer) => {
    navigate(`/customer/${customer.id}/loan-details`);
  };

  const handleOpenPromiseToPay = async (customer) => {
    // Get the most recent disbursed loan
    const { data: loan, error } = await supabase
      .from("loans")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("status", "disbursed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (loan && !error) {
      navigate(`/customer/${customer.id}/promise-to-pay?loan_id=${loan.id}`);
    } else {
      alert("No disbursed loan found for this customer");
    }
  };

  const handleViewCustomer = (customer) => {
    navigate(`/customer/${customer.id}/details`);
  };

  // Helper function to get status display value - ONLY USING customer.status
  const getStatusDisplay = (customer) => {
    // Use ONLY the status column from the customers table
    if (!customer.status) return 'N/A';
    
    // Map status codes to readable names
    const statusMap = {
      'pending': 'Pending',
      'bm_review': 'BM Review',
      'ca_review': 'CA Review',
      'cso_review': 'CSO Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'sent_back_by_bm': 'Sent Back by BM',
      'sent_back_by_ca': 'Sent Back by CA',
      'sent_back_by_cso': 'Sent Back by CSO',
      'cso_review_amend': 'CSO Review (Amend)',
      'bm_review_amend': 'BM Review (Amend)',
      'ca_review_amend': 'CA Review (Amend)'
    };
    
    return statusMap[customer.status] || customer.status;
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

  // Fetch data based on user role
  const fetchData = async () => {
    try {
      setLoading(true);

      console.log("=== STARTING DATA FETCH ===");
      console.log("Profile:", profile);

      // Fetch all customers for the tenant by joining with users
      const { data: customersData, error: customersError } = await supabase
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
        .eq("form_status", "submitted")
        .order("created_at", { ascending: false });

      console.log("=== CUSTOMERS DATA DEBUG ===");
      console.log("Raw customers data length:", customersData?.length || 0);
      console.log("Sample customer with user data:", customersData?.[0]);

      if (customersError) {
        console.error("Error fetching customers:", customersError);
        return;
      }

      // Filter customers by tenant_id from the created_by user
      const filteredByTenant = customersData?.filter(customer => {
        return customer.users?.tenant_id === profile?.tenant_id;
      }) || [];

      console.log("Customers after tenant filtering:", filteredByTenant.length);

      // Apply role-based filtering
      let roleFilteredCustomers = filteredByTenant;

      if (profile?.role === 'regional_manager' && profile.region_id) {
        roleFilteredCustomers = roleFilteredCustomers.filter(
          c => c.region_id?.toString() === profile.region_id
        );
        console.log("After regional manager filter:", roleFilteredCustomers.length);
      } else if (profile?.role === 'branch_manager' && profile.branch_id) {
        roleFilteredCustomers = roleFilteredCustomers.filter(
          c => c.branch_id?.toString() === profile.branch_id
        );
        console.log("After branch manager filter:", roleFilteredCustomers.length);
      } else if (profile?.role === 'relationship_officer' && profile.id) {
        roleFilteredCustomers = roleFilteredCustomers.filter(
          c => c.created_by?.toString() === profile.id
        );
        console.log("After relationship officer filter:", roleFilteredCustomers.length);
      }

      // Fetch additional data for filters
      if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
        // Fetch all data for these roles
        const [branchesResult, regionsResult, roResult] = await Promise.all([
          supabase.from("branches").select("id, name, region_id, tenant_id").eq("tenant_id", profile.tenant_id).order("name"),
          supabase.from("regions").select("id, name, tenant_id").eq("tenant_id", profile.tenant_id).order("name"),
          supabase.from("users").select("id, full_name, tenant_id").eq("role", "relationship_officer").eq("tenant_id", profile.tenant_id).order("full_name")
        ]);

        setAllBranches(branchesResult.data || []);
        setBranches(branchesResult.data || []);
        setRegions(regionsResult.data || []);
        
        // Enrich ROs with their branch and region info from customers data
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
        // Fetch branches and ROs in their region
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
          
          // Filter ROs based on region from customers data
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
        // Fetch ROs in their branch
        if (profile.branch_id) {
          const { data: roData } = await supabase
            .from("users")
            .select("id, full_name, tenant_id")
            .eq("role", "relationship_officer")
            .eq("tenant_id", profile.tenant_id)
            .order("full_name");

          // Filter ROs based on branch from customers data
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

      // Process customers data with loan status
      if (roleFilteredCustomers && roleFilteredCustomers.length > 0) {
        // Fetch all loans for these customers in a single query
        const customerIds = roleFilteredCustomers.map(c => c.id);
        
        // Fetch active loans (disbursed and not completed/defaulted)
        const { data: loans, error: loansError } = await supabase
          .from("loans")
          .select("id, customer_id, status, repayment_state")
          .in("customer_id", customerIds)
          .eq("status", "disbursed")
          .in("repayment_state", ["ongoing", "partial", "overdue"])
          .order("created_at", { ascending: false });

        console.log("=== LOANS DEBUG ===");
        console.log("Found loans:", loans?.length || 0);
        console.log("Sample loan:", loans?.[0]);

        if (!loansError) {
          // Create a map of customer_id to their most recent active loan
          const loanMap = new Map();
          loans?.forEach(loan => {
            if (!loanMap.has(loan.customer_id)) {
              loanMap.set(loan.customer_id, loan);
            }
          });

          // Enrich customers with loan data and add displayStatus
          const customersWithLoanStatus = roleFilteredCustomers.map((c) => {
            const loan = loanMap.get(c.id);
            const displayStatus = getStatusDisplay(c);
            
            return {
              ...c,
              displayStatus, // Add formatted status for display
              hasDisbursedLoan: !!loan,
              loanRepaymentState: loan?.repayment_state || null,
              loanId: loan?.id || null
            };
          });
          
          console.log("=== FINAL CUSTOMERS DATA ===");
          console.log("Total customers to display:", customersWithLoanStatus.length);
          console.log("Sample customer status:", customersWithLoanStatus[0]?.displayStatus);
          console.log("Customers with loans:", customersWithLoanStatus.filter(c => c.hasDisbursedLoan).length);
          
          setCustomers(customersWithLoanStatus);
        } else {
          console.error("Error fetching loans:", loansError);
          // Add displayStatus even if loan fetch fails
          const customersWithDisplayStatus = roleFilteredCustomers.map(c => ({
            ...c,
            displayStatus: getStatusDisplay(c),
            hasDisbursedLoan: false,
            loanRepaymentState: null,
            loanId: null
          }));
          setCustomers(customersWithDisplayStatus);
        }
      } else {
        console.log("No customers found after all filters");
        setCustomers([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch data once when profile is available
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
    setSelectedStatus("");
    setCurrentPage(1);
    
    // Reset cascading filters
    if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    } else if (profile?.role === 'regional_manager') {
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

  const filteredCustomers = customers.filter((c) => {
    const fullName = `${c.Firstname || ""} ${c.Middlename || ""} ${c.Surname || ""}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      (c.mobile || "").toString().includes(searchTerm) ||
      (c.id_number || "").toString().includes(searchTerm);

    const matchesBranch =
      !selectedBranch ||
      c.branch_id?.toString() === selectedBranch ||
      c.branches?.id?.toString() === selectedBranch;

    const matchesRegion =
      !selectedRegion ||
      c.region_id?.toString() === selectedRegion;

    const matchesRO =
      !selectedRO ||
      c.created_by?.toString() === selectedRO;

    const matchesStatus =
      !selectedStatus ||
      c.status === selectedStatus ||
      c.displayStatus?.toLowerCase().includes(selectedStatus.toLowerCase());

    return matchesSearch && matchesBranch && matchesRegion && matchesRO && matchesStatus;
  });

  // Get unique statuses for filter dropdown
  const uniqueStatuses = [...new Set(
    customers
      .map(c => c.displayStatus)
      .filter(Boolean)
      .sort()
  )];

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedRegion, selectedRO, selectedStatus]);

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

  if (!profile || loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
        <Spinner text={!profile ? "Loading profile..." : "Loading customers..."} />
      </div>
    );
  }

  // Check if user has necessary permissions/data
  if ((profile.role === 'regional_manager' && !profile.region_id) ||
      (profile.role === 'branch_manager' && !profile.branch_id)) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-red-600 text-sm">
            Error: Your profile is missing necessary information. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Registry / All Customers
      </h1>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, mobile, or ID..."
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
              {(selectedBranch || selectedRegion || selectedRO || selectedStatus) && (
                <span className="ml-1 px-1.5 py-0.5 bg-white text-gray-700 rounded-full text-xs font-medium">
                  {[selectedBranch, selectedRegion, selectedRO, selectedStatus].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Region Filter (only for global roles) */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') && (
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
                        <option key={region.id} value={region.id.toString()}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Branch Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Filter by Branch
                    </label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Relationship Officer Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Filter by Relationship Officer
                    </label>
                    <select
                      value={selectedRO}
                      onChange={(e) => setSelectedRO(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All ROs</option>
                      {relationshipOfficers.map((ro) => (
                        <option key={ro.id} value={ro.id.toString()}>
                          {ro.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                        {status}
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
              {(selectedBranch || selectedRegion || selectedRO || selectedStatus) && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  <span className="text-xs text-gray-600">Active filters:</span>
                  {selectedRegion && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#586ab1" }}>
                      Region: {regions.find((r) => r.id.toString() === selectedRegion)?.name}
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
                      Branch: {branches.find((b) => b.id.toString() === selectedBranch)?.name}
                      <button
                        onClick={() => handleBranchChange("")}
                        className="ml-1"
                        style={{ color: "#586ab1" }}
                      >
                        <XMarkIcon size={12} />
                      </button>
                    </span>
                  )}
                  {selectedRO && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#586ab1" }}>
                      RO: {relationshipOfficers.find((ro) => ro.id.toString() === selectedRO)?.full_name}
                      <button
                        onClick={() => setSelectedRO("")}
                        className="ml-1"
                        style={{ color: "#586ab1" }}
                      >
                        <XMarkIcon size={12} />
                      </button>
                    </span>
                  )}
                  {selectedStatus && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#586ab1" }}>
                      Status: {selectedStatus}
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
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Mobile</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">ID</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Prequalified Amount</th>
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">RO</th>
                )}
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Branch</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Region</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody>
              {currentCustomers.map((customer) => {
                const fullName = `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim();
                const statusColor = getStatusColor(customer.status); // Changed to use customer.status directly
                
                return (
                  <tr 
                    key={customer.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis" title={fullName}>
                      {fullName || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{customer.mobile || "N/A"}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{customer.id_number || "N/A"}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-right font-medium whitespace-nowrap">
                      {customer.prequalifiedAmount ? 
                        `Ksh ${Number(customer.prequalifiedAmount).toLocaleString()}` : 
                        "N/A"}
                    </td>
                    {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" title={customer.users?.full_name}>
                        {customer.users?.full_name || "N/A"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" title={customer.branches?.name}>
                      {customer.branches?.name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" title={customer.regions?.name}>
                      {customer.regions?.name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span 
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
                        style={{ backgroundColor: statusColor }}
                      >
                        {customer.displayStatus || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* View Customer */}
                        <button
                          onClick={() => handleViewCustomer(customer)}
                          className="p-1.5 rounded-md bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700 transition whitespace-nowrap"
                          title="View Customer"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>

                        {/* Interactions */}
                        <button
                          onClick={() => handleOpenInteractions(customer)}
                          className="p-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition whitespace-nowrap"
                          title="Customer Interactions"
                        >
                          <ChatBubbleLeftRightIcon className="h-4 w-4" />
                        </button>

                        {/* Loan Details (only if disbursed) */}
                        {customer.hasDisbursedLoan && (
                          <button
                            onClick={() => handleOpenLoanDetails(customer)}
                            className="p-1.5 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 transition whitespace-nowrap"
                            title="Loan Details"
                          >
                            <BanknotesIcon className="h-4 w-4" />
                          </button>
                        )}

                        {/* Promise to Pay (only if disbursed AND repayment_state is ongoing or partial) */}
                        {customer.hasDisbursedLoan &&
                          ["ongoing", "partial"].includes(customer.loanRepaymentState) && (
                            <button
                              onClick={() => handleOpenPromiseToPay(customer)}
                              className="p-1.5 rounded-md bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 hover:text-purple-700 transition whitespace-nowrap"
                              title="Promise to Pay"
                            >
                              <HandRaisedIcon className="h-4 w-4" />
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

        {/* Pagination Controls with Total Count */}
        {filteredCustomers.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-600 whitespace-nowrap">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredCustomers.length)}</span> of <span className="font-medium">{filteredCustomers.length}</span> customers
              <span className="ml-2 text-gray-400">(Total in system: {customers.length})</span>
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

        {filteredCustomers.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-500 whitespace-nowrap">
            No customers found. Try adjusting your filters.
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
                // For now, this is just a placeholder
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

export default AllCustomers;