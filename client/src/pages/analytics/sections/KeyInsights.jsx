import React from 'react';
import { formatCurrencyCompact } from '../shared/Format.js';

const KeyInsights = ({ 
  productOverview, 
  branchPerformance, 
  repeatCustomers 
}) => {
  return (
    <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Key Insights</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-blue-700">Top Product</p>
          <p className="text-xl font-bold text-blue-900">
            {productOverview[0]?.name || 'N/A'}
          </p>
          <p className="text-sm text-blue-600">
            {productOverview[0]?.count || 0} loans ({formatCurrencyCompact(productOverview[0]?.totalAmount || 0)})
          </p>
        </div>
        
        <div className="p-4 bg-emerald-50 rounded-lg">
          <p className="text-sm font-medium text-emerald-700">Top Performing Branch</p>
          <p className="text-xl font-bold text-emerald-900">
            {branchPerformance[0]?.name || 'N/A'}
          </p>
          <p className="text-sm text-emerald-600">
            {branchPerformance[0]?.collectionRate || 0}% collection rate
          </p>
        </div>
        
        <div className="p-4 bg-amber-50 rounded-lg">
          <p className="text-sm font-medium text-amber-700">Customer Loyalty</p>
          <p className="text-xl font-bold text-amber-900">
            {repeatCustomers.reduce((sum, cat) => sum + cat.count, 0) - (repeatCustomers[0]?.count || 0)} repeat customers
          </p>
          <p className="text-sm text-amber-600">
            {(repeatCustomers[0]?.count || 0)} first-time customers
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyInsights;