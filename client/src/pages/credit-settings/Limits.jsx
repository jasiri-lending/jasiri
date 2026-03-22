import React, { useState } from 'react';
import { 
  AdjustmentsHorizontalIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  ExclamationCircleIcon,
  PlusIcon,
  InformationCircleIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

const Limits = () => {
  const [limits, setLimits] = useState([
    { id: 1, grade: 'A', scoreRange: '750 - 850', baseLimit: 50000, multiplier: 1.5, active: true },
    { id: 2, grade: 'B', scoreRange: '650 - 749', baseLimit: 20000, multiplier: 1.2, active: true },
    { id: 3, grade: 'C', scoreRange: '500 - 649', baseLimit: 5000, multiplier: 1.0, active: true },
    { id: 4, grade: 'D', scoreRange: '300 - 499', baseLimit: 0, multiplier: 0, active: true },
  ]);

  return (
    <div className="p-8 space-y-6">
      {/* Configuration Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
            <AdjustmentsHorizontalIcon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Credit Limit Recommendation Strategies</h2>
            <p className="text-sm text-gray-500">Define how loan limits are suggested based on customer risk profiles.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-50">
           <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Global Multiplier</label>
              <div className="flex items-center gap-4">
                 <input 
                   type="range" 
                   min="1" 
                   max="3" 
                   step="0.1" 
                   defaultValue="1.5"
                   className="w-full accent-brand-primary"
                 />
                 <span className="font-black text-brand-primary text-xl">1.5x</span>
              </div>
              <p className="text-xs text-gray-400">Multiplies the calculated limit based on overall portfolio health.</p>
           </div>
           
           <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10">
              <div className="flex gap-3">
                 <InformationCircleIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
                 <p className="text-xs text-brand-primary font-medium leading-relaxed">
                   Limits are calculated as: <br />
                   <code className="bg-white/50 px-1 rounded font-bold">Recommended Limit = Base Limit × Tier Multiplier × Global Factor</code>
                 </p>
              </div>
           </div>
        </div>
      </div>

      {/* Grade Limits Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Tiered Limit Configuration</h3>
          <button className="text-sm font-bold text-brand-primary hover:underline flex items-center gap-1">
            <PlusIcon className="w-4 h-4"/> Add Tier
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Risk Grade</th>
                <th className="px-6 py-4">Score Range</th>
                <th className="px-6 py-4">Base Limit (KES)</th>
                <th className="px-6 py-4">Multiplier</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {limits.map((limit) => (
                <tr key={limit.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                        limit.grade === 'A' ? 'bg-green-100 text-green-700' :
                        limit.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                        limit.grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {limit.grade}
                      </div>
                      <span className="font-bold text-gray-900">Grade {limit.grade}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-gray-500 font-bold">{limit.scoreRange}</span>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      defaultValue={limit.baseLimit.toLocaleString()} 
                      className="w-24 bg-transparent border-b border-transparent group-hover:border-gray-200 outline-none focus:border-brand-primary text-gray-900 font-bold"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-600">
                    {limit.multiplier}x
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase">Active</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-brand-primary p-1"><PencilIcon className="w-5 h-5"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Automated Adjustments */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
         <h3 className="font-bold text-gray-900 mb-4">Smart Adjustment Rules</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-100 rounded-xl hover:bg-green-50/30 transition-colors">
               <div className="flex items-center gap-3 mb-2">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                  <h4 className="font-black text-sm text-gray-900 uppercase tracking-tighter">Auto-Increase Reward</h4>
               </div>
               <p className="text-xs text-gray-500 leading-relaxed">
                  Increase limit by <span className="font-bold text-gray-900">20%</span> when a customer completes <span className="font-bold text-gray-900">3 consecutive</span> loans without any arrears.
               </p>
            </div>
            
            <div className="p-4 border border-gray-100 rounded-xl hover:bg-red-50/30 transition-colors">
               <div className="flex items-center gap-3 mb-2">
                  <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
                  <h4 className="font-black text-sm text-gray-900 uppercase tracking-tighter">Missed Payment Guard</h4>
               </div>
               <p className="text-xs text-gray-500 leading-relaxed">
                  Reduce recommended limit by <span className="font-bold text-gray-900">50%</span> immediately if a customer misses more than <span className="font-bold text-gray-900">2 installments</span>.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Limits;
