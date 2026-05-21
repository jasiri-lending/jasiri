import { useState, useEffect, useRef } from "react";
import {
  MagnifyingGlassIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ArrowsRightLeftIcon,
  PencilSquareIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useWorkflow, denormalizeEntityId } from "../../hooks/useWorkflow";
import Spinner from "../../components/Spinner";

// Entity type config: which DB table to query and how to render each type
const ENTITY_CONFIG = {
  customer_onboarding: {
    label: "Onboarding",
    color: "bg-indigo-50 text-indigo-700 border-indigo-100",
    table: "customers",
    idField: "id",
    icon: UserCircleIcon,
    getDisplayName: (e) => `${e?.Firstname || ""} ${e?.Middlename || ""} ${e?.Surname || ""}`.trim() || "N/A",
    getSubtitle: (e) => e?.mobile || "N/A",
    actionLabel: "Verify",
    actionIcon: ClipboardDocumentCheckIcon,
    getActionRoute: (inst) => `/customer/${inst.entity_id}/verify`,
    getViewRoute: (inst) => `/customer/${inst.entity_id}/details`,
  },
  customer_edits: {
    label: "ID/Phone Edit",
    color: "bg-amber-50 text-amber-700 border-amber-100",
    table: "customer_phone_id_edit_requests",
    idField: "id",
    icon: PencilSquareIcon,
    getDisplayName: (e) => {
      const c = e?.customer;
      return c ? `${c.Firstname || ""} ${c.Surname || ""}`.trim() : "Edit Request";
    },
    getSubtitle: (e) => `${e?.current_mobile || ""} → ${e?.new_mobile || ""}`.trim() || e?.edit_type || "Edit",
    actionLabel: "Review",
    actionIcon: ClipboardDocumentCheckIcon,
    getActionRoute: (inst) => `/registry/customer-edits/review/${inst.entity_id}/phone_id`,
    getViewRoute: (inst) => `/registry/customer-edits/review/${inst.entity_id}/phone_id`,
  },
  customer_detail_edits: {
    label: "Detail Edit",
    color: "bg-orange-50 text-orange-700 border-orange-100",
    table: "customer_detail_edit_requests",
    idField: "id",
    icon: PencilSquareIcon,
    getDisplayName: (e) => {
      const c = e?.customer;
      return c ? `${c.Firstname || ""} ${c.Surname || ""}`.trim() : "Detail Edit";
    },
    getSubtitle: (e) => e?.section_type ? `Section: ${e.section_type}` : "Detail Edit Request",
    actionLabel: "Review",
    actionIcon: ClipboardDocumentCheckIcon,
    getActionRoute: (inst) => `/registry/customer-edits/review/${inst.entity_id}/other_details`,
    getViewRoute: (inst) => `/registry/customer-edits/review/${inst.entity_id}/other_details`,
  },
  customer_transfer: {
    label: "Transfer",
    color: "bg-blue-50 text-blue-700 border-blue-100",
    table: "customer_transfer_requests",
    idField: "id",
    icon: ArrowsRightLeftIcon,
    getDisplayName: (e) => {
      const from = e?.current_branch?.name || "?";
      const to = e?.new_branch?.name || "?";
      return `${from} → ${to}`;
    },
    getSubtitle: (e) => `${e?.remarks || "Transfer Request"}`,
    actionLabel: "Review",
    actionIcon: ClipboardDocumentCheckIcon,
    getActionRoute: (inst) => `/registry/customer-transfer/${inst.entity_id}/review`,
    getViewRoute: (inst) => `/registry/customer-transfer/${inst.entity_id}/review`,
  },
};

