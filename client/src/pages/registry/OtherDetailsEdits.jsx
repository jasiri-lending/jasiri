import React, { useState, useEffect } from 'react';
import {
  UserCircleIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  CreditCardIcon,
  ArrowUpTrayIcon,
  CameraIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  PhotoIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";

import { supabase } from "../../supabaseClient.js";

function CustomerDetailsEdit() {
  const [activeSection, setActiveSection] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [editRequests, setEditRequests] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState(new Set());
  const [previews, setPreviews] = useState({});

  const primaryColor = "#586ab1";
  const primaryLight = "rgba(88, 106, 177, 0.1)";
  const primaryDark = "#475589";

  const [formData, setFormData] = useState({
    personal: {
      prefix: '',
      Firstname: '',
      Middlename: '',
      Surname: '',
      maritalStatus: '',
      residenceStatus: '',
      mobile: '',
      alternativeMobile: '',
      occupation: '',
      dateOfBirth: '',
      gender: '',
      idNumber: '',
      postalAddress: '',
      code: '',
      town: '',
      county: '',
    },
    business: {
      businessName: '',
      businessType: '',
      daily_Sales: '',
      yearEstablished: '',
      businessLocation: '',
      businessCoordinates: null,
      road: '',
      landmark: '',
      hasLocalAuthorityLicense: '',
      prequalifiedAmount: '',
    },
    guarantor: {
      prefix: '',
      Firstname: '',
      Surname: '',
      Middlename: '',
      idNumber: '',
      maritalStatus: '',
      gender: '',
      mobile: '',
      alternativeMobile: '',
      residenceStatus: '',
      postalAddress: '',
      code: '',
      occupation: '',
      relationship: '',
      dateOfBirth: '',
      county: '',
      cityTown: '',
    },
    nextOfKin: {
      Firstname: '',
      Surname: '',
      Middlename: '',
      idNumber: '',
      relationship: '',
      mobile: '',
      alternativeNumber: '',
      employmentStatus: '',
      county: '',
      cityTown: '',
      companyName: '',
      salary: '',
      businessName: '',
      businessIncome: '',
      relationshipOther: '',
    },
    documents: {
      passport: null,
      idFront: null,
      idBack: null,
      houseImage: null,
      guarantorPassport: null,
      guarantorIdFront: null,
      guarantorIdBack: null,
      officerClient1: null,
      officerClient2: null,
      bothOfficers: null,
    }
  });

  const KENYA_COUNTIES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo Marakwet", "Embu",
    "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
    "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui",
    "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera",
    "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
    "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
    "Samburu", "Siaya", "Taita Taveta", "Tana River", "Tharaka Nithi",
    "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
  ];

  const EMPLOYMENT_STATUS = ['Employed', 'Self Employed', 'Unemployed'];
  const GENDER_OPTIONS = ['Male', 'Female'];
  const PREFIX_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Dr'];
  const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Separated/Divorced', 'Other'];
  const RESIDENCE_STATUS_OPTIONS = ['Own', 'Rent', 'Family', 'Other'];
  const RELATIONSHIP_OPTIONS = ['Sister', 'Brother', 'Guardian', 'Father', 'Mother', 'Spouse', 'Other'];
  const BUSINESS_TYPES = [
    'Retail', 'Wholesale', 'Manufacturing', 'Service', 'Agriculture',
    'Construction', 'Transport', 'Hospitality', 'Education', 'Healthcare',
    'Technology', 'Finance', 'Other'
  ];

  const sections = [
    { id: 'personal', label: 'Personal Details', icon: UserCircleIcon },
    { id: 'business', label: 'Business Details', icon: BuildingOffice2Icon },
    { id: 'guarantor', label: 'Guarantor Details', icon: UserGroupIcon },
    { id: 'nextOfKin', label: 'Next of Kin Details', icon: UserGroupIcon },
  ];

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchEditRequests();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (userData) {
          setCurrentUser(userData);
          setUserRole(userData?.role || 'relationship_officer');
        } else {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          setCurrentUser(profileData);
          setUserRole(profileData?.role || 'relationship_officer');
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchEditRequests = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('customer_detail_edit_requests')
        .select(`
          *,
          customer:customers(Firstname, Middlename, Surname, mobile, id_number, created_by, branch_id, region_id)
        `)
        .order('created_at', { ascending: false });

      if (currentUser?.role === 'relationship_officer') {
        query = query.eq('created_by', currentUser.id);
      } else if (currentUser?.role === 'branch_manager' && currentUser.branch_id) {
        const { data: branchCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('branch_id', currentUser.branch_id);
        
        if (branchCustomers && branchCustomers.length > 0) {
          const customerIds = branchCustomers.map(c => c.id);
          query = query.in('customer_id', customerIds);
        }
      } else if (currentUser?.role === 'regional_manager' && currentUser.region_id) {
        const { data: regionCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('region_id', currentUser.region_id);
        
        if (regionCustomers && regionCustomers.length > 0) {
          const customerIds = regionCustomers.map(c => c.id);
          query = query.in('customer_id', customerIds);
        }
      }

      const { data: editRequests, error } = await query;
      
      if (error) {
        console.error('Error fetching edit requests:', error);
        setEditRequests([]);
      } else {
        let filteredRequests = editRequests || [];
        if (currentUser?.role === 'relationship_officer') {
          filteredRequests = filteredRequests.filter(request => 
            request.created_by === currentUser.id
          );
        }
        setEditRequests(filteredRequests);
      }
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

      if (currentUser?.role === "relationship_officer") {
        query = query.eq("created_by", currentUser.id);
      } else if (currentUser?.role === "branch_manager" && currentUser.branch_id) {
        query = query.eq("branch_id", currentUser.branch_id);
      } else if (currentUser?.role === "regional_manager" && currentUser.region_id) {
        query = query.eq("region_id", currentUser.region_id);
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

  const handleCustomerSelect = async (customer) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setSearchTerm(`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim());

    setFormData({
      ...formData,
      personal: {
        prefix: customer.prefix || '',
        Firstname: customer.Firstname || '',
        Middlename: customer.Middlename || '',
        Surname: customer.Surname || '',
        maritalStatus: customer.marital_status || '',
        residenceStatus: customer.residence_status || '',
        mobile: customer.mobile || '',
        alternativeMobile: customer.alternative_mobile || '',
        occupation: customer.occupation || '',
        dateOfBirth: customer.date_of_birth || '',
        gender: customer.gender || '',
        idNumber: customer.id_number || '',
        postalAddress: customer.postal_address || '',
        code: customer.code || '',
        town: customer.town || '',
        county: customer.county || '',
      },
      business: {
        businessName: customer.business_name || '',
        businessType: customer.business_type || '',
        daily_Sales: customer.daily_Sales || '',
        yearEstablished: customer.year_established || '',
        businessLocation: customer.business_location || '',
        businessCoordinates: customer.business_lat && customer.business_lng ? {
          lat: customer.business_lat,
          lng: customer.business_lng
        } : null,
        road: customer.road || '',
        landmark: customer.landmark || '',
        hasLocalAuthorityLicense: customer.has_local_authority_license ? 'Yes' : 'No',
        prequalifiedAmount: customer.prequalifiedAmount || '',
      }
    });

    await fetchRelatedData(customer.id);
  };

  const fetchRelatedData = async (customerId) => {
    try {
      const { data: guarantorData } = await supabase
        .from('guarantors')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (guarantorData) {
        setFormData(prev => ({
          ...prev,
          guarantor: {
            prefix: guarantorData.prefix || '',
            Firstname: guarantorData.Firstname || '',
            Surname: guarantorData.Surname || '',
            Middlename: guarantorData.Middlename || '',
            idNumber: guarantorData.id_number || '',
            maritalStatus: guarantorData.marital_status || '',
            gender: guarantorData.gender || '',
            mobile: guarantorData.mobile || '',
            alternativeMobile: guarantorData.alternative_number || '',
            residenceStatus: guarantorData.residence_status || '',
            postalAddress: guarantorData.postal_address || '',
            code: guarantorData.code || '',
            occupation: guarantorData.occupation || '',
            relationship: guarantorData.relationship || '',
            dateOfBirth: guarantorData.date_of_birth || '',
            county: guarantorData.county || '',
            cityTown: guarantorData.city_town || '',
          }
        }));
      }

      const { data: nextOfKinData } = await supabase
        .from('next_of_kin')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (nextOfKinData) {
        setFormData(prev => ({
          ...prev,
          nextOfKin: {
            Firstname: nextOfKinData.Firstname || '',
            Surname: nextOfKinData.Surname || '',
            Middlename: nextOfKinData.Middlename || '',
            idNumber: nextOfKinData.id_number || '',
            relationship: nextOfKinData.relationship || '',
            mobile: nextOfKinData.mobile || '',
            alternativeNumber: nextOfKinData.alternative_number || '',
            employmentStatus: nextOfKinData.employment_status || '',
            county: nextOfKinData.county || '',
            cityTown: nextOfKinData.city_town || '',
            companyName: nextOfKinData.company_name || '',
            salary: nextOfKinData.salary || '',
            businessName: nextOfKinData.business_name || '',
            businessIncome: nextOfKinData.business_income || '',
            relationshipOther: nextOfKinData.relationship_other || '',
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching related data:', error);
    }
  };

  const resetFormData = () => {
    setFormData({
      personal: {
        prefix: '',
        Firstname: '',
        Middlename: '',
        Surname: '',
        maritalStatus: '',
        residenceStatus: '',
        mobile: '',
        alternativeMobile: '',
        occupation: '',
        dateOfBirth: '',
        gender: '',
        idNumber: '',
        postalAddress: '',
        code: '',
        town: '',
        county: '',
      },
      business: {
        businessName: '',
        businessType: '',
        daily_Sales: '',
        yearEstablished: '',
        businessLocation: '',
        businessCoordinates: null,
        road: '',
        landmark: '',
        hasLocalAuthorityLicense: '',
        prequalifiedAmount: '',
      },
      guarantor: {
        prefix: '',
        Firstname: '',
        Surname: '',
        Middlename: '',
        idNumber: '',
        maritalStatus: '',
        gender: '',
        mobile: '',
        alternativeMobile: '',
        residenceStatus: '',
        postalAddress: '',
        code: '',
        occupation: '',
        relationship: '',
        dateOfBirth: '',
        county: '',
        cityTown: '',
      },
      nextOfKin: {
        Firstname: '',
        Surname: '',
        Middlename: '',
        idNumber: '',
        relationship: '',
        mobile: '',
        alternativeNumber: '',
        employmentStatus: '',
        county: '',
        cityTown: '',
        companyName: '',
        salary: '',
        businessName: '',
        businessIncome: '',
        relationshipOther: '',
      },
      documents: {
        passport: null,
        idFront: null,
        idBack: null,
        houseImage: null,
        guarantorPassport: null,
        guarantorIdFront: null,
        guarantorIdBack: null,
        officerClient1: null,
        officerClient2: null,
        bothOfficers: null,
      }
    });
    setPreviews({});
  };

  const handleFormChange = (e, section) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [name]: value
      }
    }));
  };

  const handleFileUpload = (e, key) => {
    const file = e.target.files[0];
    if (!file) return;

    if (uploadedFiles.has(file.name)) {
      alert('This file has already been uploaded elsewhere in the form.');
      return;
    }

    e.target.value = null;

    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [key]: file
      }
    }));

    setPreviews(prev => ({
      ...prev,
      [key]: {
        url: URL.createObjectURL(file),
        fileName: file.name
      }
    }));

    setUploadedFiles(prev => new Set(prev).add(file.name));
  };

  const handleRemoveFile = (key) => {
    const file = previews[key]?.fileName;
    if (file && uploadedFiles.has(file)) {
      setUploadedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file);
        return newSet;
      });
    }

    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [key]: null
      }
    }));

    setPreviews(prev => {
      const url = prev?.[key]?.url;
      if (url) URL.revokeObjectURL(url);
      return { ...prev, [key]: null };
    });
  };

  const validateSection = (section) => {
    const currentData = formData[section];
    const errors = {};

    if (section === 'personal') {
      if (!currentData.Firstname?.trim()) errors.Firstname = 'First name is required';
      if (!currentData.Surname?.trim()) errors.Surname = 'Surname is required';
      if (!currentData.mobile?.trim()) errors.mobile = 'Mobile number is required';
      if (currentData.mobile && !/^[0-9]{10,15}$/.test(currentData.mobile.replace(/\D/g, ''))) {
        errors.mobile = 'Invalid mobile number format';
      }
      if (!currentData.idNumber?.trim()) errors.idNumber = 'ID number is required';
      if (currentData.idNumber && !/^[0-9]{6,12}$/.test(currentData.idNumber)) {
        errors.idNumber = 'Invalid ID number format';
      }
    }

    if (section === 'business') {
      if (!currentData.businessName?.trim()) errors.businessName = 'Business name is required';
      if (!currentData.businessType?.trim()) errors.businessType = 'Business type is required';
      if (!currentData.businessLocation?.trim()) errors.businessLocation = 'Business location is required';
    }

    if (section === 'guarantor' && currentData.Firstname) {
      if (!currentData.Firstname?.trim()) errors.Firstname = 'First name is required';
      if (!currentData.Surname?.trim()) errors.Surname = 'Surname is required';
      if (!currentData.mobile?.trim()) errors.mobile = 'Mobile number is required';
      if (currentData.mobile && !/^[0-9]{10,15}$/.test(currentData.mobile.replace(/\D/g, ''))) {
        errors.mobile = 'Invalid mobile number format';
      }
      if (!currentData.idNumber?.trim()) errors.idNumber = 'ID number is required';
      if (currentData.idNumber && !/^[0-9]{6,12}$/.test(currentData.idNumber)) {
        errors.idNumber = 'Invalid ID number format';
      }
    }

    if (section === 'nextOfKin' && currentData.Firstname) {
      if (!currentData.Firstname?.trim()) errors.Firstname = 'First name is required';
      if (!currentData.Surname?.trim()) errors.Surname = 'Surname is required';
      if (!currentData.mobile?.trim()) errors.mobile = 'Mobile number is required';
      if (currentData.mobile && !/^[0-9]{10,15}$/.test(currentData.mobile.replace(/\D/g, ''))) {
        errors.mobile = 'Invalid mobile number format';
      }
      if (!currentData.idNumber?.trim()) errors.idNumber = 'ID number is required';
      if (currentData.idNumber && !/^[0-9]{6,12}$/.test(currentData.idNumber)) {
        errors.idNumber = 'Invalid ID number format';
      }
    }

    return Object.keys(errors).length === 0 ? null : errors;
  };

  const handleSubmit = async (e, section) => {
    e.preventDefault();

    if (!selectedCustomer) {
      alert('Please select a customer first');
      return;
    }

    if (!currentUser) {
      alert('You must be logged in to submit a request');
      return;
    }

    const errors = validateSection(section);
    if (errors) {
      alert('Please fix validation errors before submitting');
      console.log('Validation errors:', errors);
      return;
    }

    try {
      setLoading(true);

      let uploadedDocs = {};
      const docKeys = Object.keys(formData.documents).filter(key => 
        formData.documents[key] && section === 'personal' ? 
        ['passport', 'idFront', 'idBack', 'houseImage'].includes(key) :
        section === 'guarantor' ? 
        ['guarantorPassport', 'guarantorIdFront', 'guarantorIdBack'].includes(key) :
        false
      );

      for (const key of docKeys) {
        const file = formData.documents[key];
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${key}_${file.name}`;
          const filePath = `edit_requests/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('documents')
              .getPublicUrl(filePath);
            uploadedDocs[key] = publicUrl;
          }
        }
      }

      const editRequestData = {
        customer_id: selectedCustomer.id,
        section_type: section,
        current_values: {},
        new_values: formData[section],
        status: 'pending_branch_manager',
        created_by: currentUser.id,
        document_urls: uploadedDocs,
        created_at: new Date().toISOString()
      };

      if (section === 'personal' || section === 'business') {
        const currentData = {};
        Object.keys(formData[section]).forEach(key => {
          currentData[key] = selectedCustomer[key] || '';
        });
        editRequestData.current_values = currentData;
      }

      const { error: insertError } = await supabase
        .from('customer_detail_edit_requests')
        .insert([editRequestData]);

      if (insertError) throw insertError;

      alert(`Edit request for ${section.replace(/([A-Z])/g, ' $1')} submitted successfully!`);
      
      setFormData(prev => ({
        ...prev,
        [section]: Object.keys(prev[section]).reduce((acc, key) => ({
          ...acc,
          [key]: ''
        }), {})
      }));

      const sectionDocKeys = {
        personal: ['passport', 'idFront', 'idBack', 'houseImage'],
        guarantor: ['guarantorPassport', 'guarantorIdFront', 'guarantorIdBack'],
      }[section] || [];

      sectionDocKeys.forEach(key => {
        if (previews[key]) {
          URL.revokeObjectURL(previews[key].url);
          setPreviews(prev => ({ ...prev, [key]: null }));
          setUploadedFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(previews[key]?.fileName);
            return newSet;
          });
        }
      });

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
      
      if (newStatus === 'confirmed' && userRole === 'branch_manager') {
        updateData.confirmed_by = currentUser.id;
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'approved' && userRole === 'superadmin') {
        updateData.approved_by = currentUser.id;
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === 'rejected') {
        updateData.rejected_by = currentUser.id;
        updateData.rejected_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('customer_detail_edit_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;

      if (newStatus === 'approved') {
        const request = editRequests.find(r => r.id === requestId);
        if (request) {
          const { section_type, new_values, customer_id } = request;
          
          if (section_type === 'personal') {
            await supabase
              .from('customers')
              .update(new_values)
              .eq('id', customer_id);
          } else if (section_type === 'business') {
            await supabase
              .from('customers')
              .update(new_values)
              .eq('id', customer_id);
          } else if (section_type === 'guarantor') {
            await supabase
              .from('guarantors')
              .upsert({
                customer_id: customer_id,
                ...new_values
              }, { onConflict: 'customer_id' });
          } else if (section_type === 'nextOfKin') {
            await supabase
              .from('next_of_kin')
              .upsert({
                customer_id: customer_id,
                ...new_values
              }, { onConflict: 'customer_id' });
          }
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
    return userRole === 'branch_manager' && request.status === 'pending_branch_manager';
  };

  const canApprove = (request) => {
    return userRole === 'superadmin' && request.status === 'confirmed';
  };

  const canReject = (request) => {
    return (userRole === 'branch_manager' || userRole === 'superadmin') && 
           (request.status === 'pending_branch_manager' || request.status === 'confirmed');
  };

  const canSubmitRequest = () => {
    return currentUser && ['relationship_officer', 'branch_manager', 'regional_manager'].includes(userRole);
  };

  const renderFormFields = (section) => {
    const sectionData = formData[section];
    const fields = [];

    if (section === 'personal') {
      fields.push(
        <div key="personal-fields" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Prefix</label>
            <select
              name="prefix"
              value={sectionData.prefix}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {PREFIX_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name *</label>
            <input
              type="text"
              name="Firstname"
              value={sectionData.Firstname}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Middle Name</label>
            <input
              type="text"
              name="Middlename"
              value={sectionData.Middlename}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Surname *</label>
            <input
              type="text"
              name="Surname"
              value={sectionData.Surname}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile *</label>
            <input
              type="text"
              name="mobile"
              value={sectionData.mobile}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Alternative Mobile</label>
            <input
              type="text"
              name="alternativeMobile"
              value={sectionData.alternativeMobile}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ID Number *</label>
            <input
              type="text"
              name="idNumber"
              value={sectionData.idNumber}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
            <select
              name="gender"
              value={sectionData.gender}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {GENDER_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Marital Status</label>
            <select
              name="maritalStatus"
              value={sectionData.maritalStatus}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {MARITAL_STATUS_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of Birth</label>
            <input
              type="date"
              name="dateOfBirth"
              value={sectionData.dateOfBirth}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Occupation</label>
            <input
              type="text"
              name="occupation"
              value={sectionData.occupation}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">County</label>
            <select
              name="county"
              value={sectionData.county}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {KENYA_COUNTIES.map(county => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Town/City</label>
            <input
              type="text"
              name="town"
              value={sectionData.town}
              onChange={(e) => handleFormChange(e, 'personal')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>
        </div>
      );

      fields.push(
        <div key="personal-docs" className="mt-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Supporting Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'passport', label: 'Passport Photo' },
              { key: 'idFront', label: 'ID Front' },
              { key: 'idBack', label: 'ID Back' },
              { key: 'houseImage', label: 'House Image' },
            ].map(doc => (
              <div key={doc.key} className="border rounded-lg p-3" style={{ borderColor: primaryColor }}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {doc.label}
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 text-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200 text-sm">
                    <ArrowUpTrayIcon className="w-4 h-4 inline mr-1" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, doc.key)}
                      className="hidden"
                    />
                  </label>
                  <label className="flex-1 text-center px-3 py-1.5 rounded cursor-pointer hover:bg-blue-200 text-sm"
                    style={{ backgroundColor: primaryLight, color: primaryColor }}>
                    <CameraIcon className="w-4 h-4 inline mr-1" />
                    Camera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileUpload(e, doc.key)}
                      className="hidden"
                    />
                  </label>
                </div>
                {previews[doc.key] && (
                  <div className="mt-3 relative">
                    <img
                      src={previews[doc.key].url}
                      alt={doc.label}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(doc.key)}
                      className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (section === 'business') {
      fields.push(
        <div key="business-fields" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Name *</label>
            <input
              type="text"
              name="businessName"
              value={sectionData.businessName}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Type *</label>
            <select
              name="businessType"
              value={sectionData.businessType}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              required
            >
              <option value="">Select</option>
              {BUSINESS_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Location *</label>
            <input
              type="text"
              name="businessLocation"
              value={sectionData.businessLocation}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Road</label>
            <input
              type="text"
              name="road"
              value={sectionData.road}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Landmark</label>
            <input
              type="text"
              name="landmark"
              value={sectionData.landmark}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">County</label>
            <select
              name="county"
              value={sectionData.county}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {KENYA_COUNTIES.map(county => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Year Established</label>
            <input
              type="date"
              name="yearEstablished"
              value={sectionData.yearEstablished}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Sales (KES)</label>
            <input
              type="number"
              name="daily_Sales"
              value={sectionData.daily_Sales}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Local Authority License</label>
            <select
              name="hasLocalAuthorityLicense"
              value={sectionData.hasLocalAuthorityLicense}
              onChange={(e) => handleFormChange(e, 'business')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
        </div>
      );
    }

    if (section === 'guarantor') {
      fields.push(
        <div key="guarantor-fields" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name *</label>
            <input
              type="text"
              name="Firstname"
              value={sectionData.Firstname}
              onChange={(e) => handleFormChange(e, 'guarantor')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Surname *</label>
            <input
              type="text"
              name="Surname"
              value={sectionData.Surname}
              onChange={(e) => handleFormChange(e, 'guarantor')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile *</label>
            <input
              type="text"
              name="mobile"
              value={sectionData.mobile}
              onChange={(e) => handleFormChange(e, 'guarantor')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ID Number *</label>
            <input
              type="text"
              name="idNumber"
              value={sectionData.idNumber}
              onChange={(e) => handleFormChange(e, 'guarantor')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
            <select
              name="gender"
              value={sectionData.gender}
              onChange={(e) => handleFormChange(e, 'guarantor')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {GENDER_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Relationship</label>
            <input
              type="text"
              name="relationship"
              value={sectionData.relationship}
              onChange={(e) => handleFormChange(e, 'guarantor')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              placeholder="e.g., Spouse, Friend"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Occupation</label>
            <input
              type="text"
              name="occupation"
              value={sectionData.occupation}
              onChange={(e) => handleFormChange(e, 'guarantor')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">County</label>
            <select
              name="county"
              value={sectionData.county}
              onChange={(e) => handleFormChange(e, 'guarantor')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {KENYA_COUNTIES.map(county => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
          </div>
        </div>
      );

      fields.push(
        <div key="guarantor-docs" className="mt-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Guarantor Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'guarantorPassport', label: 'Passport Photo' },
              { key: 'guarantorIdFront', label: 'ID Front' },
              { key: 'guarantorIdBack', label: 'ID Back' },
            ].map(doc => (
              <div key={doc.key} className="border rounded-lg p-3" style={{ borderColor: primaryColor }}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {doc.label}
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 text-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200 text-sm">
                    <ArrowUpTrayIcon className="w-4 h-4 inline mr-1" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, doc.key)}
                      className="hidden"
                    />
                  </label>
                </div>
                {previews[doc.key] && (
                  <div className="mt-3 relative">
                    <img
                      src={previews[doc.key].url}
                      alt={doc.label}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(doc.key)}
                      className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (section === 'nextOfKin') {
      fields.push(
        <div key="nextOfKin-fields" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name *</label>
            <input
              type="text"
              name="Firstname"
              value={sectionData.Firstname}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Surname *</label>
            <input
              type="text"
              name="Surname"
              value={sectionData.Surname}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile *</label>
            <input
              type="text"
              name="mobile"
              value={sectionData.mobile}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ID Number *</label>
            <input
              type="text"
              name="idNumber"
              value={sectionData.idNumber}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Relationship *</label>
            <select
              name="relationship"
              value={sectionData.relationship}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {RELATIONSHIP_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {sectionData.relationship === 'Other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Specify Relationship</label>
              <input
                type="text"
                name="relationshipOther"
                value={sectionData.relationshipOther}
                onChange={(e) => handleFormChange(e, 'nextOfKin')}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
                style={{ borderColor: primaryColor }}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Employment Status</label>
            <select
              name="employmentStatus"
              value={sectionData.employmentStatus}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {EMPLOYMENT_STATUS.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {sectionData.employmentStatus === 'Employed' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
                <input
                  type="text"
                  name="companyName"
                  value={sectionData.companyName}
                  onChange={(e) => handleFormChange(e, 'nextOfKin')}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
                  style={{ borderColor: primaryColor }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Salary (KES)</label>
                <input
                  type="number"
                  name="salary"
                  value={sectionData.salary}
                  onChange={(e) => handleFormChange(e, 'nextOfKin')}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
                  style={{ borderColor: primaryColor }}
                />
              </div>
            </>
          )}

          {sectionData.employmentStatus === 'Self Employed' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Name</label>
                <input
                  type="text"
                  name="businessName"
                  value={sectionData.businessName}
                  onChange={(e) => handleFormChange(e, 'nextOfKin')}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
                  style={{ borderColor: primaryColor }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Income (KES)</label>
                <input
                  type="number"
                  name="businessIncome"
                  value={sectionData.businessIncome}
                  onChange={(e) => handleFormChange(e, 'nextOfKin')}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
                  style={{ borderColor: primaryColor }}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">County</label>
            <select
              name="county"
              value={sectionData.county}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
            >
              <option value="">Select</option>
              {KENYA_COUNTIES.map(county => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    return fields;
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-3" style={{ borderColor: primaryColor }}></div>
          <p className="text-gray-600 text-base">Loading user profile...</p>
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
          Search Your Customers
        </h2>

        <div className="relative mb-4">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name, ID number, or mobile..."
              className="w-full px-4 py-2.5 pl-11 border border-gray-300 rounded-lg focus:ring-1 focus:ring-offset-1 focus:outline-none text-base"
              style={{ borderColor: primaryColor }}
              disabled={!currentUser}
            />
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-4 h-4" style={{ color: primaryColor }} />
            {searching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: primaryColor }}></div>
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-gray-900 text-base">
                    {`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {customer.mobile && (
                      <div className="flex items-center gap-1">
                        <PhoneIcon className="w-3 h-3" />
                        {customer.mobile}
                      </div>
                    )}
                    {customer.id_number && (
                      <div className="flex items-center gap-1 mt-1">
                        <CreditCardIcon className="w-3 h-3" />
                        ID: {customer.id_number}
                      </div>
                    )}
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
                  Selected: {`${selectedCustomer.Firstname || ''} ${selectedCustomer.Middlename || ''} ${selectedCustomer.Surname || ''}`.trim()}
                </p>
                <div className="text-sm mt-1.5" style={{ color: primaryColor }}>
                  {selectedCustomer.mobile && (
                    <div className="flex items-center gap-1">
                      <PhoneIcon className="w-3 h-3" />
                      Phone: {selectedCustomer.mobile}
                    </div>
                  )}
                  {selectedCustomer.id_number && (
                    <div className="flex items-center gap-1 mt-1">
                      <CreditCardIcon className="w-3 h-3" />
                      ID: {selectedCustomer.id_number}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setSearchTerm('');
                  resetFormData();
                }}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedCustomer && canSubmitRequest() && (
        <>
          {/* Navigation Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex flex-wrap gap-2">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all text-sm ${
                    activeSection === id
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={activeSection === id ? { 
                    backgroundColor: primaryColor 
                  } : {}}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="border-b border-gray-200 pb-4 mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: primaryColor }}>
                {React.createElement(sections.find(s => s.id === activeSection).icon, { className: "h-5 w-5" })}
                Edit {sections.find(s => s.id === activeSection)?.label}
              </h2>
              <p className="text-gray-600 mt-1.5 text-sm">
                Update the information below. Changes will require approval.
              </p>
            </div>

            <form onSubmit={(e) => handleSubmit(e, activeSection)}>
              {renderFormFields(activeSection)}

 <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end">
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
      `Submit ${sections.find(s => s.id === activeSection)?.label} Edit Request`
    )}
  </button>
</div>


            </form>
          </div>
        </>
      )}

      {/* Edit Requests List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>Edit Requests</h2>
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
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
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
              
              const sectionLabel = sections.find(s => s.id === request.section_type)?.label || request.section_type;

              return (
                <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base">
                        {customerFullName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {sectionLabel} Edit Request
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(request.status)}
                      <span className="text-sm font-medium">
                        {getStatusText(request.status)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-600">
                      Submitted on {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
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

export default CustomerDetailsEdit;