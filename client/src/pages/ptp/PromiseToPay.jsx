import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

const PromiseToPayList = ({ loanId }) => {
  const [ptps, setPtps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loanId) {
      setLoading(false);
      return;
    }
    fetchPTPs();
  }, [loanId]);

  const fetchPTPs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("promise_to_pay")
        .select(`
          id,
          promised_amount,
          promised_date,
          remarks,
          status,
          created_at,
          created_by,
          customer_id
        `)
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
        console.log("All PTPs in DB:", data, error);
        console.log("loanId being queried:", loanId);

      if (error) throw error;

      console.log("Fetched PTPs:", data);
      setPtps(data || []);
    } catch (err) {
      console.error("Error fetching PTPs:", err.message);
      toast.error("Failed to fetch PTPs");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from("promise_to_pay")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
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
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 mt-6">
      <h3 className="text-gray-600 mb-4">Promise To Pay History</h3>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin h-6 w-6 text-indigo-600" />
        </div>
      ) : ptps.length === 0 ? (
        <p className="text-gray-500 text-sm">No promises recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Customer ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Officer ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Remarks</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ptps.map((ptp) => (
                <tr key={ptp.id}>
                  <td className="px-4 py-3">
                    {new Date(ptp.promised_date).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    KES {ptp.promised_amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{ptp.customer_id || "N/A"}</td>
                  <td className="px-4 py-3">{ptp.created_by || "N/A"}</td>
                  <td className="px-4 py-3 text-gray-600">{ptp.remarks || "-"}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(ptp.status)}</td>
                  <td className="px-4 py-3 text-center space-x-2">
                    {ptp.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateStatus(ptp.id, "kept")}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs"
                        >
                          Mark Kept
                        </button>
                        <button
                          onClick={() => updateStatus(ptp.id, "broken")}
                          className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs"
                        >
                          Mark Broken
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PromiseToPayList;
