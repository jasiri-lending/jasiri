import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { AlertTriangle, Download, Filter, TrendingDown } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { COLORS } from '../shared/constants';
import { exportToCSV } from '../shared/export';
import { formatCurrencyCompact } from '../shared/format';

const NPLChart = ({ data, filters }) => {
  const [localFilters, setLocalFilters] = useState({
    viewType: 'bar',
    sortBy: 'amount'
  });

  const handleExport = () => {
    exportToCSV(data, 'non-performing-loans');
  };

  const handleLocalFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (localFilters.sortBy === 'amount') return b.overdueAmount - a.overdueAmount;
    if (localFilters.sortBy === 'percentage') return b.percentage - a.percentage;
    return 0;
  });

  const topNPL = sortedData.slice(0, 8);

  const totalNPL = data.reduce((sum, loan) => sum + loan.overdueAmount, 0);
  const avgNPLPercentage = data.length > 0 
    ? data.reduce((sum, loan) => sum + loan.percentage, 0) / data.length 
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Non-Performing Loans (NPL)</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.sortBy}
              onChange={(e) => handleLocalFilterChange('sortBy', e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="amount">Sort by Amount</option>
              <option value="percentage">Sort by Percentage</option>
            </select>
          </div>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topNPL}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="loanId" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="overdueAmount" name="Overdue Amount" fill="#ef4444" />
            <Bar dataKey="percentage" name="Overdue %" fill="#f97316" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* NPL Summary Stats */}
      <div className="mt-6 space-y-4">
        <div className="p-4 bg-red-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Total NPL Amount</p>
              <p className="text-2xl font-bold text-red-900">
                {formatCurrencyCompact(totalNPL)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-red-700">Avg. Overdue %</p>
              <p className="text-2xl font-bold text-red-900">
                {Math.round(avgNPLPercentage)}%
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-orange-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700">Total Loans at Risk</p>
              <p className="text-xl font-bold text-orange-900">{data.length}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-orange-700">Highest Overdue</p>
              <p className="text-xl font-bold text-orange-900">
                {data.length > 0 ? Math.max(...data.map(d => d.percentage)) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NPLChart;