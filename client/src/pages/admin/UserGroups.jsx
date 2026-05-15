import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Users, X, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../hooks/userAuth';
import { supabase } from '../../supabaseClient';

const UserGroups = () => {
    const [groups, setGroups] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
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
        e.preventDefault();
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

    const filteredGroups = groups.filter(g => 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-8 bg-brand-surface min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">User Groups</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage tenant user groups for collaborative workflows.</p>
                </div>

                {/* Actions Bar */}
                <div className="flex justify-between items-center mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Search user groups..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                        />
                    </div>
                    <button 
                        onClick={() => handleOpenModal()}
                        className="ml-4 flex items-center px-4 py-2.5 bg-brand-primary text-white text-sm font-medium rounded-xl hover:bg-brand-secondary transition-all shadow-sm active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add User Group
                    </button>
                </div>

                {/* Table Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Group Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Members
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-brand-primary mx-auto" />
                                        </td>
                                    </tr>
                                ) : filteredGroups.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-sm text-gray-500 italic">
                                            No user groups found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredGroups.map((group) => (
                                        <tr key={group.id} className="hover:bg-slate-50/50 transition-colors group/row">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mr-3">
                                                        <Users className="h-4 w-4 text-indigo-600" />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-900">{group.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {group.description || <span className="text-gray-300 italic">No description</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                    {group.user_group_members?.[0]?.count || 0} Members
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end space-x-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleOpenModal(group)}
                                                        className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-brand-50 rounded-lg transition-colors"
                                                        title="Edit Group"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(group.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete Group"
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
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={handleCloseModal}>
                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
                        </div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-slate-900">
                                        {editingGroup ? 'Edit User Group' : 'Create User Group'}
                                    </h3>
                                    <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-500">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <form onSubmit={handleSubmit}>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Group Name <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                placeholder="e.g. Credit Committee"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                            <textarea
                                                rows="3"
                                                value={formData.description}
                                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                                placeholder="What does this group do?"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-6 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-xl hover:bg-brand-secondary disabled:opacity-50"
                                        >
                                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            {editingGroup ? 'Save Changes' : 'Create Group'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserGroups;
