import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../hooks/userAuth';
import { supabase } from '../../supabaseClient';

const WorkflowSettings = () => {
    const [workflows, setWorkflows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        const fetchWorkflows = async () => {
            try {
                const { data: session } = await supabase.auth.getSession();
                const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows`, {
                    headers: { Authorization: `Bearer ${session.session?.access_token}` }
                });
                if (response.data.success) {
                    setWorkflows(response.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch workflows", error);
            }
        };
        fetchWorkflows();
    }, []);

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Workflow Settings</h1>
                <p className="text-gray-600 mt-1">Configure and manage workflow processes</p>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search workflows..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    />
                </div>
                <button 
                    onClick={() => navigate('/workflow-setting/admin/builder/new')}
                    className="ml-4 flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Workflow
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Workflow Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Steps
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
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
                        {workflows.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-10 text-center text-gray-500 italic">
                                    No workflows defined yet. Click "Add Workflow" to get started.
                                </td>
                            </tr>
                        ) : (
                            workflows.map((workflow) => (
                                <tr key={workflow.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <GitBranch className="h-5 w-5 text-gray-400 mr-2" />
                                            <span className="text-sm font-medium text-gray-900">{workflow.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {workflow.steps_count} steps
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {workflow.type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${workflow.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {workflow.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex space-x-2">
                                            <button 
                                                onClick={() => navigate(`/workflow-setting/admin/builder/${workflow.id}`)}
                                                className="text-brand-primary hover:text-brand-primary/80"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={async () => {
                                                    if (window.confirm("Are you sure you want to delete this workflow?")) {
                                                        try {
                                                            const { data: session } = await supabase.auth.getSession();
                                                            await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/${workflow.id}`, {
                                                                headers: { Authorization: `Bearer ${session.session?.access_token}` }
                                                            });
                                                            setWorkflows(prev => prev.filter(w => w.id !== workflow.id));
                                                        } catch (err) {
                                                            console.error(err);
                                                            alert("Failed to delete workflow");
                                                        }
                                                    }
                                                }}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WorkflowSettings;
