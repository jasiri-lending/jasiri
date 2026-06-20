import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import {
    MagnifyingGlassIcon,
    UserIcon,
    PhoneIcon,
    CreditCardIcon,
    ArrowPathIcon,
    ArrowLeftIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    HashtagIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";
import { SkeletonForm } from '../../components/Skeleton';
import { apiFetch } from "../../utils/api";
import { usePermissions } from "../../hooks/usePermissions";

const ReconcileTransaction = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const toast = useToast();
    const { hasPermission } = usePermissions();

    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    useEffect(() => {
        if (id && profile?.tenant_id) {
            fetchTransactionDetails();
        }
    }, [id, profile?.tenant_id]);

    const fetchTransactionDetails = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('suspense_transactions')
                .select('*')
                .eq('id', id)
                .eq('tenant_id', profile.tenant_id)
                .single();

            if (error) throw error;
            setTransaction(data);
        } catch (error) {
            console.error('Error fetching transaction:', error);
            toast.error('Error fetching transaction details');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (value) => {
        setSearchTerm(value);
        if (value.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            let query = supabase
                .from("customers")
                .select("*")
                .eq('tenant_id', profile.tenant_id)
                .limit(10);

            const isNumeric = /^\d+$/.test(value);
            if (isNumeric) {
                query = query.or(
                    `Firstname.ilike.%${value}%,Middlename.ilike.%${value}%,Surname.ilike.%${value}%,mobile.ilike.%${value}%,id_number.eq.${value}`
                );
            } else {
                query = query.or(
                    `Firstname.ilike.%${value}%,Middlename.ilike.%${value}%,Surname.ilike.%${value}%,mobile.ilike.%${value}%`
                );
            }

            const { data, error } = await query;
            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            setSearching(false);
        }
    };

    const executeReconciliation = async () => {
        if (!transaction || !selectedCustomer) return;

        if (!hasPermission('transaction.reconcile')) {
            toast.error("You do not have permission to propose reconciliations.");
            return;
        }

        try {
            setIsProcessing(true);

            const response = await apiFetch(`/api/reconciliation/${transaction.id}/propose`, {
                method: 'POST',
                body: JSON.stringify({
                    tenant_id: profile.tenant_id,
                    proposed_customer_id: selectedCustomer.id,
                    reason: `Manual reconciliation proposed to ${selectedCustomer.Firstname} ${selectedCustomer.Surname}`
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Reconciliation submitted for approval');
                setTimeout(() => navigate('/accounting/transactions'), 1500);
            } else {
                throw new Error(data.error || 'Failed to submit reconciliation');
            }
        } catch (error) {
            console.error('Reconciliation error:', error);
            toast.error('Failed to submit: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
                <div className="max-w-5xl mx-auto"><SkeletonForm fields={6} /></div>
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="min-h-screen bg-page flex flex-col items-center justify-center p-4">
                <ExclamationCircleIcon className="w-14 h-14 text-danger mb-4" />
                <h2 className="text-2xl font-semibold text-heading mb-2">Transaction Not Found</h2>
                <p className="text-muted mb-6 text-base text-center max-w-sm">
                    The transaction you are looking for does not exist or you don't have permission to view it.
                </p>
                <button
                    onClick={() => navigate('/accounting/transactions')}
                    className="f-btn inline-flex items-center gap-2"
                >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to Transactions
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={() => navigate('/accounting/transactions')}
                        className="p-2 rounded-lg border border-border text-muted hover:text-brand-primary hover:border-brand-primary transition-all shadow-sm"
                    >
                        <ArrowLeftIcon className="w-3 h-3" />
                    </button>
                    <div>
                        <h1 className="text-sm font-outfit text-heading">Manual Reconciliation</h1>
                        {/* <p className="text-muted text-xs mt-0.5">Link suspense payment to a specific customer</p> */}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Left: Transaction Details */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
                            <h2 className="text-xs font-outfit text-heading mb-4 flex items-center gap-2 pb-3 border-b border-border-light">
                                <HashtagIcon className="w-3 h-3 text-heading" />
                                Payment Summary
                            </h2>

                            <div className="space-y-3">
                                {/* M-Pesa Reference */}
                                <div className="p-3.5 bg-surface rounded-lg border border-border-light">
                                    <p className="text-xs font-semibold font-outfit text-heading mb-1.5">M-Pesa Reference</p>
                                    <p className="text-sm font-semibold font-outfit text-brand-primary">{transaction.transaction_id}</p>
                                </div>

                                {/* Amount */}
                                <div className="p-3.5 bg-brand-primary/[0.04] rounded-lg border border-brand-primary/10">
                                    <p className="text-xs font-semibold text-brand-primary/60  mb-1.5">Amount</p>
                                    <p className="text-lg font-semibold text-brand-primary">
                                        KSh {parseFloat(transaction.amount).toLocaleString()}
                                    </p>
                                </div>

                                {/* Details */}
                                <div className="p-3.5 bg-surface rounded-lg border border-border-light">
                                    <p className="text-xs font-semibold font-outfit text-heading mb-3">Details</p>
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-muted font-outfit shrink-0">Payer</span>
                                            <span className="text-sm text-body font-medium text-right truncate">
                                                {transaction.payer_name || 'Anonymous'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-muted font-outfit shrink-0">Account no</span>
                                            <span className="text-sm text-body font-medium text-right">
                                                {transaction.phone_number}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-muted font-outfit shrink-0">Date</span>
                                            <span className="text-sm text-body font-medium text-right">
                                                {new Date(transaction.created_at).toLocaleDateString('en-GB', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Customer Search */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-xs font-semibold text-muted flex items-center gap-2">
                                    <UserIcon className="w-3 h-3 text-brand-primary/70 font-outfit" />
                                    Step 1: Locate Customer
                                </h2>
                                {selectedCustomer && (
                                    <button
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setSearchTerm('');
                                            setSearchResults([]);
                                        }}
                                        className="text-xs text-brand-primary hover:underline font-semibold font-outfit"
                                    >
                                        Reset Search
                                    </button>
                                )}
                            </div>

                            {!selectedCustomer ? (
                                <>
                                    {/* Search Input */}
                                    <div className="relative mb-5">
                                        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            placeholder="Search by name, phone, or ID number..."
                                            className="w-full pl-11 pr-10 py-1.5 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none text-sm text-body placeholder:text-muted shadow-sm"
                                            autoFocus
                                        />
                                        {searching && (
                                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                                <ArrowPathIcon className="w-5 h-5 text-brand-primary animate-spin" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Results */}
                                    <div className="space-y-2 min-h-[300px]">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(customer => (
                                                <button
                                                    key={customer.id}
                                                    onClick={() => setSelectedCustomer(customer)}
                                                    className="w-full text-left p-3.5 rounded-lg border border-border-light transition-all flex items-center gap-3.5 bg-surface/50 hover:bg-card hover:border-brand-primary/30 hover:shadow-sm group"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-surface text-muted flex items-center justify-center shrink-0 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                                                        <UserIcon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-body group-hover:text-heading transition-colors truncate">
                                                            {`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()}
                                                        </p>
                                                        <div className="flex items-center gap-4 mt-1 text-xs text-muted">
                                                            <span className="flex items-center gap-1.5">
                                                                <PhoneIcon className="w-3.5 h-3.5 shrink-0" />
                                                                {customer.mobile}
                                                            </span>
                                                            <span className="flex items-center gap-1.5 font-mono">
                                                                <CreditCardIcon className="w-3.5 h-3.5 shrink-0" />
                                                                {customer.id_number}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-border group-hover:text-brand-primary transition-colors shrink-0">
                                                        <CheckCircleIcon className="w-5 h-5" />
                                                    </div>
                                                </button>
                                            ))
                                        ) : searchTerm.length >= 2 && !searching ? (
                                            <div className="py-16 text-center bg-surface/30 rounded-lg border border-dashed border-border">
                                                <MagnifyingGlassIcon className="w-10 h-10 text-border mx-auto mb-3" />
                                                <p className="text-muted text-sm font-medium">No results for "{searchTerm}"</p>
                                                <p className="text-muted text-xs mt-1">Try a different name, phone, or ID</p>
                                            </div>
                                        ) : (
                                            <div className="py-16 text-center">
                                                <UserIcon className="w-12 h-12 mx-auto mb-3 text-border" />
                                                <p className="text-sm text-muted">Find a customer to link this payment</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Selected Customer Card */}
                                    <div className="p-4 rounded-xl border border-border bg-brand-primary/[0.02] flex items-center gap-4">
                                        <div className="w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg shadow-brand-primary/20 shrink-0">
                                            <UserIcon className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold font-outfit text-brand-primary mb-1">Selected Customer</p>
                                            <p className="text-sm font-semibold font-outfit text-heading truncate">
                                                {`${selectedCustomer.Firstname || ''} ${selectedCustomer.Surname || ''}`.trim()}
                                            </p>
                                            <p className="text-sm font-outfit text-body mt-0.5">
                                                {selectedCustomer.mobile}
                                                {selectedCustomer.id_number && ` • ${selectedCustomer.id_number}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedCustomer(null)}
                                            className="shrink-0 px-3 py-1.5 text-xs font-outfit text-muted hover:text-danger transition-colors"
                                        >
                                            Change
                                        </button>
                                    </div>

                                    {/* Confirmation Panel */}
                                    <div className="mt-6 p-5 rounded-xl bg-brand-primary/10 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                            <CheckCircleIcon className="w-28 h-28 text-heading" />
                                        </div>
                                        <h3 className="text-xs font-outfit text-heading mb-4 flex items-center gap-2">
                                            <ClockIcon className="w-3.5 h-3.5 text-brand-primary" />
                                            Submit for Approval
                                        </h3>
                                        <p className="text-brand-primary leading-relaxed text-sm mb-6">
                                            You are about to propose a reconciliation for{' '}
                                            <span className="text-heading font-bold font-outfit">{transaction.transaction_id}</span>{' '}
                                            for{' '}
                                            <span className="text-heading font-bold font-outfit">
                                                KSh {parseFloat(transaction.amount).toLocaleString()}
                                            </span>{' '}
                                            to{' '}
                                            <span className="text-heading font-bold font-outfit">{selectedCustomer.Firstname}</span>.
                                        </p>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setSelectedCustomer(null)}
                                                className="py-2 px-1.5 bg-midnight text-white/70 rounded-lg text-xs font-outfit hover:bg-forest-deep transition-all whitespace-nowrap"
                                            >
                                                Cancel
                                            </button>
                                                <button
                                                    onClick={executeReconciliation}
                                                    disabled={isProcessing}
                                                    className="py-2 px-1.5 bg-brand-primary text-white rounded-lg text-xs font-outfit hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/30 transition-all disabled:opacity-50 inline-flex items-center gap-2 uppercase tracking-wide whitespace-nowrap"
                                                >
                                                    {isProcessing ? (
                                                        <>
                                                            Submitting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            Submit Proposal
                                                        </>
                                                    )}
                                                </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Processing Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 bg-[rgba(15,31,23,0.15)] z-[100] flex items-center justify-center">
                    <div className="bg-card p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-xs w-full animate-in zoom-in duration-300">
                        <div className="w-14 h-14 relative mb-5">
                            <div className="absolute inset-0 border-2 border-border-light rounded-full"></div>
                            <div className="absolute inset-0 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-base font-bold text-heading mb-1.5">Submitting Proposal</h3>
                        <p className="text-muted text-center text-sm">
                            Just a moment while we send this for approval...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReconcileTransaction;