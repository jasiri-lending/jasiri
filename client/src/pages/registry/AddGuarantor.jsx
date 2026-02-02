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
  Loader2
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../hooks/userAuth';
import imageCompression from 'browser-image-compression';

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

const AddGuarantor = ({ onClose, onSuccess, defaultBranch, defaultRegion }) => {
  const { profile } = useAuth();

  // Form state - matching database column names
  const [formData, setFormData] = useState({
    customer_id: null,
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
    alternative_number: '', // Changed from alternative_mobile to alternative_number
    occupation: '',
    relationship: '',
    city_town: '',
    status: 'inactive',
    branch_id: defaultBranch || null,
    region_id: defaultRegion || null,
    is_guarantor: true // Added to match schema
  });

  // File upload state
  const [guarantorPassportFile, setGuarantorPassportFile] = useState(null);
  const [guarantorIdFrontFile, setGuarantorIdFrontFile] = useState(null);
  const [guarantorIdBackFile, setGuarantorIdBackFile] = useState(null);
  const [guarantorSecurityImages, setGuarantorSecurityImages] = useState([]);
  const [previews, setPreviews] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState(new Set());

  // Security items state - matching AddCustomer structure
  const [securityItems, setSecurityItems] = useState([{
    item: '',
    description: '',
    identification: '',
    value: '',
    otherType: ''
  }]);

  // Other state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState(null);
  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);

  // Fetch regions and branches
  useEffect(() => {
    fetchRegionsAndBranches();
  }, []);

  const fetchRegionsAndBranches = async () => {
    try {
      // Fetch regions
      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select('id, name')
        .eq('tenant_id', profile?.tenant_id)
        .order('name');

      if (regionsError) throw regionsError;
      setRegions(regionsData || []);

      // Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, region_id')
        .eq('tenant_id', profile?.tenant_id)
        .order('name');

      if (branchesError) throw branchesError;
      setBranches(branchesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
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

  // Image compression function
  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
      initialQuality: 0.7,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error("Image compression error:", error);
      return file;
    }
  };

  // Batch upload function
  const uploadFilesBatch = async (files, pathPrefix) => {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map(async (file) => {
      try {
        const compressedFile = await compressImage(file);
        const path = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${compressedFile.name}`;

        const { data, error } = await supabase.storage
          .from('customers')
          .upload(path, compressedFile, {
            upsert: true,
            cacheControl: '3600'
          });

        if (error) {
          console.error(`Upload error for ${compressedFile.name}:`, error);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('customers')
          .getPublicUrl(data.path);

        return urlData.publicUrl;
      } catch (error) {
        console.error(`Failed to upload file:`, error);
        return null;
      }
    });

    const urls = await Promise.all(uploadPromises);
    return urls.filter(Boolean);
  };

  // Single file upload function
  const uploadFile = async (file, path) => {
    if (!file) return null;

    try {
      const compressedFile = await compressImage(file);
      const { data, error } = await supabase.storage
        .from('customers')
        .upload(path, compressedFile, {
          upsert: true,
          cacheControl: '3600'
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('customers')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  // File upload handler
  const handleFileUpload = async (e, setter, key) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input to allow re-uploading same file
    e.target.value = null;

    if (uploadedFiles.has(file.name)) {
      setNotification({
        type: 'error',
        message: 'This file has already been uploaded elsewhere in the form.'
      });
      return;
    }

    try {
      const compressedFile = await compressImage(file);

      // Save the file in the corresponding field
      setter(compressedFile);

      // Store preview with fileName and URL
      setPreviews((prev) => ({
        ...prev,
        [key]: {
          url: URL.createObjectURL(compressedFile),
          fileName: file.name
        },
      }));

      // Add to global tracker
      setUploadedFiles((prev) => new Set(prev).add(file.name));
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Unexpected error during file selection.'
      });
    }
  };

  // File removal handler
  const handleRemoveFile = (key, setter) => {
    const file = previews[key]?.fileName;

    // Remove from global tracker
    if (file && uploadedFiles.has(file)) {
      setUploadedFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(file);
        return newSet;
      });
    }

    // Clear the file state
    setter(null);

    // Revoke the object URL and clear preview
    setPreviews((prev) => {
      const url = prev?.[key]?.url;
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch (err) {
          console.warn("Failed to revoke object URL", err);
        }
      }
      return { ...prev, [key]: null };
    });
  };

  // Multiple files handler for security items
  const handleMultipleFiles = (e, index) => {
    const files = Array.from(e.target.files);
    const validFiles = [];

    files.forEach(file => {
      if (uploadedFiles.has(file.name)) {
        setNotification({
          type: 'error',
          message: `${file.name} has already been uploaded elsewhere.`
        });
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length === 0) return;

    // Update global tracker
    setUploadedFiles(prev => {
      const newSet = new Set(prev);
      validFiles.forEach(f => newSet.add(f.name));
      return newSet;
    });

    // Update state for images
    setGuarantorSecurityImages(prev => {
      const updated = [...(prev[index] || []), ...validFiles];
      const allUpdated = [...prev];
      allUpdated[index] = updated;
      return allUpdated;
    });

    // Reset input to allow re-uploading same file later
    e.target.value = null;
  };

  // Remove handler for multiple images
  const handleRemoveMultipleFile = (sectionIndex, fileIndex) => {
    setGuarantorSecurityImages(prev => {
      const updatedSection = [...prev];
      const fileToRemove = updatedSection[sectionIndex]?.[fileIndex];

      // Remove from global tracker
      if (fileToRemove) {
        setUploadedFiles(prevFiles => {
          const newSet = new Set(prevFiles);
          newSet.delete(fileToRemove.name);
          return newSet;
        });
      }

      // Remove file from array
      if (updatedSection[sectionIndex]) {
        updatedSection[sectionIndex] = updatedSection[sectionIndex].filter((_, i) => i !== fileIndex);
      }

      return updatedSection;
    });
  };

  // Security item handlers
  const addSecurityItem = () => {
    setSecurityItems([
      ...securityItems,
      { item: '', description: '', identification: '', value: '', otherType: '' }
    ]);
    setGuarantorSecurityImages([...guarantorSecurityImages, []]);
  };

  const removeSecurityItem = (index) => {
    if (securityItems.length > 1) {
      setSecurityItems(prev => prev.filter((_, i) => i !== index));
      setGuarantorSecurityImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSecurityChange = (e, index) => {
    const { name, value } = e.target;

    setSecurityItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [name]: value } : item
      )
    );
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    const requiredFields = ['Firstname', 'Surname', 'mobile', 'id_number'];
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Function to insert security items with images
  const insertGuarantorSecurityItems = async (items, images, guarantorId) => {
    if (!items?.length) return;

    try {
      // First insert all security items
      const itemsToInsert = items.map((s) => ({
        guarantor_id: guarantorId,
        item: s.item === 'Other' ? s.otherType : s.item,
        description: s.description || null,
        identification: s.identification || null,
        estimated_market_value: s.value ? parseFloat(s.value) : null,
        created_by: profile?.id,
        branch_id: formData.branch_id,
        region_id: formData.region_id,
        tenant_id: profile?.tenant_id,
        created_at: new Date().toISOString(),
      }));

      const { data: insertedItems, error: secError } = await supabase
        .from('guarantor_security')
        .insert(itemsToInsert)
        .select('id');

      if (secError) {
        console.error('Error inserting guarantor security items:', secError);
        return;
      }

      if (!insertedItems?.length) return;

      // Upload all images for all items in parallel
      const allImageUploads = insertedItems.flatMap((item, index) => {
        const itemImages = images[index] || [];
        return itemImages.map(async (file) => {
          const filePath = `guarantor_security/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
          const url = await uploadFile(file, filePath);

          return url ? {
            guarantor_security_id: item.id,
            image_url: url,
            created_by: profile?.id,
            branch_id: formData.branch_id,
            region_id: formData.region_id,
            tenant_id: profile?.tenant_id,
            created_at: new Date().toISOString(),
          } : null;
        });
      });

      const imageRecords = (await Promise.all(allImageUploads)).filter(Boolean);

      // Insert all image records at once
      if (imageRecords.length) {
        const { error: imgError } = await supabase
          .from('guarantor_security_images')
          .insert(imageRecords);

        if (imgError) {
          console.error('Error inserting guarantor security images:', imgError);
        }
      }

    } catch (error) {
      console.error('Error in insertGuarantorSecurityItems:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setNotification({
        type: 'error',
        message: 'Please fix the errors in the form'
      });
      return;
    }

    try {
      setSaving(true);
      const timestamp = Date.now();

      // Upload all files in parallel
      const [
        passport_url,
        id_front_url,
        id_back_url
      ] = await Promise.all([
        // Guarantor documents
        guarantorPassportFile ? uploadFile(guarantorPassportFile, `guarantor/${timestamp}_passport_${guarantorPassportFile.name}`) : null,
        guarantorIdFrontFile ? uploadFile(guarantorIdFrontFile, `guarantor/${timestamp}_id_front_${guarantorIdFrontFile.name}`) : null,
        guarantorIdBackFile ? uploadFile(guarantorIdBackFile, `guarantor/${timestamp}_id_back_${guarantorIdBackFile.name}`) : null,
      ]);

      // Prepare guarantor data matching database schema exactly
      const guarantorData = {
        ...formData,
        customer_id: null,
        id_number: formData.id_number ? parseInt(formData.id_number) : null, // Ensure id_number is integer
        code: formData.code ? parseInt(formData.code) : null, // Ensure code is integer
        passport_url,
        id_front_url,
        id_back_url,
        is_guarantor: true,
        status: 'active',
        created_by: profile?.id,
        tenant_id: profile?.tenant_id,
        created_at: new Date().toISOString(),
        // Remove undefined/null values to avoid schema conflicts
      };

      // Clean up data - remove undefined values
      const cleanGuarantorData = Object.fromEntries(
        Object.entries(guarantorData).filter(([_, v]) => v !== undefined && v !== '')
      );

      console.log('Inserting guarantor data:', cleanGuarantorData);

      // Insert guarantor
      const { data: guarantor, error: guarantorError } = await supabase
        .from('guarantors')
        .insert([cleanGuarantorData])
        .select()
        .single();

      if (guarantorError) {
        console.error('Guarantor insertion error:', guarantorError);
        throw new Error(`Failed to insert guarantor: ${guarantorError.message}`);
      }

      // Insert security items if any exist
      if (securityItems.length > 0 && securityItems[0].item) {
        await insertGuarantorSecurityItems(securityItems, guarantorSecurityImages, guarantor.id);
      }

      setNotification({
        type: 'success',
        message: 'Guarantor added successfully!'
      });

      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error('Error adding guarantor:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to add guarantor. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const filteredBranches = formData.region_id
    ? branches.filter(branch => branch.region_id === formData.region_id)
    : branches;

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
            <h2 className="text-2xl font-bold" style={{ color: "#586ab1" }}>
              Add New Guarantor
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Add a guarantor without linking to a customer
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${notification.type === 'success'
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
        {/* Step 1: Guarantor Personal Details */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#f0f2f8" }}>
              <User className="w-5 h-5" style={{ color: "#586ab1" }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
                Guarantor Personal Details
              </h3>
              <p className="text-gray-600">Enter the guarantor's personal information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Region */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Region
              </label>
              <select
                name="region_id"
                value={formData.region_id || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Region</option>
                {regions.map(region => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <select
                name="branch_id"
                value={formData.branch_id || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Branch</option>
                {filteredBranches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            {/* Prefix */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prefix
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
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.Firstname ? 'border-red-300' : 'border-gray-300'
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
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.Surname ? 'border-red-300' : 'border-gray-300'
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
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.id_number ? 'border-red-300' : 'border-gray-300'
                  }`}
                placeholder="Enter ID number"
                pattern="[0-9]*"
                inputMode="numeric"
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
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.mobile ? 'border-red-300' : 'border-gray-300'
                  }`}
                placeholder="07XXXXXXXX"
              />
              {errors.mobile && (
                <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>
              )}
            </div>

            {/* Alternative Number - CHANGED FIELD NAME */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alternative Number
              </label>
              <input
                type="text"
                name="alternative_number"
                value={formData.alternative_number}
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
                Gender
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
                Relationship to Customer (Optional)
              </label>
              <input
                type="text"
                name="relationship"
                value={formData.relationship}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Spouse, Friend, Relative"
              />
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
            <div>
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
                type="number"
                name="code"
                value={formData.code}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter postal code"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Guarantor Documents (Optional) */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#f0f2f8" }}>
              <Upload className="w-5 h-5" style={{ color: "#586ab1" }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
                Guarantor Documents (Optional)
              </h3>
              <p className="text-gray-600">Upload documents for the guarantor</p>
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

        {/* Step 3: Guarantor Security Items (Optional) */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#f0f2f8" }}>
              <Shield className="w-5 h-5" style={{ color: "#586ab1" }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
                Guarantor Security Items (Optional)
              </h3>
              <p className="text-gray-600">Add security items if available</p>
            </div>
          </div>

          <div className="space-y-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Security Type Dropdown */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      name="item"
                      value={item.item}
                      onChange={(e) => handleSecurityChange(e, index)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- Select Security Type --</option>
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

                  {/* Other Type Specification */}
                  {item.item === "Other" && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Specify Other Type
                      </label>
                      <input
                        type="text"
                        name="otherType"
                        value={item.otherType || ""}
                        onChange={(e) => handleSecurityChange(e, index)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Specify security type"
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      name="description"
                      value={item.description}
                      onChange={(e) => handleSecurityChange(e, index)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe the security item"
                    />
                  </div>

                  {/* Identification */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Identification
                    </label>
                    <input
                      type="text"
                      name="identification"
                      value={item.identification}
                      onChange={(e) => handleSecurityChange(e, index)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Serial number, registration"
                    />
                  </div>

                  {/* Estimated Value */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Value (KES)
                    </label>
                    <input
                      type="number"
                      name="value"
                      value={item.value}
                      onChange={(e) => handleSecurityChange(e, index)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter estimated value"
                    />
                  </div>
                </div>

                {/* Security Images */}
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Item Images
                  </label>
                  <div className="flex gap-3 mb-3">
                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition">
                      <Upload className="w-5 h-5" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleMultipleFiles(e, index)}
                        className="hidden"
                      />
                    </label>

                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition">
                      <Camera className="w-5 h-5" />
                      Camera
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(e) => handleMultipleFiles(e, index)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Display Image Grid */}
                  {guarantorSecurityImages[index] && guarantorSecurityImages[index].length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                      {guarantorSecurityImages[index].map((img, imgIdx) => (
                        <div key={imgIdx} className="relative group">
                          <img
                            src={URL.createObjectURL(img)}
                            alt={`Security ${index + 1} - Image ${imgIdx + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveMultipleFile(index, imgIdx)}
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          {/* File name display */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-1">
                            <p className="text-xs truncate" title={img.name}>
                              {img.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addSecurityItem}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              style={{ color: "#586ab1" }}
            >
              <Plus className="w-5 h-5" />
              Add Security Item
            </button>
          </div>
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
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: "#586ab1" }}
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