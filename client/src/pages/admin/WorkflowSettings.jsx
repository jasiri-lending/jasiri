import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, GitBranch, CheckCircle, Settings, Eye } from 'lucide-react';
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

    const filteredWorkflows = workflows.filter(w => 
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 bg-muted min-h-screen font-inter">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-sm  text-slate-600 ">Workflow Registry</h1>
                        <p className="text-xs text-slate-500  mt-1">Manage and monitor organizational process flows</p>
                    </div>
                    <button 
                        onClick={() => navigate('/workflow-setting/admin/builder/new')}
                        className="flex items-center px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl hover:bg-brand-secondary transition-all shadow-lg shadow-slate-200 active:scale-95"
                    >
                        <Plus className="h-3 w-3 mr-2" />
                        Create Workflow
                    </button>
                </div>

                {/* Stats / Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Processes', value: workflows.length, icon: GitBranch, color: 'text-slate-600', bg: 'bg-slate-100' },
                        { label: 'Active', value: workflows.filter(w => w.status === 'active').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Drafts', value: workflows.filter(w => w.status === 'draft').length, icon: Edit, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { label: 'System Types', value: 22, icon: Settings, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-500  mb-0.5">{stat.label}</p>
                                    <p className="text-xl font-black text-slate-600">{stat.value}</p>
                                </div>
                                <div className={`${stat.bg} p-2.5 rounded-xl`}>
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Table Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Filter workflows..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 transition-all text-xs font-medium"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/50">
                                <tr className="text-left text-xs text-slate-600 ">
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4">Process Type</th>
                                    <th className="px-6 py-4">Structure</th>
                                    <th className="px-6 py-4">Last Updated</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredWorkflows.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-xs text-slate-400 italic bg-slate-50/20">
                                            No workflows found matching your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWorkflows.map((workflow) => {
                                        const categories = {
                                            'Customer Management': ['customer_onboarding', 'customer_edits', 'customer_transfer', 'customer_exit', 'customer_blacklisting'],
                                            'Loan Lifecycle': ['loan_application', 'loan_disbursement', 'loan_restructuring', 'loan_write_off', 'loan_closure', 'loan_top_up'],
                                            'Finance & Accounting': ['journal_creation', 'refund_approval', 'penalty_approval', 'fee_waiver', 'transaction_reconciliation'],
                                            'System Configuration': ['credit_settings_change', 'penalty_settings_change', 'loan_product_config'],
                                            'Sales & Collections': ['lead_management', 'collections_recovery', 'collateral_management']
                                        };

                                        const getCategory = (type) => {
                                            for (const [cat, types] of Object.entries(categories)) {
                                                if (types.includes(type)) return cat;
                                            }
                                            return 'Operational';
                                        };

                                        const category = getCategory(workflow.type);

                                        return (
                                            <tr key={workflow.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-3.5">
                                                    <div className="flex items-center">
                                                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mr-2.5">
                                                            <GitBranch className="h-3.5 w-3.5 text-slate-500" />
                                                        </div>
                                                        <span className="text-xs whitespace-nowrap text-slate-600   ">
                                                            {category}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3.5">
                                                    <div>
                                                        <div className="text-xs  text-brand-primary font-semibold ">
                                                            {workflow.type.replace(/_/g, ' ')}
                                                        </div>
                                                        {workflow.name !== 'New Business Process' && (
                                                            <div className="text-xs whitespace-nowrap text-slate-400 font-medium italic mt-0.5">
                                                                Alias: {workflow.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3.5">
                                                <div className="flex items-center space-x-1.5">
                                                    <span className="text-[10px] whitespace-nowrap text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {workflow.steps_count || 0} Nodes
                                                    </span>
                                                   
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-[10px] whitespace-nowrap text-slate-500 font-medium">
                                                    {new Date(workflow.updated_at || workflow.created_at).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className={`px-2 py-0.5 text-[9px] whitespace-nowrap rounded-md ${
                                                    workflow.status === 'active' 
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                }`}>
                                                    {workflow.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 text-right">
                                                            <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => navigate(`/workflow-setting/admin/builder/${workflow.id}?view=true`)}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                    title="View Workflow"
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => navigate(`/workflow-setting/admin/builder/${workflow.id}`)}
                                                                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                                                                    title="Edit Workflow"
                                                                >
                                                                    <Edit className="h-3.5 w-3.5" />
                                                                </button>
                                                    <button 
                                                        onClick={async () => {
                                                            if (window.confirm("Delete this workflow?")) {
                                                                try {
                                                                    const { data: session } = await supabase.auth.getSession();
                                                                    await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/${workflow.id}`, {
                                                                        headers: { Authorization: `Bearer ${session.session?.access_token}` }
                                                                    });
                                                                    setWorkflows(prev => prev.filter(w => w.id !== workflow.id));
                                                                } catch (err) { console.error(err); }
                                                            }
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="mt-6 flex items-center justify-center space-x-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Multi-Tenant Workflow Engine Active</span>
                </div>
            </div>
        </div>
    );
};

export default WorkflowSettings;
