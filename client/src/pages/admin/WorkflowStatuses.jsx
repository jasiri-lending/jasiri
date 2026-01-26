// src/pages/admin/WorkflowStatuses.jsx
import { useState } from 'react';
import { Plus, Search, Edit, Trash2, CheckCircle } from 'lucide-react';

const WorkflowStatuses = () => {
    const [statuses, setStatuses] = useState([
        { id: 1, name: 'Pending Review', color: '#FFA500', workflow: 'Loan Approval', order: 1, status: 'Active' },
        { id: 2, name: 'Approved', color: '#00FF00', workflow: 'Loan Approval', order: 2, status: 'Active' },
        { id: 3, name: 'Rejected', color: '#FF0000', workflow: 'Loan Approval', order: 3, status: 'Active' },
    ]);
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Workflow Statuses</h1>
                <p className="text-gray-600 mt-1">Manage workflow status configurations</p>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search statuses..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    />
                </div>
                <button className="ml-4 flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors">
                    <Plus className="h-5 w-5 mr-2" />
                    Add Status
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Color
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Workflow
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Order
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {statuses.map((status) => (
                            <tr key={status.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <CheckCircle className="h-5 w-5 text-gray-400 mr-2" />
                                        <span className="text-sm font-medium text-gray-900">{status.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div
                                            className="h-4 w-4 rounded-full mr-2"
                                            style={{ backgroundColor: status.color }}
                                        />
                                        <span className="text-sm text-gray-500">{status.color}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {status.workflow}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {status.order}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                        {status.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex space-x-2">
                                        <button className="text-brand-primary hover:text-brand-primary/80">
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button className="text-red-600 hover:text-red-800">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WorkflowStatuses;
