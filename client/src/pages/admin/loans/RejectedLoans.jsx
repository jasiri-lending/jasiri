import React, { useState, useEffect } from 'react';
import { supabase } from "../../../supabaseClient";
import {
  XCircleIcon,
  UserIcon,
  CurrencyDollarIcon,
  EyeIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

const RejectedLoans = () => {
  const [rejectedLoans, setRejectedLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState(null);

  useEffect(() => {
    fetchRejectedLoans();
  }, []);

  const fetchRejectedLoans = async () => {
    try {
      const { data, error } = await supabase
        .from("loans")
        .select(`
          *,
          customers (
            Firstname,
            Surname,
            mobile,
            id_number
          )
        `)
        .eq('status', 'rejected')
       
      if (error) throw error;
      setRejectedLoans(data || []);
    } catch (error) {
      console.error("Error fetching rejected loans:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading rejected loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                Rejected Loans
              </h1>
              <p className="text-gray-600 mt-2">
                Loans that have been rejected by managers with reasons
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-100 to-pink-100 border border-red-200">
              <XCircleIcon className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-700">
                {rejectedLoans.length} Rejected
              </span>
            </div>
          </div>
        </div>

        {/* Rejected Loans Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-red-600 to-pink-600 text-white">
                  <th className="px-6 py-4 text-left font-semibold">Loan ID</th>
                  <th className="px-6 py-4 text-left font-semibold">Customer</th>
                  <th className="px-6 py-4 text-left font-semibold">Product</th>
                  <th className="px-6 py-4 text-right font-semibold">Amount</th>
                  <th className="px-6 py-4 text-center font-semibold">Rejected Date</th>
                  <th className="px-6 py-4 text-center font-semibold">Reason</th>
                  <th className="px-6 py-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rejectedLoans.map((loan, index) => (
                  <tr
                    key={loan.id}
                    className={`${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-red-50 transition-colors`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-mono text-red-600 font-semibold">
                        #{loan.id}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="font-semibold text-gray-900">
                            {loan.customers?.Firstname} {loan.customers?.Surname}
                          </div>
                          <div className="text-sm text-gray-500">
                            {loan.customers?.mobile}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-purple-600">
                        {loan.product_name || loan.product}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-gray-600">
                        KES {loan.scored_amount?.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center text-gray-600">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {new Date(loan.bm_rejected_at || loan.rm_rejected_at).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="max-w-xs truncate">
                        <span className="text-sm text-gray-700">
                          {loan.bm_comment || loan.rm_comment || 'No reason provided'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setSelectedLoan(loan)}
                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg font-semibold"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rejectedLoans.length === 0 && (
            <div className="text-center py-12">
              <XCircleIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No rejected loans</h3>
              <p className="text-gray-600">
                No loans have been rejected yet.
              </p>
            </div>
          )}
        </div>

        {/* Rejection Details Modal */}
        {selectedLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Rejection Details</h3>
                <button
                  onClick={() => setSelectedLoan(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircleIcon className="h-6 w-6 text-gray-600" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Loan ID</label>
                    <div className="text-lg font-semibold text-gray-900">#{selectedLoan.id}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Customer</label>
                    <div className="text-lg font-semibold text-gray-900">
                      {selectedLoan.customers?.Firstname} {selectedLoan.customers?.Surname}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Amount</label>
                    <div className="text-lg font-semibold text-emerald-600">
                      KES {selectedLoan.scored_amount?.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Rejected Date</label>
                    <div className="text-lg font-semibold text-gray-900">
                      {new Date(selectedLoan.bm_rejected_at || selectedLoan.rm_rejected_at).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center mb-2">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                    Rejection Reason
                  </label>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-gray-800">
                      {selectedLoan.bm_comment || selectedLoan.rm_comment || 'No specific reason provided'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RejectedLoans;
