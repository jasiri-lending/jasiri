import React from 'react';
import DashboardCard from './DashboardCard';
import { DollarSign, FileText, CheckCircle, AlertOctagon, User } from 'lucide-react';

const ActivityItem = ({ type, text, subtext, time }) => {
    let Icon = FileText;
    let bg = 'bg-blue-100 text-blue-600';

    if (type === 'disbursement') {
        Icon = DollarSign;
        bg = 'bg-emerald-100 text-emerald-600';
    } else if (type === 'repayment') {
        Icon = CheckCircle;
        bg = 'bg-indigo-100 text-indigo-600';
    } else if (type === 'alert') {
        Icon = AlertOctagon;
        bg = 'bg-red-100 text-red-600';
    } else if (type === 'client') {
        Icon = User;
        bg = 'bg-amber-100 text-amber-600';
    }

    return (
        <div className="flex gap-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors p-2 rounded-lg">
            <div className={`p-2 rounded-full h-fit ${bg}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">{text}</p>
                <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>
            </div>
            <div className="text-xs text-gray-400 whitespace-nowrap">
                {time}
            </div>
        </div>
    );
};

const ActivityFeedWidget = ({ activities }) => {
    return (
        <DashboardCard title="Recent Activity" className="h-full max-h-[400px]">
            <div className="overflow-y-auto pr-2 max-h-[300px]">
                {activities.map((activity, idx) => (
                    <ActivityItem key={idx} {...activity} />
                ))}
            </div>
        </DashboardCard>
    );
};

export default ActivityFeedWidget;
