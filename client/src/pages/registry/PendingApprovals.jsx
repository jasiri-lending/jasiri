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
  ClipboardDocumentCheckIcon
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useWorkflow } from "../../hooks/useWorkflow";
import Spinner from "../../components/Spinner";

const PendingApprovals = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isUserAuthorized, userRoleIds, loadingRoles } = useWorkflow();

  const [instances, setInstances] = useState([]);
  const [filteredInstances, setFilteredInstances] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const hasFetchedData = useRef(false);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch active workflow instances
      const { data: instanceData, error: instanceError } = await supabase
        .from("workflow_instances")
        .select(`
          *,
          workflow_nodes:current_node_id (
            id,
            node_client_id,
            name,
            type,
            permissions
          ),
          workflow_definitions:workflow_id (
            id,
            name,
            type
          )
        `)
        .eq("tenant_id", profile?.tenant_id)
        .eq("status", "in_progress");

      if (instanceError) throw instanceError;

      // 2. Fetch corresponding customer details for onboarding instances
      const customerIds = (instanceData || [])
        .filter(i => i.entity_type === "customer_onboarding")
        .map(i => i.entity_id);

      let customers = [];
      if (customerIds.length > 0) {
        const { data: customerData } = await supabase
          .from("customers")
          .select(`
            *,
            branches (id, name),
            regions (id, name)
          `)
          .in("id", customerIds);
        customers = customerData || [];
      }

      // 3. Map instances to their entities and verify user authorization using the hook
      const enrichedInstances = (instanceData || []).map(instance => {
        const entity = customers.find(c => c.id === instance.entity_id);
        
        // Match structure for isUserAuthorized hook expectation
        const parsedInstance = {
          ...instance,
          current_node: instance.workflow_nodes
        };
        const isAuthorized = isUserAuthorized(parsedInstance);

        return {
          ...instance,
          entity,
          isAuthorized
        };
      }).filter(i => i.isAuthorized && i.entity); // Show only authorized & existing tasks

      setInstances(enrichedInstances);
      setFilteredInstances(enrichedInstances);
    } catch (error) {
      console.error("Error fetching approvals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && !loadingRoles && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchData();
    }
  }, [profile, loadingRoles]);

  // Filter instances
  useEffect(() => {
    const filtered = instances.filter((inst) => {
      const customer = inst.entity;
      if (!customer) return false;
      
      const fullName = `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.toLowerCase();
      const matchesSearch =
        fullName.includes(searchTerm.toLowerCase()) ||
        (customer.mobile || "").toString().includes(searchTerm) ||
        (customer.id_number || "").toString().includes(searchTerm) ||
        (inst.workflow_nodes?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inst.workflow_definitions?.name || "").toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
    setFilteredInstances(filtered);
  }, [searchTerm, instances]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredInstances.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInstances = filteredInstances.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    return pageNumbers;
  };

  const handleVerify = (customerId) => {
    navigate(`/customer/${customerId}/verify`);
  };

  const handleView = (customerId) => {
    navigate(`/customer/${customerId}/details`);
  };

  const getFullName = (customer) => {
    return `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim() || "N/A";
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-muted p-6 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-full bg-muted text-gray-800 border-r border-gray-200 p-6 min-h-screen font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1 tracking-wide">Registry / Dynamic Pending Approvals</h1>
        </div>
        <div className="text-xs text-brand-primary">
          <span className="font-semibold">{filteredInstances.length}</span> pending tasks
        </div>
      </div>

      {/* Search and Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="relative w-72">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID or step..."
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-all bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Customer Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Workflow Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Current Step</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Mobile</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentInstances.map((inst) => {
                const customer = inst.entity;
                return (
                  <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{getFullName(customer)}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 uppercase tracking-tighter">
                      {inst.workflow_definitions?.name || inst.entity_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {inst.workflow_nodes?.name || "Active Review"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{customer.branches?.name || "Global"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{customer.mobile || "N/A"}</td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleView(customer.id)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleVerify(customer.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                        >
                          <ClipboardDocumentCheckIcon className="h-3.5 w-3.5" />
                          Verify
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredInstances.length === 0 && !loading && (
          <div className="p-10 text-center">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">No pending approvals found</h3>
            <p className="text-xs text-gray-500">You are all caught up!</p>
          </div>
        )}

        {/* Pagination */}
        {filteredInstances.length > 0 && totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
            <div className="flex gap-1.5">
              {getPageNumbers().map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                    currentPage === pageNum
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingApprovals;
