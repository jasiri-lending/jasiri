import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import Spinner from "../../components/Spinner";
import { useAuth } from "../../hooks/userAuth";

const SuspensePaymentsReport = () => {
  const { profile } = useAuth();
  const [payments, setPayments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch suspense payments
  useEffect(() => {
    const fetchSuspensePayments = async () => {
      if (!profile?.tenant_id) return;
      try {
        setLoading(true);

        // Fetch unallocated or pending payments
        const { data, error } = await supabase
          .from("mpesa_c2b_transactions")
          .select(`
            id,
            TransID,
            TransAmount,
            MSISDN,
            BillRefNumber,
            TransTime,
            status,
            loan_id,
            customer_id,
            customers:customer_id (
              id,
              "Firstname",
              "Middlename",
              "Surname"
            )
          `)
          .is("loan_id", null)
          .eq("tenant_id", profile?.tenant_id)
          .order("TransTime", { ascending: false });

        if (error) throw error;

        const formatted = data.map((item, index) => {
          const customer = item.customers || {};
          const fullName = [customer.Firstname, customer.Middlename, customer.Surname]
            .filter(Boolean)
            .join(" ");

          return {
            no: index + 1,
            customerName: fullName || "Unmatched",
            accountCredited: item.BillRefNumber || "N/A",
            transactionId: item.TransID || "N/A",
            amount: item.TransAmount || 0,
            phoneNumber: item.MSISDN || "N/A",
            status: item.status || "Pending Allocation",
            paymentDate: item.TransTime
              ? new Date(item.TransTime).toLocaleString()
              : "N/A",
          };
        });

        setPayments(formatted);
        setFiltered(formatted);
      } catch (err) {
        console.error("Error fetching suspense payments:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSuspensePayments();
  }, [profile]);

  // Search filtering
  useEffect(() => {
    const lower = search.toLowerCase();
    const filteredData = payments.filter(
      (item) =>
        item.customerName.toLowerCase().includes(lower) ||
        item.transactionId.toLowerCase().includes(lower) ||
        item.phoneNumber.toLowerCase().includes(lower)
    );
    setFiltered(filteredData);
  }, [search, payments]);

  return (
    <div className="p-6 bg-white shadow rounded-2xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Suspense Payment Report
        </h2>
        <input
          type="text"
          placeholder="Search by customer or transaction ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded-lg w-72 focus:outline-none focus:ring focus:ring-indigo-200"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner text="Loading suspense payments..." />
        </div>
      ) : filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-indigo-100 text-gray-700">
              <tr>
                <th className="px-4 py-2 border">#</th>
                <th className="px-4 py-2 border">Customer Name</th>
                <th className="px-4 py-2 border">Account Credited</th>
                <th className="px-4 py-2 border">Transaction ID</th>
                <th className="px-4 py-2 border">Amount (KSh)</th>
                <th className="px-4 py-2 border">Phone Number</th>
                <th className="px-4 py-2 border">Status</th>
                <th className="px-4 py-2 border">Payment Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.transactionId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border text-center">{item.no}</td>
                  <td className="px-4 py-2 border">{item.customerName}</td>
                  <td className="px-4 py-2 border">{item.accountCredited}</td>
                  <td className="px-4 py-2 border">{item.transactionId}</td>
                  <td className="px-4 py-2 border text-right">
                    {item.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 border">{item.phoneNumber}</td>
                  <td
                    className={`px-4 py-2 border text-center font-medium ${item.status?.toLowerCase().includes("pending")
                      ? "text-yellow-600"
                      : "text-green-600"
                      }`}
                  >
                    {item.status}
                  </td>
                  <td className="px-4 py-2 border text-sm">
                    {item.paymentDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-6">
          No suspense payments found.
        </p>
      )}
    </div>
  );
};

export default SuspensePaymentsReport;
