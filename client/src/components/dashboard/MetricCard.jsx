import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

const MetricCard = ({ title, value, subValue, trend, trendValue, icon: Icon, color = 'blue', className, valueClassName, subValueClassName }) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-emerald-50 text-emerald-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        brand: 'bg-brand-primary/10 text-brand-primary',
    };

    const trendColors = {
        up: 'text-emerald-600',
        down: 'text-red-600',
        neutral: 'text-gray-500',
    };

    const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;

    // Responsive font size logic for large figures
    const valueLength = String(value).length;
    const responsiveFontSize = valueLength > 15 ? 'text-lg' : valueLength > 12 ? 'text-xl' : 'text-2xl';

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-brand-secondary/20 p-5 flex flex-col justify-between h-full transition-all hover:shadow-md ${className}`}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
                    <h3 className={valueClassName || `${responsiveFontSize} font-bold text-gray-800 mt-1 break-all`}>
                        {value}
                    </h3>
                    {subValue && (
                        <p className={subValueClassName || "text-sm font-semibold text-gray-600 mt-1 truncate"}>
                            {subValue}
                        </p>
                    )}
                </div>
                <div className={`p-3 rounded-lg flex-shrink-0 ${colorClasses[color] || colorClasses.blue}`}>
                    {Icon && <Icon className="w-6 h-6" />}
                </div>
            </div>

            {trendValue && (
                <div className="flex items-center mt-4 pt-3 border-t border-gray-100">
                    <span className={`flex items-center text-xs font-semibold ${trendColors[trend] || trendColors.neutral}`}>
                        <TrendIcon className="w-3 h-3 mr-1" />
                        {trendValue}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">vs last month</span>
                </div>
            )}
        </div>
    );
};

export default MetricCard;
