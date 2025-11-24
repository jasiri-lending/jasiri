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

const CustomerDraft = ({ profile, onClose }) => { 
   const { draftId } = useParams();
  const navigate = useNavigate();
  const customerId = draftId;
  const [activeSection, setActiveSection] = useState("personal");
  const [securityItems, setSecurityItems] = useState([
    { item: "", description: "", identification: "", value: "" },
  ]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([
    { item: "", description: "", identification: "", value: "" },
  ]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Initialize formData with empty values

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
      alternativeMobile: "",
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
  const [officerClientImage1, setOfficerClientImage1] = useState(null);
  const [officerClientImage2, setOfficerClientImage2] = useState(null);
  const [bothOfficersImage, setBothOfficersImage] = useState(null);
  const [previews, setPreviews] = useState({});

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

    // 1️ Fetch customer
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (customerError) throw customerError;
    console.log("Customer data loaded:", customer);

    // 2️ Parallel fetch of related tables
    const [
      { data: guarantor },
      { data: nextOfKin },
      { data: securityItemsData },
      { data: businessImagesData },
      { data: documentsData },
    ] = await Promise.all([
      supabase.from("guarantors").select("*").eq("customer_id", id).single(),
      supabase.from("next_of_kin").select("*").eq("customer_id", id).single(),
      supabase
        .from("security_items")
        .select("*, security_item_images(image_url)")
        .eq("customer_id", id),
      supabase.from("business_images").select("*").eq("customer_id", id),
      supabase
        .from("documents")
        .select("id, document_type, document_url")
        .eq("customer_id", id),
    ]);

    // 3️ Fetch guarantor security if guarantor exists
    let guarantorSecurityData = [];
    if (guarantor?.id) {
      const { data } = await supabase
        .from("guarantor_security")
        .select("*, guarantor_security_images(image_url)")
        .eq("guarantor_id", guarantor.id);
      guarantorSecurityData = data || [];
    }

    // 4️ Build form data
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
      dateOfBirth: customer?.date_of_birth?.split("T")[0] || "",
      gender: customer?.gender || "",
      idNumber: customer?.id_number?.toString() || "",
      postalAddress: customer?.postal_address || "",
      code: customer?.code?.toString() || "",
      town: customer?.town || "",
      county: customer?.county || "",
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

      guarantor: guarantor
        ? {
            prefix: guarantor.prefix || "",
            Firstname: guarantor.Firstname || "",
            Surname: guarantor.Surname || "",
            idNumber: guarantor.id_number?.toString() || "",
            maritalStatus: guarantor.marital_status || "",
            Middlename: guarantor.Middlename || "",
            dateOfBirth: guarantor.date_of_birth?.split("T")[0] || "",
            residenceStatus: guarantor.residence_status || "",
            gender: guarantor.gender || "",
            mobile: guarantor.mobile || "",
            postalAddress: guarantor.postal_address || "",
            code: guarantor.code?.toString() || "",
            occupation: guarantor.occupation || "",
            relationship: guarantor.relationship || "",
            county: guarantor.county || "",
            cityTown: guarantor.city_town || "",
          }
        : {},

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
          }
        : {},

      documents:
        documentsData?.length > 0
          ? documentsData.map((doc) => ({
              id: doc.id,
              document_type: doc.document_type || "",
              document_url: doc.document_url || "",
            }))
          : [],
    };

    setFormData(updatedFormData);
    console.log("Form data set:", updatedFormData);

    // 5️Security items
    const processedSecurityItems =
      securityItemsData?.map((item) => ({
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

    // 6️ Guarantor security items
    const processedGuarantorSecurity =
      guarantorSecurityData?.map((item) => ({
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

    // 7️ Image previews
    const imageData = {
      passport: customer?.passport_url || null,
      idFront: customer?.id_front_url || null,
      idBack: customer?.id_back_url || null,
      house: customer?.house_image_url || null,
      business: businessImagesData?.map((img) => img.image_url) || [],
      security: securityImages?.flat() || [],
      guarantorPassport: guarantor?.passport_url || null,
      guarantorIdFront: guarantor?.id_front_url || null,
      guarantorIdBack: guarantor?.id_back_url || null,
      guarantorSecurity: guarantorSecurityImages?.flat() || [],
      officerClient1:
        documentsData?.find(
          (doc) => doc.document_type === "First Officer and Client Image"
        )?.document_url || null,
      officerClient2:
        documentsData?.find(
          (doc) => doc.document_type === "Second Officer and Client Image"
        )?.document_url || null,
      bothOfficers:
        documentsData?.find(
          (doc) => doc.document_type === "Both Officers Image"
        )?.document_url || null,
    };

    setPreviews(imageData);
    console.log("Images set:", imageData);

   
  } catch (error) {
    console.error("Error loading customer data:", error);
    toast.error("Failed to load customer data. Please try again.", {
      position: "top-right",
    });
  } finally {
    setIsLoading(false);
  }
};



  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1); // Go back to previous page when used as route
    }
  }, [onClose, navigate])

  
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

  const handleSecurityChange = useCallback((e, index) => {
    const { name, value } = e.target;
    setSecurityItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [name]: value };
      return newItems;
    });
  }, []);

  const addSecurityItem = () => {
    const newItem = {
      item: "",
      description: "",
      identification: "",
      value: "",
    };
    setSecurityItems((prev) => [...prev, newItem]);
    setSecurityItemImages((prev) => [...prev, []]);
  };

  const removeSecurityItem = (index) => {
    setSecurityItems((prev) => prev.filter((_, i) => i !== index));
    setSecurityItemImages((prev) => prev.filter((_, i) => i !== index));
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

      const { data, error: fetchError } = await supabase
        .from("customers")
        .select("status")
        .eq("id", customerId)
        .single();

      if (fetchError) throw fetchError;
      const newStatus = "bm_review";
const newFormStatus = "submitted";

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
          mobile: formData.mobile || null,
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
year_established: formData.yearEstablished
  ? new Date(formData.yearEstablished).toISOString().split("T")[0]
  : null,
          business_location: formData.businessLocation || null,
          daily_Sales: safeParseFloat(formData.daily_Sales),
          road: formData.road || null,
          landmark: formData.landmark || null,
          has_local_authority_license:
            formData.hasLocalAuthorityLicense === "Yes",
          edited_at: new Date().toISOString(),
                status: newStatus,                // ✅ Change status to bm_review
        form_status: newFormStatus,       // ✅ Change form_status to submitted if draft
        prequalifiedAmount: safeParseFloat(formData.prequalifiedAmount) || null, 
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

// 4. Update or insert guarantor details
let guarantorId = null;

const { data: existingGuarantor } = await supabase
  .from("guarantors")
  .select("id")
  .eq("customer_id", customerId)
  .single();

if (existingGuarantor) {
  guarantorId = existingGuarantor.id;
} else {
  const { data: insertedGuarantor, error: insertError } = await supabase
    .from("guarantors")
    .insert({ customer_id: customerId })
    .select()
    .single();
  if (insertError) throw insertError;
  guarantorId = insertedGuarantor.id;
}

// Upload guarantor images
const guarantorPassportUrl = await uploadFile(guarantorPassportFile, "guarantor", "passport");
const guarantorIdFrontUrl = await uploadFile(guarantorIdFrontFile, "guarantor", "id_front");
const guarantorIdBackUrl = await uploadFile(guarantorIdBackFile, "guarantor", "id_back");

// Update guarantor record
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
  .eq("id", guarantorId);

if (guarantorError) throw guarantorError;


// 5. Update or insert next of kin details
let nextOfKinId = null;

const { data: existingNextOfKin } = await supabase
  .from("next_of_kin")
  .select("id")
  .eq("customer_id", customerId)
  .single();

if (existingNextOfKin) {
  nextOfKinId = existingNextOfKin.id;
} else {
  const { data: insertedNextOfKin, error: insertError } = await supabase
    .from("next_of_kin")
    .insert({ customer_id: customerId })
    .select()
    .single();
  if (insertError) throw insertError;
  nextOfKinId = insertedNextOfKin.id;
}

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
  .eq("id", nextOfKinId);

if (nextOfKinError) throw nextOfKinError;

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
            item: item.item || null,
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

    // 8. Handle guarantor security items
if (guarantorId) {
  await supabase.from("guarantor_security").delete().eq("guarantor_id", guarantorId);

  for (const [index, item] of guarantorSecurityItems.entries()) {
    const { data: securityItem, error: securityError } = await supabase
      .from("guarantor_security")
      .insert({
        guarantor_id: guarantorId,
        item: item.item || null,
        description: item.description || null,
        identification: item.identification || null,
        estimated_market_value: safeParseFloat(item.value),
      })
      .select()
      .single();

    if (securityError) throw securityError;

    // Save guarantor security images
    if (guarantorSecurityImages[index] && guarantorSecurityImages[index].length > 0) {
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
    handleClose();
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
    // Determine if this is an update (existing form) or a new draft
    const existingCustomerId = formData?.id || null;

    // Upload available files (optional)
    let passportUrl = formData.passport_url || null;
    let idFrontUrl = formData.id_front_url || null;
    let idBackUrl = formData.id_back_url || null;
    let houseImageUrl = formData.house_image_url || null;

    if (passportFile)
      passportUrl = await handleFileUpload(
        passportFile,
        `personal/${Date.now()}_passport_${passportFile.name}`,
        "customers"
      );

    if (idFrontFile)
      idFrontUrl = await handleFileUpload(
        idFrontFile,
        `personal/${Date.now()}_id_front_${idFrontFile.name}`,
        "customers"
      );

    if (idBackFile)
      idBackUrl = await handleFileUpload(
        idBackFile,
        `personal/${Date.now()}_id_back_${idBackFile.name}`,
        "customers"
      );

    if (houseImageFile)
      houseImageUrl = await handleFileUpload(
        houseImageFile,
        `personal/${Date.now()}_house_${houseImageFile.name}`,
        "customers"
      );

    // --- Prepare the payload ---
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
      id_number: formData.idNumber ? parseInt(formData.idNumber) : null,
      postal_address: formData.postalAddress || null,
      code: formData.code ? parseInt(formData.code) : null,
      town: formData.town || null,
      county: formData.county || null,
      business_name: formData.businessName || null,
      business_type: formData.businessType || null,
      daily_Sales: formData.daily_Sales
        ? parseFloat(formData.daily_Sales)
        : null,
      year_established: formData.yearEstablished
        ? parseInt(formData.yearEstablished)
        : null,
      business_location: formData.businessLocation || null,
      road: formData.road || null,
      landmark: formData.landmark || null,
      has_local_authority_license:
        formData.hasLocalAuthorityLicense === "Yes",
      prequalifiedAmount: formData.prequalifiedAmount
        ? parseFloat(formData.prequalifiedAmount)
        : null,
      passport_url: passportUrl,
      id_front_url: idFrontUrl,
      id_back_url: idBackUrl,
      house_image_url: houseImageUrl,
      form_status: "draft",
      status: "pending",
      created_by: profile?.id,
      branch_id: profile?.branch_id,
      region_id: profile?.region_id,
      updated_at: new Date().toISOString(),
    };

    let draftResult;

    if (existingCustomerId) {
      // Update existing record
      draftResult = await supabase
        .from("customers")
        .update(customerPayload)
        .eq("id", existingCustomerId)
        .select("id")
        .single();
    } else {
      // Insert new record
      draftResult = await supabase
        .from("customers")
        .insert([{ ...customerPayload, created_at: new Date().toISOString() }])
        .select("id")
        .single();
    }

    if (draftResult.error) throw draftResult.error;
    const customerId = draftResult.data.id;

    // --- Save related data ---
    const nextOfKin = formData.nextOfKin || {};
    if (Object.values(nextOfKin).some((val) => val))
      await supabase.from("next_of_kin").upsert(
        {
          customer_id: customerId,
          ...nextOfKin,
          created_by: profile?.id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
        },
        { onConflict: "customer_id" }
      );

    const guarantor = formData.guarantor || {};
    if (Object.values(guarantor).some((val) => val))
      await supabase.from("guarantors").upsert(
        {
          customer_id: customerId,
          ...guarantor,
          created_by: profile?.id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
        },
        { onConflict: "customer_id" }
      );

    if (securityItems.length > 0) {
      const itemsToInsert = securityItems.map((s) => ({
        customer_id: customerId,
        item: s.item || null,
        description: s.description || null,
        identification: s.identification || null,
        value: s.value ? parseFloat(s.value) : null,
        created_by: profile?.id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
      }));
      await supabase.from("security_items").insert(itemsToInsert);
    }

    toast.success("Draft saved successfully!", {
      position: "top-right",
      autoClose: 3000,
    });
  } catch (error) {
    console.error("Error saving draft:", error);
    toast.error("Failed to save draft. Please try again.", {
      position: "top-right",
      autoClose: 3000,
    });
  } finally {
    setIsSavingDraft(false);
  }
};






  return (
 <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex justify-center py-10 px-4">
  <div className="bg-white w-full max-w-6xl rounded-xl shadow-md p-8">

        {/* Header - Show if editing existing draft */}
      
<div className="flex items-center justify-between mb-6">
  <button
    onClick={() => navigate(-1)} // navigates back to the previous page
    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
  >
    <ChevronLeftIcon className="h-5 w-5" />
    <span className="text-sm font-medium">Back</span>
  </button>

  <div className=" flex-1 pl-2">
    <h1 className="text-lg font-semibold bg-gradient-to-r from-gray-600 to-gray-600 bg-clip-text text-transparent">
      {customerId ? "Edit Customer Draft" : "New Customer Application"}
    </h1>
  
   
  </div>

</div>


          {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-indigo-100">
          <div className="flex flex-wrap gap-2">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeSection === id
                    ? "bg-gradient-to-r from-blue-300 to-blue-300 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md"
                }`}
              >
                <Icon Icon className="h-5 w-5" />
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
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
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
                    label="Town/City"
                    name="town"
                    value={formData.town}
                    onChange={handleChange}
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="County"
                    name="county"
                    value={formData.county}
                    onChange={handleChange}
                    handleNestedChange={handleNestedChange}
                  />
                </div>

                {/* Document Uploads */}
               <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
                    Personal Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      {
                        key: "passport",
                        label: "Passport Photo",
                        handler: setPassportFile,
                        preview: previews.passport,
                        existing: existingImages.passport,
                      },
                      {
                        key: "idFront",
                        label: "ID Front",
                        handler: setIdFrontFile,
                        preview: previews.idFront,
                        existing: existingImages.idFront,
                      },
                      {
                        key: "idBack",
                        label: "ID Back",
                        handler: setIdBackFile,
                        preview: previews.idBack,
                        existing: existingImages.idBack,
                      },
                      {
                        key: "house",
                        label: "House Image",
                        handler: setHouseImageFile,
                        preview: previews.house,
                        existing: existingImages.house,
                      },
                    ].map((file) => (
                      <div
                        key={file.key}
                        className="flex flex-col items-start p-4 border border-blue-200 rounded-xl bg-white shadow-sm hover:shadow-md transition"
                      >
                        {/* Label */}
                        <label className="block text-sm font-medium text-blue-800 mb-3">
                          {file.label}
                        </label>


{/* Upload / Camera buttons */}
<div className="flex flex-wrap gap-4 w-full max-w-md mx-auto">
  {/* Upload Button */}
  <label className="flex-1 max-w-[calc(50%-0.5rem)] flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg shadow-sm cursor-pointer hover:bg-blue-200 transition">
    <ArrowUpTrayIcon className="w-4 h-4" />
    <span className="text-sm font-medium">Upload</span>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => handleFileUpload(e, file.handler, file.key)}
      className="hidden"
    />
  </label>

  {/* Camera Button */}
  <label className="flex-1 max-w-[calc(50%-0.5rem)] flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-slate-600 rounded-lg shadow-sm cursor-pointer hover:bg-blue-500 transition">
    <CameraIcon className="w-4 h-4" />
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






                        {/* Preview */}
                        {(file.preview || file.existing) && (
                          <div className="mt-4 relative w-full">
                            <img
                              src={file.preview || file.existing}
                              alt={file.label}
                              className="w-full h-40 object-cover rounded-lg border border-green-200 shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveFile(file.key, file.handler)
                              }
                              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
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
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
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
                    label="Local Authority License"
                    name="hasLocalAuthorityLicense"
                    value={formData.hasLocalAuthorityLicense}
                    onChange={handleChange}
                    options={["Yes", "No"]}
                    handleNestedChange={handleNestedChange}
                    errors={errors}
                  />
                </div>

                {/* Business Images */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Business Images
                    </h3>
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-slate-600 rounded-lg cursor-pointer hover:bg-blue-400 transition-colors">
                      <PlusIcon className="h-4 w-4" />
                      Add Images
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setBusinessImages((prev) => [...prev, ...files]);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Display business images */}
                  {(existingImages.business?.length > 0 ||
                    businessImages.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Existing Business Images */}
                      {existingImages.business?.map((img, index) => (
                        <div
                          key={`existing-business-${index}`}
                          className="relative group"
                        >
                          <img
                            src={img}
                            alt={`Business ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg border border-gray-200"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                setExistingImages((prev) => ({
                                  ...prev,
                                  business: prev.business.filter(
                                    (_, i) => i !== index
                                  ),
                                }));
                              }}
                              className="opacity-0 group-hover:opacity-100 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 transition-all transform scale-0 group-hover:scale-100"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                            Existing
                          </div>
                        </div>
                      ))}

                      {/* New Business Images */}
                      {businessImages.map((img, index) => {
                        const objectUrl = URL.createObjectURL(img);
                        return (
                          <div
                            key={`new-business-${index}`}
                            className="relative group"
                          >
                            <img
                              src={objectUrl}
                              alt={`New Business ${index + 1}`}
                              className="w-full h-48 object-cover rounded-lg border border-gray-200"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  URL.revokeObjectURL(objectUrl);
                                  setBusinessImages((prev) =>
                                    prev.filter((_, i) => i !== index)
                                  );
                                }}
                                className="opacity-0 group-hover:opacity-100 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 transition-all transform scale-0 group-hover:scale-100"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                              New
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {existingImages.business?.length === 0 &&
                    businessImages.length === 0 && (
                      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <PhotoIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p>No business images uploaded yet</p>
                      </div>
                    )}
                </div>
              </div>
            )}
    {/* Borrower Security */}
            {activeSection === "borrowerSecurity" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
                    Borrower Security Items
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Manage security items and collateral
                  </p>
                </div>

                <div className="space-y-6">
                  {securityItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <ShieldCheckIcon className="h-5 w-5 text-blue-500 mr-2" />
                          Security Item {index + 1}
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

                      {/* Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          label="Item"
                          name="item"
                          value={item.item}
                          onChange={(e) => handleSecurityChange(e, index)}
                        />
                        <FormField
                          label="Description"
                          name="description"
                          value={item.description}
                          onChange={(e) => handleSecurityChange(e, index)}
                        />
                        <FormField
                          label="Identification"
                          name="identification"
                          value={item.identification}
                          onChange={(e) => handleSecurityChange(e, index)}
                          placeholder="e.g. Serial No."
                        />
                        <FormField
                          label="Est. Market Value (KES)"
                          name="value"
                          type="number"
                          value={item.value}
                          onChange={(e) => handleSecurityChange(e, index)}
                        />
                      </div>

                      {/* Security Item Images */}
                      <div className="mt-6">
                        <label className="block text-sm font-medium mb-2 text-gray-800">
                          Item Images
                        </label>
                        <div className="flex gap-3 mb-3">
                          {/* Upload */}
                          <label className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-200 transition">
                            <Upload className="w-5 h-5" />
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files);
                                const newImages = [
                                  ...(securityItemImages[index] || []),
                                  ...files,
                                ];
                                const updated = [...securityItemImages];
                                updated[index] = newImages;
                                setSecurityItemImages(updated);
                              }}
                              className="hidden"
                            />
                          </label>

                          {/* Camera */}
                          <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition">
                            <Camera className="w-5 h-5" />
                            Camera
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files);
                                const newImages = [
                                  ...(securityItemImages[index] || []),
                                  ...files,
                                ];
                                const updated = [...securityItemImages];
                                updated[index] = newImages;
                                setSecurityItemImages(updated);
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Preview */}
                        {securityItemImages[index] &&
                          securityItemImages[index].length > 0 && (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              {securityItemImages[index].map(
                                (img, imgIndex) => (
                                  <div key={imgIndex} className="relative">
                                    <img
                                      src={
                                        typeof img === "string"
                                          ? img
                                          : URL.createObjectURL(img)
                                      }
                                      alt={`Security ${index + 1} - Image ${
                                        imgIndex + 1
                                      }`}
                                      className="w-full h-28 object-cover rounded-lg border border-gray-300"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...securityItemImages];
                                        updated[index] = updated[index].filter(
                                          (_, i) => i !== imgIndex
                                        );
                                        setSecurityItemImages(updated);
                                      }}
                                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow"
                                    >
                                      <XIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addSecurityItem}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-300 text-slate-600 rounded-lg hover:bg-blue-500
 transition-all shadow-md hover:shadow-lg"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Add Security Item
                  </button>
                </div>
              </div>
            )}

            {/* Loan Details */}
            {activeSection === "loan" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
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
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
                    Guarantor Information
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Update guarantor personal details
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField
                    label="Prefix"
                    name="prefix"
                    value={formData.guarantor.prefix}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                    options={["Mr", "Mrs", "Ms", "Dr"]}
                  />
                  <FormField
                    label="First Name"
                    name="Firstname"
                    value={formData.guarantor.Firstname}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
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
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="ID Number"
                    name="idNumber"
                    value={formData.guarantor.idNumber}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="Mobile Number"
                    name="mobile"
                    value={formData.guarantor.mobile}
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
                  />
                  <FormField
                    label="Gender"
                    name="gender"
                    value={formData.guarantor.gender}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                    options={["Male", "Female"]}
                  />
                  <FormField
                    label="Marital Status"
                    name="maritalStatus"
                    value={formData.guarantor.maritalStatus}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                    options={[
                      "Single",
                      "Married",
                      "Separated/Divorced",
                      "Other",
                    ]}
                  />
                  <FormField
                    label="Residence Status"
                    name="residenceStatus"
                    value={formData.guarantor.residenceStatus}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                    options={["Own", "Rent", "Family", "Other"]}
                  />
                  <FormField
                    label="Occupation"
                    name="occupation"
                    value={formData.guarantor.occupation}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="Relationship"
                    name="relationship"
                    value={formData.guarantor.relationship}
                    section="guarantor"
                    handleNestedChange={handleNestedChange}
                    placeholder="e.g. Spouse, Friend"
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
                    label="County"
                    name="county"
                    value={formData.guarantor.county}
                    section="guarantor"
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

                {/* Guarantor Documents */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">
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
                          <file.icon className="h-6 w-6 text-indigo-600" />
                          <h4 className="text-md font-medium text-gray-900">
                            {file.label}
                          </h4>
                        </div>

                        <div className="flex gap-2 mb-3">
                          {/* Upload button */}
                          <label className="flex items-center justify-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded cursor-pointer hover:bg-indigo-200">
                            <Upload size={16} />
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleFileUpload(e, file.handler, file.key)
                              }
                              className="hidden"
                            />
                          </label>

                          {/* Camera button */}
                          <label className="flex items-center justify-center gap-1 px-3 py-1 bg-blue-300 text-slate-600 rounded cursor-pointer hover:bg-blue-500">
                            <Camera size={16} />
                            Camera
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

                        {/* Preview Section */}
                        {(file.preview || file.existing) && (
                          <div className="relative">
                            <img
                              src={file.preview || file.existing}
                              alt={file.label}
                              className="w-full h-32 object-contain border rounded"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveFile(file.key, file.handler)
                              }
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow"
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
            )}

         {/* Guarantor Security */}
{activeSection === "guarantorSecurity" && (
  <div className="space-y-8">
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
        <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
        Guarantor Security Items
      </h2>
      <p className="text-gray-600 mt-2">
        Manage guarantor security and collateral
      </p>
    </div>

    <div className="space-y-6">
      {guarantorSecurityItems.map((item, index) => (
        <div
          key={index}
          className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
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

          {/* Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Item"
              name="item"
              value={item.item}
              onChange={(e) => {
                const newItems = [...guarantorSecurityItems];
                newItems[index][e.target.name] = e.target.value;
                setGuarantorSecurityItems(newItems);
              }}
            />
            <FormField
              label="Description"
              name="description"
              value={item.description}
              onChange={(e) => {
                const newItems = [...guarantorSecurityItems];
                newItems[index][e.target.name] = e.target.value;
                setGuarantorSecurityItems(newItems);
              }}
            />
            <FormField
              label="Identification"
              name="identification"
              value={item.identification}
              onChange={(e) => {
                const newItems = [...guarantorSecurityItems];
                newItems[index][e.target.name] = e.target.value;
                setGuarantorSecurityItems(newItems);
              }}
              placeholder="e.g. Serial No."
            />
            <FormField
              label="Est. Market Value (KES)"
              name="value"
              type="number"
              value={item.value}
              onChange={(e) => {
                const newItems = [...guarantorSecurityItems];
                newItems[index][e.target.name] = e.target.value;
                setGuarantorSecurityItems(newItems);
              }}
            />
          </div>

          {/* Guarantor Security Item Images */}
          <div className="mt-6">
            <label className="block text-sm font-medium mb-2 text-gray-800">
              Item Images
            </label>
            <div className="flex gap-3 mb-3">
              {/* Upload */}
              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-500 rounded-lg cursor-pointer hover:bg-purple-200 transition">
                <Upload className="w-5 h-5" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    const newImages = [
                      ...(guarantorSecurityImages[index] || []),
                      ...files,
                    ];
                    const updated = [...guarantorSecurityImages];
                    updated[index] = newImages;
                    setGuarantorSecurityImages(updated);
                  }}
                  className="hidden"
                />
              </label>

              {/* Camera */}
              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition">
                <Camera className="w-5 h-5" />
                Camera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    const newImages = [
                      ...(guarantorSecurityImages[index] || []),
                      ...files,
                    ];
                    const updated = [...guarantorSecurityImages];
                    updated[index] = newImages;
                    setGuarantorSecurityImages(updated);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Display existing guarantor security images for this item */}
            {existingImages.guarantorSecurity?.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium mb-2 text-gray-700">
                  Existing Images:
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {existingImages.guarantorSecurity.map((img, imgIndex) => (
                    <div key={`existing-guarantor-${imgIndex}`} className="relative group">
                      <img
                        src={img}
                        alt={`Guarantor Security ${imgIndex + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-300"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setExistingImages((prev) => ({
                              ...prev,
                              guarantorSecurity: prev.guarantorSecurity.filter(
                                (_, i) => i !== imgIndex
                              ),
                            }));
                          }}
                          className="opacity-0 group-hover:opacity-100 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-all transform scale-0 group-hover:scale-100"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview new guarantor security images */}
            {guarantorSecurityImages[index] && guarantorSecurityImages[index].length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2 text-gray-700">
                  New Images:
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {guarantorSecurityImages[index].map((img, imgIndex) => (
                    <div key={`new-guarantor-${index}-${imgIndex}`} className="relative group">
                      <img
                        src={typeof img === "string" ? img : URL.createObjectURL(img)}
                        alt={`Guarantor Security ${index + 1} - Image ${imgIndex + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-300"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...guarantorSecurityImages];
                            updated[index] = updated[index].filter(
                              (_, i) => i !== imgIndex
                            );
                            setGuarantorSecurityImages(updated);
                          }}
                          className="opacity-0 group-hover:opacity-100 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-all transform scale-0 group-hover:scale-100"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          const newItem = {
            item: "",
            description: "",
            identification: "",
            value: "",
          };
          setGuarantorSecurityItems((prev) => [...prev, newItem]);
          setGuarantorSecurityImages((prev) => [...prev, []]);
        }}
        className="flex items-center gap-2 px-6 py-3 bg-blue-300  text-slate-600 rounded-lg hover:bg-blue-500 transition-all shadow-md hover:shadow-lg"
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
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
                    Next of Kin Information
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Enter next of kin details
                  </p>
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
                    label="Relationship"
                    name="relationship"
                    value={formData.nextOfKin.relationship}
                    section="nextOfKin"
                    placeholder="e.g. Brother, Sister"
                    handleNestedChange={handleNestedChange}
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
                    errors={errors}
                  />
                  <FormField
                    label="Employment Status"
                    name="employmentStatus"
                    value={formData.nextOfKin.employmentStatus}
                    section="nextOfKin"
                    options={[
                      "Employed",
                      "Self Employed",
                      "Unemployed",
                      "Student",
                      "Retired",
                    ]}
                    handleNestedChange={handleNestedChange}
                  />
                  <FormField
                    label="County"
                    name="county"
                    value={formData.nextOfKin.county}
                    section="nextOfKin"
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

                  {/* Documents Verification */}
{activeSection === "documents" && (
  <div className="space-y-8">
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
        <DocumentTextIcon className="h-8 w-8 text-indigo-600 mr-3" />
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
          {/* Label */}
          <label className="block text-sm font-medium text-blue-800 mb-3">
            {file.label}
          </label>

          {/* Upload / Camera buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg shadow-sm cursor-pointer hover:bg-blue-200 transition">
              <ArrowUpTrayIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                className="hidden"
              />
            </label>

            <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-slate-600 rounded-lg shadow-sm cursor-pointer hover:bg-blue-500 transition">
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

          {/* Preview */}
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
)}

  {/* Action Buttons */}
<div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-200">
  {/* Left Side: Previous Button */}
  <div>
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
  </div>

  {/* Right Side: Next/Submit + Save as Draft Buttons */}
  <div className="flex items-center gap-4">
    {/* Save as Draft Button */}
    <button
      type="button"
      onClick={handleSaveDraft}
      disabled={isSavingDraft || isSubmitting}
      className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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

    {/* Next or Submit Button */}
    {activeSection !== sections[sections.length - 1].id ? (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault(); //  Prevent any accidental form submission
          const currentIndex = sections.findIndex((s) => s.id === activeSection);
          const nextIndex = currentIndex + 1;
          if (nextIndex < sections.length) {
            setActiveSection(sections[nextIndex].id);
          }
        }}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        disabled={isSubmitting || isSavingDraft}
      >
        Next
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    ) : (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          handleSubmit(e); 
        }}
        disabled={isSubmitting || isSavingDraft}
        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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