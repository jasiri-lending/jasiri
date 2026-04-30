import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    XMarkIcon,
    ExclamationTriangleIcon,
    UserIcon,
    ArrowPathRoundedSquareIcon,
    ShieldCheckIcon,
    LockClosedIcon,
    ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../hooks/userAuth';
import Spinner from '../../components/Spinner';

// ─────────────────────────────────────────────────────────────
// SHARED LOCK FORM — used by both the Page and the Modal
// ─────────────────────────────────────────────────────────────
function LockUserForm({ user, onSuccess, onCancel, tenantId }) {
    const [usage, setUsage] = useState({ customers: 0, loans: 0, leads: 0 });
    const [loadingUsage, setLoadingUsage] = useState(true);
    const [officers, setOfficers] = useState([]);
    const [selectedOfficer, setSelectedOfficer] = useState('');
    const [lockOption, setLockOption] = useState('transfer');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user?.id) { fetchUsage(); fetchOfficers(); }
    }, [user?.id]);

    useEffect(() => {
        const total = usage.customers + usage.loans + usage.leads;
        setLockOption(total === 0 ? 'lock' : 'transfer');
    }, [usage]);

    const fetchUsage = async () => {
        try {
            setLoadingUsage(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-admin/usage/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setUsage(data.usage);
        } catch (err) {
            console.error('Error fetching usage:', err);
        } finally {
            setLoadingUsage(false);
        }
    };

    const fetchOfficers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, role')
                .eq('tenant_id', tenantId)
                .neq('id', user.id)
                .eq('status', 'ACTIVE')
                .order('full_name');
            if (!error) setOfficers(data || []);
        } catch (err) {
            console.error('Error fetching officers:', err);
        }
    };

    const handleLock = async (e) => {
        e.preventDefault();
        const totalRecords = usage.customers + usage.loans + usage.leads;
        if (lockOption === 'transfer' && !selectedOfficer && totalRecords > 0) {
            setError('Please select an officer to receive the transferred records.');
            return;
        }
        if (!reason.trim()) {
            setError('A reason is required before locking this account.');
            return;
        }
        try {
            setSubmitting(true);
            setError('');
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-admin/lock/${user.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transferToUserId: lockOption === 'transfer' ? selectedOfficer : null,
                    reason
                })
            });
            const data = await res.json();
            if (data.success) { onSuccess(); }
            else { setError(data.error || 'Failed to lock account. Please try again.'); }
        } catch (err) {
            setError('A network error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const totalRecords = usage.customers + usage.loans + usage.leads;

    return (
        <form onSubmit={handleLock} className="space-y-5">

            {/* Record Ownership */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500">Record Ownership</p>
                    {loadingUsage && <span className="text-[10px] text-blue-500 animate-pulse">Loading...</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: 'Customers', value: usage.customers },
                        { label: 'Loans', value: usage.loans },
                        { label: 'Leads', value: usage.leads },
                    ].map(item => (
                        <div key={item.label} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-center">
                            <p className="text-sm font-semibold text-gray-700">{item.value}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Strategy Toggle */}
            <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Lock Strategy</p>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                        type="button"
                        onClick={() => setLockOption('lock')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${lockOption === 'lock' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <LockClosedIcon className="h-3 w-3" />
                        Just Lock
                    </button>
                    <button
                        type="button"
                        onClick={() => setLockOption('transfer')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${lockOption === 'transfer' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <ArrowPathRoundedSquareIcon className="h-3 w-3" />
                        Lock & Transfer
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                    {lockOption === 'lock'
                        ? 'Account access will be disabled. Records remain assigned to this user.'
                        : 'Account access will be disabled and all records will be reassigned.'}
                </p>
            </div>

            {/* Transfer Officer */}
            {lockOption === 'transfer' && (
                <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1.5">
                        Assign records to <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                        <select
                            value={selectedOfficer}
                            onChange={(e) => setSelectedOfficer(e.target.value)}
                            required
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none appearance-none"
                        >
                            <option value="">Select active officer...</option>
                            {officers.map(off => (
                                <option key={off.id} value={off.id}>
                                    {off.full_name} — {off.role?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                    {totalRecords > 0 && !selectedOfficer && (
                        <p className="text-[10px] text-amber-500 mt-1">{totalRecords} record{totalRecords !== 1 ? 's' : ''} pending reassignment</p>
                    )}
                </div>
            )}

            {/* Reason */}
            <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">
                    Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Employee resigned effective 30/04/2026..."
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none min-h-[80px] resize-none transition-all"
                    required
                />
            </div>

            {/* Inline Error */}
            {error && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500 shrink-0 mt-px" />
                    <p className="text-xs text-red-600">{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={submitting || (lockOption === 'transfer' && totalRecords > 0 && !selectedOfficer)}
                    className={`flex-1 px-3 py-2 text-xs font-medium text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${lockOption === 'transfer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                    {submitting ? (
                        <><Spinner size="xs" color="white" />Processing...</>
                    ) : lockOption === 'transfer' ? (
                        <><ArrowPathRoundedSquareIcon className="h-3.5 w-3.5" />Lock & Transfer</>
                    ) : (
                        <><ShieldCheckIcon className="h-3.5 w-3.5" />Lock Account</>
                    )}
                </button>
            </div>
        </form>
    );
}

// ─────────────────────────────────────────────────────────────
// MODAL EXPORT (named)
// ─────────────────────────────────────────────────────────────
export function LockUserModal({ isOpen, onClose, user, onLocked }) {
    const { profile } = useAuth();
    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden">
                {/* Modal Header */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-red-50 rounded-lg border border-red-100">
                            <ShieldCheckIcon className="h-4 w-4 text-red-500" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-700">Lock Account</p>
                            <p className="text-[10px] text-gray-400">{user.full_name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* User Banner */}
                <div className="px-5 pt-4">
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3">
                        <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0">
                            {user.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">{user.full_name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                        </div>
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full whitespace-nowrap">
                            {user.status || 'ACTIVE'}
                        </span>
                    </div>
                </div>

                <div className="p-5">
                    <LockUserForm
                        user={user}
                        tenantId={profile?.tenant_id}
                        onSuccess={() => { onLocked(); onClose(); }}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// PAGE EXPORT (default) — /admin/users/:userId/lock
// ─────────────────────────────────────────────────────────────
const LockUserPage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');

    useEffect(() => {
        if (userId) fetchUserDetails();
    }, [userId]);

    const fetchUserDetails = async () => {
        try {
            const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
            if (error) throw error;
            setUser(data);
        } catch (err) {
            setFetchError('Could not load user details.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Spinner text="Loading..." />
            </div>
        );
    }

    if (fetchError || !user) {
        return (
            <div className="max-w-lg mx-auto mt-12 p-6 bg-white rounded-xl border border-red-100 text-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-1">Unable to load user</p>
                <p className="text-xs text-gray-400 mb-5">{fetchError || 'User not found.'}</p>
                <button
                    onClick={() => navigate('/users/all/admin')}
                    className="px-4 py-2 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    ← Back to Users
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            {/* Breadcrumb */}
            <button
                onClick={() => navigate('/users/all/admin')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-primary transition-colors mb-5"
            >
                <ChevronLeftIcon className="h-3 w-3" />
                Back to User Management
            </button>

            {/* Page Title */}
            <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-gray-700">Lock Account</p>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-red-500 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                    <ShieldCheckIcon className="h-3 w-3" />
                    Restricted Action
                </span>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* User Identity Strip */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 bg-gray-50/60">
                    <div className="h-9 w-9 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                        {user.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{user.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {user.status || 'ACTIVE'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                            {user.role?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </span>
                    </div>
                </div>

                {/* Form Body */}
                <div className="px-5 py-5">
                    <LockUserForm
                        user={user}
                        tenantId={profile?.tenant_id}
                        onSuccess={() => navigate('/users/all/admin')}
                        onCancel={() => navigate('/users/all/admin')}
                    />
                </div>
            </div>

            {/* Footer Note */}
            <p className="text-center text-[10px] text-gray-300 mt-4">
                This action is logged and tied to your account
            </p>
        </div>
    );
};

export default LockUserPage;
