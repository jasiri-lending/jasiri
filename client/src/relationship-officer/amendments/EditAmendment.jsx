import { useState, useEffect, memo } from "react";
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
  HomeIcon,
  DevicePhoneMobileIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon, 
  ArrowLeftIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/userAuth";
import { useNavigate } from "react-router-dom";
import { Upload, Camera, XIcon } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LocationPicker from "../components/LocationPicker";

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

// Section mapping from JSON to our form sections
const SECTION_MAPPINGS = {
  'Customer': 'personal',
  'Business': 'business', 
  'Guarantors': 'guarantor',
  'Security': 'borrowerSecurity',
  'Next of Kin': 'nextOfKin',
  'Documents': 'documents'
};

// Component mapping for more granular control
const COMPONENT_MAPPINGS = {
  'Customer Verification': 'personal',
  'Business Verification': 'business',
  'Guarantor 1': 'guarantor',
  'Customer Security Items': 'borrowerSecurity',
  'Guarantor Security Items': 'guarantorSecurity',
  'Next of Kin Details': 'nextOfKin',
  'Document Verification': 'documents'
};

const AmendmentField = memo(
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
    isAmendment = false,
  }) => {
    const fieldClasses = isAmendment 
      ? "border-amber-500 bg-amber-50 focus:ring-amber-500 focus:border-amber-500" 
      : "border-gray-300 bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500";

    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
          {isAmendment && (
            <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
              Requires Amendment
            </span>
          )}
        </label>
        {options ? (
          <select
            name={name}
            value={value || ""}
            onChange={section ? (e) => handleNestedChange(e, section) : onChange}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${fieldClasses} ${
              errors[name] ? "border-red-500" : ""
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
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${fieldClasses} ${
              errors[name] ? "border-red-500" : ""
            }`}
            required={required}
            disabled={disabled}
          />
        )}
        {errors[name] && (
          <span className="text-red-500 text-xs mt-1">{errors[name]}</span>
        )}
      </div>
    );
  }
);

function EditAmendment({ customerId, onClose }) {
  const [activeSection, setActiveSection] = useState("personal");
  const [securityItems, setSecurityItems] = useState([]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Amendment states
  const [amendmentData, setAmendmentData] = useState([]);
  const [amendmentSections, setAmendmentSections] = useState(new Set());
  const [customerStatus, setCustomerStatus] = useState("");

  const [formData, setFormData] = useState({
    prefix: "",
    Firstname: "",
    Middlename: "",
    Surname: "",
    maritalStatus: "",
    residenceStatus: "",
    mobile: "",
    alternativeMobile: "",
    occupation: "",
    dateOfBirth: "",
    gender: "",
    idNumber: "",
    postalAddress: "",
    code: "",
    town: "",
    county: "",
    businessName: "",
    businessType: "",
    yearEstablished: "",
    businessLocation: "",
    daily_Sales: "",
    road: "",
    landmark: "",
    hasLocalAuthorityLicense: "",
    prequalifiedAmount: "",
    status: "pending",
    businessCoordinates: null,

    guarantor: {
      prefix: "",
      Firstname: "",
      Surname: "",
      idNumber: "",
      maritalStatus: "",
      Middlename: "",
      dateOfBirth: "",
      residenceStatus: "",
      gender: "",
      mobile: "",
      postalAddress: "",
      code: "",
      occupation: "",
      relationship: "",
      county: "",
      cityTown: "",
    },
    nextOfKin: {
      Firstname: "",
      Surname: "",
      Middlename: "",
      idNumber: "",
      relationship: "",
      mobile: "",
      alternativeNumber: "",
      employmentStatus: "",
      county: "",
      cityTown: "",
    },
  });

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
  const [previews, setPreviews] = useState({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Document verification states
  const [officerClientImage1, setOfficerClientImage1] = useState(null);
  const [officerClientImage2, setOfficerClientImage2] = useState(null);
  const [bothOfficersImage, setBothOfficersImage] = useState(null);
  const [existingImages, setExistingImages] = useState({
    passport: null,
    idFront: null,
    idBack: null,
    house: null,
    business: [],
    security: [],
    guarantorPassport: null,
    guarantorIdFront: null,
    guarantorIdBack: null,
    guarantorSecurity: [],
    officerClient1: null,
    officerClient2: null,
    bothOfficers: null,
  });

  // Check if section requires amendments
  const sectionHasAmendments = (sectionId) => {
    return amendmentSections.has(sectionId);
  };

  // Check if field requires amendment (for granular control)
  const needsAmendment = (fieldPath, sectionId) => {
    return sectionHasAmendments(sectionId);
  };

  // Enhanced amendment data fetching
  const fetchAmendmentData = async () => {
    try {
      console.log("Fetching amendment data for customer:", customerId);
      
      // Get customer status
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("status")
        .eq("id", customerId)
        .single();

      if (customerError) {
        console.error("Error fetching customer status:", customerError);
      } else {
        setCustomerStatus(customer?.status || "");
        console.log("Customer status:", customer?.status);
      }

      // For demo purposes, we'll use the provided JSON structure
      // In real implementation, this would come from your API
      const mockAmendmentData = [
        {
          "fields": ["ID Verification", "Phone Verification"],
          "section": "Customer",
          "component": "Customer Verification",
          "customerId": 106,
          "verifiedAt": "2025-11-28T12:49:28.062Z",
          "verifiedBy": "f8344f38-a86e-4374-89da-3085b57599ef",
          "finalComment": "correct",
          "requiresAttention": true
        },
        {
          "fields": ["Business Details & Images"],
          "section": "Business",
          "component": "Business Verification",
          "customerId": 106,
          "verifiedAt": "2025-11-28T12:49:28.062Z",
          "verifiedBy": "f8344f38-a86e-4374-89da-3085b57599ef",
          "finalComment": "correct",
          "requiresAttention": true
        },
        {
          "fields": ["ID Verification", "Phone Verification"],
          "section": "Guarantors",
          "component": "Guarantor 1",
          "customerId": 106,
          "verifiedAt": "2025-11-28T12:49:28.062Z",
          "verifiedBy": "f8344f38-a86e-4374-89da-3085b57599ef",
          "finalComment": "correct",
          "guarantorIndex": 0,
          "requiresAttention": true
        },
        {
          "fields": ["Security Verification"],
          "section": "Security",
          "component": "Customer Security Items",
          "customerId": 106,
          "verifiedAt": "2025-11-28T12:49:28.062Z",
          "verifiedBy": "f8344f38-a86e-4374-89da-3085b57599ef",
          "finalComment": "correct",
          "requiresAttention": true
        },
        {
          "fields": ["Security Verification"],
          "section": "Security",
          "component": "Guarantor Security Items",
          "customerId": 106,
          "verifiedAt": "2025-11-28T12:49:28.062Z",
          "verifiedBy": "f8344f38-a86e-4374-89da-3085b57599ef",
          "finalComment": "correct",
          "requiresAttention": true
        },
        {
          "fields": ["Next of Kin Verification"],
          "section": "Next of Kin",
          "component": "Next of Kin Details",
          "customerId": 106,
          "verifiedAt": "2025-11-28T12:49:28.062Z",
          "verifiedBy": "f8344f38-a86e-4374-89da-3085b57599ef",
          "finalComment": "correct",
          "requiresAttention": true
        },
        {
          "fields": ["Document Quality & Completeness"],
          "section": "Documents",
          "component": "Document Verification",
          "customerId": 106,
          "verifiedAt": "2025-11-28T12:49:28.062Z",
          "verifiedBy": "f8344f38-a86e-4374-89da-3085b57599ef",
          "finalComment": "correct",
          "requiresAttention": true
        }
      ];

      // Process amendment data to determine which sections need amendments
      const sectionsWithAmendments = new Set();
      
      mockAmendmentData.forEach(item => {
        if (item.requiresAttention) {
          // Map section and component to our section IDs
          const sectionId = SECTION_MAPPINGS[item.section] || COMPONENT_MAPPINGS[item.component];
          if (sectionId) {
            sectionsWithAmendments.add(sectionId);
          }
          
          // Handle special cases
          if (item.component === "Customer Security Items") {
            sectionsWithAmendments.add("borrowerSecurity");
          }
          if (item.component === "Guarantor Security Items") {
            sectionsWithAmendments.add("guarantorSecurity");
          }
        }
      });

      console.log("Sections requiring amendments:", Array.from(sectionsWithAmendments));
      
      setAmendmentData(mockAmendmentData);
      setAmendmentSections(sectionsWithAmendments);

      if (sectionsWithAmendments.size > 0) {
        toast.info(`${sectionsWithAmendments.size} section(s) require amendments`);
      }

    } catch (error) {
      console.error('Error fetching amendment data:', error);
      toast.error("Failed to load amendment requirements");
    }
  };

  // Fetch customer data
  const fetchCustomerData = async () => {
    console.log("Starting to fetch customer data for ID:", customerId);
    setLoading(true);

    try {
      // Fetch customer details
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError) {
        console.error("Customer fetch error:", customerError);
        throw customerError;
      }

      console.log("Customer data fetched:", customer);

      // Fetch related data
      const [
        { data: guarantor },
        { data: nextOfKin },
        { data: securityItemsData },
        { data: businessImagesData },
        { data: documentsData },
      ] = await Promise.all([
        supabase
          .from("guarantors")
          .select("*")
          .eq("customer_id", customerId)
          .single(),
        supabase
          .from("next_of_kin")
          .select("*")
          .eq("customer_id", customerId)
          .single(),
        supabase
          .from("security_items")
          .select("*, security_item_images(image_url)")
          .eq("customer_id", customerId),
        supabase
          .from("business_images")
          .select("*")
          .eq("customer_id", customerId),
        supabase
          .from("documents")
          .select("id, document_type, document_url")
          .eq("customer_id", customerId),
      ]);

      // Fetch guarantor security if guarantor exists
      let guarantorSecurityData = [];
      if (guarantor?.id) {
        const { data } = await supabase
          .from("guarantor_security")
          .select("*, guarantor_security_images(image_url)")
          .eq("guarantor_id", guarantor.id);
        guarantorSecurityData = data || [];
      }

      // Build form data with business coordinates
      const updatedFormData = {
        prefix: customer?.prefix || "",
        Firstname: customer?.Firstname || "",
        Middlename: customer?.Middlename || "",
        Surname: customer?.Surname || "",
        maritalStatus: customer?.marital_status || "",
        residenceStatus: customer?.residence_status || "",
        mobile: customer?.mobile || "",
        alternativeMobile: customer?.alternative_mobile || "",
        occupation: customer?.occupation || "",
        dateOfBirth: customer?.date_of_birth || "",
        gender: customer?.gender || "",
        idNumber: customer?.id_number || "",
        postalAddress: customer?.postal_address || "",
        code: customer?.code || "",
        town: customer?.town || "",
        county: customer?.county || "",
        businessName: customer?.business_name || "",
        businessType: customer?.business_type || "",
        yearEstablished: customer?.year_established || "",
        businessLocation: customer?.business_location || "",
        daily_Sales: customer?.daily_Sales || "",
        road: customer?.road || "",
        landmark: customer?.landmark || "",
        hasLocalAuthorityLicense: customer?.has_local_authority_license ? "Yes" : "No",
        status: customer?.status || "pending",
        prequalifiedAmount: customer?.prequalifiedAmount || "",
        businessCoordinates: customer?.business_lat && customer?.business_lng ? {
          lat: customer.business_lat,
          lng: customer.business_lng
        } : null,

        guarantor: guarantor ? {
          prefix: guarantor.prefix || "",
          Firstname: guarantor.Firstname || "",
          Surname: guarantor.Surname || "",
          idNumber: guarantor.id_number || "",
          maritalStatus: guarantor.marital_status || "",
          Middlename: guarantor.Middlename || "",
          dateOfBirth: guarantor.date_of_birth || "",
          residenceStatus: guarantor.residence_status || "",
          gender: guarantor.gender || "",
          mobile: guarantor.mobile || "",
          postalAddress: guarantor.postal_address || "",
          code: guarantor.code || "",
          occupation: guarantor.occupation || "",
          relationship: guarantor.relationship || "",
          county: guarantor.county || "",
          cityTown: guarantor.city_town || "",
        } : {
          prefix: "", Firstname: "", Surname: "", idNumber: "", maritalStatus: "", Middlename: "",
          dateOfBirth: "", residenceStatus: "", gender: "", mobile: "", postalAddress: "", code: "",
          occupation: "", relationship: "", county: "", cityTown: "",
        },

        nextOfKin: nextOfKin ? {
          Firstname: nextOfKin.Firstname || "",
          Surname: nextOfKin.Surname || "",
          Middlename: nextOfKin.Middlename || "",
          idNumber: nextOfKin.id_number || "",
          relationship: nextOfKin.relationship || "",
          mobile: nextOfKin.mobile || "",
          alternativeNumber: nextOfKin.alternative_number || "",
          employmentStatus: nextOfKin.employment_status || "",
          county: nextOfKin.county || "",
          cityTown: nextOfKin.city_town || "",
        } : {
          Firstname: "", Surname: "", Middlename: "", idNumber: "", relationship: "", mobile: "",
          alternativeNumber: "", employmentStatus: "", county: "", cityTown: "",
        },
      };

      setFormData(updatedFormData);

      // Security items
      if (securityItemsData && securityItemsData.length > 0) {
        const processedSecurityItems = securityItemsData.map((item) => ({
          id: item.id,
          type: item.item || "",
          description: item.description || "",
          identification: item.identification || "",
          value: item.value || "",
        }));
        setSecurityItems(processedSecurityItems);

        const securityImages = securityItemsData.map((item) =>
          item.security_item_images ? item.security_item_images.map((img) => img.image_url) : []
        );
        setSecurityItemImages(securityImages);
      }

      // Guarantor security
      if (guarantorSecurityData && guarantorSecurityData.length > 0) {
        const processedGuarantorSecurity = guarantorSecurityData.map((item) => ({
          id: item.id,
          type: item.item || "",
          description: item.description || "",
          identification: item.identification || "",
          value: item.estimated_market_value || "",
        }));
        setGuarantorSecurityItems(processedGuarantorSecurity);

        const guarantorSecurityImages = guarantorSecurityData.map((item) =>
          item.guarantor_security_images ? item.guarantor_security_images.map((img) => img.image_url) : []
        );
        setGuarantorSecurityImages(guarantorSecurityImages);
      }

      // Existing images
      const imageData = {
        passport: customer?.passport_url || null,
        idFront: customer?.id_front_url || null,
        idBack: customer?.id_back_url || null,
        house: customer?.house_image_url || null,
        business: businessImagesData ? businessImagesData.map((img) => img.image_url) : [],
        security: securityItemsData ? securityItemsData.flatMap((item) =>
          item.security_item_images ? item.security_item_images.map((img) => img.image_url) : []
        ) : [],
        guarantorPassport: guarantor?.passport_url || null,
        guarantorIdFront: guarantor?.id_front_url || null,
        guarantorIdBack: guarantor?.id_back_url || null,
        guarantorSecurity: guarantorSecurityData ? guarantorSecurityData.flatMap((item) =>
          item.guarantor_security_images ? item.guarantor_security_images.map((img) => img.image_url) : []
        ) : [],
        officerClient1: documentsData?.find((doc) => doc.document_type === "First Officer and Client Image")?.document_url || null,
        officerClient2: documentsData?.find((doc) => doc.document_type === "Second Officer and Client Image")?.document_url || null,
        bothOfficers: documentsData?.find((doc) => doc.document_type === "Both Officers Image")?.document_url || null,
      };

      setExistingImages(imageData);

    } catch (error) {
      console.error("Error fetching customer data:", error);
      toast.error("Failed to load customer data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
      fetchAmendmentData();
    }
  }, [customerId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleNestedChange = (e, section) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [name]: value },
    }));
  };

  const handleSecurityChange = (e, index) => {
    const { name, value } = e.target;
    const newItems = [...securityItems];
    newItems[index][name] = value;
    setSecurityItems(newItems);
  };

  const handleGuarantorSecurityChange = (e, index) => {
    const { name, value } = e.target;
    const newItems = [...guarantorSecurityItems];
    newItems[index][name] = value;
    setGuarantorSecurityItems(newItems);
  };

  const handleLocationChange = (coords) => {
    setFormData((prev) => ({ ...prev, businessCoordinates: coords }));
  };

  const addSecurityItem = () => {
    setSecurityItems([
      ...securityItems,
      { type: "", description: "", identification: "", value: "" },
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
      { type: "", description: "", identification: "", value: "" },
    ]);
    setGuarantorSecurityImages([...guarantorSecurityImages, []]);
  };

  const handleFileUpload = async (e, setter, key) => {
    const file = e.target.files[0];
    if (!file) return;
    setter(file);
    const previewUrl = URL.createObjectURL(file);
    setPreviews((prev) => ({ ...prev, [key]: previewUrl }));
  };

  const handleRemoveFile = (key, setter) => {
    if (typeof setter === "function") {
      setter(null);
    }
    setPreviews((prev) => {
      const url = prev?.[key];
      if (url && typeof url === "string" && url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(url);
        } catch (err) {
          console.warn("Failed to revoke object URL", err);
        }
      }
      return { ...prev, [key]: null };
    });
    setExistingImages((prev) => ({ ...(prev || {}), [key]: null }));
  };

  const handleMultipleFiles = (e, index, setter) => {
    const files = Array.from(e.target.files);
    setter(prev => {
      const updated = [...prev];
      updated[index] = [...(updated[index] || []), ...files];
      return updated;
    });
  };

  const handleRemoveMultipleFile = (sectionIndex, fileIndex, setter) => {
    setter(prev => {
      const updated = [...prev];
      if (updated[sectionIndex]) {
        updated[sectionIndex] = updated[sectionIndex].filter((_, i) => i !== fileIndex);
      }
      return updated;
    });
  };

  const handleBusinessImages = (e) => {
    const files = Array.from(e.target.files);
    setBusinessImages(prev => [...prev, ...files]);
  };

  const handleRemoveBusinessImage = (index) => {
    setBusinessImages(prev => prev.filter((_, i) => i !== index));
  };

  // Upload file helper
  const uploadFile = async (file, path, bucket = "customers") => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading file:", error);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Upload files and update data
      const timestamp = Date.now();
      
      // Upload files in parallel
      const uploadPromises = [
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport`) : null,
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front`) : null,
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back`) : null,
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house`) : null,
      ].filter(Boolean);

      const uploadedUrls = await Promise.all(uploadPromises);

      // Update customer data
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          ...formData,
          business_lat: formData.businessCoordinates?.lat,
          business_lng: formData.businessCoordinates?.lng,
          marital_status: formData.maritalStatus,
          residence_status: formData.residenceStatus,
          alternative_mobile: formData.alternativeMobile,
          date_of_birth: formData.dateOfBirth,
          id_number: formData.idNumber,
          postal_address: formData.postalAddress,
          business_name: formData.businessName,
          business_type: formData.businessType,
          year_established: formData.yearEstablished,
          business_location: formData.businessLocation,
          daily_Sales: formData.daily_Sales,
          has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      if (updateError) throw updateError;

      toast.success("✅ Amendments submitted successfully!");
      onClose();
    } catch (error) {
      console.error("Error updating amendments:", error);
      toast.error(`Failed to submit amendments: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      // Your draft saving logic here
      toast.success("Draft saved successfully!");
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  };

  // All available sections
  const allSections = [
    { id: "personal", label: "Personal Info", icon: UserCircleIcon },
    { id: "business", label: "Business Info", icon: BuildingOffice2Icon },
    { id: "borrowerSecurity", label: "Borrower Security", icon: ShieldCheckIcon },
    { id: "loan", label: "Loan Details", icon: CurrencyDollarIcon },
    { id: "guarantor", label: "Guarantor", icon: UserGroupIcon },
    { id: "guarantorSecurity", label: "Guarantor Security", icon: ShieldCheckIcon },
    { id: "nextOfKin", label: "Next of Kin", icon: UserGroupIcon },
    { id: "documents", label: "Documents", icon: DocumentTextIcon },
  ];

  // Get amendment details for a section
  const getSectionAmendmentDetails = (sectionId) => {
    return amendmentData.filter(item => {
      const mappedSection = SECTION_MAPPINGS[item.section] || COMPONENT_MAPPINGS[item.component];
      return mappedSection === sectionId && item.requiresAttention;
    });
  };

  // Render section content
  const renderSectionContent = () => {
    const isAmendmentMode = amendmentSections.size > 0;
    const currentSectionHasAmendments = sectionHasAmendments(activeSection);
    const sectionAmendmentDetails = getSectionAmendmentDetails(activeSection);

    switch (activeSection) {
      case "personal":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <UserCircleIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Personal Information
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Update personal details and contact information
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-amber-700 text-sm">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AmendmentField
                label="Prefix"
                name="prefix"
                value={formData.prefix}
                onChange={handleChange}
                options={["Mr", "Mrs", "Ms", "Dr"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="First Name"
                name="Firstname"
                value={formData.Firstname}
                onChange={handleChange}
                required
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Middle Name"
                name="Middlename"
                value={formData.Middlename}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Surname"
                name="Surname"
                value={formData.Surname}
                onChange={handleChange}
                required
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Mobile Number"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Alternative Mobile"
                name="alternativeMobile"
                value={formData.alternativeMobile}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="ID Number"
                name="idNumber"
                value={formData.idNumber}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                options={["Male", "Female"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Marital Status"
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
                options={["Single", "Married", "Separated/Divorced", "Other"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Residence Status"
                name="residenceStatus"
                value={formData.residenceStatus}
                onChange={handleChange}
                options={["Own", "Rent", "Family", "Other"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Occupation"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Postal Address"
                name="postalAddress"
                value={formData.postalAddress}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Postal Code"
                name="code"
                type="number"
                value={formData.code}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Town/City"
                name="town"
                value={formData.town}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="County"
                name="county"
                value={formData.county}
                onChange={handleChange}
                options={KENYA_COUNTIES}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
            </div>

            {/* Document Uploads */}
            <div className="mt-8">
              <h3 className="text-lg text-slate-600 mb-6">
                Personal Documents
                {currentSectionHasAmendments && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { key: "passport", label: "Passport Photo", handler: setPassportFile },
                  { key: "idFront", label: "ID Front", handler: setIdFrontFile },
                  { key: "idBack", label: "ID Back", handler: setIdBackFile },
                  { key: "house", label: "House Image", handler: setHouseImageFile },
                ].map((file) => (
                  <div key={file.key} className="flex flex-col items-start p-4 border border-blue-200 rounded-xl bg-white">
                    <label className="block text-sm font-medium text-blue-800 mb-3">
                      {file.label}
                      {currentSectionHasAmendments && (
                        <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                          Amendment
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2 w-full">
                      <label className={`flex-1 text-center px-4 py-2 rounded cursor-pointer ${
                        currentSectionHasAmendments ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        <ArrowUpTrayIcon className="w-4 h-4 inline mr-1" />
                        Upload
                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, file.handler, file.key)} className="hidden" 
                          disabled={!currentSectionHasAmendments} />
                      </label>
                    </div>
                    {(previews[file.key] || existingImages[file.key]) && (
                      <div className="mt-4 relative w-full">
                        <img src={previews[file.key] || existingImages[file.key]} alt={file.label} className="w-full h-32 object-cover rounded border" />
                        <button type="button" onClick={() => handleRemoveFile(file.key, file.handler)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"
                          disabled={!currentSectionHasAmendments}>
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "business":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <BuildingOffice2Icon className="h-8 w-8 text-indigo-600 mr-3" />
                Business Information
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Update business details and operations
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-amber-700 text-sm">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AmendmentField
                label="Business Name"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Business Type"
                name="businessType"
                value={formData.businessType}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Year Established"
                name="yearEstablished"
                type="date"
                value={formData.yearEstablished}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Daily Sales (KES)"
                name="daily_Sales"
                type="number"
                value={formData.daily_Sales}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Business Location"
                name="businessLocation"
                value={formData.businessLocation}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Road"
                name="road"
                value={formData.road}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Landmark"
                name="landmark"
                value={formData.landmark}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Local Authority License"
                name="hasLocalAuthorityLicense"
                value={formData.hasLocalAuthorityLicense}
                onChange={handleChange}
                options={["Yes", "No"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
            </div>

            {/* Business Location Picker */}
            <div className="mt-8">
              <h3 className="text-lg  text-slate-600 mb-4">
                Business Location
                {currentSectionHasAmendments && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                    Amendment Required
                  </span>
                )}
              </h3>
              <LocationPicker
                onLocationChange={handleLocationChange}
                county={formData.county}
                value={formData.businessCoordinates}
                disabled={!currentSectionHasAmendments}
              />
            </div>

            {/* Business Images */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Business Images
                {currentSectionHasAmendments && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                    Amendment Required
                  </span>
                )}
              </h3>
              <div className="flex gap-3 mb-4">
                <label className={`px-4 py-2 rounded cursor-pointer ${
                  currentSectionHasAmendments ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                }`}>
                  <ArrowUpTrayIcon className="w-4 h-4 inline mr-1" />
                  Add Images
                  <input type="file" accept="image/*" multiple onChange={handleBusinessImages} className="hidden" 
                    disabled={!currentSectionHasAmendments} />
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {businessImages.map((img, index) => (
                  <div key={index} className="relative">
                    <img src={URL.createObjectURL(img)} alt={`Business ${index + 1}`} className="w-full h-32 object-cover rounded border" />
                    <button type="button" onClick={() => handleRemoveBusinessImage(index)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"
                      disabled={!currentSectionHasAmendments}>
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "borrowerSecurity":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Borrower Security
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Update borrower security items
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-amber-700 text-sm">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="space-y-6">
              {securityItems.map((item, index) => (
                <div key={index} className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg  text-slate-600 flex items-center">
                      <ShieldCheckIcon className="h-5 w-5 text-indigo-600 mr-2" />
                      Security Item {index + 1}
                    </h3>
                    {securityItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSecurityItem(index)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                        disabled={!currentSectionHasAmendments}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AmendmentField
                      label="Security Type"
                      name="type"
                      value={item.type}
                      onChange={(e) => handleSecurityChange(e, index)}
                      options={["Household Items", "Business Equipment", "Livestock", "Motor Vehicle", "Motorbike", "Land / Property", "Title deed", "Logbook", "Salary Check-off", "Stock / Inventory", "Fixed deposit / Savings security", "Electronics", "Other"]}
                      isAmendment={currentSectionHasAmendments}
                      disabled={!currentSectionHasAmendments}
                    />
                    <AmendmentField
                      label="Description"
                      name="description"
                      value={item.description}
                      onChange={(e) => handleSecurityChange(e, index)}
                      isAmendment={currentSectionHasAmendments}
                      disabled={!currentSectionHasAmendments}
                    />
                    <AmendmentField
                      label="Identification"
                      name="identification"
                      value={item.identification}
                      onChange={(e) => handleSecurityChange(e, index)}
                      placeholder="e.g. Serial No."
                      isAmendment={currentSectionHasAmendments}
                      disabled={!currentSectionHasAmendments}
                    />
                    <AmendmentField
                      label="Est. Market Value (KES)"
                      name="value"
                      type="number"
                      value={item.value}
                      onChange={(e) => handleSecurityChange(e, index)}
                      isAmendment={currentSectionHasAmendments}
                      disabled={!currentSectionHasAmendments}
                    />
                  </div>

                  {/* Security Item Images */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium mb-2 text-gray-800">
                      Item Images
                      {currentSectionHasAmendments && (
                        <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                          Amendment
                        </span>
                      )}
                    </label>
                    <div className="flex gap-3 mb-3">
                      <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition ${
                        currentSectionHasAmendments ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                      }`}>
                        <Upload className="w-5 h-5" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleMultipleFiles(e, index, setSecurityItemImages)}
                          className="hidden"
                          disabled={!currentSectionHasAmendments}
                        />
                      </label>
                    </div>

                    {securityItemImages[index] && securityItemImages[index].length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {securityItemImages[index].map((img, imgIndex) => (
                          <div key={imgIndex} className="relative">
                            <img
                              src={typeof img === "string" ? img : URL.createObjectURL(img)}
                              alt={`Security ${index + 1} - Image ${imgIndex + 1}`}
                              className="w-full h-28 object-cover rounded-lg border border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveMultipleFile(index, imgIndex, setSecurityItemImages)}
                              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow"
                              disabled={!currentSectionHasAmendments}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
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
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-all shadow-md hover:shadow-lg ${
                  currentSectionHasAmendments ? "bg-amber-600 hover:bg-amber-700" : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                }`}
                disabled={!currentSectionHasAmendments}
              >
                <PlusIcon className="h-5 w-5" />
                Add Security Item
              </button>
            </div>
          </div>
        );

      case "loan":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg text-slate-600 flex items-center">
                <CurrencyDollarIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Loan Information
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Update loan amount and terms
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-amber-700 text-sm">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-8 border border-emerald-200">
              <div className="max-w-md mx-auto">
                <AmendmentField
                  label="Pre-qualified Amount (KES)"
                  name="prequalifiedAmount"
                  type="number"
                  value={formData.prequalifiedAmount}
                  onChange={handleChange}
                  className="text-center"
                  isAmendment={currentSectionHasAmendments}
                  disabled={!currentSectionHasAmendments}
                />
              </div>
            </div>
          </div>
        );

      case "guarantor":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Guarantor Information
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Update guarantor personal details
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-amber-700 text-sm">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AmendmentField
                label="Prefix"
                name="prefix"
                value={formData.guarantor.prefix}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                options={["Mr", "Mrs", "Ms", "Dr"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="First Name"
                name="Firstname"
                value={formData.guarantor.Firstname}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Middle Name"
                name="Middlename"
                value={formData.guarantor.Middlename}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Surname"
                name="Surname"
                value={formData.guarantor.Surname}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="ID Number"
                name="idNumber"
                value={formData.guarantor.idNumber}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Mobile Number"
                name="mobile"
                value={formData.guarantor.mobile}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                value={formData.guarantor.dateOfBirth}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Gender"
                name="gender"
                value={formData.guarantor.gender}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                options={["Male", "Female"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Marital Status"
                name="maritalStatus"
                value={formData.guarantor.maritalStatus}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                options={["Single", "Married", "Separated/Divorced", "Other"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Residence Status"
                name="residenceStatus"
                value={formData.guarantor.residenceStatus}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                options={["Own", "Rent", "Family", "Other"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Occupation"
                name="occupation"
                value={formData.guarantor.occupation}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Relationship"
                name="relationship"
                value={formData.guarantor.relationship}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                placeholder="e.g. Spouse, Friend"
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Postal Address"
                name="postalAddress"
                value={formData.guarantor.postalAddress}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Postal Code"
                name="code"
                type="number"
                value={formData.guarantor.code}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="County"
                name="county"
                value={formData.guarantor.county}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="City/Town"
                name="cityTown"
                value={formData.guarantor.cityTown}
                section="guarantor"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
            </div>

            {/* Guarantor Documents */}
            <div className="mt-8">
              <h3 className="text-lg  text-slate-600 mb-6">
                Guarantor Documents
                {currentSectionHasAmendments && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    key: "guarantorPassport",
                    label: "Guarantor Passport",
                    handler: setGuarantorPassportFile,
                    preview: previews.guarantorPassport,
                    existing: existingImages.guarantorPassport,
                    icon: UserCircleIcon,
                  },
                  {
                    key: "guarantorIdFront",
                    label: "Guarantor ID Front",
                    handler: setGuarantorIdFrontFile,
                    preview: previews.guarantorIdFront,
                    existing: existingImages.guarantorIdFront,
                    icon: IdentificationIcon,
                  },
                  {
                    key: "guarantorIdBack",
                    label: "Guarantor ID Back",
                    handler: setGuarantorIdBackFile,
                    preview: previews.guarantorIdBack,
                    existing: existingImages.guarantorIdBack,
                    icon: IdentificationIcon,
                  },
                ].map((file) => (
                  <div
                    key={file.key}
                    className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <file.icon className="h-6 w-6 text-indigo-600" />
                      <h4 className="text-md font-medium text-gray-900">
                        {file.label}
                        {currentSectionHasAmendments && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                            Amendment
                          </span>
                        )}
                      </h4>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <label className={`flex items-center justify-center gap-1 px-3 py-1 rounded cursor-pointer ${
                        currentSectionHasAmendments ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                      }`}>
                        <Upload size={16} />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                          className="hidden"
                          disabled={!currentSectionHasAmendments}
                        />
                      </label>
                    </div>

                    {(file.preview || file.existing) && (
                      <div className="relative">
                        <img
                          src={file.preview || file.existing}
                          alt={file.label}
                          className="w-full h-32 object-contain border rounded"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(file.key, file.handler)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow"
                          disabled={!currentSectionHasAmendments}
                        >
                          <XIcon size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "guarantorSecurity":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Guarantor Security
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Update guarantor security items
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-amber-700 text-sm">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="space-y-6">
              {guarantorSecurityItems.map((item, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg  text-slate-600 flex items-center">
                      <ShieldCheckIcon className="h-5 w-5 text-purple-600 mr-2" />
                      Guarantor Security Item {index + 1}
                    </h3>
                    {guarantorSecurityItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setGuarantorSecurityItems((prev) => prev.filter((_, i) => i !== index));
                          setGuarantorSecurityImages((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                        disabled={!currentSectionHasAmendments}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AmendmentField
                      label="Security Type"
                      name="type"
                      value={item.type}
                      onChange={(e) => handleGuarantorSecurityChange(e, index)}
                      options={["Household Items", "Business Equipment", "Livestock", "Motor Vehicle", "Motorbike", "Land / Property", "Title deed", "Logbook", "Salary Check-off", "Stock / Inventory", "Fixed deposit / Savings security", "Electronics", "Other"]}
                      isAmendment={currentSectionHasAmendments}
                      disabled={!currentSectionHasAmendments}
                    />
                    <AmendmentField
                      label="Description"
                      name="description"
                      value={item.description}
                      onChange={(e) => handleGuarantorSecurityChange(e, index)}
                      isAmendment={currentSectionHasAmendments}
                      disabled={!currentSectionHasAmendments}
                    />
                    <AmendmentField
                      label="Identification"
                      name="identification"
                      value={item.identification}
                      onChange={(e) => handleGuarantorSecurityChange(e, index)}
                      placeholder="e.g. Serial No."
                      isAmendment={currentSectionHasAmendments}
                      disabled={!currentSectionHasAmendments}
                    />
                    <AmendmentField
                      label="Est. Market Value (KES)"
                      name="value"
                      type="number"
                      value={item.value}
                      onChange={(e) => handleGuarantorSecurityChange(e, index)}
                      isAmendment={currentSectionHasAmendments}
                      disabled={!currentSectionHasAmendments}
                    />
                  </div>

                  {/* Guarantor Security Item Images */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium mb-2 text-gray-800">
                      Item Images
                      {currentSectionHasAmendments && (
                        <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                          Amendment
                        </span>
                      )}
                    </label>
                    <div className="flex gap-3 mb-3">
                      <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition ${
                        currentSectionHasAmendments ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                      }`}>
                        <Upload className="w-5 h-5" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleMultipleFiles(e, index, setGuarantorSecurityImages)}
                          className="hidden"
                          disabled={!currentSectionHasAmendments}
                        />
                      </label>
                    </div>

                    {guarantorSecurityImages[index] && guarantorSecurityImages[index].length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {guarantorSecurityImages[index].map((img, imgIndex) => (
                          <div key={imgIndex} className="relative">
                            <img
                              src={typeof img === "string" ? img : URL.createObjectURL(img)}
                              alt={`Guarantor Security ${index + 1} - Image ${imgIndex + 1}`}
                              className="w-full h-28 object-cover rounded-lg border border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveMultipleFile(index, imgIndex, setGuarantorSecurityImages)}
                              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow"
                              disabled={!currentSectionHasAmendments}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addGuarantorSecurityItem}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-all shadow-md hover:shadow-lg ${
                  currentSectionHasAmendments ? "bg-amber-600 hover:bg-amber-700" : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                }`}
                disabled={!currentSectionHasAmendments}
              >
                <PlusIcon className="h-5 w-5" />
                Add Guarantor Security Item
              </button>
            </div>
          </div>
        );

      case "nextOfKin":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Next of Kin Information
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Update next of kin details
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-amber-700 text-sm">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AmendmentField
                label="First Name"
                name="Firstname"
                value={formData.nextOfKin.Firstname}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Middle Name"
                name="Middlename"
                value={formData.nextOfKin.Middlename}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Surname"
                name="Surname"
                value={formData.nextOfKin.Surname}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="ID Number"
                name="idNumber"
                value={formData.nextOfKin.idNumber}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Relationship"
                name="relationship"
                value={formData.nextOfKin.relationship}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                placeholder="e.g. Brother, Sister"
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Mobile Number"
                name="mobile"
                value={formData.nextOfKin.mobile}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Alternative Number"
                name="alternativeNumber"
                value={formData.nextOfKin.alternativeNumber}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="Employment Status"
                name="employmentStatus"
                value={formData.nextOfKin.employmentStatus}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                options={["Employed", "Self Employed", "Unemployed", "Student", "Retired"]}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="County"
                name="county"
                value={formData.nextOfKin.county}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
              <AmendmentField
                label="City/Town"
                name="cityTown"
                value={formData.nextOfKin.cityTown}
                section="nextOfKin"
                handleNestedChange={handleNestedChange}
                isAmendment={currentSectionHasAmendments}
                disabled={!currentSectionHasAmendments}
              />
            </div>
          </div>
        );

      case "documents":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <DocumentTextIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Document Verification
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Upload verification and officer images
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-amber-700 text-sm">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  key: "officerClient1",
                  label: "First Officer & Client",
                  handler: setOfficerClientImage1,
                  preview: previews.officerClient1,
                  existing: existingImages.officerClient1,
                },
                {
                  key: "officerClient2",
                  label: "Second Officer & Client",
                  handler: setOfficerClientImage2,
                  preview: previews.officerClient2,
                  existing: existingImages.officerClient2,
                },
                {
                  key: "bothOfficers",
                  label: "Both Officers",
                  handler: setBothOfficersImage,
                  preview: previews.bothOfficers,
                  existing: existingImages.bothOfficers,
                },
              ].map((file) => (
                <div
                  key={file.key}
                  className="flex flex-col items-start p-4 border border-blue-200 rounded-xl bg-white shadow-sm hover:shadow-md transition"
                >
                  <label className="block text-sm font-medium text-blue-800 mb-3">
                    {file.label}
                    {currentSectionHasAmendments && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                        Amendment Required
                      </span>
                    )}
                  </label>

                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <label className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 rounded-lg shadow-sm cursor-pointer transition ${
                      currentSectionHasAmendments ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      <ArrowUpTrayIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                        className="hidden"
                        disabled={!currentSectionHasAmendments}
                      />
                    </label>
                  </div>

                  {(file.preview || file.existing) ? (
                    <div className="mt-4 relative w-full">
                      <img
                        src={file.preview || file.existing}
                        alt={file.label}
                        className="w-full h-40 object-cover rounded-lg border border-green-200 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.key, file.handler)}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md"
                        disabled={!currentSectionHasAmendments}
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                      {file.existing && !file.preview && (
                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                          Existing
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      <PhotoIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm">No image uploaded</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Status Summary */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
              <h3 className="text-lg font-semibold text-indigo-800 mb-4">Document Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: "officerClient1", label: "First Officer & Client" },
                  { key: "officerClient2", label: "Second Officer & Client" },
                  { key: "bothOfficers", label: "Both Officers" },
                ].map((doc) => {
                  const hasImage = previews[doc.key] || existingImages[doc.key];
                  return (
                    <div key={doc.key} className="flex items-center gap-3">
                      {hasImage ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircleIcon className="h-6 w-6 text-red-500" />
                      )}
                      <span className={`font-medium ${hasImage ? 'text-green-700' : 'text-red-700'}`}>
                        {doc.label} {hasImage ? '✓' : '✗'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500">No content available for this section.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading amendment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header
        <div className="p-4 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-green-700 transition"
              disabled={isSubmitting}
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Submit Amendments
              </h1>
              <p className="text-gray-600">
                Please review and update the sections marked for amendment
              </p>
            </div>
          </div>
        </div> */}

        {/* Amendment Banner */}
        {amendmentSections.size > 0 && (
          <div className="mb-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <DocumentMagnifyingGlassIcon className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className=" text-amber-800 mb-1">
                    Amendments Required
                  </h3>
                  <p className="text-amber-700 text-sm mb-2">
                    The following sections require your attention and amendments:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(amendmentSections).map((sectionId) => {
                      const section = allSections.find(s => s.id === sectionId);
                      return section ? (
                        <span
                          key={sectionId}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 border border-amber-200"
                        >
                          {section.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <p className="text-amber-700 text-sm mt-2">
                    All fields in the highlighted sections are editable for amendments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-indigo-100">
          <div className="flex flex-wrap gap-2">
            {allSections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeSection === id
                    ? "bg-gradient-to-r from-blue-300 to-blue-300 text-slate-700 shadow-lg"
                    : sectionHasAmendments(id)
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
                {sectionHasAmendments(id) && (
                  <span className="ml-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8">
            {renderSectionContent()}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-200">
              <div className="flex items-center gap-4">
                {activeSection !== allSections[0].id && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = allSections.findIndex((s) => s.id === activeSection);
                      setActiveSection(allSections[currentIndex - 1].id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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

              <div className="flex gap-3">
                {activeSection !== allSections[allSections.length - 1].id && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = allSections.findIndex((s) => s.id === activeSection);
                      setActiveSection(allSections[currentIndex + 1].id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-600 text-white rounded-lg hover:from-amber-700 hover:to-amber-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Submitting...
                    </div>
                  ) : (
                    "Submit Amendments"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditAmendment;