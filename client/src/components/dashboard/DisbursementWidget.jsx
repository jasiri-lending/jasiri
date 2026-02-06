import React from 'react';
import DashboardCard from './DashboardCard';
import { AlertTriangle, CheckCircle } from 'lucide-react';

const DisbursementWidget = ({ data }) => {
    return (
        <DashboardCard title="Disbursements Today">
            <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-700">Failed Disbursements</p>
                            <p className="text-xs text-gray-500">Action required</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-red-600 text-lg">{data.failedCount}</p>
                        <p className="text-xs text-gray-400">{data.failedAmount}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-200 rounded-lg text-gray-600">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-700">Pending Disbursements</p>
                            <p className="text-xs text-gray-500">Awaiting processing</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-gray-700 text-lg">{data.pendingCount}</p>
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default DisbursementWidget;
