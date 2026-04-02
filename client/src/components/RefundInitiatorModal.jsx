import React, { useState, useEffect } from "react";
import { 
  X, 
  AlertCircle, 
  Loader2, 
  Banknote,
  Info,
  Calendar,
  User,
  ShieldCheck,
  Send,
  Wallet,
  Phone
} from "lucide-react";
import { apiFetch } from "../utils/api";
import { useAuth } from "../hooks/userAuth";
import { useToast } from "./Toast";
import { supabase } from "../supabaseClient";

const RefundInitiatorModal = ({ isOpen, onClose, customer, onSuccess, walletBalance }) => {
  const { profile } = useAuth();
  const { success, error: toastError, info } = useToast();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [totalRefundable, setTotalRefundable] = useState(0);

  // Fetch customer loans and wallet balance when modal opens
  useEffect(() => {
    if (isOpen && customer?.id) {
      fetchCustomerData();
    }
  }, [isOpen, customer]);

  const fetchCustomerData = async () => {
    try {
      setFetching(true);
      
      // Fetch loans directly using supabase to avoid 404 and maintain consistency
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("*")
        .eq("customer_id", customer.id);

      if (loansError) throw loansError;

      if (loansData) {
        const eligibleLoans = loansData.filter(l => {
          if (!l.processing_fee_paid) return false;
          const isDisbursed = l.status === 'disbursed';
          const isActiveRepayment = ['ongoing', 'partial', 'overdue', 'defaulted'].includes(l.repayment_state);
          if (isDisbursed && isActiveRepayment) return false;
          return true;
        });
        setLoans(eligibleLoans);
      }
    } catch (err) {
      console.error("Refund data fetch error:", err);
      toastError("Failed to fetch customer data for refund");
    } finally {
      setFetching(false);
    }
  };

  // Recalculate Total Refundable Assets whenever walletBalance or loans change
  useEffect(() => {
    const refundableFees = loans.reduce((sum, l) => sum + (Number(l.processing_fee) || 0), 0);
    setTotalRefundable(Number(walletBalance || 0) + refundableFees);
  }, [walletBalance, loans]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toastError("Please enter a valid amount");
      return;
    }

    if (Number(amount) > totalRefundable) {
      toastError(`Amount exceeds total refundable assets (Max: KES ${totalRefundable.toLocaleString()})`);
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch("/api/refunds/initiate", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customer.id,
          loan_id: selectedLoanId || null,
          amount: Number(amount),
          reason,
          tenant_id: profile.tenant_id
        })
      });

      const data = await res.json();
      if (data.success) {
        success("Refund request submitted to queue successfully.");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toastError(data.error || "Failed to initiate refund request.");
      }
    } catch (err) {
      console.error("Refund submission error:", err);
      toastError("A system error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop - Subtle & No Blur */}
      <div 
        className="absolute inset-0 bg-slate-900/10 transition-opacity duration-300" 
        onClick={onClose}
      />
      
      {/* Centered Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - Sleek & Compact */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/5 rounded-xl flex items-center justify-center">
              <Banknote className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-sm  text-brand-primary uppercase tracking-tight">Initiate Refund</h2>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-0.5">Maker Workflow</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-brand-primary transition-colors hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Customer Summary Card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200/50">
                <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center text-[10px] font-black uppercase">
                  {customer.Firstname?.[0]}{customer.Surname?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-brand-primary truncate uppercase">{customer.Firstname} {customer.Surname}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">ID: {customer.id_number}</p>
                    <div className="flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-gray-400" />
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">{customer.mobile}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Wallet Balance</span>
                </div>
                <span className="text-sm font-black text-emerald-600">KES {walletBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Display Total Refundable Assets */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-black text-blue-800 uppercase tracking-tight">Total Refundable Assets</span>
                </div>
                <span className="text-xs font-black text-blue-700">KES {totalRefundable.toLocaleString()}</span>
              </div>

              {/* Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1.5 block">Refund Amount (KES)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    max={Math.min(walletBalance, totalRefundable)}
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-gray-200 px-4 py-3 rounded-xl text-sm font-black text-brand-primary focus:ring-2 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all placeholder:text-gray-200"
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                   <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase">Verified Source</span>
                   </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1.5 block">Internal Justification</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="Explain why this refund is being initiated..."
                  className="w-full bg-slate-50 border border-gray-200 px-4 py-3 rounded-xl text-[11px] font-medium min-h-[100px] focus:ring-2 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all placeholder:text-gray-300 leading-relaxed"
                />
              </div>
            </div>

          
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-slate-50/50 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white text-gray-500 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-brand-primary hover:border-brand-primary/30 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || fetching}
            className="flex-[2] bg-brand-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Processing..." : "Submit Refund"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundInitiatorModal;
