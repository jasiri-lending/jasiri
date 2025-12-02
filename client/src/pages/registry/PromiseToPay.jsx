import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Loader2, Plus, Calendar, ArrowLeftIcon, User, Phone, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/userAuth.js";

const PromiseToPay = () => {
  const { customerId } = useParams();
  const [searchParams] = useSearchParams();
  const loan_id = searchParams.get('loan_id');
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [customer, setCustomer] = useState(null);
  const [ptps, setPtps] = useState([]);
  const [loanDetails, setLoanDetails] = useState(null);
  const [paymentStats, setPaymentStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
      const [newInteraction, setNewInteraction] = useState({
        interaction_type: "",
      });
  
  
  const [formData, setFormData] = useState({
    promised_amount: "",
    promised_date: "",
    remarks: "",
  });

  // Fetch customer details
  const fetchCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, Firstname, Surname, Middlename, mobile, id_number")
        .eq("id", customerId)
        .single();

      if (error) throw error;
      setCustomer(data);
    } catch (err) {
      console.error("Error fetching customer:", err);
      toast.error("Failed to fetch customer details");
    }
  };

  // Fetch PTPs for customer and loan
  const fetchPTPs = async () => {
    try {
      const { data, error } = await supabase
        .from("promise_to_pay")
        .select(`
          id,
                    interaction_type,

          promised_amount,
          promised_date,
          remarks,
          status,
          created_at,
          loan_id,
          created_by,
          users:promise_to_pay_created_by_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('customer_id', customerId)
        .eq('loan_id', loan_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPtps(data || []);
    } catch (err) {
      console.error("Error fetching PTPs:", err);
      toast.error("Failed to fetch promises");
    }
  };

  // Fetch loan details and calculate payment statistics
  const fetchLoanData = async () => {
    try {
      // Fetch loan details
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .select(`
          id, 
          scored_amount,
          disbursed_at,
          status, 
          total_payable,
          repayment_state
        `)
        .eq("id", loan_id)
        .single();

      if (loanError) throw loanError;
      setLoanDetails(loan);

      // Fetch installments to calculate total paid and outstanding
      const { data: installments, error: instError } = await supabase
        .from("loan_installments")
        .select(`
          id,
          due_amount,
          paid_amount,
          principal_paid,
          interest_paid,
          status
        `)
        .eq("loan_id", loan_id);

      if (instError) throw instError;

      // Calculate payment statistics
      const totalPaid = installments.reduce((sum, inst) => 
        sum + (parseFloat(inst.paid_amount) || 0), 0
      );
      
      const totalPrincipalPaid = installments.reduce((sum, inst) => 
        sum + (parseFloat(inst.principal_paid) || 0), 0
      );
      
      const totalInterestPaid = installments.reduce((sum, inst) => 
        sum + (parseFloat(inst.interest_paid) || 0), 0
      );

      const outstandingBalance = (parseFloat(loan.total_payable) || 0) - totalPaid;

      setPaymentStats({
        totalPaid,
        totalPrincipalPaid,
        totalInterestPaid,
        outstandingBalance,
        totalDue: parseFloat(loan.total_payable) || 0
      });

    } catch (err) {
      console.error("Error fetching loan data:", err);
      toast.error("Failed to fetch loan information");
    }
  };

  // Fetch all data
  useEffect(() => {
    if (!customerId || !loan_id) {
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchCustomer(), fetchLoanData(), fetchPTPs()]);
      setLoading(false);
    };
    
    fetchData();
  }, [customerId, loan_id]);

  // Create new PTP
 const handleSubmit = async (e) => {
  e.preventDefault();

  if (!formData.promised_amount || !formData.promised_date) {
    toast.error("Please fill in all required fields");
    return;
  }

  if (!newInteraction.interaction_type) {
    toast.error("Please select an interaction type");
    return;
  }

  if (!profile?.id) {
    toast.error("User not authenticated");
    return;
  }

  try {
    setSaving(true);

    const { error } = await supabase
      .from("promise_to_pay")
      .insert([
        {
          customer_id: parseInt(customerId),
          loan_id: parseInt(loan_id),
          installment_id: null,
          promised_amount: parseFloat(formData.promised_amount),
          promised_date: formData.promised_date,
          remarks: formData.remarks,
          created_by: profile.id,
          status: "pending",

          // ✅ ADD THIS
          interaction_type: newInteraction.interaction_type,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    toast.success("Promise to Pay recorded successfully!");
    setShowForm(false);

    // Reset form
    setFormData({
      promised_amount: "",
      promised_date: "",
      remarks: "",
    });
    setNewInteraction({ interaction_type: "" });

    fetchPTPs(); // Refresh list

  } catch (err) {
    console.error("Error creating PTP:", err);
    toast.error("Failed to create Promise to Pay");
  } finally {
    setSaving(false);
  }
};


  // Update PTP status
  const updateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from("promise_to_pay")
        .update({ 
          status: newStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Promise marked as ${newStatus}`);
      fetchPTPs();
    } catch (err) {
      console.error("Error updating PTP status:", err);
      toast.error("Failed to update status");
    }
  };

  const getStatusBadge = (status) => {
    const base = "px-3 py-1 text-xs font-semibold rounded-full";
    switch (status) {
      case "pending":
        return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case "kept":
        return <span className={`${base} bg-green-100 text-green-800`}>Kept</span>;
      case "broken":
        return <span className={`${base} bg-red-100 text-red-800`}>Broken</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-800`}>Unknown</span>;
    }
  };

  if (!loan_id || !customerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center py-12">
            <p className="text-red-500 font-medium text-lg">Error: Missing required information</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin h-12 w-12 text-indigo-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 px-4 py-2 rounded-lg hover:bg-white/60 transition"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span className="font-medium">Back to Customers</span>
        </button>

        {/* Customer & Loan Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <h2 className="text-sm  text-gray-800 mb-6">Promise to Pay Management</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Customer Info */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-blue-600" />
                <h3 className=" text-gray-700">Customer</h3>
              </div>
              <p className="text-base font-bold text-slate-600 truncate" title={`${customer?.Firstname} ${customer?.Middlename || ''} ${customer?.Surname}`}>
                {customer?.Firstname} {customer?.Middlename} {customer?.Surname}
              </p>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                <span>{customer?.mobile || "N/A"}</span>
              </div>
            </div>

            {/* Loan Info */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-gray-700">Loan Amount</h3>
              </div>
              <p className="text-sm text-gray-600">Loan ID: #{loanDetails?.id}</p>
              <p className="text-lg text-slate-600 mt-1">
                KES {loanDetails?.scored_amount?.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Disbursed: {loanDetails?.disbursed_at ? new Date(loanDetails.disbursed_at).toLocaleDateString("en-GB") : "N/A"}
              </p>
            </div>

            {/* Total Paid */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-700">Total Paid</h3>
              </div>
              <p className="text-xl font-bold text-green-600">
                KES {paymentStats?.totalPaid?.toLocaleString() || "0"}
              </p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                <p>Principal: KES {paymentStats?.totalPrincipalPaid?.toLocaleString() || "0"}</p>
                <p>Interest: KES {paymentStats?.totalInterestPaid?.toLocaleString() || "0"}</p>
              </div>
            </div>

            {/* Outstanding Balance */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-gray-700">Outstanding</h3>
              </div>
              <p className="text-xl font-bold text-red-600">
                KES {paymentStats?.outstandingBalance?.toLocaleString() || "0"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Total Due: KES {paymentStats?.totalDue?.toLocaleString() || "0"}
              </p>
              <p className="text-xs text-gray-600 mt-1 font-medium">
                Progress: {paymentStats?.totalDue > 0 
                  ? ((paymentStats?.totalPaid / paymentStats?.totalDue) * 100).toFixed(1) 
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          {/* Header with New Promise Button */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm  text-slate-600">Promise History</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md hover:shadow-lg"
            >
              <Plus className="h-5 w-5" />
              New Promise
            </button>
          </div>

          {/* Create PTP Form */}
          {showForm && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-6 mb-6 shadow-inner">
              <h4 className="text-lg  text-slate-600 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Record New Promise to Pay
              </h4>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Promised Amount */}
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-2">
    Interaction Type <span className="text-red-500">*</span>
  </label>

  <select
    value={newInteraction.interaction_type}
    onChange={(e) =>
      setNewInteraction({
        ...newInteraction,
        interaction_type: e.target.value,
      })
    }
    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-700 
               focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
    required
  >
    <option value="">Select Type</option>
    <option value="Call">Call</option>
    <option value="SMS">SMS</option>
    <option value="Meeting">Meeting</option>
    <option value="Email">Email</option>
    <option value="Follow-up">Follow-up</option>
  </select>
</div>

                  {/* Promised Amount */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Promised Amount (KES) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.promised_amount}
                      onChange={(e) => setFormData({ ...formData, promised_amount: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                      placeholder="Enter amount"
                      required
                    />
                  </div>

                  {/* Promised Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Promised Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.promised_date}
                      onChange={(e) => setFormData({ ...formData, promised_date: e.target.value })}
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Remarks/Notes
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    rows="3"
                    placeholder="Add any additional notes..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
                  >
                    {saving ? "Saving..." : "Save Promise"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PTPs List */}
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
            </div>
          ) : ptps.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium text-lg">No promises recorded yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Click "New Promise" above to record a promise to pay
              </p>
            </div>
          ) : (
         <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
      <tr>
        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Promised Date</th>
        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Amount</th>
        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Created By</th>
        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Interaction Type</th>
        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap min-w-[300px]">Remarks</th>
        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {ptps.map((ptp) => (
        <tr key={ptp.id} className="hover:bg-gray-50 transition">
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-900">
                {new Date(ptp.promised_date).toLocaleDateString("en-GB")}
              </span>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className="text-sm font-bold text-gray-900">
              KES {ptp.promised_amount?.toLocaleString()}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {ptp.users?.full_name || "Unknown"}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(ptp.created_at).toLocaleDateString("en-GB")}
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
            {ptp.interaction_type || "N/A"}
          </td>
          <td className="px-6 py-4 max-w-md">
            <div className="text-sm text-gray-600 line-clamp-3 overflow-hidden" title={ptp.remarks}>
              {ptp.remarks || "-"}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-center">
            {getStatusBadge(ptp.status)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-center">
            {ptp.status === "pending" ? (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => updateStatus(ptp.id, "kept")}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold transition shadow hover:shadow-md"
                >
                  Mark Kept
                </button>
                <button
                  onClick={() => updateStatus(ptp.id, "broken")}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold transition shadow hover:shadow-md"
                >
                  Mark Broken
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-500 italic">No actions</span>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
          )}

          {/* Summary Stats */}
          {ptps.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-yellow-800 font-semibold mb-1">Pending Promises</p>
                <p className="text-3xl font-bold text-yellow-900">
                  {ptps.filter(p => p.status === "pending").length}
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-green-800 font-semibold mb-1">Kept Promises</p>
                <p className="text-3xl font-bold text-green-900">
                  {ptps.filter(p => p.status === "kept").length}
                </p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-red-800 font-semibold mb-1">Broken Promises</p>
                <p className="text-3xl font-bold text-red-900">
                  {ptps.filter(p => p.status === "broken").length}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromiseToPay;