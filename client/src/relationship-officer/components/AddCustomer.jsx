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

// Kenya's 47 counties
// Kenya's 47 counties
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

const COUNTY_TOWNS = {
  "Baringo": ["Kabarnet", "Eldama Ravine", "Marigat"],
  "Bomet": ["Bomet", "Sotik"],
  "Bungoma": ["Bungoma", "Webuye", "Chwele", "Kimilili"],
  "Busia": ["Busia", "Malaba", "Butula"],
  "Elgeyo Marakwet": ["Iten", "Kapsowar"],
  "Embu": ["Embu", "Runyenjes", "Siakago"],
  "Garissa": ["Garissa", "Dadaab"],
  "Homa Bay": ["Homa Bay", "Mbita", "Oyugis"],
  "Isiolo": ["Isiolo", "Merti"],
  "Kajiado": ["Kajiado", "Ngong", "Kitengela", "Isinya", "Loitokitok"],
  "Kakamega": ["Kakamega", "Mumias", "Butere", "Lugari"],
  "Kericho": ["Kericho", "Litein"],
  "Kiambu": ["Kiambu", "Thika", "Ruiru", "Limuru", "Kikuyu", "Karuri", "Githunguri"],
  "Kilifi": ["Kilifi", "Malindi", "Mtwapa", "Mariakani", "Watamu"],
  "Kirinyaga": ["Kerugoya", "Kutus", "Sagana", "Wang'uru"],
  "Kisii": ["Kisii", "Ogembo", "Suneka"],
  "Kisumu": ["Kisumu", "Ahero", "Muhoroni"],
  "Kitui": ["Kitui", "Mwingi", "Mutomo"],
  "Kwale": ["Kwale", "Ukunda", "Msambweni", "Lunga Lunga"],
  "Laikipia": ["Nanyuki", "Nyahururu", "Rumuruti"],
  "Lamu": ["Lamu", "Mpeketoni"],
  "Machakos": ["Machakos", "Athi River", "Kangundo", "Tala"],
  "Makueni": ["Wote", "Mtito Andei", "Kibwezi"],
  "Mandera": ["Mandera", "El Wak"],
  "Marsabit": ["Marsabit", "Moyale"],
  "Meru": ["Meru", "Maua", "Nkubu", "Timau"],
  "Migori": ["Migori", "Kuria", "Rongo", "Awendo"],
  "Mombasa": ["Mombasa", "Nyali", "Likoni", "Changamwe", "Kisauni", "Jomvu"],
  "Murang'a": ["Murang'a", "Kenol", "Kangema", "Maragua"],
  "Nairobi": ["Nairobi Central", "Westlands", "Dagoretti", "Langata", "Kibra", "Kasarani", "Embakasi", "Makadara", "Kamkunji"],
  "Nakuru": ["Nakuru", "Naivasha", "Gilgil", "Molo", "Njoro"],
  "Nandi": ["Kapsabet", "Nandi Hills"],
  "Narok": ["Narok", "Kilgoris"],
  "Nyamira": ["Nyamira", "Nyansiongo"],
  "Nyandarua": ["Ol Kalou", "Njabini", "Mai Mahiu"],
  "Nyeri": ["Nyeri", "Karatina", "Othaya", "Chaka"],
  "Samburu": ["Maralal", "Baragoi"],
  "Siaya": ["Siaya", "Bondo", "Ugunja"],
  "Taita Taveta": ["Voi", "Wundanyi", "Taveta", "Mwatate"],
  "Tana River": ["Hola", "Garsen", "Madogo"],
  "Tharaka Nithi": ["Chuka", "Chogoria", "Marimanti"],
  "Trans Nzoia": ["Kitale", "Endebess"],
  "Turkana": ["Lodwar", "Kakuma", "Lokichogio"],
  "Uasin Gishu": ["Eldoret", "Burnt Forest"],
  "Vihiga": ["Mbale", "Chavakali", "Hamisi"],
  "Wajir": ["Wajir", "Habaswein"],
  "West Pokot": ["Kapenguria", "Sigor"]
};