const PendingApprovals = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isUserAuthorized, loadingRoles } = useWorkflow();

  const [instances, setInstances] = useState([]);
  const [filteredInstances, setFilteredInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const hasFetchedData = useRef(false);
  const getCustomerInfo = (inst) => {
    let displayName = "N/A";
    let branchName = "N/A";
    let mobile = "N/A";
    let officerName = "N/A";

    if (!inst.entity) return { displayName, branchName, mobile, officerName };

    if (inst.entity_type === "customer_onboarding") {
      const customer = inst.entity;
      displayName = `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim() || "N/A";
      branchName = customer.branches?.name || "Global";
      mobile = customer.mobile || "N/A";
      officerName = customer.created_by_user?.full_name || "N/A";
    } else if (inst.entity_type === "customer_edits" || inst.entity_type === "customer_detail_edits") {
      const customer = inst.entity.customer;
      if (customer) {
        displayName = `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim() || "N/A";
        branchName = customer.branches?.name || "Global";
        mobile = customer.mobile || "N/A";
      }
      officerName = inst.entity.created_by_user?.full_name || "N/A";
    } else if (inst.entity_type === "customer_transfer") {
      const items = inst.entity.transfer_items || [];
      const customers = items.map(item => item.customer).filter(Boolean);
      if (customers.length > 0) {
        const first = customers[0];
        displayName = `${first.Firstname || ""} ${first.Surname || ""}`.trim();
        if (customers.length > 1) {
          displayName += ` (+${customers.length - 1} more)`;
        }
        branchName = inst.entity.current_branch?.name || "N/A";
        mobile = first.mobile || "N/A";
      }
      officerName = inst.entity.branch_manager?.full_name || "N/A";
    }

    return { displayName, branchName, mobile, officerName };
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch all active in_progress workflow instances for this tenant
      const { data: instanceData, error: instanceError } = await supabase
        .from("workflow_instances")
        .select(`
          *,
          workflow_nodes!current_node_id (id, node_client_id, name, type, permissions),
          workflow_definitions!workflow_id (id, name, type)
        `)
        .eq("tenant_id", profile?.tenant_id)
        .eq("status", "in_progress");

      if (instanceError) throw instanceError;

      // 2. Group entity IDs by type so we can batch-fetch each entity table
      const grouped = {};
      for (const inst of (instanceData || [])) {
        inst.entity_id = denormalizeEntityId(inst.entity_id);
        const type = inst.entity_type;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(inst.entity_id);
      }

      // 3. Fetch entities from each relevant table
      const entityMaps = {};

      // customer_onboarding → customers
      if (grouped.customer_onboarding?.length) {
        const { data } = await supabase
          .from("customers")
          .select("*, branches(id, name), regions(id, name), created_by_user:created_by(full_name)")
          .in("id", grouped.customer_onboarding);
        (data || []).forEach(r => { entityMaps[r.id] = r; });
      }

      // customer_edits → customer_phone_id_edit_requests (join customer info and branches)
      if (grouped.customer_edits?.length) {
        const { data } = await supabase
          .from("customer_phone_id_edit_requests")
          .select("*, customer:customers(Firstname, Middlename, Surname, mobile, branches(name)), created_by_user:users!created_by(full_name)")
          .in("id", grouped.customer_edits);
        (data || []).forEach(r => { entityMaps[r.id] = r; });
      }

      // customer_detail_edits → customer_detail_edit_requests (join customer info and branches)
      if (grouped.customer_detail_edits?.length) {
        const { data } = await supabase
          .from("customer_detail_edit_requests")
          .select("*, customer:customers(Firstname, Middlename, Surname, mobile, branches(name)), created_by_user:users!created_by(full_name)")
          .in("id", grouped.customer_detail_edits);
        (data || []).forEach(r => { entityMaps[r.id] = r; });
      }

      // customer_transfer → customer_transfer_requests
      if (grouped.customer_transfer?.length) {
        const { data } = await supabase
          .from("customer_transfer_requests")
          .select(`
            *,
            current_branch:current_branch_id(name),
            new_branch:new_branch_id(name),
            branch_manager:branch_manager_id(full_name),
            transfer_items:customer_transfer_items(
              customer:customer_id(*, branches(name))
            )
          `)
          .in("id", grouped.customer_transfer);
        (data || []).forEach(r => { entityMaps[r.id] = r; });
      }

      // 4. Enrich instances with entity data and authorization check
      const enriched = (instanceData || []).map(inst => {
        const parsedInstance = { ...inst, current_node: inst.workflow_nodes };
        const isAuthorized = isUserAuthorized(parsedInstance);
        const entity = entityMaps[inst.entity_id] || null;
        return { ...inst, entity, isAuthorized };
      }).filter(i => i.isAuthorized && i.entity);

      setInstances(enriched);
      setFilteredInstances(enriched);
    } catch (err) {
      console.error("Error fetching approvals:", err);
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

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    const filtered = instances.filter(inst => {
      const info = getCustomerInfo(inst);
      const step = (inst.workflow_nodes?.name || "").toLowerCase();
      const wfName = (inst.workflow_definitions?.name || "").toLowerCase();
      return (
        info.displayName.toLowerCase().includes(lower) ||
        info.mobile.toLowerCase().includes(lower) ||
        info.branchName.toLowerCase().includes(lower) ||
        info.officerName.toLowerCase().includes(lower) ||
        step.includes(lower) ||
        wfName.includes(lower)
      );
    });
    setFilteredInstances(filtered);
    setCurrentPage(1);
  }, [searchTerm, instances]);

  const totalPages = Math.ceil(filteredInstances.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentInstances = filteredInstances.slice(startIndex, startIndex + itemsPerPage);

  if (!profile) return (
    <div className="min-h-screen bg-muted p-6 flex items-center justify-center">
      <Spinner />
    </div>
  );

  return (
    <div className="h-full bg-muted text-gray-800 border-r border-gray-200 p-6 min-h-screen font-outfit">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1 tracking-wide">Registry / Pending Approvals</h1>
          <p className="text-[10px] text-slate-400">All workflow tasks awaiting your action</p>
        </div>
        <div className="text-xs text-brand-primary">
          <span className="font-semibold">{filteredInstances.length}</span> pending tasks
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="relative w-72">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID or step..."
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Mobile</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Officer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Current Step</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentInstances.map((inst) => {
                  const config = ENTITY_CONFIG[inst.entity_type];
                  if (!config) return null;
                  const { displayName, branchName, mobile, officerName } = getCustomerInfo(inst);
                  const ActionIcon = config.actionIcon;
                  return (
                    <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">{displayName}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">{mobile}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">{officerName}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">{branchName}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {inst.workflow_nodes?.name || "Active Review"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(config.getViewRoute(inst))}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                            title="View"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => navigate(config.getActionRoute(inst))}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                          >
                            <ActionIcon className="h-3.5 w-3.5" />
                            {config.actionLabel}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {filteredInstances.length === 0 && !loading && (
          <div className="p-10 text-center">
            <ClipboardDocumentCheckIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-700 mb-1">No pending approvals</h3>
            <p className="text-xs text-gray-500">You are all caught up!</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredInstances.length)} of {filteredInstances.length}
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1.5 rounded-lg border text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setCurrentPage(n)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${currentPage === n ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingApprovals;


