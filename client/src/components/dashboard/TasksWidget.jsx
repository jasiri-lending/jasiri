import React from 'react';
import DashboardCard from './DashboardCard';
import { ChevronRight, AlertCircle, Clock, FileWarning, CheckSquare } from 'lucide-react';

const TaskItem = ({ title, count, color, icon: Icon }) => {
    const colors = {
        red: 'bg-red-50 border-red-100 text-red-700',
        orange: 'bg-orange-50 border-orange-100 text-orange-700',
        blue: 'bg-blue-50 border-blue-100 text-blue-700',
        indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    };

    const iconColors = {
        red: 'text-red-600',
        orange: 'text-orange-600',
        blue: 'text-blue-600',
        indigo: 'text-indigo-600',
    };

    return (
        <div className={`p-4 rounded-xl border ${colors[color]} flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group`}>
            <div className="flex justify-between items-start">
                <h4 className="font-semibold text-sm leading-tight pr-2">{title}</h4>
                <Icon className={`w-5 h-5 ${iconColors[color]}`} />
            </div>
            <div className="mt-4 flex justify-between items-end">
                <span className="text-2xl font-bold">{count}</span>
                <ChevronRight className={`w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity ${iconColors[color]}`} />
            </div>
        </div>
    );
};

const TasksWidget = ({ data }) => {
    return (
        <DashboardCard title="Tasks Needing Attention">
            <div className="grid grid-cols-2 gap-4">
                <TaskItem
                    title="Pending Disbursements"
                    count={data.approvedNotDisbursed}
                    color="orange"
                    icon={CheckSquare}
                />
                <TaskItem
                    title="Loans Due Today"
                    count={data.loansDueToday}
                    color="red"
                    icon={Clock}
                />
                <TaskItem
                    title="1–7 Days Overdue"
                    count={data.overdue}
                    color="indigo"
                    icon={AlertCircle}
                />
                <TaskItem
                    title="KYC Pending"
                    count={data.kycPending}
                    color="blue"
                    icon={FileWarning}
                />
            </div>
        </DashboardCard>
    );
};

export default TasksWidget;
