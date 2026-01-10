import React, { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { MapPin, Download, Filter } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { COLORS } from '../shared/constants';
import { exportToCSV } from '../shared/export';

const CountyChart = ({ data, filters }) => {
  const [localFilters, setLocalFilters] = useState({
    showTop: 10,
    viewType: 'pie'
  });

  const handleExport = () => {
    exportToCSV(data, 'customer-distribution-by-county');
  };

  const handleLocalFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredData = data.slice(0, localFilters.showTop);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6" style={{ color: "#586ab1" }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Customer Distribution by County</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.showTop}
              onChange={(e) => handleLocalFilterChange('showTop', e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="15">Top 15</option>
              <option value="20">Top 20</option>
            </select>
            <select
              value={localFilters.viewType}
              onChange={(e) => handleLocalFilterChange('viewType', e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="pie">Pie Chart</option>
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
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry.county}: ${entry.percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="customers"
            >
              {filteredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Top Counties List */}
      <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
        {filteredData.map((item, index) => (
          <div key={item.county} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="text-sm">{item.county}</span>
            </div>
            <div className="text-right">
              <span className="font-semibold">{item.customers.toLocaleString()}</span>
              <span className="text-xs text-gray-500 ml-2">({item.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CountyChart;