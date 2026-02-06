import React from 'react';
import DashboardCard from './DashboardCard';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';

const InfoRow = ({ label, value, highlight = false, color = 'text-gray-900' }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`font-semibold ${highlight ? 'text-lg' : 'text-base'} ${color}`}>{value}</span>
    </div>
);

const RepaymentWidget = ({ data, chartData }) => {
    return (
        <DashboardCard title="Repayment Overview">
            <div className="space-y-3 mb-6">
                <div className="flex justify-between items-baseline">
                    <span className="text-sm text-gray-500">Collection Rate</span>
                    <span className={`text-2xl font-bold ${data.collectionRate >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {data.collectionRate}%
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                    <div>
                        <p className="text-xs text-gray-400">Due Today</p>
                        <p className="font-semibold text-gray-800">{data.dueToday}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Collected</p>
                        <p className="font-semibold text-emerald-600">{data.collectedToday}</p>
                    </div>
                </div>
            </div>

            <div className="h-40 w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area
                            type="monotone" // Spline curve
                            dataKey="amount"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorCollections)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </DashboardCard>
    );
};

export default RepaymentWidget;
