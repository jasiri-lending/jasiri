import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Download, Filter, Calendar } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { HEADER_COLOR } from '../shared/constants';
import { exportToCSV } from '../shared/export';

const RepaymentTrendsChart = ({ data, filters, onFilterChange }) => {
  const [localFilters, setLocalFilters] = useState({
    dateRange: filters.dateRange,
    chartType: 'area',
    showAverage: true
  });

  const handleExport = () => {
    exportToCSV(data, 'repayment-trends');
  };

  const handleLocalFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
    if (key === 'dateRange') onFilterChange('dateRange', value);
  };

  // Calculate average
  const averageAmount = data.length > 0 
    ? data.reduce((sum, item) => sum + item.amount, 0) / data.length 
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Repayment Trends</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.dateRange}
              onChange={(e) => handleLocalFilterChange('dateRange', e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="6months">Last 6 Months</option>
              <option value="year">Last 1 Year</option>
              <option value="all">All Time</option>
            </select>
            <select
              value={localFilters.chartType}
              onChange={(e) => handleLocalFilterChange('chartType', e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="area">Area Chart</option>
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
            </select>
          </div>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="amount" 
              name="Collection Amount" 
              stroke={HEADER_COLOR} 
              fill={HEADER_COLOR} 
              fillOpacity={0.3} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">Total Collected</p>
          <p className="text-xl font-bold text-blue-900">
            Ksh {data.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-700">Average Daily</p>
          <p className="text-xl font-bold text-green-900">
            Ksh {Math.round(averageAmount).toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-700">Total Transactions</p>
          <p className="text-xl font-bold text-purple-900">
            {data.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RepaymentTrendsChart;