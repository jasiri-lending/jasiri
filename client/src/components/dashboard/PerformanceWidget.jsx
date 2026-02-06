import React from 'react';
import DashboardCard from './DashboardCard';

const PerformanceItem = ({ label, value, subtext }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className="text-right">
            <span className="block text-lg font-bold text-gray-800">{value}</span>
            {subtext && <span className="text-xs text-gray-400">{subtext}</span>}
        </div>
    </div>
);

const PerformanceWidget = ({ type = 'agent', data }) => {
    const isAgent = type === 'agent';
    const title = isAgent ? 'Agent Performance' : 'Collector Performance';

    return (
        <DashboardCard title={title}>
            <div className="flex flex-col gap-1 mt-2">
                {isAgent ? (
                    <>
                        <PerformanceItem label="Apps Processed" value={data.processed} />
                        <PerformanceItem label="Approval Rate" value={`${data.approvalRate}%`} />
                        <PerformanceItem label="Avg. Approval Time" value={`${data.avgTime} hrs.`} />
                        <PerformanceItem label="Conversion Rate" value={`${data.conversionRate}%`} />
                    </>
                ) : (
                    <>
                        <PerformanceItem label="Calls Made" value={data.calls} />
                        <PerformanceItem label="Amount Collected" value={data.collectedAmount} />
                        <PerformanceItem label="Recovery Rate" value={`${data.recoveryRate}%`} />
                        <PerformanceItem label="PTP Kept" value={`${data.ptpKept}%`} />
                    </>
                )}
            </div>
        </DashboardCard>
    );
};

export default PerformanceWidget;
