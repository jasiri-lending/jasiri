import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PhoneIcon,
  CreditCardIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  UserIcon,
  EyeIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ChevronDownIcon,
  CalendarIcon,
  ClockIcon,
  ArrowUpTrayIcon,
  PhotoIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";
import { usePermissions } from "../../hooks/usePermissions.js";
import { useTenantFeatures } from "../../hooks/useTenantFeatures.js";

function CustomerEdits() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const { documentUploadEnabled } = useTenantFeatures();
  const [loading, setLoading] = useState(false);
  const [editRequests, setEditRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline search states (for initiating new edits)
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Modal states
  const [selectedCustomer, setSelectedCustomer] = useState(null);



  // Form states for ID/Phone edit
  const [idPhoneForm, setIdPhoneForm] = useState({
    newMobile: '',
    newIdNumber: '',
    reason: '',
    document: null,
    documentPreview: null
  });

  useEffect(() => {
    if (profile) {
      fetchEditRequests();
    }
  }, [profile]);

  useEffect(() => {
    filterRequests();
  }, [editRequests, statusFilter, searchQuery]);

  const fetchEditRequests = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      let query = supabase
        .from('customer_phone_id_edit_requests')
        .select(`
          *,
          customer:customers(Firstname, Middlename, Surname, mobile, id_number, created_by, branch_id, region_id),
          created_by_user:users!created_by(full_name, email, role),
          confirmed_by_user:users!confirmed_by(full_name),
          approved_by_user:users!approved_by(full_name),
          rejected_by_user:users!rejected_by(full_name)
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      // Filter based on role
      if (profile.role === 'relationship_officer') {
        query = query.eq('created_by', profile.id);
      } else if (profile.role === 'branch_manager' && profile.branch_id) {
        const { data: branchCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('branch_id', profile.branch_id)
          .eq('tenant_id', profile.tenant_id);

        if (branchCustomers && branchCustomers.length > 0) {
          const customerIds = branchCustomers.map(c => c.id);
          query = query.in('customer_id', customerIds);
        }
      } else if (profile.role === 'regional_manager' && profile.region_id) {
        const { data: regionCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('region_id', profile.region_id)
          .eq('tenant_id', profile.tenant_id);

        if (regionCustomers && regionCustomers.length > 0) {
          const customerIds = regionCustomers.map(c => c.id);
          query = query.in('customer_id', customerIds);
        }
      }

      const { data: editRequests, error } = await query;

      if (error) throw error;

      setEditRequests(editRequests || []);
    } catch (error) {
      console.error('Error fetching edit requests:', error);
      setEditRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = [...editRequests];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(req => {
        const customerName = req.customer
          ? `${req.customer.Firstname} ${req.customer.Middlename} ${req.customer.Surname}`.toLowerCase()
          : '';
        const mobile = req.customer?.mobile?.toLowerCase() || '';
        const idNumber = req.customer?.id_number?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();

        return customerName.includes(query) || mobile.includes(query) || idNumber.includes(query);
      });
    }

    setFilteredRequests(filtered);
  };

  const handleSearchChange = async (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      let query = supabase.from("customers").select("*").eq('tenant_id', profile.tenant_id).limit(10);

      if (profile?.role === "relationship_officer") {
        query = query.eq("created_by", profile.id);
      } else if (profile?.role === "branch_manager" && profile.branch_id) {
        query = query.eq("branch_id", profile.branch_id);
      } else if (profile?.role === "regional_manager" && profile.region_id) {
        query = query.eq("region_id", profile.region_id);
      }

      const isNumeric = /^\d+$/.test(value);
      if (isNumeric) {
        query = query.or(`Firstname.ilike.%${value}%,Middlename.ilike.%${value}%,Surname.ilike.%${value}%,mobile.ilike.%${value}%,id_number.eq.${value}`);
      } else {
        query = query.or(`Firstname.ilike.%${value}%,Middlename.ilike.%${value}%,Surname.ilike.%${value}%,mobile.ilike.%${value}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error("Search error:", err.message);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setSearchTerm('');
    setSearchResults([]);
    setIdPhoneForm({
      newMobile: '',
      newIdNumber: '',
      reason: '',
      document: null,
      documentPreview: null
    });
  };

  const handleDocumentUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        alert('Please upload a valid file (JPEG, PNG, PDF)');
        return;
      }

      if (file.size > maxSize) {
        alert('File size must be less than 5MB');
        return;
      }

      setIdPhoneForm(prev => ({ ...prev, document: file }));

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setIdPhoneForm(prev => ({ ...prev, documentPreview: reader.result }));
        };
        reader.readAsDataURL(file);
      } else {
        setIdPhoneForm(prev => ({ ...prev, documentPreview: null }));
      }
    }
  };

  const uploadSupportDocument = async (file) => {
    if (!file) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `support-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('customer-edits')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('customer-edits')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  };

  const handleSubmitIdPhoneEdit = async (e) => {
    e.preventDefault();

    if (!hasPermission('amendments.initiate')) {
      alert('You do not have permission to initiate amendments.');
      return;
    }

    if (!selectedCustomer) {
      alert('Please select a customer first');
      return;
    }

    if (!idPhoneForm.newMobile && !idPhoneForm.newIdNumber) {
      alert('Please enter at least one new value (phone or ID number)');
      return;
    }

    if (!idPhoneForm.reason.trim()) {
      alert('Please provide a reason for the edit');
      return;
    }

    if (documentUploadEnabled && !idPhoneForm.document) {
      alert('Please upload a supporting document');
      return;
    }

    try {
      setLoading(true);

      const documentUrl = documentUploadEnabled ? await uploadSupportDocument(idPhoneForm.document) : null;

      // Only include values if they are different from current ones
      const newMobile = idPhoneForm.newMobile && idPhoneForm.newMobile !== selectedCustomer.mobile ? idPhoneForm.newMobile : selectedCustomer.mobile;
      const newIdNumber = idPhoneForm.newIdNumber && idPhoneForm.newIdNumber !== selectedCustomer.id_number ? idPhoneForm.newIdNumber : selectedCustomer.id_number;

      // Check if any actual change was made
      const isPhoneChanged = idPhoneForm.newMobile && idPhoneForm.newMobile !== selectedCustomer.mobile;
      const isIdChanged = idPhoneForm.newIdNumber && idPhoneForm.newIdNumber !== selectedCustomer.id_number;

      if (!isPhoneChanged && !isIdChanged && !documentUrl) {
        alert('No changes detected compared to existing records.');
        setLoading(false);
        return;
      }

      const editRequestData = {
        customer_id: selectedCustomer.id,
        current_mobile: selectedCustomer.mobile,
        current_id_number: selectedCustomer.id_number,
        new_mobile: newMobile,
        new_id_number: newIdNumber,
        edit_type: isPhoneChanged && isIdChanged ? 'both' : isPhoneChanged ? 'phone' : 'id',
        reason: idPhoneForm.reason,
        document_url: documentUrl,
        status: 'pending_branch_manager',
        created_by: profile.id,
        tenant_id: profile.tenant_id,
        branch_id: profile.branch_id || selectedCustomer.branch_id,
        region_id: profile.region_id || selectedCustomer.region_id,
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('customer_phone_id_edit_requests')
        .insert([editRequestData]);

      if (insertError) throw insertError;

      alert('Edit request submitted successfully!');

      // Reset form
      setIdPhoneForm({
        newMobile: '',
        newIdNumber: '',
        reason: '',
        document: null,
        documentPreview: null
      });
      setSelectedCustomer(null);

      fetchEditRequests();
    } catch (error) {
      console.error('Error submitting edit request:', error);
      alert('Error submitting request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId, newStatus) => {
    const action = newStatus === 'confirmed' ? 'approve' : newStatus === 'approved' ? 'give final approval to' : 'reject';
    if (!confirm(`Are you sure you want to ${action} this request?`)) {
      return;
    }

    try {
      setLoading(true);

      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'confirmed' && hasPermission('amendments.confirm')) {
        updateData.confirmed_by = profile.id;
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'approved' && hasPermission('amendments.authorize')) {
        updateData.approved_by = profile.id;
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === 'rejected' && (hasPermission('amendments.confirm') || hasPermission('amendments.authorize'))) {
        updateData.rejected_by = profile.id;
        updateData.rejected_at = new Date().toISOString();
        const rejectionReason = prompt('Please provide a reason for rejection:');
        if (rejectionReason) {
          updateData.rejection_reason = rejectionReason;
        }
      } else {
        alert('You do not have permission to perform this action.');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('customer_phone_id_edit_requests')
        .update(updateData)
        .eq('id', requestId)
        .eq('tenant_id', profile.tenant_id);

      if (error) throw error;

      // Only update customer data when approved by credit analyst
      if (newStatus === 'approved') {
        const request = editRequests.find(r => r.id === requestId);
        if (request) {
          await supabase
            .from('customers')
            .update({
              mobile: request.new_mobile,
              id_number: request.new_id_number,
              updated_at: new Date().toISOString()
            })
            .eq('id', request.customer_id)
            .eq('tenant_id', profile.tenant_id);
        }
      }

      alert(`Request ${action}d successfully!`);
      fetchEditRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusValue = status?.toLowerCase() || '';

    let color = '#586ab1'; // default blue
    let label = status;

    if (statusValue.includes('approved')) {
      color = '#10b981';
      label = 'Approved';
    } else if (statusValue.includes('rejected')) {
      color = '#ef4444';
      label = 'Rejected';
    } else if (statusValue === 'confirmed') {
      color = '#3b82f6';
      label = 'Awaiting Authorization';
    } else if (statusValue === 'pending_branch_manager') {
      color = '#f59e0b';
      label = 'Waiting Confirmation';
    } else if (statusValue === 'pending_superadmin') {
      color = '#a855f7';
      label = 'Awaiting Review';
    }

    return (
      <span
        className="inline-block px-3 py-1 rounded text-[10px] font-medium text-white whitespace-nowrap uppercase tracking-wider"
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
    );
  };

  // const canSubmitRequest = () => {
  //   return profile && ['relationship_officer', 'branch_manager', 'regional_manager'].includes(profile.role);
  // };

  const canConfirm = (request) => {
    return profile?.role === 'branch_manager' && request.status === 'pending_branch_manager';
  };

  const canApprove = (request) => {
    return profile?.role === 'regional_manager' && request.status === 'confirmed';
  };

  const canReject = (request) => {
    return (profile?.role === 'branch_manager' && request.status === 'pending_branch_manager') ||
      (profile?.role === 'regional_manager' && request.status === 'confirmed');
  };

  // View Request Modal with Document Comparison
  const ViewRequestModal = ({ request, onClose }) => {
    const customerName = request.customer
      ? `${request.customer.Firstname || ''} ${request.customer.Middlename || ''} ${request.customer.Surname || ''}`.trim()
      : 'Unknown Entity';

    const isPdf = request.document_url?.toLowerCase().endsWith('.pdf');

    return (
      <div className="fixed inset-0 bg-muted backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-500">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#586ab1]/10 rounded-xl flex items-center justify-center">
                <EyeIcon className="w-5 h-5 text-[#586ab1]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 tracking-tight">Review Record Amendment</h3>
                <div className="flex items-center gap-2 text-[10px]  text-slate-400 uppercase tracking-widest mt-0.5">
                  <span>{customerName}</span>
                  <span className="text-slate-300">•</span>
                  <span>ID: {request.customer?.id_number || 'N/A'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-gray-50/50">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Details & Comparisons */}
              <div className="space-y-6">
                {/* Visual Comparison Card */}
                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Data Diff Comparison</p>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="space-y-4">
                    {/* Identity Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Original State</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <PhoneIcon className="w-3.5 h-3.5" />
                            {request.current_mobile || 'None'}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <CreditCardIcon className="w-3.5 h-3.5" />
                            {request.current_id_number || 'None'}
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-[#586ab1]/5 rounded-xl border border-[#586ab1]/10">
                        <p className="text-[10px] font-semibold text-[#586ab1] uppercase mb-2">Proposed Update</p>
                        <div className="space-y-1.5">
                          <div className={`flex items-center gap-2 text-xs font-semibold ${request.current_mobile !== request.new_mobile ? 'text-[#586ab1]' : 'text-slate-400'}`}>
                            <PhoneIcon className="w-3.5 h-3.5" />
                            {request.new_mobile || '---'}
                          </div>
                          <div className={`flex items-center gap-2 text-xs font-semibold ${request.current_id_number !== request.new_id_number ? 'text-[#586ab1]' : 'text-slate-400'}`}>
                            <CreditCardIcon className="w-3.5 h-3.5" />
                            {request.new_id_number || '---'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2 tracking-widest">Reasoning & Justification</p>
                    <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs font-medium text-slate-600 leading-relaxed italic">
                      &ldquo;{request.reason}&rdquo;
                    </div>
                  </div>
                </div>

                {/* Audit Trail Card */}
                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <ClockIcon className="w-4 h-4 text-slate-400" />
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Request Lifecycle</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Initiator</p>
                      <p className="text-xs font-medium text-slate-700">{request.created_by_user?.full_name || 'System Auto'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Timestamp</p>
                      <p className="text-xs font-medium text-slate-700">{new Date(request.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                </div>

                {/* Rejection Alert */}
                {request.rejection_reason && request.status === 'rejected' && (
                  <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-red-900 uppercase tracking-widest mb-1">Rejection Grounds</p>
                        <p className="text-xs font-medium text-red-700 italic">{request.rejection_reason}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Documentation Review */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="w-4 h-4 text-[#586ab1]" />
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Evidence Submission</p>
                  </div>
                  {isPdf && (
                    <a
                      href={request.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-[#586ab1] uppercase tracking-widest hover:underline"
                    >
                      Source PDF
                    </a>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm h-[320px] relative transition-all hover:border-[#586ab1]/30">
                  {isPdf ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                      <div className="w-16 h-16 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                        <DocumentTextIcon className="w-8 h-8 text-[#586ab1]" />
                      </div>
                      <h4 className="text-base font-black text-slate-800 mb-2">Electronic Document</h4>
                      <p className="text-xs text-slate-500 font-bold mb-8 max-w-xs">PDF evidence is ready for detailed analysis in a secure environment.</p>
                      <a
                        href={request.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-10 py-3 bg-[#586ab1] text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[#586ab1]/20 hover:scale-[1.05] transition-all active:scale-95"
                      >
                        Launch PDF Viewer
                      </a>
                    </div>
                  ) : (
                    <div className="w-full h-full p-4">
                      <img
                        src={request.document_url}
                        alt="Supporting Evidence"
                        className="w-full h-full object-contain rounded-xl shadow-lg border border-white transition-all group-hover:scale-[1.01]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer: Action Zone */}
        {(canConfirm(request) || canApprove(request) || canReject(request)) && (
          <div className="p-5 border-t border-gray-100 bg-gray-50/50">
            <div className="flex gap-3">
              {canConfirm(request) && (
                <button
                  onClick={() => handleStatusUpdate(request.id, 'confirmed')}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-[#586ab1] text-white rounded-xl font-semibold text-xs uppercase tracking-widest shadow-lg shadow-[#586ab1]/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  Confirm (BM)
                </button>
              )}

              {canApprove(request) && (
                <button
                  onClick={() => handleStatusUpdate(request.id, 'approved')}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  Approve (RM)
                </button>
              )}

              {canReject(request) && (
                <button
                  onClick={() => handleStatusUpdate(request.id, 'rejected')}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-semibold text-xs uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-btn mx-auto"></div>
          <p className="mt-3 text-muted font-body">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted font-sans">

      {/* Breadcrumb Header */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">
        <h1 className="text-xs text-slate-500 mb-4 font-medium">
          Information Updates / Customer Edits
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 text-slate-600">


        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {hasPermission('amendments.initiate') && (
            <div className="relative group flex-1 md:max-w-md">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 group-focus-within:text-[#586ab1] transition-colors" />
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search customers to initiate edit..."
                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#586ab1]/10 focus:border-[#586ab1] transition-all"
              />
              {searching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <ArrowPathIcon className="w-4 h-4 text-[#586ab1] animate-spin" />
                </div>
              )}

              {/* Premium Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-[100] overflow-hidden backdrop-blur-xl bg-white/95">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                    <span className="text-sm   text-slate-600  px-2">Results found ({searchResults.length})</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {searchResults.map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full flex items-center justify-between p-3 hover:bg-[#586ab1]/5 transition-colors group text-left border-b border-slate-50 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500  group-hover:bg-slate-400 group-hover:text-white transition-all text-sm">
                            {customer.Firstname?.[0]}{customer.Surname?.[0]}
                          </div>
                          <div>
                            <p className="text-sm  text-slate-600 leading-none mb-1 group-hover:text-slate-600 transition-colors">
                              {customer.Firstname}  {customer.Surname}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded ">{customer.id_number}</span>
                              <span className="text-sm  text-slate-600">{customer.mobile}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#586ab1] group-hover:text-white transition-all">
                          <PencilSquareIcon className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inline Edit Form — shown only when customer selected and user has permission */}
        {selectedCustomer && hasPermission('amendments.initiate') && (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#586ab1] flex items-center justify-center text-white shadow-lg shadow-[#586ab1]/20">
                  <PencilSquareIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm  text-slate-600 ">Edit Identity & Contact</h3>
                  <p className="text-xs  text-slate-600  mt-0.5">
                    Customer: {selectedCustomer.Firstname} {selectedCustomer.Surname}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-slate-100"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitIdPhoneEdit} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Phone Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 bg-[#586ab1] rounded-full"></span>
                    <h4 className="text-sm   text-slate-600 ">Phone Number Update</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm text-slate-600  mb-2 px-1">Current Mobile</label>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm  text-slate-500 select-none">
                        {selectedCustomer.mobile || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600  mb-2 px-1">New Mobile Number</label>
                      <input
                        type="text"
                        value={idPhoneForm.newMobile}
                        onChange={(e) => setIdPhoneForm(prev => ({ ...prev, newMobile: e.target.value }))}
                        placeholder="Enter new phone number..."
                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#586ab1]/10 focus:border-[#586ab1] transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* ID Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    <h4 className="text-sm  text-slate-600 ">ID Number Update</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm  text-slate-600  mb-2 px-1">Current ID</label>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm  text-slate-500 select-none">
                        {selectedCustomer.id_number || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm  text-slate-600  mb-2 px-1">New ID Number</label>
                      <input
                        type="text"
                        value={idPhoneForm.newIdNumber}
                        onChange={(e) => setIdPhoneForm(prev => ({ ...prev, newIdNumber: e.target.value }))}
                        placeholder="Enter new ID number..."
                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#586ab1]/10 focus:border-[#586ab1] transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  <h4 className="text-sm  text-slate-600 ">Reason for Change</h4>
                </div>
                <textarea
                  value={idPhoneForm.reason}
                  onChange={(e) => setIdPhoneForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please provide a detailed reason for this modification request..."
                  rows="3"
                  className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#586ab1]/10 focus:border-[#586ab1] transition-all"
                  required
                />
              </div>

              {/* Document Section */}
              {documentUploadEnabled && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                    <h4 className="text-sm   text-slate-600 ">Supporting Evidence</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-8 transition-all hover:border-[#586ab1] hover:bg-[#586ab1]/5 flex flex-col items-center justify-center text-center">
                      <input
                        type="file"
                        id="document-upload"
                        onChange={handleDocumentUpload}
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        required={documentUploadEnabled}
                      />
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-[#586ab1] group-hover:text-white transition-all">
                        <ArrowUpTrayIcon className="w-8 h-8" />
                      </div>
                      <p className="text-sm  text-slate-900 mb-1">Click to Upload Document</p>
                      <p className="text-sm text-slate-600 ">ID Copy / Support Document</p>
                      <label
                        htmlFor="document-upload"
                        className="absolute inset-0 cursor-pointer"
                      />
                    </div>
                    {idPhoneForm.documentPreview ? (
                      <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 group">
                        <img src={idPhoneForm.documentPreview} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setIdPhoneForm(prev => ({ ...prev, document: null, documentPreview: null }))}
                            className="p-3 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 transition-colors"
                          >
                            <XMarkIcon className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : idPhoneForm.document ? (
                      <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <DocumentTextIcon className="w-6 h-6 text-[#586ab1]" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm  text-slate-600 truncate">{idPhoneForm.document.name}</p>
                          <p className="text-sm text-slate-600 ">PDF DOCUMENT</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIdPhoneForm(prev => ({ ...prev, document: null, documentPreview: null }))}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center italic text-slate-400 text-xs">
                        Document preview will appear here
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Form Footer */}
              <div className="flex items-center justify-end gap-4 pt-8 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-8 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl   hover:bg-slate-50 transition-all"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-10 py-3 bg-[#586ab1] text-white rounded-xl     hover:bg-[#475589] transition-all shadow-xl shadow-[#586ab1]/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                  {loading ? 'Submitting...' : 'Submit Update Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters & Table Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Enhanced Control Bar */}
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-72 group">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#586ab1] transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests..."
                className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#586ab1]/10 focus:border-[#586ab1] transition-all text-slate-600 font-sans"
              />
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-full md:w-auto">
                <div className="relative group min-w-[200px]">
                  <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#586ab1]" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-[#586ab1]/10 focus:border-[#586ab1] transition-all appearance-none text-slate-600 font-medium text-xs cursor-pointer font-sans"
                  >
                    <option value="all">All Access Records</option>
                    <option value="pending_branch_manager">Pending BM Action</option>
                    <option value="confirmed">Pending RM Action</option>
                    <option value="approved">Successfully Approved</option>
                    <option value="rejected">Rejected/Archived</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDownIcon className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full border-collapse font-sans">
              <thead>
                <tr className="border-b" style={{ backgroundColor: '#E7F0FA' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">Current Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">New Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">Current ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">New ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">Requested By</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-8 py-24 text-center">
                      <div className="inline-flex flex-col items-center gap-4">
                        <div className="p-4 bg-slate-50 rounded-full animate-pulse border-4 border-slate-100">
                          <ArrowPathIcon className="w-10 h-10 text-[#586ab1] animate-spin" />
                        </div>
                        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Synchronizing Records...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-8 py-24 text-center">
                      <div className="inline-flex flex-col items-center gap-4">
                        <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 grayscale opacity-40">
                          <DocumentTextIcon className="w-16 h-16 text-slate-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-black text-slate-400 tracking-tight text-xl uppercase italic">No Activity Found</p>
                          <p className="text-slate-400 text-sm font-bold">Refine your filters or search query.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request, idx) => {
                    const customerName = request.customer
                      ? `${request.customer.Firstname || ''} ${request.customer.Middlename || ''} ${request.customer.Surname || ''}`.trim()
                      : 'Unknown Entity';

                    return (
                      <tr key={request.id} className={`group hover:bg-gray-100/50 transition-all border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center transition-transform group-hover:scale-110">
                              <UserIcon className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 leading-tight group-hover:text-[#586ab1] transition-colors whitespace-nowrap">{customerName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="bg-[#E7F0FA] text-[9px] font-bold text-slate-600 px-1.5 py-0.5 rounded tracking-tighter uppercase">ID Request</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {request.current_mobile || '---'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${request.current_mobile !== request.new_mobile ? 'text-[#586ab1] font-semibold' : 'text-slate-400'}`}>
                            {request.new_mobile || '---'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {request.current_id_number || '---'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${request.current_id_number !== request.new_id_number ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>
                            {request.new_id_number || '---'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-600 whitespace-nowrap">
                            {new Date(request.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {new Date(request.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {request.created_by_user?.full_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(`/registry/customer-edits/review/${request.id}/phone_id`)}
                            className="p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
                            title="Quick Review"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerEdits;
