import { useState, memo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  UserCircleIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  IdentificationIcon,
  DocumentTextIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
  CameraIcon,
  XMarkIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

import { supabase } from "../../supabaseClient";
import { useToast } from "../../components/Toast";
import { checkUniqueValue } from "../../utils/Unique";
import { useAuth } from "../../hooks/userAuth";
import { useTenantFeatures } from "../../hooks/useTenantFeatures";
import LocationPicker from "../../relationship-officer/components/LocationPicker";
import imageCompression from "browser-image-compression";

import Form, { INDUSTRIES } from "../../relationship-officer/components/Form";

const EditCustomerPage = () => {
  const { customerId } = useParams();
  const [activeSection, setActiveSection] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const [formData, setFormData] = useState({
    prefix: '',
    Firstname: '',
    Surname: '',
    Middlename: '',
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
    businessCounty: '',
    businessName: '',
    industry: '',
    businessType: '',
    daily_Sales: '',
    yearEstablished: '',
    businessLocation: '',
    businessCoordinates: null,
    road: '',
    landmark: '',
    hasLocalAuthorityLicense: '',
    prequalifiedAmount: '',
    spouse: {
      name: '',
      idNumber: '',
      mobile: '',
      economicActivity: ''
    },
    nextOfKins: [{
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
      relationshipOther: ''
    }],
    guarantors: [{
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
      cityTown: ''
    }]
  });

  const [isCustomIndustry, setIsCustomIndustry] = useState(false);
  const [isCustomType, setIsCustomType] = useState(false);

  const [securityItems, setSecurityItems] = useState([{
    type: '',
    description: '',
    value: '',
    otherType: '',
    identification: ''
  }]);

  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([{
    type: '',
    description: '',
    identification: '',
    value: '',
    otherType: ''
  }]);

  const { profile } = useAuth();
  const { documentUploadEnabled, imageUploadEnabled } = useTenantFeatures();

  const [passportFile, setPassportFile] = useState(null);
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [houseImageFile, setHouseImageFile] = useState(null);
  const [businessImages, setBusinessImages] = useState([]);
  const [securityItemImages, setSecurityItemImages] = useState([]);

  const [guarantorPassportFiles, setGuarantorPassportFiles] = useState([null]);
  const [guarantorIdFrontFiles, setGuarantorIdFrontFiles] = useState([null]);
  const [guarantorIdBackFiles, setGuarantorIdBackFiles] = useState([null]);
  const [guarantorSecurityImages, setGuarantorSecurityImages] = useState([[]]);

  const [officerClientImage1, setOfficerClientImage1] = useState(null);
  const [officerClientImage2, setOfficerClientImage2] = useState(null);
  const [bothOfficersImage, setBothOfficersImage] = useState(null);
  const [previews, setPreviews] = useState({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState(new Set());

  const [existingImages, setExistingImages] = useState({
    passport: null,
    idFront: null,
    idBack: null,
    house: null,
    business: [],
    security: [],
    officerClient1: null,
    officerClient2: null,
    bothOfficers: null
  });

  const [removedExistingImages, setRemovedExistingImages] = useState(new Set());
  const [completedSections, setCompletedSections] = useState(new Set());

  const fetchCustomerData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const { data: customer, error: customerErr } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerErr) throw customerErr;

      const { data: guarantorsData, error: gErr } = await supabase
        .from("guarantors")
        .select("*")
        .eq("customer_id", customerId);

      if (gErr) throw gErr;

      const [
        { data: nextOfKinData },
        { data: securityItemsData },
        { data: businessImagesData },
        { data: documentsData },
        { data: spouseArr },
        { data: guarantorSecurityData },
      ] = await Promise.all([
        supabase.from("next_of_kin").select("*").eq("customer_id", customerId),
        supabase.from("security_items").select("*, security_item_images(id, image_url)").eq("customer_id", customerId),
        supabase.from("business_images").select("*").eq("customer_id", customerId),
        supabase.from("documents").select("*").eq("customer_id", customerId),
        supabase.from("spouse").select("*").eq("customer_id", customerId),
        supabase.from("guarantor_security").select("*, guarantor_security_images(id, image_url)").in("guarantor_id", guarantorsData?.map(g => g.id) || []),
      ]);

      const spouseData = spouseArr?.[0] || null;

      setFormData({
        id: customer.id,
        prefix: customer.prefix || "",
        Firstname: customer.Firstname || "",
        Surname: customer.Surname || "",
        Middlename: customer.Middlename || "",
        maritalStatus: customer.marital_status ? customer.marital_status.trim() : "",
        residenceStatus: customer.residence_status || "",
        mobile: customer.mobile || "",
        alternativeMobile: customer.alternative_mobile || "",
        occupation: customer.occupation || "",
        dateOfBirth: customer.date_of_birth || "",
        gender: customer.gender || "",
        idNumber: customer.id_number || "",
        postalAddress: customer.postal_address || "",
        code: customer.code || "",
        town: customer.town || "",
        county: customer.county || "",
        businessCounty: customer.business_county || "",
        businessName: customer.business_name || "",
        industry: customer.industry || "",
        businessType: customer.business_type || "",
        daily_Sales: customer.daily_Sales || "",
        yearEstablished: customer.year_established || "",
        businessLocation: customer.business_location || "",
        businessCoordinates: customer.business_lat && customer.business_lng ? {
          lat: customer.business_lat,
          lng: customer.business_lng
        } : null,
        road: customer.road || "",
        landmark: customer.landmark || "",
        hasLocalAuthorityLicense: customer.has_local_authority_license ? "Yes" : "No",
        prequalifiedAmount: customer.prequalified_amount || customer.prequalifiedAmount || "",
        spouse: {
          name: spouseData?.name || "",
          idNumber: spouseData?.id_number || "",
          mobile: spouseData?.mobile || "",
          economicActivity: spouseData?.economic_activity || "",
        },
        nextOfKins: nextOfKinData?.map(nk => ({
          Firstname: nk.Firstname || "",
          Surname: nk.Surname || "",
          Middlename: nk.Middlename || "",
          idNumber: nk.id_number || "",
          relationship: nk.relationship || "",
          mobile: nk.mobile || "",
          alternativeNumber: nk.alternative_number || "",
          employmentStatus: nk.employment_status || "",
          county: nk.county || "",
          cityTown: nk.city_town || "",
          companyName: nk.company_name || "",
          salary: nk.salary || "",
          businessName: nk.business_name || "",
          businessIncome: nk.business_income || "",
          relationshipOther: nk.relationship_other || ""
        })) || [{ Firstname: "" }],
        guarantors: guarantorsData?.map(g => ({
          prefix: g.prefix || "",
          Firstname: g.Firstname || "",
          Surname: g.Surname || "",
          Middlename: g.Middlename || "",
          idNumber: g.id_number || "",
          maritalStatus: g.marital_status || "",
          gender: g.gender || "",
          mobile: g.mobile || "",
          alternativeMobile: g.alternative_mobile || "",
          residenceStatus: g.residence_status || "",
          postalAddress: g.postal_address || "",
          code: g.code || "",
          occupation: g.occupation || "",
          relationship: g.relationship || "",
          dateOfBirth: g.date_of_birth || "",
          county: g.county || "",
          cityTown: g.city_town || ""
        })) || [{ Firstname: "" }]
      });

      if (securityItemsData?.length > 0) {
        const borrowerPredefined = [
          "Household Items", "Business Equipment", "Livestock", "Motor Vehicle",
          "Motorbike", "Land / Property", "Title deed", "Logbook",
          "Salary Check-off", "Stock / Inventory", "Fixed deposit / Savings security", "Electronics"
        ];

        setSecurityItems(securityItemsData.map(item => {
          const typeVal = item.item || item.type || "";
          const isCustom = typeVal && !borrowerPredefined.includes(typeVal);
          return {
            type: isCustom ? "Other" : typeVal,
            description: item.description || "",
            value: item.value || "",
            identification: item.identification || "",
            otherType: isCustom ? typeVal : ""
          };
        }));
      }

      const gPass = guarantorsData?.map(g => g.passport_url) || [null];
      const gIdF = guarantorsData?.map(g => g.id_front_url) || [null];
      const gIdB = guarantorsData?.map(g => g.id_back_url) || [null];

      setGuarantorPassportFiles(gPass.map(() => null));
      setGuarantorIdFrontFiles(gIdF.map(() => null));
      setGuarantorIdBackFiles(gIdB.map(() => null));

      setExistingImages({
        passport: customer.passport_url,
        idFront: customer.id_front_url,
        idBack: customer.id_back_url,
        houseImage: customer.house_image_url,
        business: businessImagesData?.map(img => img.image_url) || [],
        security: securityItemsData?.map(item => item.security_item_images?.map(img => img.image_url)) || [],
        guarantorSecurity: guarantorSecurityData?.map(item => item.guarantor_security_images?.map(img => img.image_url)) || [],
        guarantorPassport: gPass,
        guarantorIdFront: gIdF,
        guarantorIdBack: gIdB,
        officerClient1: documentsData?.find(d => d.document_type === "First Officer and Client Image")?.document_url,
        officerClient2: documentsData?.find(d => d.document_type === "Second Officer and Client Image")?.document_url,
        bothOfficers: documentsData?.find(d => d.document_type === "Both Officers Image")?.document_url,
      });

      if (guarantorSecurityData?.length > 0) {
        const guarantorPredefined = [
          "Household Items", "Business Equipment", "Livestock", "Motor Vehicle",
          "Motorbike", "Land / Property", "Title deed", "Logbook",
          "Salary Check-off", "Stock / Inventory", "Fixed deposit / Savings security", "Electronics"
        ];

        setGuarantorSecurityItems(guarantorSecurityData.map(item => {
          const typeVal = item.item || item.type || "";
          const isCustom = typeVal && !guarantorPredefined.includes(typeVal);
          return {
            type: isCustom ? "Other (specify)" : typeVal,
            description: item.description || "",
            value: item.estimated_market_value || item.value || "",
            identification: item.identification || "",
            otherType: isCustom ? typeVal : ""
          };
        }));
      }

      // Robust "Other" detection for Industry and Business Type
      const industryVal = customer.industry || "";
      const businessTypeVal = customer.business_type || "";
      
      if (industryVal) {
        if (!INDUSTRIES[industryVal]) {
          setIsCustomIndustry(true);
        } else {
          setIsCustomIndustry(false);
          if (businessTypeVal && !INDUSTRIES[industryVal].includes(businessTypeVal)) {
            setIsCustomType(true);
          } else {
            setIsCustomType(false);
          }
        }
      }

    } catch (err) {
      console.error("Error fetching customer data:", err);
      toast.error("Failed to load customer record");
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const sections = [
    { id: "personal", label: "Personal Info", icon: UserCircleIcon },
    { id: "business", label: "Business Info", icon: BuildingOffice2Icon },
    { id: "borrowerSecurity", label: "Borrower Security", icon: ShieldCheckIcon },
    { id: "loan", label: "Loan Details", icon: CurrencyDollarIcon },
    { id: "guarantor", label: "Guarantor", icon: UserGroupIcon },
    { id: "guarantorSecurity", label: "Guarantor Security", icon: ShieldCheckIcon },
    { id: "nextOfKin", label: "Next of Kin", icon: UserGroupIcon },
    ...(documentUploadEnabled ? [{ id: "documents", label: "Documents", icon: DocumentTextIcon }] : []),
  ];

  useEffect(() => {
    const { businessCounty, businessLocation, landmark, road } = formData;
    if (!businessCounty || (!businessLocation?.trim() && !landmark?.trim() && !road?.trim())) return;

    const addressParts = [landmark, road, businessLocation, businessCounty, "Kenya"]
      .filter(part => part && part.trim() !== "");
    const fullAddress = addressParts.join(", ");

    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&addressdetails=1&limit=1&countrycodes=ke&email=admin@jasiri.co.ke`;
        const response = await fetch(url, { headers: { "Accept-Language": "en-US,en;q=0.9" } });
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.length > 0) {
          setFormData((prev) => ({
            ...prev,
            businessCoordinates: { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) },
          }));
        }
      } catch (err) {
        console.error("Failed to geocode location", err);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData.businessCounty, formData.businessLocation, formData.landmark, formData.road]);

  const handleChange = useCallback(async (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "county") newData.town = "";
      if (name === "industry") {
        newData.businessType = "";
        if (value === "Other") {
          setIsCustomIndustry(true);
          newData.industry = ""; // Clear for custom input
        } else if (Object.keys(INDUSTRIES || {}).includes(value)) {
          setIsCustomIndustry(false);
        }
      }
      if (name === "businessType") {
        if (value === "Other") {
          setIsCustomType(true);
          newData.businessType = ""; // Clear for custom input
        } else {
          const currentIndusty = newData.industry || prev.industry;
          const industryTypes = INDUSTRIES[currentIndusty] || [];
          if (industryTypes.includes(value)) {
            setIsCustomType(false);
          }
        }
      }
      return newData;
    });

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }

    if (name === "dateOfBirth" && value) {
      if (!isAtLeast18YearsOld(value)) {
        setErrors((prev) => ({ ...prev, dateOfBirth: "Customer must be at least 18 years old" }));
      }
    }

    if (name === "mobile" && value) {
      const cleaned = value.replace(/\D/g, "");
      if (!/^[0-9]{10,15}$/.test(cleaned)) {
        setErrors((prev) => ({ ...prev, mobile: "Invalid mobile format (10-15 digits)" }));
      } else {
        const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", cleaned, profile?.tenant_id, customerId);
        if (!exists) {
          setErrors((prev) => ({ ...prev, mobile: "Mobile number already exists" }));
        }
      }
    }

    if (name === "alternativeMobile" && value) {
      const cleaned = value.replace(/\D/g, "");
      if (!/^[0-9]{10,15}$/.test(cleaned)) {
        setErrors((prev) => ({ ...prev, alternativeMobile: "Invalid alternative mobile format (10-15 digits)" }));
      } else {
        const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", cleaned, profile?.tenant_id, customerId);
        if (!exists) {
          setErrors((prev) => ({ ...prev, alternativeMobile: "Alternative mobile already exists" }));
        }
      }
    }

    if (name === "yearEstablished" && value) {
      const establishedDate = new Date(value);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      if (establishedDate > sixMonthsAgo) {
        setErrors((prev) => ({ ...prev, yearEstablished: "Business must be at least 6 months old" }));
      } else if (errors.yearEstablished) {
        setErrors((prev) => ({ ...prev, yearEstablished: null }));
      }
    }

    if (name === "prequalifiedAmount") {
      const totalSecurity = securityItems.reduce((acc, item) => acc + Number(item.value || 0), 0);
      const maxPrequalified = totalSecurity / 3;
      if (Number(value) > maxPrequalified) {
        setFormData((prev) => ({ ...prev, prequalifiedAmount: "" }));
        setErrors((prev) => ({ ...prev, prequalifiedAmount: `Cannot exceed one-third of total security (${maxPrequalified})` }));
      } else {
        setErrors((prev) => ({ ...prev, prequalifiedAmount: null }));
        setFormData((prev) => ({ ...prev, prequalifiedAmount: value }));
      }
    }

    if (name === "idNumber" && value) {
      if (!/^[0-9]{6,12}$/.test(value)) {
        setErrors((prev) => ({ ...prev, idNumber: "ID must be 6–12 digits" }));
      } else {
        const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", value, profile?.tenant_id, customerId);
        if (!exists) {
          setErrors((prev) => ({ ...prev, idNumber: "ID number already exists" }));
        }
      }
    }
  }, [errors, securityItems]);

  const handleNestedChange = useCallback(async (e, section, index = null) => {
    if (!e || !e.target) return;
    const { name, value } = e.target;

    setFormData((prev) => {
      if (index !== null && Array.isArray(prev[section])) {
        const newList = [...prev[section]];
        newList[index] = { ...newList[index], [name]: value };
        if (name === "county") {
          newList[index].cityTown = "";
          newList[index].town = "";
        }
        return { ...prev, [section]: newList };
      }
      return { ...prev, [section]: { ...prev[section], [name]: value } };
    });

    const errorKey = index !== null ? `${section}_${index}_${name}` : `${section}${name.charAt(0).toUpperCase() + name.slice(1)}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }

    if (["guarantors", "nextOfKins"].includes(section) && index !== null) {
      if ((name === "mobile" || name === "alternativeMobile" || name === "alternativeNumber") && value) {
        const cleaned = value.replace(/\D/g, "");
        if (!/^[0-9]{10,15}$/.test(cleaned)) {
          setErrors(prev => ({ ...prev, [errorKey]: "Invalid mobile format (10-15 digits)" }));
        } else {
          const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", cleaned, profile?.tenant_id, customerId);
          if (!exists) {
            setErrors(prev => ({ ...prev, [errorKey]: "Mobile number already exists" }));
          }
        }
      }
      if ((name === "idNumber" || name === "id_no") && value) {
        if (!/^[0-9]{6,12}$/.test(value)) {
          setErrors(prev => ({ ...prev, [errorKey]: "ID must be 6–12 digits" }));
        } else {
          const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", value, profile?.tenant_id, customerId);
          if (!exists) {
            setErrors(prev => ({ ...prev, [errorKey]: "ID number already exists" }));
          }
        }
      }
      if (section === "guarantors" && name === "dateOfBirth" && value) {
        if (!isAtLeast18YearsOld(value)) {
          setErrors(prev => ({ ...prev, [errorKey]: "Guarantor must be at least 18 years old" }));
        }
      }
    }

    if (section === "spouse") {
      if (name === "idNumber" && value) {
        if (!/^[0-9]{6,12}$/.test(value)) {
          setErrors((prev) => ({ ...prev, spouseIdNumber: "Spouse ID must be 6–12 digits" }));
        } else {
          const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", value, profile?.tenant_id, customerId);
          if (!exists) {
            setErrors((prev) => ({ ...prev, spouseIdNumber: "Spouse ID number already exists" }));
          }
        }
      }
      if (name === "mobile" && value) {
        const cleaned = value.replace(/\D/g, "");
        if (!/^[0-9]{10,15}$/.test(cleaned)) {
          setErrors((prev) => ({ ...prev, spouseMobile: "Invalid spouse mobile format (10-15 digits)" }));
        } else {
          const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", cleaned, profile?.tenant_id, customerId);
          if (!exists) {
            setErrors((prev) => ({ ...prev, spouseMobile: "Spouse mobile number already exists" }));
          }
        }
      }
    }
  }, [errors]);

  const handleLocationChange = useCallback((coords) => {
    setFormData((prev) => ({ ...prev, businessCoordinates: coords }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.businessCoordinates;
      return newErrors;
    });
  }, []);

  const isAtLeast18YearsOld = (dateString) => {
    if (!dateString) return true;
    const birthDate = new Date(dateString);
    const today = new Date();
    const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    return birthDate <= eighteenYearsAgo;
  };

  const addGuarantor = () => {
    if (formData.guarantors.length >= 3) { toast.error("Maximum 3 guarantors allowed"); return; }
    setFormData((prev) => ({
      ...prev,
      guarantors: [...prev.guarantors, {
        prefix: '', Firstname: '', Surname: '', Middlename: '', idNumber: '',
        maritalStatus: '', gender: '', mobile: '', alternativeMobile: '',
        residenceStatus: '', postalAddress: '', code: '', occupation: '',
        relationship: '', dateOfBirth: '', county: '', cityTown: ''
      }]
    }));
    setGuarantorPassportFiles(prev => [...prev, null]);
    setGuarantorIdFrontFiles(prev => [...prev, null]);
    setGuarantorIdBackFiles(prev => [...prev, null]);
    setGuarantorSecurityImages(prev => [...prev, []]);
  };

  const removeGuarantor = (index) => {
    if (formData.guarantors.length <= 1) return;
    setFormData((prev) => ({ ...prev, guarantors: prev.guarantors.filter((_, i) => i !== index) }));
    setGuarantorPassportFiles(prev => prev.filter((_, i) => i !== index));
    setGuarantorIdFrontFiles(prev => prev.filter((_, i) => i !== index));
    setGuarantorIdBackFiles(prev => prev.filter((_, i) => i !== index));
    setGuarantorSecurityImages(prev => prev.filter((_, i) => i !== index));
  };

  const addNextOfKin = () => {
    if (formData.nextOfKins.length >= 3) { toast.error("Maximum 3 Next of Kin allowed"); return; }
    setFormData((prev) => ({
      ...prev,
      nextOfKins: [...prev.nextOfKins, {
        Firstname: '', Surname: '', Middlename: '', idNumber: '', relationship: '',
        mobile: '', alternativeNumber: '', employmentStatus: '', county: '',
        cityTown: '', companyName: '', salary: '', businessName: '',
        businessIncome: '', relationshipOther: ''
      }]
    }));
  };

  const removeNextOfKin = (index) => {
    if (formData.nextOfKins.length <= 1) return;
    setFormData((prev) => ({ ...prev, nextOfKins: prev.nextOfKins.filter((_, i) => i !== index) }));
  };

  const addSecurityItem = () => {
    setSecurityItems(prev => [...prev, { type: '', description: '', value: '', identification: '', otherType: '' }]);
    setSecurityItemImages(prev => [...prev, []]);
  };

  const removeSecurityItem = (index) => {
    setSecurityItems((prev) => prev.filter((_, i) => i !== index));
    setSecurityItemImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addGuarantorSecurityItem = () => {
    setGuarantorSecurityItems((prev) => [...prev, { type: '', description: '', value: '', otherType: '' }]);
    setGuarantorSecurityImages(prev => [...prev, []]);
  };

  const removeGuarantorSecurityItem = (index) => {
    setGuarantorSecurityItems((prev) => prev.filter((_, i) => i !== index));
    setGuarantorSecurityImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSecurityChange = (e, index) => {
    const { name, value } = e.target;
    setSecurityItems(prev => prev.map((item, i) => i === index ? { ...item, [name]: value } : item));
  };

  const handleGuarantorSecurityChange = (e, index) => {
    const { name, value } = e.target;
    setGuarantorSecurityItems(prev =>
      prev.map((item, i) => {
        if (i === index) {
          const newItem = { ...item, [name]: value };
          if (name === "type" && value !== "Other (specify)") {
            newItem.otherType = "";
          }
          return newItem;
        }
        return item;
      })
    );
  };

  const handleFileUpload = async (e, setter, key) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;
    if (uploadedFiles.has(file.name)) { toast.error("This file has already been uploaded elsewhere in the form."); return; }
    try {
      const compressedFile = await compressImage(file);
      setter(compressedFile);
      setPreviews((prev) => ({ ...prev, [key]: { url: URL.createObjectURL(compressedFile), fileName: file.name } }));
      setUploadedFiles((prev) => new Set(prev).add(file.name));
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error during file selection.");
    }
  };

  const handleRemoveFile = (key, setter) => {
    const file = previews[key]?.fileName;
    if (file && uploadedFiles.has(file)) {
      setUploadedFiles((prev) => { const s = new Set(prev); s.delete(file); return s; });
    }
    setter(null);
    setPreviews((prev) => {
      const p = { ...prev };
      if (p[key]?.url) { try { URL.revokeObjectURL(p[key].url); } catch (_) {} }
      delete p[key];
      return p;
    });
  };

  const handleRemoveExistingImage = (key, index = null) => {
    if (index !== null && Array.isArray(existingImages[key])) {
      setExistingImages(prev => {
        const arr = [...prev[key]];
        const url = arr[index];
        if (url) setRemovedExistingImages(s => new Set(s).add(url));
        arr[index] = null;
        return { ...prev, [key]: arr };
      });
    } else {
      setExistingImages(prev => {
        const url = prev[key];
        if (url) setRemovedExistingImages(s => new Set(s).add(url));
        return { ...prev, [key]: null };
      });
    }
  };

  const handleMultipleFiles = async (e, index, setter) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(f => {
      if (uploadedFiles.has(f.name)) { toast.error(`${f.name} has already been uploaded elsewhere.`); return false; }
      return true;
    });
    if (validFiles.length === 0) return;

    // Reset input immediately
    e.target.value = null;

    try {
      // Compress in parallel
      const compressedFiles = await Promise.all(validFiles.map(f => compressImage(f)));

      setUploadedFiles(prev => { const s = new Set(prev); validFiles.forEach(f => s.add(f.name)); return s; });
      setter(prev => {
        const updated = [...prev];
        updated[index] = [...(updated[index] || []), ...compressedFiles];
        return updated;
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to process some images.");
    }
  };

  const handleRemoveMultipleFile = (sectionIndex, fileIndex, setter) => {
    setter(prev => {
      const updated = [...prev];
      const file = updated[sectionIndex]?.[fileIndex];
      if (file) setUploadedFiles(p => { const s = new Set(p); s.delete(file.name); return s; });
      if (updated[sectionIndex]) updated[sectionIndex] = updated[sectionIndex].filter((_, i) => i !== fileIndex);
      return updated;
    });
  };

  const handleBusinessImages = async (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(f => !uploadedFiles.has(f.name));
    if (validFiles.length !== files.length) toast.error("Some files have already been uploaded elsewhere.");
    if (validFiles.length === 0) return;

    // Reset input immediately
    e.target.value = null;

    try {
      // Compress in parallel
      const compressedFiles = await Promise.all(validFiles.map(f => compressImage(f)));

      setUploadedFiles(prev => { const s = new Set(prev); validFiles.forEach(f => s.add(f.name)); return s; });
      setBusinessImages(prev => [...prev, ...compressedFiles]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to process business images.");
    }
  };

  const handleRemoveBusinessImage = (index) => {
    const file = businessImages[index];
    setUploadedFiles(prev => { const s = new Set(prev); s.delete(file.name); return s; });
    setBusinessImages(prev => prev.filter((_, i) => i !== index));
  };

  const validatePersonalDetails = async () => {
    const newErrors = {};
    let hasErrors = false;

    if (!formData.Firstname?.toString().trim()) { newErrors.Firstname = "First name is required"; toast.error("First name is required"); hasErrors = true; }
    if (!formData.Surname?.toString().trim()) { newErrors.Surname = "Surname is required"; toast.error("Surname is required"); hasErrors = true; }
    if (!formData.mobile?.toString().trim()) { newErrors.mobile = "Mobile number is required"; toast.error("Mobile number is required"); hasErrors = true; }
    if (!formData.idNumber?.toString().trim()) { newErrors.idNumber = "ID number is required"; toast.error("ID number is required"); hasErrors = true; }
    if (formData.mobile && !/^[0-9]{10,15}$/.test(formData.mobile.toString().replace(/\D/g, ""))) { newErrors.mobile = "Please enter a valid mobile number (10-15 digits)"; toast.error("Invalid mobile number format"); hasErrors = true; }
    if (formData.alternativeMobile && !/^[0-9]{10,15}$/.test(formData.alternativeMobile.toString().replace(/\D/g, ""))) { newErrors.alternativeMobile = "Please enter a valid alternative mobile number (10-15 digits)"; toast.error("Invalid alternative mobile number format"); hasErrors = true; }
    if (formData.idNumber && !/^[0-9]{6,12}$/.test(formData.idNumber.toString())) { newErrors.idNumber = "Please enter a valid ID number (6-12 digits)"; toast.error("Invalid ID number format"); hasErrors = true; }
    if (formData.dateOfBirth && !isAtLeast18YearsOld(formData.dateOfBirth)) { newErrors.dateOfBirth = "Customer must be at least 18 years old"; toast.error("Customer must be at least 18 years old"); hasErrors = true; }

    if (formData.maritalStatus === "Married") {
      if (!formData.spouse.name?.toString().trim()) { newErrors.spouseName = "Spouse name is required"; toast.error("Spouse name is required"); hasErrors = true; }
      if (!formData.spouse.idNumber?.toString().trim()) { newErrors.spouseIdNumber = "Spouse ID number is required"; toast.error("Spouse ID number is required"); hasErrors = true; }
      if (!formData.spouse.mobile?.toString().trim()) { newErrors.spouseMobile = "Spouse mobile number is required"; toast.error("Spouse mobile number is required"); hasErrors = true; }
      if (!formData.spouse.economicActivity?.toString().trim()) { newErrors.spouseEconomicActivity = "Spouse economic activity is required"; toast.error("Spouse economic activity is required"); hasErrors = true; }
      if (formData.spouse.idNumber && !/^[0-9]{6,12}$/.test(formData.spouse.idNumber.toString())) { newErrors.spouseIdNumber = "Please enter a valid spouse ID number (6-12 digits)"; toast.error("Invalid spouse ID number format"); hasErrors = true; }
      if (formData.spouse.mobile && !/^[0-9]{10,15}$/.test(formData.spouse.mobile.toString().replace(/\D/g, ""))) { newErrors.spouseMobile = "Please enter a valid spouse mobile number (10-15 digits)"; toast.error("Invalid spouse mobile number format"); hasErrors = true; }
    }

    const fieldsToCheck = [
      { field: "mobile", value: formData.mobile, label: "Mobile number" },
      { field: "alternativeMobile", value: formData.alternativeMobile, label: "Alternative mobile" },
      { field: "idNumber", value: formData.idNumber, label: "ID number" },
    ];

    if (formData.maritalStatus === "Married" && formData.spouse?.idNumber) {
      fieldsToCheck.push({ field: "spouseIdNumber", value: formData.spouse.idNumber, label: "Spouse ID number" });
    }

    const uniqueChecks = fieldsToCheck
      .filter(({ value, field }) => value && !newErrors[field])
      .map(async ({ field, value, label }) => {
        try {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], (field === "idNumber" || field === "spouseIdNumber") ? "id_number" : "mobile", value, profile?.tenant_id, formData.id);
          if (!isUnique) return { field, error: `${label} already exists in our system` };
        } catch (err) {
          return { field, error: `Error validating ${label}` };
        }
        return null;
      });

    const results = await Promise.all(uniqueChecks);
    results.filter(Boolean).forEach(({ field, error }) => { newErrors[field] = error; toast.error(error); hasErrors = true; });
    setErrors(newErrors);
    return !hasErrors;
  };

  const validateBusinessDetails = () => {
    let errorsFound = {};
    let hasErrors = false;
    if (!formData.businessName?.toString().trim()) { errorsFound.businessName = "Business name is required"; toast.error("Business name is required"); hasErrors = true; }
    if (!formData.businessType?.toString().trim()) { errorsFound.businessType = "Business type is required"; toast.error("Business type is required"); hasErrors = true; }
    if (!formData.yearEstablished) { errorsFound.yearEstablished = "Year established is required"; toast.error("Year established is required"); hasErrors = true; }
    else {
      const est = new Date(formData.yearEstablished);
      const sixMo = new Date(); sixMo.setMonth(sixMo.getMonth() - 6);
      if (est > sixMo) { errorsFound.yearEstablished = "Business must be at least 6 months old"; toast.error("Business must be at least 6 months old"); hasErrors = true; }
    }
    if (!formData.businessLocation?.toString().trim()) { errorsFound.businessLocation = "Business location is required"; toast.error("Business location is required"); hasErrors = true; }
    if (!formData.road?.toString().trim()) { errorsFound.road = "Road is required"; toast.error("Road is required"); hasErrors = true; }
    if (!formData.landmark?.toString().trim()) { errorsFound.landmark = "Landmark is required"; toast.error("Landmark is required"); hasErrors = true; }
    if (!formData.daily_Sales) { errorsFound.daily_Sales = "Daily sales estimate is required"; toast.error("Daily sales estimate is required"); hasErrors = true; }
    else if (parseFloat(formData.daily_Sales) <= 0) { errorsFound.daily_Sales = "Daily sales must be greater than 0"; toast.error("Daily sales must be greater than 0"); hasErrors = true; }
    if (!formData.businessCoordinates?.lat || !formData.businessCoordinates?.lng) { errorsFound.businessCoordinates = "Business GPS coordinates are required"; toast.error("Please set business GPS location"); hasErrors = true; }
    setErrors(errorsFound);
    return !hasErrors;
  };

  const validateBorrowerSecurity = () => {
    const errorsFound = {};
    let hasErrors = false;
    if (securityItems.length === 0) { errorsFound.securityItems = "At least one security item is required"; toast.error("At least one security item is required"); hasErrors = true; }
    securityItems.forEach((item, index) => {
      if (!item.description?.toString().trim()) { errorsFound[`security_description_${index}`] = "Description is required"; toast.error(`Security Item ${index + 1}: Description is required`); hasErrors = true; }
      if (!item.value || parseFloat(item.value) <= 0) { errorsFound[`security_value_${index}`] = "Estimated value must be greater than 0"; toast.error(`Security Item ${index + 1}: Value must be greater than 0`); hasErrors = true; }
    });
    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateLoanDetails = () => {
    const errorsFound = {};
    let hasErrors = false;
    if (!formData.prequalifiedAmount) { errorsFound.prequalifiedAmount = "Pre-qualified amount is required"; toast.error("Pre-qualified amount is required"); hasErrors = true; }
    else if (parseFloat(formData.prequalifiedAmount) <= 0) { errorsFound.prequalifiedAmount = "Loan amount must be greater than 0"; toast.error("Loan amount must be greater than 0"); hasErrors = true; }
    setErrors(errorsFound);
    return !hasErrors;
  };

  const validateGuarantorDetails = async () => {
    const newErrors = {};
    let hasOverallErrors = false;
    const validationPromises = formData.guarantors.map(async (g, index) => {
      let hasLocalErrors = false;
      if (!g.Firstname?.toString().trim()) { newErrors[`guarantors_${index}_Firstname`] = "First name is required"; hasLocalErrors = true; }
      if (!g.Surname?.toString().trim()) { newErrors[`guarantors_${index}_Surname`] = "Surname is required"; hasLocalErrors = true; }
      if (!g.idNumber?.toString().trim()) { newErrors[`guarantors_${index}_idNumber`] = "ID number is required"; hasLocalErrors = true; }
      if (!g.mobile?.toString().trim()) { newErrors[`guarantors_${index}_mobile`] = "Mobile number is required"; hasLocalErrors = true; }
      if (!g.relationship?.toString().trim()) { newErrors[`guarantors_${index}_relationship`] = "Relationship is required"; hasLocalErrors = true; }
      if (!g.gender) { newErrors[`guarantors_${index}_gender`] = "Gender is required"; hasLocalErrors = true; }
      if (g.mobile && !/^[0-9]{10,15}$/.test(g.mobile.toString().replace(/\D/g, ""))) { newErrors[`guarantors_${index}_mobile`] = "Invalid mobile number (10-15 digits)"; hasLocalErrors = true; }
      if (g.idNumber && !/^[0-9]{6,12}$/.test(g.idNumber.toString())) { newErrors[`guarantors_${index}_idNumber`] = "Invalid ID number (6-12 digits)"; hasLocalErrors = true; }
      if (g.dateOfBirth && !isAtLeast18YearsOld(g.dateOfBirth)) { newErrors[`guarantors_${index}_dateOfBirth`] = "Must be at least 18 years old"; hasLocalErrors = true; }
      if (!newErrors[`guarantors_${index}_mobile`]) {
        try {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", g.mobile, profile?.tenant_id, formData.id);
          if (!isUnique) { newErrors[`guarantors_${index}_mobile`] = "Mobile already exists in system"; hasLocalErrors = true; }
        } catch (e) { console.error(e); }
      }
      if (!newErrors[`guarantors_${index}_idNumber`]) {
        try {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", g.idNumber, profile?.tenant_id, formData.id);
          if (!isUnique) { newErrors[`guarantors_${index}_idNumber`] = "ID number already exists in system"; hasLocalErrors = true; }
        } catch (e) { console.error(e); }
      }
      if (hasLocalErrors) hasOverallErrors = true;
    });
    await Promise.all(validationPromises);
    setErrors(prev => ({ ...prev, ...newErrors }));
    if (hasOverallErrors) toast.error("Please fix errors in the guarantor section");
    return !hasOverallErrors;
  };

  const validateGuarantorSecurity = () => {
    const errorsFound = {};
    let hasErrors = false;
    if (guarantorSecurityItems.length === 0) { errorsFound.guarantorSecurityItems = "At least one guarantor security item is required"; toast.error("At least one guarantor security item is required"); hasErrors = true; }
    guarantorSecurityItems.forEach((item, index) => {
      if (!item.description?.toString().trim()) { errorsFound[`guarantor_security_description_${index}`] = "Description is required"; hasErrors = true; }
      if (!item.value || parseFloat(item.value) <= 0) { errorsFound[`guarantor_security_value_${index}`] = "Estimated value must be greater than 0"; hasErrors = true; }
    });
    setErrors((prev) => ({ ...prev, ...errorsFound }));
    if (hasErrors) toast.error("Please fix guarantor security errors");
    return !hasErrors;
  };

  const validateNextOfKinDetails = async () => {
    const newErrors = {};
    let hasOverallErrors = false;
    const validationPromises = formData.nextOfKins.map(async (nok, index) => {
      let hasLocalErrors = false;
      if (!nok.Firstname?.toString().trim()) { newErrors[`nextOfKins_${index}_Firstname`] = "First name is required"; hasLocalErrors = true; }
      if (!nok.Surname?.toString().trim()) { newErrors[`nextOfKins_${index}_Surname`] = "Surname is required"; hasLocalErrors = true; }
      if (!nok.idNumber?.toString().trim()) { newErrors[`nextOfKins_${index}_idNumber`] = "ID number is required"; hasLocalErrors = true; }
      if (!nok.mobile?.toString().trim()) { newErrors[`nextOfKins_${index}_mobile`] = "Mobile number is required"; hasLocalErrors = true; }
      if (!nok.relationship?.toString().trim()) { newErrors[`nextOfKins_${index}_relationship`] = "Relationship is required"; hasLocalErrors = true; }
      if (nok.relationship === "Other" && !nok.relationshipOther?.toString().trim()) { newErrors[`nextOfKins_${index}_relationshipOther`] = "Please specify relationship"; hasLocalErrors = true; }
      if (!nok.employmentStatus?.toString().trim()) { newErrors[`nextOfKins_${index}_employmentStatus`] = "Employment status is required"; hasLocalErrors = true; }
      if (!nok.county?.toString().trim()) { newErrors[`nextOfKins_${index}_county`] = "County is required"; hasLocalErrors = true; }
      if (nok.mobile && !/^[0-9]{10,15}$/.test(nok.mobile.toString().replace(/\D/g, ""))) { newErrors[`nextOfKins_${index}_mobile`] = "Invalid mobile number (10-15 digits)"; hasLocalErrors = true; }
      if (nok.idNumber && !/^[0-9]{6,12}$/.test(nok.idNumber.toString())) { newErrors[`nextOfKins_${index}_idNumber`] = "Invalid ID number (6-12 digits)"; hasLocalErrors = true; }
      if (!newErrors[`nextOfKins_${index}_mobile`]) {
        try {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", nok.mobile, profile?.tenant_id, formData.id);
          if (!isUnique) { newErrors[`nextOfKins_${index}_mobile`] = "Mobile already exists in system"; hasLocalErrors = true; }
        } catch (e) { console.error(e); }
      }
      if (!newErrors[`nextOfKins_${index}_idNumber`]) {
        try {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", nok.idNumber, profile?.tenant_id, formData.id);
          if (!isUnique) { newErrors[`nextOfKins_${index}_idNumber`] = "ID number already exists in system"; hasLocalErrors = true; }
        } catch (e) { console.error(e); }
      }
      if (hasLocalErrors) hasOverallErrors = true;
    });
    await Promise.all(validationPromises);
    setErrors(prev => ({ ...prev, ...newErrors }));
    if (hasOverallErrors) toast.error("Please fix errors in the next of kin section");
    return !hasOverallErrors;
  };

  const validateDocuments = () => {
    if (!documentUploadEnabled) return true;
    let errorsFound = {};
    let hasErrors = false;
    
    // Check both new uploads and existing images from database
    if (!officerClientImage1 && !existingImages.officerClient1) { 
      errorsFound.officerClientImage1 = "First Officer and Client Image is required"; 
      toast.error("First Officer and Client Image is required"); 
      hasErrors = true; 
    }
    if (!officerClientImage2 && !existingImages.officerClient2) { 
      errorsFound.officerClientImage2 = "Second Officer and Client Image is required"; 
      toast.error("Second Officer and Client Image is required"); 
      hasErrors = true; 
    }
    if (!bothOfficersImage && !existingImages.bothOfficers) { 
      errorsFound.bothOfficersImage = "Both Officers Image is required"; 
      toast.error("Both Officers Image is required"); 
      hasErrors = true; 
    }
    
    setErrors(errorsFound);
    return !hasErrors;
  };

  const handleNext = async () => {
    setIsValidating(true);
    let isValid = false;
    try {
      switch (activeSection) {
        case "personal": isValid = await validatePersonalDetails(); break;
        case "business": isValid = validateBusinessDetails(); break;
        case "borrowerSecurity": isValid = validateBorrowerSecurity(); break;
        case "loan": isValid = validateLoanDetails(); break;
        case "guarantor": isValid = await validateGuarantorDetails(); break;
        case "guarantorSecurity": isValid = validateGuarantorSecurity(); break;
        case "nextOfKin": isValid = await validateNextOfKinDetails(); break;
        case "documents": isValid = validateDocuments(); break;
        default: break;
      }
      if (!isValid) { toast.error("Please fix the highlighted errors before continuing."); return; }
      setCompletedSections(prev => new Set([...prev, activeSection]));
      const nextIndex = sections.findIndex((item) => item.id === activeSection) + 1;
      if (nextIndex < sections.length) setActiveSection(sections[nextIndex].id);
    } finally {
      setIsValidating(false);
    }
  };

  const validateForm = async () => {
    // Run all validation steps in parallel for speed
    const [
      personalValid,
      businessValid,
      borrowerSecurityValid,
      loanValid,
      guarantorValid,
      guarantorSecurityValid,
      nextOfKinValid,
      documentsValid
    ] = await Promise.all([
      validatePersonalDetails(),
      Promise.resolve(validateBusinessDetails()),
      Promise.resolve(validateBorrowerSecurity()),
      Promise.resolve(validateLoanDetails()),
      validateGuarantorDetails(),
      Promise.resolve(validateGuarantorSecurity()),
      validateNextOfKinDetails(),
      Promise.resolve(validateDocuments())
    ]);

    return (
      personalValid &&
      businessValid &&
      borrowerSecurityValid &&
      loanValid &&
      guarantorValid &&
      guarantorSecurityValid &&
      nextOfKinValid &&
      documentsValid
    );
  };

  const compressImage = async (file) => {
    const options = { maxSizeMB: 0.3, maxWidthOrHeight: 1024, useWebWorker: true, initialQuality: 0.7 };
    try { return await imageCompression(file, options); } catch { return file; }
  };

  // Optimized single file upload - Compression handled during selection
  const uploadFile = async (file, path, bucket = "customers") => {
    if (!file) return null;

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: true,
          cacheControl: '3600'
        });

      if (error) throw error;

      // SPEED OPTIMIZATION: Construct Public URL locally
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const projectRef = supabaseUrl.split('//')[1].split('.')[0];
      const publicUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/${bucket}/${data.path}`;
      
      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const uploadFilesBatch = async (files, pathPrefix, bucket = "customers") => {
    if (!files || files.length === 0) return [];
    const uploadPromises = files.map(file => {
      const path = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
      return uploadFile(file, path, bucket);
    });
    const urls = await Promise.all(uploadPromises);
    return urls.filter(Boolean);
  };

  const insertSecurityItemsOptimized = async (items, newImages, ownerId, isGuarantor, existingImagesArr = []) => {
    if (!items?.length) return;
    const table = isGuarantor ? "guarantor_security" : "security_items";
    const ownerKey = isGuarantor ? "guarantor_id" : "customer_id";
    const valueKey = isGuarantor ? "estimated_market_value" : "value";

    const itemsToInsert = items.map((s) => ({
      [ownerKey]: ownerId,
      item: (s.type === "Other" || s.type === "Other (specify)") ? s.otherType : (s.type || s.item || null),
      description: s.description || null,
      identification: s.identification || null,
      [valueKey]: s.value ? parseFloat(s.value) : null,
      created_by: profile?.id,
      tenant_id: profile?.tenant_id,
      branch_id: profile?.branch_id,
      region_id: profile?.region_id,
      created_at: new Date().toISOString(),
    }));

    const { data: insertedItems, error: secError } = await supabase.from(table).insert(itemsToInsert).select("id");
    if (secError) { console.error(`Error inserting security:`, secError); return; }
    if (!insertedItems?.length) return;

    const allImageRecordsPromises = [];
    insertedItems.forEach((item, index) => {
      const existingUrls = existingImagesArr[index] || [];
      existingUrls.forEach(url => {
        if (url) {
          allImageRecordsPromises.push(Promise.resolve({
            [isGuarantor ? "guarantor_security_id" : "security_item_id"]: item.id,
            image_url: url, created_by: profile?.id, tenant_id: profile?.tenant_id,
            branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
          }));
        }
      });
      const itemNewFiles = newImages[index] || [];
      itemNewFiles.forEach(file => {
        allImageRecordsPromises.push((async () => {
          const filePath = `${isGuarantor ? 'guarantor_security' : 'borrower_security'}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
          const url = await uploadFile(file, filePath, "customers");
          return url ? {
            [isGuarantor ? "guarantor_security_id" : "security_item_id"]: item.id,
            image_url: url, created_by: profile?.id, tenant_id: profile?.tenant_id,
            branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
          } : null;
        })());
      });
    });

    const imageRecords = (await Promise.all(allImageRecordsPromises)).filter(Boolean);
    if (imageRecords.length) {
      const imageTable = isGuarantor ? "guarantor_security_images" : "security_item_images";
      const { error: imgError } = await supabase.from(imageTable).insert(imageRecords);
      if (imgError) console.error(`Error inserting security images:`, imgError);
    }
  };

  const buildSyncPromises = (passportUrl, idFrontUrl, idBackUrl, houseImageUrl, guarantorDocs, finalBusinessUrls, officerClientUrl1, officerClientUrl2, bothOfficersUrl) => {
    const syncPromises = [];

    syncPromises.push(supabase.from("business_images").delete().eq("customer_id", customerId).then(() => {
      if (finalBusinessUrls.length > 0) {
        return supabase.from("business_images").insert(finalBusinessUrls.map((url) => ({
          customer_id: customerId, image_url: url, created_by: profile?.id,
          tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
        }))).then(res => res);
      }
    }));

    if (formData.maritalStatus === "Married" && formData.spouse) {
      syncPromises.push(supabase.from("spouse").upsert({
        customer_id: customerId, name: formData.spouse.name || null, id_number: formData.spouse.idNumber || null,
        mobile: formData.spouse.mobile || null, economic_activity: formData.spouse.economicActivity || null,
        created_by: profile?.id, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, updated_at: new Date().toISOString(),
      }, { onConflict: "customer_id" }).then(res => res));
    } else {
      syncPromises.push(supabase.from("spouse").delete().eq("customer_id", customerId).then(res => res));
    }

    syncPromises.push(supabase.from("next_of_kin").delete().eq("customer_id", customerId).then(() => {
      if (formData.nextOfKins.length > 0) {
        return supabase.from("next_of_kin").insert(formData.nextOfKins.map(nok => ({
          customer_id: customerId, Firstname: nok.Firstname || null, Surname: nok.Surname || null,
          Middlename: nok.Middlename || null, id_number: nok.idNumber || null, relationship: nok.relationship || null,
          mobile: nok.mobile || null, alternative_number: nok.alternativeNumber || null, employment_status: nok.employmentStatus || null,
          county: nok.county || null, city_town: nok.cityTown || null, company_name: nok.companyName || null,
          salary: nok.salary ? parseFloat(nok.salary) : null, business_name: nok.businessName || null,
          business_income: nok.businessIncome ? parseFloat(nok.businessIncome) : null, relationship_other: nok.relationshipOther || null,
          created_by: profile?.id, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
        }))).then(res => res);
      }
    }));

    syncPromises.push(supabase.from("guarantors").delete().eq("customer_id", customerId).then(async () => {
      if (formData.guarantors.length > 0) {
        const guarantorRecords = formData.guarantors.map((g, idx) => ({
          customer_id: customerId, Firstname: g.Firstname || null, Surname: g.Surname || null,
          Middlename: g.Middlename || null, id_number: g.idNumber || null, marital_status: g.maritalStatus || null,
          gender: g.gender || null, mobile: g.mobile || null, alternative_number: g.alternativeMobile || null,
          residence_status: g.residenceStatus || null, postal_address: g.postalAddress || null,
          code: g.code ? parseInt(g.code, 10) || null : null, occupation: g.occupation || null,
          relationship: g.relationship || null, date_of_birth: g.dateOfBirth || null, county: g.county || null,
          city_town: g.cityTown || null, passport_url: guarantorDocs[idx].passport,
          id_front_url: guarantorDocs[idx].idFront, id_back_url: guarantorDocs[idx].idBack,
          created_by: profile?.id, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
        }));
        const { data: gData, error: gErr } = await supabase.from("guarantors").insert(guarantorRecords).select("id").then(res => res);
        if (gErr) throw gErr;
        return gData;
      }
      return [];
    }));

    syncPromises.push(supabase.from("documents").delete().eq("customer_id", customerId).then(() => {
      const documentRecords = [
        { file: officerClientUrl1, type: "First Officer and Client Image" },
        { file: officerClientUrl2, type: "Second Officer and Client Image" },
        { file: bothOfficersUrl, type: "Both Officers Image" },
      ].filter(doc => doc.file).map(doc => ({
        customer_id: customerId, document_type: doc.type, document_url: doc.file,
        created_by: profile?.id, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
      }));
      if (documentRecords.length) return supabase.from("documents").insert(documentRecords).then(res => res);
    }));

    return syncPromises;
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const timestamp = Date.now();
      const guarantorFilesPromises = formData.guarantors.map(async (_, index) => {
        const [pass, idF, idB] = await Promise.all([
          guarantorPassportFiles[index] ? uploadFile(guarantorPassportFiles[index], `guarantor/${timestamp}_${index}_pass_${guarantorPassportFiles[index].name}`) : Promise.resolve(existingImages.guarantorPassport?.[index] || null),
          guarantorIdFrontFiles[index] ? uploadFile(guarantorIdFrontFiles[index], `guarantor/${timestamp}_${index}_idf_${guarantorIdFrontFiles[index].name}`) : Promise.resolve(existingImages.guarantorIdFront?.[index] || null),
          guarantorIdBackFiles[index] ? uploadFile(guarantorIdBackFiles[index], `guarantor/${timestamp}_${index}_idb_${guarantorIdBackFiles[index].name}`) : Promise.resolve(existingImages.guarantorIdBack?.[index] || null),
        ]);
        return { passport: pass, idFront: idF, idBack: idB };
      });

      const [passportUrl, idFrontUrl, idBackUrl, houseImageUrl, guarantorDocs, newBusinessUrls, officerClientUrl1, officerClientUrl2, bothOfficersUrl] = await Promise.all([
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : Promise.resolve(existingImages.passport),
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : Promise.resolve(existingImages.idFront),
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : Promise.resolve(existingImages.idBack),
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : Promise.resolve(existingImages.house),
        Promise.all(guarantorFilesPromises),
        businessImages.length > 0 ? uploadFilesBatch(businessImages, "business") : Promise.resolve([]),
        officerClientImage1 ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`) : Promise.resolve(existingImages.officerClient1),
        officerClientImage2 ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`) : Promise.resolve(existingImages.officerClient2),
        bothOfficersImage ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`) : Promise.resolve(existingImages.bothOfficers),
      ]);

      const finalBusinessUrls = [...(existingImages.business?.filter(url => url !== null) || []), ...newBusinessUrls];

      const customerPayload = {
        prefix: formData.prefix || null, Firstname: formData.Firstname || null, Surname: formData.Surname || null,
        Middlename: formData.Middlename || null, marital_status: formData.maritalStatus || null,
        residence_status: formData.residenceStatus || null, mobile: formData.mobile || null,
        alternative_mobile: formData.alternativeMobile || null, occupation: formData.occupation || null,
        date_of_birth: formData.dateOfBirth || null, gender: formData.gender || null, id_number: formData.idNumber || null,
        postal_address: formData.postalAddress || null, code: formData.code ? parseInt(formData.code, 10) || null : null,
        town: formData.town || null, county: formData.county || null, business_county: formData.businessCounty || null,
        business_name: formData.businessName || null, industry: formData.industry || null, business_type: formData.businessType || null,
        daily_Sales: formData.daily_Sales ? parseFloat(formData.daily_Sales) : null, year_established: formData.yearEstablished || null,
        business_location: formData.businessLocation || null, business_lat: formData.businessCoordinates?.lat || null,
        business_lng: formData.businessCoordinates?.lng || null, road: formData.road || null, landmark: formData.landmark || null,
        has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
        prequalifiedAmount: formData.prequalifiedAmount ? Math.round(parseFloat(formData.prequalifiedAmount)) || null : null,
        passport_url: passportUrl, id_front_url: idFrontUrl, id_back_url: idBackUrl, house_image_url: houseImageUrl,
        form_status: "draft", status: "pending", updated_at: new Date().toISOString(),
      };

      // RUN EVERYTHING IN PARALLEL FOR SPEED (<5S)
      const results = await Promise.all([
        supabase.from("customers").update(customerPayload).eq("id", customerId).then(res => res),
        ...buildSyncPromises(passportUrl, idFrontUrl, idBackUrl, houseImageUrl, guarantorDocs, finalBusinessUrls, officerClientUrl1, officerClientUrl2, bothOfficersUrl),
      ].map(p => p.then(res => res)));

      const updateError = results[0].error;
      if (updateError) throw updateError;

      // Handle security items in parallel as well
      await Promise.all([
        supabase.from("security_items").delete().eq("customer_id", customerId).then(async () => {
          await insertSecurityItemsOptimized(securityItems, securityItemImages, customerId, false, existingImages.security);
        }),
        (async () => {
          const { data: primaryG } = await supabase.from("guarantors").select("id").eq("customer_id", customerId).order('id', { ascending: true }).limit(1).single().then(res => res);
          if (primaryG?.id) {
            await supabase.from("guarantor_security").delete().eq("guarantor_id", primaryG.id).then(async () => {
              await insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecurityImages, primaryG.id, true, existingImages.guarantorSecurity);
            });
          }
        })()
      ]);

      toast.success("Draft updated successfully!");
      navigate('/registry/customers');
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to update draft.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const isValid = await validateForm();
      if (!isValid) { toast.error("Please fix all validation errors before submitting."); setIsSubmitting(false); return; }

      const timestamp = Date.now();
      const guarantorFilesPromises = formData.guarantors.map(async (_, index) => {
        const [pass, idF, idB] = await Promise.all([
          guarantorPassportFiles[index] ? uploadFile(guarantorPassportFiles[index], `guarantor/${timestamp}_${index}_pass_${guarantorPassportFiles[index].name}`) : Promise.resolve(existingImages.guarantorPassport?.[index] || null),
          guarantorIdFrontFiles[index] ? uploadFile(guarantorIdFrontFiles[index], `guarantor/${timestamp}_${index}_idf_${guarantorIdFrontFiles[index].name}`) : Promise.resolve(existingImages.guarantorIdFront?.[index] || null),
          guarantorIdBackFiles[index] ? uploadFile(guarantorIdBackFiles[index], `guarantor/${timestamp}_${index}_idb_${guarantorIdBackFiles[index].name}`) : Promise.resolve(existingImages.guarantorIdBack?.[index] || null),
        ]);
        return { passport: pass, idFront: idF, idBack: idB };
      });

      const [passportUrl, idFrontUrl, idBackUrl, houseImageUrl, guarantorDocs, newBusinessUrls, officerClientUrl1, officerClientUrl2, bothOfficersUrl] = await Promise.all([
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : Promise.resolve(existingImages.passport),
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : Promise.resolve(existingImages.idFront),
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : Promise.resolve(existingImages.idBack),
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : Promise.resolve(existingImages.house),
        Promise.all(guarantorFilesPromises),
        businessImages.length > 0 ? uploadFilesBatch(businessImages, "business") : Promise.resolve([]),
        officerClientImage1 ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`) : Promise.resolve(existingImages.officerClient1),
        officerClientImage2 ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`) : Promise.resolve(existingImages.officerClient2),
        bothOfficersImage ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`) : Promise.resolve(existingImages.bothOfficers),
      ]);

      const finalBusinessUrls = [...(existingImages.business?.filter(url => url !== null) || []), ...newBusinessUrls];

      const customerPayload = {
        prefix: formData.prefix || null, Firstname: formData.Firstname || null, Surname: formData.Surname || null,
        Middlename: formData.Middlename || null, marital_status: formData.maritalStatus || null,
        residence_status: formData.residenceStatus || null, mobile: formData.mobile || null,
        alternative_mobile: formData.alternativeMobile || null, occupation: formData.occupation || null,
        date_of_birth: formData.dateOfBirth || null, gender: formData.gender || null, id_number: formData.idNumber || null,
        postal_address: formData.postalAddress || null, code: formData.code ? parseInt(formData.code, 10) || null : null,
        town: formData.town || null, county: formData.county || null, business_county: formData.businessCounty || null,
        business_name: formData.businessName || null, industry: formData.industry || null, business_type: formData.businessType || null,
        daily_Sales: formData.daily_Sales ? parseFloat(formData.daily_Sales) : null, year_established: formData.yearEstablished || null,
        business_location: formData.businessLocation || null, business_lat: formData.businessCoordinates?.lat || null,
        business_lng: formData.businessCoordinates?.lng || null, road: formData.road || null, landmark: formData.landmark || null,
        has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
        prequalifiedAmount: formData.prequalifiedAmount ? Math.round(parseFloat(formData.prequalifiedAmount)) || null : null,
        passport_url: passportUrl, id_front_url: idFrontUrl, id_back_url: idBackUrl, house_image_url: houseImageUrl,
        status: "bm_review", form_status: "submitted", updated_at: new Date().toISOString(),
      };

      // RUN EVERYTHING IN PARALLEL FOR SPEED (<5S)
      const results = await Promise.all([
        supabase.from("customers").update(customerPayload).eq("id", customerId).then(res => res),
        ...buildSyncPromises(passportUrl, idFrontUrl, idBackUrl, houseImageUrl, guarantorDocs, finalBusinessUrls, officerClientUrl1, officerClientUrl2, bothOfficersUrl)
      ].map(p => p.then(res => res)));

      const mainError = results.find(r => r.error);
      if (mainError) throw mainError.error;

      // Handle security items in parallel with the rest
      await Promise.all([
        supabase.from("security_items").delete().eq("customer_id", customerId).then(async () => {
          await insertSecurityItemsOptimized(securityItems, securityItemImages, customerId, false, existingImages.security);
        }),
        (async () => {
          // Re-fetch primary guarantor ID to ensure we have it for security linking
          const { data: primaryG } = await supabase.from("guarantors").select("id").eq("customer_id", customerId).order('id', { ascending: true }).limit(1).single().then(res => res);
          if (primaryG?.id) {
            await supabase.from("guarantor_security").delete().eq("guarantor_id", primaryG.id).then(async () => {
              await insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecurityImages, primaryG.id, true, existingImages.guarantorSecurity);
            });
          }
        })()
      ]);

      toast.success("Customer record updated successfully!");
      navigate("/registry/customers");
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error(error.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Form
      activeSection={activeSection}
      setActiveSection={setActiveSection}
      formData={formData}
      handleChange={handleChange}
      handleNestedChange={handleNestedChange}
      errors={errors}
      sections={sections}
      completedSections={completedSections}
      isSubmitting={isSubmitting}
      isValidating={isValidating}
      isSavingDraft={isSavingDraft}
      isCustomIndustry={isCustomIndustry}
      isCustomType={isCustomType}
      securityItems={securityItems}
      handleSecurityChange={handleSecurityChange}
      addSecurityItem={addSecurityItem}
      removeSecurityItem={removeSecurityItem}
      guarantorSecurityItems={guarantorSecurityItems}
      handleGuarantorSecurityChange={handleGuarantorSecurityChange}
      addGuarantorSecurityItem={addGuarantorSecurityItem}
      removeGuarantorSecurityItem={removeGuarantorSecurityItem}
      previews={previews}
      handleFileUpload={handleFileUpload}
      handleRemoveFile={handleRemoveFile}
      handleMultipleFiles={handleMultipleFiles}
      handleRemoveMultipleFile={handleRemoveMultipleFile}
      handleBusinessImages={handleBusinessImages}
      handleRemoveBusinessImage={handleRemoveBusinessImage}
      imageUploadEnabled={imageUploadEnabled}
      documentUploadEnabled={documentUploadEnabled}
      handleLocationChange={(coords) => setFormData(prev => ({ ...prev, businessCoordinates: coords }))}
      addGuarantor={addGuarantor}
      removeGuarantor={removeGuarantor}
      addNextOfKin={addNextOfKin}
      removeNextOfKin={removeNextOfKin}
      handleSubmit={handleSubmit}
      handleSaveDraft={handleSaveDraft}
      handleNext={handleNext}
      existingImages={existingImages}
      handleRemoveExistingImage={handleRemoveExistingImage}
      setPassportFile={setPassportFile}
      setIdFrontFile={setIdFrontFile}
      setIdBackFile={setIdBackFile}
      setHouseImageFile={setHouseImageFile}
      setSecurityItemImages={setSecurityItemImages}
      setGuarantorSecurityImages={setGuarantorSecurityImages}
      setOfficerClientImage1={setOfficerClientImage1}
      setOfficerClientImage2={setOfficerClientImage2}
      setBothOfficersImage={setBothOfficersImage}
      guarantorPassportFiles={guarantorPassportFiles}
      setGuarantorPassportFiles={setGuarantorPassportFiles}
      guarantorIdFrontFiles={guarantorIdFrontFiles}
      setGuarantorIdFrontFiles={setGuarantorIdFrontFiles}
      guarantorIdBackFiles={guarantorIdBackFiles}
      setGuarantorIdBackFiles={setGuarantorIdBackFiles}
      businessImages={businessImages}
      securityItemImages={securityItemImages}
      guarantorSecurityImages={guarantorSecurityImages}
    />
  );
};

export default EditCustomerPage;