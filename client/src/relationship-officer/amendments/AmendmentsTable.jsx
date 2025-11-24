function AmendmentsTable({ amendments, loading, onEdit, onView, onRefresh }) {
  
  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
    </div>
  );
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-semibold text-slate-600">Pending Amendments</h2>
        <button 
          onClick={onRefresh}
           className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                style={{ backgroundColor: "#586ab1" }}
        >
          Refresh
        </button>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {amendments.map((amendment) => (
              <tr key={amendment.id || amendment.customer_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {amendment.customers?.Firstname} {amendment.customers?.Surname}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{amendment.customers?.id_number}</td>
                <td className="px-6 py-4 whitespace-nowrap">{amendment.customers?.mobile}</td>
                <td className="px-6 py-4 whitespace-nowrap">{amendment.customers?.business_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${amendment.customers?.status === 'sent_back_by_bm' ? 'bg-orange-100 text-orange-800' : 
                      amendment.customers?.status === 'sent_back_by_ca' ? 'bg-red-100 text-red-800' :
                      amendment.customers?.status === 'sent_back_by_cso' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'}`}>
                    {amendment.customers?.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pending'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => onView(amendment)} 
                    className="mr-3 text-indigo-600 hover:text-indigo-900 transition-colors"
                  >
                    View
                  </button>
                  <button 
                    onClick={() => onEdit(amendment)} 
                    className="mr-3 text-green-600 hover:text-green-900 transition-colors"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {amendments.length === 0 && (
        <div className="p-8 text-center text-gray-500 bg-gray-50">
          <p>No pending amendments found</p>
        </div>
      )}
    </div>
  );
}

export default AmendmentsTable;