import React from "react";
import DashboardCard from "./DashboardCard";

const bucketColors = {
  "1-7": "bg-blue-50 text-blue-700",
  "8-30": "bg-indigo-50 text-indigo-700",
  "31-60": "bg-orange-50 text-orange-700",
  "60+": "bg-red-50 text-red-700",
};

const DelinquencyWidget = ({ data, par30 }) => {
  return (
    <DashboardCard title="Delinquency Status">
      <div className="flex justify-between items-center mb-4">
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold">PAR 30</p>
          <p className="text-2xl font-bold text-red-600">{par30}%</p>
        </div>
        <div className="text-center border-l pl-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Write Offs This Month</p>
          <p className="text-xl font-bold text-gray-800">{data?.writeOffs || 0}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium">
            <tr>
              <th className="px-3 py-2 rounded-l-lg">Bucket</th>
              <th className="px-3 py-2">Count</th>
              <th className="px-3 py-2 text-right rounded-r-lg">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(data?.buckets || []).map((item, index) => (
              <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-3 font-medium text-gray-700">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${bucketColors[item.bucket] || 'bg-gray-100'}`}>
                    {item.bucket} Days
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-600">{item.count}</td>
                <td className="px-3 py-3 text-right font-semibold text-gray-800">{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
};

export default DelinquencyWidget;
