import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, GitBranch, Settings, Eye, Copy, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../hooks/userAuth';
import { supabase } from '../../supabaseClient';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import CustomSelect from '../../components/CustomSelect';
import { SkeletonTable } from '../../components/Skeleton';

const WorkflowSettings = () => {
    const [workflows, setWorkflows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('updated-desc');
    const [isLoading, setIsLoading] = useState(true);
    
    // Delete Modal State
    const [workflowToDelete, setWorkflowToDelete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const navigate = useNavigate();
    const { user } = useAuth();
    const { success: toastSuccess, error: toastError } = useToast();

    const fetchWorkflows = async () => {
        setIsLoading(true);
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
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const handleDeleteClick = (workflow) => {
        setWorkflowToDelete(workflow);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!workflowToDelete) return;
        setIsDeleting(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            const response = await axios.delete(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/${workflowToDelete.id}`,
                {
                    headers: { Authorization: `Bearer ${session.session?.access_token}` }
                }
            );
            if (response.data.success) {
                setWorkflows(prev => prev.filter(w => w.id !== workflowToDelete.id));
                toastSuccess("Workflow deleted successfully");
                setIsDeleteModalOpen(false);
                setWorkflowToDelete(null);
            } else {
                toastError(response.data.error || "Failed to delete workflow");
            }
        } catch (err) {
            console.error(err);
            toastError(err.response?.data?.error || err.message || "An error occurred while deleting the workflow");
        } finally {
            setIsDeleting(false);
        }
    };

    const sortOptions = [
        { value: 'updated-desc', label: 'Last Updated (Newest)' },
        { value: 'updated-asc', label: 'Last Updated (Oldest)' },
        { value: 'name-asc', label: 'Name (A-Z)' },
        { value: 'steps-desc', label: 'Most Nodes' },
    ];

    const filteredWorkflows = workflows
        .filter(w => 
            w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            w.type.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'updated-desc') {
                return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
            } else if (sortBy === 'updated-asc') {
                return new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at);
            } else if (sortBy === 'name-asc') {
                return a.type.localeCompare(b.type);
            } else if (sortBy === 'steps-desc') {
                return (b.steps_count || 0) - (a.steps_count || 0);
            }
            return 0;
        });

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 animate-fade-in font-outfit w-full">
            <div className="w-full space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-heading flex items-center gap-2">
                            <Settings className="h-6 w-6 text-brand" />
                            Workflow Registry
                        </h1>
                        <p className="text-sm text-muted mt-1">Manage and monitor organizational business process flows</p>
                    </div>
                </div>

                {/* Actions & Filters Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-3 w-full md:max-w-xl items-center">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Filter workflows..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 w-full bg-card border border-border text-body rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder:text-muted/60 text-sm shadow-sm"
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="text-xs font-semibold text-muted whitespace-nowrap">Sort:</span>
                            <div className="w-48">
                                <CustomSelect
                                    value={sortBy}
                                    onChange={setSortBy}
                                    options={sortOptions}
                                    compact={true}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => navigate('/workflow-setting/admin/builder/new')}
                        className="f-btn flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm w-fit self-end md:self-auto"
                    >
                        <Plus className="h-4 w-4" />
                        Create Workflow
                    </button>
                </div>

                {/* Main Table Card */}
                {isLoading ? (
                    <SkeletonTable rows={5} cols={6} />
                ) : filteredWorkflows.length === 0 ? (
                    <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
                        <GitBranch className="h-10 w-10 text-muted/30 mx-auto mb-3" />
                        <p className="text-sm text-muted italic">No workflows found matching your search.</p>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border-light">
                                <thead className="bg-surface/50 border-b border-border-light">
                                    <tr className="text-left text-xs font-bold text-heading uppercase tracking-wider">
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4">Process Type</th>
                                        <th className="px-6 py-4">Structure</th>
                                        <th className="px-6 py-4">Last Updated</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light bg-card">
                                    {filteredWorkflows.map((workflow) => {
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
                                            <tr key={workflow.id} className="hover:bg-surface/30 transition-colors border-b border-border-light last:border-0 group/row">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="w-8 h-8 rounded-lg bg-surface text-brand flex items-center justify-center mr-3 border border-border-light shadow-sm">
                                                            <GitBranch className="h-4 w-4" />
                                                        </div>
                                                        <span className="text-sm font-semibold text-heading">
                                                            {category}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-xs text-brand font-bold uppercase">
                                                            {workflow.type.replace(/_/g, ' ')}
                                                        </div>
                                                        {workflow.name !== 'New Business Process' && (
                                                            <div className="text-[10px] text-muted font-medium italic mt-0.5">
                                                                Alias: {workflow.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface text-brand border border-border-light shadow-sm">
                                                        {workflow.steps_count || 0} Nodes
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-xs text-muted font-medium">
                                                        {new Date(workflow.updated_at || workflow.created_at).toLocaleDateString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-2">
                                                        <span className={`px-2 py-0.5 text-[9px] font-bold whitespace-nowrap rounded-md ${
                                                            workflow.status === 'active' 
                                                                ? 'bg-success-fill/50 text-success-text border border-success-fill/50' 
                                                                : 'bg-surface text-muted border border-border'
                                                        }`}>
                                                            {workflow.status.toUpperCase()}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-muted bg-card px-1.5 py-0.5 rounded border border-border">
                                                            v{workflow.version || 1}.0
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                    <div className="flex items-center justify-end space-x-1.5 md:opacity-60 group-hover/row:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => navigate(`/workflow-setting/admin/builder/new?clone=${workflow.id}`)}
                                                            className="p-1.5 text-muted hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                                                            title="Clone Workflow"
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => navigate(`/workflow-setting/admin/builder/${workflow.id}?view=true`)}
                                                            className="p-1.5 text-muted hover:text-brand hover:bg-surface rounded-lg transition-all"
                                                            title="View Workflow"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => navigate(`/workflow-setting/admin/builder/${workflow.id}`)}
                                                            className="p-1.5 text-muted hover:text-heading hover:bg-surface rounded-lg transition-all"
                                                            title="Edit Workflow"
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteClick(workflow)}
                                                            className="p-1.5 text-muted hover:text-danger-DEFAULT hover:bg-danger-fill/30 border border-transparent hover:border-danger-fill/50 rounded-lg transition-all"
                                                            title="Delete Workflow"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                <div className="mt-6 flex items-center justify-center space-x-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                     <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Multi-Tenant Workflow Engine Active</span>
                </div>
            </div>

            {/* Confirm Delete Modal */}
            <Modal
                open={isDeleteModalOpen}
                title="Delete Workflow"
                onClose={() => setIsDeleteModalOpen(false)}
                onSave={handleConfirmDelete}
                saving={isDeleting}
                saveLabel="Delete"
            >
                <div className="space-y-3 font-outfit text-sm">
                    <div className="flex items-center gap-2.5 text-danger-DEFAULT font-semibold">
                        <AlertCircle className="h-5 w-5" />
                        <span>Warning: Permanent Action</span>
                    </div>
                    <p className="text-body leading-relaxed">
                        Are you sure you want to delete the workflow <span className="font-bold text-heading">"{workflowToDelete?.type.replace(/_/g, ' ')}"</span>?
                    </p>
                    <p className="text-xs text-muted">
                        This will permanently delete all associated workflow configurations, steps, logic, instances, and logs. This action cannot be undone.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default WorkflowSettings;
