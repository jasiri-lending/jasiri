import React from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Shield, DollarSign } from 'lucide-react';
import CustomTooltip from '../shared/CustomTooltip';
import { HEADER_COLOR, COLORS } from '../shared/constants';
import { formatCurrencyCompact } from '../shared/Format.js';

const PayerTypeChart = ({ barData, pieData }) => {
  const totalAmount = barData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
            Payer Type Analysis
          </h3>
        </div>
        <div className="text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>Total Paid: {formatCurrencyCompact(totalAmount)}</span>
          </div>
        </div>
      </div>
      
      {/* Bar Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="type" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="amount" name="Amount Paid" fill={HEADER_COLOR} radius={[4, 4, 0, 0]} />
            <Bar dataKey="count" name="Payment Count" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Pie Chart */}
      <div className="mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-4 text-center">
            Payment Distribution by Payer Type
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-semibold text-gray-900">{data.name}</p>
                          <p className="text-sm text-gray-600">
                            Amount: {formatCurrencyCompact(data.value)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Payments: {data.count} transactions
                          </p>
                          <p className="text-sm text-gray-600">
                            Share: {data.percentage}%
                          </p>
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
      </div>
      
      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {barData.map((payer, index) => (
          <div key={payer.type} className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
              <p className="text-xs font-medium text-gray-700">{payer.type}</p>
            </div>
            <p className="text-lg font-bold mt-1" style={{ color: HEADER_COLOR }}>
              {formatCurrencyCompact(payer.amount)}
            </p>
            <p className="text-xs text-gray-500">
              {payer.count} payments ({payer.percentage}%)
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PayerTypeChart;