import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import {
    ArrowLeft,
    Search,
    User,
    CheckCircle,
    AlertCircle,
    Hash
} from 'lucide-react';
import {
    MagnifyingGlassIcon,
    UserIcon,
    PhoneIcon,
    CreditCardIcon,
    ArrowPathIcon
} from "@heroicons/react/24/outline";
import Spinner from "../../components/Spinner";

const ReconcileTransaction = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { showToast } = useToast();

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
            showToast('Error fetching transaction details', 'error');
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

        try {
            setIsProcessing(true);

            const { error: suspenseError } = await supabase
                .from('suspense_transactions')
                .update({
                    status: 'reconciled',
                    linked_customer_id: selectedCustomer.id,
                    reason: `Manually reconciled to ${selectedCustomer.Firstname} ${selectedCustomer.Surname}`
                })
                .eq('id', transaction.id)
                .eq('tenant_id', profile.tenant_id);

            if (suspenseError) throw suspenseError;

            const { error: walletError } = await supabase
                .from('customer_wallets')
                .insert([{
                    customer_id: selectedCustomer.id,
                    tenant_id: profile.tenant_id,
                    amount: transaction.amount,
                    credit: transaction.amount,
                    debit: 0,
                    type: 'credit',
                    transaction_type: 'mpesa',
                    mpesa_reference: transaction.transaction_id,
                    billref: transaction.billref || transaction.reference,
                    narration: `Manual reconciliation: ${transaction.transaction_id}`,
                    description: `Payment reconciled from suspense`
                }]);

            if (walletError) throw walletError;

            showToast('Transaction reconciled and customer wallet credited', 'success');
            setTimeout(() => navigate('/accounting/transactions'), 1500);
        } catch (error) {
            console.error('Reconciliation error:', error);
            showToast('Failed to reconcile transaction: ' + error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center">
                <Spinner text="Loading transaction details..." />
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
                <AlertCircle className="w-14 h-14 text-red-500 mb-4" />
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">Transaction Not Found</h2>
                <p className="text-stone-500 mb-6 text-base text-center max-w-sm">
                    The transaction you are looking for does not exist or you don't have permission to view it.
                </p>
                <button
                    onClick={() => navigate('/accounting/transactions')}
                    className="px-5 py-2.5 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-primary/90 transition-all text-sm font-semibold inline-flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Transactions
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 p-6 font-sans">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/accounting/transactions')}
                        className="p-2 bg-white rounded-lg border border-stone-200 text-stone-400 hover:text-brand-primary hover:border-brand-primary transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-stone-700">Manual Reconciliation</h1>
                        <p className="text-stone-400 text-sm mt-0.5">Link suspense payment to a specific customer</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Left: Transaction Details */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
                            <h2 className="text-xs font-bold text-stone-400 mb-4 flex items-center gap-2 pb-3 border-b border-stone-100 uppercase tracking-widest">
                                <Hash className="w-4 h-4 text-brand-primary/70" />
                                Payment Summary
                            </h2>

                            <div className="space-y-3">
                                {/* M-Pesa Reference */}
                                <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-100">
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5">M-Pesa Reference</p>
                                    <p className="text-base font-semibold text-stone-700">{transaction.transaction_id}</p>
                                </div>

                                {/* Amount */}
                                <div className="p-3.5 bg-brand-primary/[0.04] rounded-lg border border-brand-primary/10">
                                    <p className="text-xs font-bold text-brand-primary/60 uppercase tracking-widest mb-1.5">Amount</p>
                                    <p className="text-2xl font-bold text-stone-800">
                                        KSh {parseFloat(transaction.amount).toLocaleString()}
                                    </p>
                                </div>

                                {/* Details */}
                                <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-100">
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Details</p>
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-stone-400 shrink-0">Payer</span>
                                            <span className="text-sm text-stone-700 font-medium text-right truncate">
                                                {transaction.payer_name || 'Anonymous'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-stone-400 shrink-0">Phone</span>
                                            <span className="text-sm text-stone-700 font-medium text-right">
                                                {transaction.phone_number}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-stone-400 shrink-0">Date</span>
                                            <span className="text-sm text-stone-700 font-medium text-right">
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
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-100">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-xs font-bold text-stone-400 flex items-center gap-2 uppercase tracking-widest">
                                    <User className="w-4 h-4 text-brand-primary/70" />
                                    Step 1: Locate Customer
                                </h2>
                                {selectedCustomer && (
                                    <button
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setSearchTerm('');
                                            setSearchResults([]);
                                        }}
                                        className="text-xs text-brand-primary hover:underline font-bold uppercase tracking-widest"
                                    >
                                        Reset Search
                                    </button>
                                )}
                            </div>

                            {!selectedCustomer ? (
                                <>
                                    {/* Search Input */}
                                    <div className="relative mb-5">
                                        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            placeholder="Search by name, phone, or ID number..."
                                            className="w-full pl-11 pr-10 py-3 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none text-sm text-stone-700 placeholder:text-stone-300 shadow-sm"
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
                                                    className="w-full text-left p-3.5 rounded-lg border border-stone-100 transition-all flex items-center gap-3.5 bg-stone-50/50 hover:bg-white hover:border-brand-primary/30 hover:shadow-sm group"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-400 flex items-center justify-center shrink-0 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                                                        <UserIcon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-stone-700 group-hover:text-stone-900 transition-colors truncate">
                                                            {`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()}
                                                        </p>
                                                        <div className="flex items-center gap-4 mt-1 text-xs text-stone-400">
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
                                                    <div className="text-stone-200 group-hover:text-brand-primary transition-colors shrink-0">
                                                        <CheckCircle className="w-5 h-5" />
                                                    </div>
                                                </button>
                                            ))
                                        ) : searchTerm.length >= 2 && !searching ? (
                                            <div className="py-16 text-center bg-stone-50/30 rounded-lg border border-dashed border-stone-200">
                                                <Search className="w-10 h-10 text-stone-200 mx-auto mb-3" />
                                                <p className="text-stone-500 text-sm font-medium">No results for "{searchTerm}"</p>
                                                <p className="text-stone-400 text-xs mt-1">Try a different name, phone, or ID</p>
                                            </div>
                                        ) : (
                                            <div className="py-16 text-center">
                                                <User className="w-12 h-12 mx-auto mb-3 text-stone-200" />
                                                <p className="text-sm text-stone-400">Find a customer to link this payment</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Selected Customer Card */}
                                    <div className="p-4 rounded-xl border-2 border-brand-primary bg-brand-primary/[0.02] flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg shadow-brand-primary/20 shrink-0">
                                            <UserIcon className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-brand-primary uppercase tracking-widest mb-1">Selected Customer</p>
                                            <p className="text-lg font-bold text-stone-800 truncate">
                                                {`${selectedCustomer.Firstname || ''} ${selectedCustomer.Surname || ''}`.trim()}
                                            </p>
                                            <p className="text-sm text-stone-400 mt-0.5">
                                                {selectedCustomer.mobile}
                                                {selectedCustomer.id_number && ` • ${selectedCustomer.id_number}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedCustomer(null)}
                                            className="shrink-0 px-3 py-1.5 text-xs font-bold text-stone-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                                        >
                                            Change
                                        </button>
                                    </div>

                                    {/* Confirmation Panel */}
                                    <div className="mt-6 p-5 rounded-xl bg-stone-800 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                            <CheckCircle className="w-28 h-28 text-white" />
                                        </div>
                                        <h3 className="text-xs font-bold text-stone-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <CheckCircle className="w-3.5 h-3.5 text-brand-primary" />
                                            Final Confirmation
                                        </h3>
                                        <p className="text-stone-300 leading-relaxed text-sm mb-6">
                                            You are about to reconcile{' '}
                                            <span className="text-white font-bold">{transaction.transaction_id}</span>{' '}
                                            for{' '}
                                            <span className="text-brand-primary font-bold">
                                                KSh {parseFloat(transaction.amount).toLocaleString()}
                                            </span>{' '}
                                            to{' '}
                                            <span className="text-white font-bold">{selectedCustomer.Firstname}</span>
                                            's wallet.
                                        </p>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setSelectedCustomer(null)}
                                                className="py-2.5 px-5 bg-stone-700 text-stone-300 rounded-lg text-sm font-semibold hover:bg-stone-600 transition-all uppercase tracking-wide whitespace-nowrap"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={executeReconciliation}
                                                disabled={isProcessing}
                                                className="py-2.5 px-6 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/30 transition-all disabled:opacity-50 inline-flex items-center gap-2 uppercase tracking-wide whitespace-nowrap"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle className="w-4 h-4" />
                                                        Confirm Reconciliation
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
                <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-xs w-full animate-in zoom-in duration-300">
                        <div className="w-14 h-14 relative mb-5">
                            <div className="absolute inset-0 border-2 border-stone-100 rounded-full"></div>
                            <div className="absolute inset-0 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-base font-bold text-stone-800 mb-1.5">Updating Records</h3>
                        <p className="text-stone-400 text-center text-sm">
                            Just a moment while we credit the wallet...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReconcileTransaction;