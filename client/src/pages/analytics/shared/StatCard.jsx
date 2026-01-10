
const StatCard = ({ icon: Icon, label, value, color, subText, bgColor = 'bg-white' }) => {
  return (
    <div className={`${bgColor} rounded-xl shadow-sm border border-gray-200 p-4`}>
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-5 h-5" style={{ color }} />}
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          {subText && <p className="text-xs text-gray-500 mt-1">{subText}</p>}
        </div>
      </div>
    </div>
  );
};

export default StatCard;