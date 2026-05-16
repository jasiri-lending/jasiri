import { useState, memo, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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

import Form, { INDUSTRIES } from "./Form";


const CustomerForm = ({ leadData: propLeadData, }) => {


  const location = useLocation();

  // receive data from props OR from navigation state
  const leadData = propLeadData || location.state?.leadData || null;
  const guarantorData = location.state?.guarantorData || null;
  const fromGuarantors = location.state?.fromGuarantors || false;
  const [activeSection, setActiveSection] = useState("personal");

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const [completedSections, setCompletedSections] = useState(new Set());
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
    businessType: '',
    daily_Sales: '',
    yearEstablished: '',
    businessLocation: '',
    businessCoordinates: null,
    road: '',
    landmark: '',
    hasLocalAuthorityLicense: '',
    prequalifiedAmount: '',
    industry: '',

    // Nested objects (Now arrays for multiplicity)
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
      relationship_other: '',
      id_no: ''
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


  // Prefill from leads
  useEffect(() => {
    if (leadData) {
      const indExists = leadData.industry && Object.keys(INDUSTRIES).includes(leadData.industry);
      const typeExists = indExists && leadData.business_type && INDUSTRIES[leadData.industry].includes(leadData.business_type);

      setFormData((prev) => ({
        ...prev,
        Firstname: leadData.Firstname || "",
        Surname: leadData.Surname || "",
        mobile: leadData.mobile || leadData.phone || "",
        businessName: leadData.business_name || "",
        businessLocation: leadData.business_location || "",
        businessCounty: leadData.business_location || "", // Map business_location to businessCounty
        businessType: leadData.business_type || "",
        industry: leadData.industry || "",
      }));

      if (leadData.industry && !indExists) setIsCustomIndustry(true);
      if (leadData.business_type && !typeExists) setIsCustomType(true);
    }
  }, [leadData]);

  // Prefill from guarantors
  useEffect(() => {
    if (guarantorData) {
      setFormData((prev) => ({
        ...prev,
        prefix: guarantorData.prefix || "",
        Firstname: guarantorData.Firstname || "",
        Surname: guarantorData.Surname || "",
        Middlename: guarantorData.Middlename || "",
        maritalStatus: guarantorData.marital_status || "",
        residenceStatus: guarantorData.residence_status || "",
        mobile: guarantorData.mobile || "",
        alternativeMobile: guarantorData.alternative_number || "",
        occupation: guarantorData.occupation || "",
        dateOfBirth: guarantorData.date_of_birth || "",
        gender: guarantorData.gender || "",
        idNumber: guarantorData.id_number || "",
        postalAddress: guarantorData.postal_address || "",
        code: guarantorData.code || "",
        town: guarantorData.city_town || "",
        county: guarantorData.county || "",
        passport_url: guarantorData.passport_url || "",
        id_front_url: guarantorData.id_front_url || "",
        id_back_url: guarantorData.id_back_url || "",
      }));

      // Map security items from guarantor_security (or alias) to securityItems (Borrower Security)
      const rawSecurityItems = guarantorData.guarantor_security || guarantorData.guarantorSecurity || guarantorData.security_items || [];
      
      if (rawSecurityItems.length > 0) {
        // Use a "Universal Mapping" that handles all DB field variations found in the project
        const mappedSecurity = rawSecurityItems.map(gs => {
          // Robustly find images in nested response (handles different join names)
          const nestedImages = gs.guarantor_security_images || gs.security_images || gs.images || gs.security_item_images || [];
          const imageUrls = Array.isArray(nestedImages) 
            ? nestedImages.map(img => typeof img === 'string' ? img : (img.image_url || img.url)).filter(Boolean)
            : [];

          // Search for any known names for each field
          const rawType = (gs.item || gs.type || gs.item_name || gs.security_type || "").trim();
          const rawDescription = (gs.description || gs.item_description || "").trim();
          const rawIdentification = (gs.identification || gs.item_identification || gs.identification_number || "").trim();
          const rawValue = gs.estimated_market_value || gs.value || gs.item_value || gs.est_market_value || "";

          const validTypes = [
            "Household Items", "Business Equipment", "Livestock", 
            "Motor Vehicle", "Motorbike", "Land / Property", 
            "Title deed", "Logbook", "Salary Check-off", 
            "Stock / Inventory", "Fixed deposit / Savings security", "Electronics"
          ];
          
          // Determine if we should use the "Other" category and populate otherType
          const isOther = rawType && !validTypes.includes(rawType);

          return {
            type: isOther ? "Other" : rawType,
            description: rawDescription,
            value: rawValue,
            identification: rawIdentification,
            otherType: isOther ? rawType : "",
            existingImages: imageUrls
          };
        });

        // Set state for image containers first to ensure the UI has slots for newly uploaded files
        setSecurityItemImages(Array.from({ length: mappedSecurity.length }, () => []));
        setSecurityItems(mappedSecurity);
      }
    }
  }, [guarantorData]);


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
  const [guarantorPassportFiles, setGuarantorPassportFiles] = useState([]);
  const [guarantorIdFrontFiles, setGuarantorIdFrontFiles] = useState([]);
  const [guarantorIdBackFiles, setGuarantorIdBackFiles] = useState([]);
  const [guarantorSecurityImages, setGuarantorSecurityImages] = useState([]);
  const [officerClientImage1, setOfficerClientImage1] = useState(null);
  const [officerClientImage2, setOfficerClientImage2] = useState(null);
  const [bothOfficersImage, setBothOfficersImage] = useState(null);
  const [previews, setPreviews] = useState({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState(new Set());
  const { error, success } = useToast();




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

      // Handle dependent location selects
      if (name === "county") {
        setFormData(prev => ({ ...prev, county: value, town: "" }));
      } else if (name === "businessCounty") {
        setFormData(prev => ({ ...prev, businessCounty: value, businessLocation: "" }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }

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

  // Similarly update handleNestedChange for spouse fields
  const handleNestedChange = useCallback(
    async (e, section, index = null) => {
      if (!e || !e.target) return;
      const { name, value } = e.target;

      setFormData((prev) => {
        // Sections that are arrays
        if (["guarantors", "nextOfKins"].includes(section)) {
          if (index === null || !Array.isArray(prev[section])) {
            console.error(`Attempted to update ${section} as an array but index is null or state is not an array`);
            return prev;
          }
          const newArray = [...prev[section]];
          const updates = { [name]: value };

          // Reset dependent location fields if county changes
          if (name === "county") {
            if (newArray[index].cityTown !== undefined) updates.cityTown = "";
            if (newArray[index].town !== undefined) updates.town = "";
          }

          newArray[index] = { ...newArray[index], ...updates };
          return { ...prev, [section]: newArray };
        }

        // Sections that are objects (like spouse)
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
        // Spouse ID validation
        if (name === "idNumber" && value) {
          if (!/^[0-9]{6,12}$/.test(value)) {
            setErrors((prev) => ({
              ...prev,
              spouseIdNumber: "Spouse ID must be 6–12 digits",
            }));
          }
        }

        // Spouse mobile validation
        if (name === "mobile" && value) {
          const cleaned = value.replace(/\D/g, "");
          if (!/^[0-9]{10,15}$/.test(cleaned)) {
            setErrors((prev) => ({
              ...prev,
              spouseMobile: "Invalid spouse mobile format (10-15 digits)",
            }));
          }
        }
      }

      // Live validation for guarantor fields
      if (section === "guarantor") {
        // Guarantor mobile validation
        if (name === "mobile" && value) {
          const cleaned = value.replace(/\D/g, "");
          if (!/^[0-9]{10,15}$/.test(cleaned)) {
            setErrors((prev) => ({
              ...prev,
              guarantorMobile: "Invalid guarantor mobile format (10-15 digits)",
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
                guarantorMobile: "Guarantor mobile number already exists",
              }));
            }
          }
        }

        // Guarantor ID validation
        if (name === "idNumber" && value) {
          if (!/^[0-9]{6,12}$/.test(value)) {
            setErrors((prev) => ({
              ...prev,
              guarantorIdNumber: "Guarantor ID must be 6–12 digits",
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
                guarantorIdNumber: "Guarantor ID number already exists",
              }));
            }
          }
        }

        // Guarantor age validation
        if (name === "dateOfBirth" && value) {
          if (!isAtLeast18YearsOld(value)) {
            setErrors((prev) => ({
              ...prev,
              guarantorDateOfBirth: "Guarantor must be at least 18 years old",
            }));
          }
        }
      }

      // Live validation for next of kin fields
      if (section === "nextOfKin") {
        // Next of kin mobile validation
        if (name === "mobile" && value) {
          const cleaned = value.replace(/\D/g, "");
          if (!/^[0-9]{10,15}$/.test(cleaned)) {
            setErrors((prev) => ({
              ...prev,
              nextOfKinMobile: "Invalid next of kin mobile format (10-15 digits)",
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
                nextOfKinMobile: "Next of kin mobile number already exists",
              }));
            }
          }
        }

        // Next of kin ID validation
        if (name === "idNumber" && value) {
          if (!/^[0-9]{6,12}$/.test(value)) {
            setErrors((prev) => ({
              ...prev,
              nextOfKinIdNumber: "Next of kin ID must be 6–12 digits",
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
                nextOfKinIdNumber: "Next of kin ID number already exists",
              }));
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

  const addSecurityItem = () => {
    setSecurityItems([
      ...securityItems,
      { type: "", description: "", identification: "", value: "", otherType: "" },
    ]);
    setSecurityItemImages([...securityItemImages, []]);
  };

  const removeSecurityItem = (index) => {
    setSecurityItems((prev) => prev.filter((_, i) => i !== index));
    setSecurityItemImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeGuarantorSecurityItem = (index) => {
    setGuarantorSecurityItems((prev) => prev.filter((_, i) => i !== index));
    setGuarantorSecurityImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addGuarantor = () => {
    setFormData((prev) => ({
      ...prev,
      guarantors: [
        ...prev.guarantors,
        {
          prefix: "",
          Firstname: "",
          Surname: "",
          Middlename: "",
          idNumber: "",
          maritalStatus: "",
          gender: "",
          mobile: "",
          alternativeMobile: "",
          residenceStatus: "",
          postalAddress: "",
          code: "",
          occupation: "",
          relationship: "",
          dateOfBirth: "",
          county: "",
          cityTown: "",
        },
      ],
    }));
    setGuarantorPassportFiles((prev) => [...prev, null]);
    setGuarantorIdFrontFiles((prev) => [...prev, null]);
    setGuarantorIdBackFiles((prev) => [...prev, null]);
  };

  const removeGuarantor = (index) => {
    setFormData((prev) => ({
      ...prev,
      guarantors: prev.guarantors.filter((_, i) => i !== index),
    }));
    setGuarantorPassportFiles((prev) => prev.filter((_, i) => i !== index));
    setGuarantorIdFrontFiles((prev) => prev.filter((_, i) => i !== index));
    setGuarantorIdBackFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addGuarantorSecurityItem = () => {
    setGuarantorSecurityItems([
      ...guarantorSecurityItems,
      { item: "", description: "", identification: "", value: "" },
    ]);
    setGuarantorSecurityImages([...guarantorSecurityImages, []]);
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
  const handleFileUpload = async (e, setter, key, index = null) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input to allow re-uploading same file
    e.target.value = null;

    if (uploadedFiles.has(file.name)) {
      error("already been uploaded somewhere else");
      return;
    }

    try {
      const compressedFile = await compressImage(file);

      // Save the file in the corresponding field
      if (index !== null) {
        setter((prev) => {
          const next = [...prev];
          next[index] = compressedFile;
          return next;
        });
      } else {
        setter(compressedFile);
      }

      // Store preview with fileName and URL
      const previewKey = index !== null ? `${key}_${index}` : key;
      setPreviews((prev) => ({
        ...prev,
        [previewKey]: {
          url: URL.createObjectURL(compressedFile),
          fileName: file.name,
        },
      }));

      // Add to global tracker
      setUploadedFiles((prev) => {
        const newSet = new Set(prev);
        newSet.add(file.name);
        return newSet;
      });

      console.log(`File saved for ${previewKey}:`, compressedFile.name);
    } catch (err) {
      console.error(err);
      error("Unexpected error during file selection.");
    }
  };

  // Fixed file removal handler
  const handleRemoveFile = (key, setter, index = null) => {
    // Get the corresponding preview key
    const previewKey = index !== null ? `${key}_${index}` : key;
    
    // Get the current file associated with this key
    const file = previews[previewKey]?.fileName;

    // Remove from global tracker
    if (file && uploadedFiles.has(file)) {
      setUploadedFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(file);
        return newSet;
      });
    }

    // Clear the file state
    if (index !== null) {
      setter((prev) => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
    } else {
      setter(null);
    }

    // Revoke the object URL and clear preview
    setPreviews((prev) => {
      const url = prev?.[previewKey]?.url;
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch (err) {
          console.warn("Failed to revoke object URL", err);
        }
      }
      return { ...prev, [previewKey]: null };
    });
  };

  // Fixed multiple file handler for security items
  const handleMultipleFiles = (e, index, setter) => {
    const files = Array.from(e.target.files);
    const validFiles = [];

    files.forEach(file => {
      if (uploadedFiles.has(file.name)) {
        error("already been uploaded somewhere else");
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
    setter(prev => {
      const updated = [...(prev[index] || []), ...validFiles];
      const allUpdated = [...prev];
      allUpdated[index] = updated;
      return allUpdated;
    });

    // Reset input to allow re-uploading same file later
    e.target.value = null;
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
      error("already been uploaded somewhere else");
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
      error("First name is required");
      hasErrors = true;
    }
    if (!formData.Surname?.trim()) {
      newErrors.Surname = "Surname is required";
      error("Surname is required");
      hasErrors = true;
    }
    if (!formData.mobile?.trim()) {
      newErrors.mobile = "Mobile number is required";
      error("Mobile number is required");
      hasErrors = true;
    }

    if (!formData.idNumber?.trim()) {
      newErrors.idNumber = "ID number is required";
      error("ID number is required");
      hasErrors = true;
    }

    if (formData.mobile && !/^[0-9]{10,15}$/.test(formData.mobile.replace(/\D/g, ""))) {
      newErrors.mobile = "Please enter a valid mobile number (10-15 digits)";
      error("Invalid mobile number format");
      hasErrors = true;
    }
    if (formData.alternativeMobile && !/^[0-9]{10,15}$/.test(formData.alternativeMobile.replace(/\D/g, ""))) {
      newErrors.alternativeMobile = "Please enter a valid alternative mobile number (10-15 digits)";
      error("Invalid alternative mobile number format");
      hasErrors = true;
    }

    if (formData.idNumber && !/^[0-9]{6,12}$/.test(formData.idNumber)) {
      newErrors.idNumber = "Please enter a valid ID number (6-12 digits)";
      error("Invalid ID number format");
      hasErrors = true;
    }

    if (formData.dateOfBirth && !isAtLeast18YearsOld(formData.dateOfBirth)) {
      newErrors.dateOfBirth = "Customer must be at least 18 years old";
      error("Customer must be at least 18 years old");
      hasErrors = true;
    }

    // Validate spouse info if married
    if (formData.maritalStatus === "Married") {
      if (!formData.spouse.name?.trim()) {
        newErrors.spouseName = "Spouse name is required for married customers";
        error("Spouse name is required");
        hasErrors = true;
      }
      if (!formData.spouse.idNumber?.trim()) {
        newErrors.spouseIdNumber = "Spouse ID number is required for married customers";
        error("Spouse ID number is required");
        hasErrors = true;
      }
      if (!formData.spouse.mobile?.trim()) {
        newErrors.spouseMobile = "Spouse mobile number is required for married customers";
        error("Spouse mobile number is required");
        hasErrors = true;
      }
      if (!formData.spouse.economicActivity?.trim()) {
        newErrors.spouseEconomicActivity = "Spouse economic activity is required for married customers";
        error("Spouse economic activity is required");
        hasErrors = true;
      }

      // Validate spouse ID format
      if (formData.spouse.idNumber && !/^[0-9]{6,12}$/.test(formData.spouse.idNumber)) {
        newErrors.spouseIdNumber = "Please enter a valid spouse ID number (6-12 digits)";
        error("Invalid spouse ID number format");
        hasErrors = true;
      }

      // Validate spouse mobile format
      if (formData.spouse.mobile && !/^[0-9]{10,15}$/.test(formData.spouse.mobile.replace(/\D/g, ""))) {
        newErrors.spouseMobile = "Please enter a valid spouse mobile number (10-15 digits)";
        error("Invalid spouse mobile number format");
        hasErrors = true;
      }
    }

    const fieldsToCheck = [
      { field: "mobile", value: formData.mobile, label: "Mobile number" },
      { field: "alternativeMobile", value: formData.alternativeMobile, label: "Alternative mobile" },
      { field: "idNumber", value: formData.idNumber, label: "ID number" },
    ];

    // When converting a guarantor → customer, their ID/mobile already exist in
    // the guarantors table by design. Only check `customers` and `next_of_kin`
    // to prevent duplicate customer records while allowing the conversion.
    const tablesToCheck = fromGuarantors
      ? ["customers", "next_of_kin"]
      : ["customers", "guarantors", "next_of_kin"];

    // Paralellize uniqueness checks
    const uniqueChecks = fieldsToCheck
      .filter(({ value, field }) => value && !newErrors[field])
      .map(async ({ field, value, label }) => {
        try {
          const isUnique = await checkUniqueValue(
            tablesToCheck,
            field === "idNumber" ? "id_number" : "mobile",
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
    results.filter(Boolean).forEach(({ field, error: errorMsg }) => {
      newErrors[field] = errorMsg;
      error(errorMsg);
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
      error("Business name is required");
      hasErrors = true;
    }

    if (!formData.businessType?.trim()) {
      errorsFound.businessType = "Business type is required";
      error("Business type is required");
      hasErrors = true;
    }

    if (!formData.yearEstablished) {
      errorsFound.yearEstablished = "Year established is required";
      error("Year established is required");
      hasErrors = true;
    } else {
      const establishedDate = new Date(formData.yearEstablished);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      if (establishedDate > sixMonthsAgo) {
        errorsFound.yearEstablished = "Business must be at least 6 months old";
        error("Business must be at least 6 months old");
        hasErrors = true;
      }
    }

    if (!formData.businessLocation?.trim()) {
      errorsFound.businessLocation = "Business location is required";
      error("Business location is required");
      hasErrors = true;
    }

    if (!formData.road?.trim()) {
      errorsFound.road = "Road is required";
      error("Road is required");
      hasErrors = true;
    }

    if (!formData.landmark?.trim()) {
      errorsFound.landmark = "Landmark is required";
      error("Landmark is required");
      hasErrors = true;
    }

    if (!formData.daily_Sales) {
      errorsFound.daily_Sales = "Daily sales estimate is required";
      error("Daily sales estimate is required");
      hasErrors = true;
    } else if (parseFloat(formData.daily_Sales) <= 0) {
      errorsFound.daily_Sales = "Daily sales must be greater than 0";
      error("Daily sales must be greater than 0");
      hasErrors = true;
    }

    if (!formData.businessCoordinates?.lat || !formData.businessCoordinates?.lng) {
      errorsFound.businessCoordinates = "Business GPS coordinates are required";
      error("Please set business GPS location");
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
      error("At least one security item is required");
      hasErrors = true;
    }

    securityItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        errorsFound[`security_description_${index}`] = "Description is required";
        error(`Security Item ${index + 1}: Description is required`);
        hasErrors = true;
      }

      if (!item.value || parseFloat(item.value) <= 0) {
        errorsFound[`security_value_${index}`] = "Estimated value must be greater than 0";
        error(`Security Item ${index + 1}: Value must be greater than 0`);
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
      error("Pre-qualified amount is required");
      hasErrors = true;
    } else if (parseFloat(formData.prequalifiedAmount) <= 0) {
      errorsFound.prequalifiedAmount = "Loan amount must be greater than 0";
      error("Loan amount must be greater than 0");
      hasErrors = true;
    }

    setErrors(errorsFound);
    return !hasErrors;
  };

  const validateGuarantorDetails = async () => {
    const errorsFound = {};
    let hasErrors = false;

    const uniqueChecks = [];

    formData.guarantors.forEach((g, index) => {
      const { Firstname, Surname, mobile, idNumber, dateOfBirth, gender } = g;

      if (!Firstname?.trim()) {
        errorsFound[`guarantors_${index}_Firstname`] = `Guarantor ${index + 1}: First name is required`;
        error(errorsFound[`guarantors_${index}_Firstname`]);
        hasErrors = true;
      }
      if (!Surname?.trim()) {
        errorsFound[`guarantors_${index}_Surname`] = `Guarantor ${index + 1}: Surname is required`;
        error(errorsFound[`guarantors_${index}_Surname`]);
        hasErrors = true;
      }
      if (!gender?.trim()) {
        errorsFound[`guarantors_${index}_gender`] = `Guarantor ${index + 1}: Gender is required`;
        error(errorsFound[`guarantors_${index}_gender`]);
        hasErrors = true;
      }
      if (!mobile?.trim()) {
        errorsFound[`guarantors_${index}_mobile`] = `Guarantor ${index + 1}: Mobile number is required`;
        error(errorsFound[`guarantors_${index}_mobile`]);
        hasErrors = true;
      }
      if (!idNumber?.trim()) {
        errorsFound[`guarantors_${index}_idNumber`] = `Guarantor ${index + 1}: ID number is required`;
        error(errorsFound[`guarantors_${index}_idNumber`]);
        hasErrors = true;
      }

      if (mobile && !/^[0-9]{10,15}$/.test(mobile.replace(/\D/g, ""))) {
        errorsFound[`guarantors_${index}_mobile`] = `Guarantor ${index + 1}: Invalid mobile format`;
        error(errorsFound[`guarantors_${index}_mobile`]);
        hasErrors = true;
      }
      if (idNumber && !/^[0-9]{6,12}$/.test(idNumber)) {
        errorsFound[`guarantors_${index}_idNumber`] = `Guarantor ${index + 1}: Invalid ID format`;
        error(errorsFound[`guarantors_${index}_idNumber`]);
        hasErrors = true;
      }

      if (dateOfBirth && !isAtLeast18YearsOld(dateOfBirth)) {
        errorsFound[`guarantors_${index}_dateOfBirth`] = `Guarantor ${index + 1}: Must be 18+`;
        error(errorsFound[`guarantors_${index}_dateOfBirth`]);
        hasErrors = true;
      }

      // Prepare uniqueness checks
      if (mobile && !errorsFound[`guarantors_${index}_mobile`]) {
        uniqueChecks.push((async () => {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", mobile.replace(/\D/g, ""), profile?.tenant_id, formData.id);
          if (!isUnique) {
            errorsFound[`guarantors_${index}_mobile`] = `Guarantor ${index + 1}: Mobile already exists`;
            error(errorsFound[`guarantors_${index}_mobile`]);
            hasErrors = true;
          }
        })());
      }
      if (idNumber && !errorsFound[`guarantors_${index}_idNumber`]) {
        uniqueChecks.push((async () => {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", idNumber, profile?.tenant_id, formData.id);
          if (!isUnique) {
            errorsFound[`guarantors_${index}_idNumber`] = `Guarantor ${index + 1}: ID already exists`;
            error(errorsFound[`guarantors_${index}_idNumber`]);
            hasErrors = true;
          }
        })());
      }
    });

    await Promise.all(uniqueChecks);
    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateGuarantorSecurity = () => {
    const errorsFound = {};
    let hasErrors = false;

    if (guarantorSecurityItems.length === 0) {
      errorsFound.guarantorSecurityItems = "At least one guarantor security item is required";
      error("At least one guarantor security item is required");
      hasErrors = true;
    }

    guarantorSecurityItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        errorsFound[`guarantor_security_description_${index}`] = "Description is required";
        error(`Guarantor Security ${index + 1}: Description is required`);
        hasErrors = true;
      }

      if (!item.value || parseFloat(item.value) <= 0) {
        errorsFound[`guarantor_security_value_${index}`] = "Estimated value must be greater than 0";
        error(`Guarantor Security ${index + 1}: Value must be greater than 0`);
        hasErrors = true;
      }
    });

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateNextOfKinDetails = async () => {
    const errorsFound = {};
    let hasErrors = false;
    const uniqueChecks = [];

    formData.nextOfKins.forEach((nok, index) => {
      const { Firstname, Surname, mobile, alternativeNumber, idNumber, relationship, employmentStatus } = nok;

      if (!Firstname?.trim()) {
        errorsFound[`nextOfKins_${index}_Firstname`] = `Next of Kin ${index + 1}: First name is required`;
        error(errorsFound[`nextOfKins_${index}_Firstname`]);
        hasErrors = true;
      }
      if (!Surname?.trim()) {
        errorsFound[`nextOfKins_${index}_Surname`] = `Next of Kin ${index + 1}: Surname is required`;
        error(errorsFound[`nextOfKins_${index}_Surname`]);
        hasErrors = true;
      }
      if (!mobile?.trim()) {
        errorsFound[`nextOfKins_${index}_mobile`] = `Next of Kin ${index + 1}: Mobile number is required`;
        error(errorsFound[`nextOfKins_${index}_mobile`]);
        hasErrors = true;
      }
      if (!idNumber?.trim()) {
        errorsFound[`nextOfKins_${index}_idNumber`] = `Next of Kin ${index + 1}: ID number is required`;
        error(errorsFound[`nextOfKins_${index}_idNumber`]);
        hasErrors = true;
      }

      if (mobile && !/^[0-9]{10,15}$/.test(mobile.replace(/\D/g, ""))) {
        errorsFound[`nextOfKins_${index}_mobile`] = `Next of Kin ${index + 1}: Invalid mobile format`;
        error(errorsFound[`nextOfKins_${index}_mobile`]);
        hasErrors = true;
      }
      if (idNumber && !/^[0-9]{6,12}$/.test(idNumber)) {
        errorsFound[`nextOfKins_${index}_idNumber`] = `Next of Kin ${index + 1}: Invalid ID format`;
        error(errorsFound[`nextOfKins_${index}_idNumber`]);
        hasErrors = true;
      }

      if (!relationship?.trim()) {
        errorsFound[`nextOfKins_${index}_relationship`] = `Next of Kin ${index + 1}: Relationship is required`;
        error(errorsFound[`nextOfKins_${index}_relationship`]);
        hasErrors = true;
      }
      if (!employmentStatus?.trim()) {
        errorsFound[`nextOfKins_${index}_employmentStatus`] = `Next of Kin ${index + 1}: Employment status is required`;
        error(errorsFound[`nextOfKins_${index}_employmentStatus`]);
        hasErrors = true;
      }

      // Uniqueness checks
      if (mobile && !errorsFound[`nextOfKins_${index}_mobile`]) {
        uniqueChecks.push((async () => {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", mobile.replace(/\D/g, ""), profile?.tenant_id, formData.id);
          if (!isUnique) {
            errorsFound[`nextOfKins_${index}_mobile`] = `Next of Kin ${index + 1}: Mobile already exists`;
            error(errorsFound[`nextOfKins_${index}_mobile`]);
            hasErrors = true;
          }
        })());
      }
      if (idNumber && !errorsFound[`nextOfKins_${index}_idNumber`]) {
        uniqueChecks.push((async () => {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", idNumber, profile?.tenant_id, formData.id);
          if (!isUnique) {
            errorsFound[`nextOfKins_${index}_idNumber`] = `Next of Kin ${index + 1}: ID already exists`;
            error(errorsFound[`nextOfKins_${index}_idNumber`]);
            hasErrors = true;
          }
        })());
      }
    });

    await Promise.all(uniqueChecks);
    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateDocuments = () => {
    if (!documentUploadEnabled) return true;
    let errorsFound = {};
    let hasErrors = false;

    if (!officerClientImage1) {
      errorsFound.officerClientImage1 = "First Officer and Client Image is required";
      error("First Officer and Client Image is required");
      hasErrors = true;
    }
    if (!officerClientImage2) {
      errorsFound.officerClientImage2 = "Second Officer and Client Image is required";
      error("Second Officer and Client Image is required");
      hasErrors = true;
    }
    if (!bothOfficersImage) {
      errorsFound.bothOfficersImage = "Both Officers Image is required";
      error("Both Officers Image is required");
      hasErrors = true;
    }

    setErrors(errorsFound);
    return !hasErrors;
  };

  // const handleNext = async () => {
  //   let isValid = false;

  //   switch (activeSection) {
  //     case "personal":
  //       isValid = await validatePersonalDetails();
  //       break;
  //     case "business":
  //       isValid = validateBusinessDetails();
  //       break;
  //     case "borrowerSecurity":
  //       isValid = validateBorrowerSecurity();
  //       break;
  //     case "loan":
  //       isValid = validateLoanDetails();
  //       break;
  //     case "guarantor":
  //       isValid = await validateGuarantorDetails();
  //       break;
  //     case "guarantorSecurity":
  //       isValid = validateGuarantorSecurity();
  //       break;
  //     case "nextOfKin":
  //       isValid = await validateNextOfKinDetails();
  //       break;
  //     case "documents":
  //       isValid = validateDocuments();
  //       break;
  //     default:
  //       break;
  //   }

  //   if (!isValid) {
  //     toast.error("Please fix the highlighted errors before continuing.", {
  //       position: "top-right",
  //       autoClose: 3000,
  //       theme: "colored",
  //     });
  //     return;
  //   }

  //   const nextIndex = sections.findIndex((item) => item.id === activeSection) + 1;
  //   if (nextIndex < sections.length) {
  //     setActiveSection(sections[nextIndex].id);
  //   }
  // };


  const handleNext = async () => {
    if (isValidating) return;
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
        error("Please fix the highlighted errors before continuing.");
        return;
      }

      // Mark current section as completed
      setCompletedSections((prev) => {
        const newSet = new Set(prev);
        newSet.add(activeSection);
        return newSet;
      });

      const nextIndex = sections.findIndex((item) => item.id === activeSection) + 1;
      if (nextIndex < sections.length) {
        setActiveSection(sections[nextIndex].id);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsValidating(false);
    }
  };

  const validateForm = async () => {
    const personalValid = await validatePersonalDetails();
    const businessValid = validateBusinessDetails();
    const borrowerSecurityValid = validateBorrowerSecurity();
    const loanValid = validateLoanDetails();
    const guarantorValid = await validateGuarantorDetails();
    const guarantorSecurityValid = validateGuarantorSecurity();
    const nextOfKinValid = await validateNextOfKinDetails();
    const documentsValid = validateDocuments();

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

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);

    try {
      const existingCustomerId = formData?.id || null;
      const timestamp = Date.now();

      // 1. PARALLEL UPLOAD ALL FILES AT ONCE
      const guarantorFilesPromises = (formData.guarantors || []).map(async (g, index) => {
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
        bothOfficersUrl
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
      ]);

      // 2. Prepare customer payload (allow null/undefined for draft)
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
        tenant_id: profile?.tenant_id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        lead_id: leadData?.id || null,
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
          .single()
          .then(res => res);
      } else {
        draftResult = await supabase
          .from("customers")
          .insert([{ ...customerPayload, created_at: new Date().toISOString() }])
          .select("id")
          .single()
          .then(res => res);
      }

      if (draftResult.error) throw draftResult.error;
      const customerId = draftResult.data.id;

      // 4. PARALLEL UPSERT: All related records at once
      const upsertPromises = [];

      // Business images
      if (businessUrls.length > 0) {
        upsertPromises.push(supabase.from("business_images").delete().eq("customer_id", customerId).then(res => res));
        const businessRecords = businessUrls.map((url) => ({
          customer_id: customerId, image_url: url, created_by: profile?.id,
          tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
        }));
        upsertPromises.push(supabase.from("business_images").insert(businessRecords).then(res => res));
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
        }, { onConflict: "customer_id" }).then(res => res));
      } else {
        upsertPromises.push(supabase.from("spouse").delete().eq("customer_id", customerId).then(res => res));
      }

      // Next of Kin - sequential delete then insert to avoid race condition
      upsertPromises.push(
        supabase.from("next_of_kin").delete().eq("customer_id", customerId).then(() => {
          const nokRecords = (formData.nextOfKins || []).filter(nok => nok.Firstname || nok.Surname).map(nok => ({
            customer_id: customerId,
            Firstname: nok.Firstname || null, Surname: nok.Surname || null, Middlename: nok.Middlename || null,
            id_number: nok.idNumber || null, relationship: nok.relationship || null, mobile: nok.mobile || null,
            alternative_number: nok.alternativeNumber || null, employment_status: nok.employmentStatus || null,
            county: nok.county || null, city_town: nok.cityTown || null, company_name: nok.companyName || null,
            salary: nok.salary ? parseFloat(nok.salary) : null, business_name: nok.businessName || null,
            business_income: nok.businessIncome ? parseFloat(nok.businessIncome) : null, relationship_other: nok.relationshipOther || null,
            created_by: profile?.id, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }));
          if (nokRecords.length > 0) return supabase.from("next_of_kin").insert(nokRecords).then(res => res);
        })
      );

      // Guarantors - sequential delete then insert to avoid race condition
      upsertPromises.push(
        supabase.from("guarantors").delete().eq("customer_id", customerId).then(() => {
          const guarantorRecords = (formData.guarantors || []).filter(g => g.Firstname || g.Surname).map((g, idx) => ({
            customer_id: customerId,
            Firstname: g.Firstname || null, Surname: g.Surname || null, Middlename: g.Middlename || null,
            id_number: g.idNumber || null, marital_status: g.maritalStatus || null, gender: g.gender || null,
            mobile: g.mobile || null, alternative_number: g.alternativeMobile || null, residence_status: g.residenceStatus || null,
            postal_address: g.postalAddress || null, code: g.code ? parseInt(g.code) : null, occupation: g.occupation || null,
            relationship: g.relationship || null, date_of_birth: g.dateOfBirth || null, county: g.county || null, city_town: g.cityTown || null,
            passport_url: guarantorDocs[idx]?.passport || g.passport_url || null,
            id_front_url: guarantorDocs[idx]?.idFront || g.id_front_url || null,
            id_back_url: guarantorDocs[idx]?.idBack || g.id_back_url || null,
            created_by: profile?.id, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }));
          if (guarantorRecords.length > 0) return supabase.from("guarantors").insert(guarantorRecords).select("id");
        })
      );

      await Promise.all(upsertPromises);

      // Handle security items - link to primary guarantor
      let primaryGuarantorId = null;
      const { data: primaryG } = await supabase.from("guarantors").select("id").eq("customer_id", customerId).order('id', { ascending: true }).limit(1).single();
      primaryGuarantorId = primaryG?.id;

      if (securityItems?.length > 0) {
        await supabase.from("security_items").delete().eq("customer_id", customerId).eq("is_guarantor", false);
        await insertSecurityItemsOptimized(securityItems, securityItemImages, customerId, false);
      }

      if (guarantorSecurityItems?.length > 0 && primaryGuarantorId) {
        await supabase.from("security_items").delete().eq("customer_id", primaryGuarantorId).eq("is_guarantor", true);
        await insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecurityImages, primaryGuarantorId, true);
      }

      toast.success("Draft saved successfully!");
      navigate("/registry/customers");
    } catch (err) {
      console.error("Error saving draft:", err);
      toast.error(err.message || "Something went wrong saving the draft");
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
  const uploadFilesBatch = async (files, pathPrefix, bucket = "customers") => {
    if (!files || files.length === 0) return [];

    // Upload all files in parallel
    const uploadPromises = files.map(async (file) => {
      try {
        const path = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            upsert: true,
            cacheControl: '3600' // Added cache control
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(data.path);

        return urlData.publicUrl;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        return null;
      }
    });

    const urls = await Promise.all(uploadPromises);
    return urls.filter(Boolean); // Remove null values
  };

  // 3. Optimized single file upload (non-blocking)
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

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  // 4. ULTRA-FAST handleSubmit with parallel uploads
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Validate form
      const isValid = await validateForm();
      if (!isValid) {
        error("Please fix all validation errors before submitting.");
        setIsSubmitting(false);
        return;
      }

      const timestamp = Date.now();

      // 2. PARALLEL UPLOAD ALL FILES AT ONCE (MAJOR SPEED BOOST)
      const guarantorFilesPromises = (formData.guarantors || []).map(async (g, index) => {
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
        bothOfficersUrl
      ] = await Promise.all([
        // Customer documents
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : Promise.resolve(formData.passport_url || null),
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : Promise.resolve(formData.id_front_url || null),
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : Promise.resolve(formData.id_back_url || null),
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : Promise.resolve(formData.house_image_url || null),

        // Guarantor documents (process all)
        Promise.all(guarantorFilesPromises),

        // Business images (batch upload)
        businessImages.length > 0 ? uploadFilesBatch(businessImages, "business") : Promise.resolve([]),

        // Officer verification images
        officerClientImage1 ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`) : Promise.resolve(null),
        officerClientImage2 ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`) : Promise.resolve(null),
        bothOfficersImage ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`) : Promise.resolve(null),
      ]);

      // 3. Insert Customer (with all URLs ready)
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
        code: formData.code || null,
        town: formData.town || null,
        county: formData.county || null,
        business_name: formData.businessName || null,
        industry: formData.industry || null,
        business_type: formData.businessType || null,
        daily_Sales: Number(formData.daily_Sales) || null,
        year_established: formData.yearEstablished || null,
        business_location: formData.businessLocation || null,
        business_lat: formData.businessCoordinates?.lat || null,
        business_lng: formData.businessCoordinates?.lng || null,
        road: formData.road || null,
        landmark: formData.landmark || null,
        has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
        prequalifiedAmount: Number(formData.prequalifiedAmount) || null,
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
        lead_id: leadData?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .insert([customerPayload])
        .select("id")
        .single()
        .then(res => res);

      if (customerError) throw customerError;
      const customerId = customerData.id;

      // Update lead status if this was a conversion
      if (leadData?.id) {
        await supabase
          .from("leads")
          .update({
            converted_at: new Date().toISOString(),
            converted_by: profile?.id,
            status: "converted"
          })
          .eq("id", leadData.id);
      }

      // Update guarantor status if this was a conversion
      if (guarantorData?.id) {
        await supabase
          .from("guarantors")
          .update({
            is_guarantor: false
          })
          .eq("id", guarantorData.id)
          .eq("tenant_id", profile?.tenant_id);
      }

      // 4. PARALLEL INSERT: All related records at once
      const insertPromises = [];

      // Business images
      if (businessUrls.length > 0) {
        const businessRecords = businessUrls.map((url) => ({
          customer_id: customerId,
          image_url: url,
          created_by: profile?.id,
          tenant_id: profile?.tenant_id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        }));
        insertPromises.push(supabase.from("business_images").insert(businessRecords).then(res => res));
      }

      // Spouse
      if (formData.maritalStatus === "Married" && formData.spouse) {
        insertPromises.push(
          supabase.from("spouse").insert([{
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
          }]).then(res => res)
        );
      }

      // Next of Kin - Handle multiple
      const nokRecords = formData.nextOfKins.filter(nok => Object.values(nok).some(Boolean)).map(nok => ({
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
      }));

      if (nokRecords.length > 0) {
        insertPromises.push(supabase.from("next_of_kin").insert(nokRecords).then(res => res));
      }

      // Guarantor - Handle multiple
      const guarantorRecords = formData.guarantors.filter(g => Object.values(g).some(Boolean)).map((g, idx) => ({
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
        // Link docs to each guarantor
        passport_url: guarantorDocs[idx]?.passport || g.passport_url || null,
        id_front_url: guarantorDocs[idx]?.idFront || g.id_front_url || null,
        id_back_url: guarantorDocs[idx]?.idBack || g.id_back_url || null,
        created_by: profile?.id,
        tenant_id: profile?.tenant_id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        created_at: new Date().toISOString(),
      }));

      if (guarantorRecords.length > 0) {
        insertPromises.push(supabase.from("guarantors").insert(guarantorRecords).then(res => res));
      }

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

      if (documentRecords.length) {
        insertPromises.push(supabase.from("documents").insert(documentRecords).then(res => res));
      }

      // Execute all inserts in parallel
      const results = await Promise.all(insertPromises);

      // Get guarantor ID if inserted
      let guarantorId = null;
      // results is an array of responses from supabase. Find the one from the "guarantors" table
      // In the new logic, we insert an array, so data will be an array of records
      const guarantorResponse = results.find(r => r.data && Array.isArray(r.data) && r.data.length > 0 && r.data[0].id && !r.data[0].document_type);
      // Wait, identifying the exact response in a parallel array is tricky. 
      // A better way is to just fetch it if needed, or identify by key.
      // But since we order them, we can guess.
      // Alternatively, just fetch the first guarantor ID for the customer.
      if (!guarantorId) {
        const { data: gs } = await supabase.from("guarantors").select("id").eq("customer_id", customerId).limit(1);
        if (gs && gs.length > 0) guarantorId = gs[0].id;
      }

      // 5. Upload and insert security items (with images) - PARALLEL
      await Promise.all([
        insertSecurityItemsOptimized(securityItems, securityItemImages, customerId, false),
        guarantorId ? insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecurityImages, guarantorId, true) : Promise.resolve(null),
      ]);

      success("Customer application submitted successfully!");
      navigate("/registry/customers");

    } catch (error) {
      console.error("Form submission error:", error);
      error(error.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const insertSecurityItemsOptimized = async (items, images, ownerId, isGuarantor) => {
    if (!items?.length) return;

    const table = isGuarantor ? "guarantor_security" : "security_items";
    const ownerKey = isGuarantor ? "guarantor_id" : "customer_id";
    const valueKey = isGuarantor ? "estimated_market_value" : "value";

    // 1. Insert all security items (matching old structure exactly)
    const itemsToInsert = items.map((s) => ({
      [ownerKey]: ownerId,
      item: s.type || s.item || null,
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

    // 2. Upload all images for all items in PARALLEL (SPEED BOOST)
    const allImageUploads = insertedItems.flatMap((item, index) => {
      const newFiles = images[index] || [];
      const existingUrls = items[index]?.existingImages || [];

      // Promises for new uploads
      const newUploadPromises = newFiles.map(async (file) => {
        const filePath = `${isGuarantor ? "guarantor_security" : "borrower_security"}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
        const url = await uploadFile(file, filePath, "customers");

        return url ? {
          [isGuarantor ? "guarantor_security_id" : "security_item_id"]: item.id,
          image_url: url,
          created_by: profile?.id,
          tenant_id: profile?.tenant_id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        } : null;
      });

      // Promises for existing URLs (copying the reference)
      const existingPromises = existingUrls.map(url => Promise.resolve({
        [isGuarantor ? "guarantor_security_id" : "security_item_id"]: item.id,
        image_url: url,
        created_by: profile?.id,
        tenant_id: profile?.tenant_id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        created_at: new Date().toISOString(),
      }));

      return [...newUploadPromises, ...existingPromises];
    });

    const imageRecords = (await Promise.all(allImageUploads)).filter(Boolean);

    // 3. Insert all image records at once
    if (imageRecords.length) {
      const imageTable = isGuarantor ? "guarantor_security_images" : "security_item_images";
      const { error: imgError } = await supabase.from(imageTable).insert(imageRecords);

      if (imgError) {
        console.error(`Error inserting ${isGuarantor ? 'guarantor' : 'borrower'} security images:`, imgError);
      }
    }
  };
  // Multiplicity handlers

  const addNextOfKin = () => {
    setFormData((prev) => ({
      ...prev,
      nextOfKins: [
        ...prev.nextOfKins,
        {
          Firstname: "",
          Surname: "",
          Middlename: "",
          idNumber: "",
          relationship: "",
          mobile: "",
          alternative_number: "", // Standardized
          employmentStatus: "",
          county: "",
          cityTown: "",
          companyName: "",
          salary: "",
          businessName: "",
          businessIncome: "",
          relationship_other: "",
        },
      ],
    }));
  };

  const removeNextOfKin = (index) => {
    setFormData((prev) => ({
      ...prev,
      nextOfKins: prev.nextOfKins.filter((_, i) => i !== index),
    }));
  };


  return (
    <Form
      activeSection={activeSection}
      setActiveSection={setActiveSection}
      sections={sections}
      completedSections={completedSections}
      formData={formData}
      handleChange={handleChange}
      handleNestedChange={handleNestedChange}
      errors={errors}
      securityItems={securityItems}
      addSecurityItem={addSecurityItem}
      removeSecurityItem={removeSecurityItem}
      handleSecurityChange={handleSecurityChange}
      guarantorSecurityItems={guarantorSecurityItems}
      addGuarantorSecurityItem={addGuarantorSecurityItem}
      removeGuarantorSecurityItem={removeGuarantorSecurityItem}
      handleGuarantorSecurityChange={handleGuarantorSecurityChange}
      addGuarantor={() => {
        setFormData(prev => ({
          ...prev,
          guarantors: [...prev.guarantors, {
            prefix: '', Firstname: '', Surname: '', Middlename: '', idNumber: '', maritalStatus: '',
            gender: '', mobile: '', alternativeMobile: '', residenceStatus: '', postalAddress: '',
            code: '', occupation: '', relationship: '', dateOfBirth: '', county: '', cityTown: ''
          }]
        }));
        setGuarantorPassportFiles(prev => [...prev, null]);
        setGuarantorIdFrontFiles(prev => [...prev, null]);
        setGuarantorIdBackFiles(prev => [...prev, null]);
        setGuarantorSecurityImages(prev => [...prev, []]);
      }}
      removeGuarantor={removeGuarantor}
      addNextOfKin={() => setFormData(prev => ({
        ...prev,
        nextOfKins: [...prev.nextOfKins, {
          Firstname: '', Surname: '', Middlename: '', idNumber: '', relationship: '',
          mobile: '', alternativeNumber: '', employmentStatus: '', county: '', cityTown: '',
          companyName: '', salary: '', businessName: '', businessIncome: '', relationship_other: '', id_no: ''
        }]
      }))}
      removeNextOfKin={removeNextOfKin}
      isSubmitting={isSubmitting}
      isSavingDraft={isSavingDraft}
      handleSubmit={handleSubmit}
      handleSaveDraft={handleSaveDraft}
      handleNext={handleNext}
      handleFileUpload={handleFileUpload}
      handleRemoveFile={handleRemoveFile}
      handleMultipleFiles={handleMultipleFiles}
      handleRemoveMultipleFile={handleRemoveMultipleFile}
      handleBusinessImages={handleBusinessImages}
      handleRemoveBusinessImage={handleRemoveBusinessImage}
      previews={previews}
      passportFile={passportFile}
      setPassportFile={setPassportFile}
      idFrontFile={idFrontFile}
      setIdFrontFile={setIdFrontFile}
      idBackFile={idBackFile}
      setIdBackFile={setIdBackFile}
      houseImageFile={houseImageFile}
      setHouseImageFile={setHouseImageFile}
      businessImages={businessImages}
      securityItemImages={securityItemImages}
      setSecurityItemImages={setSecurityItemImages}
      guarantorPassportFiles={guarantorPassportFiles}
      setGuarantorPassportFiles={setGuarantorPassportFiles}
      guarantorIdFrontFiles={guarantorIdFrontFiles}
      setGuarantorIdFrontFiles={setGuarantorIdFrontFiles}
      guarantorIdBackFiles={guarantorIdBackFiles}
      setGuarantorIdBackFiles={setGuarantorIdBackFiles}
      guarantorSecurityImages={guarantorSecurityImages}
      setGuarantorSecurityImages={setGuarantorSecurityImages}
      officerClientImage1={officerClientImage1}
      setOfficerClientImage1={setOfficerClientImage1}
      officerClientImage2={officerClientImage2}
      setOfficerClientImage2={setOfficerClientImage2}
      bothOfficersImage={bothOfficersImage}
      setBothOfficersImage={setBothOfficersImage}
      documentUploadEnabled={documentUploadEnabled}
      imageUploadEnabled={imageUploadEnabled}
      isCustomIndustry={isCustomIndustry}
      setIsCustomIndustry={setIsCustomIndustry}
      isCustomType={isCustomType}
      setIsCustomType={setIsCustomType}
    />
  );
};

export default CustomerForm;