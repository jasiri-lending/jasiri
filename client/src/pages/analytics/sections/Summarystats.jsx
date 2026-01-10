import React from 'react';
import { DollarSign, CreditCard, Building } from 'lucide-react';
import StatCard from '../shared/StatCard';
import { formatCurrencyCompact } from '../shared/Format.js';

const SummaryStats = ({ totalDisbursed, totalLoans, totalBranches, avgCollectionRate }) => {
  const getCollectionStatus = (rate) => {
    if (rate < 25) return { label: "Very Poor", color: "text-red-600", bg: "bg-red-50" };
    if (rate < 50) return { label: "Average", color: "text-orange-500", bg: "bg-orange-50" };
    if (rate < 75) return { label: "Good", color: "text-yellow-500", bg: "bg-yellow-50" };
    if (rate < 85) return { label: "Very Good", color: "text-green-500", bg: "bg-green-50" };
    return { label: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50" };
  };

  const status = getCollectionStatus(avgCollectionRate);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatCard
        icon={DollarSign}
        label="Total Disbursed"
        value={formatCurrencyCompact(totalDisbursed)}
        color="#10b981"
      />
      
      <StatCard
        icon={CreditCard}
        label="Total Loans"
        value={totalLoans}
        color="#586ab1"
      />
      
      <StatCard
        icon={Building}
        label="Active Branches"
        value={totalBranches}
        color="#f59e0b"
      />
      
      <div className={`rounded-xl shadow-sm border border-gray-200 p-4 ${status.bg}`}>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm text-gray-500">Avg Collection Rate</p>
            <p className={`text-2xl font-bold ${status.color}`}>
              {avgCollectionRate}%
            </p>
            <p className={`text-xs font-medium ${status.color}`}>
              {status.label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryStats;