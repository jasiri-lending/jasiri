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
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";

function CustomerEdits() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editRequests, setEditRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editType, setEditType] = useState(null); // 'id_phone' or 'other_details'
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);

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

    if (!idPhoneForm.document) {
      alert('Please upload a supporting document');
      return;
    }

    try {
      setLoading(true);

      const documentUrl = await uploadSupportDocument(idPhoneForm.document);

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
      } else if (newStatus === 'approved' && profile.role === 'credit_analyst_officer') {
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
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        label: 'Pending Manager'
      },
      'confirmed': {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: 'Manager Approved'
      },
      'approved': {
        bg: 'bg-accent/20',
        text: 'text-accent',
        label: 'Approved'
      },
      'rejected': {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: 'Rejected'
      }
    };

    const config = configs[status] || configs['pending_branch_manager'];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
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
    return profile?.role === 'credit_analyst_officer' && request.status === 'confirmed';
  };

  const canReject = (request) => {
    return (profile?.role === 'branch_manager' && request.status === 'pending_branch_manager') ||
      (profile?.role === 'credit_analyst_officer' && request.status === 'confirmed');
  };

  // Customer Search Modal
  const CustomerSearchModal = ({ onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async (value) => {
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
          query = query.or(
            `Firstname.ilike.%${value}%,Middlename.ilike.%${value}%,Surname.ilike.%${value}%,mobile.ilike.%${value}%,id_number.eq.${value}`
          );
        } else {
          query = query.or(
            `Firstname.ilike.%${value}%,Middlename.ilike.%${value}%,Surname.ilike.%${value}%,mobile.ilike.%${value}%`
          );
        }

        const { data, error } = await query;

        if (error) {
          console.error("Search error:", error.message);
          setSearchResults([]);
          return;
        }

        setSearchResults(data || []);
      } catch (err) {
        console.error("Unexpected error:", err.message);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-xl font-heading font-semibold text-primary">Search Customer</h3>
            <button onClick={onClose} className="p-2 hover:bg-neutral rounded-lg transition-colors">
              <XMarkIcon className="w-6 h-6 text-muted" />
            </button>
          </div>

          <div className="p-6">
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name, phone, or ID number..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-btn focus:border-transparent font-body"
                autoFocus
              />
              {searching && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <ArrowPathIcon className="w-5 h-5 text-muted animate-spin" />
                </div>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {searchResults.length === 0 && searchTerm.length >= 2 && !searching && (
                <div className="text-center py-8 text-muted font-body">
                  No customers found
                </div>
              )}

              {searchResults.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => {
                    onSelect(customer);
                    onClose();
                  }}
                  className="p-4 hover:bg-brand-surface cursor-pointer rounded-xl transition-colors mb-2 border border-transparent hover:border-brand-secondary"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-brand-surface rounded-xl flex items-center justify-center mr-4">
                      <UserIcon className="w-6 h-6 text-brand-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-semibold text-text">
                        {`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()}
                      </p>
                      <div className="flex items-center gap-4 mt-1">
                        {customer.mobile && (
                          <span className="text-sm text-muted flex items-center font-body">
                            <PhoneIcon className="w-4 h-4 mr-1.5" /> {customer.mobile}
                          </span>
                        )}
                        {customer.id_number && (
                          <span className="text-sm text-muted flex items-center font-body">
                            <CreditCardIcon className="w-4 h-4 mr-1.5" /> {customer.id_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ID/Phone Edit Modal
  const IdPhoneEditModal = ({ onClose }) => {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl my-8">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-brand-surface sticky top-0">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mr-3">
                <PencilSquareIcon className="w-6 h-6 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-xl font-heading font-semibold text-primary">Edit ID / Phone Number</h3>
                <p className="text-sm text-muted font-body">Request changes to customer contact details</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-colors">
              <XMarkIcon className="w-6 h-6 text-muted" />
            </button>
          </div>

          <form onSubmit={handleSubmitIdPhoneEdit} className="p-6">
            {/* Customer Info Display */}
            {selectedCustomer && (
              <div className="mb-6 p-4 bg-brand-surface rounded-xl border border-brand-secondary">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-4">
                    <UserIcon className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-heading font-semibold text-text">
                      {`${selectedCustomer.Firstname || ''} ${selectedCustomer.Middlename || ''} ${selectedCustomer.Surname || ''}`.trim()}
                    </h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-muted font-body flex items-center">
                        <PhoneIcon className="w-4 h-4 mr-1" /> {selectedCustomer.mobile || 'N/A'}
                      </span>
                      <span className="text-sm text-muted font-body flex items-center">
                        <CreditCardIcon className="w-4 h-4 mr-1" /> {selectedCustomer.id_number || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Phone Number */}
            <div className="mb-6">
              <label className="block text-sm font-heading font-medium text-text mb-3">
                New Phone Number <span className="text-muted font-body text-xs">(Optional if updating ID)</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted mb-2 font-body">Current</p>
                  <div className="p-3 bg-neutral rounded-xl border border-gray-300 font-body text-text">
                    {selectedCustomer?.mobile || 'Not set'}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted mb-2 font-body">New</p>
                  <input
                    type="text"
                    value={idPhoneForm.newMobile}
                    onChange={(e) => setIdPhoneForm(prev => ({ ...prev, newMobile: e.target.value }))}
                    placeholder="Enter new phone number"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-btn focus:border-transparent font-body"
                  />
                </div>
              </div>
            </div>

            {/* ID Number */}
            <div className="mb-6">
              <label className="block text-sm font-heading font-medium text-text mb-3">
                New ID Number <span className="text-muted font-body text-xs">(Optional if updating phone)</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted mb-2 font-body">Current</p>
                  <div className="p-3 bg-neutral rounded-xl border border-gray-300 font-body text-text">
                    {selectedCustomer?.id_number || 'Not set'}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted mb-2 font-body">New</p>
                  <input
                    type="text"
                    value={idPhoneForm.newIdNumber}
                    onChange={(e) => setIdPhoneForm(prev => ({ ...prev, newIdNumber: e.target.value }))}
                    placeholder="Enter new ID number"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-btn focus:border-transparent font-body"
                  />
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="mb-6">
              <label className="block text-sm font-heading font-medium text-text mb-2">
                Reason for Change <span className="text-red-500">*</span>
              </label>
              <textarea
                value={idPhoneForm.reason}
                onChange={(e) => setIdPhoneForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Provide detailed reason for this change..."
                rows="4"
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-btn focus:border-transparent font-body"
                required
              />
            </div>

            {/* Document Upload */}
            <div className="mb-6">
              <label className="block text-sm font-heading font-medium text-text mb-2">
                Supporting Document <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-btn transition-colors">
                <input
                  type="file"
                  id="document-upload"
                  onChange={handleDocumentUpload}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  required
                />
                <DocumentTextIcon className="w-12 h-12 text-muted mx-auto mb-3" />
                <p className="text-sm text-text mb-1 font-body">
                  {idPhoneForm.document ? idPhoneForm.document.name : 'Upload new ID copy or supporting document'}
                </p>
                <p className="text-xs text-muted mb-4 font-body">JPG, PNG, PDF (Max 5MB)</p>
                <label
                  htmlFor="document-upload"
                  className="inline-block px-6 py-2.5 bg-brand-btn text-white rounded-xl hover:bg-brand-primary font-medium font-body cursor-pointer transition-colors"
                >
                  Choose File
                </label>

                {idPhoneForm.documentPreview && (
                  <div className="mt-4">
                    <img
                      src={idPhoneForm.documentPreview}
                      alt="Document preview"
                      className="max-h-48 mx-auto rounded-xl border-2 border-gray-200"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 text-text rounded-xl hover:bg-neutral font-medium font-body transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-brand-btn text-white rounded-xl hover:bg-brand-primary disabled:opacity-50 font-medium font-body transition-colors flex items-center"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // View Request Modal with Document Comparison
  const ViewRequestModal = ({ request, onClose }) => {
    const customerName = request.customer
      ? `${request.customer.Firstname || ''} ${request.customer.Middlename || ''} ${request.customer.Surname || ''}`.trim()
      : 'Unknown Customer';

    const isPdf = request.document_url?.toLowerCase().endsWith('.pdf');

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl my-8">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-brand-surface sticky top-0">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mr-3">
                <EyeIcon className="w-6 h-6 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-xl font-heading font-semibold text-primary">Review Edit Request</h3>
                <p className="text-sm text-muted font-body">{customerName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-colors">
              <XMarkIcon className="w-6 h-6 text-muted" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Changes & Details */}
              <div className="space-y-4">
                {/* Status */}
                <div className="p-4 bg-neutral rounded-xl">
                  <p className="text-xs font-heading font-medium text-muted uppercase tracking-wide mb-2">Status</p>
                  {getStatusBadge(request.status)}
                </div>

                {/* Customer Current Info */}
                <div className="p-4 bg-neutral rounded-xl">
                  <p className="text-xs font-heading font-medium text-muted uppercase tracking-wide mb-3">Current Information</p>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <PhoneIcon className="w-4 h-4 text-muted mr-2" />
                      <span className="text-sm font-body text-text">{request.current_mobile || 'Not set'}</span>
                    </div>
                    <div className="flex items-center">
                      <CreditCardIcon className="w-4 h-4 text-muted mr-2" />
                      <span className="text-sm font-body text-text">{request.current_id_number || 'Not set'}</span>
                    </div>
                  </div>
                </div>

                {/* Requested Changes */}
                <div className="p-4 bg-accent/10 rounded-xl border-2 border-accent/30">
                  <p className="text-xs font-heading font-medium text-accent uppercase tracking-wide mb-3">Requested Changes</p>
                  <div className="space-y-3">
                    {request.current_mobile !== request.new_mobile && (
                      <div>
                        <p className="text-xs text-muted font-body mb-1">New Phone Number</p>
                        <p className="text-base font-heading font-semibold text-accent">{request.new_mobile}</p>
                      </div>
                    )}
                    {request.current_id_number !== request.new_id_number && (
                      <div>
                        <p className="text-xs text-muted font-body mb-1">New ID Number</p>
                        <p className="text-base font-heading font-semibold text-accent">{request.new_id_number}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reason */}
                <div className="p-4 bg-neutral rounded-xl">
                  <p className="text-xs font-heading font-medium text-muted uppercase tracking-wide mb-2">Reason</p>
                  <p className="text-sm font-body text-text leading-relaxed">{request.reason}</p>
                </div>

                {/* Request Info */}
                <div className="p-4 bg-neutral rounded-xl">
                  <p className="text-xs font-heading font-medium text-muted uppercase tracking-wide mb-2">Request Details</p>
                  <div className="space-y-1.5">
                    <p className="text-sm font-body text-text">
                      <span className="text-muted">Submitted by:</span> {request.created_by_user?.full_name || 'Unknown'}
                    </p>
                    <p className="text-sm font-body text-text">
                      <span className="text-muted">Date:</span> {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Rejection Reason */}
                {request.rejection_reason && request.status === 'rejected' && (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-heading font-medium text-red-900 uppercase tracking-wide mb-1">Rejection Reason</p>
                        <p className="text-sm font-body text-red-700">{request.rejection_reason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {(canConfirm(request) || canApprove(request) || canReject(request)) && (
                  <div className="flex flex-col gap-2 pt-4">
                    {canConfirm(request) && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'confirmed')}
                        disabled={loading}
                        className="w-full px-4 py-3 bg-brand-btn text-white rounded-xl hover:bg-brand-primary disabled:opacity-50 font-medium font-heading transition-colors"
                      >
                        Approve as Branch Manager
                      </button>
                    )}

                    {canApprove(request) && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'approved')}
                        disabled={loading}
                        className="w-full px-4 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-50 font-medium font-heading transition-colors"
                      >
                        Give Final Approval
                      </button>
                    )}

                    {canReject(request) && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'rejected')}
                        disabled={loading}
                        className="w-full px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium font-heading transition-colors"
                      >
                        Reject Request
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Supporting Document */}
              <div>
                <div className="sticky top-24">
                  <div className="p-4 bg-neutral rounded-xl mb-4">
                    <p className="text-xs font-heading font-medium text-muted uppercase tracking-wide mb-3">Supporting Document</p>
                    <p className="text-sm font-body text-text mb-4">
                      Compare the document provided with the requested changes
                    </p>
                  </div>

                  <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
                    {isPdf ? (
                      <div className="p-8 text-center bg-neutral">
                        <DocumentTextIcon className="w-16 h-16 text-muted mx-auto mb-4" />
                        <p className="text-sm text-text font-body mb-4">PDF Document</p>
                        <a
                          href={request.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-6 py-2.5 bg-brand-btn text-white rounded-xl hover:bg-brand-primary font-medium font-body transition-colors"
                        >
                          <EyeIcon className="w-5 h-5 mr-2" />
                          Open PDF in New Tab
                        </a>
                      </div>
                    ) : (
                      <img
                        src={request.document_url}
                        alt="Supporting Document"
                        className="w-full h-auto"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-neutral flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-btn mx-auto"></div>
          <p className="mt-3 text-muted font-body">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral">
      {/* Modals */}
      {showEditModal && editType === 'customer_search' && (
        <CustomerSearchModal
          onClose={() => {
            setShowEditModal(false);
            setEditType(null);
          }}
          onSelect={(customer) => {
            setSelectedCustomer(customer);
            setIdPhoneForm({
              newMobile: '',
              newIdNumber: '',
              reason: '',
              document: null,
              documentPreview: null
            });
            setEditType('id_phone');
          }}
        />
      )}

      {showEditModal && editType === 'id_phone' && selectedCustomer && (
        <IdPhoneEditModal
          onClose={() => {
            setShowEditModal(false);
            setEditType(null);
            setSelectedCustomer(null);
            setIdPhoneForm({
              newMobile: '',
              newIdNumber: '',
              reason: '',
              document: null,
              documentPreview: null
            });
          }}
        />
      )}

      {viewingRequest && (
        <ViewRequestModal
          request={viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-heading font-bold text-primary">Customer Information Updates</h1>
              <p className="text-muted mt-2 font-body">Manage customer contact detail change requests</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-3 px-5 py-3 bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="w-10 h-10 bg-brand-surface rounded-xl flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text font-body">{profile.full_name || profile.email}</p>
                  <p className="text-xs text-muted capitalize font-body">{profile.role?.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {canSubmitRequest() && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setEditType('customer_search');
                  setShowEditModal(true);
                }}
                className="inline-flex items-center px-6 py-3 bg-brand-btn text-white rounded-xl hover:bg-brand-primary font-medium font-heading transition-colors shadow-sm hover:shadow-md"
              >
                <PencilSquareIcon className="w-5 h-5 mr-2" />
                Edit ID / Phone Number
              </button>

              <button
                onClick={() => alert('Other details editing coming soon')}
                className="inline-flex items-center px-6 py-3 bg-white border-2 border-brand-btn text-brand-btn rounded-xl hover:bg-brand-surface font-medium font-heading transition-colors"
              >
                <DocumentTextIcon className="w-5 h-5 mr-2" />
                Edit Other Details
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by customer name, phone, or ID..."
                  className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-btn focus:border-transparent font-body"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <FunnelIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-btn focus:border-transparent font-body appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="pending_branch_manager">Pending Manager</option>
                <option value="confirmed">Manager Approved</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-surface border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-heading font-semibold text-primary uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-heading font-semibold text-primary uppercase tracking-wider">
                    Current Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-heading font-semibold text-primary uppercase tracking-wider">
                    Requested Changes
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-heading font-semibold text-primary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-heading font-semibold text-primary uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-heading font-semibold text-primary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <ArrowPathIcon className="w-8 h-8 text-brand-btn animate-spin mx-auto mb-3" />
                      <p className="text-muted font-body">Loading requests...</p>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-muted font-body">No edit requests found</p>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map(request => {
                    const customerName = request.customer
                      ? `${request.customer.Firstname || ''} ${request.customer.Middlename || ''} ${request.customer.Surname || ''}`.trim()
                      : 'Unknown';

                    return (
                      <tr key={request.id} className="hover:bg-neutral transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-brand-surface rounded-lg flex items-center justify-center mr-3">
                              <UserIcon className="w-5 h-5 text-brand-primary" />
                            </div>
                            <div>
                              <p className="font-heading font-medium text-text">{customerName}</p>
                              <p className="text-xs text-muted font-body">
                                by {request.created_by_user?.full_name || 'Unknown'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {request.customer?.mobile && (
                              <div className="flex items-center text-sm text-muted font-body">
                                <PhoneIcon className="w-4 h-4 mr-1.5" />
                                {request.customer.mobile}
                              </div>
                            )}
                            {request.customer?.id_number && (
                              <div className="flex items-center text-sm text-muted font-body">
                                <CreditCardIcon className="w-4 h-4 mr-1.5" />
                                {request.customer.id_number}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {request.current_mobile !== request.new_mobile && (
                              <div className="text-sm font-body">
                                <span className="text-muted">Phone:</span>{' '}
                                <span className="text-accent font-medium">{request.new_mobile}</span>
                              </div>
                            )}
                            {request.current_id_number !== request.new_id_number && (
                              <div className="text-sm font-body">
                                <span className="text-muted">ID:</span>{' '}
                                <span className="text-accent font-medium">{request.new_id_number}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-text font-body">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted font-body">
                            {new Date(request.created_at).toLocaleTimeString()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setViewingRequest(request)}
                            className="inline-flex items-center px-4 py-2 bg-brand-btn text-white rounded-lg hover:bg-brand-primary font-medium text-sm font-body transition-colors"
                          >
                            <EyeIcon className="w-4 h-4 mr-1.5" />
                            View
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

        {/* Summary Stats */}
        {editRequests.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Requests', value: editRequests.length, color: 'bg-blue-100 text-blue-800' },
              { label: 'Pending', value: editRequests.filter(r => r.status === 'pending_branch_manager').length, color: 'bg-amber-100 text-amber-800' },
              { label: 'Approved', value: editRequests.filter(r => r.status === 'approved').length, color: 'bg-accent/20 text-accent' },
              { label: 'Rejected', value: editRequests.filter(r => r.status === 'rejected').length, color: 'bg-red-100 text-red-800' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm font-body text-muted mb-1">{stat.label}</p>
                <p className={`text-3xl font-heading font-bold ${stat.color.split(' ')[1]}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerEdits;