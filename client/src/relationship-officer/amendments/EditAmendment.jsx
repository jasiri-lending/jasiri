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
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Upload, Camera, XIcon } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LocationPicker from "../components/LocationPicker";
import { useNavigate } from "react-router-dom";

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
  'Personal Info': 'personal',
  'Customer': 'personal',
  'Business Info': 'business',
  'Business': 'business',
  'Guarantor': 'guarantor',
  'Guarantors': 'guarantor',
  'Borrower Security': 'borrowerSecurity',
  'Security': 'borrowerSecurity',
  'Guarantor Security': 'guarantorSecurity',
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
  'Document Verification': 'documents',
  'Documents': 'documents',
  'Borrower Security': 'borrowerSecurity',
  'Guarantor Security': 'guarantorSecurity'
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
      ? "border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500"
      : "border-gray-300 bg-gray-50 focus:ring-brand-primary focus:border-brand-primary";

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
            className={`w-full p-3 border rounded-lg focus:ring-brand-primary focus:border-brand-primary transition-colors ${fieldClasses} ${errors[name] ? "border-red-500" : ""}`}
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
            className={`w-full p-3 border rounded-lg focus:ring-brand-primary focus:border-brand-primary transition-colors ${fieldClasses} ${errors[name] ? "border-red-500" : ""}`}
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
  const navigate = useNavigate();

  // Amendment states
  const [amendmentData, setAmendmentData] = useState([]);
  const [amendmentSections, setAmendmentSections] = useState(new Set());

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


  // Enhanced amendment data fetching
  const fetchAmendmentData = async () => {
    try {
      console.log("Fetching real amendment data for customer:", customerId);

      // Fetch latest verification record with fields_to_amend
      const { data: verificationData, error: verificationError } = await supabase
        .from("customer_verifications")
        .select("fields_to_amend, branch_manager_overall_comment, credit_analyst_officer_overall_comment")
        .eq("customer_id", customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (verificationError) {
        if (verificationError.code === 'PGRST116') {
          console.log("No verification record found for customer");
          return;
        }
        throw verificationError;
      }

      if (!verificationData || !verificationData.fields_to_amend) {
        console.log("No fields to amend found in verification record");
        return;
      }

      const fieldsToAmend = verificationData.fields_to_amend;
      console.log("Fields to amend fetched:", fieldsToAmend);

      // Process amendment data to determine which sections need amendments
      const sectionsWithAmendments = new Set();

      fieldsToAmend.forEach(item => {
        // Map section and component to our section IDs
        const sectionId = SECTION_MAPPINGS[item.section] || COMPONENT_MAPPINGS[item.component] || COMPONENT_MAPPINGS[item.section];

        if (sectionId) {
          // Only add to highlight list if it specifies "Not Verified" or requires attention
          const needsAmendmentResult = item.requiresAttention ||
            (item.fields && item.fields.some(f => f.toLowerCase().includes('not verified') || f.toLowerCase().includes('kindly upload')));

          if (needsAmendmentResult) {
            sectionsWithAmendments.add(sectionId);
          }
        }
      });

      console.log("Sections requiring amendments:", Array.from(sectionsWithAmendments));

      setAmendmentData(fieldsToAmend);
      setAmendmentSections(sectionsWithAmendments);

      if (sectionsWithAmendments.size > 0) {
        toast.info(`${sectionsWithAmendments.size} section(s) require amendments`, {
          position: "top-right",
          autoClose: 5000,
        });
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

      // Fetch related data in parallel
      const [
        { data: guarantorsData, error: guarantorsError },
        { data: nextOfKinData, error: nextOfKinError },
        { data: securityItemsData, error: securityError },
        { data: businessImagesData, error: businessError },
        { data: documentsData, error: documentsError },
      ] = await Promise.all([
        supabase.from("guarantors").select("*").eq("customer_id", customerId),
        supabase.from("next_of_kin").select("*").eq("customer_id", customerId).single(),
        supabase
          .from("security_items")
          .select("*, security_item_images(image_url)")
          .eq("customer_id", customerId),
        supabase.from("business_images").select("*").eq("customer_id", customerId),
        supabase.from("documents").select("id, document_type, document_url").eq("customer_id", customerId),
      ]);

      const guarantor = guarantorsData?.[0] || null;
      const nextOfKin = nextOfKinData || null;

      // Fetch guarantor security if guarantor exists
      let guarantorSecurityData = [];
      if (guarantorsData?.length > 0) {
        const guarantorIds = guarantorsData.map((g) => g.id);
        const { data } = await supabase
          .from("guarantor_security")
          .select("*, guarantor_security_images(image_url)")
          .in("guarantor_id", guarantorIds);
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
      console.log("Borrower data fetched:", { guarantorsData, nextOfKinData, securityItemsData, businessImagesData });

      // Security items mapping - combine images and items for robustness
      if (securityItemsData && securityItemsData.length > 0) {
        const processedSecurityItems = securityItemsData.map((item) => ({
          id: item.id,
          type: item.item || item.type || "",
          description: item.description || "",
          identification: item.identification || "",
          value: item.value || "",
        }));
        setSecurityItems(processedSecurityItems);

        const securityImages = securityItemsData.map((item) =>
          item.security_item_images?.map((img) => img.image_url) || []
        );
        setSecurityItemImages(securityImages);
        console.log("Processed Borrower Security:", processedSecurityItems, securityImages);
      } else {
        console.log("No borrower security items found");
      }

      // Guarantor security mapping
      if (guarantorSecurityData && guarantorSecurityData.length > 0) {
        console.log("Processing guarantor security items:", guarantorSecurityData);
        const processedGuarantorSecurity = guarantorSecurityData.map((item) => ({
          id: item.id,
          type: item.item || item.type || "",
          description: item.description || "",
          identification: item.identification || "",
          value: item.estimated_market_value || item.value || "",
        }));
        setGuarantorSecurityItems(processedGuarantorSecurity);

        const gSecurityImages = guarantorSecurityData.map((item) =>
          item.guarantor_security_images?.map((img) => img.image_url) || []
        );
        setGuarantorSecurityImages(gSecurityImages);
        console.log("Processed Guarantor Security:", processedGuarantorSecurity, gSecurityImages);
      } else {
        console.log("No guarantor security items found");
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


  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const safeParseInt = (value) => {
        if (!value || value === "" || isNaN(parseInt(value))) return null;
        return parseInt(value);
      };

      const safeParseFloat = (value) => {
        if (!value || value === "" || isNaN(parseFloat(value))) return null;
        return parseFloat(value);
      };

      const { data: currentCustomer, error: fetchError } = await supabase
        .from("customers")
        .select("status")
        .eq("id", customerId)
        .single();

      if (fetchError) throw fetchError;

      let newStatus = currentCustomer.status;

      // Transition rules for RO amendment
      if (currentCustomer.status === "sent_back_by_bm") {
        newStatus = "bm_review_amend";
      } else if (currentCustomer.status === "sent_back_by_rm") {
        newStatus = "rm_review_amend";
      } else if (currentCustomer.status === "sent_back_by_cso") {
        newStatus = "cso_review_amend";
      }

      // Update customer status
      const { error: updateError } = await supabase
        .from("customers")
        .update({ status: newStatus })
        .eq("id", customerId);

      if (updateError) throw updateError;

      // 1. Update customer details
      const { error: customerError } = await supabase
        .from("customers")
        .update({
          prefix: formData.prefix || null,
          Firstname: formData.Firstname || null,
          Middlename: formData.Middlename || null,
          Surname: formData.Surname || null,
          marital_status: formData.maritalStatus || null,
          residence_status: formData.residenceStatus || null,
          occupation: formData.occupation || null,
          date_of_birth: formData.dateOfBirth || null,
          gender: formData.gender || null,
          id_number: safeParseInt(formData.idNumber),
          postal_address: formData.postalAddress || null,
          code: safeParseInt(formData.code),
          town: formData.town || null,
          county: formData.county || null,
          business_name: formData.businessName || null,
          business_type: formData.businessType || null,
          year_established: formData.year_established || formData.yearEstablished || null,
          business_location: formData.businessLocation || null,
          daily_Sales: safeParseFloat(formData.daily_Sales),
          road: formData.road || null,
          landmark: formData.landmark || null,
          has_local_authority_license:
            formData.hasLocalAuthorityLicense === "Yes",
          edited_at: new Date().toISOString(),
          status: newStatus,
        })
        .eq("id", customerId);

      if (customerError) throw customerError;

      // 2. Helper function for file uploads
      const uploadFile = async (file, folderPath, fileNamePrefix) => {
        if (!file) return null;

        if (typeof file === "string") {
          return file;
        }

        if (file instanceof File) {
          const fileExt = file.name.split(".").pop();
          const filePath = `${folderPath}/${fileNamePrefix}_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("customers")
            .upload(filePath, file, { upsert: true });

          if (uploadError) throw uploadError;

          const {
            data: { publicUrl },
          } = supabase.storage.from("customers").getPublicUrl(filePath);

          return publicUrl;
        }

        return null;
      };

      // 3. Upload customer personal images
      const passportUrl = await uploadFile(
        passportFile,
        "personal",
        "passport"
      );
      const idFrontUrl = await uploadFile(idFrontFile, "personal", "id_front");
      const idBackUrl = await uploadFile(idBackFile, "personal", "id_back");
      const houseImageUrl = await uploadFile(
        houseImageFile,
        "personal",
        "house"
      );

      // Update customer with new image URLs
      if (passportUrl || idFrontUrl || idBackUrl || houseImageUrl) {
        const updateData = {};
        if (passportUrl) updateData.passport_url = passportUrl;
        if (idFrontUrl) updateData.id_front_url = idFrontUrl;
        if (idBackUrl) updateData.id_back_url = idBackUrl;
        if (houseImageUrl) updateData.house_image_url = houseImageUrl;

        const { error: imageError } = await supabase
          .from("customers")
          .update(updateData)
          .eq("id", customerId);

        if (imageError) throw imageError;
      }

      // 4. Update guarantor details - FIRST GET EXISTING GUARANTOR ID
      let existingGuarantorId = null;

      const { data: existingGuarantor } = await supabase
        .from("guarantors")
        .select("id")
        .eq("customer_id", customerId)
        .single();

      if (existingGuarantor) {
        existingGuarantorId = existingGuarantor.id;

        // Upload guarantor images
        const guarantorPassportUrl = await uploadFile(
          guarantorPassportFile,
          "guarantor",
          "passport"
        );
        const guarantorIdFrontUrl = await uploadFile(
          guarantorIdFrontFile,
          "guarantor",
          "id_front"
        );
        const guarantorIdBackUrl = await uploadFile(
          guarantorIdBackFile,
          "guarantor",
          "id_back"
        );

        const { error: guarantorError } = await supabase
          .from("guarantors")
          .update({
            prefix: formData.guarantor.prefix || null,
            Firstname: formData.guarantor.Firstname || null,
            Surname: formData.guarantor.Surname || null,
            Middlename: formData.guarantor.Middlename || null,
            id_number: safeParseInt(formData.guarantor.idNumber),
            marital_status: formData.guarantor.maritalStatus || null,
            date_of_birth: formData.guarantor.dateOfBirth || null,
            residence_status: formData.guarantor.residenceStatus || null,
            gender: formData.guarantor.gender || null,
            mobile: formData.guarantor.mobile || null,
            postal_address: formData.guarantor.postalAddress || null,
            code: safeParseInt(formData.guarantor.code),
            occupation: formData.guarantor.occupation || null,
            relationship: formData.guarantor.relationship || null,
            county: formData.guarantor.county || null,
            city_town: formData.guarantor.cityTown || null,
            ...(guarantorPassportUrl && { passport_url: guarantorPassportUrl }),
            ...(guarantorIdFrontUrl && { id_front_url: guarantorIdFrontUrl }),
            ...(guarantorIdBackUrl && { id_back_url: guarantorIdBackUrl }),
          })
          .eq("id", existingGuarantorId);

        if (guarantorError) throw guarantorError;
      }

      // 5. Update next of kin details
      const { data: existingNextOfKin } = await supabase
        .from("next_of_kin")
        .select("id")
        .eq("customer_id", customerId)
        .single();

      if (existingNextOfKin && formData.nextOfKin) {
        const { error: nextOfKinError } = await supabase
          .from("next_of_kin")
          .update({
            Firstname: formData.nextOfKin.Firstname || null,
            Surname: formData.nextOfKin.Surname || null,
            Middlename: formData.nextOfKin.Middlename || null,
            id_number: safeParseInt(formData.nextOfKin.idNumber),
            relationship: formData.nextOfKin.relationship || null,
            mobile: formData.nextOfKin.mobile || null,
            alternative_number: formData.nextOfKin.alternativeNumber || null,
            employment_status: formData.nextOfKin.employmentStatus || null,
            county: formData.nextOfKin.county || null,
            city_town: formData.nextOfKin.cityTown || null,
          })
          .eq("id", existingNextOfKin.id);

        if (nextOfKinError) throw nextOfKinError;
      }

      // 6. Handle business images
      if (businessImages.length > 0) {
        await supabase
          .from("business_images")
          .delete()
          .eq("customer_id", customerId);

        for (const image of businessImages) {
          const businessImageUrl = await uploadFile(
            image,
            "business",
            "business"
          );

          if (businessImageUrl) {
            const { error: insertError } = await supabase
              .from("business_images")
              .insert({
                customer_id: customerId,
                image_url: businessImageUrl,
              });

            if (insertError) throw insertError;
          }
        }
      }

      // 7. Handle security items
      await supabase
        .from("security_items")
        .delete()
        .eq("customer_id", customerId);

      for (const [index, item] of securityItems.entries()) {
        const { data: securityItem, error: securityError } = await supabase
          .from("security_items")
          .insert({
            customer_id: customerId,
            item: item.item || item.type || null,
            description: item.description || null,
            identification: item.identification || null,
            value: safeParseFloat(item.value),
          })
          .select()
          .single();

        if (securityError) throw securityError;

        // Handle security item images
        if (securityItemImages[index] && securityItemImages[index].length > 0) {
          for (const image of securityItemImages[index]) {
            const securityImageUrl = await uploadFile(
              image,
              "borrower_security",
              `item_${securityItem.id}`
            );

            if (securityImageUrl) {
              const { error: imageError } = await supabase
                .from("security_item_images")
                .insert({
                  security_item_id: securityItem.id,
                  image_url: securityImageUrl,
                });

              if (imageError) throw imageError;
            }
          }
        }
      }

      // 8. Handle guarantor security items (only if guarantor exists)
      if (existingGuarantorId) {
        await supabase
          .from("guarantor_security")
          .delete()
          .eq("guarantor_id", existingGuarantorId);

        for (const [index, item] of guarantorSecurityItems.entries()) {
          const { data: securityItem, error: securityError } = await supabase
            .from("guarantor_security")
            .insert({
              guarantor_id: existingGuarantorId,
              item: item.item || item.type || null,
              description: item.description || null,
              identification: item.identification || null,
              estimated_market_value: safeParseFloat(item.value),
            })
            .select()
            .single();

          if (securityError) throw securityError;

          // Handle guarantor security item images
          if (
            guarantorSecurityImages[index] &&
            guarantorSecurityImages[index].length > 0
          ) {
            for (const image of guarantorSecurityImages[index]) {
              const securityImageUrl = await uploadFile(
                image,
                "guarantor_security",
                `item_${securityItem.id}`
              );

              if (securityImageUrl) {
                const { error: imageError } = await supabase
                  .from("guarantor_security_images")
                  .insert({
                    guarantor_security_id: securityItem.id,
                    image_url: securityImageUrl,
                  });

                if (imageError) throw imageError;
              }
            }
          }
        }
      }

      // 9. Handle document verification images
      const documentUpload = async (file, documentType) => {
        if (!file) return;

        const documentUrl = await uploadFile(
          file,
          "documents",
          documentType.replace(/\s+/g, "_")
        );

        if (documentUrl) {
          const { data: existingDoc } = await supabase
            .from("documents")
            .select("id")
            .eq("customer_id", customerId)
            .eq("document_type", documentType)
            .single();

          if (existingDoc) {
            const { error: updateError } = await supabase
              .from("documents")
              .update({ document_url: documentUrl })
              .eq("id", existingDoc.id);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from("documents")
              .insert({
                customer_id: customerId,
                document_type: documentType,
                document_url: documentUrl,
              });

            if (insertError) throw insertError;
          }
        }
      };

      await documentUpload(
        officerClientImage1,
        "First Officer and Client Image"
      );
      await documentUpload(
        officerClientImage2,
        "Second Officer and Client Image"
      );
      await documentUpload(bothOfficersImage, "Both Officers Image");

      toast.success("Customer information updated successfully!");
      onClose();
      navigate(-1);
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error(`Failed to update customer: ${error.message}`);
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
    const currentSectionHasAmendments = sectionHasAmendments(activeSection);
    const sectionAmendmentDetails = getSectionAmendmentDetails(activeSection);

    switch (activeSection) {
      case "personal":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <UserCircleIcon className="h-8 w-8 text-brand-primary mr-3" />
                Personal Information
              </h2>
              <p className="text-gray-600 mt-2">
                Update personal details and contact information
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-red-700 text-sm font-medium">
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
                    </label>
                    <div className="flex gap-2 w-full">
                      <label className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand-btn text-white hover:bg-brand-primary"
                        }`}>
                        <Upload className="w-5 h-5" />
                        <span className="font-medium">Upload</span>
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
                <BuildingOffice2Icon className="h-8 w-8 text-brand-primary mr-3" />
                Business Information
              </h2>
              <p className="text-gray-600 mt-2">
                Update business details and operations
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-red-700 text-sm font-medium">
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
              </h3>
              <div className="flex gap-3 mb-4">
                <label className={`flex items-center gap-2 px-6 py-3 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand-btn text-white hover:bg-brand-primary"
                  }`}>
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Add Images</span>
                  <input type="file" accept="image/*" multiple onChange={handleBusinessImages} className="hidden"
                    disabled={!currentSectionHasAmendments} />
                </label>
              </div>

              {/* Combined display for existing and new images */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Existing URLs */}
                {existingImages.business?.map((img, index) => (
                  <div key={`existing-${index}`} className="relative group">
                    <img src={img} alt={`Business Existing ${index + 1}`} className="w-full h-32 object-cover rounded-xl border border-gray-200 shadow-sm" />
                    <button
                      type="button"
                      onClick={() => setExistingImages(prev => ({ ...prev, business: prev.business.filter((_, i) => i !== index) }))}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition shadow-lg"
                      disabled={!currentSectionHasAmendments}
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">Existing</div>
                  </div>
                ))}

                {/* Newly selected Files */}
                {businessImages.map((img, index) => (
                  <div key={`new-${index}`} className="relative group">
                    <img src={URL.createObjectURL(img)} alt={`Business New ${index + 1}`} className="w-full h-32 object-cover rounded-xl border border-brand-primary/30 shadow-md" />
                    <button
                      type="button"
                      onClick={() => handleRemoveBusinessImage(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg"
                      disabled={!currentSectionHasAmendments}
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">New</div>
                  </div>
                ))}
              </div>

              {(!existingImages.business?.length && !businessImages.length) && (
                <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <PhotoIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500 text-sm">No business images uploaded yet</p>
                </div>
              )}
            </div>
          </div>
        );

      case "borrowerSecurity":
        return (
          <div className="space-y-8">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg  text-slate-600 flex items-center">
                <ShieldCheckIcon className="h-8 w-8 text-brand-primary mr-3" />
                Borrower Security
              </h2>
              <p className="text-gray-600 mt-2">
                Update borrower security items
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-red-700 text-sm font-medium">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="space-y-6">
              {securityItems.map((item, index) => (
                <div key={index} className="bg-brand-surface rounded-xl p-6 border border-brand-surface shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg text-slate-600 flex items-center">
                      <ShieldCheckIcon className="h-5 w-5 text-brand-primary mr-2" />
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
                    <label className="block text-sm font-medium mb-3 text-gray-800">
                      Item Images
                    </label>
                    <div className="flex gap-3 mb-4">
                      <label className={`flex items-center gap-2 px-6 py-3 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand-btn text-white hover:bg-brand-primary"
                        }`}>
                        <Upload className="w-5 h-5" />
                        <span className="font-medium">Upload Images</span>
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

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {/* Existing Images for this specific item if we had them mapped, 
                          but the state management here is a bit complex. 
                          Let's try to render what's in securityItemImages[index] */}
                      {securityItemImages[index]?.map((img, imgIndex) => {
                        const imgSrc = typeof img === "string" ? img : URL.createObjectURL(img);
                        return (
                          <div key={imgIndex} className="relative group">
                            <img
                              src={imgSrc}
                              alt={`Security ${index + 1} - Image ${imgIndex + 1}`}
                              className="w-full h-28 object-cover rounded-xl border border-gray-200 shadow-sm"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://via.placeholder.com/150?text=Error+Loading+Image";
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveMultipleFile(index, imgIndex, setSecurityItemImages)}
                              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition"
                              disabled={!currentSectionHasAmendments}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                            {typeof img === "string" && (
                              <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase shadow-sm">Existing</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addSecurityItem}
                className={`flex items-center gap-2 px-8 py-3.5 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm uppercase tracking-wide ${currentSectionHasAmendments ? "bg-red-600 hover:bg-red-700" : "bg-brand-btn hover:bg-brand-primary"
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
                <CurrencyDollarIcon className="h-8 w-8 text-brand-primary mr-3" />
                Loan Information
              </h2>
              <p className="text-gray-600 mt-2">
                Update loan amount and terms
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-red-700 text-sm font-medium">
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
                <UserGroupIcon className="h-8 w-8 text-brand-primary mr-3" />
                Guarantor Information
                {currentSectionHasAmendments && (
                  <span className="ml-2 bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Amendments Required
                  </span>
                )}
              </h2>
              <p className="text-gray-600 mt-2">
                Update guarantor personal details
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-red-700 text-sm font-medium">
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
                      <file.icon className="h-6 w-6 text-brand-primary" />
                      <h4 className="text-md font-medium text-gray-900">
                        {file.label}
                      </h4>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <label className={`flex items-center justify-center gap-1 px-3 py-1 rounded cursor-pointer ${currentSectionHasAmendments ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-brand-surface text-brand-primary hover:bg-brand-secondary/20"
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
                <ShieldCheckIcon className="h-8 w-8 text-brand-primary mr-3" />
                Guarantor Security
              </h2>
              <p className="text-gray-600 mt-2">
                Update guarantor security items
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-red-700 text-sm font-medium">
                    <strong>Required amendments:</strong> {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                  </div>
                )}
              </p>
            </div>

            <div className="space-y-6">
              {guarantorSecurityItems.map((item, index) => (
                <div
                  key={index}
                  className="bg-brand-surface rounded-xl p-6 border border-brand-surface"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg  text-slate-600 flex items-center">
                      <ShieldCheckIcon className="h-5 w-5 text-brand-primary mr-2" />
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
                    <label className="block text-sm font-medium mb-3 text-gray-800">
                      Item Images
                    </label>
                    <div className="flex gap-3 mb-4">
                      <label className={`flex items-center gap-2 px-6 py-3 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand-btn text-white hover:bg-brand-primary"
                        }`}>
                        <Upload className="w-5 h-5" />
                        <span className="font-medium">Upload Images</span>
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

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {guarantorSecurityImages[index]?.map((img, imgIndex) => {
                        const imgSrc = typeof img === "string" ? img : URL.createObjectURL(img);
                        return (
                          <div key={imgIndex} className="relative group">
                            <img
                              src={imgSrc}
                              alt={`Guarantor Security ${index + 1} - Image ${imgIndex + 1}`}
                              className="w-full h-28 object-cover rounded-xl border border-gray-200 shadow-sm"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://via.placeholder.com/150?text=Error+Loading+Image";
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveMultipleFile(index, imgIndex, setGuarantorSecurityImages)}
                              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition"
                              disabled={!currentSectionHasAmendments}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                            {typeof img === "string" && (
                              <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase shadow-sm">Existing</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addGuarantorSecurityItem}
                className={`flex items-center gap-2 px-8 py-3.5 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm uppercase tracking-wide ${currentSectionHasAmendments ? "bg-red-600 hover:bg-red-700" : "bg-brand-btn hover:bg-brand-primary"
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
                <UserGroupIcon className="h-8 w-8 text-brand-primary mr-3" />
                Next of Kin Information
              </h2>
              <p className="text-gray-600 mt-2">
                Update next of kin details
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-red-700 text-sm font-medium">
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
                <DocumentTextIcon className="h-8 w-8 text-brand-primary mr-3" />
                Document Verification
              </h2>
              <p className="text-gray-600 mt-2">
                Upload verification and officer images
                {sectionAmendmentDetails.length > 0 && (
                  <div className="mt-2 text-red-700 text-sm font-medium">
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
                  className="flex flex-col items-start p-4 border border-brand-surface rounded-xl bg-brand-surface shadow-sm hover:shadow-md transition"
                >
                  <label className="block text-sm font-medium text-brand-primary mb-3">
                    {file.label}
                  </label>

                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <label className={`flex flex-1 items-center justify-center gap-2 px-6 py-3 rounded-lg shadow-sm cursor-pointer transition-all hover:shadow-md ${currentSectionHasAmendments ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand-btn text-white hover:bg-brand-primary"
                      }`}>
                      <Upload className="w-5 h-5" />
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
            <div className="bg-brand-surface rounded-xl p-6 border border-brand-surface mb-6">
              <h3 className="text-lg font-semibold text-brand-primary mb-4">Document Status</h3>
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
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-secondary border-t-brand-primary mb-4"></div>
          <p className="text-brand-primary font-medium">Loading amendment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface py-8 font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 mb-1">
                    Amendments Required
                  </h3>
                  <p className="text-red-700 text-sm mb-2 font-medium">
                    The following sections require your attention and amendments:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(amendmentSections).map((sectionId) => {
                      const section = allSections.find(s => s.id === sectionId);
                      return section ? (
                        <span
                          key={sectionId}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200"
                        >
                          {section.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <p className="text-red-700 text-sm mt-3 font-medium">
                    All fields in the highlighted sections are editable for amendments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm p-6 mb-8 border border-white/50">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
            {allSections.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              const isAmended = sectionHasAmendments(id);
              return (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className="flex flex-col items-center gap-2 transition-all duration-300 group relative"
                >
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center font-medium transition-all duration-300 relative ${isActive
                      ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/30 transform scale-110"
                      : isAmended
                        ? "bg-red-50 text-red-600 border-2 border-red-200 group-hover:bg-red-100 group-hover:border-red-300 group-hover:scale-105"
                        : "bg-gray-100 text-slate-700 border-2 border-gray-200 group-hover:bg-gray-200 group-hover:border-gray-300 group-hover:scale-105"
                      }`}
                  >
                    <Icon className={`h-7 w-7 ${isActive ? "text-white" : isAmended ? "text-red-500" : "text-slate-700"}`} />
                    {isAmended && !isActive && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-tighter text-center transition-all duration-300 ${isActive
                      ? "text-brand-primary"
                      : isAmended
                        ? "text-red-600"
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
        <div className="bg-white rounded-2xl shadow-lg border border-brand-secondary/20 overflow-hidden">
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
                    className="flex items-center gap-2 px-6 py-3 bg-neutral text-text rounded-lg hover:bg-brand-surface transition-colors font-medium shadow-sm"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-secondary text-white rounded-lg hover:bg-brand-primary transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
                {activeSection !== allSections[allSections.length - 1].id ? (
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = allSections.findIndex((s) => s.id === activeSection);
                      setActiveSection(allSections[currentIndex + 1].id);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-neutral text-text rounded-lg hover:bg-brand-surface transition-colors font-medium shadow-sm"
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-8 py-3 bg-accent text-white rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Submitting...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-6 w-6" />
                        Submit Amendments
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
}

export default EditAmendment;