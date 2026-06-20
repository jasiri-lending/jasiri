// src/pages/admin/WorkflowStatuses.jsx
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import Modal from '../../components/Modal';
import CustomSelect from '../../components/CustomSelect';
import { SkeletonTable } from '../../components/Skeleton';

const WorkflowStatuses = () => {
    const [statuses, setStatuses] = useState([
        { id: 1, name: 'Pending Review', color: '#FFA500', workflow: 'Loan Approval', order: 1, status: 'Active' },
        { id: 2, name: 'Approved', color: '#00FF00', workflow: 'Loan Approval', order: 2, status: 'Active' },
        { id: 3, name: 'Rejected', color: '#FF0000', workflow: 'Loan Approval', order: 3, status: 'Active' },
    ]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('order-asc');
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        color: '#1A7A4A',
        workflow: 'Loan Approval',
        order: 1,
        status: 'Active'
    });

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [statusToDelete, setStatusToDelete] = useState(null);

    // Simulate initial loading for Skeleton effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleOpenModal = (status = null) => {
        if (status) {
            setEditingStatus(status);
            setFormData({
                name: status.name,
                color: status.color,
                workflow: status.workflow,
                order: status.order,
                status: status.status
            });
        } else {
            setEditingStatus(null);
            setFormData({
                name: '',
                color: '#1A7A4A',
                workflow: 'Loan Approval',
                order: statuses.length + 1,
                status: 'Active'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingStatus(null);
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (!formData.name.trim()) return;

        if (editingStatus) {
            setStatuses(prev => prev.map(s => s.id === editingStatus.id ? { ...s, ...formData } : s));
        } else {
            const newStatus = {
                id: Date.now(),
                ...formData
            };
            setStatuses(prev => [...prev, newStatus]);
        }
        handleCloseModal();
    };

    const handleDeleteClick = (status) => {
        setStatusToDelete(status);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (statusToDelete) {
            setStatuses(prev => prev.filter(s => s.id !== statusToDelete.id));
            setIsDeleteModalOpen(false);
            setStatusToDelete(null);
        }
    };

    const workflowOptions = [
        { value: 'Loan Approval', label: 'Loan Approval' },
        { value: 'Customer Exit', label: 'Customer Exit' },
        { value: 'Transaction Reconciliation', label: 'Transaction Reconciliation' }
    ];

    const statusOptions = [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' }
    ];

    const sortOptions = [
        { value: 'order-asc', label: 'Order (Ascending)' },
        { value: 'order-desc', label: 'Order (Descending)' },
        { value: 'name-asc', label: 'Name (A-Z)' },
    ];

    const filteredStatuses = statuses
        .filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.workflow.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'order-asc') {
                return a.order - b.order;
            } else if (sortBy === 'order-desc') {
                return b.order - a.order;
            } else if (sortBy === 'name-asc') {
                return a.name.localeCompare(b.name);
            }
            return 0;
        });

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 animate-fade-in font-outfit w-full">
            <div className="w-full space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-heading">Workflow Statuses</h1>
                        <p className="text-sm text-muted mt-1">Manage workflow status configurations</p>
                    </div>
                </div>

                {/* Actions & Filters Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-3 w-full md:max-w-xl items-center">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Search statuses..."
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
                        onClick={() => handleOpenModal()}
                        className="f-btn flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm w-fit self-end md:self-auto"
                    >
                        <Plus className="h-4 w-4" />
                        Add Status
                    </button>
                </div>

                {/* Main Table Card */}
                {isLoading ? (
                    <SkeletonTable rows={4} cols={6} />
                ) : filteredStatuses.length === 0 ? (
                    <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
                        <CheckCircle className="h-10 w-10 text-muted/30 mx-auto mb-3" />
                        <p className="text-sm text-muted italic">No statuses found matching your search.</p>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border-light">
                                <thead className="bg-surface/50 border-b border-border-light">
                                    <tr className="text-left text-xs font-bold text-heading uppercase tracking-wider">
                                        <th className="px-6 py-4">Status Name</th>
                                        <th className="px-6 py-4">Color</th>
                                        <th className="px-6 py-4">Workflow</th>
                                        <th className="px-6 py-4">Order</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light bg-card">
                                    {filteredStatuses.map((status) => (
                                        <tr key={status.id} className="hover:bg-surface/30 transition-colors border-b border-border-light last:border-0 group/row">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <CheckCircle className="h-4 w-4 text-brand mr-2.5" />
                                                    <span className="text-sm font-semibold text-heading">{status.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div
                                                        className="h-3.5 w-3.5 rounded-full mr-2 shadow-sm border border-black/10"
                                                        style={{ backgroundColor: status.color }}
                                                    />
                                                    <span className="text-xs text-muted font-mono">{status.color}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-body">
                                                {status.workflow}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-body">
                                                {status.order}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                                                    status.status === 'Active' 
                                                        ? 'bg-success-fill/50 text-success-text border border-success-fill/50' 
                                                        : 'bg-surface text-muted border border-border'
                                                }`}>
                                                    {status.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                <div className="flex items-center justify-end space-x-1.5 md:opacity-60 group-hover/row:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleOpenModal(status)}
                                                        className="p-1.5 text-muted hover:text-heading hover:bg-surface rounded-lg transition-all"
                                                        title="Edit Status"
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClick(status)}
                                                        className="p-1.5 text-muted hover:text-danger-DEFAULT hover:bg-danger-fill/30 border border-transparent hover:border-danger-fill/50 rounded-lg transition-all"
                                                        title="Delete Status"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal
                open={isModalOpen}
                title={editingStatus ? 'Edit Workflow Status' : 'Add Workflow Status'}
                onClose={handleCloseModal}
                onSave={handleSubmit}
                saveLabel={editingStatus ? 'Save Changes' : 'Create Status'}
            >
                <form onSubmit={handleSubmit} className="space-y-4 font-outfit text-xs">
                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                            Status Name <span className="text-danger-DEFAULT">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-xs text-body shadow-sm"
                            placeholder="e.g. Awaiting Escalation"
                            autoFocus
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-heading mb-1.5">
                                Status Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="w-8 h-8 rounded border border-border cursor-pointer p-0.5"
                                />
                                <span className="text-xs font-mono text-muted">{formData.color}</span>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-semibold text-heading mb-1.5">
                                Display Order
                            </label>
                            <input
                                type="number"
                                required
                                value={formData.order}
                                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-xs text-body shadow-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                            Workflow Process
                        </label>
                        <CustomSelect
                            value={formData.workflow}
                            onChange={(val) => setFormData({ ...formData, workflow: val })}
                            options={workflowOptions}
                            compact={true}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                            Status State
                        </label>
                        <CustomSelect
                            value={formData.status}
                            onChange={(val) => setFormData({ ...formData, status: val })}
                            options={statusOptions}
                            compact={true}
                        />
                    </div>

                    <button type="submit" className="hidden" />
                </form>
            </Modal>

            {/* Delete Modal */}
            <Modal
                open={isDeleteModalOpen}
                title="Delete Workflow Status"
                onClose={() => setIsDeleteModalOpen(false)}
                onSave={handleConfirmDelete}
                saveLabel="Delete"
            >
                <div className="space-y-3 font-outfit text-sm">
                    <div className="flex items-center gap-2.5 text-danger-DEFAULT font-semibold">
                        <AlertCircle className="h-5 w-5" />
                        <span>Warning: Permanent Action</span>
                    </div>
                    <p className="text-body leading-relaxed">
                        Are you sure you want to delete status <span className="font-bold text-heading">"{statusToDelete?.name}"</span>?
                    </p>
                    <p className="text-xs text-muted">
                        This status may be referenced by current or historic workflow instances. Deleting this config could lead to workflow configuration inconsistencies.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default WorkflowStatuses;
