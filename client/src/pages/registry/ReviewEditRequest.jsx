import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    XCircleIcon,
    UserIcon,
    PhoneIcon,
    CreditCardIcon,
    DocumentTextIcon,
    ClockIcon,
    ShieldCheckIcon,
    ArrowTopRightOnSquareIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../../supabaseClient.js';
import { useAuth } from '../../hooks/userAuth.js';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';

const ReviewEditRequest = () => {
    const { requestId, requestType } = useParams();
    const { profile } = useAuth();
    const { hasPermission } = usePermissions();
    const navigate = useNavigate();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [request, setRequest] = useState(null);
    const [customer, setCustomer] = useState(null);

    useEffect(() => {
        if (requestId && requestType) {
            fetchData();
        }
    }, [requestId, requestType]);

    const fetchData = async () => {
        try {
            setLoading(true);

            const tableName = requestType === 'phone_id'
                ? 'customer_phone_id_edit_requests'
                : 'customer_detail_edit_requests';

            const { data: requestData, error: requestError } = await supabase
                .from(tableName)
                .select(`
          *,
          customer:customers(*),
          created_by_user:users!created_by(full_name, email, role),
          confirmed_by_user:users!confirmed_by(full_name),
          approved_by_user:users!approved_by(full_name),
          rejected_by_user:users!rejected_by(full_name)
        `)
                .eq('id', requestId)
                .single();

            if (requestError) throw requestError;

            setRequest(requestData);
            setCustomer(requestData.customer);

        } catch (error) {
            console.error('Error fetching request data:', error);
            toast.error('Failed to load request details');
        } finally {
            setLoading(false);
        }
    };

    // Maps camelCase form field names → actual DB column names
    const CUSTOMER_FIELD_MAP = {
        alternativeMobile: 'alternative_mobile',
        idNumber: 'id_number',
        dateOfBirth: 'date_of_birth',
        maritalStatus: 'marital_status',
        residenceStatus: 'residence_status',
        postalAddress: 'postal_address',
        businessName: 'business_name',
        businessType: 'business_type',
        businessLocation: 'business_location',
        yearEstablished: 'year_established',
        hasLocalAuthorityLicense: 'has_local_authority_license',
        prequalifiedAmount: 'prequalifiedAmount', // already correct
        houseImage: 'house_image_url',
        passport: 'passport_url',
        idFront: 'id_front_url',
        idBack: 'id_back_url',
    };

    const mapToDbColumns = (data) => {
        const mapped = {};
        for (const [key, value] of Object.entries(data || {})) {
            const dbKey = CUSTOMER_FIELD_MAP[key] || key;
            // Skip complex objects / nested that don't belong in the table
            if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof File)) continue;
            if (Array.isArray(value)) continue;
            mapped[dbKey] = value;
        }
        return mapped;
    };

    const GUARANTOR_FIELD_MAP = {
        idNumber: 'id_number',
        dateOfBirth: 'date_of_birth',
        maritalStatus: 'marital_status',
        residenceStatus: 'residence_status',
        postalAddress: 'postal_address',
        alternativeMobile: 'alternative_number',
        cityTown: 'city_town',
    };

    const mapGuarantorToDbColumns = (data) => {
        const mapped = {};
        for (const [key, value] of Object.entries(data || {})) {
            const dbKey = GUARANTOR_FIELD_MAP[key] || key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) continue;
            if (Array.isArray(value)) continue;
            mapped[dbKey] = value;
        }
        return mapped;
    };

    const applyApprovedChanges = async () => {
        try {
            if (requestType === 'phone_id') {
                const { error } = await supabase
                    .from('customers')
                    .update({
                        mobile: request.new_mobile,
                        id_number: request.new_id_number,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', request.customer_id);
                if (error) throw error;
            } else {
                const { section_type, new_values, customer_id } = request;
                const tenant_id = request.tenant_id;
                const proposed_changes = new_values;

                if (['personal', 'business'].includes(section_type)) {
                    const dbPayload = mapToDbColumns(proposed_changes);
                    const { error } = await supabase
                        .from('customers')
                        .update({ ...dbPayload, updated_at: new Date().toISOString() })
                        .eq('id', customer_id);
                    if (error) throw error;
                } else if (section_type === 'guarantor') {
                    const dbPayload = mapGuarantorToDbColumns(proposed_changes);
                    const { error } = await supabase
                        .from('guarantors')
                        .upsert({
                            ...dbPayload,
                            customer_id,
                            tenant_id,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'customer_id' });
                    if (error) throw error;
                } else if (section_type === 'nextOfKin') {
                    const dbPayload = mapGuarantorToDbColumns(proposed_changes);
                    const { error } = await supabase
                        .from('next_of_kin')
                        .upsert({
                            ...dbPayload,
                            customer_id,
                            tenant_id,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'customer_id' });
                    if (error) throw error;
                } else if (section_type === 'security') {
                    const items = proposed_changes.security_items || [];
                    for (const item of items) {
                        const { images, ...itemData } = item;
                        const { data: newItem, error: itemError } = await supabase
                            .from('security_items')
                            .insert([{ ...itemData, customer_id, tenant_id }])
                            .select()
                            .single();

                        if (itemError) throw itemError;

                        if (images && images.length > 0) {
                            const imageRecords = images.map(url => ({
                                security_item_id: newItem.id,
                                image_url: url,
                                tenant_id
                            }));
                            const { error: imgError } = await supabase
                                .from('security_item_images')
                                .insert(imageRecords);
                            if (imgError) throw imgError;
                        }
                    }
                } else if (section_type === 'guarantor_security') {
                    const items = proposed_changes.guarantor_security || [];
                    for (const item of items) {
                        const { images, ...itemData } = item;
                        const { data: newItem, error: itemError } = await supabase
                            .from('guarantor_security')
                            .insert([{ ...itemData, customer_id, tenant_id }])
                            .select()
                            .single();

                        if (itemError) throw itemError;

                        if (images && images.length > 0) {
                            const imageRecords = images.map(url => ({
                                guarantor_security_id: newItem.id,
                                image_url: url,
                                tenant_id
                            }));
                            const { error: imgError } = await supabase
                                .from('guarantor_security_images')
                                .insert(imageRecords);
                            if (imgError) throw imgError;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error applying approved changes:', error);
            throw new Error('Approval succeeded but failed to sync changes: ' + error.message);
        }
    };

    const handleStatusUpdate = async (newStatus) => {
        const confirmAction = window.confirm(`Are you sure you want to ${newStatus} this request?`);
        if (!confirmAction) return;

        try {
            setProcessing(true);
            const tableName = requestType === 'phone_id'
                ? 'customer_phone_id_edit_requests'
                : 'customer_detail_edit_requests';

            const updateData = { status: newStatus };
            const now = new Date().toISOString();

            if (newStatus === 'confirmed' && hasPermission('amendments.confirm')) {
                updateData.confirmed_by = profile.id;
                updateData.confirmed_at = now;
            } else if (newStatus === 'approved' && hasPermission('amendments.authorize')) {
                updateData.approved_by = profile.id;
                updateData.approved_at = now;
                // Apply changes to target tables
                await applyApprovedChanges();
            } else if (newStatus.includes('rejected') && (hasPermission('amendments.confirm') || hasPermission('amendments.authorize'))) {
                updateData.rejected_by = profile.id;
                updateData.rejected_at = now;
                updateData.status = 'rejected';
            } else {
                toast.error('You do not have permission to perform this action');
                setProcessing(false);
                return;
            }

            const { error } = await supabase
                .from(tableName)
                .update(updateData)
                .eq('id', requestId);

            if (error) throw error;

            toast.success(`Request ${newStatus} successfully`);
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update request status: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    const canConfirm = () => {
        return hasPermission('amendments.confirm') && request?.status === 'pending_branch_manager';
    };

    const canApprove = () => {
        return hasPermission('amendments.authorize') && request?.status === 'confirmed';
    };

    const getStatusBadge = (status) => {
        const configs = {
            approved: { style: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'APPROVED' },
            rejected: { style: 'bg-red-50 text-red-700 border-red-100', label: 'REJECTED' },
            confirmed: { style: 'bg-blue-50 text-blue-700 border-blue-100', label: 'AWAITING AUTHORIZATION' },
            pending_branch_manager: { style: 'bg-amber-50 text-amber-700 border-amber-100', label: 'WAITING CONFIRMATION' },
            pending_superadmin: { style: 'bg-purple-50 text-purple-700 border-purple-100', label: 'AWAITING REVIEW' },
            default: { style: 'bg-slate-50 text-slate-700 border-slate-100', label: status?.toUpperCase() || 'UNKNOWN' }
        };

        const config = configs[status] || configs.default;

        return (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${config.style}`}>
                {config.label}
            </span>
        );
    };

    const ComparisonCard = ({ title, current, proposed, icon: Icon }) => (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                    <Icon className="w-5 h-5 text-[#586ab1]" />
                </div>
                <h3 className="text-slate-600 text-sm">{title}</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                    <p className="text-sm text-slate-500">Current Value</p>
                    <p className="text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">
                        {current || '---'}
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm text-[#586ab1]">Proposed Value</p>
                    <p className="text-sm font-bold text-[#586ab1] bg-[#586ab1]/5 p-3 rounded-xl border border-[#586ab1]/20">
                        {proposed || '---'}
                    </p>
                </div>
            </div>
        </div>
    );

    if (loading) return <div className="h-screen flex items-center justify-center bg-muted"><Spinner text="Loading Record..." /></div>;

    if (!request) return (
        <div className="h-screen flex flex-col items-center justify-center bg-muted p-8 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <ExclamationTriangleIcon className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Request Not Found</h2>
            <p className="text-slate-500 mb-8 max-w-sm">The record you are looking for does not exist or has been removed.</p>
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all">
                <ArrowLeftIcon className="w-5 h-5" /> Go Back
            </button>
        </div>
    );

    const customerName = `${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim();

    return (
        <div className="min-h-screen bg-muted p-6 lg:p-12 pb-24">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Unified Premium Header & Metadata */}
                <div className="bg-slate-100 rounded-[2rem] border border-slate-200 shadow-sm p-4 pr-8 flex items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 hover:text-[#586ab1] hover:bg-white hover:border-[#586ab1]/20 transition-all group"
                    >
                        <ArrowLeftIcon className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                    </button>

                    <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${request.status === 'approved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                <h1 className="text-base  text-slate-600 tracking-tight leading-none">
                                    {customerName}
                                </h1>
                                <span className="text-[10px] text-[#586ab1] uppercase tracking-widest px-2 border-l border-slate-100">
                                    {requestType === 'phone_id' ? 'ID/Phone Modification' : `${request.section_type?.replace(/_/g, ' ')} Amendment`}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>Requested by <span className="text-slate-600 font-black">{request.created_by_user?.full_name}</span></span>
                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                <span>{new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {getStatusBadge(request.status)}
                            </div>
                        </div>

                        {/* Quick Context Chips */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 shrink-0">
                                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs text-slate-600">Verified Entity</span>
                            </div>
                            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 shrink-0">
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs text-slate-600 ">{customer.status || 'Active'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Main Review Area */}
                    <div className="lg:col-span-8 space-y-6">



                        {/* Comparison Cards */}
                        <div className="space-y-4">
                            {requestType === 'phone_id' ? (
                                <>
                                    {String(customer.mobile || '') !== String(request.new_mobile || '') && (
                                        <ComparisonCard
                                            title="Mobile Number"
                                            current={customer.mobile}
                                            proposed={request.new_mobile}
                                            icon={PhoneIcon}
                                        />
                                    )}
                                    {String(customer.id_number || '') !== String(request.new_id_number || '') && (
                                        <ComparisonCard
                                            title="ID / Passport Number"
                                            current={customer.id_number}
                                            proposed={request.new_id_number}
                                            icon={CreditCardIcon}
                                        />
                                    )}
                                </>
                            ) : (
                                Object.entries(request.new_values || {})
                                    .filter(([key, value]) => {
                                        // Skip common metadata or empty values that aren't changes
                                        if (key === 'id' || key === 'customer_id' || key === 'tenant_id') return false;

                                        // Determine which field map to use based on section_type
                                        const fieldMap = ['personal', 'business'].includes(request.section_type)
                                            ? CUSTOMER_FIELD_MAP
                                            : (['guarantor', 'nextOfKin'].includes(request.section_type) ? GUARANTOR_FIELD_MAP : {});

                                        const dbKey = fieldMap[key] || key;

                                        // Only show if the proposed value is different from the current value
                                        const curr = String(customer[dbKey] || '');
                                        const prop = String(value || '');
                                        return curr !== prop;
                                    })
                                    .map(([key, value]) => {
                                        const fieldMap = ['personal', 'business'].includes(request.section_type)
                                            ? CUSTOMER_FIELD_MAP
                                            : (['guarantor', 'nextOfKin'].includes(request.section_type) ? GUARANTOR_FIELD_MAP : {});
                                        const dbKey = fieldMap[key] || key;

                                        return (
                                            <ComparisonCard
                                                key={key}
                                                title={key.replace(/([A-Z])/g, ' $1').toUpperCase()}
                                                current={customer[dbKey]}
                                                proposed={value}
                                                icon={DocumentTextIcon}
                                            />
                                        );
                                    })
                            )}
                        </div>

                        {/* Supporting Documents */}
                        {(request.document_url || (request.document_urls && Object.keys(request.document_urls).length > 0)) && (
                            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-700">
                                <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                            <ShieldCheckIcon className="w-4 h-4 text-[#586ab1]" />
                                        </div>
                                        <h3 className=" text-slate-600   text-sm">Supporting Evidence</h3>
                                    </div>
                                    {request.document_url && (
                                        <a
                                            href={request.document_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2"
                                        >
                                            View Original Document
                                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>

                                {request.document_urls && Object.keys(request.document_urls).length > 0 && (
                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {Object.entries(request.document_urls).map(([key, url]) => (
                                            <a
                                                key={key}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-[#586ab1]/30 transition-all group flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-white rounded-lg border border-slate-100 group-hover:bg-[#586ab1]/10 transition-colors">
                                                        <DocumentTextIcon className="w-4 h-4 text-slate-400 group-hover:text-[#586ab1]" />
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-600 capitalize">
                                                        {key.replace(/([A-Z])/g, ' $1')}
                                                    </span>
                                                </div>
                                                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#586ab1]" />
                                            </a>
                                        ))}
                                    </div>
                                )}

                                {request.document_url && (
                                    <div className="p-6">
                                        <div className="relative rounded-[1.5rem] overflow-hidden border border-slate-100 bg-slate-50 shadow-inner group">
                                            {request.document_url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                                <img
                                                    src={request.document_url}
                                                    alt="Supporting Document"
                                                    className="w-full h-auto object-contain max-h-[400px] mx-auto group-hover:scale-[1.02] transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="py-20 text-center">
                                                    <DocumentTextIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                                    <p className="text-xs text-slate-400 font-medium">Document Preview Not Available</p>
                                                    <a
                                                        href={request.document_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-[#586ab1] font-bold mt-2 inline-block uppercase tracking-widest"
                                                    >
                                                        Download to View
                                                    </a>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Inline Decision Block - BELOW Supporting Evidence */}
                        {(canConfirm() || canApprove()) && (
                            <div className="bg-white rounded-[2rem] border-2 border-[#586ab1]/10 p-8 shadow-xl shadow-[#586ab1]/5 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-1">
                                        <h4 className="text-sm  text-slate-600 ">Intelligence Decision</h4>
                                        <p className="text-[10px]  text-slate-400  leading-relaxed">
                                            Review the data deltas above and authorize the synchronization of this amendment.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {canConfirm() && (
                                            <>
                                                <button
                                                    onClick={() => handleStatusUpdate('rejected_by_bm')}
                                                    disabled={processing}
                                                    className="px-4 py-2 bg-white border border-red-100 text-red-600 whitespace-nowrap text-lg rounded-xl hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50"
                                                >
                                                    Deny Request
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate('confirmed')}
                                                    disabled={processing}
                                                    className="px-5 py-2.5 bg-[#586ab1] text-white font-black whitespace-nowrap text-lg rounded-xl shadow-lg shadow-[#586ab1]/20 hover:bg-[#475589] transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
                                                >
                                                    Verify & Confirm
                                                </button>
                                            </>
                                        )}
                                        {canApprove() && (
                                            <>
                                                <button
                                                    onClick={() => handleStatusUpdate('rejected_by_rm')}
                                                    disabled={processing}
                                                    className="px-4 py-2 bg-white border border-red-100 text-red-600 font-black uppercase tracking-widest text-[8px] rounded-xl hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50"
                                                >
                                                    Decline Update
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate('approved')}
                                                    disabled={processing}
                                                    className="px-6 py-2.5 bg-emerald-500 text-white font-black uppercase tracking-widest text-[8px] rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
                                                >
                                                    Authorize Sync
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Activity/Audit Sidebar */}
                    <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-12 h-fit pb-12">
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
                                <ClockIcon className="w-4 h-4 text-slate-400" />
                                <h3 className=" text-slate-600 text-sm">Audit Synchronization</h3>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex gap-4">
                                    <div className="relative flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full ${request.created_at ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-200'} z-10`}></div>
                                        <div className="w-[1px] h-full bg-slate-100 absolute top-4"></div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-slate-600 ">Intelligence Captured</p>
                                        <p className="text-sm text-slate-800">by {request.created_by_user?.full_name}</p>
                                        <p className="text-xs text-slate-600 italic">{new Date(request.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="relative flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full ${request.confirmed_at ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-200'} z-10 ${!request.confirmed_at && request.status !== 'rejected' ? 'animate-pulse' : ''}`}></div>
                                        <div className="w-[1px] h-full bg-slate-100 absolute top-4"></div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-slate-600 ">Gatekeeper Verification</p>
                                        <p className="text-sm text-slate-800">
                                            {request.confirmed_at ? `Verified by ${request.confirmed_by_user?.full_name}` : 'Awaiting confirmation...'}
                                        </p>
                                        {request.confirmed_at && <p className="text-sm text-slate-600 italic">{new Date(request.confirmed_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="relative flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full ${request.approved_at || request.rejected_at ? (request.status === 'approved' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]') : 'bg-slate-200'} z-10`}></div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-xm text-slate-600">Final Authorization</p>
                                        <p className="text-sm text-slate-800">
                                            {request.approved_at ? `Authorized by ${request.approved_by_user?.full_name}` :
                                                request.rejected_at ? `Rejected by ${request.rejected_by_user?.full_name}` :
                                                    'Awaiting final sync...'}
                                        </p>
                                        {(request.approved_at || request.rejected_at) && (
                                            <p className="text-xm text-slate-600 italic">{new Date(request.approved_at || request.rejected_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Box */}
                        <div className="bg-[#586ab1]/5 rounded-[2rem] p-6 border border-[#586ab1]/10 space-y-4">
                            <h3 className="text-sm  text-[#586ab1]  border-b border-[#586ab1]/10 pb-3">Validation Summary</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-white/50 rounded-2xl border border-[#586ab1]/10">
                                    <p className="text-sm text-slate-600 mb-1">Status</p>
                                    <p className="text-sm text-slate-600 truncate">{customer.status}</p>
                                </div>
                                <div className="p-3 bg-white/50 rounded-2xl border border-[#586ab1]/10">
                                    <p className="text-sm text-slate-600 mb-1">Deltas</p>
                                    <p className="text-sm text-slate-600 font-medium">{requestType === 'phone_id' ? '2 Fields' : `${Object.keys(request.proposed_changes || {}).length} Fields`}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewEditRequest;
