import { useState, memo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import LocationPicker from "./LocationPicker";
import imageCompression from "browser-image-compression";
import { apiFetch } from "../../utils/api";

// Kenya's 47 counties
import Form, { INDUSTRIES } from "./Form";


const AddCustomer = () => {
  const [activeSection, setActiveSection] = useState("personal");

  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const [formData, setFormData] = useState({
    // Personal Info
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

    // Business Info
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

    // Nested objects / Arrays
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

  // Fix security items structure to match your handlers
  const [securityItems, setSecurityItems] = useState([{
    type: '',
    description: '',
    value: '',
    otherType: '',
    identification: '' // Added missing field
  }]);

  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([
    {
      type: '', // Changed from 'item' to 'type' for consistency
      description: '',
      identification: '',
      value: '',
      otherType: '' // Added for consistency
    },
  ]);

  const { profile } = useAuth();
  const { documentUploadEnabled, imageUploadEnabled } = useTenantFeatures();

  // File upload state
  const [passportFile, setPassportFile] = useState(null);
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [houseImageFile, setHouseImageFile] = useState(null);
  const [businessImages, setBusinessImages] = useState([]);
  const [securityItemImages, setSecurityItemImages] = useState([]);
  
  // Image arrays for multiplicity
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



  const [completedSections, setCompletedSections] = useState(new Set());

  // Navigation sections with proper icons
  const sections = [
    { id: "personal", label: "Personal Info", icon: UserCircleIcon },
    { id: "business", label: "Business Info", icon: BuildingOffice2Icon },
    {
      id: "borrowerSecurity",
      label: "Borrower Security",
      icon: ShieldCheckIcon,
    },
    { id: "loan", label: "Loan Details", icon: CurrencyDollarIcon },
    { id: "guarantor", label: "Guarantor", icon: UserGroupIcon },
    {
      id: "guarantorSecurity",
      label: "Guarantor Security",
      icon: ShieldCheckIcon,
    },
    { id: "nextOfKin", label: "Next of Kin", icon: UserGroupIcon },
    // Only show documents tab if enabled
    ...(documentUploadEnabled ? [{ id: "documents", label: "Documents", icon: DocumentTextIcon }] : []),
  ];

  // Auto-geocode business address when fields change
  useEffect(() => {
    const { businessCounty, businessLocation, landmark, road } = formData;
    if (!businessCounty || (!businessLocation?.trim() && !landmark?.trim() && !road?.trim())) return;
    
    // Construct address from available parts (filtered to avoid extra commas)
    const addressParts = [landmark, road, businessLocation, businessCounty, "Kenya"]
      .filter(part => part && part.trim() !== "");
    const fullAddress = addressParts.join(", ");

    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&addressdetails=1&limit=1&countrycodes=ke&email=admin@jasiri.co.ke`;

        const response = await fetch(url, {
          headers: {
            "Accept-Language": "en-US,en;q=0.9",
          }
        });
        
        if (!response.ok) {
          console.warn("Geocoding failed:", response.status);
          return;
        }

        const data = await response.json();

        if (data && data.length > 0) {
          const coords = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };

          // Update coordinates in your form
          setFormData((prev) => ({
            ...prev,
            businessCoordinates: coords,
          }));
        }
      } catch (err) {
        console.error("Failed to geocode location", err);
      }
    }, 1000); // 1s debounce to prevent 429 Too Many Requests while being responsive
    return () => clearTimeout(timer);
  }, [
    formData.businessCounty,
    formData.businessLocation,
    formData.landmark,
    formData.road,
  ]);

  // Fixed change handlers with useCallback to prevent re-renders
  const handleChange = useCallback(
    async (e) => {
      const { name, value } = e.target;

      setFormData((prev) => {
        const newData = { ...prev, [name]: value };
        // Reset dependent fields
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

      // Clear old error
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: null }));
      }

      // 1️⃣ AGE VALIDATION — must be 18+
      if (name === "dateOfBirth" && value) {
        if (!isAtLeast18YearsOld(value)) {
          setErrors((prev) => ({
            ...prev,
            dateOfBirth: "Customer must be at least 18 years old",
          }));
        }
      }

      // 2️⃣ MOBILE VALIDATION
      if (name === "mobile" && value) {
        const cleaned = value.replace(/\D/g, "");
        if (!/^[0-9]{10,15}$/.test(cleaned)) {
          setErrors((prev) => ({
            ...prev,
            mobile: "Invalid mobile format (10-15 digits)",
          }));
        } else {
          const exists = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            "mobile",
            cleaned,
            profile?.tenant_id
          );
          if (!exists) {
            setErrors((prev) => ({
              ...prev,
              mobile: "Mobile number already exists",
            }));
          }
        }
      }

      // 3️⃣ ALTERNATIVE MOBILE VALIDATION
      if (name === "alternativeMobile" && value) {
        const cleaned = value.replace(/\D/g, "");
        if (!/^[0-9]{10,15}$/.test(cleaned)) {
          setErrors((prev) => ({
            ...prev,
            alternativeMobile: "Invalid alternative mobile format (10-15 digits)",
          }));
        } else {
          const exists = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            "mobile",
            cleaned,
            profile?.tenant_id
          );
          if (!exists) {
            setErrors((prev) => ({
              ...prev,
              alternativeMobile: "Alternative mobile already exists",
            }));
          }
        }
      }

      // 4️⃣ YEAR ESTABLISHED VALIDATION
      if (name === "yearEstablished" && value) {
        const establishedDate = new Date(value);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        if (establishedDate > sixMonthsAgo) {
          setErrors((prev) => ({
            ...prev,
            yearEstablished: "Business must be at least 6 months old",
          }));
        } else if (errors.yearEstablished) {
          setErrors((prev) => ({ ...prev, yearEstablished: null }));
        }
      }

      // 5️⃣ PREQUALIFIED AMOUNT VALIDATION
      if (name === "prequalifiedAmount") {
        const totalSecurity = securityItems.reduce(
          (acc, item) => acc + Number(item.value || 0),
          0
        );
        const maxPrequalified = totalSecurity / 3;

        if (Number(value) > maxPrequalified) {
          setFormData((prev) => ({ ...prev, prequalifiedAmount: "" })); // Clear input
          setErrors((prev) => ({
            ...prev,
            prequalifiedAmount: `Cannot exceed one-third of total security (${maxPrequalified})`,
          }));
        } else {
          setErrors((prev) => ({ ...prev, prequalifiedAmount: null }));
          setFormData((prev) => ({ ...prev, prequalifiedAmount: value }));
        }
      }

      // 6️⃣ ID NUMBER VALIDATION
      if (name === "idNumber" && value) {
        if (!/^[0-9]{6,12}$/.test(value)) {
          setErrors((prev) => ({
            ...prev,
            idNumber: "ID must be 6–12 digits",
          }));
        } else {
          const exists = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            "id_number",
            value,
            profile?.tenant_id
          );
          if (!exists) {
            setErrors((prev) => ({
              ...prev,
              idNumber: "ID number already exists",
            }));
          }
        }
      }
    },
    [errors, securityItems]
  );

  const handleNestedChange = useCallback(
    async (e, section, index = null) => {
      if (!e || !e.target) return;
      const { name, value } = e.target;

      setFormData((prev) => {
        if (index !== null && Array.isArray(prev[section])) {
          const newList = [...prev[section]];
          newList[index] = { ...newList[index], [name]: value };

          // Dependent field resets for nested arrays
          if (name === "county") {
            newList[index].cityTown = "";
            newList[index].town = "";
          }

          return { ...prev, [section]: newList };
        }
        return {
          ...prev,
          [section]: { ...prev[section], [name]: value },
        };
      });

      const errorKey = index !== null ? `${section}_${index}_${name}` : `${section}${name.charAt(0).toUpperCase() + name.slice(1)}`;
      if (errors[errorKey]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[errorKey];
          return newErrors;
        });
      }

      // --- LIVE VALIDATION FOR MULTIPLICITY SECTIONS ---
      if (["guarantors", "nextOfKins"].includes(section) && index !== null) {
        // 1. Mobile Validation
        if ((name === "mobile" || name === "alternativeMobile" || name === "alternativeNumber") && value) {
          const cleaned = value.replace(/\D/g, "");
          if (!/^[0-9]{10,15}$/.test(cleaned)) {
            setErrors(prev => ({ ...prev, [errorKey]: "Invalid mobile format (10-15 digits)" }));
          } else {
            const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", cleaned, profile?.tenant_id);
            if (!exists) {
              setErrors(prev => ({ ...prev, [errorKey]: "Mobile number already exists" }));
            }
          }
        }

        // 2. ID Number Validation
        if ((name === "idNumber" || name === "id_no") && value) {
          if (!/^[0-9]{6,12}$/.test(value)) {
            setErrors(prev => ({ ...prev, [errorKey]: "ID must be 6–12 digits" }));
          } else {
            const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", value, profile?.tenant_id);
            if (!exists) {
              setErrors(prev => ({ ...prev, [errorKey]: "ID number already exists" }));
            }
          }
        }

        // 3. Age Validation (Guarantors only)
        if (section === "guarantors" && name === "dateOfBirth" && value) {
          if (!isAtLeast18YearsOld(value)) {
            setErrors(prev => ({ ...prev, [errorKey]: "Guarantor must be at least 18 years old" }));
          }
        }
      }

      // Live validation for spouse fields
      if (section === "spouse") {
        if (name === "idNumber" && value) {
          if (!/^[0-9]{6,12}$/.test(value)) {
            setErrors((prev) => ({ ...prev, spouseIdNumber: "Spouse ID must be 6–12 digits" }));
          } else {
            const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", value, profile?.tenant_id);
            if (!exists) {
              setErrors((prev) => ({ ...prev, spouseIdNumber: "Spouse ID number already exists in our system" }));
            }
          }
        }
        if (name === "mobile" && value) {
          const cleaned = value.replace(/\D/g, "");
          if (!/^[0-9]{10,15}$/.test(cleaned)) {
            setErrors((prev) => ({ ...prev, spouseMobile: "Invalid spouse mobile format (10-15 digits)" }));
          } else {
            const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", cleaned, profile?.tenant_id);
            if (!exists) {
              setErrors((prev) => ({ ...prev, spouseMobile: "Spouse mobile number already exists in our system" }));
            }
          }
        }
      }
    },
    [errors]
  );




  const handleLocationChange = useCallback((coords) => {
    setFormData((prev) => ({ ...prev, businessCoordinates: coords }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.businessCoordinates;
      return newErrors;
    });
  }, []);

  // Helper functions
  const isAtLeast18YearsOld = (dateString) => {
    if (!dateString) return true;
    const birthDate = new Date(dateString);
    const today = new Date();
    const eighteenYearsAgo = new Date(
      today.getFullYear() - 18,
      today.getMonth(),
      today.getDate()
    );
    return birthDate <= eighteenYearsAgo;
  };

  const addGuarantor = () => {
    if (formData.guarantors.length >= 3) {
      toast.error("Maximum 3 guarantors allowed");
      return;
    }
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
    setFormData((prev) => ({
      ...prev,
      guarantors: prev.guarantors.filter((_, i) => i !== index)
    }));
    setGuarantorPassportFiles(prev => prev.filter((_, i) => i !== index));
    setGuarantorIdFrontFiles(prev => prev.filter((_, i) => i !== index));
    setGuarantorIdBackFiles(prev => prev.filter((_, i) => i !== index));
    setGuarantorSecurityImages(prev => prev.filter((_, i) => i !== index));
  };

  const addNextOfKin = () => {
    if (formData.nextOfKins.length >= 3) {
      toast.error("Maximum 3 Next of Kin allowed");
      return;
    }
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
    setFormData((prev) => ({
      ...prev,
      nextOfKins: prev.nextOfKins.filter((_, i) => i !== index)
    }));
  };

  const addSecurityItem = () => {
    setSecurityItems((prev) => [...prev, { type: '', description: '', value: '', otherType: '' }]);
  };

  const addGuarantorSecurityItem = () => {
    setGuarantorSecurityItems((prev) => [...prev, { type: '', description: '', value: '', otherType: '' }]);
  };

  const removeSecurityItem = (index) => {
    setSecurityItems((prev) => prev.filter((_, i) => i !== index));
    setSecurityItemImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeGuarantorSecurityItem = (index) => {
    setGuarantorSecurityItems((prev) => prev.filter((_, i) => i !== index));
    setGuarantorSecurityImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Fix security item structure and handlers

  const handleSecurityChange = (e, index) => {
    const { name, value } = e.target;
    console.log(`Security item ${index} - ${name}:`, value);

    setSecurityItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [name]: value } : item
      )
    );
  };

  const handleGuarantorSecurityChange = (e, index) => {
    const { name, value } = e.target;
    
    setGuarantorSecurityItems(prev =>
      prev.map((item, i) => {
        if (i === index) {
          const newItem = { ...item, [name]: value };
          // If type changes and is not "Other (specify)", clear otherType
          if (name === "type" && value !== "Other (specify)") {
            newItem.otherType = "";
          }
          return newItem;
        }
        return item;
      })
    );
  };

  // Fixed file upload handler
  const handleFileUpload = async (e, setter, key) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input to allow re-uploading same file
    e.target.value = null;

    if (uploadedFiles.has(file.name)) {
      toast.error("This file has already been uploaded elsewhere in the form.");
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

      console.log(`File saved for ${key}:`, compressedFile.name);
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error during file selection.");
    }
  };

  // Fixed file removal handler
  const handleRemoveFile = (key, setter) => {
    // Get the current file associated with this key
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

  // Fixed multiple file handler for security items with compression
  const handleMultipleFiles = async (e, index, setter) => {
    const files = Array.from(e.target.files);
    const validFiles = [];

    files.forEach(file => {
      if (uploadedFiles.has(file.name)) {
        toast.error(`${file.name} has already been uploaded elsewhere.`);
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length === 0) return;

    // Reset input immediately
    e.target.value = null;

    try {
      // Compress all files in parallel
      const compressedFiles = await Promise.all(
        validFiles.map(file => compressImage(file))
      );

      // Update global tracker
      setUploadedFiles(prev => {
        const newSet = new Set(prev);
        validFiles.forEach(f => newSet.add(f.name));
        return newSet;
      });

      // Update state for images
      setter(prev => {
        const updated = [...(prev[index] || []), ...compressedFiles];
        const allUpdated = [...prev];
        allUpdated[index] = updated;
        return allUpdated;
      });

      console.log(`Compressed and saved ${compressedFiles.length} files for index ${index}`);
    } catch (err) {
      console.error("Compression error/Selection error:", err);
      toast.error("Failed to process some images.");
    }
  };

  // Fixed remove handler for multiple images
  const handleRemoveMultipleFile = (sectionIndex, fileIndex, setter) => {
    setter(prev => {
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

  // Fixed business image handler
  const handleBusinessImages = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => !uploadedFiles.has(file.name));

    if (validFiles.length !== files.length) {
      toast.error("Some files have already been uploaded elsewhere.");
    }

    if (validFiles.length > 0) {
      // Add to global tracker
      setUploadedFiles(prev => {
        const newSet = new Set(prev);
        validFiles.forEach(f => newSet.add(f.name));
        return newSet;
      });

      // Add to business images
      setBusinessImages(prev => [...prev, ...validFiles]);
    }

    e.target.value = null;
  };

  // Fixed business image removal
  const handleRemoveBusinessImage = (index) => {
    const file = businessImages[index];

    // Remove from uploadedFiles tracker
    setUploadedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(file.name);
      return newSet;
    });

    setBusinessImages(prev => prev.filter((_, i) => i !== index));
  };

  // Validation functions (keep your existing validation functions)
  const validatePersonalDetails = async () => {
    const newErrors = {};
    let hasErrors = false;

    if (!formData.Firstname?.trim()) {
      newErrors.Firstname = "First name is required";
      toast.error("First name is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!formData.Surname?.trim()) {
      newErrors.Surname = "Surname is required";
      toast.error("Surname is required");
      hasErrors = true;
    }
    if (!formData.mobile?.trim()) {
      newErrors.mobile = "Mobile number is required";
      toast.error("Mobile number is required");
      hasErrors = true;
    }

    if (!formData.idNumber?.trim()) {
      newErrors.idNumber = "ID number is required";
      toast.error("ID number is required");
      hasErrors = true;
    }

    if (formData.mobile && !/^[0-9]{10,15}$/.test(formData.mobile.replace(/\D/g, ""))) {
      newErrors.mobile = "Please enter a valid mobile number (10-15 digits)";
      toast.error("Invalid mobile number format");
      hasErrors = true;
    }
    if (formData.alternativeMobile && !/^[0-9]{10,15}$/.test(formData.alternativeMobile.replace(/\D/g, ""))) {
      newErrors.alternativeMobile = "Please enter a valid alternative mobile number (10-15 digits)";
      toast.error("Invalid alternative mobile number format");
      hasErrors = true;
    }

    if (formData.idNumber && !/^[0-9]{6,12}$/.test(formData.idNumber)) {
      newErrors.idNumber = "Please enter a valid ID number (6-12 digits)";
      toast.error("Invalid ID number format");
      hasErrors = true;
    }

    if (formData.dateOfBirth && !isAtLeast18YearsOld(formData.dateOfBirth)) {
      newErrors.dateOfBirth = "Customer must be at least 18 years old";
      toast.error("Customer must be at least 18 years old");
      hasErrors = true;
    }

    // Validate spouse info if married
    if (formData.maritalStatus === "Married") {
      if (!formData.spouse.name?.trim()) {
        newErrors.spouseName = "Spouse name is required for married customers";
        toast.error("Spouse name is required");
        hasErrors = true;
      }
      if (!formData.spouse.idNumber?.trim()) {
        newErrors.spouseIdNumber = "Spouse ID number is required for married customers";
        toast.error("Spouse ID number is required");
        hasErrors = true;
      }
      if (!formData.spouse.mobile?.trim()) {
        newErrors.spouseMobile = "Spouse mobile number is required for married customers";
        toast.error("Spouse mobile number is required");
        hasErrors = true;
      }
      if (!formData.spouse.economicActivity?.trim()) {
        newErrors.spouseEconomicActivity = "Spouse economic activity is required for married customers";
        toast.error("Spouse economic activity is required");
        hasErrors = true;
      }

      // Validate spouse ID format
      if (formData.spouse.idNumber && !/^[0-9]{6,12}$/.test(formData.spouse.idNumber)) {
        newErrors.spouseIdNumber = "Please enter a valid spouse ID number (6-12 digits)";
        toast.error("Invalid spouse ID number format");
        hasErrors = true;
      }

      // Validate spouse mobile format
      if (formData.spouse.mobile && !/^[0-9]{10,15}$/.test(formData.spouse.mobile.replace(/\D/g, ""))) {
        newErrors.spouseMobile = "Please enter a valid spouse mobile number (10-15 digits)";
        toast.error("Invalid spouse mobile number format");
        hasErrors = true;
      }
    }

    const fieldsToCheck = [
      { field: "mobile", value: formData.mobile, label: "Mobile number" },
      { field: "alternativeMobile", value: formData.alternativeMobile, label: "Alternative mobile" },
      { field: "idNumber", value: formData.idNumber, label: "ID number" },
    ];

    if (formData.maritalStatus === "Married" && formData.spouse?.idNumber) {
      fieldsToCheck.push({ field: "spouseIdNumber", value: formData.spouse.idNumber, label: "Spouse ID number" });
    }

    // Parallelize uniqueness checks (speed up)
    const uniqueChecks = fieldsToCheck
      .filter(({ value, field }) => value && !newErrors[field])
      .map(async ({ field, value, label }) => {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            (field === "idNumber" || field === "spouseIdNumber") ? "id_number" : "mobile",
            value,
            profile?.tenant_id,
            formData.id
          );
          if (!isUnique) {
            return { field, error: `${label} already exists in our system` };
          }
        } catch (err) {
          console.error(`Error checking uniqueness for ${label}:`, err);
          return { field, error: `Error validating ${label}` };
        }
        return null;
      });

    const results = await Promise.all(uniqueChecks);
    results.filter(Boolean).forEach(({ field, error }) => {
      newErrors[field] = error;
      toast.error(error);
      hasErrors = true;
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  const validateBusinessDetails = () => {
    let errorsFound = {};
    let hasErrors = false;

    if (!formData.businessName?.trim()) {
      errorsFound.businessName = "Business name is required";
      toast.error("Business name is required");
      hasErrors = true;
    }

    if (!formData.businessType?.trim()) {
      errorsFound.businessType = "Business type is required";
      toast.error("Business type is required");
      hasErrors = true;
    }

    if (!formData.yearEstablished) {
      errorsFound.yearEstablished = "Year established is required";
      toast.error("Year established is required");
      hasErrors = true;
    } else {
      const establishedDate = new Date(formData.yearEstablished);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      if (establishedDate > sixMonthsAgo) {
        errorsFound.yearEstablished = "Business must be at least 6 months old";
        toast.error("Business must be at least 6 months old");
        hasErrors = true;
      }
    }

    if (!formData.businessLocation?.trim()) {
      errorsFound.businessLocation = "Business location is required";
      toast.error("Business location is required");
      hasErrors = true;
    }

    if (!formData.road?.trim()) {
      errorsFound.road = "Road is required";
      toast.error("Road is required");
      hasErrors = true;
    }

    if (!formData.landmark?.trim()) {
      errorsFound.landmark = "Landmark is required";
      toast.error("Landmark is required");
      hasErrors = true;
    }

    if (!formData.daily_Sales) {
      errorsFound.daily_Sales = "Daily sales estimate is required";
      toast.error("Daily sales estimate is required");
      hasErrors = true;
    } else if (parseFloat(formData.daily_Sales) <= 0) {
      errorsFound.daily_Sales = "Daily sales must be greater than 0";
      toast.error("Daily sales must be greater than 0");
      hasErrors = true;
    }

    if (!formData.businessCoordinates?.lat || !formData.businessCoordinates?.lng) {
      errorsFound.businessCoordinates = "Business GPS coordinates are required";
      toast.error("Please set business GPS location");
      hasErrors = true;
    }

    setErrors(errorsFound);
    return !hasErrors;
  };

  const validateBorrowerSecurity = () => {
    const errorsFound = {};
    let hasErrors = false;

    if (securityItems.length === 0) {
      errorsFound.securityItems = "At least one security item is required";
      toast.error("At least one security item is required");
      hasErrors = true;
    }

    securityItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        errorsFound[`security_description_${index}`] = "Description is required";
        toast.error(`Security Item ${index + 1}: Description is required`);
        hasErrors = true;
      }

      if (!item.value || parseFloat(item.value) <= 0) {
        errorsFound[`security_value_${index}`] = "Estimated value must be greater than 0";
        toast.error(`Security Item ${index + 1}: Value must be greater than 0`);
        hasErrors = true;
      }
    });

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateLoanDetails = () => {
    const errorsFound = {};
    let hasErrors = false;

    if (!formData.prequalifiedAmount) {
      errorsFound.prequalifiedAmount = "Pre-qualified amount is required";
      toast.error("Pre-qualified amount is required");
      hasErrors = true;
    } else if (parseFloat(formData.prequalifiedAmount) <= 0) {
      errorsFound.prequalifiedAmount = "Loan amount must be greater than 0";
      toast.error("Loan amount must be greater than 0");
      hasErrors = true;
    }

    setErrors(errorsFound);
    return !hasErrors;
  };

  const validateGuarantorDetails = async () => {
    const newErrors = {};
    let hasOverallErrors = false;

    const validationPromises = formData.guarantors.map(async (g, index) => {
      let hasLocalErrors = false;
      
      if (!g.Firstname?.trim()) {
        newErrors[`guarantors_${index}_Firstname`] = "First name is required";
        hasLocalErrors = true;
      }
      if (!g.Surname?.trim()) {
        newErrors[`guarantors_${index}_Surname`] = "Surname is required";
        hasLocalErrors = true;
      }
      if (!g.idNumber?.trim()) {
        newErrors[`guarantors_${index}_idNumber`] = "ID number is required";
        hasLocalErrors = true;
      }
      if (!g.mobile?.trim()) {
        newErrors[`guarantors_${index}_mobile`] = "Mobile number is required";
        hasLocalErrors = true;
      }
      if (!g.relationship?.trim()) {
        newErrors[`guarantors_${index}_relationship`] = "Relationship is required";
        hasLocalErrors = true;
      }
      if (!g.gender) {
        newErrors[`guarantors_${index}_gender`] = "Gender is required";
        hasLocalErrors = true;
      }

      // Format Validations
      if (g.mobile && !/^[0-9]{10,15}$/.test(g.mobile.replace(/\D/g, ""))) {
        newErrors[`guarantors_${index}_mobile`] = "Invalid mobile number (10-15 digits)";
        hasLocalErrors = true;
      }
      if (g.idNumber && !/^[0-9]{6,12}$/.test(g.idNumber)) {
        newErrors[`guarantors_${index}_idNumber`] = "Invalid ID number (6-12 digits)";
        hasLocalErrors = true;
      }
      if (g.dateOfBirth && !isAtLeast18YearsOld(g.dateOfBirth)) {
        newErrors[`guarantors_${index}_dateOfBirth`] = "Must be at least 18 years old";
        hasLocalErrors = true;
      }

      // Check for duplicates WITHIN the form first (Performance & Logic boost)
      const sameFormMobileCount = formData.guarantors.filter(item => item.mobile && item.mobile === g.mobile).length;
      if (sameFormMobileCount > 1) {
        newErrors[`guarantors_${index}_mobile`] = "Duplicate mobile in this form";
        hasLocalErrors = true;
      }

      const sameFormIdCount = formData.guarantors.filter(item => item.idNumber && item.idNumber === g.idNumber).length;
      if (sameFormIdCount > 1) {
        newErrors[`guarantors_${index}_idNumber`] = "Duplicate ID number in this form";
        hasLocalErrors = true;
      }

      // Skip uniqueness check if we already have errors
      if (!newErrors[`guarantors_${index}_mobile`]) {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            "mobile",
            g.mobile,
            profile?.tenant_id,
            formData.id
          );
          if (!isUnique) {
            newErrors[`guarantors_${index}_mobile`] = "Mobile already exists in system";
            hasLocalErrors = true;
          }
        } catch (e) { console.error(e); }
      }

      if (!newErrors[`guarantors_${index}_idNumber`]) {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            "id_number",
            g.idNumber,
            profile?.tenant_id,
            formData.id
          );
          if (!isUnique) {
            newErrors[`guarantors_${index}_idNumber`] = "ID number already exists in system";
            hasLocalErrors = true;
          }
        } catch (e) { console.error(e); }
      }

      if (hasLocalErrors) hasOverallErrors = true;
    });

    await Promise.all(validationPromises);
    setErrors(prev => ({ ...prev, ...newErrors }));
    
    if (hasOverallErrors) {
      toast.error("Please fix errors in the guarantor section");
    }
    return !hasOverallErrors;
  };

  const validateGuarantorSecurity = () => {
    const errorsFound = {};
    let hasErrors = false;

    if (guarantorSecurityItems.length === 0) {
      errorsFound.guarantorSecurityItems = "At least one guarantor security item is required";
      toast.error("At least one guarantor security item is required");
      hasErrors = true;
    }

    guarantorSecurityItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        errorsFound[`guarantor_security_description_${index}`] = "Description is required";
        hasErrors = true;
      }

      if (!item.value || parseFloat(item.value) <= 0) {
        errorsFound[`guarantor_security_value_${index}`] = "Estimated value must be greater than 0";
        hasErrors = true;
      }
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

      if (!nok.Firstname?.trim()) {
        newErrors[`nextOfKins_${index}_Firstname`] = "First name is required";
        hasLocalErrors = true;
      }
      if (!nok.Surname?.trim()) {
        newErrors[`nextOfKins_${index}_Surname`] = "Surname is required";
        hasLocalErrors = true;
      }
      if (!nok.idNumber?.trim()) {
        newErrors[`nextOfKins_${index}_idNumber`] = "ID number is required";
        hasLocalErrors = true;
      }
      if (!nok.mobile?.trim()) {
        newErrors[`nextOfKins_${index}_mobile`] = "Mobile number is required";
        hasLocalErrors = true;
      }
      if (!nok.relationship?.trim()) {
        newErrors[`nextOfKins_${index}_relationship`] = "Relationship is required";
        hasLocalErrors = true;
      }
      if (nok.relationship === "Other" && !nok.relationshipOther?.trim()) {
        newErrors[`nextOfKins_${index}_relationshipOther`] = "Please specify relationship";
        hasLocalErrors = true;
      }
      if (!nok.employmentStatus?.trim()) {
        newErrors[`nextOfKins_${index}_employmentStatus`] = "Employment status is required";
        hasLocalErrors = true;
      }
      if (!nok.county?.trim()) {
        newErrors[`nextOfKins_${index}_county`] = "County is required";
        hasLocalErrors = true;
      }

      // Format Validations
      if (nok.mobile && !/^[0-9]{10,15}$/.test(nok.mobile.replace(/\D/g, ""))) {
        newErrors[`nextOfKins_${index}_mobile`] = "Invalid mobile number (10-15 digits)";
        hasLocalErrors = true;
      }
      if (nok.idNumber && !/^[0-9]{6,12}$/.test(nok.idNumber)) {
        newErrors[`nextOfKins_${index}_idNumber`] = "Invalid ID number (6-12 digits)";
        hasLocalErrors = true;
      }

      // Check for duplicates WITHIN the form first
      const sameFormMobileCount = formData.nextOfKins.filter(item => item.mobile && item.mobile === nok.mobile).length;
      if (sameFormMobileCount > 1) {
        newErrors[`nextOfKins_${index}_mobile`] = "Duplicate mobile in this form";
        hasLocalErrors = true;
      }

      const sameFormIdCount = formData.nextOfKins.filter(item => item.idNumber && item.idNumber === nok.idNumber).length;
      if (sameFormIdCount > 1) {
        newErrors[`nextOfKins_${index}_idNumber`] = "Duplicate ID number in this form";
        hasLocalErrors = true;
      }

      // Uniqueness checks
      if (!newErrors[`nextOfKins_${index}_mobile`]) {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            "mobile",
            nok.mobile,
            profile?.tenant_id,
            formData.id
          );
          if (!isUnique) {
            newErrors[`nextOfKins_${index}_mobile`] = "Mobile already exists in system";
            hasLocalErrors = true;
          }
        } catch (e) { console.error(e); }
      }

      if (!newErrors[`nextOfKins_${index}_idNumber`]) {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            "id_number",
            nok.idNumber,
            profile?.tenant_id,
            formData.id
          );
          if (!isUnique) {
            newErrors[`nextOfKins_${index}_idNumber`] = "ID number already exists in system";
            hasLocalErrors = true;
          }
        } catch (e) { console.error(e); }
      }

      if (hasLocalErrors) hasOverallErrors = true;
    });

    await Promise.all(validationPromises);
    setErrors(prev => ({ ...prev, ...newErrors }));
    
    if (hasOverallErrors) {
      toast.error("Please fix errors in the next of kin section");
    }
    return !hasOverallErrors;
  };

  const validateDocuments = () => {
    if (!documentUploadEnabled) return true;
    let errorsFound = {};
    let hasErrors = false;

    if (!officerClientImage1) {
      errorsFound.officerClientImage1 = "First Officer and Client Image is required";
      toast.error("First Officer and Client Image is required");
      hasErrors = true;
    }
    if (!officerClientImage2) {
      errorsFound.officerClientImage2 = "Second Officer and Client Image is required";
      toast.error("Second Officer and Client Image is required");
      hasErrors = true;
    }
    if (!bothOfficersImage) {
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
        case "personal":
          isValid = await validatePersonalDetails();
          break;
        case "business":
          isValid = validateBusinessDetails();
          break;
        case "borrowerSecurity":
          isValid = validateBorrowerSecurity();
          break;
        case "loan":
          isValid = validateLoanDetails();
          break;
        case "guarantor":
          isValid = await validateGuarantorDetails();
          break;
        case "guarantorSecurity":
          isValid = validateGuarantorSecurity();
          break;
        case "nextOfKin":
          isValid = await validateNextOfKinDetails();
          break;
        case "documents":
          isValid = validateDocuments();
          break;
        default:
          break;
      }

      if (!isValid) {
        toast.error("Please fix the highlighted errors before continuing.");
        return;
      }

      // Mark current section as completed
      setCompletedSections(prev => new Set([...prev, activeSection]));

      const nextIndex = sections.findIndex((item) => item.id === activeSection) + 1;
      if (nextIndex < sections.length) {
        setActiveSection(sections[nextIndex].id);
      }
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

    const isValid =
      personalValid &&
      businessValid &&
      borrowerSecurityValid &&
      loanValid &&
      guarantorValid &&
      guarantorSecurityValid &&
      nextOfKinValid &&
      documentsValid;

    if (!isValid) {
      console.warn("Validation failed: ", {
        personalValid,
        businessValid,
        borrowerSecurityValid,
        loanValid,
        guarantorValid,
        guarantorSecurityValid,
        nextOfKinValid,
        documentsValid,
      });
    }

    return isValid;
  };


  // FAST local-only validation for final submit — skips all DB uniqueness checks
  // (those were already done step-by-step in handleNext)
  const validateFormFast = () => {
    const errors = {};
    let ok = true;
    const fail = () => { ok = false; };

    // Personal
    if (!formData.Firstname?.trim()) { errors.Firstname = "Required"; fail(); }
    if (!formData.Surname?.trim()) { errors.Surname = "Required"; fail(); }
    if (!formData.mobile?.trim()) { errors.mobile = "Required"; fail(); }
    if (!formData.idNumber?.trim()) { errors.idNumber = "Required"; fail(); }
    if (!formData.gender) { errors.gender = "Required"; fail(); }
    if (!formData.dateOfBirth) { errors.dateOfBirth = "Required"; fail(); }
    if (!formData.county?.trim()) { errors.county = "Required"; fail(); }

    if (formData.maritalStatus === "Married") {
      if (!formData.spouse?.name?.trim()) { errors.spouseName = "Required"; fail(); }
      if (!formData.spouse?.idNumber?.trim()) { errors.spouseIdNumber = "Required"; fail(); }
      if (!formData.spouse?.mobile?.trim()) { errors.spouseMobile = "Required"; fail(); }
    }

    // Business
    if (!formData.businessName?.trim()) { errors.businessName = "Required"; fail(); }
    if (!formData.businessType?.trim()) { errors.businessType = "Required"; fail(); }
    if (!formData.businessLocation?.trim()) { errors.businessLocation = "Required"; fail(); }
    if (!formData.businessCoordinates?.lat || !formData.businessCoordinates?.lng) {
      errors.businessCoordinates = "GPS required"; fail();
    }
    if (!formData.daily_Sales || parseFloat(formData.daily_Sales) <= 0) {
      errors.daily_Sales = "Required"; fail();
    }

    // Borrower Security
    if (!securityItems?.length) { errors.securityItems = "Required"; fail(); }

    // Loan
    if (!formData.prequalifiedAmount || parseFloat(formData.prequalifiedAmount) <= 0) {
      errors.prequalifiedAmount = "Required"; fail();
    }

    // Guarantors
    if (!formData.guarantors?.length) { errors.guarantors = "At least one guarantor required"; fail(); }
    formData.guarantors?.forEach((g, i) => {
      if (!g.Firstname?.trim()) { errors[`guarantors_${i}_Firstname`] = "Required"; fail(); }
      if (!g.Surname?.trim()) { errors[`guarantors_${i}_Surname`] = "Required"; fail(); }
      if (!g.mobile?.trim()) { errors[`guarantors_${i}_mobile`] = "Required"; fail(); }
      if (!g.idNumber?.trim()) { errors[`guarantors_${i}_idNumber`] = "Required"; fail(); }
      if (!g.relationship?.trim()) { errors[`guarantors_${i}_relationship`] = "Required"; fail(); }
    });

    // Guarantor Security
    if (!guarantorSecurityItems?.length) { errors.guarantorSecurityItems = "Required"; fail(); }

    // Next of Kin
    if (!formData.nextOfKins?.length) { errors.nextOfKins = "At least one NOK required"; fail(); }
    formData.nextOfKins?.forEach((n, i) => {
      if (!n.Firstname?.trim()) { errors[`nextOfKins_${i}_Firstname`] = "Required"; fail(); }
      if (!n.Surname?.trim()) { errors[`nextOfKins_${i}_Surname`] = "Required"; fail(); }
      if (!n.mobile?.trim()) { errors[`nextOfKins_${i}_mobile`] = "Required"; fail(); }
      if (!n.idNumber?.trim()) { errors[`nextOfKins_${i}_idNumber`] = "Required"; fail(); }
      if (!n.relationship?.trim()) { errors[`nextOfKins_${i}_relationship`] = "Required"; fail(); }
      if (!n.employmentStatus?.trim()) { errors[`nextOfKins_${i}_employmentStatus`] = "Required"; fail(); }
    });

    // Documents
    if (documentUploadEnabled) {
      if (!officerClientImage1) { errors.officerClientImage1 = "Required"; fail(); }
      if (!officerClientImage2) { errors.officerClientImage2 = "Required"; fail(); }
      if (!bothOfficersImage) { errors.bothOfficersImage = "Required"; fail(); }
    }

    if (!ok) {
      setErrors(errors);
      const firstKey = Object.keys(errors)[0];
      toast.error(`Please fix missing fields before submitting (first: ${firstKey})`);
    }
    return ok;
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);

    try {
      const existingCustomerId = formData?.id || null;
      const timestamp = Date.now();

      // 1. PARALLEL UPLOAD ALL FILES AT ONCE
      const guarantorFilesPromises = formData.guarantors.map(async (g, index) => {
        const [pass, idF, idB] = await Promise.all([
          guarantorPassportFiles[index] ? uploadFile(guarantorPassportFiles[index], `guarantor/${timestamp}_${index}_pass_${guarantorPassportFiles[index].name}`) : Promise.resolve(g.passport_url || null),
          guarantorIdFrontFiles[index] ? uploadFile(guarantorIdFrontFiles[index], `guarantor/${timestamp}_${index}_idf_${guarantorIdFrontFiles[index].name}`) : Promise.resolve(g.id_front_url || null),
          guarantorIdBackFiles[index] ? uploadFile(guarantorIdBackFiles[index], `guarantor/${timestamp}_${index}_idb_${guarantorIdBackFiles[index].name}`) : Promise.resolve(g.id_back_url || null),
        ]);
        return { passport: pass, idFront: idF, idBack: idB };
      });

      const [
        passportUrl,
        idFrontUrl,
        idBackUrl,
        houseImageUrl,
        guarantorDocs,
        businessUrls,
        officerClientUrl1,
        officerClientUrl2,
        bothOfficersUrl,
        securityUrls,
        guarantorSecUrls
      ] = await Promise.all([
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : Promise.resolve(formData.passport_url || null),
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : Promise.resolve(formData.id_front_url || null),
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : Promise.resolve(formData.id_back_url || null),
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : Promise.resolve(formData.house_image_url || null),
        Promise.all(guarantorFilesPromises),
        businessImages?.length > 0 ? uploadFilesBatch(businessImages, "business") : Promise.resolve([]),
        officerClientImage1 ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`) : Promise.resolve(null),
        officerClientImage2 ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`) : Promise.resolve(null),
        bothOfficersImage ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`) : Promise.resolve(null),
        securityItemImages.length > 0 ? Promise.all(securityItemImages.map(imgs => uploadFilesBatch(imgs, "borrower_security"))) : Promise.resolve([]),
        guarantorSecurityImages.length > 0 ? Promise.all(guarantorSecurityImages.map(imgs => uploadFilesBatch(imgs, "guarantor_security"))) : Promise.resolve([]),
      ]);

      // 2. Prepare customer payload
      const customerPayload = {
        prefix: formData.prefix || null,
        Firstname: formData.Firstname || null,
        Surname: formData.Surname || null,
        Middlename: formData.Middlename || null,
        marital_status: formData.maritalStatus || null,
        residence_status: formData.residenceStatus || null,
        mobile: formData.mobile || null,
        alternative_mobile: formData.alternativeMobile || null,
        occupation: formData.occupation || null,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        id_number: formData.idNumber || null,
        postal_address: formData.postalAddress || null,
        code: formData.code ? parseInt(formData.code) : null,
        town: formData.town || null,
        county: formData.county || null,
        business_county: formData.businessCounty || null,
        business_name: formData.businessName || null,
        industry: formData.industry || null,
        business_type: formData.businessType || null,
        daily_Sales: formData.daily_Sales ? parseFloat(formData.daily_Sales) : null,
        year_established: formData.yearEstablished || null,
        business_location: formData.businessLocation || null,
        business_lat: formData.businessCoordinates?.lat || null,
        business_lng: formData.businessCoordinates?.lng || null,
        road: formData.road || null,
        landmark: formData.landmark || null,
        has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
        prequalifiedAmount: formData.prequalifiedAmount ? parseFloat(formData.prequalifiedAmount) : null,
        passport_url: passportUrl,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        house_image_url: houseImageUrl,
        form_status: "draft",
        status: "pending",
        created_by: profile?.id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        tenant_id: profile?.tenant_id,
        updated_at: new Date().toISOString(),
      };

      // 3. Insert or update customer
      let draftResult;
      if (existingCustomerId) {
        draftResult = await supabase
          .from("customers")
          .update(customerPayload)
          .eq("id", existingCustomerId)
          .select("id")
          .single();
      } else {
        draftResult = await supabase
          .from("customers")
          .insert([{ ...customerPayload, created_at: new Date().toISOString() }])
          .select("id")
          .single();
      }

      if (draftResult.error) throw draftResult.error;
      const customerId = draftResult.data.id;

      // 4. Update related records (Delete-then-Insert Strategy for Multiplicity)
      const upsertPromises = [];

      // Business images
      if (businessUrls.length > 0) {
        upsertPromises.push(supabase.from("business_images").delete().eq("customer_id", customerId));
        const businessRecords = businessUrls.map((url) => ({
          customer_id: customerId,
          image_url: url,
          created_by: profile?.id,
          tenant_id: profile?.tenant_id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        }));
        upsertPromises.push(supabase.from("business_images").insert(businessRecords));
      }

      // Spouse
      if (formData.maritalStatus === "Married" && formData.spouse) {
        upsertPromises.push(supabase.from("spouse").upsert({
          customer_id: customerId,
          name: formData.spouse.name || null,
          id_number: formData.spouse.idNumber || null,
          mobile: formData.spouse.mobile || null,
          economic_activity: formData.spouse.economicActivity || null,
          created_by: profile?.id,
          tenant_id: profile?.tenant_id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "customer_id" }));
      } else {
        upsertPromises.push(supabase.from("spouse").delete().eq("customer_id", customerId));
      }

      // Next of Kin - sequential delete then insert to avoid race condition
      upsertPromises.push(
        supabase.from("next_of_kin").delete().eq("customer_id", customerId).then(() => {
          if (formData.nextOfKins.length > 0) {
            const nokRecords = formData.nextOfKins.map(nok => ({
              customer_id: customerId,
              Firstname: nok.Firstname || null,
              Surname: nok.Surname || null,
              Middlename: nok.Middlename || null,
              id_number: nok.idNumber || null,
              relationship: nok.relationship || null,
              mobile: nok.mobile || null,
              alternative_number: nok.alternativeNumber || null,
              employment_status: nok.employmentStatus || null,
              county: nok.county || null,
              city_town: nok.cityTown || null,
              company_name: nok.companyName || null,
              salary: nok.salary ? parseFloat(nok.salary) : null,
              business_name: nok.businessName || null,
              business_income: nok.businessIncome ? parseFloat(nok.businessIncome) : null,
              relationship_other: nok.relationshipOther || null,
              created_by: profile?.id,
              tenant_id: profile?.tenant_id,
              branch_id: profile?.branch_id,
              region_id: profile?.region_id,
            }));
            return supabase.from("next_of_kin").insert(nokRecords);
          }
        })
      );

      // Guarantors - sequential delete then insert to avoid race condition
      upsertPromises.push(
        supabase.from("guarantors").delete().eq("customer_id", customerId).then(() => {
          if (formData.guarantors.length > 0) {
            const guarantorRecords = formData.guarantors.map((g, idx) => ({
              customer_id: customerId,
              Firstname: g.Firstname || null,
              Surname: g.Surname || null,
              Middlename: g.Middlename || null,
              id_number: g.idNumber || null,
              marital_status: g.maritalStatus || null,
              gender: g.gender || null,
              mobile: g.mobile || null,
              alternative_number: g.alternativeMobile || null,
              residence_status: g.residenceStatus || null,
              postal_address: g.postalAddress || null,
              code: g.code ? parseInt(g.code) : null,
              occupation: g.occupation || null,
              relationship: g.relationship || null,
              date_of_birth: g.dateOfBirth || null,
              county: g.county || null,
              city_town: g.cityTown || null,
              passport_url: guarantorDocs[idx]?.passport || null,
              id_front_url: guarantorDocs[idx]?.idFront || null,
              id_back_url: guarantorDocs[idx]?.idBack || null,
              created_by: profile?.id,
              tenant_id: profile?.tenant_id,
              branch_id: profile?.branch_id,
              region_id: profile?.region_id,
            }));
            return supabase.from("guarantors").insert(guarantorRecords).select("id");
          }
        })
      );

      // Document verification images
      const documentRecords = [
        { file: officerClientUrl1, type: "First Officer and Client Image" },
        { file: officerClientUrl2, type: "Second Officer and Client Image" },
        { file: bothOfficersUrl, type: "Both Officers Image" },
      ]
        .filter(doc => doc.file)
        .map(doc => ({
          customer_id: customerId,
          document_type: doc.type,
          document_url: doc.file,
          created_by: profile?.id,
          tenant_id: profile?.tenant_id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        }));

      if (documentRecords.length > 0) {
        upsertPromises.push(supabase.from("documents").delete().eq("customer_id", customerId));
        upsertPromises.push(supabase.from("documents").insert(documentRecords));
      }

      await Promise.all(upsertPromises);

      // Handle security items - link to primary guarantor
      // Extract the result of the guarantor insert from the upsertPromises array or just re-fetch the latest
      // To be safe and fast, we fetch the primary guarantor ID created/updated for this customer
      const { data: primaryG } = await supabase
        .from("guarantors")
        .select("id")
        .eq("customer_id", customerId)
        .order('id', { ascending: true })
        .limit(1)
        .single();
      
      const primaryGuarantorId = primaryG?.id;

      if (securityItems?.length > 0) {
        await supabase.from("security_items").delete().eq("customer_id", customerId).eq("is_guarantor", false);
        await insertSecurityItemsOptimized(securityItems, securityUrls, customerId, false);
      }

      if (guarantorSecurityItems?.length > 0 && primaryGuarantorId) {
        await supabase.from("security_items").delete().eq("customer_id", primaryGuarantorId).eq("is_guarantor", true);
        await insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecUrls, primaryGuarantorId, true);
      }

      toast.success("Draft saved successfully!");
      navigate('/registry/customers');

    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.3,          // Reduced from 0.5MB to 0.3MB
      maxWidthOrHeight: 1024,   // Reduced from 1280 to 1024
      useWebWorker: true,
      initialQuality: 0.7,      // Added: Start with lower quality
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error("Image compression error:", error);
      return file;
    }
  };

  // 2. Batch upload function with parallel processing
  // 3. Optimized single file upload with integrated compression and local URL construction
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

      // SPEED OPTIMIZATION: Construct Public URL locally instead of another network call
      // Format: https://[PROJECT_REF].supabase.co/storage/v1/object/public/[BUCKET]/[PATH]
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${data.path}`;
      
      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const uploadFilesBatch = async (files, pathPrefix, bucket = "customers") => {
    if (!files || files.length === 0) return [];
    // Parallel upload with integrated compression
    const uploadPromises = files.map(file => {
      const path = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
      return uploadFile(file, path, bucket);
    });
    const urls = await Promise.all(uploadPromises);
    return urls.filter(Boolean);
  };

  // 4. ULTRA-FAST handleSubmit with parallel uploads
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Fast local validation (DB uniqueness already checked per-step)
      const isValid = validateFormFast();
      if (!isValid) {
        setIsSubmitting(false);
        return;
      }

      const timestamp = Date.now();

      // 2. PIPELINED COMPRESSION & UPLOAD (MAX SPEED)
      // We start ALL uploads in parallel, but we only wait for the "Critical" ones 
      // needed to create the Customer record. The rest will finish while the DB works.
      
      // Helper to process all files for a guarantor
      const processGuarantorFiles = async (index) => {
        const [pass, idF, idB] = await Promise.all([
          guarantorPassportFiles[index] ? uploadFile(guarantorPassportFiles[index], `guarantor/${timestamp}_${index}_pass_${guarantorPassportFiles[index].name}`) : null,
          guarantorIdFrontFiles[index] ? uploadFile(guarantorIdFrontFiles[index], `guarantor/${timestamp}_${index}_idf_${guarantorIdFrontFiles[index].name}`) : null,
          guarantorIdBackFiles[index] ? uploadFile(guarantorIdBackFiles[index], `guarantor/${timestamp}_${index}_idb_${guarantorIdBackFiles[index].name}`) : null,
        ]);
        return { passport: pass, idFront: idF, idBack: idB };
      };

      // Start Critical Uploads
      const criticalUploadsPromise = Promise.all([
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : null,
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : null,
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : null,
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : null,
      ]);

      // Start Secondary Uploads (in parallel with critical ones)
      const secondaryUploadsPromise = Promise.all([
        Promise.all(formData.guarantors.map((_, i) => processGuarantorFiles(i))),
        businessImages.length > 0 ? uploadFilesBatch(businessImages, "business") : Promise.resolve([]),
        officerClientImage1 ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`) : Promise.resolve(null),
        officerClientImage2 ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`) : Promise.resolve(null),
        bothOfficersImage ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`) : Promise.resolve(null),
        securityItemImages.length > 0 ? Promise.all(securityItemImages.map(imgs => uploadFilesBatch(imgs, "borrower_security"))) : Promise.resolve([]),
        guarantorSecurityImages.length > 0 ? Promise.all(guarantorSecurityImages.map(imgs => uploadFilesBatch(imgs, "guarantor_security"))) : Promise.resolve([]),
      ]);

      // Wait ONLY for critical docs to create the customer record
      const [passportUrl, idFrontUrl, idBackUrl, houseImageUrl] = await criticalUploadsPromise;

      // 3. Insert Customer
      const customerPayload = {
        prefix: formData.prefix || null,
        Firstname: formData.Firstname || null,
        Surname: formData.Surname || null,
        Middlename: formData.Middlename || null,
        marital_status: formData.maritalStatus || null,
        residence_status: formData.residenceStatus || null,
        mobile: formData.mobile || null,
        alternative_mobile: formData.alternativeMobile || null,
        occupation: formData.occupation || null,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        id_number: formData.idNumber || null,
        postal_address: formData.postalAddress || null,
        code: formData.code ? parseInt(formData.code, 10) || null : null,
        town: formData.town || null,
        county: formData.county || null,
        business_county: formData.businessCounty || null,
        business_name: formData.businessName || null,
        industry: formData.industry || null,
        business_type: formData.businessType || null,
        daily_Sales: formData.daily_Sales ? parseFloat(formData.daily_Sales) : null,
        year_established: formData.yearEstablished || null,
        business_location: formData.businessLocation || null,
        business_lat: formData.businessCoordinates?.lat || null,
        business_lng: formData.businessCoordinates?.lng || null,
        road: formData.road || null,
        landmark: formData.landmark || null,
        has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
        prequalifiedAmount: formData.prequalifiedAmount ? Math.round(parseFloat(formData.prequalifiedAmount)) || null : null,
        passport_url: passportUrl,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        house_image_url: houseImageUrl,
        status: "bm_review",
        form_status: "submitted",
        created_by: profile?.id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        tenant_id: profile?.tenant_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .insert([customerPayload])
        .select("id, status")
        .single();

      if (customerError) throw customerError;
      const customerId = customerData.id;

      // Initiate workflow for the new customer
      try {
        await apiFetch('/api/workflows/start', {
          method: 'POST',
          body: JSON.stringify({
            entity_id: customerId,
            entity_type: 'customer',
            tenant_id: profile?.tenant_id
          })
        });
      } catch (wfError) {
        console.error("Failed to start workflow for customer:", wfError);
        // We don't throw here to avoid failing the whole submission if workflow initiation fails, 
        // but in a production app you might want more robust error handling.
      }

      // NOW wait for secondary uploads to complete (they were running in background)
      const [
        guarantorDocs,
        businessUrls,
        officerClientUrl1,
        officerClientUrl2,
        bothOfficersUrl,
        securityUrls,
        guarantorSecUrls
      ] = await secondaryUploadsPromise;

      // 4. PARALLEL INSERT: All related records at once
      const insertPromises = [];

      // Business images
      if (businessUrls.length > 0) {
        insertPromises.push(supabase.from("business_images").insert(
          businessUrls.map(url => ({
            customer_id: customerId,
            image_url: url,
            created_by: profile?.id,
            tenant_id: profile?.tenant_id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString(),
          }))
        ));
      }

      // Spouse
      if (formData.maritalStatus === "Married" && formData.spouse) {
        insertPromises.push(supabase.from("spouse").insert([{
          customer_id: customerId,
          name: formData.spouse.name || null,
          id_number: formData.spouse.idNumber || null,
          mobile: formData.spouse.mobile || null,
          economic_activity: formData.spouse.economicActivity || null,
          created_by: profile?.id,
          tenant_id: profile?.tenant_id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        }]));
      }

      // Next of Kin (Multiplicity)
      if (formData.nextOfKins.length > 0) {
        insertPromises.push(supabase.from("next_of_kin").insert(
          formData.nextOfKins.map(nok => ({
            customer_id: customerId,
            Firstname: nok.Firstname || null,
            Surname: nok.Surname || null,
            Middlename: nok.Middlename || null,
            id_number: nok.idNumber || null,
            relationship: nok.relationship || null,
            mobile: nok.mobile || null,
            alternative_number: nok.alternativeNumber || null,
            employment_status: nok.employmentStatus || null,
            county: nok.county || null,
            city_town: nok.cityTown || null,
            company_name: nok.companyName || null,
            salary: nok.salary ? parseFloat(nok.salary) : null,
            business_name: nok.businessName || null,
            business_income: nok.businessIncome ? parseFloat(nok.businessIncome) : null,
            relationship_other: nok.relationshipOther || null,
            created_by: profile?.id,
            tenant_id: profile?.tenant_id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString(),
          }))
        ).then(res => {
          if (res.error && res.error.code === '409') {
             console.error("Conflict error in next_of_kin. Ensure SQL script drop-unique was run.", res.error);
             toast.error("Database conflict in Next of Kin. Multiple NOks might not be allowed in schema yet.");
          }
          return res;
        }));
      }

      // Guarantors (Multiplicity)
      let guarantorResultPromise = Promise.resolve({ data: [] });
      if (formData.guarantors.length > 0) {
        // IMPORTANT: We add .then(res => res) to convert the lazy Supabase query builder into a real Promise immediately.
        // This prevents the query from being executed twice when awaited multiple times (once in Promise.all and once individually).
        guarantorResultPromise = supabase.from("guarantors").insert(
          formData.guarantors.map((g, idx) => ({
            customer_id: customerId,
            Firstname: g.Firstname || null,
            Surname: g.Surname || null,
            Middlename: g.Middlename || null,
            id_number: g.idNumber || null,
            marital_status: g.maritalStatus || null,
            gender: g.gender || null,
            mobile: g.mobile || null,
            alternative_number: g.alternativeMobile || null,
            residence_status: g.residenceStatus || null,
            postal_address: g.postalAddress || null,
            code: g.code ? parseInt(g.code, 10) || null : null,
            occupation: g.occupation || null,
            relationship: g.relationship || null,
            date_of_birth: g.dateOfBirth || null,
            county: g.county || null,
            city_town: g.cityTown || null,
            passport_url: guarantorDocs[idx]?.passport || null,
            id_front_url: guarantorDocs[idx]?.idFront || null,
            id_back_url: guarantorDocs[idx]?.idBack || null,
            created_by: profile?.id,
            tenant_id: profile?.tenant_id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString(),
          }))
        ).select("id").then(res => res); // Convert to real Promise immediately to avoid duplication on double await
        
        insertPromises.push(guarantorResultPromise);
      }

      // Document verification images
      const documentRecords = [
        { file: officerClientUrl1, type: "First Officer and Client Image" },
        { file: officerClientUrl2, type: "Second Officer and Client Image" },
        { file: bothOfficersUrl, type: "Both Officers Image" },
      ].filter(doc => doc.file).map(doc => ({
        customer_id: customerId,
        document_type: doc.type,
        document_url: doc.file,
        created_by: profile?.id,
        tenant_id: profile?.tenant_id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        created_at: new Date().toISOString(),
      }));

      if (documentRecords.length) {
        insertPromises.push(supabase.from("documents").insert(documentRecords));
      }

      // Execute all inserts in parallel and surface any DB errors
      const insertResults = await Promise.all(insertPromises);
      
      // Extract results carefully (Guarantors was pushed at index 3/4 depending on spouse)
      // Actually, we can just find it in the array or use the Promise we held onto.
      // Since it was already awaited in Promise.all, it's safe to check guarantorResultPromise.
      // In JS, awaiting an already-resolved promise just returns its value immediately.
      const guarantorRes = await guarantorResultPromise; 
      const guarantorIds = guarantorRes?.data?.map(r => r.id) || [];

      for (const res of insertResults) {
        if (res?.error) {
          const code = res.error.code;
          if (code === '23505' || res.error.message?.includes('409') || res.error.message?.includes('unique')) {
            throw new Error(`Database constraint error: A record with these details already exists. Please run the fix_persistence_and_permissions.sql script in Supabase.`);
          }
          if (res.error.message?.includes('403') || res.error.message?.includes('policy') || code === '42501') {
            throw new Error(`Permission denied: Missing database policy. Please run the fix_persistence_and_permissions.sql script in Supabase.`);
          }
          throw new Error(res.error.message || `Database error (${code})`);
        }
      }

      // 5. FINAL PARALLEL STEP: Security items
      const securityPromises = [
        insertSecurityItemsOptimized(securityItems, securityUrls, customerId, false)
      ];
      
      // Link security items to THEIR respective guarantors
      if (guarantorIds.length > 0 && guarantorSecurityItems.length > 0) {
        guarantorIds.forEach((gid, index) => {
          if (index === 0 && guarantorSecurityItems.length > 0) {
             securityPromises.push(insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecUrls, gid, true));
          }
        });
      }

      await Promise.all(securityPromises);

      toast.success("Customer application submitted successfully!");
      navigate("/registry/customers");

    } catch (error) {
      console.error("Form submission error:", error.message, error);
      toast.error(error.message || "An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const insertSecurityItemsOptimized = async (items, preUploadedUrls, ownerId, isGuarantor) => {
    if (!items?.length) return;

    const table = isGuarantor ? "guarantor_security" : "security_items";
    const ownerKey = isGuarantor ? "guarantor_id" : "customer_id";
    const valueKey = isGuarantor ? "estimated_market_value" : "value";

    // 1. Insert all security items
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

    const { data: insertedItems, error: secError } = await supabase
      .from(table)
      .insert(itemsToInsert)
      .select("id");

    if (secError) {
      console.error(`Error inserting ${isGuarantor ? 'guarantor' : 'borrower'} security:`, secError);
      return;
    }

    if (!insertedItems?.length) return;

    // 2. Map pre-uploaded URLs to the inserted records
    const imageRecords = insertedItems.flatMap((item, index) => {
      const itemUrls = preUploadedUrls[index] || [];
      return itemUrls.map((url) => ({
        [isGuarantor ? "guarantor_security_id" : "security_item_id"]: item.id,
        image_url: url,
        created_by: profile?.id,
        tenant_id: profile?.tenant_id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        created_at: new Date().toISOString(),
      }));
    });

    // 3. Insert all image records at once
    if (imageRecords.length) {
      const imageTable = isGuarantor ? "guarantor_security_images" : "security_item_images";
      const { error: imgError } = await supabase.from(imageTable).insert(imageRecords);

      if (imgError) {
        console.error(`Error inserting ${isGuarantor ? 'guarantor' : 'borrower'} security images:`, imgError);
      }
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

export default AddCustomer;