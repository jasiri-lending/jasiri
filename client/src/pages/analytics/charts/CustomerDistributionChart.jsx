import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { UserCog } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { COLORS } from '../shared/constants';

const CustomerDistributionChart = ({ data }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-6 h-6" style={{ color: "#586ab1" }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Customer Distribution by County</h3>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry.county}: ${entry.percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="customers"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CustomerDistributionChart;