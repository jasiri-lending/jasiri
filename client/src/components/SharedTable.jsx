import React from 'react';

/**
 * SharedTable renders a table with given columns and rows.
 * It mimics the design of AllCustomers.jsx (header background, striped rows, fonts).
 *
 * Props:
 * - columns: Array<{ header: string, accessor?: string, render?: (row: any) => ReactNode }>
 * - data: Array<any>
 * - rowKey: string | ((row: any) => string) – unique key for each row
 */
export const SharedTable = ({ columns, data, rowKey }) => {
  const getKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row);
    return row[rowKey] ?? index;
  };

  return (
    <div className="overflow-x-auto font-outfit">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100" style={{ backgroundColor: '#E7F0FA' }}>
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs whitespace-nowrap text-slate-600">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr
              key={getKey(row, index)}
              className={`border-b border-gray-50 transition-colors hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
            >
              {columns.map((col, i) => (
                <td key={i} className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
