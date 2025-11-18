import React, { useState } from "react";
import { supabase } from "../../supabaseClient";

const TraceMpesaTransaction = () => {
  const [reference, setReference] = useState("");
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setTransaction(null);

    if (!reference.trim()) {
      setErrorMsg("Please enter a valid M-Pesa transaction code.");
      return;
    }

    try {
      setLoading(true);

      // Search in C2B transactions table
     const { data: c2bData, error: c2bError } = await supabase
  .from("mpesa_c2b_transactions")
  .select(`
    id,
    transaction_id,
    amount,
    transaction_time,
    phone_number,
    status,
    applied_amount,
    loan_id,
    loan:loan_id(
      id,
     product_type,
      customer:customer_id(
        Firstname,
        Middlename,
        Surname,
        id_number
      )
    )
  `)
  .eq("transaction_id", reference)
  .single();


      if (c2bError && c2bError.code !== "PGRST116") throw c2bError;

      if (c2bData) {
        setTransaction({
          source: "C2B",
          ...c2bData,
        });
      } else {
        // If not found in C2B, check B2C transactions
      const { data: b2cData, error: b2cError } = await supabase
  .from("mpesa_b2c_transactions")
  .select(`
    id,
    transaction_id,
    amount,
    created_at as transaction_time,
    phone_number,
    status,
    failure_reason,
    loan:loan_id(
      id,
      product_type,
      customer:customer_id(
        Firstname,
        Middlename,
        Surname,
        id_number
      )
    )
  `)
  .eq("transaction_id", reference)
  .single();


        if (b2cError && b2cError.code !== "PGRST116") throw b2cError;

        if (b2cData) {
          setTransaction({
            source: "B2C",
            ...b2cData,
          });
        } else {
          setErrorMsg("Transaction not found in the system.");
        }
      }
    } catch (err) {
      console.error("Error tracing transaction:", err.message);
      setErrorMsg("An error occurred while fetching transaction data.");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get status badge styling
  const getStatusBadge = (status, source) => {
    const baseClasses = "px-2 py-1 rounded text-xs font-semibold";
    
    switch (status?.toLowerCase()) {
      case 'success':
      case 'applied':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md">
      <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Trace M-Pesa Transaction</h2>

      <form onSubmit={handleSearch} className="mb-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Enter M-Pesa Transaction Code (e.g., QEF2S7J8Z4)"
          className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:ring focus:ring-blue-200"
        />
        <button
          type="submit"
          disabled={loading}
   className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                style={{ backgroundColor: "#586ab1" }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-700 font-medium">{errorMsg}</p>
        </div>
      )}

      {transaction && (
        <div className="space-y-4">
          {/* Transaction Details Card */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-3">Transaction Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Transaction ID</label>
                <p className="font-mono text-sm">{transaction.transaction_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Source</label>
                <p className={`px-2 py-1 rounded text-xs font-semibold ${
                  transaction.source === 'C2B' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {transaction.source}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <span className={getStatusBadge(transaction.status, transaction.source)}>
                  {transaction.status?.toUpperCase() || "UNKNOWN"}
                </span>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Amount</label>
                <p className="text-lg font-bold text-green-600">
                  KES {transaction.amount?.toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Phone Number</label>
                <p className="font-medium">{transaction.phone_number || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Transaction Time</label>
                <p className="text-sm">
                  {transaction.transaction_time
                    ? new Date(transaction.transaction_time).toLocaleString()
                    : "N/A"}
                </p>
              </div>
              {transaction.applied_amount && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Applied Amount</label>
                  <p className="text-sm font-semibold">
                    KES {transaction.applied_amount?.toLocaleString()}
                  </p>
                </div>
              )}
              {transaction.failure_reason && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-600">Failure Reason</label>
                  <p className="text-sm text-red-600">{transaction.failure_reason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Details Card */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-3">Customer Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Customer Name</label>
             <p className="font-medium">
  {[
    transaction.loan?.customer?.Firstname,
    transaction.loan?.customer?.Middlename,
    transaction.loan?.customer?.Surname
  ]
    .filter(Boolean)
    .join(" ") || "N/A"}
</p>

              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">ID Number</label>
<p className="font-mono text-sm">
  {transaction.loan?.customer?.id_number || "N/A"}
</p>

              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Loan ID</label>
             <p className="text-sm">{transaction.loan?.id || "N/A"}</p>
              </div>
              {transaction.loan && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Loan Product</label>
                  <p className="text-sm">{transaction.loan.product_type || "N/A"}</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Details Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-left">Field</th>
                  <th className="px-4 py-2 border text-left">Value</th>
                  <th className="px-4 py-2 border text-left">Field</th>
                  <th className="px-4 py-2 border text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2 border font-medium">Transaction ID</td>
                  <td className="px-4 py-2 border font-mono">{transaction.transaction_id}</td>
                  <td className="px-4 py-2 border font-medium">Source</td>
                  <td className="px-4 py-2 border">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      transaction.source === 'C2B' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {transaction.source}
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2 border font-medium">Amount</td>
                  <td className="px-4 py-2 border font-bold text-green-600">
                    KES {transaction.amount?.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 border font-medium">Status</td>
                  <td className="px-4 py-2 border">
                    <span className={getStatusBadge(transaction.status, transaction.source)}>
                      {transaction.status?.toUpperCase() || "UNKNOWN"}
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2 border font-medium">Phone Number</td>
                  <td className="px-4 py-2 border">{transaction.phone_number || "N/A"}</td>
                  <td className="px-4 py-2 border font-medium">Transaction Time</td>
                  <td className="px-4 py-2 border">
                    {transaction.transaction_time
                      ? new Date(transaction.transaction_time).toLocaleString()
                      : "N/A"}
                  </td>
                </tr>
                {transaction.applied_amount && (
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 border font-medium">Applied Amount</td>
                    <td className="px-4 py-2 border font-semibold">
                      KES {transaction.applied_amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 border font-medium">Loan ID</td>
                    <td className="px-4 py-2 border">{transaction.loan_id || "N/A"}</td>
                  </tr>
                )}
                {transaction.failure_reason && (
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 border font-medium text-red-600">Failure Reason</td>
                    <td className="px-4 py-2 border text-red-600" colSpan="3">
                      {transaction.failure_reason}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TraceMpesaTransaction;