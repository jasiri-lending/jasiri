import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Briefcase } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { COLORS } from '../shared/constants';

const BusinessTypesChart = ({ data }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6" style={{ color: "#586ab1" }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Business Types Analysis</h3>
        </div>
        <span className="text-sm text-gray-500">Most common business types</span>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="count" name="Customer Count" fill={COLORS[4]} />
            <Bar dataKey="totalIncome" name="Total Income" fill={COLORS[5]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BusinessTypesChart;