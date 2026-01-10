import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { PieChartIcon, Download, Filter } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { HEADER_COLOR, COLORS } from '../shared/constants';
import { exportToCSV } from '../shared/export';

const ProductOverviewChart = ({ data, filters, onFilterChange }) => {
  const [localFilters, setLocalFilters] = useState({
    dateRange: filters.dateRange,
    sortBy: 'count'
  });

  const handleExport = () => {
    exportToCSV(data, 'product-overview');
  };

  const handleLocalFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const sortedData = [...data].sort((a, b) => {
    if (localFilters.sortBy === 'count') return b.count - a.count;
    if (localFilters.sortBy === 'amount') return b.totalAmount - a.totalAmount;
    return 0;
  });

  const filteredData = sortedData.slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PieChartIcon className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Product Type Distribution</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.sortBy}
              onChange={(e) => handleLocalFilterChange('sortBy', e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="count">Sort by Count</option>
              <option value="amount">Sort by Amount</option>
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
          <ComposedChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar yAxisId="left" dataKey="count" name="Loan Count" fill={COLORS[0]} />
            <Line yAxisId="right" type="monotone" dataKey="totalAmount" name="Total Amount" stroke={HEADER_COLOR} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProductOverviewChart;