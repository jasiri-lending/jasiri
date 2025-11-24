// src/pages/relationship-officer/components/ConversionChart.jsx
import React from 'react'

const ConversionChart = ({ stats }) => {
  const { conversionRate } = stats

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="relative inline-block">
          <svg className="w-32 h-32" viewBox="0 0 36 36">
            <path
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#eee"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#4f46e5"
              strokeWidth="3"
              strokeDasharray={`${conversionRate}, 100`}
            />
          </svg>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
            <span className="text-2xl font-bold text-gray-900">{conversionRate}%</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600">Lead to Customer Conversion Rate</p>
      </div>
    </div>
  )
}

export default ConversionChart