const INDUSTRIES = {
  Retail: ["Clothing Shop", "Second-hand Clothes (Mtumba)", "Electronics Shop", "Grocery Shop", "Supermarket", "Cosmetics Shop", "Hardware Shop", "Furniture Shop", "Mobile Phone Shop", "General Shop (Kiosk)"],
  "Hospitality & Entertainment": ["Bar", "Restaurant", "Hotel", "Club", "Café", "Lounge", "Fast Food Outlet"],
  Agriculture: ["Crop Farming", "Dairy Farming", "Poultry Farming", "Fish Farming", "Agro-processing", "Agrovet Shop"],
  Education: ["Primary School", "Secondary School", "College", "Training Institute", "Driving School", "Daycare / Kindergarten"],
  "Transport & Logistics": ["Matatu Business", "Taxi / Ride-hailing", "Courier Service", "Logistics Company", "Truck Transport", "Delivery Services"],
  Technology: ["Software Development", "SaaS Business", "Cyber Café", "IT Services", "Online Business (E-commerce)"],
  "Financial Services": ["Lending Business", "SACCO", "Microfinance", "Insurance Agency", "Forex Bureau"],
  Healthcare: ["Clinic", "Pharmacy", "Hospital", "Laboratory", "Medical Supplies Shop"],
  "Real Estate": ["Property Management", "Real Estate Agency", "Rental Business", "Property Development"],
  "Creative & Media": ["Photography", "Videography", "Graphic Design", "Printing Services", "Music Production", "Content Creation"],
  Services: ["Salon / Barber Shop", "Laundry Business", "Cleaning Services", "Repair Shop (Phones/Electronics)", "Auto Garage", "Car Wash"],
  Manufacturing: ["Furniture Production", "Clothing Production", "Food Processing", "Metal Fabrication", "Plastic Production"],
  Wholesale: ["General Wholesale", "Food Wholesale", "Clothing Wholesale", "Electronics Wholesale", "Hardware Wholesale"]
};




