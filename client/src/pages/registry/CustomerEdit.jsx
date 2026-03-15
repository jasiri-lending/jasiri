import { useState, useEffect } from 'react';
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
import { useTenantFeatures } from "../../hooks/useTenantFeatures.js";

function CustomerEdits() {
  const { profile } = useAuth();
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editType, setEditType] = useState(null); // 'id_phone' or 'other_details'
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);

  const primaryColor = "#586ab1";
  const primaryLight = "rgba(88, 106, 177, 0.1)";

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

      const editRequestData = {
        customer_id: selectedCustomer.id,
        current_mobile: selectedCustomer.mobile,
        current_id_number: selectedCustomer.id_number,
        new_mobile: idPhoneForm.newMobile || selectedCustomer.mobile,
        new_id_number: idPhoneForm.newIdNumber || selectedCustomer.id_number,
        edit_type: idPhoneForm.newMobile && idPhoneForm.newIdNumber ? 'both' : idPhoneForm.newMobile ? 'phone' : 'id',
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
      setShowEditModal(false);

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

      if (newStatus === 'confirmed' && profile.role === 'branch_manager') {
        updateData.confirmed_by = profile.id;
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'approved' && profile.role === 'regional_manager') {
        updateData.approved_by = profile.id;
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === 'rejected') {
        updateData.rejected_by = profile.id;
        updateData.rejected_at = new Date().toISOString();
        const rejectionReason = prompt('Please provide a reason for rejection:');
        if (rejectionReason) {
          updateData.rejection_reason = rejectionReason;
        }
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
      setViewingRequest(null);
      fetchEditRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      'pending_branch_manager': {
        bg: 'bg-amber-50 border-amber-200',
        text: 'text-amber-700',
        dot: 'bg-amber-400',
        label: 'Pending BM'
      },
      'confirmed': {
        bg: 'bg-blue-50 border-blue-200',
        text: 'text-blue-700',
        dot: 'bg-blue-400',
        label: 'Pending RM Approval'
      },
      'approved': {
        bg: 'bg-emerald-50 border-emerald-200',
        text: 'text-emerald-700',
        dot: 'bg-emerald-400',
        label: 'Approved'
      },
      'rejected': {
        bg: 'bg-red-50 border-red-200',
        text: 'text-red-700',
        dot: 'bg-red-400',
        label: 'Rejected'
      }
    };

    const config = configs[status] || configs['pending_branch_manager'];

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${config.bg} ${config.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`}></span>
        {config.label}
      </span>
    );
  };

  const canSubmitRequest = () => {
    return profile && ['relationship_officer', 'branch_manager', 'regional_manager'].includes(profile.role);
  };

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
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
        <div className="bg-white rounded-[2rem] max-w-6xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20 animate-in zoom-in-95 duration-500">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-[#E7F0FA]/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#586ab1]/10 rounded-2xl flex items-center justify-center shadow-inner">
                <EyeIcon className="w-6 h-6 text-[#586ab1]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Review Record Amendment</h3>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  <span>{customerName}</span>
                  <span className="text-slate-300">•</span>
                  <span>ID: {request.customer?.id_number || 'N/A'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all active:scale-90"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Column: Details & Comparisons */}
              <div className="space-y-8">
                {/* Visual Comparison Card */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#586ab1] to-indigo-500 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                  <div className="relative p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Diff Comparison</p>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="space-y-4">
                      {/* Identity Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Original State</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 opacity-60 text-xs font-bold truncate text-slate-600">
                              <PhoneIcon className="w-3.5 h-3.5" />
                              {request.current_mobile || 'None'}
                            </div>
                            <div className="flex items-center gap-2 opacity-60 text-xs font-bold truncate text-slate-600">
                              <CreditCardIcon className="w-3.5 h-3.5" />
                              {request.current_id_number || 'None'}
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-[#586ab1]/5 rounded-2xl border border-[#586ab1]/10 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 opacity-10">
                            <ArrowPathIcon className="w-12 h-12" />
                          </div>
                          <p className="text-[10px] font-black text-[#586ab1] uppercase mb-2 leading-none">Proposed Update</p>
                          <div className="space-y-2 relative z-10">
                            <div className={`flex items-center gap-2 text-xs font-black tracking-tight ${request.current_mobile !== request.new_mobile ? 'text-[#586ab1]' : 'text-slate-400'}`}>
                              <PhoneIcon className="w-3.5 h-3.5" />
                              {request.new_mobile || '---'}
                            </div>
                            <div className={`flex items-center gap-2 text-xs font-black tracking-tight ${request.current_id_number !== request.new_id_number ? 'text-[#586ab1]' : 'text-slate-400'}`}>
                              <CreditCardIcon className="w-3.5 h-3.5" />
                              {request.new_id_number || '---'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Reasoning & Justification</p>
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-600 leading-relaxed italic">
                        &ldquo;{request.reason}&rdquo;
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit Trail Card */}
                <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <ClockIcon className="w-4 h-4 text-slate-400" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Request Lifecycle</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Initiator</p>
                      <p className="text-xs font-black text-slate-800 tracking-tight leading-tight">{request.created_by_user?.full_name || 'System Auto'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Timestamp</p>
                      <p className="text-xs font-black text-slate-800 tracking-tight leading-tight">{new Date(request.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                </div>

                {/* Rejection Alert */}
                {request.rejection_reason && request.status === 'rejected' && (
                  <div className="p-6 bg-red-50 rounded-[2rem] border border-red-100 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-red-900 uppercase tracking-widest mb-1 leading-none">Rejection Grounds</p>
                        <p className="text-xs font-bold text-red-700 leading-relaxed italic">{request.rejection_reason}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Documentation Review */}
              <div className="relative h-full min-h-[400px]">
                <div className="sticky top-0 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="w-4 h-4 text-[#586ab1]" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none text-nowrap">Evidence Submission</p>
                    </div>
                    {isPdf && (
                      <a
                        href={request.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-black text-[#586ab1] uppercase tracking-widest hover:underline"
                      >
                        Source PDF
                      </a>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50/50 rounded-[2rem] border border-slate-100 overflow-hidden relative shadow-inner group">
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
            <div className="p-8 border-t border-slate-100 bg-[#E7F0FA]/20">
              <div className="flex flex-col sm:flex-row gap-4">
                {canConfirm(request) && (
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'confirmed')}
                    disabled={loading}
                    className="flex-1 group relative px-8 py-4 bg-[#586ab1] text-white rounded-2xl overflow-hidden font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#586ab1]/10 transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale"
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-center gap-3">
                      <ShieldCheckIcon className="w-4 h-4" />
                      <span>Confirm as Branch Manager</span>
                    </div>
                  </button>
                )}

                {canApprove(request) && (
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'approved')}
                    disabled={loading}
                    className="flex-1 group relative px-8 py-4 bg-emerald-600 text-white rounded-2xl overflow-hidden font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/10 transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale"
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>Finalize Approval (RM)</span>
                    </div>
                  </button>
                )}

                {canReject(request) && (
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'rejected')}
                    disabled={loading}
                    className="flex-1 group px-8 py-4 bg-white border border-red-100 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-red-50 hover:border-red-200 active:scale-95 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <XMarkIcon className="w-4 h-4" />
                      <span>Decline Request</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
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
    <div className="min-h-screen bg-neutral/30 font-body">
      {viewingRequest && (
        <ViewRequestModal
          request={viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {/* Main Content Area */}
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        {/* Compact Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Volume', value: editRequests.length, icon: DocumentTextIcon, color: 'text-[#586ab1]', light: 'bg-[#586ab1]/5' },
            { label: 'Pending BM', value: editRequests.filter(r => r.status === 'pending_branch_manager').length, icon: ClockIcon, color: 'text-amber-500', light: 'bg-amber-50' },
            { label: 'Pending RM', value: editRequests.filter(r => r.status === 'confirmed').length, icon: ShieldCheckIcon, color: 'text-blue-500', light: 'bg-blue-50' },
            { label: 'Approved Today', value: editRequests.filter(r => r.status === 'approved' && new Date(r.updated_at).toDateString() === new Date().toDateString()).length, icon: CheckCircleIcon, color: 'text-emerald-500', light: 'bg-emerald-50' },
          ].map((stat, idx) => (
            <div key={idx} className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-[#586ab1]/30 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-xl font-black text-slate-800 tracking-tighter">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-xl ${stat.light} ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative group flex-1 md:max-w-md">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#586ab1] transition-colors" />
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
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Results found ({searchResults.length})</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {searchResults.map(customer => (
                    <button
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer)}
                      className="w-full flex items-center justify-between p-3 hover:bg-[#586ab1]/5 transition-colors group text-left border-b border-slate-50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-[#586ab1] group-hover:text-white transition-all text-sm">
                          {customer.Firstname?.[0]}{customer.Surname?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-700 leading-none mb-1 group-hover:text-[#586ab1] transition-colors">
                            {customer.Firstname} {customer.Middlename} {customer.Surname}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded tracking-tighter uppercase">{customer.id_number}</span>
                            <span className="text-[10px] font-bold text-slate-400">{customer.mobile}</span>
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
        </div>

        {/* Inline Edit Form */}
        {selectedCustomer && (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#586ab1] flex items-center justify-center text-white shadow-lg shadow-[#586ab1]/20">
                  <PencilSquareIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">Edit Identity & Contact</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
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
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Phone Number Update</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Current Mobile</label>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-bold text-slate-500 select-none">
                        {selectedCustomer.mobile || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">New Mobile Number</label>
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
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">ID Number Update</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Current ID</label>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-bold text-slate-500 select-none">
                        {selectedCustomer.id_number || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">New ID Number</label>
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
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Reason for Change</h4>
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
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Supporting Evidence</h4>
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
                      <p className="text-sm font-black text-slate-700 mb-1">Click to Upload Document</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Copy / Support Document</p>
                      <label
                        htmlFor="document-upload"
                        className="absolute inset-0 cursor-pointer"
                      />
                    </div>
                    {idPhoneForm.documentPreview ? (
                      <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 group">
                        <img src={idPhoneForm.documentPreview} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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
                          <p className="text-sm font-black text-slate-700 truncate">{idPhoneForm.document.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">PDF DOCUMENT</p>
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
                  className="px-8 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-10 py-3 bg-[#586ab1] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#475589] transition-all shadow-xl shadow-[#586ab1]/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                  {loading ? 'Submitting...' : 'Submit Update Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters & Table Section */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          {/* Enhanced Control Bar */}
          <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, mobile or ID..."
                className="block w-full pl-14 pr-6 py-4 bg-white/60 backdrop-blur-sm border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 transition-all font-body text-gray-700 placeholder:text-gray-400"
              />
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative group min-w-[200px]">
                <FunnelIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-brand-primary" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-12 pr-10 py-4 bg-white/60 backdrop-blur-sm border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 transition-all appearance-none text-gray-600 font-bold text-sm cursor-pointer"
                >
                  <option value="all">All Access Records</option>
                  <option value="pending_branch_manager">Pending BM Action</option>
                  <option value="confirmed">Pending RM Action</option>
                  <option value="approved">Successfully Approved</option>
                  <option value="rejected">Rejected/Archived</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full border-collapse font-sans">
              <thead>
                <tr className="border-b" style={{ backgroundColor: '#E7F0FA' }}>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Customer</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Current Phone</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">New Phone</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Current ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">New ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Timeline</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Review Action</th>
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
                      <tr key={request.id} className={`group hover:bg-[#586ab1]/5 transition-all h-20 border-b border-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center transition-transform group-hover:scale-110">
                              <UserIcon className="w-5 h-5 text-[#586ab1]/60" />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 tracking-tight leading-tight group-hover:text-[#586ab1] transition-colors">{customerName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="bg-[#586ab1]/10 text-[9px] font-black text-[#586ab1] px-1.5 py-0.5 rounded tracking-tighter uppercase">ID Request</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {request.current_mobile || '---'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-black ${request.current_mobile !== request.new_mobile ? 'text-[#586ab1]' : 'text-slate-400'}`}>
                            {request.new_mobile || '---'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {request.current_id_number || '---'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-black ${request.current_id_number !== request.new_id_number ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {request.new_id_number || '---'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-300" />
                              <span className="text-xs font-bold text-slate-700">{new Date(request.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-5">
                              {new Date(request.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setViewingRequest(request)}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-white border border-slate-100 text-[#586ab1] rounded-xl hover:bg-[#586ab1] hover:text-white hover:border-[#586ab1] hover:shadow-lg hover:shadow-[#586ab1]/20 transition-all font-black text-[10px] uppercase tracking-widest active:scale-95"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            <span>Quick Review</span>
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