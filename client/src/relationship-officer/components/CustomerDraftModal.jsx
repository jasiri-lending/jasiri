import { useState, memo, useEffect,useCallback } from "react"; 
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";
import { useParams, useNavigate } from "react-router-dom";
import { Upload, Camera, XIcon } from "lucide-react";
import {
  UserCircleIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  IdentificationIcon,
  DocumentTextIcon,
  XCircleIcon,
   PhotoIcon,
  ArrowUpTrayIcon,
  CameraIcon,
  XMarkIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/userAuth";

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
  }) => {
    let errorMessage = '';
    
    if (section) {
      errorMessage = errors?.[section]?.[name];
    } else {
      errorMessage = errors?.[name];
    }

    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {options ? (
          <select
            name={name}
            value={value || ""}
            onChange={section ? (e) => handleNestedChange(e, section) : onChange}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
              errorMessage ? "border-red-500" : "border-gray-300"
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
            type={type}
            name={name}
            value={value || ""}
            onChange={section ? (e) => handleNestedChange(e, section) : onChange}
            placeholder={placeholder}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
              errorMessage ? "border-red-500" : "border-gray-300"
            }`}
            required={required}
            disabled={disabled}
          />
        )}

        {errorMessage && (
          <span className="text-red-500 text-xs mt-1">{errorMessage}</span>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

const CustomerDraft = () => { 
   const { draftId } = useParams();
  const navigate = useNavigate();
  const customerId = draftId;
  const [activeSection, setActiveSection] = useState("personal");
    const { profile } = useAuth();
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Initialize formData with empty values

 const [formData, setFormData] = useState({
  // Personal Info
   id: '',
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
  
  // Nested objects 
  spouse: {
    name: '',
    idNumber: '',
    mobile: '',
    economicActivity: ''
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
    relationshipOther: '' 
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
    cityTown: ''
  }
});
  

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



  // File upload state
  const [passportFile, setPassportFile] = useState(null);
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [houseImageFile, setHouseImageFile] = useState(null);
  const [businessImages, setBusinessImages] = useState([]);
  const [securityItemImages, setSecurityItemImages] = useState([]);
  const [guarantorPassportFile, setGuarantorPassportFile] = useState(null);
  const [guarantorIdFrontFile, setGuarantorIdFrontFile] = useState(null);
  const [guarantorIdBackFile, setGuarantorIdBackFile] = useState(null);
  const [guarantorSecurityImages, setGuarantorSecurityImages] = useState([]);
  const [officerClientImage1, setOfficerClientImage1] = useState(null);
  const [officerClientImage2, setOfficerClientImage2] = useState(null);
  const [bothOfficersImage, setBothOfficersImage] = useState(null);
  const [previews, setPreviews] = useState({});
  
  const [uploadedFiles, setUploadedFiles] = useState(new Set());

  // ========= LOAD EXISTING DRAFT/CUSTOMER DATA =========
  useEffect(() => {
    if (customerId) {
      loadCustomerData(customerId);
    }
  }, [customerId]);




const loadCustomerData = async (id) => {
  try {
    setIsLoading(true);
    console.log("Loading full customer data for ID:", id);

    // 1. PARALLEL FETCH ALL TABLES
    const [
      { data: customer },
      { data: guarantor },
      { data: nextOfKin },
      { data: spouse },
      { data: securityItemsData },
      { data: businessImagesData },
      { data: documentsData },
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("guarantors").select("*").eq("customer_id", id).single(),
      supabase.from("next_of_kin").select("*").eq("customer_id", id).single(),
      supabase.from("spouse").select("*").eq("customer_id", id).single(),
      supabase.from("security_items").select("*, security_item_images(image_url)").eq("customer_id", id),
      supabase.from("business_images").select("*").eq("customer_id", id),
      supabase.from("documents").select("id, document_type, document_url").eq("customer_id", id),
    ]);

    // 2. Build form data with ALL fields
    const updatedFormData = {
      // Personal Info
        id: customer?.id || '',
      prefix: customer?.prefix || "",
      Firstname: customer?.Firstname || "",
      Middlename: customer?.Middlename || "",
      Surname: customer?.Surname || "",
      maritalStatus: customer?.marital_status || "",
      residenceStatus: customer?.residence_status || "",
      mobile: customer?.mobile || "",
      alternativeMobile: customer?.alternative_mobile || "",
      occupation: customer?.occupation || "",
      dateOfBirth: customer?.date_of_birth?.split("T")[0] || "",
      gender: customer?.gender || "",
      idNumber: customer?.id_number?.toString() || "",
      postalAddress: customer?.postal_address || "",
      code: customer?.code?.toString() || "",
      town: customer?.town || "",
      county: customer?.county || "",
      
      // Business Info
      businessName: customer?.business_name || "",
      businessType: customer?.business_type || "",
      yearEstablished: customer?.year_established || "",
      businessLocation: customer?.business_location || "",
      daily_Sales: customer?.daily_Sales?.toString() || "",
      road: customer?.road || "",
      landmark: customer?.landmark || "",
      hasLocalAuthorityLicense: customer?.has_local_authority_license ? "Yes" : "No",
      prequalifiedAmount: customer?.prequalifiedAmount?.toString() || "",
      status: customer?.status || "pending",

      // Business Coordinates from database columns
      businessCoordinates: customer?.business_lat && customer?.business_lng 
        ? { lat: customer.business_lat, lng: customer.business_lng }
        : null,

      // SPOUSE DATA - NOW USED
      spouse: spouse
        ? {
            name: spouse.name || "",
            idNumber: spouse.id_number || "",
            mobile: spouse.mobile || "",
            economicActivity: spouse.economic_activity || ""
          }
        : {
            name: '',
            idNumber: '',
            mobile: '',
            economicActivity: ''
          },

      // NEXT OF KIN - NOW USED
      nextOfKin: nextOfKin
        ? {
            Firstname: nextOfKin.Firstname || "",
            Surname: nextOfKin.Surname || "",
            Middlename: nextOfKin.Middlename || "",
            idNumber: nextOfKin.id_number?.toString() || "",
            relationship: nextOfKin.relationship || "",
            mobile: nextOfKin.mobile || "",
            alternativeNumber: nextOfKin.alternative_number || "",
            employmentStatus: nextOfKin.employment_status || "",
            county: nextOfKin.county || "",
            cityTown: nextOfKin.city_town || "",
            companyName: nextOfKin.company_name || "",
            salary: nextOfKin.salary?.toString() || "",
            businessName: nextOfKin.business_name || "",
            businessIncome: nextOfKin.business_income?.toString() || "",
            relationshipOther: nextOfKin.relationship_other || ""
          }
        : {
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
          },

      // GUARANTOR - UPDATED
      guarantor: guarantor
        ? {
            prefix: guarantor.prefix || "",
            Firstname: guarantor.Firstname || "",
            Surname: guarantor.Surname || "",
            Middlename: guarantor.Middlename || "",
            idNumber: guarantor.id_number?.toString() || "",
            maritalStatus: guarantor.marital_status || "",
            gender: guarantor.gender || "",
            mobile: guarantor.mobile || "",
            alternativeMobile: guarantor.alternative_number || "", // Fixed field name
            residenceStatus: guarantor.residence_status || "",
            postalAddress: guarantor.postal_address || "",
            code: guarantor.code?.toString() || "",
            occupation: guarantor.occupation || "",
            relationship: guarantor.relationship || "",
            dateOfBirth: guarantor.date_of_birth?.split("T")[0] || "",
            county: guarantor.county || "",
            cityTown: guarantor.city_town || "",
          }
        : {
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
          }
    };

    setFormData(updatedFormData);
    console.log("Form data set with spouse and nextOfKin:", updatedFormData);

    // 3. Process security items
    const processedSecurityItems = securityItemsData?.map((item) => ({
      id: item.id,
      item: item.item || "",
      description: item.description || "",
      identification: item.identification || "",
      value: item.value?.toString() || "",
    })) || [];
    setSecurityItems(processedSecurityItems);

    const securityImages = securityItemsData?.map((item) =>
      item.security_item_images
        ? item.security_item_images.map((img) => img.image_url)
        : []
    );
    setSecurityItemImages(securityImages || []);

    // 4. Process guarantor security items
    let guarantorSecurityData = [];
    if (guarantor?.id) {
      const { data } = await supabase
        .from("guarantor_security")
        .select("*, guarantor_security_images(image_url)")
        .eq("guarantor_id", guarantor.id);
      guarantorSecurityData = data || [];
    }

    const processedGuarantorSecurity = guarantorSecurityData?.map((item) => ({
      id: item.id,
      item: item.item || "",
      description: item.description || "",
      identification: item.identification || "",
      value: item.estimated_market_value?.toString() || "",
    })) || [];
    setGuarantorSecurityItems(processedGuarantorSecurity);

    const guarantorSecurityImages = guarantorSecurityData?.map((item) =>
      item.guarantor_security_images
        ? item.guarantor_security_images.map((img) => img.image_url)
        : []
    );
    setGuarantorSecurityImages(guarantorSecurityImages || []);

    // 5. Image previews - Set existing images without object URLs
// 5. Image previews - Set existing images without object URLs
const imageData = {
  passport: customer?.passport_url ? { 
    url: customer.passport_url, 
    fileName: 'passport.jpg',
    isExisting: true 
  } : null,
  idFront: customer?.id_front_url ? { 
    url: customer.id_front_url, 
    fileName: 'id_front.jpg',
    isExisting: true 
  } : null,
  idBack: customer?.id_back_url ? { 
    url: customer.id_back_url, 
    fileName: 'id_back.jpg',
    isExisting: true 
  } : null,
  house: customer?.house_image_url ? { 
    url: customer.house_image_url, 
    fileName: 'house.jpg',
    isExisting: true 
  } : null,
  business: businessImagesData?.map((img, index) => ({ 
    url: img.image_url, 
    fileName: `business_${index + 1}.jpg`,
    isExisting: true 
  })) || [],
  
  // FIX: Ensure security is an array of arrays
  security: securityItemsData?.map((item, itemIndex) => 
    item.security_item_images?.map((img, imgIndex) => ({
      url: img.image_url,
      fileName: `security_${itemIndex + 1}_${imgIndex + 1}.jpg`,
      isExisting: true
    })) || []
  ) || [],
  
  guarantorPassport: guarantor?.passport_url ? { 
    url: guarantor.passport_url, 
    fileName: 'guarantor_passport.jpg',
    isExisting: true 
  } : null,
  guarantorIdFront: guarantor?.id_front_url ? { 
    url: guarantor.id_front_url, 
    fileName: 'guarantor_id_front.jpg',
    isExisting: true 
  } : null,
  guarantorIdBack: guarantor?.id_back_url ? { 
    url: guarantor.id_back_url, 
    fileName: 'guarantor_id_back.jpg',
    isExisting: true 
  } : null,
  
  // FIX: Ensure guarantorSecurity is an array of arrays
  guarantorSecurity: guarantorSecurityData?.map((item, itemIndex) => 
    item.guarantor_security_images?.map((img, imgIndex) => ({
      url: img.image_url,
      fileName: `guarantor_security_${itemIndex + 1}_${imgIndex + 1}.jpg`,
      isExisting: true
    })) || []
  ) || [],
  
  officerClient1: documentsData?.find(
    (doc) => doc.document_type === "First Officer and Client Image"
  )?.document_url ? { 
    url: documentsData.find(
      (doc) => doc.document_type === "First Officer and Client Image"
    )?.document_url, 
    fileName: 'officer_client_1.jpg',
    isExisting: true 
  } : null,
  officerClient2: documentsData?.find(
    (doc) => doc.document_type === "Second Officer and Client Image"
  )?.document_url ? { 
    url: documentsData.find(
      (doc) => doc.document_type === "Second Officer and Client Image"
    )?.document_url, 
    fileName: 'officer_client_2.jpg',
    isExisting: true 
  } : null,
  bothOfficers: documentsData?.find(
    (doc) => doc.document_type === "Both Officers Image"
  )?.document_url ? { 
    url: documentsData.find(
      (doc) => doc.document_type === "Both Officers Image"
    )?.document_url, 
    fileName: 'both_officers.jpg',
    isExisting: true 
  } : null,
};

    setPreviews(imageData);
    console.log("Images set:", imageData);

    // Also set the business images state for existing images
   if (businessImagesData?.length > 0) {
      const existingBusinessImages = businessImagesData.map(img => {
        return new File([], img.image_url, { type: 'image/jpeg' });
      });
      setBusinessImages(existingBusinessImages);
    }

  } catch (error) {
    console.error("Error loading customer data:", error);
    toast.error("Failed to load customer data. Please try again.", {
      position: "top-right",
    });
  } finally {
    setIsLoading(false);
  }
};






  
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
    { id: "documents", label: "Documents", icon: DocumentTextIcon },
  ];


  // Add this function before the handleSubmit function
const checkUniqueValue = async (tables, field, value) => {
  if (!value) return true;
  
  try {
    // Check across multiple tables for uniqueness
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select(field)
        .eq(field, value);
      
      if (error) throw error;
      
      // If we find any existing record (and it's not the current customer), it's not unique
      if (data && data.length > 0) {
        // If we're editing an existing customer, check if the found record is the same customer
        if (customerId && table === 'customers') {
          const isSameCustomer = data.some(record => record.id === customerId);
          if (!isSameCustomer) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Error checking uniqueness:', error);
    throw error;
  }
};

    // Auto-geocode business address when fields change
  useEffect(() => {
    const { county, businessLocation, landmark, road } = formData;

    // Only run when enough details are provided
    if (!county || !businessLocation) return;

    const fullAddress = `${landmark || ""} ${road || ""} ${businessLocation}, ${county}, Kenya`;

    const fetchCoordinates = async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`;

        const response = await fetch(url);
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
    };

    fetchCoordinates();
  }, [
    formData.county,
    formData.businessLocation,
    formData.landmark,
    formData.road,
  ]);

  const handleChange = useCallback((e) => {
  const { name, value } = e.target;

  // Handle "yearEstablished" to ensure it always sends valid date format
  if (name === "yearEstablished") {
    // Ensure it's a valid YYYY-MM-DD string
    const formattedDate = value && value.length === 4
      ? `${value}-01-01` // if user ever types only year manually
      : value;
    setFormData((prev) => ({ ...prev, [name]: formattedDate }));
  } else {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  if (errors[name]) {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }
}, [errors]);


  const handleNestedChange = useCallback((e, section) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [name]: value },
    }));
    if (errors[`${section}.${name}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`${section}.${name}`];
        return newErrors;
      });
    }
  }, [errors]);

  
  const handleLocationChange = useCallback((coords) => {
    setFormData((prev) => ({ ...prev, businessCoordinates: coords }));
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
      { item: "", description: "", identification: "", value: "" },
    ]);
    setSecurityItemImages([...securityItemImages, []]);
  };

  const removeSecurityItem = (index) => {
    setSecurityItems((prev) => prev.filter((_, i) => i !== index));
    setSecurityItemImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addGuarantorSecurityItem = () => {
    setGuarantorSecurityItems([
      ...guarantorSecurityItems,
      { item: "", description: "", identification: "", value: "" },
    ]);
    setGuarantorSecurityImages([...guarantorSecurityImages, []]);
  };


  // Add these helper functions
const handleRemoveSecurityPreview = (sectionIndex, fileIndex) => {
  setPreviews(prev => {
    const updatedSecurity = [...(prev.security || [])];
    if (updatedSecurity[sectionIndex]) {
      const removedPreview = updatedSecurity[sectionIndex][fileIndex];
      // Revoke object URL if it's a new upload
      if (removedPreview?.url && removedPreview.isObjectUrl) {
        URL.revokeObjectURL(removedPreview.url);
      }
      updatedSecurity[sectionIndex] = updatedSecurity[sectionIndex].filter((_, i) => i !== fileIndex);
    }
    return { ...prev, security: updatedSecurity };
  });
};

const handleRemoveGuarantorSecurityPreview = (sectionIndex, fileIndex) => {
  setPreviews(prev => {
    const updatedGuarantorSecurity = [...(prev.guarantorSecurity || [])];
    if (updatedGuarantorSecurity[sectionIndex]) {
      const removedPreview = updatedGuarantorSecurity[sectionIndex][fileIndex];
      // Revoke object URL if it's a new upload
      if (removedPreview?.url && removedPreview.isObjectUrl) {
        URL.revokeObjectURL(removedPreview.url);
      }
      updatedGuarantorSecurity[sectionIndex] = updatedGuarantorSecurity[sectionIndex].filter((_, i) => i !== fileIndex);
    }
    return { ...prev, guarantorSecurity: updatedGuarantorSecurity };
  });
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
  console.log(`Guarantor security ${index} - ${name}:`, value);
  
  setGuarantorSecurityItems(prev => 
    prev.map((item, i) => 
      i === index ? { ...item, [name]: value } : item
    )
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

    // Create object URL for preview
    const objectUrl = URL.createObjectURL(compressedFile);
    
    // Store preview with both object URL and file info
    setPreviews((prev) => ({
      ...prev,
      [key]: { 
        url: objectUrl, 
        fileName: file.name,
        isObjectUrl: true // Flag to identify object URLs
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
  // Get the current preview
  const currentPreview = previews[key];
  
  // Revoke object URL if it's a new upload (has isObjectUrl flag)
  if (currentPreview?.url && currentPreview.isObjectUrl) {
    try {
      URL.revokeObjectURL(currentPreview.url);
    } catch (err) {
      console.warn("Failed to revoke object URL", err);
    }
  }

  // Remove from global tracker if it's a new file
  if (currentPreview?.fileName && !currentPreview.isExisting) {
    setUploadedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.delete(currentPreview.fileName);
      return newSet;
    });
  }

  // Clear the file state
  if (typeof setter === "function") {
    setter(null);
  }

  // Clear the preview
  setPreviews((prev) => ({
    ...prev,
    [key]: null
  }));
};

  // Fixed multiple file handler for security items
  const handleMultipleFiles = (e, index, setter) => {
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
      toast.error("Surname is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!formData.mobile?.trim()) {
      newErrors.mobile = "Mobile number is required";
      toast.error("Mobile number is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!formData.alternativeMobile?.trim()) {
      newErrors.alternativeMobile = "Alternative mobile number is required";
      toast.error("Alternative mobile number is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!formData.idNumber?.trim()) {
      newErrors.idNumber = "ID number is required";
      toast.error("ID number is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (formData.mobile && !/^[0-9]{10,15}$/.test(formData.mobile.replace(/\D/g, ""))) {
      newErrors.mobile = "Please enter a valid mobile number (10-15 digits)";
      toast.error("Invalid mobile number format", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (formData.alternativeMobile && !/^[0-9]{10,15}$/.test(formData.alternativeMobile.replace(/\D/g, ""))) {
      newErrors.alternativeMobile = "Please enter a valid alternative mobile number (10-15 digits)";
      toast.error("Invalid alternative mobile number format", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (formData.idNumber && !/^[0-9]{6,12}$/.test(formData.idNumber)) {
      newErrors.idNumber = "Please enter a valid ID number (6-12 digits)";
      toast.error("Invalid ID number format", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (formData.dateOfBirth && !isAtLeast18YearsOld(formData.dateOfBirth)) {
      newErrors.dateOfBirth = "Customer must be at least 18 years old";
      toast.error("Customer must be at least 18 years old", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    // Validate spouse info if married
    if (formData.maritalStatus === "Married") {
      if (!formData.spouse.name?.trim()) {
        newErrors.spouseName = "Spouse name is required for married customers";
        toast.error("Spouse name is required", { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }
      if (!formData.spouse.idNumber?.trim()) {
        newErrors.spouseIdNumber = "Spouse ID number is required for married customers";
        toast.error("Spouse ID number is required", { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }
      if (!formData.spouse.mobile?.trim()) {
        newErrors.spouseMobile = "Spouse mobile number is required for married customers";
        toast.error("Spouse mobile number is required", { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }
      if (!formData.spouse.economicActivity?.trim()) {
        newErrors.spouseEconomicActivity = "Spouse economic activity is required for married customers";
        toast.error("Spouse economic activity is required", { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }

      // Validate spouse ID format
      if (formData.spouse.idNumber && !/^[0-9]{6,12}$/.test(formData.spouse.idNumber)) {
        newErrors.spouseIdNumber = "Please enter a valid spouse ID number (6-12 digits)";
        toast.error("Invalid spouse ID number format", { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }

      // Validate spouse mobile format
      if (formData.spouse.mobile && !/^[0-9]{10,15}$/.test(formData.spouse.mobile.replace(/\D/g, ""))) {
        newErrors.spouseMobile = "Please enter a valid spouse mobile number (10-15 digits)";
        toast.error("Invalid spouse mobile number format", { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }
    }

    const fieldsToCheck = [
      { field: "mobile", value: formData.mobile, label: "Mobile number" },
      { field: "alternativeMobile", value: formData.alternativeMobile, label: "Alternative mobile" },
      { field: "idNumber", value: formData.idNumber, label: "ID number" },
    ];

    for (const { field, value, label } of fieldsToCheck) {
      if (value && !newErrors[field]) {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            field === "idNumber" ? "id_number" : "mobile",
            value
          );
          if (!isUnique) {
            newErrors[field] = `${label} already exists in our system`;
            toast.error(`${label} already exists in our system`, { position: "top-right", autoClose: 3000 });
            hasErrors = true;
          }
        } catch (error) {
          console.error("Error checking uniqueness:", error);
          newErrors[field] = `Error validating ${label}`;
          toast.error(`Error validating ${label}`, { position: "top-right", autoClose: 3000 });
          hasErrors = true;
        }
      }
    }

    setErrors(newErrors);
    return !hasErrors;
  };

  const validateBusinessDetails = () => {
    let errorsFound = {};
    let hasErrors = false;

    if (!formData.businessName?.trim()) {
      errorsFound.businessName = "Business name is required";
      toast.error("Business name is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (!formData.businessType?.trim()) {
      errorsFound.businessType = "Business type is required";
      toast.error("Business type is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (!formData.yearEstablished) {
      errorsFound.yearEstablished = "Year established is required";
      toast.error("Year established is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    } else {
      const establishedDate = new Date(formData.yearEstablished);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      if (establishedDate > sixMonthsAgo) {
        errorsFound.yearEstablished = "Business must be at least 6 months old";
        toast.error("Business must be at least 6 months old", { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }
    }

    if (!formData.businessLocation?.trim()) {
      errorsFound.businessLocation = "Business location is required";
      toast.error("Business location is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (!formData.road?.trim()) {
      errorsFound.road = "Road is required";
      toast.error("Road is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (!formData.landmark?.trim()) {
      errorsFound.landmark = "Landmark is required";
      toast.error("Landmark is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (!formData.daily_Sales) {
      errorsFound.daily_Sales = "Daily sales estimate is required";
      toast.error("Daily sales estimate is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    } else if (parseFloat(formData.daily_Sales) <= 0) {
      errorsFound.daily_Sales = "Daily sales must be greater than 0";
      toast.error("Daily sales must be greater than 0", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    if (!formData.businessCoordinates?.lat || !formData.businessCoordinates?.lng) {
      errorsFound.businessCoordinates = "Business GPS coordinates are required";
      toast.error("Please set business GPS location", { position: "top-right", autoClose: 3000 });
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
      toast.error("At least one security item is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    securityItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        errorsFound[`security_description_${index}`] = "Description is required";
        toast.error(`Security Item ${index + 1}: Description is required`, { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }
   
      if (!item.value || parseFloat(item.value) <= 0) {
        errorsFound[`security_value_${index}`] = "Estimated value must be greater than 0";
        toast.error(`Security Item ${index + 1}: Value must be greater than 0`, { position: "top-right", autoClose: 3000 });
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
      toast.error("Pre-qualified amount is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    } else if (parseFloat(formData.prequalifiedAmount) <= 0) {
      errorsFound.prequalifiedAmount = "Loan amount must be greater than 0";
      toast.error("Loan amount must be greater than 0", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    
    setErrors(errorsFound);
    return !hasErrors;
  };

  const validateGuarantorDetails = async () => {
    const errorsFound = { guarantor: {} };
    let hasErrors = false;
    const { Firstname, Surname, mobile, idNumber, dateOfBirth, gender } = formData.guarantor;

    if (!Firstname?.trim()) {
      errorsFound.guarantor.Firstname = "Guarantor first name is required";
      toast.error("Guarantor first name is required");
      hasErrors = true;
    }
    if (!Surname?.trim()) {
      errorsFound.guarantor.Surname = "Guarantor surname is required";
      toast.error("Guarantor surname is required");
      hasErrors = true;
    }
    if (!gender?.trim()) {
      errorsFound.guarantor.gender = "Guarantor gender is required";
      toast.error("Guarantor gender is required");
      hasErrors = true;
    }
    if (!mobile?.trim()) {
      errorsFound.guarantor.mobile = "Guarantor mobile number is required";
      toast.error("Guarantor mobile number is required");
      hasErrors = true;
    }
    if (!idNumber?.trim()) {
      errorsFound.guarantor.idNumber = "Guarantor ID number is required";
      toast.error("Guarantor ID number is required");
      hasErrors = true;
    }

    if (mobile && !/^[0-9]{10,15}$/.test(mobile.replace(/\D/g, ""))) {
      errorsFound.guarantor.mobile = "Please enter a valid mobile number (10-15 digits)";
      toast.error("Invalid guarantor mobile number format");
      hasErrors = true;
    }
    if (idNumber && !/^[0-9]{6,12}$/.test(idNumber)) {
      errorsFound.guarantor.idNumber = "Please enter a valid ID number (6-12 digits)";
      toast.error("Invalid guarantor ID number format");
      hasErrors = true;
    }

    if (dateOfBirth && !isAtLeast18YearsOld(dateOfBirth)) {
      errorsFound.guarantor.dateOfBirth = "Guarantor must be at least 18 years old";
      toast.error("Guarantor must be at least 18 years old");
      hasErrors = true;
    }

    const fieldsToCheck = [
      { field: "mobile", value: mobile, label: "Guarantor mobile" },
      { field: "idNumber", value: idNumber, label: "Guarantor ID number" },
    ];

    for (const { field, value, label } of fieldsToCheck) {
      if (value && !errorsFound.guarantor[field]) {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            field === "idNumber" ? "id_number" : "mobile",
            value
          );
          if (!isUnique) {
            errorsFound.guarantor[field] = `${label} already exists in our system`;
            toast.error(`${label} already exists in our system`);
            hasErrors = true;
          }
        } catch (err) {
          console.error("Error checking uniqueness:", err);
          errorsFound.guarantor[field] = `Error validating ${label}`;
          toast.error(`Error validating ${label}`);
          hasErrors = true;
        }
      }
    }

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateGuarantorSecurity = () => {
    const errorsFound = {};
    let hasErrors = false;

    if (guarantorSecurityItems.length === 0) {
      errorsFound.guarantorSecurityItems = "At least one guarantor security item is required";
      toast.error("At least one guarantor security item is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }

    guarantorSecurityItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        errorsFound[`guarantor_security_description_${index}`] = "Description is required";
        toast.error(`Guarantor Security ${index + 1}: Description is required`, { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }
    
      if (!item.value || parseFloat(item.value) <= 0) {
        errorsFound[`guarantor_security_value_${index}`] = "Estimated value must be greater than 0";
        toast.error(`Guarantor Security ${index + 1}: Value must be greater than 0`, { position: "top-right", autoClose: 3000 });
        hasErrors = true;
      }
    });

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateNextOfKinDetails = async () => {
    const errorsFound = { nextOfKin: {} };
    let hasErrors = false;
    const { Firstname, Surname, mobile, alternativeNumber, idNumber, relationship, employmentStatus } = formData.nextOfKin;

    if (!Firstname?.trim()) {
      errorsFound.nextOfKin.Firstname = "Next of kin first name is required";
      toast.error(errorsFound.nextOfKin.Firstname);
      hasErrors = true;
    }
    if (!Surname?.trim()) {
      errorsFound.nextOfKin.Surname = "Next of kin surname is required";
      toast.error(errorsFound.nextOfKin.Surname);
      hasErrors = true;
    }
    if (!mobile?.trim()) {
      errorsFound.nextOfKin.mobile = "Next of kin mobile number is required";
      toast.error(errorsFound.nextOfKin.mobile);
      hasErrors = true;
    }
    if (!idNumber?.trim()) {
      errorsFound.nextOfKin.idNumber = "Next of kin ID number is required";
      toast.error(errorsFound.nextOfKin.idNumber);
      hasErrors = true;
    }

    if (mobile && !/^[0-9]{10,15}$/.test(mobile.replace(/\D/g, ""))) {
      errorsFound.nextOfKin.mobile = "Please enter a valid mobile number (10-15 digits)";
      toast.error(errorsFound.nextOfKin.mobile);
      hasErrors = true;
    }
    if (alternativeNumber && !/^[0-9]{10,15}$/.test(alternativeNumber.replace(/\D/g, ""))) {
      errorsFound.nextOfKin.alternativeNumber = "Please enter a valid alternative mobile number (10-15 digits)";
      toast.error(errorsFound.nextOfKin.alternativeNumber);
      hasErrors = true;
    }
    if (idNumber && !/^[0-9]{6,12}$/.test(idNumber)) {
      errorsFound.nextOfKin.idNumber = "Please enter a valid ID number (6-12 digits)";
      toast.error(errorsFound.nextOfKin.idNumber);
      hasErrors = true;
    }

    if (!relationship?.trim()) {
      errorsFound.nextOfKin.relationship = "Relationship is required";
      toast.error(errorsFound.nextOfKin.relationship);
      hasErrors = true;
    }
    if (!employmentStatus?.trim()) {
      errorsFound.nextOfKin.employmentStatus = "Employment status is required";
      toast.error(errorsFound.nextOfKin.employmentStatus);
      hasErrors = true;
    }

    const fieldsToCheck = [
      { field: "mobile", value: mobile, label: "Next of kin mobile" },
      { field: "alternativeNumber", value: alternativeNumber, label: "Next of kin alternative mobile" },
      { field: "idNumber", value: idNumber, label: "Next of kin ID number" },
    ];

    for (const { field, value, label } of fieldsToCheck) {
      if (value && !errorsFound.nextOfKin[field]) {
        try {
          const isUnique = await checkUniqueValue(
            ["customers", "guarantors", "next_of_kin"],
            field.includes("idNumber") ? "id_number" : "mobile",
            value
          );
          if (!isUnique) {
            errorsFound.nextOfKin[field] = `${label} already exists in our system`;
            toast.error(errorsFound.nextOfKin[field]);
            hasErrors = true;
          }
        } catch (err) {
          console.error("Error checking uniqueness:", err);
          errorsFound.nextOfKin[field] = `Error validating ${label}`;
          toast.error(errorsFound.nextOfKin[field]);
          hasErrors = true;
        }
      }
    }

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateDocuments = () => {
    let errorsFound = {};
    let hasErrors = false;
    
    if (!officerClientImage1) {
      errorsFound.officerClientImage1 = "First Officer and Client Image is required";
      toast.error("First Officer and Client Image is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!officerClientImage2) {
      errorsFound.officerClientImage2 = "Second Officer and Client Image is required";
      toast.error("Second Officer and Client Image is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!bothOfficersImage) {
      errorsFound.bothOfficersImage = "Both Officers Image is required";
      toast.error("Both Officers Image is required", { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    
    setErrors(errorsFound);
    return !hasErrors;
  };

  const handleNext = async () => {
    let isValid = false;

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
      toast.error("Please fix the highlighted errors before continuing.", {
        position: "top-right",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }

    const nextIndex = sections.findIndex((item) => item.id === activeSection) + 1;
    if (nextIndex < sections.length) {
      setActiveSection(sections[nextIndex].id);
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

console.log("Customer ID after upsert:", customerId);


// 4. ULTRA-FAST handleSubmit with parallel uploads
const handleSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    // 1. Validate form
    const isValid = await validateForm();
    if (!isValid) {
      toast.error("Please fix all validation errors before submitting.");
      setIsSubmitting(false);
      return;
    }

    const timestamp = Date.now();

    // 2. PARALLEL UPLOAD ALL FILES AT ONCE (MAJOR SPEED BOOST)
    const [
      passportUrl,
      idFrontUrl,
      idBackUrl,
      houseImageUrl,
      guarantorPassportUrl,
      guarantorIdFrontUrl,
      guarantorIdBackUrl,
      businessUrls,
      officerClientUrl1,
      officerClientUrl2,
      bothOfficersUrl
    ] = await Promise.all([
      // Customer documents
      passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : null,
      idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : null,
      idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : null,
      houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : null,
      
      // Guarantor documents
      guarantorPassportFile ? uploadFile(guarantorPassportFile, `guarantor/${timestamp}_passport_${guarantorPassportFile.name}`) : null,
      guarantorIdFrontFile ? uploadFile(guarantorIdFrontFile, `guarantor/${timestamp}_id_front_${guarantorIdFrontFile.name}`) : null,
      guarantorIdBackFile ? uploadFile(guarantorIdBackFile, `guarantor/${timestamp}_id_back_${guarantorIdBackFile.name}`) : null,
      
      // Business images (batch upload)
      businessImages.length > 0 ? uploadFilesBatch(businessImages, "business") : [],
      
      // Officer verification images
      officerClientImage1 ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`) : null,
      officerClientImage2 ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`) : null,
      bothOfficersImage ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`) : null,
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

    // 4. PARALLEL INSERT: All related records at once
    const insertPromises = [];

    // Business images
    if (businessUrls.length > 0) {
      const businessRecords = businessUrls.map((url) => ({
        customer_id: customerId,
        image_url: url,
        created_by: profile?.id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        created_at: new Date().toISOString(),
      }));
      insertPromises.push(supabase.from("business_images").insert(businessRecords));
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
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        }])
      );
    }

    // Next of Kin
    const nextOfKin = formData.nextOfKin || {};
    if (Object.values(nextOfKin).some(Boolean)) {
      insertPromises.push(
        supabase.from("next_of_kin").insert([{
          customer_id: customerId,
          Firstname: nextOfKin.Firstname || null,
          Surname: nextOfKin.Surname || null,
          Middlename: nextOfKin.Middlename || null,
          id_number: nextOfKin.idNumber || null,
          relationship: nextOfKin.relationship || null,
          mobile: nextOfKin.mobile || null,
          alternative_number: nextOfKin.alternativeNumber || null,
          employment_status: nextOfKin.employmentStatus || null,
          county: nextOfKin.county || null,
          city_town: nextOfKin.cityTown || null,
          company_name: nextOfKin.companyName || null,
          salary: nextOfKin.salary ? parseFloat(nextOfKin.salary) : null,
          business_name: nextOfKin.businessName || null,
          business_income: nextOfKin.businessIncome ? parseFloat(nextOfKin.businessIncome) : null,
          relationship_other: nextOfKin.relationshipOther || null,
          created_by: profile?.id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        }])
      );
    }

    // Guarantor with documents (matching old structure exactly)
    const guarantor = formData.guarantor || {};
    const guarantorFilled = Object.values(guarantor).some(
      (val) => val != null && String(val).trim() !== ""
    );
    
    if (guarantorFilled) {
      insertPromises.push(
        supabase.from("guarantors").insert([{
          customer_id: customerId,
          Firstname: guarantor.Firstname || null,
          Surname: guarantor.Surname || null,
          Middlename: guarantor.Middlename || null,
          id_number: guarantor.idNumber || null,
          marital_status: guarantor.maritalStatus || null,
          gender: guarantor.gender || null,
          mobile: guarantor.mobile || null,
          alternative_number: guarantor.alternativeMobile || null,
          residence_status: guarantor.residenceStatus || null,
          postal_address: guarantor.postalAddress || null,
          code: guarantor.code ? parseInt(guarantor.code) : null,
          occupation: guarantor.occupation || null,
          relationship: guarantor.relationship || null,
          date_of_birth: guarantor.dateOfBirth || null,
          county: guarantor.county || null,
          city_town: guarantor.cityTown || null,
          passport_url: guarantorPassportUrl,
          id_front_url: guarantorIdFrontUrl,
          id_back_url: guarantorIdBackUrl,
          created_by: profile?.id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        }]).select("id").single()
      );
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
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        created_at: new Date().toISOString(),
      }));

    if (documentRecords.length) {
      insertPromises.push(supabase.from("documents").insert(documentRecords));
    }

    // Execute all inserts in parallel
    const results = await Promise.all(insertPromises);
    
    // Get guarantor ID if inserted
    let guarantorId = null;
    const guarantorResult = results.find(r => r.data?.id);
    if (guarantorResult) guarantorId = guarantorResult.data.id;

    // 5. Upload and insert security items (with images) - PARALLEL
    await Promise.all([
      insertSecurityItemsOptimized(securityItems, securityItemImages, customerId, false),
      guarantorId ? insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecurityImages, guarantorId, true) : Promise.resolve(null),
    ]);

    toast.success("Customer application submitted successfully!");
    navigate("/officer/customers");

  } catch (error) {
    console.error("Form submission error:", error);
    toast.error(error.message || "An unexpected error occurred.");
  } finally {
    setIsSubmitting(false);
  }
};