const FormField = memo(
  ({
    label,
    name,
    value,
    onChange,
    required = false,
    type = "text",
    options = null,
    placeholder = "",
    section = null,
    className = "",
    disabled = false,
    errors = {},
    handleNestedChange,
    index,
  }) => {
    let errorMessage = '';

    // Handle different error key formats
    if (section && index !== undefined && index !== null) {
      // Support for multiplicity sections: guarantors_0_idNumber, nextOfKins_1_mobile, etc.
      errorMessage = errors[`${section}_${index}_${name}`] || 
                     errors[`security_${name}_${index}`] || 
                     errors[`guarantor_security_${name}_${index}`];
    } else if (section) {
      // For single nested objects like spouse
      errorMessage = errors[`${section}${name.charAt(0).toUpperCase() + name.slice(1)}`] ||
                     errors[section]?.[name];
    } else {
      errorMessage = errors?.[name];
    }

    return (
      <div className={className}>
        <label className="block text-sm font-medium text-text mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {options ? (
          <select
            name={name}
            value={value || ""}
            onChange={section ? (e) => handleNestedChange(e, section, index) : onChange}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors ${errorMessage ? "border-red-500" : "border-gray-300"
              }`}
            required={required}
            disabled={disabled}
          >
            <option value="">{placeholder || `Select ${label}`}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            name={name}
            type={type}
            value={value || ""}
            onChange={section ? (e) => handleNestedChange(e, section, index) : onChange}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors ${errorMessage ? "border-red-500" : "border-gray-300"
              }`}
            required={required}
            placeholder={placeholder}
            disabled={disabled}
          />
        )}
        {errorMessage && (
          <p className="mt-1 text-xs text-red-500">{errorMessage}</p>
        )}
      </div>
    );
  }
);

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
        .select("id")
        .single();

      if (customerError) throw customerError;
      const customerId = customerData.id;

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
    <div className="min-h-screen bg-muted py-8 font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Tabs */}
        <div className="bg-gray-50 backdrop-blur-md rounded-2xl shadow-sm p-3 mb-6 border border-white/50">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {sections.map(({ id, label, icon: Icon }) => {
              const isCompleted = completedSections.has(id);
              const isActive = activeSection === id;

              return (
                <button
                  key={id}
                  onClick={() => {
                    // Mark current as completed when jumping away
                    if (id !== activeSection) {
                      setCompletedSections(prev => new Set([...prev, activeSection]));
                    }
                    setActiveSection(id);
                  }}
                  className="flex flex-col items-center gap-1.5 transition-all duration-300 group"
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-medium transition-all duration-300 relative ${isActive
                      ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/30 transform scale-105"
                      : isCompleted
                        ? "bg-accent text-white shadow-lg shadow-accent/30 border-2 border-accent"
                        : "bg-gray-100 text-slate-700 border-2 border-gray-200 group-hover:bg-gray-200 group-hover:border-gray-300 group-hover:scale-105"
                      }`}
                  >
                    {isCompleted && !isActive ? (
                      <CheckCircleIcon className="h-5 w-5 text-white" />
                    ) : (
                      <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-700"}`} />
                    )}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-medium text-center transition-all duration-300 ${isActive
                      ? "text-brand-primary font-bold"
                      : isCompleted
                        ? "text-accent font-semibold"
                        : "text-slate-700 group-hover:text-slate-900"
                      }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8">
            {/* Personal Information */}
            {activeSection === "personal" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-text flex items-center">
                    <UserCircleIcon className="h-8 w-8 text-brand-primary mr-3" />
                    Personal Information
                  </h2>
                  <p className="text-muted mt-2">
                    Enter customer's personal details and contact information
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField
                    label="Prefix"
                    name="prefix"
                    value={formData.prefix}
                    onChange={handleChange}
                    options={["Mr", "Mrs", "Ms", "Dr"]}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="First Name"
                    name="Firstname"
                    value={formData.Firstname}
                    onChange={handleChange}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Middle Name"
                    name="Middlename"
                    value={formData.Middlename}
                    onChange={handleChange}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Surname"
                    name="Surname"
                    value={formData.Surname}
                    onChange={handleChange}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Mobile Number"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Alternative Mobile"
                    name="alternativeMobile"
                    value={formData.alternativeMobile}
                    onChange={handleChange}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="ID Number"
                    name="idNumber"
                    value={formData.idNumber}
                    onChange={handleChange}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Date of Birth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    options={["Male", "Female"]}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Marital Status"
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleChange}
                    options={[
                      "Single",
                      "Married",
                      "Separated/Divorced",
                      "Other",
                    ]}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />

                  {/* Spouse Information - Conditionally Rendered */}
                  {formData.maritalStatus === "Married" && (
                    <>
                      <FormField
                        label="Spouse Name"
                        name="name"
                        value={formData.spouse.name}
                        section="spouse"
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Spouse ID Number"
                        name="idNumber"
                        value={formData.spouse.idNumber}
                        section="spouse"
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Spouse Mobile"
                        name="mobile"
                        value={formData.spouse.mobile}
                        section="spouse"
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Spouse Economic Activity"
                        name="economicActivity"
                        value={formData.spouse.economicActivity}
                        section="spouse"
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                    </>
                  )}

                  <FormField
                    label="Residence Status"
                    name="residenceStatus"
                    value={formData.residenceStatus}
                    onChange={handleChange}
                    options={["Own", "Rent", "Family", "Other"]}
                    errors={errors}
                  />
                  <FormField
                    label="Occupation"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleChange}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Postal Address"
                    name="postalAddress"
                    value={formData.postalAddress}
                    onChange={handleChange}
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="Postal Code"
                    name="code"
                    type="number"
                    value={formData.code}
                    onChange={handleChange}
                    handleNestedChange={handleNestedChange}
                  />

              <FormField
                label="County"
                name="county"
                value={formData.county}
                onChange={handleChange}
                options={KENYA_COUNTIES}
                required
                errors={errors}
              />
              <FormField
                label="Town/City"
                name="town"
                value={formData.town}
                onChange={handleChange}
                options={formData.county ? COUNTY_TOWNS[formData.county] : []}
                required
                errors={errors}
                placeholder="Select County first"
              />
                </div>

                {/* Conditionally reveal PERSONAL document uploaders */}
                {imageUploadEnabled && (
                  <div className="mt-10 pt-8 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-brand-primary mb-6 flex items-center gap-2">
                      <IdentificationIcon className="w-5 h-5" />
                      Personal Documents
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { key: "passport", label: "Passport Photo", handler: setPassportFile },
                        { key: "idFront", label: "ID Front", handler: setIdFrontFile },
                        { key: "idBack", label: "ID Back", handler: setIdBackFile },
                        { key: "houseImage", label: "Residence Image", handler: setHouseImageFile },
                      ].map((file) => (
                        <div key={file.key} className="p-4 border border-brand-surface rounded-xl bg-brand-surface">
                          <label className="block text-xs font-semibold text-text mb-3 uppercase tracking-wider">{file.label}</label>
                          <div className="flex gap-2">
                            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-brand-primary rounded-lg cursor-pointer hover:bg-brand-surface transition text-sm">
                              <ArrowUpTrayIcon className="w-4 h-4" />
                              Upload
                              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, file.handler, file.key)} className="hidden" />
                            </label>
                          </div>
                          {previews[file.key] && (
                            <div className="mt-3 relative">
                              <img src={previews[file.key].url} alt={file.label} className="w-full h-24 object-cover rounded-lg border border-white shadow-sm" />
                              <button type="button" onClick={() => handleRemoveFile(file.key, file.handler)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md">
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Business Information */}
            {activeSection === "business" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-text flex items-center">
                    <BuildingOffice2Icon className="h-8 w-8 text-brand-primary mr-3" />
                    Business Information
                  </h2>
                  <p className="text-muted mt-2">
                    Enter business details and operations information
                  </p>
                </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                label="Business Name"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                required
                errors={errors}
              />
              <FormField
                label="Industry"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                options={[...Object.keys(INDUSTRIES), "Other"]}
                required
                errors={errors}
              />
              {isCustomIndustry && (
                <FormField
                  label="Specific Industry"
                  name="industry"
                  value={formData.industry === "Other" ? "" : formData.industry}
                  onChange={handleChange}
                  required
                  errors={errors}
                  placeholder="Enter specific industry"
                />
              )}
              <FormField
                label="Business Type"
                name="businessType"
                value={formData.businessType}
                onChange={handleChange}
                options={
                  formData.industry && INDUSTRIES[formData.industry]
                    ? [...INDUSTRIES[formData.industry], "Other"]
                    : ["Other"]
                }
                required
                errors={errors}
                placeholder={isCustomIndustry ? "Select Industry/Other first" : "Select Industry first"}
              />
              {isCustomType && (
                <FormField
                  label="Specific Business Type"
                  name="businessType"
                  value={formData.businessType === "Other" ? "" : formData.businessType}
                  onChange={handleChange}
                  required
                  errors={errors}
                  placeholder="Enter specific business type"
                />
              )}
                  <FormField
                    label="Year Established"
                    name="yearEstablished"
                    type="date"
                    value={formData.yearEstablished}
                    onChange={handleChange}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Daily Sales (KES)"
                    name="daily_Sales"
                    type="number"
                    value={formData.daily_Sales}
                    onChange={handleChange}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                    <FormField
                      label="County"
                      name="businessCounty"
                      value={formData.businessCounty}
                      onChange={handleChange}
                      options={KENYA_COUNTIES}
                      required
                      handleNestedChange={handleNestedChange}
                      errors={errors}
                    />
                  <FormField
                    label="Business Location"
                    name="businessLocation"
                    value={formData.businessLocation}
                    onChange={handleChange}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Road"
                    name="road"
                    value={formData.road}
                    onChange={handleChange}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Landmark"
                    name="landmark"
                    value={formData.landmark}
                    onChange={handleChange}
                    placeholder="e.g. Near KCB Bank"
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Local Authority License"
                    name="hasLocalAuthorityLicense"
                    value={formData.hasLocalAuthorityLicense}
                    onChange={handleChange}
                    options={["Yes", "No"]}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                </div>

                {/* GPS Location Picker */}
                <div className="mt-8">
                  <LocationPicker
                    value={formData.businessCoordinates}
                    onChange={handleLocationChange}
                    county={formData.businessCounty}
                  />
                </div>

                {/* Conditionally reveal BUSINESS image uploaders */}
                {imageUploadEnabled && (
                  <div className="mt-10 pt-8 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-brand-primary mb-6 flex items-center gap-2">
                      <BuildingOffice2Icon className="w-5 h-5" />
                      Business Images
                    </h3>
                    <div className="flex gap-4 mb-6">
                      <label className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary rounded-xl cursor-pointer hover:bg-brand-secondary/20 transition font-medium border border-brand-surface">
                        <ArrowUpTrayIcon className="w-5 h-5" />
                        Add Business Images
                        <input type="file" accept="image/*" multiple onChange={handleBusinessImages} className="hidden" />
                      </label>
                    </div>

                    {businessImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {businessImages.map((file, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200">
                            <img src={URL.createObjectURL(file)} alt="Business" className="w-full h-32 object-cover" />
                            <button type="button" onClick={() => handleRemoveBusinessImage(idx)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition">
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Borrower Security - USING BRAND COLORS */}
            {activeSection === "borrowerSecurity" && (
              <div className="space-y-8">
                {errors.securityItems && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-700 text-sm">{errors.securityItems}</p>
                  </div>
                )}

                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-text flex items-center">
                    <ShieldCheckIcon className="h-8 w-8 text-brand-primary mr-3" />
                    Borrower Security
                  </h2>
                  <p className="text-muted mt-2">
                    Add security type, description and estimated market value
                  </p>
                </div>

                <div className="space-y-6">
                  {securityItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-brand-surface rounded-xl p-6 border border-brand-surface"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-text flex items-center">
                          <ShieldCheckIcon className="h-5 w-5 text-brand-primary mr-2" />
                          Security {index + 1}
                        </h3>

                        {securityItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSecurityItem(index)}
                            className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>

                      {/* Security Type Dropdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-text">
                            Security Type
                          </label>
                          <select
                            name="type"
                            value={item.type}
                            onChange={(e) => handleSecurityChange(e, index)}
                            className="w-full border border-gray-300 rounded-lg p-2 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                            required
                          >
                            <option value="">Select Security Type</option>
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
                            <option value="Fixed deposit / Savings security">
                              Fixed deposit / Savings security
                            </option>
                            <option value="Electronics">Electronics</option>
                            <option value="Other">Other (specify)</option>
                          </select>
                        </div>

                        {/* Other (Specify) Field */}
                        {item.type === "Other" && (
                          <FormField
                            label="Specify Other Security"
                            name="otherType"
                            value={item.otherType || ""}
                            onChange={(e) => handleSecurityChange(e, index)}
                            required
                          />
                        )}

                        {/* Description */}
                        <FormField
                          label="Description"
                          name="description"
                          value={item.description}
                          onChange={(e) => handleSecurityChange(e, index)}
                          required
                        />

                        {/* Estimated Market Value */}
                        <FormField
                          label="Est. Market Value (KES)"
                          name="value"
                          type="number"
                          value={item.value}
                          onChange={(e) => handleSecurityChange(e, index)}
                          required
                        />
                      </div>

                      {/* Security Images Section - USING BRAND COLORS */}
                      {imageUploadEnabled && (
                        <div className="mt-6">
                          <label className="block text-sm font-medium mb-2 text-text">
                            Security Images
                          </label>
                          <div className="flex gap-3 mb-3">
                            <label className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary rounded-lg cursor-pointer hover:bg-brand-secondary/20 font-medium">
                              <ArrowUpTrayIcon className="w-5 h-5" />
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleMultipleFiles(e, index, setSecurityItemImages, "borrower")}
                                className="hidden"
                              />
                            </label>

                            <label className="flex md:hidden items-center justify-center gap-2 px-6 py-3 bg-brand-btn text-white rounded-lg cursor-pointer hover:bg-brand-primary font-medium">
                              <CameraIcon className="w-5 h-5" />
                              Camera
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple
                                onChange={(e) => handleMultipleFiles(e, index, setSecurityItemImages, "borrower")}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {/* Display Image Grid */}
                          {securityItemImages[index] && securityItemImages[index].length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                              {securityItemImages[index].map((img, imgIdx) => (
                                <div key={imgIdx} className="relative group">
                                  <img
                                    src={URL.createObjectURL(img)}
                                    alt={`Security ${index + 1} - Image ${imgIdx + 1}`}
                                    className="w-full h-32 object-cover rounded-lg border border-brand-surface shadow-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMultipleFile(index, imgIdx, setSecurityItemImages, "borrower")}
                                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
                                  >
                                    <XMarkIcon className="w-4 h-4" />
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
                      )}
                    </div>
                  ))}

                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={addSecurityItem}
                      className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Add Security Item
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loan Details */}
            {activeSection === "loan" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-text flex items-center">
                    <CurrencyDollarIcon className="h-8 w-8 text-brand-primary mr-3" />
                    Loan Information
                  </h2>
                  <p className="text-muted mt-2">
                    Set loan amount and terms
                  </p>
                </div>

                <div className="bg-brand-surface rounded-xl p-8 border border-brand-surface">
                  <div className="max-w-md mx-auto">
                    <FormField
                      label="Pre-qualified Amount (KES)"
                      name="prequalifiedAmount"
                      type="number"
                      value={formData.prequalifiedAmount}
                      onChange={handleChange}
                      className="text-center"
                      required
                      handleNestedChange={handleNestedChange}
                      errors={errors}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Guarantor Details */}
            {activeSection === "guarantor" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-text flex items-center">
                    <UserGroupIcon className="h-8 w-8 text-brand-primary mr-3" />
                    Guarantor Information
                  </h2>
                  <p className="text-muted mt-2">
                    Enter guarantor personal details (Max 3)
                  </p>
                </div>

                {formData.guarantors.map((g, index) => (
                  <div key={index} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
                      <h3 className="text-md font-bold text-slate-700 flex items-center gap-2">
                        <span className="w-6 h-6 bg-brand-primary text-white text-xs rounded-full flex items-center justify-center">
                          {index + 1}
                        </span>
                        {index === 0 ? "Primary Guarantor" : `Secondary Guarantor ${index}`}
                      </h3>
                      {formData.guarantors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGuarantor(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          title="Remove Guarantor"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FormField
                        label="Prefix"
                        name="prefix"
                        section="guarantors"
                        index={index}
                        value={g.prefix}
                        options={["Mr", "Mrs", "Ms", "Dr"]}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="First Name"
                        name="Firstname"
                        section="guarantors"
                        index={index}
                        value={g.Firstname}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Middle Name"
                        name="Middlename"
                        section="guarantors"
                        index={index}
                        value={g.Middlename}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Surname"
                        name="Surname"
                        section="guarantors"
                        index={index}
                        value={g.Surname}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="ID Number"
                        name="idNumber"
                        section="guarantors"
                        index={index}
                        value={g.idNumber}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Mobile Number"
                        name="mobile"
                        section="guarantors"
                        index={index}
                        value={g.mobile}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Alternative Number"
                        name="alternativeMobile"
                        section="guarantors"
                        index={index}
                        value={g.alternativeMobile}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Date of Birth"
                        name="dateOfBirth"
                        type="date"
                        section="guarantors"
                        index={index}
                        value={g.dateOfBirth}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Gender"
                        name="gender"
                        section="guarantors"
                        index={index}
                        value={g.gender}
                        options={["Male", "Female"]}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Relationship"
                        name="relationship"
                        section="guarantors"
                        index={index}
                        value={g.relationship}
                        placeholder="e.g. Spouse, Friend"
                        handleNestedChange={handleNestedChange}
                        required
                        errors={errors}
                      />
                      <FormField
                        label="Occupation"
                        name="occupation"
                        section="guarantors"
                        index={index}
                        value={g.occupation}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="County"
                        name="county"
                        section="guarantors"
                        index={index}
                        value={g.county}
                        options={KENYA_COUNTIES}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="City/Town"
                        name="cityTown"
                        section="guarantors"
                        index={index}
                        value={g.cityTown}
                        options={g.county ? COUNTY_TOWNS[g.county] : []}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                        placeholder="Select County first"
                      />
                    </div>

                    {/* Guarantor Documents - Per Entry */}
                    {imageUploadEnabled && (
                      <div className="mt-8 pt-6 border-t border-gray-50">
                        <h4 className="text-sm font-semibold text-brand-primary mb-4 flex items-center gap-2">
                          <IdentificationIcon className="w-5 h-5" />
                          Guarantor {index + 1} Documents
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {[
                            { key: "passport", label: "Passport Photo", setter: setGuarantorPassportFiles, files: guarantorPassportFiles },
                            { key: "idFront", label: "ID Front", setter: setGuarantorIdFrontFiles, files: guarantorIdFrontFiles },
                            { key: "idBack", label: "ID Back", setter: setGuarantorIdBackFiles, files: guarantorIdBackFiles },
                          ].map((file) => (
                            <div key={file.key} className="p-4 border border-brand-surface rounded-xl bg-brand-surface">
                              <label className="block text-xs font-semibold text-text mb-3 uppercase tracking-wider">{file.label}</label>
                              <div className="flex flex-col gap-2">
                                <label className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-brand-primary rounded-lg cursor-pointer hover:bg-brand-surface transition text-sm font-medium">
                                  <ArrowUpTrayIcon className="w-4 h-4" />
                                  <span>Upload</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                      const selectedFile = e.target.files[0];
                                      if (selectedFile) {
                                        file.setter(prev => {
                                          const next = [...prev];
                                          next[index] = selectedFile;
                                          return next;
                                        });
                                      }
                                    }} 
                                    className="hidden" 
                                  />
                                </label>
                                <label className="flex md:hidden items-center justify-center gap-2 px-3 py-2 bg-brand-btn text-white rounded-lg cursor-pointer hover:bg-brand-primary font-medium text-sm">
                                  <CameraIcon className="w-4 h-4" />
                                  Camera
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture={file.key === "passport" ? "user" : "environment"}
                                    onChange={(e) => {
                                      const selectedFile = e.target.files[0];
                                      if (selectedFile) {
                                        file.setter(prev => {
                                          const next = [...prev];
                                          next[index] = selectedFile;
                                          return next;
                                        });
                                      }
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              {file.files[index] && (
                                <div className="mt-3 relative">
                                  <img 
                                    src={URL.createObjectURL(file.files[index])} 
                                    alt={file.label} 
                                    className="w-full h-24 object-cover rounded-lg border border-white" 
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      file.setter(prev => {
                                        const next = [...prev];
                                        next[index] = null;
                                        return next;
                                      });
                                    }} 
                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md"
                                  >
                                    <XMarkIcon className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {formData.guarantors.length < 3 && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={addGuarantor}
                      className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Add Another Guarantor
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Guarantor Security - USING BRAND COLORS */}
            {activeSection === "guarantorSecurity" && (
              <div className="space-y-8">
                {errors.guarantorSecurityItems && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-700 text-sm">{errors.guarantorSecurityItems}</p>
                  </div>
                )}

                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-bold text-text flex items-center">
                    <ShieldCheckIcon className="h-8 w-8 text-brand-primary mr-3" />
                    Guarantor Security Items
                  </h2>
                  <p className="text-muted mt-2">
                    Add guarantor security and collateral details
                  </p>
                </div>

                <div className="space-y-6">
                  {guarantorSecurityItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-brand-surface rounded-xl p-6 border border-brand-surface"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-text flex items-center">
                          <ShieldCheckIcon className="h-5 w-5 text-brand-primary mr-2" />
                          Guarantor Security Item {index + 1}
                        </h3>
                        {guarantorSecurityItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setGuarantorSecurityItems((prev) =>
                                prev.filter((_, i) => i !== index)
                              );
                              setGuarantorSecurityImages((prev) =>
                                prev.filter((_, i) => i !== index)
                              );
                            }}
                            className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Security Type Dropdown */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-text mb-1">
                            Type
                          </label>
                          <select
                            name="type"
                            value={item.type}
                            onChange={(e) => handleGuarantorSecurityChange(e, index)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none"
                            required
                          >
                            <option value="">-- Select Security Type --</option>
                            <option>Household Items</option>
                            <option>Business Equipment</option>
                            <option>Livestock</option>
                            <option>Motor Vehicle</option>
                            <option>Motorbike</option>
                            <option>Land / Property</option>
                            <option>Title deed</option>
                            <option>Logbook</option>
                            <option>Salary Check-off</option>
                            <option>Stock / Inventory</option>
                            <option>Fixed deposit / Savings security</option>
                            <option>Electronics</option>
                            <option>Other (specify)</option>
                          </select>
                        </div>

                        {/* Custom Security Type for "Other" - FIX BOUNCE */}
                        {item.type === "Other (specify)" && (
                          <div className="mb-4">
                            <FormField
                              label="Specific Security Type"
                              name="otherType"
                              value={item.otherType}
                              onChange={(e) => handleGuarantorSecurityChange(e, index)}
                              placeholder="Describe the security type..."
                              required
                              errors={errors}
                              index={index}
                            />
                          </div>
                        )}

                        {/* Description */}
                        <FormField
                          label="Description"
                          name="description"
                          value={item.description}
                          onChange={(e) => handleGuarantorSecurityChange(e, index)}
                          required
                          errors={errors}
                          index={index}
                          className="mb-4"
                        />

                        {/* Estimated Value */}
                        <FormField
                          label="Est. Market Value (KES)"
                          name="value"
                          type="number"
                          value={item.value}
                          onChange={(e) => handleGuarantorSecurityChange(e, index)}
                          required
                          errors={errors}
                          index={index}
                          className="mb-4"
                        />
                      </div>

                      {/* Images - Conditional */}
                      {imageUploadEnabled && (
                        <div className="mt-6">
                          <label className="block text-sm font-medium mb-3 text-text">
                            Item Images
                          </label>
                          <div className="flex gap-3 mb-4">
                            <label className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-surface text-brand-primary rounded-lg cursor-pointer hover:bg-brand-secondary/20 transition font-medium border border-brand-surface">
                              <ArrowUpTrayIcon className="w-5 h-5" />
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleMultipleFiles(e, index, setGuarantorSecurityImages, "guarantor")}
                                className="hidden"
                              />
                            </label>

                            <label className="flex md:hidden items-center justify-center gap-2 px-4 py-2 bg-brand-btn text-white rounded-lg cursor-pointer hover:bg-brand-primary transition-all duration-200">
                              <CameraIcon className="w-5 h-5" />
                              Camera
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple
                                onChange={(e) => handleMultipleFiles(e, index, setGuarantorSecurityImages, "guarantor")}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {
                            guarantorSecurityImages[index] && guarantorSecurityImages[index].length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                                {guarantorSecurityImages[index].map((img, imgIdx) => (
                                  <div key={imgIdx} className="relative group">
                                    <img
                                      src={URL.createObjectURL(img)}
                                      alt={`Guarantor Security ${index + 1} - Image ${imgIdx + 1}`}
                                      className="w-full h-32 object-cover rounded-lg border border-brand-surface shadow-sm"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMultipleFile(index, imgIdx, setGuarantorSecurityImages, "guarantor")}
                                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
                                    >
                                      <XMarkIcon className="w-4 h-4" />
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
                      )}
                    </div>
                  ))}

                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={addGuarantorSecurityItem}
                      className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Add Guarantor Security Item
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Next of Kin Details */}
            {activeSection === "nextOfKin" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-text flex items-center">
                    <UserGroupIcon className="h-8 w-8 text-brand-primary mr-3" />
                    Next of Kin Information
                  </h2>
                  <p className="text-muted mt-2">
                    Enter next of kin details (Max 3)
                  </p>
                </div>

                {formData.nextOfKins.map((nok, index) => (
                  <div key={index} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
                      <h3 className="text-md font-bold text-slate-700 flex items-center gap-2">
                        <span className="w-6 h-6 bg-brand-primary text-white text-xs rounded-full flex items-center justify-center">
                          {index + 1}
                        </span>
                        Next of Kin Entry {index + 1}
                      </h3>
                      {formData.nextOfKins.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeNextOfKin(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          title="Remove Entry"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FormField
                        label="First Name"
                        name="Firstname"
                        section="nextOfKins"
                        index={index}
                        value={nok.Firstname}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Surname"
                        name="Surname"
                        section="nextOfKins"
                        index={index}
                        value={nok.Surname}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="ID Number"
                        name="idNumber"
                        section="nextOfKins"
                        index={index}
                        value={nok.idNumber}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Relationship"
                        name="relationship"
                        section="nextOfKins"
                        index={index}
                        value={nok.relationship}
                        options={["Spouse", "Parent", "Sibling", "Child", "Other"]}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      {nok.relationship === "Other" && (
                        <FormField
                          label="Specify Relationship"
                          name="relationshipOther"
                          section="nextOfKins"
                          index={index}
                          value={nok.relationshipOther}
                          required
                          handleNestedChange={handleNestedChange}
                          errors={errors}
                        />
                      )}
                      <FormField
                        label="Mobile Number"
                        name="mobile"
                        section="nextOfKins"
                        index={index}
                        value={nok.mobile}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      {/* Employment Status Dropdown */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-text mb-1">
                          Employment Status *
                        </label>
                        <select
                          name="employmentStatus"
                          value={nok.employmentStatus}
                          onChange={(e) => handleNestedChange(e, 'nextOfKins', index)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
                          required
                        >
                          <option value="">Select Employment Status</option>
                          <option value="Employed">Employed</option>
                          <option value="Self Employed">Self Employed</option>
                        </select>
                      </div>

                      {/* Conditional Fields for Employed */}
                      {nok.employmentStatus === "Employed" && (
                        <>
                          <FormField
                            label="Company Name"
                            name="companyName"
                            value={nok.companyName}
                            section="nextOfKins"
                            index={index}
                            handleNestedChange={handleNestedChange}
                          />
                          <FormField
                            label="Estimated Salary (KES)"
                            name="salary"
                            type="number"
                            value={nok.salary}
                            section="nextOfKins"
                            index={index}
                            handleNestedChange={handleNestedChange}
                          />
                        </>
                      )}

                      {/* Conditional Fields for Self Employed */}
                      {nok.employmentStatus === "Self Employed" && (
                        <>
                          <FormField
                            label="Business Name"
                            name="businessName"
                            value={nok.businessName}
                            section="nextOfKins"
                            index={index}
                            handleNestedChange={handleNestedChange}
                          />
                          <FormField
                            label="Estimated Income (KES)"
                            name="businessIncome"
                            type="number"
                            value={nok.businessIncome}
                            section="nextOfKins"
                            index={index}
                            handleNestedChange={handleNestedChange}
                          />
                        </>
                      )}
                      <FormField
                        label="County"
                        name="county"
                        section="nextOfKins"
                        index={index}
                        value={nok.county}
                        options={KENYA_COUNTIES}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="City/Town"
                        name="cityTown"
                        section="nextOfKins"
                        index={index}
                        value={nok.cityTown}
                        options={nok.county ? COUNTY_TOWNS[nok.county] : []}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                        placeholder="Select County first"
                      />
                    </div>
                  </div>
                ))}

                {formData.nextOfKins.length < 3 && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={addNextOfKin}
                      className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Add Another Next of Kin
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Documents Verification - USING BRAND COLORS */}
            {activeSection === "documents" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-text flex items-center">
                    <DocumentTextIcon className="h-8 w-8 text-brand-primary mr-3" />
                    Document Verification
                  </h2>
                  <p className="text-muted mt-2">
                    Upload verification and officer images
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    {
                      key: "officerClient1",
                      label: "First Officer & Client",
                      handler: setOfficerClientImage1,
                    },
                    {
                      key: "officerClient2",
                      label: "Second Officer & Client",
                      handler: setOfficerClientImage2,
                    },
                    {
                      key: "bothOfficers",
                      label: "Both Officers & Client",
                      handler: setBothOfficersImage,
                    },
                  ].map((file) => (
                    <div
                      key={file.key}
                      className="flex flex-col items-start p-4 border border-brand-surface rounded-xl bg-brand-surface shadow-sm hover:shadow-md transition"
                    >
                      <label className="block text-sm font-medium text-brand-primary mb-3">
                        {file.label}
                      </label>

                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-brand-surface text-brand-primary rounded-lg shadow-sm cursor-pointer hover:bg-brand-secondary/20 transition">
                          <ArrowUpTrayIcon className="w-5 h-5" />
                          <span className="text-sm font-medium">Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleFileUpload(e, file.handler, file.key)
                            }
                            className="hidden"
                          />
                        </label>

                        <label className="flex md:hidden flex-1 items-center justify-center gap-2 px-4 py-2 bg-brand-btn text-white rounded-lg shadow-sm cursor-pointer hover:bg-brand-primary transition">
                          <CameraIcon className="w-5 h-5" />
                          <span className="text-sm font-medium">Camera</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) =>
                              handleFileUpload(e, file.handler, file.key)
                            }
                            className="hidden"
                          />
                        </label>
                      </div>

                      {previews[file.key] && (
                        <div className="mt-4 w-full">
                          <div className="relative">
                            <img
                              src={previews[file.key].url}
                              alt={file.label}
                              className="w-full h-40 object-cover rounded-lg border border-brand-surface shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveFile(file.key, file.handler)
                              }
                              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                          {/* Professional file name display */}
                          <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                            <p className="text-xs text-muted truncate" title={previews[file.key].fileName}>
                              📄 {previews[file.key].fileName}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-200">
              <div className="flex items-center gap-4">
                {activeSection !== sections[0].id && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = sections.findIndex((s) => s.id === activeSection);
                      setActiveSection(sections[currentIndex - 1].id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral text-text rounded-lg hover:bg-brand-surface transition-colors"
                    disabled={isSubmitting || isSavingDraft}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-secondary text-white rounded-lg hover:bg-brand-primary transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingDraft ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving Draft...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-4 w-4" />
                      Save as Draft
                    </div>
                  )}
                </button>
              </div>

              <div>
                {activeSection !== sections[sections.length - 1].id ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral text-text rounded-lg hover:bg-brand-surface transition-colors disabled:opacity-50"
                    disabled={isSubmitting || isSavingDraft || isValidating}
                  >
                    {isValidating ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-primary border-t-transparent"></div>
                        Validating...
                      </div>
                    ) : (
                      <>
                        Next
                        <ChevronRightIcon className="h-4 w-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || isSavingDraft}
                    className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Submitting Application...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5" />
                        Submit Application
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div >
      </div >
    </div >
  );
};

export default AddCustomer;