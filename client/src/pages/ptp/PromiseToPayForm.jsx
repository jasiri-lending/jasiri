import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/userAuth";

const PromiseToPayForm = ({ loan, customer, createdBy, onClose }) => {
  const { profile } = useAuth();
  const [promisedAmount, setPromisedAmount] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!promisedAmount || !promisedDate) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from("promise_to_pay").insert([
        {
          loan_id: loan.id,
          customer_id: customer.id,
          promised_amount: promisedAmount,
          promised_date: promisedDate,
          created_by: createdBy,
          remarks,
          tenant_id: profile?.tenant_id,
        },
      ]);

      if (error) throw error;

      toast.success("Promise to Pay recorded successfully ");
      onClose();
    } catch (error) {
      console.error("Error creating PTP:", error);
      toast.error("Failed to record Promise to Pay ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-600 mb-4">
          New Promise To Pay
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Autofilled Info */}
          <div className="bg-gray-50 p-3 rounded-lg border">
            <p className="text-sm text-gray-600">
              <strong>Customer:</strong> {customer?.Firstname} {customer?.Surname}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Loan ID:</strong> {loan?.id}
            </p>
            {/* <p className="text-sm text-gray-600">
              <strong>Officer:</strong> {createdBy}
            </p> */}
          </div>

          {/* Promised Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Promised Amount (KES)
            </label>
            <input
              type="number"
              value={promisedAmount}
              onChange={(e) => setPromisedAmount(e.target.value)}
              className="mt-1 block w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          {/* Promised Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Promised Date
            </label>
            <input
              type="date"
              value={promisedDate}
              onChange={(e) => setPromisedDate(e.target.value)}
              className="mt-1 block w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Remarks
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1 block w-full border rounded-lg px-3 py-2"
              placeholder="e.g. Customer promised to pay after salary on 15th..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromiseToPayForm;
