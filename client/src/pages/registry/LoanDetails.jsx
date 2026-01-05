import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { BanknotesIcon, CreditCardIcon, ClockIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Spinner from "../../components/Spinner";

const LoanDetails = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loanDetails, setLoanDetails] = useState(null);
  const [loanInstallments, setLoanInstallments] = useState([]);
  const [loanPayments, setLoanPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Fetch customer data first
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .single();

        if (customerError) throw customerError;
        setCustomer(customerData);

        // Fetch loan details
        const { data: loan, error: loanError } = await supabase
          .from("loans")
          .select("*")
          .eq("customer_id", customerId)
          .eq("status", "disbursed")
          .maybeSingle();

        if (loanError) throw loanError;
        setLoanDetails(loan);

        // Fetch installments if loan exists
        if (loan?.id) {
          const { data: installments, error: installmentsError } = await supabase
            .from("loan_installments")
            .select("*")
            .eq("loan_id", loan.id)
            .order("installment_number", { ascending: true });

          if (installmentsError) throw installmentsError;
          setLoanInstallments(installments || []);

          // Fetch payments
          const { data: payments, error: paymentsError } = await supabase
            .from("loan_payments")
            .select("*")
            .eq("loan_id", loan.id)
            .order("paid_at", { ascending: false });

          if (paymentsError) throw paymentsError;
          setLoanPayments(payments || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (customerId) fetchAllData();
  }, [customerId]);

  const formatCurrency = (amount) => {
    const numAmount = Number(amount);
    return isNaN(numAmount) ? "KES 0.00" : `KES ${numAmount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return "Invalid Date";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "Invalid Date";
    }
  };

  const totalPaid = loanPayments.reduce((sum, payment) => sum + (Number(payment.paid_amount) || 0), 0);
  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
        <Spinner text="Loading ..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back
          </button>
          {customer && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {customer.first_name} {customer.last_name}
              </h1>
              <p className="text-gray-600 mt-1">{customer.phone_number}</p>
            </div>
          )}
        </div>

        {!loanDetails ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BanknotesIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No active loan</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Loan Summary Card */}
            <div className="bg-gradient-to-r from-blue-100 to-blue-100 rounded-lg p-6 text-slate-600 shadow-lg">
              <h3 className="text-xl font-semibold mb-2">Current Loan - {loanDetails.product_name || loanDetails.product}</h3>
              <p className="text-4xl font-bold">
                {formatCurrency(loanDetails.scored_amount)}
              </p>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-500 text-sm">Status</p>
                  <p className="font-semibold capitalize">{loanDetails.status}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Repayment State</p>
                  <p className="font-semibold capitalize">{loanDetails.repayment_state || "N/A"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Duration</p>
                  <p className="font-semibold">{loanDetails.duration_weeks || 0} weeks</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Product Type</p>
                  <p className="font-semibold capitalize">{loanDetails.product_type || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Loan Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow">
                <h4 className="font-semibold text-gray-900 mb-4">Loan Details</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Scored Amount</span>
                    <span className="font-medium">{formatCurrency(loanDetails.scored_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Interest Rate</span>
                    <span className="font-medium">{loanDetails.interest_rate || "0"}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Interest</span>
                    <span className="font-medium">{formatCurrency(loanDetails.total_interest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing Fee</span>
                    <span className="font-medium">{formatCurrency(loanDetails.processing_fee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registration Fee</span>
                    <span className="font-medium">{formatCurrency(loanDetails.registration_fee)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-900 font-semibold">Weekly Payment</span>
                    <span className="font-bold text-indigo-600">{formatCurrency(loanDetails.weekly_payment)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow">
                <h4 className="font-semibold text-gray-900 mb-4">Loan Timeline</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Booked At</span>
                    <span className="font-medium">
                      {formatDate(loanDetails.booked_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Approved By BM</span>
                    <span className="font-medium">
                      {loanDetails.bm_reviewed_at ? formatDate(loanDetails.bm_reviewed_at) : "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Approved By RM</span>
                    <span className="font-medium">
                      {formatDate(loanDetails.rm_reviewed_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Disbursed At</span>
                    <span className="font-medium">
                      {formatDate(loanDetails.disbursed_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing Fee Paid</span>
                    <span className={`font-medium ${loanDetails.processing_fee_paid ? 'text-green-600' : 'text-red-600'}`}>
                      {loanDetails.processing_fee_paid ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registration Fee Paid</span>
                    <span className={`font-medium ${loanDetails.registration_fee_paid ? 'text-green-600' : 'text-red-600'}`}>
                      {loanDetails.registration_fee_paid ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Loan Installments */}
            {loanInstallments.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow">
                <div className="flex items-center space-x-2 mb-4">
                  <ClockIcon className="h-5 w-5 text-indigo-600" />
                  <h4 className="font-semibold text-gray-900">Installment Schedule</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Overdue</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loanInstallments.map((installment) => (
                        <tr key={installment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{installment.installment_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDate(installment.due_date)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatCurrency(installment.due_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600">
                            {formatCurrency(installment.paid_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              installment.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : installment.status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : installment.status === 'overdue'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {installment.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {installment.days_overdue > 0 ? (
                              <span className="text-red-600 font-medium">{installment.days_overdue} days</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Loan Payments */}
            {loanPayments.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <CreditCardIcon className="h-5 w-5 text-green-600" />
                    <h4 className="font-semibold text-gray-900">Payment History</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Paid</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loanPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateTime(payment.paid_at)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600">
                            {formatCurrency(payment.paid_amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                            {payment.payment_method?.replace('_', ' ') || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-mono text-xs">
                            {payment.mpesa_receipt || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {payment.phone_number || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                            {payment.payment_type || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">{formatCurrency(totalPaid)}</td>
                        <td colSpan="4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {loanPayments.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow">
                <CreditCardIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No payments recorded yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanDetails;