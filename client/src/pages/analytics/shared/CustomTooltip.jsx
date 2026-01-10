import React from 'react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="flex items-center gap-2 text-sm">
            <span 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">
              {formatTooltipValue(entry.value, entry.dataKey)}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Helper function to format tooltip values
const formatTooltipValue = (value, dataKey) => {
  if (dataKey?.includes('amount') || dataKey?.includes('Amount') || dataKey?.includes('value')) {
    // Format currency
    if (value >= 1000000) {
      return `Ksh ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `Ksh ${(value / 1000).toFixed(1)}K`;
    }
    return `Ksh ${Number(value).toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }
  
  if (dataKey?.includes('Rate') || dataKey?.includes('percentage') || dataKey?.includes('Percentage')) {
    return `${Math.round(value)}%`;
  }
  
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  
  return value || '';
};

export default CustomTooltip;