// src/pages/admin/Partners.jsx
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Building2, AlertCircle } from 'lucide-react';
import Modal from '../../components/Modal';
import CustomSelect from '../../components/CustomSelect';
import { SkeletonTable } from '../../components/Skeleton';

const Partners = () => {
    const [partners, setPartners] = useState([
        { id: 1, name: 'ABC Financial Services', type: 'Financial Institution', contact: 'john@abc.com', status: 'Active' },
        { id: 2, name: 'XYZ Insurance', type: 'Insurance Provider', contact: 'info@xyz.com', status: 'Active' },
    ]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name-asc');
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'Financial Institution',
        contact: '',
        status: 'Active'
    });

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [partnerToDelete, setPartnerToDelete] = useState(null);

    // Simulate initial loading for Skeleton effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleOpenModal = (partner = null) => {
        if (partner) {
            setEditingPartner(partner);
            setFormData({
                name: partner.name,
                type: partner.type,
                contact: partner.contact,
                status: partner.status
            });
        } else {
            setEditingPartner(null);
            setFormData({
                name: '',
                type: 'Financial Institution',
                contact: '',
                status: 'Active'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPartner(null);
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (!formData.name.trim() || !formData.contact.trim()) return;

        if (editingPartner) {
            setPartners(prev => prev.map(p => p.id === editingPartner.id ? { ...p, ...formData } : p));
        } else {
            const newPartner = {
                id: Date.now(),
                ...formData
            };
            setPartners(prev => [...prev, newPartner]);
        }
        handleCloseModal();
    };

    const handleDeleteClick = (partner) => {
        setPartnerToDelete(partner);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (partnerToDelete) {
            setPartners(prev => prev.filter(p => p.id !== partnerToDelete.id));
            setIsDeleteModalOpen(false);
            setPartnerToDelete(null);
        }
    };

    const partnerTypeOptions = [
        { value: 'Financial Institution', label: 'Financial Institution' },
        { value: 'Insurance Provider', label: 'Insurance Provider' },
        { value: 'Technology Partner', label: 'Technology Partner' },
        { value: 'Broker/Agent', label: 'Broker/Agent' },
    ];

    const statusOptions = [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' }
    ];

    const sortOptions = [
        { value: 'name-asc', label: 'Name (A-Z)' },
        { value: 'type-asc', label: 'Partner Type' },
        { value: 'status-asc', label: 'Status' },
    ];

    const filteredPartners = partners
        .filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.contact.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'name-asc') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'type-asc') {
                return a.type.localeCompare(b.type);
            } else if (sortBy === 'status-asc') {
                return a.status.localeCompare(b.status);
            }
            return 0;
        });

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 animate-fade-in font-outfit w-full">
            <div className="w-full space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-heading">Partners</h1>
                        <p className="text-sm text-muted mt-1">Manage tenant workflow partners and integrations.</p>
                    </div>
                </div>

                {/* Actions & Filters Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-3 w-full md:max-w-xl items-center">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Search partners..."
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
                        Add Partner
                    </button>
                </div>

                {/* Main Table Card */}
                {isLoading ? (
                    <SkeletonTable rows={4} cols={5} />
                ) : filteredPartners.length === 0 ? (
                    <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
                        <Building2 className="h-10 w-10 text-muted/30 mx-auto mb-3" />
                        <p className="text-sm text-muted italic">No partners found matching your search.</p>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border-light">
                                <thead className="bg-surface/50 border-b border-border-light">
                                    <tr className="text-left text-xs font-bold text-heading uppercase tracking-wider">
                                        <th className="px-6 py-4">Partner Name</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light bg-card">
                                    {filteredPartners.map((partner) => (
                                        <tr key={partner.id} className="hover:bg-surface/30 transition-colors border-b border-border-light last:border-0 group/row">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-8 h-8 rounded-lg bg-surface text-brand flex items-center justify-center mr-3 border border-border-light shadow-sm">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-heading">{partner.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-body">
                                                {partner.type}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-muted">
                                                {partner.contact}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                                                    partner.status === 'Active' 
                                                        ? 'bg-success-fill/50 text-success-text border border-success-fill/50' 
                                                        : 'bg-surface text-muted border border-border'
                                                }`}>
                                                    {partner.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                <div className="flex items-center justify-end space-x-1.5 md:opacity-60 group-hover/row:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleOpenModal(partner)}
                                                        className="p-1.5 text-muted hover:text-heading hover:bg-surface rounded-lg transition-all"
                                                        title="Edit Partner"
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClick(partner)}
                                                        className="p-1.5 text-muted hover:text-danger-DEFAULT hover:bg-danger-fill/30 border border-transparent hover:border-danger-fill/50 rounded-lg transition-all"
                                                        title="Delete Partner"
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
                title={editingPartner ? 'Edit Partner' : 'Add Partner'}
                onClose={handleCloseModal}
                onSave={handleSubmit}
                saveLabel={editingPartner ? 'Save Changes' : 'Create Partner'}
            >
                <form onSubmit={handleSubmit} className="space-y-4 font-outfit text-xs">
                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                            Partner Name <span className="text-danger-DEFAULT">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-xs text-body shadow-sm"
                            placeholder="e.g. ABC Financial Services"
                            autoFocus
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                            Contact Email <span className="text-danger-DEFAULT">*</span>
                        </label>
                        <input
                            type="email"
                            required
                            value={formData.contact}
                            onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-xs text-body shadow-sm"
                            placeholder="e.g. contact@domain.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                            Partner Type
                        </label>
                        <CustomSelect
                            value={formData.type}
                            onChange={(val) => setFormData({ ...formData, type: val })}
                            options={partnerTypeOptions}
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
                title="Delete Partner"
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
                        Are you sure you want to delete partner <span className="font-bold text-heading">"{partnerToDelete?.name}"</span>?
                    </p>
                    <p className="text-xs text-muted">
                        This partner will be permanently removed from your registry dashboard. All workflow configurations that utilize this partner integration may face errors.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default Partners;
