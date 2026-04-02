import React, { useState } from "react";
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle,
  User,
  Banknote,
  ShieldCheck,
  Phone
} from "lucide-react";
import { apiFetch } from "../utils/api";
import { useToast } from "./Toast";

const RefundProcessModal = ({ isOpen, onClose, refund, onSuccess }) => {
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  if (!isOpen || !refund) return null;

  const handleApprove = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/refunds/approve/${refund.id}`, { 
        method: "POST" 
      });
      const data = await res.json();
      
      if (data.success) {
        success("Refund approved and B2C initiated successfully");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toastError(data.error || "Approval failed");
      }
    } catch (err) {
      toastError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toastError("Please provide a reason for rejection");
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch(`/api/refunds/reject/${refund.id}`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await res.json();
      
      if (data.success) {
        success("Refund request rejected");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toastError(data.error || "Rejection failed");
      }
    } catch (err) {
      toastError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/10 transition-opacity duration-300" 
        onClick={onClose}
      />
      
      {/* Centered Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - Sleek & Compact */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/5 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-sm  text-brand-primary ">Process Refund</h2>
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
          {/* Customer Summary Card */}
          <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-brand-primary/10">
              <div className="w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center text-[10px] font-black uppercase">
                {refund.customers?.Firstname?.[0]}{refund.customers?.Surname?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className=" text-slate-600 font-semibold text-sm truncate">
                  {refund.customers?.Firstname} {refund.customers?.Surname}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-[9px] text-brand-primary/60 ">ID: {refund.customers?.id_number}</p>
                  <div className="flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5 text-brand-primary/40" />
                    <p className="text-[9px] text-brand-primary/60  ">{refund.customers?.mobile}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-brand-primary/70">
                <Banknote className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Requested Amount</span>
              </div>
              <span className="text-lg font-semibold text-brand-primary">KES {Number(refund.amount).toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Request Context */}
            <div className="p-4 bg-slate-50 border border-gray-100 rounded-xl">
              <p className="text-slate text-sm mb-1">Reason for Refund</p>
              <p className="text-xs text-brand-primary/80 italic font-medium leading-relaxed">
                "{refund.reason || 'No reason specified'}"
              </p>
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2">
                <div className="w-4 h-4 bg-brand-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-2 h-2 text-brand-primary" />
                </div>
                <p className="text-slate-600 font-semibold">
                  Initiated by {refund.initiator?.full_name || 'System User'}
                </p>
              </div>
            </div>

            {/* Rejection Field */}
            {isRejecting ? (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <label className="text-[9px] font-black text-red-600 uppercase tracking-widest block">Rejection Justification</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Why are you rejecting this request?"
                  required
                  className="w-full bg-red-50 border border-red-100 p-4 rounded-xl text-[11px] font-medium min-h-[80px] focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder:text-red-200"
                />
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-[9px] font-bold text-amber-800 uppercase tracking-tight leading-tight">
                  Approving this will trigger an immediate M-Pesa disbursement to the customer's wallet.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-slate-50/50 flex gap-3">
          {isRejecting ? (
            <>
              <button
                onClick={() => setIsRejecting(false)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-white text-gray-500 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-brand-primary hover:border-brand-primary/30 transition-all disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectionReason.trim()}
                className="flex-[2] bg-red-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {loading ? "PROCESSING..." : "CONFIRM REJECT"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsRejecting(true)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-white text-gray-400 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-red-600 hover:border-red-100 transition-all disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-[2] bg-brand-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {loading ? "INITIATING..." : "APPROVE & PAY"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefundProcessModal;
