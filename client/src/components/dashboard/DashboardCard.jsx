
const DashboardCard = ({ title, subtitle, children, className = '', action }) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-brand-secondary/20 p-5 flex flex-col ${className}`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
                    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                </div>
                {action && (
                    <div className="flex-shrink-0">
                        {action}
                    </div>
                )}
            </div>
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
};

export default DashboardCard;
