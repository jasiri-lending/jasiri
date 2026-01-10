import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Users, Download, Filter } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { COLORS } from '../shared/constants';
import { exportToCSV } from '../shared/export';

const GuarantorAgeChart = ({ data, filters }) => {
  const [localFilters, setLocalFilters] = useState({
    gender: 'all',
    ageGroup: 'all'
  });

  const handleExport = () => {
    exportToCSV(data, 'guarantor-age-distribution');
  };

  const handleLocalFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // Filter data based on local filters
  const filteredData = data.map(group => {
    if (localFilters.gender === 'all' && localFilters.ageGroup === 'all') {
      return group;
    }
    
    const filteredGroup = { ...group };
    if (localFilters.gender !== 'all') {
      if (localFilters.gender === 'male') {
        filteredGroup.female = 0;
        filteredGroup.other = 0;
      } else if (localFilters.gender === 'female') {
        filteredGroup.male = 0;
        filteredGroup.other = 0;
      } else {
        filteredGroup.male = 0;
        filteredGroup.female = 0;
      }
    }
    return filteredGroup;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" style={{ color: "#586ab1" }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Guarantor Age & Gender</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.gender}
              onChange={(e) => handleLocalFilterChange('gender', e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All Genders</option>
              <option value="male">Male Only</option>
              <option value="female">Female Only</option>
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
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="ageGroup" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="male" name="Male" fill={COLORS[0]} stackId="a" />
            <Bar dataKey="female" name="Female" fill={COLORS[1]} stackId="a" />
            <Bar dataKey="other" name="Other" fill={COLORS[2]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Quick Stats */}
      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Guarantors:</span>
          <span className="font-semibold">
            {data.reduce((sum, group) => sum + group.male + group.female + group.other, 0)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Male:</span>
          <span className="font-semibold">
            {data.reduce((sum, group) => sum + group.male, 0)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Female:</span>
          <span className="font-semibold">
            {data.reduce((sum, group) => sum + group.female, 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GuarantorAgeChart;