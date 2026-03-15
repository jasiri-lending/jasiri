import React, { useState, useEffect } from 'react';
import { useTenantFeatures } from '../../hooks/useTenantFeatures';
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
  ChevronDownIcon,
  CalendarIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  UserIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

import { supabase } from "../../supabaseClient.js";

function CustomerDetailsEdit() {
  const { imageUploadEnabled, documentUploadEnabled } = useTenantFeatures();
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
  const [selectedRequest, setSelectedRequest] = useState(null);

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
    existingBusinessImages: [],
    documents: {
      passport: null,
      idFront: null,
      idBack: null,
      houseImage: null,
      guarantorPassport: null,
      guarantorIdFront: null,
      guarantorIdBack: null,
      businessImage: null,
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

      const { data: businessImages } = await supabase
        .from('business_images')
        .select('image_url')
        .eq('customer_id', customerId);

      if (businessImages && businessImages.length > 0) {
        setFormData(prev => ({
          ...prev,
          existingBusinessImages: businessImages.map(img => img.image_url)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          existingBusinessImages: []
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
      existingBusinessImages: [],
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
        businessImage: null,
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
            section === 'business' ?
              ['businessImage'].includes(key) :
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
        business: ['businessImage'],
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
      } else if (newStatus === 'approved' && userRole === 'regional_manager') {
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
        alert(`Request ${newStatus} successfully!`);
      } // Closing brace for the if (newStatus === 'approved') block
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
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.bg} ${config.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`}></span>
        {config.label}
      </span>
    );
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending_branch_manager':
      case 'pending_regional_manager':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      case 'confirmed':
        return <ClockIcon className="w-5 h-5 text-blue-500" />;
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending_branch_manager':
        return 'Pending BM Approval';
      case 'pending_regional_manager':
        return 'Pending RM Approval';
      case 'confirmed':
        return 'Confirmed by BM';
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
    return userRole === 'regional_manager' && request.status === 'confirmed';
  };

  const canReject = (request) => {
    return (userRole === 'branch_manager' || userRole === 'regional_manager') &&
      (request.status === 'pending_branch_manager' || request.status === 'confirmed');
  };

  const canSubmitRequest = () => {
    return currentUser && ['relationship_officer', 'branch_manager', 'regional_manager'].includes(userRole);
  };

  const renderFormFields = (section) => {
    const sectionData = formData[section];
    const fields = [];
    const inputClass = "w-full p-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#586ab1]/10 focus:border-[#586ab1] transition-all text-sm font-medium";
    const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1";

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

      if (imageUploadEnabled) {
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
                    <label className="flex-1 md:hidden text-center px-3 py-1.5 rounded cursor-pointer hover:bg-blue-200 text-sm"
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

      if (imageUploadEnabled) {
        fields.push(
          <div key="business-docs" className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
              <PhotoIcon className="w-4 h-4 text-[#586ab1]" />
              Business Documents
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'businessImage', label: 'Business/Shop Photo' },
              ].map(doc => (
                <div key={doc.key} className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-4 transition-all hover:border-[#586ab1] hover:bg-[#586ab1]/5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    {doc.label}
                  </label>

                  {!previews[doc.key] ? (
                    <label className="flex flex-col items-center justify-center py-8 cursor-pointer">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-[#586ab1] group-hover:text-white transition-all">
                        <ArrowUpTrayIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-500">Click to Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, doc.key)}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={previews[doc.key].url}
                        alt={doc.label}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(doc.key)}
                          className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Existing Business Images */}
            {formData.existingBusinessImages && formData.existingBusinessImages.length > 0 && (
              <div className="mt-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <PhotoIcon className="w-3 h-3" />
                  Existing Business Images
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {formData.existingBusinessImages.map((img, index) => (
                    <div key={index} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm group">
                      <img
                        src={img}
                        alt={`Business ${index + 1}`}
                        className="w-full h-full object-cover"
                        onClick={() => setSelectedImage(img)}
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[8px] font-black text-white uppercase tracking-widest bg-black/40 px-2 py-1 rounded">View</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }
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

      if (imageUploadEnabled) {
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
    }

    if (section === 'nextOfKin') {
      fields.push(
        <div key="nextOfKin-fields" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className={labelClass}>First Name *</label>
            <input
              type="text"
              name="Firstname"
              value={sectionData.Firstname}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Surname *</label>
            <input
              type="text"
              name="Surname"
              value={sectionData.Surname}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Mobile *</label>
            <input
              type="text"
              name="mobile"
              value={sectionData.mobile}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Relationship *</label>
            <select
              name="relationship"
              value={sectionData.relationship}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className={inputClass}
            >
              <option value="">Select</option>
              {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Employment Status</label>
            <select
              name="employmentStatus"
              value={sectionData.employmentStatus}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className={inputClass}
            >
              <option value="">Select</option>
              {EMPLOYMENT_STATUS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>County</label>
            <select
              name="county"
              value={sectionData.county}
              onChange={(e) => handleFormChange(e, 'nextOfKin')}
              className={inputClass}
            >
              <option value="">Select County</option>
              {KENYA_COUNTIES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      );
    }

    return fields;
  };

  const ViewRequestModal = ({ request, isOpen, onClose }) => {
    if (!isOpen || !request) return null;

    const sectionLabel = sections.find(s => s.id === request.section_type)?.label || request.section_type;
    const customerName = request.customer
      ? `${request.customer.Firstname || ''} ${request.customer.Surname || ''}`.trim()
      : 'Unknown Customer';

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
          <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#586ab1] flex items-center justify-center text-white shadow-lg">
                <DocumentTextIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">{sectionLabel} Edit Request</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Customer: {customerName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-slate-100">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8">
              {/* Previous Data */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Previous Information</h4>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100/50 space-y-3">
                  {Object.entries(request.current_values || {}).map(([key, value]) => (
                    <div key={key} className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-sm font-medium text-slate-600">{value || '—'}</span>
                    </div>
                  ))}
                  {(!request.current_values || Object.keys(request.current_values).length === 0) && (
                    <p className="text-sm text-slate-400 italic">No previous data recorded for this section</p>
                  )}
                </div>
              </div>

              {/* Proposed Data */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 bg-[#586ab1] rounded-full"></span>
                  <h4 className="text-[10px] font-black uppercase text-[#586ab1] tracking-widest">Proposed Changes</h4>
                </div>
                <div className="bg-[#586ab1]/5 rounded-2xl p-6 border border-[#586ab1]/10 space-y-3 font-medium">
                  {Object.entries(request.new_values || {}).map(([key, value]) => {
                    const isChanged = request.current_values && request.current_values[key] !== value;
                    return (
                      <div key={key} className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className={`text-sm ${isChanged ? 'text-[#586ab1] font-black' : 'text-slate-600'}`}>
                          {typeof value === 'object' ? JSON.stringify(value) : (value || '—')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Documents Section if any */}
            {request.document_urls && Object.keys(request.document_urls).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Uploaded Documents</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(request.document_urls).map(([key, url]) => (
                    <div key={key} className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-square">
                      <img src={url} alt={key} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                        <span className="text-[8px] font-black text-white uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</span>
                      </div>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-700" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Trail */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                <ClockIcon className="w-3 h-3" /> Audit History
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="flex items-center gap-2"><span className="w-1 h-1 bg-slate-400 rounded-full"></span> Submission</span>
                  <span>{new Date(request.created_at).toLocaleString()}</span>
                </div>
                {request.confirmed_at && (
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                    <span className="flex items-center gap-2"><span className="w-1 h-1 bg-blue-400 rounded-full"></span> BM Confirmation</span>
                    <span>{new Date(request.confirmed_at).toLocaleString()}</span>
                  </div>
                )}
                {request.approved_at && (
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                    <span className="flex items-center gap-2"><span className="w-1 h-1 bg-emerald-400 rounded-full"></span> RM Approval</span>
                    <span>{new Date(request.approved_at).toLocaleString()}</span>
                  </div>
                )}
                {request.rejected_at && (
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                    <span className="flex items-center gap-2"><span className="w-1 h-1 bg-red-400 rounded-full"></span> Rejection</span>
                    <span>{new Date(request.rejected_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-white border border-transparent hover:border-slate-200 transition-all">
              Dismiss
            </button>
            {canConfirm(request) && (
              <button onClick={() => handleStatusUpdate(request.id, 'confirmed')} className="px-6 py-2.5 bg-[#586ab1] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#586ab1]/20 hover:bg-[#475589] transition-all">
                Verify & Confirm
              </button>
            )}
            {canApprove(request) && (
              <button onClick={() => handleStatusUpdate(request.id, 'approved')} className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">
                Authorize Update
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getStats = () => {
    return {
      total: editRequests.length,
      pendingBM: editRequests.filter(r => r.status === 'pending_branch_manager').length,
      pendingRM: editRequests.filter(r => r.status === 'confirmed').length,
      approvedToday: editRequests.filter(r =>
        r.status === 'approved' &&
        new Date(r.updated_at).toDateString() === new Date().toDateString()
      ).length
    };
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-[#586ab1]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-[#586ab1] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium tracking-tight">Initializing Jasiri Dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = getStats();

  return (
    <div className="space-y-6">
      {/* Compact Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Volume', value: stats.total, icon: ArrowPathIcon, color: 'text-blue-500', light: 'bg-blue-50' },
          { label: 'Pending BM', value: stats.pendingBM, icon: ClockIcon, color: 'text-amber-500', light: 'bg-amber-50' },
          { label: 'Pending RM', value: stats.pendingRM, icon: ShieldCheckIcon, color: 'text-[#586ab1]', light: 'bg-[#586ab1]/10' },
          { label: 'Approved Today', value: stats.approvedToday, icon: CheckCircleIcon, color: 'text-emerald-500', light: 'bg-emerald-50' }
        ].map((stat, i) => (
          <div key={i} className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-[#586ab1]/30 transition-all duration-300">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Dynamic Nav Tabs */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl border border-slate-200/50 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveSection('personal')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 ${activeSection === 'personal' ? 'bg-white text-[#586ab1] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserIcon className="w-4 h-4" /> Personal
            </button>
            <button
              onClick={() => setActiveSection('business')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 ${activeSection === 'business' ? 'bg-white text-[#586ab1] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BuildingOffice2Icon className="w-4 h-4" /> Business
            </button>
            <button
              onClick={() => setActiveSection('guarantor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 ${activeSection === 'guarantor' ? 'bg-white text-[#586ab1] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserGroupIcon className="w-4 h-4" /> Guarantor
            </button>
            <button
              onClick={() => setActiveSection('nextOfKin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 ${activeSection === 'nextOfKin' ? 'bg-white text-[#586ab1] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserGroupIcon className="w-4 h-4" /> Next of Kin
            </button>
          </div>

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
                          <p className="font-bold text-slate-800 text-sm">{`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()}</p>
                          <p className="text-[10px] text-slate-400 font-medium">ID: {customer.id_number} • {customer.mobile}</p>
                        </div>
                      </div>
                      <ShieldCheckIcon className="w-5 h-5 text-slate-200 group-hover:text-[#586ab1] transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">
            {selectedCustomer ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 border-b border-slate-100 bg-[#586ab1]/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#586ab1] shadow-sm">
                      {React.createElement(sections.find(s => s.id === activeSection)?.icon || UserIcon, { className: "w-6 h-6" })}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-800 tracking-tight">
                        Edit <span className="text-[#586ab1]">{sections.find(s => s.id === activeSection)?.label}</span>
                      </h2>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                        Selected: {`${selectedCustomer.Firstname || ''} ${selectedCustomer.Surname || ''}`.trim()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); resetFormData(); }}
                    className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-slate-100"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-8">
                  <form onSubmit={(e) => handleSubmit(e, activeSection)} className="space-y-6">
                    {renderFormFields(activeSection)}

                    <div className="flex justify-end pt-6 border-t border-slate-100">
                      <button
                        type="submit"
                        disabled={loading}
                        className="group relative inline-flex items-center justify-center px-8 py-3 bg-[#586ab1] text-white font-bold rounded-2xl hover:bg-[#475589] transition-all duration-300 disabled:bg-slate-300 shadow-lg shadow-[#586ab1]/20 overflow-hidden"
                      >
                        <span className="relative flex items-center gap-2">
                          {loading ? (
                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                          ) : (
                            <CheckCircleIcon className="w-5 h-5" />
                          )}
                          {loading ? 'Processing...' : `Submit ${sections.find(s => s.id === activeSection)?.label} Update`}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-[#586ab1]/5 border-2 border-dashed border-[#586ab1]/20 rounded-[2.5rem] p-24 text-center">
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <div className="absolute inset-0 bg-[#586ab1]/10 rounded-full animate-ping opacity-25"></div>
                  <div className="relative bg-white w-24 h-24 rounded-full flex items-center justify-center shadow-inner border border-white">
                    <UserCircleIcon className="w-12 h-12 text-[#586ab1]" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3 uppercase">Start a new edit</h3>
                <p className="text-slate-500 max-w-sm mx-auto text-sm font-medium leading-relaxed">
                  Search and select a customer from the search bar above to begin updating their details.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar / Requests Activity */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-fit">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Activity Stream</h3>
              <button
                onClick={fetchEditRequests}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-[#586ab1] transition-all"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="divide-y divide-slate-50 overflow-y-auto max-h-[800px]">
              {editRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <DocumentIcon className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No activity yet</p>
                </div>
              ) : (
                editRequests.map(request => (
                  <div
                    key={request.id}
                    className="p-5 hover:bg-slate-50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#586ab1]/10 group-hover:text-[#586ab1] transition-colors">
                          {getStatusIcon(request.status)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm tracking-tight leading-none group-hover:text-[#586ab1] transition-colors">
                            {request.customer
                              ? `${request.customer.Firstname || ''} ${request.customer.Surname || ''}`.trim()
                              : 'Unknown Customer'}
                          </p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1">
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            {sections.find(s => s.id === request.section_type)?.label || request.section_type} Edit
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-slate-400">
                          <CalendarIcon className="w-3 h-3" />
                          <span className="text-[10px] font-bold">{new Date(request.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-[#586ab1] hover:underline"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <ViewRequestModal
          request={selectedRequest}
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      </div>
    </div>
  );
}

export default CustomerDetailsEdit;