import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Users } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { COLORS } from '../shared/constants';

const AgeGenderChart = ({ data }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" style={{ color: "#586ab1" }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Age & Gender Distribution</h3>
        </div>
        <span className="text-sm text-gray-500">Across guarantors</span>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
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
    </div>
  );
};

export default AgeGenderChart;