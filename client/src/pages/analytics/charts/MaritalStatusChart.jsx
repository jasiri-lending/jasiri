import React, { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Heart, Download, Filter } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { COLORS } from '../shared/constants';
import { exportToCSV } from '../shared/export';

const MaritalStatusChart = ({ data, filters }) => {
  const [localFilters, setLocalFilters] = useState({
    viewType: 'pie'
  });

  const handleExport = () => {
    exportToCSV(data, 'marital-status-distribution');
  };

  const handleLocalFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // Sample data if no data exists
  const chartData = data.length > 0 ? data : [
    { name: 'Married', value: 45 },
    { name: 'Single', value: 35 },
    { name: 'Divorced', value: 12 },
    { name: 'Widowed', value: 8 }
  ];

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Heart className="w-6 h-6" style={{ color: "#586ab1" }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Marital Status Distribution</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
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
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              label={({ name, value }) => `${name}: ${Math.round((value / total) * 100)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const percentage = Math.round((data.value / total) * 100);
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow">
                      <p className="font-semibold">{data.name}</p>
                      <p className="text-sm">Count: {data.value.toLocaleString()}</p>
                      <p className="text-sm">Percentage: {percentage}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MaritalStatusChart;