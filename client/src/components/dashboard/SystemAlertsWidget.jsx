import React from 'react';
import DashboardCard from './DashboardCard';
import { AlertTriangle, XCircle, Info } from 'lucide-react';

const AlertItem = ({ level, message }) => {
    let Icon = Info;
    let color = 'text-blue-600';
    let bg = 'bg-blue-50';

    if (level === 'critical') {
        Icon = XCircle;
        color = 'text-red-600';
        bg = 'bg-red-50';
    } else if (level === 'warning') {
        Icon = AlertTriangle;
        color = 'text-amber-600';
        bg = 'bg-amber-50';
    }

    return (
        <div className={`flex items-start gap-2 p-2 rounded-lg ${bg} mb-2 last:mb-0`}>
            <Icon className={`w-4 h-4 mt-0.5 ${color}`} />
            <span className={`text-sm font-medium ${color}`}>{message}</span>
        </div>
    );
};

const SystemAlertsWidget = ({ alerts }) => {
    return (
        <DashboardCard title="System Alerts" className="bg-red-50/30 border-red-100">
            <div className="mt-2">
                {alerts.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No active alerts</p>
                ) : (
                    alerts.map((alert, idx) => (
                        <AlertItem key={idx} level={alert.level} message={alert.message} />
                    ))
                )}
            </div>
        </DashboardCard>
    );
};

export default SystemAlertsWidget;