const handleSaveDraft = async () => {
  setIsSavingDraft(true);

  try {
    const timestamp = Date.now();
    const existingCustomerId = formData?.id || null;

    /* --------------------------------------------------------------
       1️⃣ UPLOAD ONLY NEW FILES — otherwise keep existing URLs
    -------------------------------------------------------------- */
    const [
      passportUrl,
      idFrontUrl,
      idBackUrl,
      houseImageUrl,
      guarantorPassportUrl,
      guarantorIdFrontUrl,
      guarantorIdBackUrl,
      businessUrls,
      officerClientUrl1,
      officerClientUrl2,
      bothOfficersUrl
    ] = await Promise.all([

      passportFile
        ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`)
        : formData.passport_url || null,

      idFrontFile
        ? uploadFile(idFrontFile, `personal/${timestamp}_idfront_${idFrontFile.name}`)
        : formData.id_front_url || null,

      idBackFile
        ? uploadFile(idBackFile, `personal/${timestamp}_idback_${idBackFile.name}`)
        : formData.id_back_url || null,

      houseImageFile
        ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`)
        : formData.house_image_url || null,

      guarantorPassportFile
        ? uploadFile(guarantorPassportFile, `guarantor/${timestamp}_passport_${guarantorPassportFile.name}`)
        : formData?.guarantor?.passport_url || null,

      guarantorIdFrontFile
        ? uploadFile(guarantorIdFrontFile, `guarantor/${timestamp}_idfront_${guarantorIdFrontFile.name}`)
        : formData?.guarantor?.id_front_url || null,

      guarantorIdBackFile
        ? uploadFile(guarantorIdBackFile, `guarantor/${timestamp}_idback_${guarantorIdBackFile.name}`)
        : formData?.guarantor?.id_back_url || null,

      businessImages?.length > 0
        ? uploadFilesBatch(businessImages, "business")
        : [],

      officerClientImage1
        ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`)
        : null,

      officerClientImage2
        ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`)
        : null,

      bothOfficersImage
        ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`)
        : null,
    ]);

    /* --------------------------------------------------------------
       2️⃣ CUSTOMER PAYLOAD — clean + simple
    -------------------------------------------------------------- */
    const customerPayload = {
      // Personal details
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

      // Address
      postal_address: formData.postalAddress || null,
      code: formData.code || null,
      town: formData.town || null,
      county: formData.county || null,

      // Business
      business_name: formData.businessName || null,
      business_type: formData.businessType || null,
      daily_Sales: formData.daily_Sales || null,
      year_established: formData.yearEstablished || null,
      business_location: formData.businessLocation || null,
      business_lat: formData.businessCoordinates?.lat || null,
      business_lng: formData.businessCoordinates?.lng || null,
      road: formData.road || null,
      landmark: formData.landmark || null,
      has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",

      // Prequalified
      prequalifiedAmount: formData.prequalifiedAmount || null,

      // URLs
      passport_url: passportUrl,
      id_front_url: idFrontUrl,
      id_back_url: idBackUrl,
      house_image_url: houseImageUrl,

      // Status
      form_status: "draft",
      status: "pending",

      updated_at: new Date().toISOString(),
      created_by: profile?.id,
      branch_id: profile?.branch_id,
      region_id: profile?.region_id,
      ...(existingCustomerId ? {} : { created_at: new Date().toISOString() })
    };

    /* --------------------------------------------------------------
       3️⃣ UPSERT CUSTOMER (insert or update)
    -------------------------------------------------------------- */
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .upsert(
        existingCustomerId
          ? { id: existingCustomerId, ...customerPayload }
          : customerPayload,
        { onConflict: "id" }
      )
      .select("id")
      .single();

    if (customerError) throw customerError;

    const customerId = customerData.id;

    /* --------------------------------------------------------------
       4️⃣ CHILD TABLE UPSERTS (spouse, NOK, guarantor)
    -------------------------------------------------------------- */
    const childOps = [];

    // SPOUSE
    if (formData.spouse && Object.values(formData.spouse).some(Boolean)) {
      childOps.push(
        supabase.from("spouse").upsert(
          {
            customer_id: customerId,
            name: formData.spouse.name || null,
            id_number: formData.spouse.idNumber || null,
            mobile: formData.spouse.mobile || null,
            economic_activity: formData.spouse.economicActivity || null,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id
          },
          { onConflict: "customer_id" }
        )
      );
    }

    // NEXT OF KIN
    if (formData.nextOfKin && Object.values(formData.nextOfKin).some(Boolean)) {
      childOps.push(
        supabase.from("next_of_kin").upsert(
          {
            customer_id: customerId,
            Firstname: formData.nextOfKin.Firstname || null,
            Surname: formData.nextOfKin.Surname || null,
            Middlename: formData.nextOfKin.Middlename || null,
            id_number: formData.nextOfKin.idNumber || null,
            relationship: formData.nextOfKin.relationship || null,
            mobile: formData.nextOfKin.mobile || null,
            alternative_number: formData.nextOfKin.alternativeNumber || null,
            employment_status: formData.nextOfKin.employmentStatus || null,
            county: formData.nextOfKin.county || null,
            city_town: formData.nextOfKin.cityTown || null,
            company_name: formData.nextOfKin.companyName || null,
            salary: formData.nextOfKin.salary || null,
            business_name: formData.nextOfKin.businessName || null,
            business_income: formData.nextOfKin.businessIncome || null,
            relationship_other: formData.nextOfKin.relationshipOther || null,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id
          },
          { onConflict: "customer_id" }
        )
      );
    }

    // GUARANTOR
    if (formData.guarantor && Object.values(formData.guarantor).some(Boolean)) {
      childOps.push(
        supabase.from("guarantors").upsert(
          {
            customer_id: customerId,
            Firstname: formData.guarantor.Firstname || null,
            Surname: formData.guarantor.Surname || null,
            Middlename: formData.guarantor.Middlename || null,
            id_number: formData.guarantor.idNumber || null,
            marital_status: formData.guarantor.maritalStatus || null,
            gender: formData.guarantor.gender || null,
            mobile: formData.guarantor.mobile || null,
            alternative_number: formData.guarantor.alternativeMobile || null,
            residence_status: formData.guarantor.residenceStatus || null,
            postal_address: formData.guarantor.postalAddress || null,
            code: formData.guarantor.code || null,
            occupation: formData.guarantor.occupation || null,
            relationship: formData.guarantor.relationship || null,
            date_of_birth: formData.guarantor.dateOfBirth || null,
            county: formData.guarantor.county || null,
            city_town: formData.guarantor.cityTown || null,

            passport_url: guarantorPassportUrl,
            id_front_url: guarantorIdFrontUrl,
            id_back_url: guarantorIdBackUrl,

            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id
          },
          { onConflict: "customer_id" }
        )
      );
    }

    /* --------------------------------------------------------------
       5️⃣ DOCUMENT IMAGES — append only
    -------------------------------------------------------------- */
    const docs = [];
    if (officerClientUrl1)
      docs.push({ customer_id: customerId, document_type: "First Officer and Client Image", document_url: officerClientUrl1 });
    if (officerClientUrl2)
      docs.push({ customer_id: customerId, document_type: "Second Officer and Client Image", document_url: officerClientUrl2 });
    if (bothOfficersUrl)
      docs.push({ customer_id: customerId, document_type: "Both Officers Image", document_url: bothOfficersUrl });

    if (docs.length > 0) {
      childOps.push(
        supabase.from("documents").insert(
          docs.map(d => ({
            ...d,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }))
        )
      );
    }

    /* --------------------------------------------------------------
       6️⃣ BUSINESS IMAGES — append only
    -------------------------------------------------------------- */
    if (businessUrls?.length > 0) {
      childOps.push(
        supabase.from("business_images").insert(
          businessUrls.map(url => ({
            customer_id: customerId,
            image_url: url,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }))
        )
      );
    }

    await Promise.all(childOps);

    /* --------------------------------------------------------------
       7️⃣ SUCCESS
    -------------------------------------------------------------- */
    toast.success("Draft saved successfully!");
    navigate(-1)

    if (!existingCustomerId) {
      navigate(`/officer/customers/draft/${customerId}`);
    }

  } catch (err) {
    console.error("DRAFT ERROR:", err);
    toast.error("Failed to save draft. Please try again.");
  } finally {
    setIsSavingDraft(false);
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







  return (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-indigo-100">
          <div className="flex flex-wrap gap-2">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeSection === id
                    ? "bg-gradient-to-r from-gray-300 to-gray-300 text-slate-600 shadow-lg"
                    : "bg-gray-100 text-slate-700 hover:bg-gray-200 hover:shadow-md"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8">
            {/* Personal Information */}
            {activeSection === "personal" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-slate-600 flex items-center">
                    <UserCircleIcon className="h-8 w-8 text-indigo-600 mr-3" />
                    Personal Information
                  </h2>
                  <p className="text-gray-600 mt-2">
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
      value={formData.spouse?.name || ''}
      section="spouse"
      required
      handleNestedChange={handleNestedChange}
      errors={errors}
    />
    <FormField
      label="Spouse ID Number"
      name="idNumber"
      value={formData.spouse?.idNumber || ''}
      section="spouse"
      required
      handleNestedChange={handleNestedChange}
      errors={errors}
    />
    <FormField
      label="Spouse Mobile"
      name="mobile"
      value={formData.spouse?.mobile || ''}
      section="spouse"
      required
      handleNestedChange={handleNestedChange}
      errors={errors}
    />
    <FormField
      label="Spouse Economic Activity"
      name="economicActivity"
      value={formData.spouse?.economicActivity || ''}
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
                    handleNestedChange={handleNestedChange}
                  />
                </div>

                {/* Document Uploads - FIXED VERSION */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-slate-600 mb-6">
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
                        className="flex flex-col items-start p-4 border border-indigo-200 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 shadow-sm hover:shadow-md transition"
                      >
                        <label className="block text-sm font-medium text-indigo-800 mb-3">
                          {file.label}
                        </label>

                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                          <label className="flex flex-1 items-center justify-center gap-2 px-4 py-3 bg-indigo-100 text-indigo-700 rounded-lg shadow-sm cursor-pointer hover:bg-indigo-200 transition-all duration-200 w-full sm:w-1/2">
                            <ArrowUpTrayIcon className="w-5 h-5" />
                            <span className="text-sm font-medium">Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                              className="hidden"
                            />
                          </label>

                          <label className="flex flex-1 items-center justify-center gap-2 px-4 py-3 bg-blue-300 text-white rounded-lg shadow-sm cursor-pointer hover:bg-blue-400 transition-all duration-200 w-full sm:w-1/2">
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
        className="w-full h-40 object-cover rounded-lg border border-indigo-200 shadow-sm"
        onError={(e) => {
          console.error('Image failed to load:', previews[file.key].url);
          e.target.style.display = 'none';
        }}
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
      <p className="text-xs text-gray-600 truncate" title={previews[file.key].fileName}>
        {previews[file.key].isExisting ? '📁 ' : '📄 '} 
        {previews[file.key].fileName}
        {previews[file.key].isExisting && ' (Existing)'}
      </p>
    </div>
  </div>
)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Business Information */}
            {activeSection === "business" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-slate-600 flex items-center">
                    <BuildingOffice2Icon className="h-8 w-8 text-indigo-600 mr-3" />
                    Business Information
                  </h2>
                  <p className="text-gray-600 mt-2">
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
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Business Type"
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleChange}
                    placeholder="e.g. Retail, Wholesale"
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
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
                    label="County"
                    name="county"
                    value={formData.county}
                    onChange={handleChange}
                    options={KENYA_COUNTIES}
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
                    onLocationChange={handleLocationChange}
                    county={formData.county}
                    value={formData.businessCoordinates}
                  />
                </div>

             {/* Business Images - FIXED WITH PREVIEWS */}
<div className="mt-8">
  <div className="flex items-center justify-between mb-6">
    <h3 className="text-lg font-semibold text-slate-600">
      Business Images
    </h3>
  </div>

  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
    <label className="block text-sm font-medium mb-2 text-slate-600">
      Business Images
    </label>
    <div className="flex gap-3 mb-4">
      <label className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-200 transition">
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

      <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition">
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

    {/* Display Business Images Grid - FIXED WITH PREVIEWS */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
      {/* Show previews from previews.business */}
      {previews.business && previews.business.length > 0 && previews.business.map((preview, index) => (
        <div key={`preview-${index}`} className="relative group">
          <img
            src={preview.url}
            alt={`Business Image ${index + 1}`}
            className="w-full h-32 object-cover rounded-lg border border-blue-200 shadow-sm"
            onError={(e) => {
              console.error('Business image failed to load:', preview.url);
              e.target.style.display = 'none';
            }}
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
            <p className="text-xs truncate" title={preview.fileName}>
              {preview.isExisting ? '📁 ' : '📄 '} 
              {preview.fileName}
              {preview.isExisting && ' (Existing)'}
            </p>
          </div>
        </div>
      ))}
      
      {/* Show current business images */}
      {businessImages.map((img, index) => (
        <div key={`current-${index}`} className="relative group">
          <img
            src={URL.createObjectURL(img)}
            alt={`Business Image ${index + 1}`}
            className="w-full h-32 object-cover rounded-lg border border-blue-200 shadow-sm"
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
              📄 {img.name}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
              </div>
            )}

            {/* Borrower Security - FIXED VERSION */}
            {activeSection === "borrowerSecurity" && (
              <div className="space-y-8">
                {errors.securityItems && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-700 text-sm">{errors.securityItems}</p>
                  </div>
                )}

                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-slate-600 flex items-center">
                    <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
                    Borrower Security
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Add security type, description and estimated market value
                  </p>
                </div>

                <div className="space-y-6">
                  {securityItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-slate-600 flex items-center">
                          <ShieldCheckIcon className="h-5 w-5 text-indigo-600 mr-2" />
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
                          <label className="block text-sm font-medium mb-1 text-slate-600">
                            Security Type
                          </label>
                          <select
                            name="type"
                            value={item.type}
                            onChange={(e) => handleSecurityChange(e, index)}
                            className="w-full border border-gray-300 rounded-lg p-2"
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

                   {/* Security Images Section - FIXED WITH PREVIEWS */}
<div className="mt-6">
  <label className="block text-sm font-medium mb-2 text-slate-600">
    Security Images
  </label>
  <div className="flex gap-3 mb-3">
    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-200">
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

    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500">
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

  {/* Display Image Grid - FIXED WITH PREVIEWS */}
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
    {/* Show previews from security previews */}
    {previews.security && previews.security[index] && previews.security[index].map((preview, imgIdx) => (
      <div key={`preview-${imgIdx}`} className="relative group">
        <img
          src={preview.url}
          alt={`Security ${index + 1} - Image ${imgIdx + 1}`}
          className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm"
          onError={(e) => {
            console.error('Security image failed to load:', preview.url);
            e.target.style.display = 'none';
          }}
        />
        <button
          type="button"
          onClick={() => handleRemoveSecurityPreview(index, imgIdx)}
          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        {/* File name display */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-1">
          <p className="text-xs truncate" title={preview.fileName}>
            {preview.isExisting ? '📁 ' : '📄 '} 
            {preview.fileName}
            {preview.isExisting && ' (Existing)'}
          </p>
        </div>
      </div>
    ))}
    
    {/* Show current security images */}
    {securityItemImages[index] && securityItemImages[index].map((img, imgIdx) => (
      <div key={`current-${imgIdx}`} className="relative group">
        <img
          src={URL.createObjectURL(img)}
          alt={`Security ${index + 1} - Image ${imgIdx + 1}`}
          className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm"
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
            📄 {img.name}
          </p>
        </div>
      </div>
    ))}
  </div>
</div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addSecurityItem}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-300 text-white rounded-lg hover:bg-blue-500 shadow-md"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Add Security
                  </button>
                </div>
              </div>
            )}

            {/* Loan Details */}
            {activeSection === "loan" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-slate-600 flex items-center">
                    <CurrencyDollarIcon className="h-8 w-8 text-indigo-600 mr-3" />
                    Loan Information
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Set loan amount and terms
                  </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-8 border border-emerald-200">
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
                  <h2 className="text-lg font-semibold text-slate-600 flex items-center">
                    <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
                    Guarantor Information
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Enter guarantor personal details
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField
                    label="Prefix"
                    name="prefix"
                    value={formData.guarantor.prefix}
                    section="guarantor"
                    options={["Mr", "Mrs", "Ms", "Dr"]}
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="First Name"
                    name="Firstname"
                    value={formData.guarantor.Firstname}
                    section="guarantor"
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Middle Name"
                    name="Middlename"
                    value={formData.guarantor.Middlename}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="Surname"
                    name="Surname"
                    value={formData.guarantor.Surname}
                    section="guarantor"
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="ID Number"
                    name="idNumber"
                    value={formData.guarantor.idNumber}
                    section="guarantor"
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Mobile Number"
                    name="mobile"
                    value={formData.guarantor.mobile}
                    section="guarantor"
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
<FormField
  label="Alternative Number"
  name="alternativeMobile" 
  value={formData.guarantor.alternativeMobile}
  section="guarantor"
  handleNestedChange={handleNestedChange}
/>
                  <FormField
                    label="Date of Birth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.guarantor.dateOfBirth}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Gender"
                    name="gender"
                    value={formData.guarantor.gender}
                    section="guarantor"
                    options={["Male", "Female"]}
                    required
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Marital Status"
                    name="maritalStatus"
                    value={formData.guarantor.maritalStatus}
                    section="guarantor"
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
                    value={formData.guarantor.residenceStatus}
                    section="guarantor"
                    options={["Own", "Rent", "Family", "Other"]}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Occupation"
                    name="occupation"
                    value={formData.guarantor.occupation}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                  <FormField
                    label="Relationship"
                    name="relationship"
                    value={formData.guarantor.relationship}
                    section="guarantor"
                    placeholder="e.g. Spouse, Friend"
                    handleNestedChange={handleNestedChange}
                    required
                  />
                  <FormField
                    label="Postal Address"
                    name="postalAddress"
                    value={formData.guarantor.postalAddress}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="Postal Code"
                    name="code"
                    type="number"
                    value={formData.guarantor.code}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                  />

                 <FormField
                  label="Guarantor County"
                  name="county"
                  value={formData.guarantor?.county || ""}
                  section="guarantor"
                  options={KENYA_COUNTIES}
                  handleNestedChange={handleNestedChange}
                />
                  <FormField
                    label="City/Town"
                    name="cityTown"
                    value={formData.guarantor.cityTown}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                  />
                </div>
                
 {/* Guarantor Documents - FIXED WITH PREVIEWS */}
<div className="mt-8">
  <h3 className="text-lg font-semibold text-slate-600 mb-6">
    Guarantor Documents
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {[
      {
        key: "guarantorPassport",
        label: "Guarantor Passport",
        handler: setGuarantorPassportFile,
        icon: UserCircleIcon,
      },
      {
        key: "guarantorIdFront",
        label: "Guarantor ID Front",
        handler: setGuarantorIdFrontFile,
        icon: IdentificationIcon,
      },
      {
        key: "guarantorIdBack",
        label: "Guarantor ID Back",
        handler: setGuarantorIdBackFile,
        icon: IdentificationIcon,
      },
    ].map((file) => (
      <div
        key={file.key}
        className="flex flex-col items-start p-4 border border-indigo-200 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 shadow-sm hover:shadow-md transition"
      >
        <div className="flex items-center gap-2 mb-4">
          <file.icon className="h-6 w-6 text-indigo-600" />
          <h4 className="text-md font-medium text-indigo-800">
            {file.label}
          </h4>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg shadow-sm cursor-pointer hover:bg-indigo-200 transition">
            <ArrowUpTrayIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Upload</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, file.handler, file.key)}
              className="hidden"
            />
          </label>

          <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg shadow-sm cursor-pointer hover:bg-blue-500 transition">
            <CameraIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Camera</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
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
                alt={file.label}
                className="w-full h-40 object-cover rounded-lg border border-indigo-200 shadow-sm"
                onError={(e) => {
                  console.error('Guarantor image failed to load:', previews[file.key].url);
                  e.target.style.display = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => handleRemoveFile(file.key, file.handler)}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            {/* File name display */}
            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
              <p className="text-xs text-gray-600 truncate" title={previews[file.key].fileName}>
                {previews[file.key].isExisting ? '📁 ' : '📄 '} 
                {previews[file.key].fileName}
                {previews[file.key].isExisting && ' (Existing)'}
              </p>
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
</div>
              </div>
            )}

            {/* Guarantor Security - FIXED VERSION */}
            {activeSection === "guarantorSecurity" && (
              <div className="space-y-8">
                {errors.guarantorSecurityItems && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-700 text-sm">{errors.guarantorSecurityItems}</p>
                  </div>
                )}

                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-bold text-slate-600 flex items-center">
                    <ShieldCheckIcon className="h-8 w-8 text-blue-300 mr-3" />
                    Guarantor Security Items
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Add guarantor security and collateral details
                  </p>
                </div>

                <div className="space-y-6">
                  {guarantorSecurityItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-slate-600 flex items-center">
                          <ShieldCheckIcon className="h-5 w-5 text-purple-600 mr-2" />
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
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Type
                          </label>
                          <select
                            name="type"
                            value={item.type}
                            onChange={(e) => handleGuarantorSecurityChange(e, index)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:outline-none"
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

                  {/* Images - FIXED WITH PREVIEWS */}
<div className="mt-6">
  <label className="block text-sm font-medium mb-2 text-slate-600">
    Item Images
  </label>
  <div className="flex gap-3 mb-3">
    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg cursor-pointer hover:bg-purple-200 transition">
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

    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition">
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

  {/* Display Image Grid - FIXED WITH PREVIEWS */}
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
    {/* Show previews from guarantor security previews */}
    {previews.guarantorSecurity && previews.guarantorSecurity[index] && previews.guarantorSecurity[index].map((preview, imgIdx) => (
      <div key={`preview-${imgIdx}`} className="relative group">
        <img
          src={preview.url}
          alt={`Guarantor Security ${index + 1} - Image ${imgIdx + 1}`}
          className="w-full h-32 object-cover rounded-lg border border-purple-200 shadow-sm"
          onError={(e) => {
            console.error('Guarantor security image failed to load:', preview.url);
            e.target.style.display = 'none';
          }}
        />
        <button
          type="button"
          onClick={() => handleRemoveGuarantorSecurityPreview(index, imgIdx)}
          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        {/* File name display */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-1">
          <p className="text-xs truncate" title={preview.fileName}>
            {preview.isExisting ? '📁 ' : '📄 '} 
            {preview.fileName}
            {preview.isExisting && ' (Existing)'}
          </p>
        </div>
      </div>
    ))}
    
    {/* Show current guarantor security images */}
    {guarantorSecurityImages[index] && guarantorSecurityImages[index].map((img, imgIdx) => (
      <div key={`current-${imgIdx}`} className="relative group">
        <img
          src={URL.createObjectURL(img)}
          alt={`Guarantor Security ${index + 1} - Image ${imgIdx + 1}`}
          className="w-full h-32 object-cover rounded-lg border border-purple-200 shadow-sm"
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
            📄 {img.name}
          </p>
        </div>
      </div>
    ))}
  </div>
</div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addGuarantorSecurityItem}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-300 to-blue-400 text-white rounded-lg hover:from-blue-500 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Add Guarantor Security Item
                  </button>
                </div>
              </div>
            )}

            {/* Next of Kin */}
{activeSection === "nextOfKin" && (
  <div className="space-y-8">
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-lg font-semibold text-slate-600 flex items-center">
        <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
        Next of Kin Information
      </h2>
      <p className="text-gray-600 mt-2">Enter next of kin details</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FormField
        label="First Name"
        name="Firstname"
        value={formData.nextOfKin.Firstname}
        section="nextOfKin"
        required
        handleNestedChange={handleNestedChange}
        errors={errors}
      />
      <FormField
        label="Middle Name"
        name="Middlename"
        value={formData.nextOfKin.Middlename}
        section="nextOfKin"
        handleNestedChange={handleNestedChange}
      />
      <FormField
        label="Surname"
        name="Surname"
        value={formData.nextOfKin.Surname}
        section="nextOfKin"
        required
        handleNestedChange={handleNestedChange}
        errors={errors}
      />
      <FormField
        label="ID Number"
        name="idNumber"
        value={formData.nextOfKin.idNumber}
        section="nextOfKin"
        required
        handleNestedChange={handleNestedChange}
        errors={errors}
      />
      <FormField
        label="Mobile Number"
        name="mobile"
        value={formData.nextOfKin.mobile}
        section="nextOfKin"
        required
        handleNestedChange={handleNestedChange}
        errors={errors}
      />
      <FormField
        label="Alternative Number"
        name="alternativeNumber"
        value={formData.nextOfKin.alternativeNumber}
        section="nextOfKin"
        handleNestedChange={handleNestedChange}
      />

      {/* Relationship Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Relationship *
        </label>
        <select
          name="relationship"
          value={formData.nextOfKin.relationship}
          onChange={(e) => handleNestedChange(e, 'nextOfKin')}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
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
      {formData.nextOfKin.relationship === "Other" && (
        <FormField
          label="Specify Relationship"
          name="relationshipOther"
          value={formData.nextOfKin.relationshipOther}
          section="nextOfKin"
          required
          handleNestedChange={handleNestedChange}
        />
      )}

      {/* Employment Status Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Employment Status
        </label>
        <select
          name="employmentStatus"
          value={formData.nextOfKin.employmentStatus}
          onChange={(e) => handleNestedChange(e, 'nextOfKin')}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        >
          <option value="">Select Employment Status</option>
          <option value="Employed">Employed</option>
          <option value="Self Employed">Self Employed</option>
          <option value="Unemployed">Unemployed</option>
        </select>
      </div>

      {/* Conditional Fields for Employed */}
      {formData.nextOfKin.employmentStatus === "Employed" && (
        <>
          <FormField
            label="Company Name"
            name="companyName"
            value={formData.nextOfKin.companyName}
            section="nextOfKin"
            handleNestedChange={handleNestedChange}
          />
          <FormField
            label="Estimated Salary (KES)"
            name="salary"
            type="number"
            value={formData.nextOfKin.salary}
            section="nextOfKin"
            handleNestedChange={handleNestedChange}
          />
        </>
      )}

      {/* Conditional Fields for Self Employed */}
      {formData.nextOfKin.employmentStatus === "Self Employed" && (
        <>
          <FormField
            label="Business Name"
            name="businessName"
            value={formData.nextOfKin.businessName}
            section="nextOfKin"
            handleNestedChange={handleNestedChange}
          />
          <FormField
            label="Estimated Income (KES)"
            name="businessIncome"
            type="number"
            value={formData.nextOfKin.businessIncome}
            section="nextOfKin"
            handleNestedChange={handleNestedChange}
          />
        </>
      )}

      <FormField
        label="Next of Kin County"
        name="county"
        value={formData.nextOfKin.county}
        section="nextOfKin"
        options={KENYA_COUNTIES}
        handleNestedChange={handleNestedChange}
      />

      <FormField
        label="City/Town"
        name="cityTown"
        value={formData.nextOfKin.cityTown}
        section="nextOfKin"
        handleNestedChange={handleNestedChange}
      />
    </div>
  </div>
)}

            {/* Documents Verification - FIXED VERSION */}

{/* Documents Verification - FIXED WITH PREVIEWS */}
{activeSection === "documents" && (
  <div className="space-y-8">
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-lg font-semibold text-slate-600 flex items-center">
        <DocumentTextIcon className="h-8 w-8 text-blue-300 mr-3" />
        Document Verification
      </h2>
      <p className="text-gray-600 mt-2">
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
          className="flex flex-col items-start p-4 border border-indigo-200 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 shadow-sm hover:shadow-md transition"
        >
          <label className="block text-sm font-medium text-indigo-800 mb-3">
            {file.label}
          </label>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-indigo-100 text-blue-700 rounded-lg shadow-sm cursor-pointer hover:bg-indigo-200 transition">
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

            <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg shadow-sm cursor-pointer hover:bg-blue-500 transition">
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
                  className="w-full h-40 object-cover rounded-lg border border-indigo-200 shadow-sm"
                  onError={(e) => {
                    console.error('Document image failed to load:', previews[file.key].url);
                    e.target.style.display = 'none';
                  }}
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
                <p className="text-xs text-gray-600 truncate" title={previews[file.key].fileName}>
                  {previews[file.key].isExisting ? '📁 ' : '📄 '} 
                  {previews[file.key].fileName}
                  {previews[file.key].isExisting && ' (Existing)'}
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
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    disabled={isSubmitting || isSavingDraft}
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || isSavingDraft}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-600 text-white rounded-lg hover:from-green-700 hover:to-green-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </div>
    </div>
  );
};

export default CustomerDraft;