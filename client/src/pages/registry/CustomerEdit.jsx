import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  PhoneIcon,
  CreditCardIcon,
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  DocumentIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";

function CustomerEdits() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [editRequests, setEditRequests] = useState([]);
  const [selectedEditType, setSelectedEditType] = useState('both');
  const [supportDocument, setSupportDocument] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  
  const [formData, setFormData] = useState({
    mobile: '',
    idNumber: '',
    reason: ''
  });

  const primaryColor = "#586ab1";
  const primaryLight = "rgba(88, 106, 177, 0.1)";
  const primaryDark = "#475589";

  useEffect(() => {
    if (profile) {
      fetchEditRequests();
    }
  }, [profile]);

  const fetchEditRequests = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      
      let query = supabase
        .from('customer_phone_id_edit_requests')
        .select(`
          *,
          customer:customers(Firstname, Middlename, Surname, mobile, id_number, created_by, branch_id, region_id),
          document_url
        `)
        .order('created_at', { ascending: false });

      if (profile.role === 'relationship_officer') {
        query = query.eq('created_by', profile.id);
      } else if (profile.role === 'branch_manager' && profile.branch_id) {
        const { data: branchCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('branch_id', profile.branch_id);
        
        if (branchCustomers && branchCustomers.length > 0) {
          const customerIds = branchCustomers.map(c => c.id);
          query = query.in('customer_id', customerIds);
        }
      } else if (profile.role === 'regional_manager' && profile.region_id) {
        const { data: regionCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('region_id', profile.region_id);
        
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

  const handleSearchChange = async (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);

    try {
      let query = supabase.from("customers").select("*").limit(10);

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

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setSearchTerm(`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim());
    
    setFormData({
      mobile: customer.mobile || '',
      idNumber: customer.id_number || '',
      reason: ''
    });
    setSelectedEditType('both');
    setSupportDocument(null);
    setDocumentPreview(null);
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
      
      setSupportDocument(file);
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setDocumentPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setDocumentPreview(null);
      }
    }
  };

  const uploadSupportDocument = async () => {
    if (!supportDocument) return null;
    
    try {
      const fileExt = supportDocument.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `support-documents/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('customer-edits')
        .upload(filePath, supportDocument);
      
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCustomer) {
      alert('Please select a customer first');
      return;
    }

    if (!profile) {
      alert('You must be logged in to submit a request');
      return;
    }

    if (selectedEditType === 'phone' && !formData.mobile.trim()) {
      alert('Please enter a new phone number');
      return;
    }

    if (selectedEditType === 'id' && !formData.idNumber.trim()) {
      alert('Please enter a new ID number');
      return;
    }

    if (!formData.reason.trim()) {
      alert('Please provide a reason for the edit');
      return;
    }

    if (!supportDocument) {
      alert('Please upload a supporting document');
      return;
    }

    try {
      setLoading(true);

      const documentUrl = await uploadSupportDocument();
      
      const editRequestData = {
        customer_id: selectedCustomer.id,
        current_mobile: selectedCustomer.mobile,
        current_id_number: selectedCustomer.id_number,
        new_mobile: selectedEditType !== 'id' ? formData.mobile : selectedCustomer.mobile,
        new_id_number: selectedEditType !== 'phone' ? formData.idNumber : selectedCustomer.id_number,
        edit_type: selectedEditType,
        reason: formData.reason,
        document_url: documentUrl,
        status: 'pending_branch_manager',
        created_by: profile.id,
        branch_id: profile.branch_id || selectedCustomer.branch_id,
        region_id: profile.region_id || selectedCustomer.region_id,
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('customer_phone_id_edit_requests')
        .insert([editRequestData]);

      if (insertError) throw insertError;

      alert('Edit request submitted successfully!');
      
      setFormData({ mobile: '', idNumber: '', reason: '' });
      setSelectedCustomer(null);
      setSelectedEditType('both');
      setSupportDocument(null);
      setDocumentPreview(null);
      setSearchTerm('');
      
      fetchEditRequests();
    } catch (error) {
      console.error('Error submitting edit request:', error);
      alert('Error submitting request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId, newStatus) => {
    if (!confirm(`Are you sure you want to ${newStatus} this request?`)) {
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
      } else if (newStatus === 'approved' && profile.role === 'superadmin') {
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
        .eq('id', requestId);

      if (error) throw error;

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
            .eq('id', request.customer_id);
        }
      }

      alert(`Request ${newStatus} successfully!`);
      fetchEditRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending_branch_manager':
      case 'pending_superadmin':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      case 'confirmed':
        return <CheckCircleIcon className="w-5 h-5 text-blue-500" />;
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ExclamationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending_branch_manager':
        return 'Pending Branch Manager';
      case 'pending_superadmin':
        return 'Pending Superadmin';
      case 'confirmed':
        return 'Confirmed by Branch Manager';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const canConfirm = (request) => {
    return profile?.role === 'branch_manager' && request.status === 'pending_branch_manager';
  };

  const canApprove = (request) => {
    return profile?.role === 'superadmin' && request.status === 'confirmed';
  };

  const canReject = (request) => {
    return (profile?.role === 'branch_manager' || profile?.role === 'superadmin') && 
           (request.status === 'pending_branch_manager' || request.status === 'confirmed');
  };

  const canSubmitRequest = () => {
    return profile && ['relationship_officer', 'branch_manager', 'regional_manager'].includes(profile.role);
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: primaryColor }}></div>
          <p className="text-gray-600 mt-3 text-base">Loading user profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Customer Search Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: primaryColor }}>
          <MagnifyingGlassIcon className="w-5 h-5" />
          Search Customer
        </h2>

        <div className="relative mb-4">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name, ID number, or mobile..."
              className="w-full px-4 py-2.5 pl-11 border border-gray-300 rounded-lg focus:ring-1 focus:ring-offset-1 focus:outline-none transition-all text-base"
              style={{ borderColor: primaryColor, focusBorderColor: primaryColor }}
              disabled={!profile}
            />
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-4 h-4" style={{ color: primaryColor }} />
            {searching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: primaryColor }}></div>
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {searchResults.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                  style={{ borderColor: primaryLight }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 text-base">
                        {`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {customer.mobile && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 px-2 py-1 rounded" style={{ backgroundColor: primaryLight }}>
                            <PhoneIcon className="w-3 h-3" />
                            <span>{customer.mobile}</span>
                          </div>
                        )}
                        {customer.id_number && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 px-2 py-1 rounded" style={{ backgroundColor: primaryLight }}>
                            <CreditCardIcon className="w-3 h-3" />
                            <span>ID: {customer.id_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: primaryLight, borderColor: primaryColor }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-base" style={{ color: primaryDark }}>
                  {`${selectedCustomer.Firstname || ''} ${selectedCustomer.Middlename || ''} ${selectedCustomer.Surname || ''}`.trim()}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <div className="flex items-center gap-2 text-gray-700 bg-white px-3 py-1.5 rounded text-sm">
                    <PhoneIcon className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                    <div>
                      <span className="text-xs text-gray-500">Current Phone:</span>
                      <p className="font-medium">{selectedCustomer.mobile || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 bg-white px-3 py-1.5 rounded text-sm">
                    <CreditCardIcon className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                    <div>
                      <span className="text-xs text-gray-500">Current ID:</span>
                      <p className="font-medium">{selectedCustomer.id_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setSearchTerm('');
                  setFormData({ mobile: '', idNumber: '', reason: '' });
                  setSelectedEditType('both');
                  setSupportDocument(null);
                  setDocumentPreview(null);
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Form */}
      {selectedCustomer && canSubmitRequest() && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>Update Customer Information</h2>
          
          <form onSubmit={handleSubmit}>
            {/* Edit Type Selection */}
           <div className="mb-5">
  <label className="block text-sm font-medium text-gray-700 mb-3">
    What do you want to edit?
  </label>
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
  <button
    type="button"
    onClick={() => setSelectedEditType('phone')}
    className={`inline-flex items-center gap-2 py-2 px-4 border rounded-lg text-sm transition-all ${
      selectedEditType === 'phone'
        ? 'border-2 text-white'
        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
    }`}
    style={selectedEditType === 'phone' ? { 
      backgroundColor: '#7b8edb', 
      borderColor: '#7b8edb' 
    } : {}}
  >
    <PhoneIcon className="w-5 h-5" />
    <span>Phone Number Only</span>
  </button>

  <button
    type="button"
    onClick={() => setSelectedEditType('id')}
    className={`inline-flex items-center gap-2 py-2 px-4 border rounded-lg text-sm transition-all ${
      selectedEditType === 'id'
        ? 'border-2 text-white'
        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
    }`}
    style={selectedEditType === 'id' ? { 
      backgroundColor: '#7b8edb',
      borderColor: '#7b8edb' 
    } : {}}
  >
    <CreditCardIcon className="w-5 h-5" />
    <span>ID Number Only</span>
  </button>

  <button
    type="button"
    onClick={() => setSelectedEditType('both')}
    className={`inline-flex items-center gap-2 py-2 px-4 border rounded-lg text-sm transition-all ${
      selectedEditType === 'both'
        ? 'border-2 text-white'
        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
    }`}
    style={selectedEditType === 'both' ? { 
      backgroundColor: '#7b8edb',
      borderColor: '#7b8edb' 
    } : {}}
  >
    <div className="flex items-center gap-1">
      <PhoneIcon className="w-4 h-4" />
      <CreditCardIcon className="w-4 h-4" />
    </div>
    <span>Both Phone & ID</span>
  </button>
</div>

</div>


           <div className="space-y-5">
  {(selectedEditType === 'phone' || selectedEditType === 'both') && (
    <div className="flex items-center gap-4">
      {/* Current Phone */}
      <div className="w-1/2">
        <label className="block text-sm font-medium text-gray-500 mb-1.5">
          Current Phone
        </label>
        <div className="p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-base">
          {selectedCustomer.mobile || 'Not set'}
        </div>
      </div>

      {/* New Phone */}
      <div className="w-1/2">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <PhoneIcon className="w-4 h-4 inline mr-1" style={{ color: primaryColor }} />
          New Phone Number
        </label>
        <input
          type="text"
          value={formData.mobile}
          onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
          placeholder="Enter new phone number"
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
          style={{ borderColor: primaryColor }}
          required={selectedEditType !== 'id'}
        />
      </div>
    </div>
  )}

  {(selectedEditType === 'id' || selectedEditType === 'both') && (
    <div className="flex items-center gap-4">
      {/* Current ID */}
      <div className="w-1/2">
        <label className="block text-sm font-medium text-gray-500 mb-1.5">
          Current ID
        </label>
        <div className="p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-base">
          {selectedCustomer.id_number || 'Not set'}
        </div>
      </div>

      {/* New ID */}
      <div className="w-1/2">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <CreditCardIcon className="w-4 h-4 inline mr-1" style={{ color: primaryColor }} />
          New ID Number
        </label>
        <input
          type="text"
          value={formData.idNumber}
          onChange={(e) => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
          placeholder="Enter new ID number"
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
          style={{ borderColor: primaryColor }}
          required={selectedEditType !== 'phone'}
        />
      </div>
    </div>
  )}
</div>


            {/* Reason Field */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Reason for Edit *
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Please explain why you need to edit this information..."
                rows="3"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
                style={{ borderColor: primaryColor }}
                required
              />
            </div>

            {/* Document Upload */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <DocumentIcon className="w-3.5 h-3.5 inline mr-1" style={{ color: primaryColor }} />
                Supporting Document *
              </label>
              <div className="border border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors" style={{ borderColor: primaryColor }}>
                <input
                  type="file"
                  onChange={handleDocumentUpload}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  id="supportDocument"
                  required
                />
                <label htmlFor="supportDocument" className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <PhotoIcon className="w-10 h-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      {supportDocument ? supportDocument.name : 'Click to upload supporting document'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports JPG, PNG, PDF (Max 5MB)
                    </p>
                    <button
                      type="button"
                      className="mt-3 px-3 py-1.5 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Choose File
                    </button>
                  </div>
                </label>
                
                {documentPreview && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-1.5">Preview:</p>
                    <img 
                      src={documentPreview} 
                      alt="Document preview" 
                      className="max-h-40 mx-auto rounded border"
                    />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1.5">
                Upload supporting document (ID copy, affidavit, etc.)
              </p>
            </div>

          <div className="mt-5 flex justify-end">
  <button
    type="submit"
    disabled={loading}
    className="inline-flex py-2.5 px-4 rounded-lg text-white font-medium text-base transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed items-center justify-center gap-2"
    style={{ backgroundColor: loading ? '#9ca3af' : primaryColor }}
  >
    {loading ? (
      <span className="flex items-center justify-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        Submitting Request...
      </span>
    ) : (
      'Submit Edit Request'
    )}
  </button>
</div>

          </form>
        </div>
      )}

      {/* Edit Requests List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>Edit Requests History</h2>
          <button
            onClick={fetchEditRequests}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 mx-auto mb-2" style={{ borderColor: primaryColor }}></div>
            <p className="text-gray-500 text-base">Loading requests...</p>
          </div>
        )}

        {!loading && editRequests.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="w-12 h-12 mx-auto mb-3 text-gray-300">
              <DocumentIcon className="w-full h-full" />
            </div>
            <p className="text-base font-medium">No edit requests found</p>
            <p className="text-sm mt-1">Submit a request above to get started</p>
          </div>
        )}

        {!loading && editRequests.length > 0 && (
          <div className="space-y-4">
            {editRequests.map(request => {
              const customerFullName = request.customer 
                ? `${request.customer.Firstname || ''} ${request.customer.Middlename || ''} ${request.customer.Surname || ''}`.trim()
                : `Customer ID: ${request.customer_id}`;

              return (
                <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-base mb-2">{customerFullName}</h3>
                      
                      {request.reason && (
                        <div className="mt-2 p-2.5 bg-gray-50 rounded text-sm">
                          <p className="font-medium text-gray-700">Reason:</p>
                          <p className="text-gray-600 mt-0.5">{request.reason}</p>
                        </div>
                      )}
                      
                      <div className="mt-2.5 space-y-1.5">
                        {request.current_mobile !== request.new_mobile && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-red-50 p-2 rounded text-sm">
                              <span className="text-xs text-gray-500">Old Phone:</span>
                              <p className="font-medium">{request.current_mobile}</p>
                            </div>
                            <div className="text-gray-400">→</div>
                            <div className="flex-1 bg-green-50 p-2 rounded text-sm">
                              <span className="text-xs text-gray-500">New Phone:</span>
                              <p className="font-medium">{request.new_mobile}</p>
                            </div>
                          </div>
                        )}
                        
                        {request.current_id_number !== request.new_id_number && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-red-50 p-2 rounded text-sm">
                              <span className="text-xs text-gray-500">Old ID:</span>
                              <p className="font-medium">{request.current_id_number}</p>
                            </div>
                            <div className="text-gray-400">→</div>
                            <div className="flex-1 bg-green-50 p-2 rounded text-sm">
                              <span className="text-xs text-gray-500">New ID:</span>
                              <p className="font-medium">{request.new_id_number}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {request.document_url && (
                        <div className="mt-2.5">
                          <a
                            href={request.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm"
                            style={{ color: primaryColor }}
                          >
                            <DocumentIcon className="w-3.5 h-3.5" />
                            View Supporting Document
                          </a>
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-3">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(request.status)}
                        <span className="text-sm font-medium">
                          {getStatusText(request.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-right">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    {canConfirm(request) && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'confirmed')}
                        disabled={loading}
                        className="px-3 py-1.5 text-white text-sm rounded-lg transition-colors disabled:bg-gray-400 font-medium"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Confirm
                      </button>
                    )}
                    
                    {canApprove(request) && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'approved')}
                        disabled={loading}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 font-medium"
                      >
                        Approve
                      </button>
                    )}
                    
                    {canReject(request) && (
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'rejected')}
                        disabled={loading}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 font-medium"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerEdits;