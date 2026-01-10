import React from 'react';
import { Clock } from 'lucide-react';
import { formatCurrencyCompact } from '../shared/Format.js';

const TopOverdueLoans = ({ data }) => {
  const totalOverdue = data.reduce((sum, loan) => sum + loan.overdueAmount, 0);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Top Overdue Loans</h3>
        </div>
        <span className="text-sm text-gray-500">Highest outstanding</span>
      </div>
      <div className="h-80">
        <div className="space-y-3">
          {data.slice(0, 5).map((loan, index) => (
            <div key={loan.loanId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index === 0 ? 'bg-red-100 text-red-600' :
                  index === 1 ? 'bg-orange-100 text-orange-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">Loan #{loan.loanId}</p>
                  <p className="text-sm text-gray-500">{loan.percentage}% overdue</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-red-600">{formatCurrencyCompact(loan.overdueAmount)}</p>
                <p className="text-sm text-gray-500">of {formatCurrencyCompact(loan.totalAmount)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">Total Overdue Amount</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrencyCompact(totalOverdue)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">Affected Loans</p>
              <p className="text-2xl font-bold text-blue-900">{data.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopOverdueLoans;