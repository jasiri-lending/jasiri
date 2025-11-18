import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Loader2, Plus, Calendar , ArrowLeftIcon } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const PromiseToPay = ({ customer }) => {
  const [ptps, setPtps] = useState([]);
    const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [formData, setFormData] = useState({
    loan_id: "",
    installment_id: "",
    promised_amount: "",
    promised_date: "",
    remarks: "",
  });

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("id, full_name, role")
          .eq("auth_id", user.id)
          .single();
        setCurrentUser(data);
      }
    };
    fetchUser();
  }, []);

  // Fetch PTPs for customer
  const fetchPTPs = async () => {
    try {
      const { data, error } = await supabase
        .from("promise_to_pay")
        .select(`
          id,
          promised_amount,
          promised_date,
          remarks,
          status,
          created_at,
          loan_id,
          installment_id,
          created_by,
          loans:promise_to_pay_loan_id_fkey (
            id,
            total_payable
          ),
          loan_installments:promise_to_pay_installment_id_fkey (
            id,
            installment_number,
            amount_due
          ),
          users:promise_to_pay_created_by_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPtps(data || []);
    } catch (err) {
      console.error("Error fetching PTPs:", err);
      toast.error("Failed to fetch promises");
    }
  };

  // Fetch customer loans and PTPs
  useEffect(() => {
    if (!customer) {
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchLoans(), fetchPTPs()]);
      setLoading(false);
    };
    
    fetchData();
  }, [customer]);

  // Fetch customer's disbursed loans
  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from("loans")
        .select("id, loan_amount, disbursement_date, status")
        .eq("customer_id", customer.id)
        .eq("status", "disbursed")
        .order("disbursement_date", { ascending: false });

      if (error) throw error;
      setLoans(data || []);
      
      // Auto-select first loan if available
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, loan_id: data[0].id }));
        fetchInstallments(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching loans:", err);
      toast.error("Failed to fetch loans");
    }
  };

  // Fetch installments for selected loan
  const fetchInstallments = async (loanId) => {
    try {
      const { data, error } = await supabase
        .from("loan_installments")
        .select("id, installment_number, amount_due, due_date, status")
        .eq("loan_id", loanId)
        .in("status", ["pending", "overdue", "partial"])
        .order("installment_number");

      if (error) throw error;
      setInstallments(data || []);
    } catch (err) {
      console.error("Error fetching installments:", err);
    }
  };

  // Handle loan selection change
  const handleLoanChange = (loanId) => {
    setFormData(prev => ({ 
      ...prev, 
      loan_id: loanId,
      installment_id: "" // Reset installment when loan changes
    }));
    if (loanId) {
      fetchInstallments(loanId);
    } else {
      setInstallments([]);
    }
  };

  // Create new PTP
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.loan_id || !formData.promised_amount || !formData.promised_date) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("promise_to_pay")
        .insert([
          {
            customer_id: customer.id,
            loan_id: formData.loan_id,
            installment_id: formData.installment_id || null,
            promised_amount: parseFloat(formData.promised_amount),
            promised_date: formData.promised_date,
            remarks: formData.remarks,
            created_by: currentUser?.id,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success("Promise to Pay recorded successfully!");
      setShowForm(false);
      setFormData({
        loan_id: loans[0]?.id || "",
        installment_id: "",
        promised_amount: "",
        promised_date: "",
        remarks: "",
      });
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
      fetchPTPs(); // refresh list
    } catch (err) {
      console.error("Error updating PTP status:", err);
      toast.error("Failed to update status");
    }
  };

  const getStatusBadge = (status) => {
    const base = "px-2 py-1 text-xs font-semibold rounded-full";
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

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">

          <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span className="font-medium">Back to Customers</span>
        </button>
      </div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Promise To Pay History</h3>
          <p className="text-sm text-gray-600 mt-1">
            Customer: {customer?.Firstname} {customer?.Surname}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <Plus className="h-5 w-5" />
          New Promise
        </button>
      </div>

      {/* Create PTP Form */}
      {showForm && (
        <div className="bg-gray-50 border rounded-lg p-6 mb-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">
            Record New Promise to Pay
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Loan Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Loan <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.loan_id}
                  onChange={(e) => handleLoanChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Select Loan --</option>
                  {loans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      Loan #{loan.id} - KES {loan.loan_amount?.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Installment Selection (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specific Installment (Optional)
                </label>
                <select
                  value={formData.installment_id}
                  onChange={(e) => setFormData({ ...formData, installment_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  disabled={!formData.loan_id}
                >
                  <option value="">-- All/General --</option>
                  {installments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      Installment #{inst.installment_number} - KES {inst.amount_due?.toLocaleString()} 
                      ({inst.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Promised Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promised Amount (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.promised_amount}
                  onChange={(e) => setFormData({ ...formData, promised_amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter amount"
                  required
                />
              </div>

              {/* Promised Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promised Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.promised_date}
                  onChange={(e) => setFormData({ ...formData, promised_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks/Notes
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                rows="3"
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Promise"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PTPs List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin h-6 w-6 text-indigo-600" />
        </div>
      ) : ptps.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No promises recorded yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Click "New Promise" to record a promise to pay.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Promised Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Loan/Installment
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Created By
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Remarks
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ptps.map((ptp) => (
                <tr key={ptp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(ptp.promised_date).toLocaleDateString("en-GB")}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    KES {ptp.promised_amount?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>
                      <div className="font-medium">
                        Loan #{ptp.loan_id}
                      </div>
                      {ptp.loan_installments && (
                        <div className="text-xs text-gray-500">
                          Installment #{ptp.loan_installments.installment_number}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>
                      <div className="font-medium">
                        {ptp.users?.full_name || "Unknown"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(ptp.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {ptp.remarks || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(ptp.status)}
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    {ptp.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateStatus(ptp.id, "kept")}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium transition"
                        >
                          Mark Kept
                        </button>
                        <button
                          onClick={() => updateStatus(ptp.id, "broken")}
                          className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium transition"
                        >
                          Mark Broken
                        </button>
                      </>
                    )}
                    {ptp.status !== "pending" && (
                      <span className="text-xs text-gray-500">No actions</span>
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
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 font-medium">Pending Promises</p>
            <p className="text-2xl font-bold text-yellow-900">
              {ptps.filter(p => p.status === "pending").length}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 font-medium">Kept Promises</p>
            <p className="text-2xl font-bold text-green-900">
              {ptps.filter(p => p.status === "kept").length}
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium">Broken Promises</p>
            <p className="text-2xl font-bold text-red-900">
              {ptps.filter(p => p.status === "broken").length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromiseToPay;