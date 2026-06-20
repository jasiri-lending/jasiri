import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Users, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../hooks/userAuth';
import { supabase } from '../../supabaseClient';
import Modal from '../../components/Modal';
import CustomSelect from '../../components/CustomSelect';
import { SkeletonTable } from '../../components/Skeleton';

const UserGroups = () => {
    const [groups, setGroups] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name-asc');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const { user } = useAuth();
    
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            const response = await axios.get(`${API_URL}/api/groups`, {
                headers: { Authorization: `Bearer ${session.session?.access_token}` }
            });
            if (response.data.success) {
                setGroups(response.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch groups:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleOpenModal = (group = null) => {
        if (group) {
            setEditingGroup(group);
            setFormData({
                name: group.name,
                description: group.description || ''
            });
        } else {
            setEditingGroup(null);
            setFormData({ name: '', description: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingGroup(null);
        setFormData({ name: '', description: '' });
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setIsSubmitting(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            const headers = { Authorization: `Bearer ${session.session?.access_token}` };

            if (editingGroup) {
                await axios.put(`${API_URL}/api/groups/${editingGroup.id}`, formData, { headers });
            } else {
                await axios.post(`${API_URL}/api/groups`, formData, { headers });
            }
            
            await fetchGroups();
            handleCloseModal();
        } catch (error) {
            console.error("Failed to save group:", error);
            alert(error.response?.data?.error || "Failed to save group");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this group?")) return;
        
        try {
            const { data: session } = await supabase.auth.getSession();
            await axios.delete(`${API_URL}/api/groups/${id}`, {
                headers: { Authorization: `Bearer ${session.session?.access_token}` }
            });
            await fetchGroups();
        } catch (error) {
            console.error("Failed to delete group:", error);
            alert(error.response?.data?.error || "Failed to delete group");
        }
    };

    const sortOptions = [
        { value: 'name-asc', label: 'Name (A-Z)' },
        { value: 'name-desc', label: 'Name (Z-A)' },
        { value: 'members-desc', label: 'Most Members' },
        { value: 'members-asc', label: 'Least Members' },
    ];

    const filteredGroups = groups
        .filter(g => 
            g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
            const countA = a.user_group_members?.[0]?.count || 0;
            const countB = b.user_group_members?.[0]?.count || 0;
            if (sortBy === 'name-asc') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'name-desc') {
                return b.name.localeCompare(a.name);
            } else if (sortBy === 'members-desc') {
                return countB - countA;
            } else if (sortBy === 'members-asc') {
                return countA - countB;
            }
            return 0;
        });

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 animate-fade-in font-outfit">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-heading">User Groups</h1>
                        <p className="text-sm text-muted mt-1">Manage tenant user groups for collaborative workflows.</p>
                    </div>
                    
                    <button 
                        onClick={() => handleOpenModal()}
                        className="f-btn flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm w-fit self-end md:self-auto"
                    >
                        <Plus className="h-4 w-4" />
                        Add User Group
                    </button>
                </div>

                {/* Actions & Filters Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search user groups..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full bg-card border border-border text-body rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder:text-muted/60 text-sm shadow-sm"
                        />
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <span className="text-xs font-semibold text-muted whitespace-nowrap">Sort By:</span>
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

                {/* Table Section */}
                {isLoading ? (
                    <SkeletonTable rows={5} cols={4} />
                ) : filteredGroups.length === 0 ? (
                    <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
                        <Users className="h-10 w-10 text-muted/30 mx-auto mb-3" />
                        <p className="text-sm text-muted italic">No user groups found.</p>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border-light">
                                <thead className="bg-surface/50 border-b border-border-light">
                                    <tr>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-heading uppercase tracking-wider">
                                            Group Name
                                        </th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-heading uppercase tracking-wider">
                                            Description
                                        </th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-heading uppercase tracking-wider">
                                            Members
                                        </th>
                                        <th className="px-6 py-3.5 text-right text-xs font-bold text-heading uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border-light">
                                    {filteredGroups.map((group) => (
                                        <tr key={group.id} className="hover:bg-surface/30 transition-colors group/row">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-8 h-8 rounded-lg bg-surface text-brand flex items-center justify-center mr-3 border border-border-light shadow-sm">
                                                        <Users className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-heading">{group.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-muted max-w-xs truncate">
                                                {group.description || <span className="text-muted/40 italic">No description</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                 <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-surface text-brand border border-border-light shadow-sm">
                                                    {group.user_group_members?.[0]?.count || 0} Members
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                <div className="flex justify-end space-x-1.5 md:opacity-60 group-hover/row:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleOpenModal(group)}
                                                        className="p-1.5 text-muted hover:text-brand hover:bg-surface border border-transparent hover:border-border rounded-lg transition-all"
                                                        title="Edit Group"
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(group.id)}
                                                        className="p-1.5 text-muted hover:text-danger-DEFAULT hover:bg-danger-fill/30 border border-transparent hover:border-danger-fill/50 rounded-lg transition-all"
                                                        title="Delete Group"
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

            {/* Modal */}
            <Modal
                open={isModalOpen}
                title={editingGroup ? 'Edit User Group' : 'Create User Group'}
                onClose={handleCloseModal}
                onSave={handleSubmit}
                saving={isSubmitting}
                saveLabel={editingGroup ? 'Save Changes' : 'Create Group'}
            >
                <form onSubmit={handleSubmit} className="space-y-4 font-outfit text-xs">
                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                            Group Name <span className="text-danger-DEFAULT">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-xs text-body shadow-sm"
                            placeholder="e.g. Credit Committee"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">Description</label>
                        <textarea
                            rows="3"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-xs text-body shadow-sm"
                            placeholder="What does this group do?"
                        />
                    </div>
                    <button type="submit" className="hidden" />
                </form>
            </Modal>
        </div>
    );
};

export default UserGroups;
