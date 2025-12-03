import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Upload,
  Camera,
  X,
  Plus,
  Trash2,
  User,
  Shield,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

const KENYA_COUNTIES = [
  "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita Taveta",
  "Garissa", "Wajir", "Mandera", "Marsabit", "Isiolo", "Meru",
  "Tharaka-Nithi", "Embu", "Kitui", "Machakos", "Makueni", "Nyandarua",
  "Nyeri", "Kirinyaga", "Murang'a", "Kiambu", "Turkana", "West Pokot",
  "Samburu", "Trans Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Nandi",
  "Baringo", "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho",
  "Bomet", "Kakamega", "Vihiga", "Bungoma", "Busia", "Siaya",
  "Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Nairobi"
];

const AddGuarantor = ({ onClose, onSuccess }) => {
  // Form state
  const [formData, setFormData] = useState({
    customer_id: '',
    prefix: 'Mr',
    Firstname: '',
    Surname: '',
    Middlename: '',
    marital_status: '',
    residence_status: '',
    mobile: '',
    id_number: '',
    postal_address: '',
    code: '',
    county: '',
    date_of_birth: '',
    gender: '',
    alternative_mobile: '',
    occupation: '',
    relationship: '',
    city_town: '',
    status: 'inactive'
  });

  // File upload state
  const [guarantorPassportFile, setGuarantorPassportFile] = useState(null);
  const [guarantorIdFrontFile, setGuarantorIdFrontFile] = useState(null);
  const [guarantorIdBackFile, setGuarantorIdBackFile] = useState(null);
  const [guarantorSecurityImages, setGuarantorSecurityImages] = useState([]);
  const [previews, setPreviews] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState(new Set());

  // Security items state
  const [securityItems, setSecurityItems] = useState([
    { type: '', description: '', value: '' }
  ]);

  // Other state
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState(null);

  // Fetch customers
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filter customers based on search
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(customer => {
        const fullName = `${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || 
               customer.mobile?.includes(search) ||
               customer.id_number?.toString().includes(search);
      });
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          branch:branches(id, name),
          region:regions(id, name)
        `)
        .eq('status', 'active')
        .order('Firstname');

      if (error) throw error;
      setCustomers(data || []);
      setFilteredCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      showNotification('error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customer_id: customer.id
    }));
    setSearchTerm('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleFileUpload = (e, setFile, fileKey) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPreviews(prev => ({
        ...prev,
        [fileKey]: {
          url: previewUrl,
          fileName: file.name
        }
      }));
      setUploadedFiles(prev => new Set([...prev, fileKey]));
    }
  };

  const handleRemoveFile = (fileKey, setFile) => {
    setFile(null);
    if (previews[fileKey]?.url) {
      URL.revokeObjectURL(previews[fileKey].url);
    }
    setPreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[fileKey];
      return newPreviews;
    });
    setUploadedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileKey);
      return newSet;
    });
  };

  const addSecurityItem = () => {
    setSecurityItems(prev => [...prev, { type: '', description: '', value: '' }]);
  };

  const removeSecurityItem = (index) => {
    if (securityItems.length > 1) {
      setSecurityItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateSecurityItem = (index, field, value) => {
    setSecurityItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const validateForm = () => {
    const newErrors = {};

    // Check if customer is selected
    if (!selectedCustomer) {
      newErrors.customer = 'Please select a customer to guarantee';
    }

    // Required fields
    const requiredFields = ['Firstname', 'Surname', 'mobile', 'id_number', 'relationship'];
    requiredFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    // Validate ID number
    if (formData.id_number && formData.id_number.length < 5) {
      newErrors.id_number = 'ID number must be at least 5 digits';
    }

    // Validate phone number
    const phoneRegex = /^[0-9]{10}$/;
    if (formData.mobile && !phoneRegex.test(formData.mobile)) {
      newErrors.mobile = 'Please enter a valid 10-digit phone number';
    }

    // Validate security items
    if (securityItems.some(item => !item.type || !item.description || !item.value)) {
      newErrors.securityItems = 'All security items must have type, description, and value';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFile = async (file, folder) => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('guarantor-documents')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('guarantor-documents')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showNotification('error', 'Please fix the errors in the form');
      return;
    }

    try {
      setSaving(true);

      // Upload files
      const passport_url = await uploadFile(guarantorPassportFile, 'passports');
      const id_front_url = await uploadFile(guarantorIdFrontFile, 'id-front');
      const id_back_url = await uploadFile(guarantorIdBackFile, 'id-back');

      // Upload security item images
      const security_urls = [];
      for (let i = 0; i < securityItems.length; i++) {
        const itemImages = guarantorSecurityImages[i] || [];
        const uploadedImageUrls = [];
        
        for (const image of itemImages) {
          const url = await uploadFile(image, 'security-items');
          uploadedImageUrls.push(url);
        }
        
        security_urls.push(uploadedImageUrls);
      }

      // Prepare guarantor data
      const guarantorData = {
        ...formData,
        customer_id: selectedCustomer.id,
        branch_id: selectedCustomer.branch_id,
        region_id: selectedCustomer.region_id,
        passport_url,
        id_front_url,
        id_back_url,
        created_by: supabase.auth.user()?.id,
        created_at: new Date().toISOString()
      };

      // Insert guarantor
      const { data: guarantor, error: guarantorError } = await supabase
        .from('guarantors')
        .insert([guarantorData])
        .select()
        .single();

      if (guarantorError) throw guarantorError;

      // Insert security items
      const securityItemsData = securityItems.map((item, index) => ({
        guarantor_id: guarantor.id,
        type: item.type,
        description: item.description,
        value: item.value,
        image_urls: security_urls[index] || [],
        created_at: new Date().toISOString()
      }));

      const { error: securityError } = await supabase
        .from('guarantor_security_items')
        .insert(securityItemsData);

      if (securityError) throw securityError;

      showNotification('success', 'Guarantor added successfully!');
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error('Error adding guarantor:', error);
      showNotification('error', 'Failed to add guarantor. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm  text-slate-600">Add New Guarantor</h2>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          notification.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {notification.message}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Select Customer */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm  text-slate-600">Select Customer to Guarantee</h3>
              <p className="text-gray-600">Choose the customer who needs a guarantor</p>
            </div>
          </div>

          {errors.customer && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{errors.customer}</p>
            </div>
          )}

          {selectedCustomer ? (
            <div className="p-4 bg-white border border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className=" text-slate-600">
                    {selectedCustomer.Firstname} {selectedCustomer.Middlename} {selectedCustomer.Surname}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <span> {selectedCustomer.mobile}</span>
                    <span> {selectedCustomer.id_number}</span>
                    <span> {selectedCustomer.branch?.name}</span>
                    <span> {selectedCustomer.region?.name}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setFormData(prev => ({ ...prev, customer_id: '' }));
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers by name, phone, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No customers found
                    </div>
                  ) : (
                    filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className="p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors last:border-b-0"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className=" text-slate-600">
                              {customer.Firstname} {customer.Middlename} {customer.Surname}
                            </p>
                            <div className="flex gap-4 mt-1 text-sm text-gray-600">
                              <span> {customer.mobile}</span>
                              <span> {customer.id_number}</span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 text-right">
                            <p>{customer.branch?.name}</p>
                            <p>{customer.region?.name}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Guarantor Personal Details */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm  text-slate-600">Guarantor Personal Details</h3>
              <p className="text-gray-600">Enter the guarantor's personal information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Prefix */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prefix *
              </label>
              <select
                name="prefix"
                value={formData.prefix}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Ms">Ms</option>
                <option value="Dr">Dr</option>
              </select>
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                name="Firstname"
                value={formData.Firstname}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.Firstname ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter first name"
              />
              {errors.Firstname && (
                <p className="mt-1 text-sm text-red-600">{errors.Firstname}</p>
              )}
            </div>

            {/* Middle Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Middle Name
              </label>
              <input
                type="text"
                name="Middlename"
                value={formData.Middlename}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter middle name"
              />
            </div>

            {/* Surname */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Surname *
              </label>
              <input
                type="text"
                name="Surname"
                value={formData.Surname}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.Surname ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter surname"
              />
              {errors.Surname && (
                <p className="mt-1 text-sm text-red-600">{errors.Surname}</p>
              )}
            </div>

            {/* ID Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Number *
              </label>
              <input
                type="text"
                name="id_number"
                value={formData.id_number}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.id_number ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter ID number"
              />
              {errors.id_number && (
                <p className="mt-1 text-sm text-red-600">{errors.id_number}</p>
              )}
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="text"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.mobile ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="07XXXXXXXX"
              />
              {errors.mobile && (
                <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>
              )}
            </div>

            {/* Alternative Mobile */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alternative Number
              </label>
              <input
                type="text"
                name="alternative_mobile"
                value={formData.alternative_mobile}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Alternative phone number"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender *
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Marital Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marital Status
              </label>
              <select
                name="marital_status"
                value={formData.marital_status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Separated/Divorced">Separated/Divorced</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Residence Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Residence Status
              </label>
              <select
                name="residence_status"
                value={formData.residence_status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select status</option>
                <option value="Own">Own</option>
                <option value="Rent">Rent</option>
                <option value="Family">Family</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Occupation
              </label>
              <input
                type="text"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter occupation"
              />
            </div>

            {/* Relationship */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relationship *
              </label>
              <input
                type="text"
                name="relationship"
                value={formData.relationship}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.relationship ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., Spouse, Friend, Relative"
              />
              {errors.relationship && (
                <p className="mt-1 text-sm text-red-600">{errors.relationship}</p>
              )}
            </div>

            {/* County */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                County
              </label>
              <select
                name="county"
                value={formData.county}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select county</option>
                {KENYA_COUNTIES.map(county => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>
            </div>

            {/* City/Town */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City/Town
              </label>
              <input
                type="text"
                name="city_town"
                value={formData.city_town}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter city/town"
              />
            </div>

            {/* Postal Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postal Address
              </label>
              <input
                type="text"
                name="postal_address"
                value={formData.postal_address}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter postal address"
              />
            </div>

            {/* Postal Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter postal code"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Guarantor Documents */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Upload className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm  text-slate-600">Guarantor Documents</h3>
              <p className="text-gray-600">Upload required documents for the guarantor</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Passport Photo */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passport Photo
              </label>
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <Upload className="w-6 h-6 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Upload Passport</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setGuarantorPassportFile, 'guarantorPassport')}
                    className="hidden"
                  />
                </label>
                <label className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                  <Camera className="w-6 h-6 text-blue-400 mb-2" />
                  <span className="text-sm text-blue-600">Take Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileUpload(e, setGuarantorPassportFile, 'guarantorPassport')}
                    className="hidden"
                  />
                </label>
                {previews.guarantorPassport && (
                  <div className="relative mt-4">
                    <img
                      src={previews.guarantorPassport.url}
                      alt="Passport preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile('guarantorPassport', setGuarantorPassportFile)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ID Front */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Front Side
              </label>
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <Upload className="w-6 h-6 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Upload ID Front</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setGuarantorIdFrontFile, 'guarantorIdFront')}
                    className="hidden"
                  />
                </label>
                <label className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                  <Camera className="w-6 h-6 text-blue-400 mb-2" />
                  <span className="text-sm text-blue-600">Take Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileUpload(e, setGuarantorIdFrontFile, 'guarantorIdFront')}
                    className="hidden"
                  />
                </label>
                {previews.guarantorIdFront && (
                  <div className="relative mt-4">
                    <img
                      src={previews.guarantorIdFront.url}
                      alt="ID Front preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile('guarantorIdFront', setGuarantorIdFrontFile)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ID Back */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Back Side
              </label>
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <Upload className="w-6 h-6 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Upload ID Back</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setGuarantorIdBackFile, 'guarantorIdBack')}
                    className="hidden"
                  />
                </label>
                <label className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                  <Camera className="w-6 h-6 text-blue-400 mb-2" />
                  <span className="text-sm text-blue-600">Take Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileUpload(e, setGuarantorIdBackFile, 'guarantorIdBack')}
                    className="hidden"
                  />
                </label>
                {previews.guarantorIdBack && (
                  <div className="relative mt-4">
                    <img
                      src={previews.guarantorIdBack.url}
                      alt="ID Back preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile('guarantorIdBack', setGuarantorIdBackFile)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Guarantor Security Items */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm  text-slate-600">Guarantor Security Items</h3>
              <p className="text-gray-600">Add security items provided by the guarantor</p>
            </div>
          </div>

          {errors.securityItems && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{errors.securityItems}</p>
            </div>
          )}

          {securityItems.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium text-gray-900">Security Item {index + 1}</h4>
                {securityItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSecurityItem(index)}
                    className="text-red-600 hover:text-red-800 p-1"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Security Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    value={item.type}
                    onChange={(e) => updateSecurityItem(index, 'type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select type</option>
                    <option value="Household Items">Household Items</option>
                    <option value="Business Equipment">Business Equipment</option>
                    <option value="Livestock">Livestock</option>
                    <option value="Motor Vehicle">Motor Vehicle</option>
                    <option value="Motorbike">Motorbike</option>
                    <option value="Land / Property">Land / Property</option>
                    <option value="Title deed">Title deed</option>
                    <option value="Logbook">Logbook</option>
                    <option value="Salary Check-off">Salary Check-off</option>
                    <option value="Stock / Inventory">Stock / Inventory</option>
                    <option value="Fixed deposit / Savings security">Fixed deposit / Savings security</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Other">Other (specify)</option>
                  </select>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateSecurityItem(index, 'description', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe the security item"
                  />
                </div>

                {/* Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value (KES) *
                  </label>
                  <input
                    type="number"
                    value={item.value}
                    onChange={(e) => updateSecurityItem(index, 'value', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter value"
                  />
                </div>

                {/* Images */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Images
                  </label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">Upload Images</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setGuarantorSecurityImages(prev => {
                            const newImages = [...prev];
                            newImages[index] = [...(newImages[index] || []), ...files];
                            return newImages;
                          });
                        }}
                        className="hidden"
                      />
                    </label>
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-200 transition-colors">
                      <Camera className="w-4 h-4" />
                      <span className="text-sm">Take Photos</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setGuarantorSecurityImages(prev => {
                            const newImages = [...prev];
                            newImages[index] = [...(newImages[index] || []), ...files];
                            return newImages;
                          });
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  {/* Display uploaded images */}
                  {guarantorSecurityImages[index]?.length > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {guarantorSecurityImages[index].map((image, imgIndex) => (
                        <div key={imgIndex} className="relative">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Security ${index + 1} - ${imgIndex + 1}`}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setGuarantorSecurityImages(prev => {
                                const newImages = [...prev];
                                newImages[index] = newImages[index].filter((_, i) => i !== imgIndex);
                                return newImages;
                              });
                            }}
                            className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSecurityItem}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Security Item
          </button>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !selectedCustomer}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Guarantor
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddGuarantor;