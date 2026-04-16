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


const CustomerForm = ({ leadData: propLeadData, }) => {


  const location = useLocation();

  // receive data from props OR from navigation state
  const leadData = propLeadData || location.state?.leadData || null;
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
            cleaned
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
            cleaned
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
            value
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
            const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", cleaned);
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
            const exists = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", value);
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
              cleaned
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
              value
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
              cleaned
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
              value
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

    // Paralellize uniqueness checks
    const uniqueChecks = fieldsToCheck
      .filter(({ value, field }) => value && !newErrors[field])
      .map(async ({ field, value, label }) => {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            field === "idNumber" ? "id_number" : "mobile",
            value
          );
          if (!isUnique) {
            return { field, error: `${label} already exists in our system` };
          }
        } catch (error) {
          console.error(`Error checking uniqueness for ${label}:`, error);
          return { field, error: `Error validating ${label}` };
        }
        return null;
      });

    const results = await Promise.all(uniqueChecks);
    results.filter(Boolean).forEach(({ field, error }) => {
      newErrors[field] = error;
      error(error);
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
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", mobile.replace(/\D/g, ""));
          if (!isUnique) {
            errorsFound[`guarantors_${index}_mobile`] = `Guarantor ${index + 1}: Mobile already exists`;
            error(errorsFound[`guarantors_${index}_mobile`]);
            hasErrors = true;
          }
        })());
      }
      if (idNumber && !errorsFound[`guarantors_${index}_idNumber`]) {
        uniqueChecks.push((async () => {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", idNumber);
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
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "mobile", mobile.replace(/\D/g, ""));
          if (!isUnique) {
            errorsFound[`nextOfKins_${index}_mobile`] = `Next of Kin ${index + 1}: Mobile already exists`;
            error(errorsFound[`nextOfKins_${index}_mobile`]);
            hasErrors = true;
          }
        })());
      }
      if (idNumber && !errorsFound[`nextOfKins_${index}_idNumber`]) {
        uniqueChecks.push((async () => {
          const isUnique = await checkUniqueValue(["customers", "guarantors", "next_of_kin"], "id_number", idNumber);
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
      const itemImages = images[index] || [];
      return itemImages.map(async (file) => {
        const filePath = `${isGuarantor ? 'guarantor_security' : 'borrower_security'}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
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
    <div className="min-h-screen bg-muted py-8 font-body relative">
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
                  onClick={() => setActiveSection(id)}
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
        <div className="bg-gray-50 rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8">
            {/* Personal Information */}
            {activeSection === "personal" && (
              <div className="space-y-8 ">
                <div className="border-b border-gray-200 pb-6 ">
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
                    handleNestedChange={handleNestedChange}
                  />

                  <FormField
                    label="Town/City"
                    name="town"
                    value={formData.town}
                    onChange={handleChange}
                    options={formData.county ? COUNTY_TOWNS[formData.county] : []}
                    placeholder={formData.county ? `Select ${formData.county} Town` : "Select County First"}
                    handleNestedChange={handleNestedChange}
                  />
                </div>

                {/* Document Uploads - USING BRAND COLORS */}
                {imageUploadEnabled && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-text mb-6">
                      Personal Documents
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        {
                          key: "passport",
                          label: "Passport Photo",
                          handler: setPassportFile,
                        },
                        {
                          key: "idFront",
                          label: "ID Front",
                          handler: setIdFrontFile,
                        },
                        {
                          key: "idBack",
                          label: "ID Back",
                          handler: setIdBackFile,
                        },
                        {
                          key: "house",
                          label: "House Image",
                          handler: setHouseImageFile,
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
                            <label className="flex flex-1 items-center justify-center gap-2 px-4 py-3 bg-brand-surface text-brand-primary rounded-lg shadow-sm cursor-pointer hover:bg-brand-secondary/20 transition-all duration-200 w-full sm:w-1/2">
                              <ArrowUpTrayIcon className="w-5 h-5" />
                              <span className="text-sm font-medium">Upload</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                                className="hidden"
                              />
                            </label>

                            <label className="flex md:hidden flex-1 items-center justify-center gap-2 px-4 py-3 bg-brand-btn text-white rounded-lg shadow-sm cursor-pointer hover:bg-brand-primary transition-all duration-200 w-full sm:w-1/2">
                              <CameraIcon className="w-5 h-5" />
                              <span className="text-sm font-medium">Camera</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture={file.key === "passport" ? "user" : "environment"}
                                onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {previews[file.key] && (
                            <div className="mt-4 w-full">
                              <div className="relative">
                                <img
                                  src={previews[file.key].url}
                                  alt={`${file.label} preview`}
                                  className="w-full h-40 object-cover rounded-lg border border-brand-surface shadow-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFile(file.key, file.handler)}
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
                    onChange={(e) => {
                      if (e.target.value === "Other") {
                        setIsCustomIndustry(true);
                        setFormData(prev => ({ ...prev, industry: "" }));
                      } else {
                        setIsCustomIndustry(false);
                        handleChange(e);
                      }
                      setFormData(prev => ({ ...prev, businessType: "" }));
                      setIsCustomType(false);
                    }}
                    options={[...Object.keys(INDUSTRIES), "Other"]}
                    required
                    errors={errors}
                  />

                  {isCustomIndustry && (
                    <FormField
                      label="Custom Industry"
                      name="industry"
                      value={formData.industry}
                      onChange={handleChange}
                      placeholder="Enter business industry..."
                      required
                      errors={errors}
                    />
                  )}

                  <FormField
                    label="Business Type"
                    name="businessType"
                    value={formData.businessType}
                    onChange={(e) => {
                      if (e.target.value === "Other") {
                        setIsCustomType(true);
                        setFormData(prev => ({ ...prev, businessType: "" }));
                      } else {
                        setIsCustomType(false);
                        handleChange(e);
                      }
                    }}
                    options={formData.industry && INDUSTRIES[formData.industry] ? [...INDUSTRIES[formData.industry], "Other"] : ["Other"]}
                    placeholder={formData.industry ? `Select ${formData.industry} Type` : "Select Industry First"}
                    required
                    errors={errors}
                  />

                  {isCustomType && (
                    <FormField
                      label="Custom Business Type"
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleChange}
                      placeholder="Enter business type..."
                      required
                      errors={errors}
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
                    label="Business County"
                    name="businessCounty"
                    value={formData.businessCounty}
                    onChange={handleChange}
                    options={KENYA_COUNTIES}
                    required
                    errors={errors}
                  />
                  <FormField
                    label="Town/City (Business Location)"
                    name="businessLocation"
                    value={formData.businessLocation}
                    onChange={handleChange}
                    options={formData.businessCounty ? COUNTY_TOWNS[formData.businessCounty] : []}
                    placeholder={formData.businessCounty ? `Select ${formData.businessCounty} Town` : "Select County First"}
                    required
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

                {/* Business Images - USING BRAND COLORS */}
                {imageUploadEnabled && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-text">
                        Business Images
                      </h3>
                    </div>

                    <div className="bg-brand-surface rounded-xl p-6 border border-brand-surface">
                      <label className="block text-sm font-medium mb-2 text-text">
                        Business Images
                      </label>
                      <div className="flex gap-3 mb-4">
                        <label className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-surface text-brand-primary rounded-lg cursor-pointer hover:bg-brand-secondary/20 transition">
                          <ArrowUpTrayIcon className="w-5 h-5" />
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleBusinessImages}
                            className="hidden"
                          />
                        </label>

                        <label className="flex md:hidden items-center justify-center gap-2 px-4 py-2 bg-brand-btn text-white rounded-lg cursor-pointer hover:bg-brand-primary transition">
                          <CameraIcon className="w-5 h-5" />
                          Camera
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            onChange={handleBusinessImages}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Display Business Images Grid */}
                      {businessImages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                          {businessImages.map((img, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={URL.createObjectURL(img)}
                                alt={`Business Image ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border border-brand-surface shadow-sm"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveBusinessImage(index)}
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

                          {/* Display Image Grid - FIXED */}
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
                {Array.isArray(formData.guarantors) && formData.guarantors.map((g, index) => (
                  <div key={index} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                    {formData.guarantors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGuarantor(index)}
                        className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-2"
                        title="Remove Guarantor"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                    
                    <div className="border-b border-gray-200 pb-6 mb-6">
                      <h2 className="text-lg font-semibold text-text flex items-center">
                        <UserGroupIcon className="h-8 w-8 text-brand-primary mr-3" />
                        Guarantor {index + 1} Information
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                      <FormField
                        label="Prefix"
                        name="prefix"
                        value={g.prefix}
                        section="guarantors"
                        index={index}
                        options={["Mr", "Mrs", "Ms", "Dr"]}
                        handleNestedChange={handleNestedChange}
                      />
                      <FormField
                        label="First Name"
                        name="Firstname"
                        value={g.Firstname}
                        section="guarantors"
                        index={index}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Middle Name"
                        name="Middlename"
                        value={g.Middlename}
                        section="guarantors"
                        index={index}
                        handleNestedChange={handleNestedChange}
                      />
                      <FormField
                        label="Surname"
                        name="Surname"
                        value={g.Surname}
                        section="guarantors"
                        index={index}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="ID Number"
                        name="idNumber"
                        value={g.idNumber}
                        section="guarantors"
                        index={index}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Mobile Number"
                        name="mobile"
                        value={g.mobile}
                        section="guarantors"
                        index={index}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Alternative Number"
                        name="alternativeMobile"
                        value={g.alternativeMobile}
                        section="guarantors"
                        index={index}
                        handleNestedChange={handleNestedChange}
                      />
                      <FormField
                        label="Date of Birth"
                        name="dateOfBirth"
                        type="date"
                        value={g.dateOfBirth}
                        section="guarantors"
                        index={index}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Gender"
                        name="gender"
                        value={g.gender}
                        section="guarantors"
                        index={index}
                        options={["Male", "Female"]}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Marital Status"
                        name="maritalStatus"
                        value={g.maritalStatus}
                        section="guarantors"
                        index={index}
                        options={[
                          "Single",
                          "Married",
                          "Separated/Divorced",
                          "Other",
                        ]}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Residence Status"
                        name="residenceStatus"
                        value={g.residenceStatus}
                        section="guarantors"
                        index={index}
                        options={["Own", "Rent", "Family", "Other"]}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Occupation"
                        name="occupation"
                        value={g.occupation}
                        section="guarantors"
                        index={index}
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Relationship"
                        name="relationship"
                        value={g.relationship}
                        section="guarantors"
                        index={index}
                        placeholder="e.g. Spouse, Friend"
                        handleNestedChange={handleNestedChange}
                        required
                      />
                      <FormField
                        label="Postal Address"
                        name="postalAddress"
                        value={g.postalAddress}
                        section="guarantors"
                        index={index}
                        handleNestedChange={handleNestedChange}
                      />
                      <FormField
                        label="Postal Code"
                        name="code"
                        type="number"
                        value={g.code}
                        section="guarantors"
                        index={index}
                        handleNestedChange={handleNestedChange}
                      />

                      <FormField
                        label="Guarantor County"
                        name="county"
                        value={g?.county || ""}
                        section="guarantors"
                        index={index}
                        options={KENYA_COUNTIES}
                        handleNestedChange={handleNestedChange}
                      />
                      <FormField
                        label="City/Town"
                        name="cityTown"
                        value={g.cityTown}
                        section="guarantors"
                        index={index}
                        options={g.county ? COUNTY_TOWNS[g.county] : []}
                        placeholder={g.county ? `Select ${g.county} Town` : "Select County First"}
                        handleNestedChange={handleNestedChange}
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
                                    onChange={(e) => handleFileUpload(e, file.setter, file.key, index)} 
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
                                    onChange={(e) => handleFileUpload(e, file.setter, file.key, index)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              {previews[`${file.key}_${index}`] && (
                                <div className="mt-3 relative">
                                  <img 
                                    src={previews[`${file.key}_${index}`].url} 
                                    alt={file.label} 
                                    className="w-full h-24 object-cover rounded-lg border border-white" 
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveFile(file.key, file.setter, index)}
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
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
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

                      {/* Images - USING BRAND COLORS */}
                      {imageUploadEnabled && (
                        <div className="mt-6">
                          <label className="block text-sm font-medium mb-2 text-text">
                            Item Images
                          </label>
                          <div className="flex gap-3 mb-3">
                            <label className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary rounded-lg cursor-pointer hover:bg-brand-secondary/20 transition font-medium">
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

                            <label className="flex md:hidden items-center justify-center gap-2 px-6 py-3 bg-brand-btn text-white rounded-lg cursor-pointer hover:bg-brand-primary transition font-medium">
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

                          {guarantorSecurityImages[index] && guarantorSecurityImages[index].length > 0 && (
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

            {/* Next of Kin */}
            {activeSection === "nextOfKin" && (
              <div className="space-y-8">
                {Array.isArray(formData.nextOfKins) && formData.nextOfKins.map((nok, index) => (
                  <div key={index} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                    {formData.nextOfKins.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeNextOfKin(index)}
                        className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-2"
                        title="Remove Next of Kin"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}

                    <div className="border-b border-gray-200 pb-6 mb-6">
                      <h2 className="text-lg font-semibold text-text flex items-center">
                        <UserGroupIcon className="h-8 w-8 text-brand-primary mr-3" />
                        Next of Kin {index + 1} Information
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FormField
                        label="First Name"
                        name="Firstname"
                        value={nok.Firstname}
                        section="nextOfKins"
                        index={index}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Middle Name"
                        name="Middlename"
                        value={nok.Middlename}
                        section="nextOfKins"
                        index={index}
                        handleNestedChange={handleNestedChange}
                      />
                      <FormField
                        label="Surname"
                        name="Surname"
                        value={nok.Surname}
                        section="nextOfKins"
                        index={index}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="ID Number"
                        name="idNumber"
                        value={nok.idNumber}
                        section="nextOfKins"
                        index={index}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Mobile Number"
                        name="mobile"
                        value={nok.mobile}
                        section="nextOfKins"
                        index={index}
                        required
                        handleNestedChange={handleNestedChange}
                        errors={errors}
                      />
                      <FormField
                        label="Alternative Number"
                        name="alternativeNumber"
                        value={nok.alternativeNumber}
                        section="nextOfKins"
                        index={index}
                        handleNestedChange={handleNestedChange}
                      />

                      {/* Relationship Dropdown */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-text mb-1">
                          Relationship *
                        </label>
                        <select
                          name="relationship"
                          value={nok.relationship}
                          onChange={(e) => handleNestedChange(e, 'nextOfKins', index)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
                          required
                        >
                          <option value="">Select Relationship</option>
                          <option value="Sister">Sister</option>
                          <option value="Brother">Brother</option>
                          <option value="Guardian">Guardian</option>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Other Relationship Specification */}
                      {nok.relationship === "Other" && (
                        <FormField
                          label="Specify Relationship"
                          name="relationshipOther"
                          value={nok.relationshipOther}
                          section="nextOfKins"
                          index={index}
                          required
                          handleNestedChange={handleNestedChange}
                        />
                      )}

                      {/* Employment Status Dropdown */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-text mb-1">
                          Employment Status
                        </label>
                        <select
                          name="employmentStatus"
                          value={nok.employmentStatus}
                          onChange={(e) => handleNestedChange(e, 'nextOfKins', index)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none"
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
                        label="Next of Kin County"
                        name="county"
                        value={nok.county}
                        section="nextOfKins"
                        index={index}
                        options={KENYA_COUNTIES}
                        handleNestedChange={handleNestedChange}
                      />

                      <FormField
                        label="City/Town"
                        name="cityTown"
                        value={nok.cityTown}
                        section="nextOfKins"
                        index={index}
                        options={nok.county ? COUNTY_TOWNS[nok.county] : []}
                        placeholder={nok.county ? `Select ${nok.county} Town` : "Select County First"}
                        handleNestedChange={handleNestedChange}
                      />
                    </div>
                  </div>
                ))}

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
              </div>
            )}

            {/* Documents Verification - USING BRAND COLORS */}
            {(activeSection === "documents" && documentUploadEnabled) && (
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
                      <label className="block text-sm font-medium text-text mb-3">
                        {file.label}
                      </label>

                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-brand-surface text-brand-primary rounded-lg shadow-sm cursor-pointer hover:bg-brand-secondary/20 transition duration-200">
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

                        <label className="flex md:hidden flex-1 items-center justify-center gap-2 px-4 py-2 bg-brand-btn text-white rounded-lg shadow-sm cursor-pointer hover:bg-brand-primary transition duration-200">
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
                    className="flex items-center gap-2 px-6 py-2 bg-brand-surface text-text rounded-lg hover:bg-brand-secondary/20 transition-all font-medium border border-brand-surface shadow-sm"
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
                  className="flex items-center gap-2 px-6 py-2 bg-brand-surface text-brand-primary rounded-lg hover:bg-brand-secondary/20 transition-all border border-brand-surface shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingDraft ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-primary border-t-transparent"></div>
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-4 w-4" />
                      Draft
                    </div>
                  )}
                </button>
              </div>

              <div>
                {activeSection !== sections[sections.length - 1].id ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-2 px-8 py-2 bg-brand-btn text-white rounded-lg hover:bg-brand-primary transition-all shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting || isSavingDraft || isValidating}
                  >
                    {isValidating ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
                    className="px-8 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all shadow-lg hover:shadow-brand-primary/20 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Submitting...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5" />
                        Complete Application
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerForm;