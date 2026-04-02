import React, { useState, useEffect, useMemo } from "react";
import { 
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  BanknotesIcon,
  UserIcon,
  CalendarIcon,
  ChatBubbleLeftEllipsisIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import { apiFetch } from "../../utils/api";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import Spinner from "../../components/Spinner";
import RefundProcessModal from "../../components/RefundProcessModal";

const RefundApprovals = () => {
  const { profile } = useAuth();
  const { error: toastError } = useToast();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);

  const fetchPendingRefunds = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/refunds/pending?tenant_id=${profile.tenant_id}`);
      const data = await res.json();
      if (data.success) {
        setRefunds(data.data);
      }
    } catch (err) {
      toastError("Failed to fetch pending refunds");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchPendingRefunds();
    }
  }, [profile]);

  const filteredRefunds = useMemo(() => {
    return refunds.filter(r => {
      const customerName = `${r.customers?.Firstname || ""} ${r.customers?.Surname || ""}`.toLowerCase();
      const initiatorName = (r.initiator?.full_name || "").toLowerCase();
      return customerName.includes(searchTerm.toLowerCase()) || 
             initiatorName.includes(searchTerm.toLowerCase()) ||
             (r.customers?.mobile || "").includes(searchTerm);
    });
  }, [refunds, searchTerm]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-muted p-6 min-h-screen flex items-center justify-center">
        <Spinner text="Loading refund queue..." />
      </div>
    );
  }

  return (
    <div className="bg-muted transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1 font-medium tracking-wide">
            Registry / Refund Queue
          </h1>
        </div>
        <div className="text-xs text-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm bg-brand-primary">
          <span className="font-medium text-white">{filteredRefunds.length}</span> pending requests
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Search and Filters Header */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by customer name, mobile, or initiator..."
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

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchPendingRefunds}
                  className="px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-all duration-200 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:text-gray-900"
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          {filteredRefunds.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <InformationCircleIcon className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No Pending Refunds</h3>
              <p className="text-xs text-slate-400 mt-1 uppercase font-black opacity-50 tracking-tighter">Queue clear</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ backgroundColor: '#E7F0FA' }}>
                  <th className="px-4 py-3  text-xs   whitespace-nowrap text-slate-600">
                    Customer
                  </th>
                    <th className="px-4 py-3  text-xs   whitespace-nowrap text-slate-600">
                    Phone Number
                  </th>
                  <th className="px-4 py-3  text-xs whitespace-nowrap text-slate-600">
                    Amount
                  </th>
                  <th className="px-4 py-3  text-xs whitespace-nowrap text-slate-600">
                    Reason / Justification
                  </th>
                  <th className="px-4 py-3  text-xs whitespace-nowrap text-slate-600">
                    Initiator
                  </th>
                  <th className="px-4 py-3  text-xs whitespace-nowrap text-slate-600">
                    Request Date
                  </th>
                  <th className="px-4 py-3  text-xs whitespace-nowrap text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRefunds.map((refund, index) => {
                  const fullName = `${refund.customers?.Firstname || ""} ${refund.customers?.Surname || ""}`.trim();

                  return (
                    <tr
                      key={refund.id}
                      className={`border-b transition-colors hover:bg-gray-50/80 ${index % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-brand-primary/10 rounded-full flex items-center justify-center text-[10px] font-black text-brand-primary uppercase">
                            {refund.customers?.Firstname?.[0]}{refund.customers?.Surname?.[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-700">{fullName}</span>
                          </div>
                        </div>
                      </td>

                       <td className="px-4 py-3 whitespace-nowrap">
                                                  <span className="text-sm text-slate-600">{refund.customers?.mobile}</span>

                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-600">
                          {formatCurrency(refund.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-start gap-2">
                          <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-slate-500 italic font-medium line-clamp-1 group-hover:line-clamp-none transition-all" title={refund.reason}>
                            {refund.reason || "No reason provided"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600">
                            {refund.initiator?.full_name || "System"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-500 tracking-tight">
                            {new Date(refund.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => {
                            setSelectedRefund(refund);
                            setShowProcessModal(true);
                          }}
                          className="px-4 py-1.5 bg-brand-primary text-white rounded-lg text-sm hover:bg-brand-secondary shadow-md shadow-brand-primary/10 transition-all flex items-center justify-center gap-1.5 mx-auto"
                        >
                          <BanknotesIcon className="w-3.5 h-3.5" />
                          Process
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Processing Modal */}
      <RefundProcessModal
        isOpen={showProcessModal}
        onClose={() => {
          setShowProcessModal(false);
          setSelectedRefund(null);
        }}
        refund={selectedRefund}
        onSuccess={fetchPendingRefunds}
      />
    </div>
  );
};

export default RefundApprovals;
