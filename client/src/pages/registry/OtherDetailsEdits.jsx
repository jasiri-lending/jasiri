import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
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
  PencilSquareIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  DocumentIcon,
  ChevronDownIcon,
  CalendarIcon,
  ArrowPathIcon,
  UserIcon,
  FunnelIcon,
  EyeIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";

import { supabase } from "../../supabaseClient.js";

function CustomerDetailsEdit() {
  const navigate = useNavigate();
  const { imageUploadEnabled, documentUploadEnabled } = useTenantFeatures();
  const [loading, setLoading] = useState(false);
  const { hasPermission, loading: permsLoading } = usePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [editRequests, setEditRequests] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState(new Set());
  const [previews, setPreviews] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [securityItems, setSecurityItems] = useState([]);
  const [securityItemImages, setSecurityItemImages] = useState([]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([]);
  const [guarantorSecurityImages, setGuarantorSecurityImages] = useState([]);

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
      Firstname: '', Surname: '', Middlename: '', idNumber: '', relationship: '', mobile: '',
      alternativeNumber: '', employmentStatus: '', county: '', cityTown: '', companyName: '',
      salary: '', businessName: '', businessIncome: '', relationshipOther: '',
    },
    borrowerSecurity: [],
    guarantorSecurity: [],
    meetingDocuments: [],
    existingImages: {
      passport: null, idFront: null, idBack: null, house: null, business: [],
      security: [], guarantorPassport: null, guarantorIdFront: null, guarantorIdBack: null,
      guarantorSecurity: [], officerClient1: null, officerClient2: null, bothOfficers: null,
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
    { id: 'security', label: 'Security & Collateral', icon: ShieldCheckIcon },
    { id: 'guarantor_security', label: 'Guarantor Security', icon: ShieldCheckIcon },
  ];

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
    prequalifiedAmount: 'prequalifiedAmount',
    houseImage: 'house_image_url',
    passport: 'passport_url',
    idFront: 'id_front_url',
    idBack: 'id_back_url',
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
          customer:customers(Firstname, Middlename, Surname, mobile, id_number, created_by, branch_id, region_id),
          created_by_user:users!created_by(full_name)
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

    setFormData(prev => ({
      ...prev,
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
      },
      existingImages: {
        ...prev.existingImages,
        passport: customer.passport_url,
        idFront: customer.id_front_url,
        idBack: customer.id_back_url,
      }
    }));

    await fetchRelatedData(customer.id);
  };

  const fetchRelatedData = async (customerId) => {
    try {
      setLoading(true);

      const [
        { data: guarantorData },
        { data: nextOfKinData },
        { data: businessImagesData },
        { data: securityItemsData },
        { data: guarantorSecurityData },
        { data: documentsData }
      ] = await Promise.all([
        supabase.from('guarantors').select('*').eq('customer_id', String(customerId)).single(),
        supabase.from('next_of_kin').select('*').eq('customer_id', String(customerId)).single(),
        supabase.from('business_images').select('*').eq('customer_id', String(customerId)),
        supabase.from('security_items').select('*, security_item_images(image_url)').eq('customer_id', String(customerId)),
        supabase.from('guarantor_security').select('*, guarantor_security_images(image_url)').eq('customer_id', String(customerId)),
        supabase.from('documents').select('*').eq('customer_id', String(customerId))
      ]);

      setFormData(prev => ({
        ...prev,
        guarantor: guarantorData ? {
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
        } : prev.guarantor,
        nextOfKin: nextOfKinData ? {
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
        } : prev.nextOfKin,
        documents: documentsData || [],
        existingImages: {
          ...prev.existingImages,
          business: businessImagesData?.map(img => img.image_url) || [],
          security: securityItemsData?.flatMap(item => item.security_item_images?.map(img => img.image_url) || []) || [],
          guarantorSecurity: guarantorSecurityData?.flatMap(item => item.guarantor_security_images?.map(img => img.image_url) || []) || [],
          guarantorPassport: guarantorData?.passport_url || '',
          guarantorIdFront: guarantorData?.id_front_url || '',
          guarantorIdBack: guarantorData?.id_back_url || '',
        }
      }));

      if (securityItemsData) {
        setSecurityItems(securityItemsData.map(item => ({
          item_name: item.item_name || '',
          item_description: item.item_description || '',
          item_identification: item.item_identification || '',
          item_value: item.item_value || ''
        })));
        setSecurityItemImages(new Array(securityItemsData.length).fill([]));
      }

      if (guarantorSecurityData) {
        setGuarantorSecurityItems(guarantorSecurityData.map(item => ({
          item_name: item.item_name || '',
          item_description: item.item_description || '',
          item_identification: item.item_identification || '',
          item_value: item.item_value || ''
        })));
        setGuarantorSecurityImages(new Array(guarantorSecurityData.length).fill([]));
      }

    } catch (error) {
      console.error('Error fetching related data:', error);
    } finally {
      setLoading(false);
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
      if (!String(currentData.Firstname || '').trim()) errors.Firstname = 'First name is required';
      if (!String(currentData.Surname || '').trim()) errors.Surname = 'Surname is required';
      if (!String(currentData.mobile || '').trim()) errors.mobile = 'Mobile number is required';
      if (currentData.mobile && !/^[0-9]{10,15}$/.test(String(currentData.mobile).replace(/\D/g, ''))) {
        errors.mobile = 'Invalid mobile number format';
      }
      if (!String(currentData.idNumber || '').trim()) errors.idNumber = 'ID number is required';
      if (currentData.idNumber && !/^[0-9]{6,12}$/.test(String(currentData.idNumber))) {
        errors.idNumber = 'Invalid ID number format';
      }
    }

    if (section === 'business') {
      if (!String(currentData.businessName || '').trim()) errors.businessName = 'Business name is required';
      if (!String(currentData.businessType || '').trim()) errors.businessType = 'Business type is required';
      if (!String(currentData.businessLocation || '').trim()) errors.businessLocation = 'Business location is required';
    }

    if (section === 'guarantor' && currentData.Firstname) {
      if (!String(currentData.Firstname || '').trim()) errors.Firstname = 'First name is required';
      if (!String(currentData.Surname || '').trim()) errors.Surname = 'Surname is required';
      if (!String(currentData.mobile || '').trim()) errors.mobile = 'Mobile number is required';
      if (currentData.mobile && !/^[0-9]{10,15}$/.test(String(currentData.mobile).replace(/\D/g, ''))) {
        errors.mobile = 'Invalid mobile number format';
      }
      if (!String(currentData.idNumber || '').trim()) errors.idNumber = 'ID number is required';
      if (currentData.idNumber && !/^[0-9]{6,12}$/.test(String(currentData.idNumber))) {
        errors.idNumber = 'Invalid ID number format';
      }
    }

    if (section === 'nextOfKin' && currentData.Firstname) {
      if (!String(currentData.Firstname || '').trim()) errors.Firstname = 'First name is required';
      if (!String(currentData.Surname || '').trim()) errors.Surname = 'Surname is required';
      if (!String(currentData.mobile || '').trim()) errors.mobile = 'Mobile number is required';
      if (currentData.mobile && !/^[0-9]{10,15}$/.test(String(currentData.mobile).replace(/\D/g, ''))) {
        errors.mobile = 'Invalid mobile number format';
      }
      if (!String(currentData.idNumber || '').trim()) errors.idNumber = 'ID number is required';
      if (currentData.idNumber && !/^[0-9]{6,12}$/.test(String(currentData.idNumber))) {
        errors.idNumber = 'Invalid ID number format';
      }
    }

    return Object.keys(errors).length === 0 ? null : errors;
  };

  const addSecurityItem = () => {
    setSecurityItems(prev => [
      ...prev,
      { item_name: '', item_description: '', item_identification: '', item_value: '' }
    ]);
    setSecurityItemImages(prev => [...prev, []]);
  };

  const removeSecurityItem = (index) => {
    setSecurityItems(prev => prev.filter((_, i) => i !== index));
    setSecurityItemImages(prev => prev.filter((_, i) => i !== index));
  };

  const addGuarantorSecurityItem = () => {
    setGuarantorSecurityItems(prev => [
      ...prev,
      { item_name: '', item_description: '', item_identification: '', item_value: '' }
    ]);
    setGuarantorSecurityImages(prev => [...prev, []]);
  };

  const removeGuarantorSecurityItem = (index) => {
    setGuarantorSecurityItems(prev => prev.filter((_, i) => i !== index));
    setGuarantorSecurityImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSecurityFileUpload = (e, index) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setSecurityItemImages(prev => {
      const newImages = [...prev];
      newImages[index] = [...(newImages[index] || []), ...files];
      return newImages;
    });
  };

  const handleRemoveSecurityFile = (itemIndex, fileIndex) => {
    setSecurityItemImages(prev => {
      const newImages = [...prev];
      newImages[itemIndex] = newImages[itemIndex].filter((_, i) => i !== fileIndex);
      return newImages;
    });
  };

  const handleGuarantorSecurityFileUpload = (e, index) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setGuarantorSecurityImages(prev => {
      const newImages = [...prev];
      newImages[index] = [...(newImages[index] || []), ...files];
      return newImages;
    });
  };

  const handleRemoveGuarantorSecurityFile = (itemIndex, fileIndex) => {
    setGuarantorSecurityImages(prev => {
      const newImages = [...prev];
      newImages[itemIndex] = newImages[itemIndex].filter((_, i) => i !== fileIndex);
      return newImages;
    });
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
          const fileName = `${Date.now()}_${key}_${file.name}`;
          const filePath = `edit_requests/${fileName}`;
          const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
            uploadedDocs[key] = publicUrl;
          }
        }
      }

      let securityImagesUrls = [];
      if (section === 'security') {
        for (let i = 0; i < securityItems.length; i++) {
          const itemImages = securityItemImages[i] || [];
          const itemUrls = [];
          for (const file of itemImages) {
            const fileName = `${Date.now()}_sec_${i}_${file.name}`;
            const filePath = `security/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
              itemUrls.push(publicUrl);
            }
          }
          securityImagesUrls[i] = itemUrls;
        }
      }

      let guarantorSecurityImagesUrls = [];
      if (section === 'guarantor_security') {
        for (let i = 0; i < guarantorSecurityItems.length; i++) {
          const itemImages = guarantorSecurityImages[i] || [];
          const itemUrls = [];
          for (const file of itemImages) {
            const fileName = `${Date.now()}_gsec_${i}_${file.name}`;
            const filePath = `security/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
              itemUrls.push(publicUrl);
            }
          }
          guarantorSecurityImagesUrls[i] = itemUrls;
        }
      }

      let proposedChanges = {};
      if (section === 'security') {
        proposedChanges = {
          security_items: securityItems.map((item, idx) => ({
            ...item,
            images: securityImagesUrls[idx] || []
          }))
        };
      } else if (section === 'guarantor_security') {
        proposedChanges = {
          guarantor_security: guarantorSecurityItems.map((item, idx) => ({
            ...item,
            images: guarantorSecurityImagesUrls[idx] || []
          }))
        };
      } else {
        // Filter proposed changes to only include fields that are different from current data
        const sectionData = formData[section];
        const deltas = {};

        Object.keys(sectionData).forEach(key => {
          const newValue = sectionData[key];

          // Determine which field map to use
          const fieldMap = ['personal', 'business'].includes(section)
            ? CUSTOMER_FIELD_MAP
            : (['guarantor', 'nextOfKin'].includes(section) ? GUARANTOR_FIELD_MAP : {});

          const dbKey = fieldMap[key] || key;
          const currentValue = selectedCustomer[dbKey];

          // For dates or other values that might be null/undefined, normalize to string for comparison
          if (String(newValue || '') !== String(currentValue || '')) {
            deltas[key] = newValue;
          }
        });

        // Also include any new uploaded documents
        proposedChanges = {
          ...deltas,
          ...uploadedDocs
        };
      }

      // If no changes were made and no document was uploaded, prevent submission
      if (Object.keys(proposedChanges).length === 0) {
        alert("No changes detected. Please modify at least one field before submitting.");
        setLoading(false);
        return;
      }

      const editRequestData = {
        customer_id: selectedCustomer.id,
        section_type: section,
        current_values: {},
        new_values: proposedChanges,
        status: 'pending_branch_manager',
        created_by: currentUser.id,
        tenant_id: currentUser.tenant_id,
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

      if (section === 'security') {
        setSecurityItems([]);
        setSecurityItemImages([]);
      } else if (section === 'guarantor_security') {
        setGuarantorSecurityItems([]);
        setGuarantorSecurityImages([]);
      } else {
        setFormData(prev => ({
          ...prev,
          [section]: Object.keys(prev[section]).reduce((acc, key) => ({
            ...acc,
            [key]: ''
          }), {})
        }));
      }

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
      'pending_superadmin': {
        bg: 'bg-purple-50 border-purple-200',
        text: 'text-purple-700',
        dot: 'bg-purple-400',
        label: 'Pending Superadmin'
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
    return hasPermission('amendments.confirm') && request.status === 'pending_branch_manager';
  };

  const canApprove = (request) => {
    return hasPermission('amendments.authorize') && request.status === 'confirmed';
  };

  const canReject = (request) => {
    return (hasPermission('amendments.confirm') || hasPermission('amendments.authorize')) &&
      (request.status === 'pending_branch_manager' || request.status === 'confirmed');
  };

  const canSubmitRequest = () => {
    return currentUser && hasPermission('amendments.initiate');
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

    if (section === 'security') {
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Security & Collateral</h3>
              <p className="text-[10px] text-slate-500 font-medium">Add or remove borrower security items</p>
            </div>
            <button
              type="button"
              onClick={addSecurityItem}
              className="px-3 py-1.5 bg-white text-[#586ab1] border border-[#586ab1] rounded-lg text-[10px] font-bold hover:bg-[#586ab1] hover:text-white transition-all flex items-center gap-1.5"
            >
              <PencilSquareIcon className="w-3 h-3" /> Add Item
            </button>
          </div>

          {securityItems.map((item, index) => (
            <div key={index} className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 relative group hover:border-[#586ab1] transition-all">
              <button
                type="button"
                onClick={() => removeSecurityItem(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-red-100 shadow-sm"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Item Name *</label>
                  <input
                    type="text"
                    value={item.item_name}
                    onChange={(e) => {
                      const newItems = [...securityItems];
                      newItems[index].item_name = e.target.value;
                      setSecurityItems(newItems);
                    }}
                    className={inputClass}
                    placeholder="e.g., Household Items"
                  />
                </div>
                <div>
                  <label className={labelClass}>Estimated Value (KES) *</label>
                  <input
                    type="number"
                    value={item.item_value}
                    onChange={(e) => {
                      const newItems = [...securityItems];
                      newItems[index].item_value = e.target.value;
                      setSecurityItems(newItems);
                    }}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Description / Identification</label>
                  <textarea
                    value={item.item_description}
                    onChange={(e) => {
                      const newItems = [...securityItems];
                      newItems[index].item_description = e.target.value;
                      setSecurityItems(newItems);
                    }}
                    className={inputClass}
                    rows="2"
                    placeholder="Serial numbers, colors, conditions..."
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Item Images</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(securityItemImages[index] || []).map((file, fIdx) => (
                    <div key={fIdx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group/img">
                      <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveSecurityFile(index, fIdx)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <XMarkIcon className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-[#586ab1] hover:text-[#586ab1] transition-all cursor-pointer">
                    <CameraIcon className="w-5 h-5 mb-1" />
                    <span className="text-[8px] font-bold">ADD</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleSecurityFileUpload(e, index)}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (section === 'guarantor_security') {
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Guarantor Security</h3>
              <p className="text-[10px] text-slate-500 font-medium">Add or remove guarantor security items</p>
            </div>
            <button
              type="button"
              onClick={addGuarantorSecurityItem}
              className="px-3 py-1.5 bg-white text-[#586ab1] border border-[#586ab1] rounded-lg text-[10px] font-bold hover:bg-[#586ab1] hover:text-white transition-all flex items-center gap-1.5"
            >
              <PencilSquareIcon className="w-3 h-3" /> Add Item
            </button>
          </div>

          {guarantorSecurityItems.map((item, index) => (
            <div key={index} className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 relative group hover:border-[#586ab1] transition-all">
              <button
                type="button"
                onClick={() => removeGuarantorSecurityItem(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-red-100 shadow-sm"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Item Name *</label>
                  <input
                    type="text"
                    value={item.item_name}
                    onChange={(e) => {
                      const newItems = [...guarantorSecurityItems];
                      newItems[index].item_name = e.target.value;
                      setGuarantorSecurityItems(newItems);
                    }}
                    className={inputClass}
                    placeholder="e.g., Household Items"
                  />
                </div>
                <div>
                  <label className={labelClass}>Estimated Value (KES) *</label>
                  <input
                    type="number"
                    value={item.item_value}
                    onChange={(e) => {
                      const newItems = [...guarantorSecurityItems];
                      newItems[index].item_value = e.target.value;
                      setGuarantorSecurityItems(newItems);
                    }}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Description / Identification</label>
                  <textarea
                    value={item.item_description}
                    onChange={(e) => {
                      const newItems = [...guarantorSecurityItems];
                      newItems[index].item_description = e.target.value;
                      setGuarantorSecurityItems(newItems);
                    }}
                    className={inputClass}
                    rows="2"
                    placeholder="Serial numbers, colors, conditions..."
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Item Images</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(guarantorSecurityImages[index] || []).map((file, fIdx) => (
                    <div key={fIdx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group/img">
                      <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveGuarantorSecurityFile(index, fIdx)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <XMarkIcon className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-[#586ab1] hover:text-[#586ab1] transition-all cursor-pointer">
                    <CameraIcon className="w-5 h-5 mb-1" />
                    <span className="text-[8px] font-bold">ADD</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleGuarantorSecurityFileUpload(e, index)}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return fields;
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

  const renderHistoricalImages = (sectionId) => {
    let images = [];
    if (sectionId === 'personal') {
      images = [
        { label: 'Passport Photo', url: formData.existingImages?.passport },
        { label: 'ID Front', url: formData.existingImages?.idFront },
        { label: 'ID Back', url: formData.existingImages?.idBack },
      ].filter(img => img.url);
    } else if (sectionId === 'business') {
      images = formData.existingImages?.business?.map((url, idx) => ({ label: `Business Shop ${idx + 1}`, url })) || [];
    } else if (sectionId === 'guarantor') {
      images = [
        { label: 'Guarantor Passport', url: formData.existingImages?.guarantorPassport },
        { label: 'Guarantor ID Front', url: formData.existingImages?.guarantorIdFront },
        { label: 'Guarantor ID Back', url: formData.existingImages?.guarantorIdBack },
      ].filter(img => img.url);
    }

    if (images.length === 0) return null;

    return (
      <div className="mt-8 pt-8 border-t border-slate-50">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <PhotoIcon className="w-3 h-3" /> Historical Visual Registry
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {images.map((img, idx) => (
            <div key={idx} className="group relative aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 hover:border-[#586ab1] transition-all cursor-zoom-in">
              <img src={img.url} alt={img.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[8px] font-black text-white uppercase tracking-widest">{img.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSecurityItems = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {formData.borrowerSecurity?.map((item, idx) => (
            <div key={idx} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">{item.item_name}</h4>
                <span className="px-2 py-0.5 bg-emerald-100 text-[9px] font-black text-emerald-600 rounded-full uppercase tracking-widest">Borrower Asset</span>
              </div>
              <p className="text-xs text-slate-500 font-medium italic">"{item.item_description}"</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {item.security_item_images?.map((img, i) => (
                  <img key={i} src={img.image_url} alt="Security" className="w-16 h-16 rounded-xl object-cover border border-white shadow-sm shrink-0" />
                ))}
              </div>
            </div>
          ))}
          {formData.guarantorSecurity?.map((item, idx) => (
            <div key={idx} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">{item.item_name}</h4>
                <span className="px-2 py-0.5 bg-amber-100 text-[9px] font-black text-amber-600 rounded-full uppercase tracking-widest">Guarantor Asset</span>
              </div>
              <p className="text-xs text-slate-500 font-medium italic">"{item.item_description}"</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {item.guarantor_security_images?.map((img, i) => (
                  <img key={i} src={img.image_url} alt="Security" className="w-16 h-16 rounded-xl object-cover border border-white shadow-sm shrink-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFieldVerification = () => {
    const docImages = [
      { label: 'House Image', url: formData.existingImages?.house },
      { label: 'Officer Client 1', url: formData.existingImages?.officerClient1 },
      { label: 'Officer Client 2', url: formData.existingImages?.officerClient2 },
      { label: 'Both Officers', url: formData.existingImages?.bothOfficers },
    ].filter(img => img.url);

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {docImages.map((img, idx) => (
            <div key={idx} className="group relative aspect-video bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
              <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{img.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formData.documents?.map((doc, idx) => (
            <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <DocumentTextIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">{doc.document_type || 'Field Document'}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-50 rounded-lg text-[#586ab1] transition-colors">
                <ArrowUpTrayIcon className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </div>
    );
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

  const allNavLinks = [
    ...sections,
    { id: 'collateral_history', label: 'Collateral', icon: ShieldCheckIcon },
    { id: 'field_verification', label: 'Verification', icon: DocumentIcon },
  ];

  return (
    <div className="space-y-4 px-4 md:px-6 pb-16">

      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search by ID, mobile or name..."
          className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#586ab1]/20 focus:border-[#586ab1] transition-all"
        />
        {searching && (
          <ArrowPathIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#586ab1] animate-spin" />
        )}

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-lg z-[100] overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
              <span className="text-[10px] text-[#586ab1] font-semibold">Click to select</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {searchResults.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#586ab1]/5 transition-all text-left border-b border-slate-50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                    {customer.Firstname?.[0]}{customer.Surname?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{`${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()}</p>
                    <p className="text-[10px] text-slate-400">ID: {customer.id_number} · {customer.mobile}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!selectedCustomer && (
        <>
          {/* Amendment Stream — on TOP when no customer selected */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Amendment Stream</h3>
                <p className="text-[10px] text-slate-400">Recent edit requests awaiting review or updated</p>
              </div>
              <span className="px-2 py-0.5 bg-[#586ab1]/10 rounded-full text-[9px] font-bold text-[#586ab1]">{editRequests.length}</span>
            </div>
            {editRequests.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ backgroundColor: '#E7F0FA' }} className="border-b border-slate-100">
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Section</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Requested By</th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {editRequests.map((request, idx) => (
                    <tr
                      key={request.id}
                      className={`hover:bg-gray-100/50 transition-all cursor-pointer group ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                      onClick={() => navigate(`/registry/customer-edits/review/${request.id}/other_details`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UserIcon className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="font-semibold text-slate-800 text-[11px]">
                            {request.customer?.Firstname} {request.customer?.Surname}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[10px] text-slate-500 font-medium capitalize">
                        {sections.find(s => s.id === request.section_type)?.label || request.section_type}
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(request.status)}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-[10px] text-slate-600 font-medium">
                          {new Date(request.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {new Date(request.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[10px] text-slate-500 font-medium">
                        {request.created_by_user?.full_name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          className="p-1.5 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all shadow-sm"
                          title="Review Request"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-10 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                No requests yet
              </div>
            )}
          </div>

          {/* Empty Selection State */}
          <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mx-auto mb-3 shadow-sm">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 mb-0.5">Search for a customer</h3>
            <p className="text-xs text-slate-400">Select a client to unlock the amendment interface</p>
          </div>
        </>
      )}

      {/* Section Nav — wraps naturally, no scroll */}
      {selectedCustomer && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {allNavLinks.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-[#586ab1] hover:border-[#586ab1]/30 transition-all shadow-sm"
            >
              <link.icon className="w-3 h-3 shrink-0" />
              {link.label}
            </a>
          ))}
        </div>
      )}

      {/* Selected Customer Banner */}
      {selectedCustomer && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#586ab1]/5 border border-[#586ab1]/20 rounded-xl shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#586ab1] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {selectedCustomer.Firstname?.[0]}{selectedCustomer.Surname?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{`${selectedCustomer.Firstname || ''} ${selectedCustomer.Middlename || ''} ${selectedCustomer.Surname || ''}`.trim()}</p>
            <p className="text-[10px] text-slate-400">ID: {selectedCustomer.id_number} · {selectedCustomer.mobile}</p>
          </div>
          <button
            onClick={() => { setSelectedCustomer(null); setSearchTerm(''); setSecurityItems([]); setGuarantorSecurityItems([]); }}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Forms — shown only when customer selected */}
      {selectedCustomer && (
        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.id} id={section.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-4 shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <section.icon className="w-4 h-4 text-[#586ab1] shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-slate-800">{section.label}</h2>
                  <p className="text-[10px] text-slate-400">Propose changes — requires Branch Manager approval</p>
                </div>
              </div>
              <div className="p-5 space-y-5">
                <form onSubmit={(e) => handleSubmit(e, section.id)} className="space-y-5">
                  {renderFormFields(section.id)}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <p className="text-[10px] text-amber-500 font-semibold">Requires BM validation before commit</p>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-[#586ab1] text-white rounded-lg font-semibold text-xs shadow-sm hover:bg-[#4a5997] transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
                    >
                      {loading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheckIcon className="w-3.5 h-3.5" />}
                      Submit Change Request
                    </button>
                  </div>
                </form>
                {renderHistoricalImages(section.id)}
              </div>
            </div>
          ))}

          {/* Borrower Security */}
          <div id="security" className="bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-4 shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <ShieldCheckIcon className="w-4 h-4 text-[#586ab1] shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Security & Collateral</h2>
                <p className="text-[10px] text-slate-400">Borrower security items</p>
              </div>
            </div>
            <div className="p-5">
              <form onSubmit={(e) => handleSubmit(e, 'security')} className="space-y-5">
                {renderFormFields('security')}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <p className="text-[10px] text-amber-500 font-semibold">Requires BM validation before commit</p>
                  <button type="submit" disabled={loading} className="px-5 py-2 bg-[#586ab1] text-white rounded-lg font-semibold text-xs shadow-sm hover:bg-[#4a5997] transition-all disabled:opacity-50 flex items-center gap-2 shrink-0">
                    {loading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheckIcon className="w-3.5 h-3.5" />}
                    Submit Change Request
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Guarantor Security */}
          <div id="guarantor_security" className="bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-4 shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <ShieldCheckIcon className="w-4 h-4 text-[#586ab1] shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Guarantor Security</h2>
                <p className="text-[10px] text-slate-400">Guarantor security items</p>
              </div>
            </div>
            <div className="p-5">
              <form onSubmit={(e) => handleSubmit(e, 'guarantor_security')} className="space-y-5">
                {renderFormFields('guarantor_security')}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <p className="text-[10px] text-amber-500 font-semibold">Requires BM validation before commit</p>
                  <button type="submit" disabled={loading} className="px-5 py-2 bg-[#586ab1] text-white rounded-lg font-semibold text-xs shadow-sm hover:bg-[#4a5997] transition-all disabled:opacity-50 flex items-center gap-2 shrink-0">
                    {loading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheckIcon className="w-3.5 h-3.5" />}
                    Submit Change Request
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Collateral History */}
          <div id="collateral_history" className="bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-4 shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <ShieldCheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Collateral History</h2>
                <p className="text-[10px] text-slate-400">Existing security registry</p>
              </div>
            </div>
            <div className="p-5">{renderSecurityItems()}</div>
          </div>

          {/* Field Verification */}
          <div id="field_verification" className="bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-4 shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <DocumentIcon className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Field Verification</h2>
                <p className="text-[10px] text-slate-400">Meeting documents and verification media</p>
              </div>
            </div>
            <div className="p-5">{renderFieldVerification()}</div>
          </div>

          {/* Amendment Stream — moves to BOTTOM when customer selected */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Amendment Stream</h3>
                <p className="text-[10px] text-slate-400">Edit requests for this customer</p>
              </div>
              <span className="px-2 py-0.5 bg-[#586ab1]/10 rounded-full text-[9px] font-bold text-[#586ab1]">{editRequests.length}</span>
            </div>
            {editRequests.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ backgroundColor: '#E7F0FA' }} className="border-b border-slate-100">
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Section</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Requested By</th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {editRequests.map((request, idx) => (
                    <tr
                      key={request.id}
                      className={`hover:bg-gray-100/50 transition-all cursor-pointer group ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                      onClick={() => navigate(`/registry/customer-edits/review/${request.id}/other_details`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UserIcon className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="font-semibold text-slate-800 text-[11px]">
                            {request.customer?.Firstname} {request.customer?.Surname}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[10px] text-slate-500 font-medium capitalize">
                        {sections.find(s => s.id === request.section_type)?.label || request.section_type}
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(request.status)}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-[10px] text-slate-600 font-medium">
                          {new Date(request.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {new Date(request.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[10px] text-slate-500 font-medium">
                        {request.created_by_user?.full_name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          className="p-1.5 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all shadow-sm"
                          title="Review Request"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-10 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                No requests currently pending
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetailsEdit;
