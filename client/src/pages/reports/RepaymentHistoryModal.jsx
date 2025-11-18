// src/components/reports/RepaymentHistoryModal.jsx
import React, { useState, useEffect } from 'react';
import { exportToCSV } from '../../utils/exportUtils';

const RepaymentHistoryModal = ({ loan, onClose }) => {
  const [repaymentData, setRepaymentData] = useState([]);
  const [summary, setSummary] = useState({
    totalAmountDue: 0,
    totalPaid: 0,
    remainingBalance: 0,
    completionPercentage: 0
  });

  useEffect(() => {
    const generateRepaymentSchedule = () => {
      const schedule = [];
      const weeklyInstallment = loan.weekly_installment;
      const totalWeeks = loan.loan_term;
      let totalAmountDue = 0;
      let totalPaid = 0;

      const startDate = new Date(loan.disbursed_date);

      for (let week = 1; week <= totalWeeks; week++) {
        const dueDate = new Date(startDate);
        dueDate.setDate(startDate.getDate() + (week * 7));

        const paymentStatus = Math.random();
        let paidAmount = 0;
        let status = 'Pending';
        let mpesa_transaction_code = '—';

        if (paymentStatus < 0.7) {
          paidAmount = weeklyInstallment;
          status = 'Paid';
          totalPaid += paidAmount;
          mpesa_transaction_code = `MP${Math.floor(100000 + Math.random() * 900000)}`;
        } else if (paymentStatus < 0.85) {
          paidAmount = weeklyInstallment * 0.5;
          status = 'Overdue';
          totalPaid += paidAmount;
          mpesa_transaction_code = `MP${Math.floor(100000 + Math.random() * 900000)}`;
        } else {
          paidAmount = 0;
          const today = new Date();
          status = dueDate < today ? 'Overdue' : 'Pending';
        }

        const installment = {
          week,
          due_date: dueDate.toISOString().split('T')[0],
          amount_due: weeklyInstallment,
          paid_amount: paidAmount,
          status,
          mpesa_transaction_code
        };

        schedule.push(installment);
        totalAmountDue += weeklyInstallment;
      }

      const remainingBalance = totalAmountDue - totalPaid;
      const completionPercentage = totalAmountDue > 0 ? (totalPaid / totalAmountDue) * 100 : 0;

      setRepaymentData(schedule);
      setSummary({
        totalAmountDue,
        totalPaid,
        remainingBalance,
        completionPercentage
      });
    };

    generateRepaymentSchedule();
  }, [loan]);

  const handleExport = () => {
    const csvData = repaymentData.map(installment => ({
      'Week': installment.week,
      'Due Date': installment.due_date,
      'Amount Due (KES)': installment.amount_due,
      'Paid Amount (KES)': installment.paid_amount,
      'M-Pesa Code': installment.mpesa_transaction_code,
      'Status': installment.status
    }));
    exportToCSV(csvData, `repayment-history-${loan.id}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

  const formatPercentage = (value) => `${value.toFixed(1)}%`;

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-KE');

  const getStatusBadge = (status, dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    let actualStatus = status;
    if (status === 'Pending' && due < today) actualStatus = 'Overdue';

    const statusConfig = {
      Paid: { color: 'bg-green-100 text-green-800', label: 'Paid' },
      Overdue: { color: 'bg-red-100 text-red-800', label: 'Overdue' },
      Pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' }
    };

    const config = statusConfig[actualStatus] || { color: 'bg-gray-100 text-gray-800', label: actualStatus };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getRowClass = (status, dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    let actualStatus = status;
    if (status === 'Pending' && due < today) actualStatus = 'Overdue';
    if (actualStatus === 'Overdue') return 'bg-red-50';
    if (actualStatus === 'Paid') return 'bg-green-50';
    return '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-600">
              Repayment History - {loan.id}
            </h2>
            <p className="text-sm text-gray-600">
              {loan.customer_name} • {formatCurrency(loan.disbursed_amount)} • {loan.loan_term} weeks
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
            >
              Close
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm font-medium text-gray-600">Total Amount Due</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalAmountDue)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm font-medium text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm font-medium text-gray-600">Remaining Balance</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.remainingBalance)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm font-medium text-gray-600">Completion</p>
              <p className="text-2xl font-bold text-blue-600">{formatPercentage(summary.completionPercentage)}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${summary.completionPercentage}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(90vh-200px)]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Due (KES)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Amount (KES)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">M-Pesa Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {repaymentData.map((installment) => {
                const balance = installment.amount_due - installment.paid_amount;
                return (
                  <tr key={installment.week} className={`hover:bg-gray-50 ${getRowClass(installment.status, installment.due_date)}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Week {installment.week}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(installment.due_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(installment.amount_due)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(installment.paid_amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                      {installment.mpesa_transaction_code || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(installment.status, installment.due_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(balance)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>Showing {repaymentData.length} installments</div>
            <div>Last updated: {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepaymentHistoryModal;
