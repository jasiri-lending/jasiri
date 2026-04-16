import { useState, memo, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";
import {
  UserCircleIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  IdentificationIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  CameraIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/userAuth";
import { useTenantFeatures } from "../../hooks/useTenantFeatures";
import { useToast } from "../../components/Toast";
import { checkUniqueValue } from "../../utils/Unique";
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
    index,
  }) => {
    let errorMessage = '';

    // Handle different error key formats
    if (index !== undefined && index !== null) {
      errorMessage = errors[`security_${name}_${index}`] || errors[`guarantor_security_${name}_${index}`];
    } else if (section) {
      // For nested fields like spouse, guarantor, nextOfKin
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
            onChange={section ? (e) => handleNestedChange(e, section) : onChange}
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
            onChange={section ? (e) => handleNestedChange(e, section) : onChange}
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

FormField.displayName = 'FormField';

const CustomerDraft = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const customerId = draftId;
  const [activeSection, setActiveSection] = useState("personal");
  const [completedSections, setCompletedSections] = useState(new Set());
  const { profile } = useAuth();
  const { documentUploadEnabled, imageUploadEnabled } = useTenantFeatures();

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
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
    businessCounty: '',
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

  const [securityItems, setSecurityItems] = useState([{
    type: '',
    description: '',
    value: '',
    otherType: '',
    identification: ''
  }]);

  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([
    {
      type: '',
      description: '',
      identification: '',
      value: '',
      otherType: ''
    },
  ]);

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
  const [previews, setPreviews] = useState({
    passport: null,
    idFront: null,
    idBack: null,
    houseImage: null,
    guarantorPassport: null,
    guarantorIdFront: null,
    guarantorIdBack: null,
    officerClient1: null,
    officerClient2: null,
    bothOfficers: null,
    business: [],
  });
  const [uploadedFiles, setUploadedFiles] = useState(new Set());

  useEffect(() => {
    if (customerId) {
      loadCustomerData(customerId);
    }
  }, [customerId]);

  const loadCustomerData = async (id) => {
    try {
      setIsLoading(true);
      console.log("Loading full customer data for ID:", id);

      const [
        { data: customer },
        { data: guarantorsData },
        { data: nextOfKinData },
        { data: spouseData },
        { data: securityItemsData },
        { data: businessImagesData },
        { data: documentsData },
      ] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).single(),
        supabase.from("guarantors").select("*").eq("customer_id", id),
        supabase.from("next_of_kin").select("*").eq("customer_id", id),
        supabase.from("spouse").select("*").eq("customer_id", id),
        supabase.from("security_items").select("*, security_item_images(image_url)").eq("customer_id", id),
        supabase.from("business_images").select("*").eq("customer_id", id),
        supabase.from("documents").select("id, document_type, document_url").eq("customer_id", id),
      ]);

      const spouse = spouseData?.[0] || null;

      const updatedFormData = {
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
        businessCounty: customer?.business_county || "",
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
        passport_url: customer?.passport_url || null,
        id_front_url: customer?.id_front_url || null,
        id_back_url: customer?.id_back_url || null,
        house_image_url: customer?.house_image_url || null,
        businessCoordinates: customer?.business_lat && customer?.business_lng
          ? { lat: customer.business_lat, lng: customer.business_lng }
          : null,
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
        nextOfKins: nextOfKinData?.length > 0
          ? nextOfKinData.map(nok => ({
            Firstname: nok.Firstname || "",
            Surname: nok.Surname || "",
            Middlename: nok.Middlename || "",
            idNumber: nok.id_number?.toString() || "",
            relationship: nok.relationship || "",
            mobile: nok.mobile || "",
            alternativeNumber: nok.alternative_number || "",
            employmentStatus: nok.employment_status || "",
            county: nok.county || "",
            cityTown: nok.city_town || "",
            companyName: nok.company_name || "",
            salary: nok.salary?.toString() || "",
            businessName: nok.business_name || "",
            businessIncome: nok.business_income?.toString() || "",
            relationshipOther: nok.relationship_other || ""
          }))
          : [{
            Firstname: '', Surname: '', Middlename: '', idNumber: '', relationship: '',
            mobile: '', alternativeNumber: '', employmentStatus: '', county: '', cityTown: '',
            companyName: '', salary: '', businessName: '', businessIncome: '', relationshipOther: ''
          }],
        guarantors: guarantorsData?.length > 0
          ? guarantorsData.map(g => ({
            prefix: g.prefix || "",
            Firstname: g.Firstname || "",
            Surname: g.Surname || "",
            Middlename: g.Middlename || "",
            idNumber: g.id_number?.toString() || "",
            maritalStatus: g.marital_status || "",
            gender: g.gender || "",
            mobile: g.mobile || "",
            alternativeMobile: g.alternative_number || "",
            residenceStatus: g.residence_status || "",
            postalAddress: g.postal_address || "",
            code: g.code?.toString() || "",
            occupation: g.occupation || "",
            relationship: g.relationship || "",
            dateOfBirth: g.date_of_birth?.split("T")[0] || "",
            county: g.county || "",
            cityTown: g.city_town || "",
            passport_url: g.passport_url || null,
            id_front_url: g.id_front_url || null,
            id_back_url: g.id_back_url || null,
          }))
          : [{
            prefix: '', Firstname: '', Surname: '', Middlename: '', idNumber: '', maritalStatus: '',
            gender: '', mobile: '', alternativeMobile: '', residenceStatus: '', postalAddress: '',
            code: '', occupation: '', relationship: '', dateOfBirth: '', county: '', cityTown: ''
          }]
      };

      setFormData(updatedFormData);
      console.log("Form data set with spouse and nextOfKin:", updatedFormData);

      const SECURITY_TYPE_OPTIONS = [
        "Household Items", "Business Equipment", "Livestock", "Motor Vehicle",
        "Motorbike", "Land / Property", "Title deed", "Logbook",
        "Salary Check-off", "Stock / Inventory", "Fixed deposit / Savings security",
        "Electronics"
      ];

      let processedSecurityItems = securityItemsData?.map((item) => {
        const isStandardType = SECURITY_TYPE_OPTIONS.includes(item.item);
        return {
          id: item.id,
          type: isStandardType ? item.item : (item.item ? "Other" : ""),
          otherType: isStandardType ? "" : (item.item || ""),
          description: item.description || "",
          identification: item.identification || "",
          value: item.value?.toString() || "",
        };
      }) || [];

      // Ensure at least one empty object if no records found
      if (processedSecurityItems.length === 0) {
        processedSecurityItems = [{
          type: '',
          description: '',
          identification: '',
          value: '',
          otherType: ''
        }];
      }

      setSecurityItems(processedSecurityItems);

      // Initialize empty arrays for new files; existing images handled by previews
      setSecurityItemImages(processedSecurityItems.map(() => []));

      let guarantorSecurityData = [];
      if (guarantor?.id) {
        const { data } = await supabase
          .from("guarantor_security")
          .select("*, guarantor_security_images(image_url)")
          .eq("guarantor_id", guarantor.id);
        guarantorSecurityData = data || [];
      }

      let processedGuarantorSecurity = guarantorSecurityData?.map((item) => {
        const isStandardType = SECURITY_TYPE_OPTIONS.includes(item.item);
        return {
          id: item.id,
          type: isStandardType ? item.item : (item.item ? "Other" : ""),
          otherType: isStandardType ? "" : (item.item || ""),
          description: item.description || "",
          identification: item.identification || "",
          value: item.estimated_market_value?.toString() || "",
        };
      }) || [];

      // Ensure at least one empty object if no records found (matches initial state)
      if (processedGuarantorSecurity.length === 0) {
        processedGuarantorSecurity = [{
          type: '',
          description: '',
          identification: '',
          value: '',
          otherType: ''
        }];
      }

      setGuarantorSecurityItems(processedGuarantorSecurity);

      // Initialize empty arrays for new files; existing images handled by previews
      setGuarantorSecurityImages(processedGuarantorSecurity.map(() => []));

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
        houseImage: customer?.house_image_url ? {
          url: customer.house_image_url,
          fileName: 'house.jpg',
          isExisting: true
        } : null,
        business: businessImagesData?.map((img, index) => ({
          url: img.image_url,
          fileName: `business_${index + 1}.jpg`,
          isExisting: true
        })) || [],
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

      if (businessImagesData?.length > 0) {
        const existingBusinessImages = businessImagesData.map(img => {
          return new File([], img.image_url, { type: 'image/jpeg' });
        });
        setBusinessImages(existingBusinessImages);
      }

    } catch (error) {
      console.error("Error loading customer data:", error);
      toast("Failed to load customer data. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

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


  const handleChange = useCallback(
    async (e) => {
      const { name, value } = e.target;

      setFormData((prev) => ({ ...prev, [name]: value }));

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

  const handleNestedChange = useCallback(
    async (e, section, index = null) => {
      if (!e || !e.target) return;
      const { name, value } = e.target;

      if (index !== null) {
        setFormData((prev) => {
          const newData = [...prev[section]];
          newData[index] = { ...newData[index], [name]: value };
          return { ...prev, [section]: newData };
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          [section]: { ...prev[section], [name]: value },
        }));
      }

      const errorKey = `${section}${name.charAt(0).toUpperCase() + name.slice(1)}`;
      if (errors[errorKey]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[errorKey];
          return newErrors;
        });
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
    setFormData(prev => ({
      ...prev,
      guarantors: [...prev.guarantors, {
        prefix: '', Firstname: '', Surname: '', Middlename: '', idNumber: '', maritalStatus: '',
        gender: '', mobile: '', alternativeMobile: '', residenceStatus: '', postalAddress: '',
        code: '', occupation: '', relationship: '', dateOfBirth: '', county: '', cityTown: ''
      }]
    }));
  };

  const removeGuarantor = (index) => {
    setFormData(prev => ({
      ...prev,
      guarantors: prev.guarantors.filter((_, i) => i !== index)
    }));
  };

  const addNextOfKin = () => {
    setFormData(prev => ({
      ...prev,
      nextOfKins: [...prev.nextOfKins, {
        Firstname: '', Surname: '', Middlename: '', idNumber: '', relationship: '',
        mobile: '', alternativeNumber: '', employmentStatus: '', county: '', cityTown: '',
        companyName: '', salary: '', businessName: '', businessIncome: '', relationshipOther: ''
      }]
    }));
  };

  const removeNextOfKin = (index) => {
    setFormData(prev => ({
      ...prev,
      nextOfKins: prev.nextOfKins.filter((_, i) => i !== index)
    }));
  };

  const addGuarantorSecurityItem = () => {
    setGuarantorSecurityItems([
      ...guarantorSecurityItems,
      { type: "", description: "", identification: "", value: "", otherType: "" },
    ]);
    setGuarantorSecurityImages([...guarantorSecurityImages, []]);
  };

  const handleRemoveSecurityPreview = (sectionIndex, fileIndex) => {
    setPreviews(prev => {
      const updatedSecurity = [...(prev.security || [])];
      if (updatedSecurity[sectionIndex]) {
        const removedPreview = updatedSecurity[sectionIndex][fileIndex];
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
        if (removedPreview?.url && removedPreview.isObjectUrl) {
          URL.revokeObjectURL(removedPreview.url);
        }
        updatedGuarantorSecurity[sectionIndex] = updatedGuarantorSecurity[sectionIndex].filter((_, i) => i !== fileIndex);
      }
      return { ...prev, guarantorSecurity: updatedGuarantorSecurity };
    });
  };

  const handleSecurityChange = (e, index) => {
    const { name, value } = e.target;
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
          if (name === "type" && value !== "Other (specify)") {
            newItem.otherType = "";
          }
          return newItem;
        }
        return item;
      })
    );
  };

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
      initialQuality: 0.7,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error("Image compression error:", error);
      return file;
    }
  };

  const handleFileUpload = async (e, setter, key) => {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = null;

    if (uploadedFiles.has(file.name)) {
      toast.error("This file has already been uploaded elsewhere in the form.");
      return;
    }

    try {
      const compressedFile = await compressImage(file);
      setter(compressedFile);
      const objectUrl = URL.createObjectURL(compressedFile);

      setPreviews((prev) => ({
        ...prev,
        [key]: {
          url: objectUrl,
          fileName: file.name,
          isObjectUrl: true
        },
      }));

      setUploadedFiles((prev) => new Set(prev).add(file.name));
      console.log(`File saved for ${key}:`, compressedFile.name);
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error during file selection.");
    }
  };

  const handleRemoveFile = (key, setter) => {
    const currentPreview = previews[key];

    if (currentPreview?.url && currentPreview.isObjectUrl) {
      try {
        URL.revokeObjectURL(currentPreview.url);
      } catch (err) {
        console.warn("Failed to revoke object URL", err);
      }
    }

    if (currentPreview?.fileName && !currentPreview.isExisting) {
      setUploadedFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(currentPreview.fileName);
        return newSet;
      });
    }

    if (typeof setter === "function") {
      setter(null);
    }

    setPreviews((prev) => ({
      ...prev,
      [key]: null
    }));
  };

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

    setUploadedFiles(prev => {
      const newSet = new Set(prev);
      validFiles.forEach(f => newSet.add(f.name));
      return newSet;
    });

    setter(prev => {
      const updated = [...(prev[index] || []), ...validFiles];
      const allUpdated = [...prev];
      allUpdated[index] = updated;
      return allUpdated;
    });

    e.target.value = null;
  };

  const handleRemoveMultipleFile = (sectionIndex, fileIndex, setter) => {
    setter(prev => {
      const updatedSection = [...prev];
      const fileToRemove = updatedSection[sectionIndex]?.[fileIndex];

      if (fileToRemove) {
        setUploadedFiles(prevFiles => {
          const newSet = new Set(prevFiles);
          newSet.delete(fileToRemove.name);
          return newSet;
        });
      }

      if (updatedSection[sectionIndex]) {
        updatedSection[sectionIndex] = updatedSection[sectionIndex].filter((_, i) => i !== fileIndex);
      }

      return updatedSection;
    });
  };

  const handleBusinessImages = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => !uploadedFiles.has(file.name));

    if (validFiles.length !== files.length) {
      toast.error("Some files have already been uploaded elsewhere.");
    }

    if (validFiles.length > 0) {
      setUploadedFiles(prev => {
        const newSet = new Set(prev);
        validFiles.forEach(f => newSet.add(f.name));
        return newSet;
      });

      setBusinessImages(prev => [...prev, ...validFiles]);
    }

    e.target.value = null;
  };

  const handleRemoveBusinessPreview = (index) => {
    setPreviews(prev => {
      const updatedBusiness = [...(prev.business || [])];
      updatedBusiness.splice(index, 1);
      return { ...prev, business: updatedBusiness };
    });
  };

  const handleRemoveBusinessFile = (index) => {
    const file = businessImages[index];
    if (!file) return;

    setUploadedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(file.name);
      return newSet;
    });

    setBusinessImages(prev => prev.filter((_, i) => i !== index));
  };

  


  const validatePersonalDetails = async () => {
    const newErrors = {};
    let hasErrors = false;

    console.log("[VALIDATION] Checking Personal Details...", formData);

    if (!formData.Firstname?.trim()) {
      console.log("[VALIDATION ERROR] Firstname is missing");
      newErrors.Firstname = "First name is required";
      hasErrors = true;
    }
    if (!formData.Surname?.trim()) {
      console.log("[VALIDATION ERROR] Surname is missing");
      newErrors.Surname = "Surname is required";
      hasErrors = true;
    }
    if (!formData.mobile?.trim()) {
      console.log("[VALIDATION ERROR] Mobile is missing");
      newErrors.mobile = "Mobile number is required";
      hasErrors = true;
    }
    if (!formData.idNumber?.trim()) {
      console.log("[VALIDATION ERROR] ID Number is missing");
      newErrors.idNumber = "ID number is required";
      hasErrors = true;
    }

    if (formData.mobile && !/^[0-9]{10,15}$/.test(formData.mobile.replace(/\D/g, ""))) {
      console.log("[VALIDATION ERROR] Invalid Mobile format:", formData.mobile);
      newErrors.mobile = "Please enter a valid mobile number (10-15 digits)";
      hasErrors = true;
    }

    if (formData.idNumber && !/^[0-9]{6,12}$/.test(formData.idNumber)) {
      console.log("[VALIDATION ERROR] Invalid ID Number format:", formData.idNumber);
      newErrors.idNumber = "Please enter a valid ID number (6-12 digits)";
      hasErrors = true;
    }

    if (formData.dateOfBirth && !isAtLeast18YearsOld(formData.dateOfBirth)) {
      console.log("[VALIDATION ERROR] Customer age < 18:", formData.dateOfBirth);
      newErrors.dateOfBirth = "Customer must be at least 18 years old";
      hasErrors = true;
    }

    setErrors(newErrors);
    return !hasErrors;
  };

  const validateBusinessDetails = () => {
    let errorsFound = {};
    let hasErrors = false;

    console.log("[VALIDATION] Checking Business Details...", {
      businessName: formData.businessName,
      businessType: formData.businessType,
      daily_Sales: formData.daily_Sales,
      businessCoordinates: formData.businessCoordinates
    });

    if (!formData.businessName?.trim()) {
      console.log("[VALIDATION ERROR] Business Name is missing");
      errorsFound.businessName = "Business name is required";
      hasErrors = true;
    }
    if (!formData.businessType?.trim()) {
      console.log("[VALIDATION ERROR] Business Type is missing");
      errorsFound.businessType = "Business type is required";
      hasErrors = true;
    }
    if (!formData.daily_Sales) {
      console.log("[VALIDATION ERROR] Daily Sales is missing");
      errorsFound.daily_Sales = "Daily sales estimate is required";
      hasErrors = true;
    }
    if (!formData.businessCoordinates?.lat || !formData.businessCoordinates?.lng) {
      console.log("[VALIDATION ERROR] GPS Coordinates are missing");
      errorsFound.businessCoordinates = "Business GPS coordinates are required";
      hasErrors = true;
    }

    setErrors(errorsFound);
    return !hasErrors;
  };

  const validateBorrowerSecurity = () => {
    const errorsFound = {};
    let hasErrors = false;

    console.log("[VALIDATION] Checking Borrower Security...", securityItems);

    if (securityItems.length === 0) {
      console.log("[VALIDATION ERROR] No security items provided");
      errorsFound.securityItems = "At least one security item is required";
      hasErrors = true;
    }

    securityItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        console.log(`[VALIDATION ERROR] Security Item ${index} description missing`);
        errorsFound[`security_description_${index}`] = "Description is required";
        hasErrors = true;
      }
      if (!item.value || parseFloat(item.value) <= 0) {
        console.log(`[VALIDATION ERROR] Security Item ${index} value invalid:`, item.value);
        errorsFound[`security_value_${index}`] = "Estimated value must be greater than 0";
        hasErrors = true;
      }
    });

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateLoanDetails = () => {
    const errorsFound = {};
    let hasErrors = false;

    console.log("[VALIDATION] Checking Loan Details...", { prequalifiedAmount: formData.prequalifiedAmount });

    if (!formData.prequalifiedAmount) {
      console.log("[VALIDATION ERROR] Prequalified Amount is missing");
      errorsFound.prequalifiedAmount = "Pre-qualified amount is required";
      hasErrors = true;
    }

    setErrors(errorsFound);
    return !hasErrors;
  };

  const validateGuarantorDetails = async () => {
    const errorsFound = { guarantor: {} };
    let hasErrors = false;
    const { Firstname, Surname, mobile, idNumber } = formData.guarantor;

    console.log("[VALIDATION] Checking Guarantor Details...", formData.guarantor);

    if (!Firstname?.trim()) {
      console.log("[VALIDATION ERROR] Guarantor Firstname is missing");
      errorsFound.guarantor.Firstname = "Guarantor first name is required";
      hasErrors = true;
    }
    if (!Surname?.trim()) {
      console.log("[VALIDATION ERROR] Guarantor Surname is missing");
      errorsFound.guarantor.Surname = "Guarantor surname is required";
      hasErrors = true;
    }
    if (!mobile?.trim()) {
      console.log("[VALIDATION ERROR] Guarantor Mobile is missing");
      errorsFound.guarantor.mobile = "Guarantor mobile number is required";
      hasErrors = true;
    }
    if (!idNumber?.trim()) {
      console.log("[VALIDATION ERROR] Guarantor ID Number is missing");
      errorsFound.guarantor.idNumber = "Guarantor ID number is required";
      hasErrors = true;
    }

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateGuarantorSecurity = () => {
    const errorsFound = {};
    let hasErrors = false;

    console.log("[VALIDATION] Checking Guarantor Security...", guarantorSecurityItems);

    guarantorSecurityItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        console.log(`[VALIDATION ERROR] Guarantor Security Item ${index} description missing`);
        errorsFound[`guarantor_security_description_${index}`] = "Description is required";
        hasErrors = true;
      }
      if (!item.value || parseFloat(item.value) <= 0) {
        console.log(`[VALIDATION ERROR] Guarantor Security Item ${index} value invalid:`, item.value);
        errorsFound[`guarantor_security_value_${index}`] = "Estimated value must be greater than 0";
        hasErrors = true;
      }
    });

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateNextOfKinDetails = async () => {
    const errorsFound = { nextOfKin: {} };
    let hasErrors = false;
    const { Firstname, Surname, mobile, idNumber, relationship } = formData.nextOfKin;

    console.log("[VALIDATION] Checking Next of Kin Details...", formData.nextOfKin);

    if (!Firstname?.trim()) {
      console.log("[VALIDATION ERROR] NOK Firstname missing");
      errorsFound.nextOfKin.Firstname = "Next of kin first name is required";
      hasErrors = true;
    }
    if (!Surname?.trim()) {
      console.log("[VALIDATION ERROR] NOK Surname missing");
      errorsFound.nextOfKin.Surname = "Next of kin surname is required";
      hasErrors = true;
    }
    if (!mobile?.trim()) {
      console.log("[VALIDATION ERROR] NOK Mobile missing");
      errorsFound.nextOfKin.mobile = "Next of kin mobile number is required";
      hasErrors = true;
    }
    if (!idNumber?.trim()) {
      console.log("[VALIDATION ERROR] NOK ID Number missing");
      errorsFound.nextOfKin.idNumber = "Next of kin ID number is required";
      hasErrors = true;
    }
    if (!relationship?.trim()) {
      console.log("[VALIDATION ERROR] NOK Relationship missing");
      errorsFound.nextOfKin.relationship = "Relationship is required";
      hasErrors = true;
    }

    setErrors((prev) => ({ ...prev, ...errorsFound }));
    return !hasErrors;
  };

  const validateDocuments = () => {
    let errorsFound = {};
    let hasErrors = false;

    console.log("[VALIDATION] Checking Documents...", {
      documentUploadEnabled,
      officerClientImage1,
      officerClientImage2,
      bothOfficersImage
    });

    if (documentUploadEnabled) {
      if (!officerClientImage1 && !previews.officerClient1) {
        console.log("[VALIDATION ERROR] officerClientImage1 missing (both state and preview)");
        errorsFound.officerClientImage1 = "First Officer and Client Image is required";
        hasErrors = true;
      }
      if (!officerClientImage2 && !previews.officerClient2) {
        console.log("[VALIDATION ERROR] officerClientImage2 missing (both state and preview)");
        errorsFound.officerClientImage2 = "Second Officer and Client Image is required";
        hasErrors = true;
      }
      if (!bothOfficersImage && !previews.bothOfficers) {
        console.log("[VALIDATION ERROR] bothOfficersImage missing (both state and preview)");
        errorsFound.bothOfficersImage = "Both Officers Image is required";
        hasErrors = true;
      }
    }

    setErrors(errorsFound);
    return !hasErrors;
  };

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
        toast.error("Please fix the highlighted errors before continuing.");
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
      }
    } finally {
      setIsValidating(false);
    }
  };

  const validateForm = async () => {
    console.log("[VALIDATION] Starting Full Form Validation...");
    const personalValid = await validatePersonalDetails();
    console.log("[VALIDATION RESULT] Personal Details:", personalValid);
    
    const businessValid = validateBusinessDetails();
    console.log("[VALIDATION RESULT] Business Details:", businessValid);
    
    const borrowerSecurityValid = validateBorrowerSecurity();
    console.log("[VALIDATION RESULT] Borrower Security:", borrowerSecurityValid);
    
    const loanValid = validateLoanDetails();
    console.log("[VALIDATION RESULT] Loan Details:", loanValid);
    
    const guarantorValid = await validateGuarantorDetails();
    console.log("[VALIDATION RESULT] Guarantor Details:", guarantorValid);
    
    const guarantorSecurityValid = validateGuarantorSecurity();
    console.log("[VALIDATION RESULT] Guarantor Security:", guarantorSecurityValid);
    
    const nextOfKinValid = await validateNextOfKinDetails();
    console.log("[VALIDATION RESULT] Next of Kin:", nextOfKinValid);
    
    const documentsValid = validateDocuments();
    console.log("[VALIDATION RESULT] Documents:", documentsValid);

    const isAllValid = (
      personalValid &&
      businessValid &&
      borrowerSecurityValid &&
      loanValid &&
      guarantorValid &&
      guarantorSecurityValid &&
      nextOfKinValid &&
      documentsValid
    );

    console.log("[VALIDATION FINAL RESULT]", isAllValid);
    return isAllValid;
  };

  const uploadFile = async (file, path, bucket = "customers") => {
    if (!file) return null;
    try {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const uploadFilesBatch = async (files, pathPrefix, bucket = "customers") => {
    if (!files || files.length === 0) return [];
    const uploadPromises = files.map(async (file) => {
      const path = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
      return uploadFile(file, path, bucket);
    });
    const urls = await Promise.all(uploadPromises);
    return urls.filter(Boolean);
  };

  const insertSecurityItemsOptimized = async (items, images, ownerId, isGuarantor) => {
    if (!items?.length) return;
    const table = isGuarantor ? "guarantor_security" : "security_items";
    const ownerKey = isGuarantor ? "guarantor_id" : "customer_id";
    const valueKey = isGuarantor ? "estimated_market_value" : "value";

    const itemsToInsert = items.map((s) => ({
      [ownerKey]: ownerId,
      item: s.type === "Other" ? s.otherType : (s.type || s.item || null),
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
    if (secError || !insertedItems?.length) return;

    const allImageUploads = insertedItems.flatMap((item, index) => {
      const itemImages = images[index] || [];
      return itemImages.map(async (file) => {
        const filePath = `${isGuarantor ? "guarantor_security" : "borrower_security"}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
        const url = await uploadFile(file, filePath);
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
    if (imageRecords.length) {
      const imageTable = isGuarantor ? "guarantor_security_images" : "security_item_images";
      await supabase.from(imageTable).insert(imageRecords);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    
    // Guard: Prevent submission if not on the final section (helps with double-clicks/misfires)
    const lastSectionId = sections[sections.length - 1].id;
    if (activeSection !== lastSectionId) {
      console.warn("Submit triggered while not on the final section. Ignoring.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isValid = await validateForm();
      if (!isValid) {
        toast.error("Please fix all validation errors before submitting.");
        setIsSubmitting(false);
        return;
      }

      const timestamp = Date.now();
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
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : formData.passport_url,
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : formData.id_front_url,
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : formData.id_front_url, // Fixed typo in key
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : formData.house_image_url,
        guarantorPassportFile ? uploadFile(guarantorPassportFile, `guarantor/${timestamp}_passport_${guarantorPassportFile.name}`) : formData?.guarantors?.[0]?.passport_url,
        guarantorIdFrontFile ? uploadFile(guarantorIdFrontFile, `guarantor/${timestamp}_id_front_${guarantorIdFrontFile.name}`) : formData?.guarantors?.[0]?.id_front_url,
        guarantorIdBackFile ? uploadFile(guarantorIdBackFile, `guarantor/${timestamp}_id_back_${guarantorIdBackFile.name}`) : formData?.guarantors?.[0]?.id_back_url,
        businessImages.length > 0 ? uploadFilesBatch(businessImages, "business") : [],
        officerClientImage1 ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`) : null,
        officerClientImage2 ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`) : null,
        bothOfficersImage ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`) : null,
      ]);

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
        status: "bm_review",
        form_status: "submitted",
        updated_at: new Date().toISOString(),
      };

      const { error: customerError } = await supabase
        .from("customers")
        .update(customerPayload)
        .eq("id", customerId);

      if (customerError) throw customerError;

      const childOps = [
        insertSecurityItemsOptimized(securityItems, securityItemImages, customerId, false),
        insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecurityImages, customerId, true),
      ];

      // Handle Multiple Next of Kin
      if (formData.nextOfKins && formData.nextOfKins.length > 0) {
        await supabase.from("next_of_kin").delete().eq("customer_id", customerId);
        const nokPayloads = formData.nextOfKins
          .filter(nok => nok.Firstname || nok.Surname)
          .map(nok => ({
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
            salary: nok.salary || null,
            business_name: nok.businessName || null,
            business_income: nok.businessIncome || null,
            relationship_other: nok.relationshipOther || null,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }));
        if (nokPayloads.length > 0) childOps.push(supabase.from("next_of_kin").insert(nokPayloads));
      }

      // Handle Multiple Guarantors
      if (formData.guarantors && formData.guarantors.length > 0) {
        await supabase.from("guarantors").delete().eq("customer_id", customerId);
        const guarantorPayloads = formData.guarantors
          .filter(g => g.Firstname || g.Surname)
          .map((g, idx) => ({
            customer_id: customerId,
            Firstname: g?.Firstname || null,
            Surname: g?.Surname || null,
            Middlename: g?.Middlename || null,
            id_number: g?.idNumber || null,
            marital_status: g?.maritalStatus || null,
            gender: g?.gender || null,
            mobile: g?.mobile || null,
            alternative_number: g?.alternativeMobile || null,
            residence_status: g?.residenceStatus || null,
            postal_address: g?.postal_address || null,
            code: g?.code ? parseInt(g?.code) : null,
            occupation: g?.occupation || null,
            relationship: g?.relationship || null,
            date_of_birth: g?.date_of_birth || null,
            county: g?.county || null,
            city_town: g?.cityTown || null,
            passport_url: idx === 0 ? guarantorPassportUrl : g?.passport_url,
            id_front_url: idx === 0 ? guarantorIdFrontUrl : g?.id_front_url,
            id_back_url: idx === 0 ? guarantorIdBackUrl : g?.id_back_url,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }));
        if (guarantorPayloads.length > 0) childOps.push(supabase.from("guarantors").insert(guarantorPayloads));
      }

      // Handle Spouse
      if (formData.maritalStatus === "Married" && formData.spouse) {
        childOps.push(
          supabase.from("spouse").upsert({
            customer_id: customerId,
            name: formData.spouse.name || null,
            id_number: formData.spouse.idNumber || null,
            mobile: formData.spouse.mobile || null,
            economic_activity: formData.spouse.economicActivity || null,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            updated_at: new Date().toISOString()
          }, { onConflict: "customer_id" })
        );
      } else {
        childOps.push(supabase.from("spouse").delete().eq("customer_id", customerId));
      }

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

      const docs = [];
      if (officerClientUrl1) docs.push({ customer_id: customerId, document_type: "First Officer and Client Image", document_url: officerClientUrl1 });
      if (officerClientUrl2) docs.push({ customer_id: customerId, document_type: "Second Officer and Client Image", document_url: officerClientUrl2 });
      if (bothOfficersUrl) docs.push({ customer_id: customerId, document_type: "Both Officers Image", document_url: bothOfficersUrl });

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

      await Promise.all(childOps);

      toast.success("Application submitted successfully!");
      navigate("/registry/customers");
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);

    try {
      const timestamp = Date.now();
      const existingCustomerId = customerId || formData?.id || null;

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
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : formData.passport_url,
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_idfront_${idFrontFile.name}`) : formData.id_front_url,
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_idback_${idBackFile.name}`) : formData.id_back_url,
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : formData.house_image_url,
        guarantorPassportFile ? uploadFile(guarantorPassportFile, `guarantor/${timestamp}_passport_${guarantorPassportFile.name}`) : formData?.guarantors?.[0]?.passport_url,
        guarantorIdFrontFile ? uploadFile(guarantorIdFrontFile, `guarantor/${timestamp}_idfront_${guarantorIdFrontFile.name}`) : formData?.guarantors?.[0]?.id_front_url,
        guarantorIdBackFile ? uploadFile(guarantorIdBackFile, `guarantor/${timestamp}_idback_${guarantorIdBackFile.name}`) : formData?.guarantors?.[0]?.id_back_url,
        businessImages?.length > 0 ? uploadFilesBatch(businessImages, "business") : [],
        officerClientImage1 ? uploadFile(officerClientImage1, `documents/${timestamp}_officer1_${officerClientImage1.name}`) : null,
        officerClientImage2 ? uploadFile(officerClientImage2, `documents/${timestamp}_officer2_${officerClientImage2.name}`) : null,
        bothOfficersImage ? uploadFile(bothOfficersImage, `documents/${timestamp}_both_${bothOfficersImage.name}`) : null,
      ]);

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
        business_county: formData.businessCounty || null,
        business_name: formData.businessName || null,
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
        updated_at: new Date().toISOString(),
        created_by: profile?.id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        ...(existingCustomerId ? {} : { created_at: new Date().toISOString() })
      };

      const { data: customerData, error: customerError } = existingCustomerId 
        ? await supabase.from("customers").update(customerPayload).eq("id", existingCustomerId).select("id").single()
        : await supabase.from("customers").insert(customerPayload).select("id").single();

      if (customerError) throw customerError;

      const currentCustomerId = existingCustomerId || customerData.id;
      const childOps = [];

      // Handle Multiple Next of Kin for Draft
      if (formData.nextOfKins && formData.nextOfKins.length > 0) {
        await supabase.from("next_of_kin").delete().eq("customer_id", currentCustomerId);
        const nokPayloads = formData.nextOfKins
          .filter(nok => nok.Firstname || nok.Surname)
          .map(nok => ({
            customer_id: currentCustomerId,
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
            salary: nok.salary || null,
            business_name: nok.businessName || null,
            business_income: nok.businessIncome || null,
            relationship_other: nok.relationshipOther || null,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }));
        if (nokPayloads.length > 0) childOps.push(supabase.from("next_of_kin").insert(nokPayloads));
      }

      // Handle Multiple Guarantors for Draft
      if (formData.guarantors && formData.guarantors.length > 0) {
        await supabase.from("guarantors").delete().eq("customer_id", currentCustomerId);
        const guarantorPayloads = formData.guarantors
          .filter(g => g.Firstname || g.Surname)
          .map((g, idx) => ({
            customer_id: currentCustomerId,
            Firstname: g?.Firstname || null,
            Surname: g?.Surname || null,
            Middlename: g?.Middlename || null,
            id_number: g?.idNumber || null,
            marital_status: g?.maritalStatus || null,
            gender: g?.gender || null,
            mobile: g?.mobile || null,
            alternative_number: g?.alternativeMobile || null,
            residence_status: g?.residenceStatus || null,
            postal_address: g?.postalAddress || null,
            code: g?.code ? parseInt(g?.code) : null,
            occupation: g?.occupation || null,
            relationship: g?.relationship || null,
            date_of_birth: g?.dateOfBirth || null,
            county: g?.county || null,
            city_town: g?.cityTown || null,
            passport_url: idx === 0 ? guarantorPassportUrl : g?.passport_url,
            id_front_url: idx === 0 ? guarantorIdFrontUrl : g?.id_front_url,
            id_back_url: idx === 0 ? guarantorIdBackUrl : g?.id_back_url,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }));
        if (guarantorPayloads.length > 0) childOps.push(supabase.from("guarantors").insert(guarantorPayloads));
      }

      if (formData.spouse && Object.values(formData.spouse).some(Boolean)) {
        childOps.push(
          supabase.from("spouse").upsert(
            {
              customer_id: currentCustomerId,
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

      if (formData.nextOfKins && formData.nextOfKins.length > 0) {
        // Delete existing and insert new for clean draft update
        await supabase.from("next_of_kin").delete().eq("customer_id", currentCustomerId);
        
        const nokPayloads = formData.nextOfKins
          .filter(nok => nok.Firstname || nok.Surname)
          .map(nok => ({
            customer_id: currentCustomerId,
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
            salary: nok.salary || null,
            business_name: nok.businessName || null,
            business_income: nok.businessIncome || null,
            relationship_other: nok.relationshipOther || null,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }));
          
        if (nokPayloads.length > 0) {
          childOps.push(supabase.from("next_of_kin").insert(nokPayloads));
        }
      }

      if (formData.guarantors && formData.guarantors.length > 0) {
        // Delete existing and insert new
        await supabase.from("guarantors").delete().eq("customer_id", currentCustomerId);

        const guarantorPayloads = formData.guarantors
          .filter(g => g.Firstname || g.Surname)
          .map(g => ({
            customer_id: currentCustomerId,
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
            passport_url: guarantorPassportUrl, // Note: This might need array support for images later if multiple guarantors have different images
            id_front_url: guarantorIdFrontUrl,
            id_back_url: guarantorIdBackUrl,
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString()
          }));

        if (guarantorPayloads.length > 0) {
          childOps.push(supabase.from("guarantors").insert(guarantorPayloads));
        }
      }

      const docs = [];
      if (officerClientUrl1) docs.push({ customer_id: currentCustomerId, document_type: "First Officer and Client Image", document_url: officerClientUrl1 });
      if (officerClientUrl2) docs.push({ customer_id: currentCustomerId, document_type: "Second Officer and Client Image", document_url: officerClientUrl2 });
      if (bothOfficersUrl) docs.push({ customer_id: currentCustomerId, document_type: "Both Officers Image", document_url: bothOfficersUrl });

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

      if (businessUrls?.length > 0) {
        childOps.push(
          supabase.from("business_images").insert(
            businessUrls.map(url => ({
              customer_id: currentCustomerId,
              image_url: url,
              created_by: profile?.id,
              branch_id: profile?.branch_id,
              region_id: profile?.region_id,
              created_at: new Date().toISOString()
            }))
          )
        );
      }
      await Promise.all([
        insertSecurityItemsOptimized(securityItems, securityItemImages, currentCustomerId, false),
        insertSecurityItemsOptimized(guarantorSecurityItems, guarantorSecurityImages, currentCustomerId, true),
        ...childOps
      ]);

      // Ensure spouse information is saved synchronously if it was omitted from childOps or needs cleanup
      if (formData.maritalStatus === 'Married' && formData.spouse) {
        await supabase.from("spouse").upsert({
          customer_id: currentCustomerId,
          name: formData.spouse.name || null,
          id_number: formData.spouse.idNumber || null,
          mobile: formData.spouse.mobile || null,
          economic_activity: formData.spouse.economicActivity || null,
          created_by: profile?.id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          updated_at: new Date().toISOString()
        }, { onConflict: "customer_id" });
      } else {
        await supabase.from("spouse").delete().eq("customer_id", currentCustomerId);
      }

      toast.success("Draft saved successfully!");
      navigate("/registry/customers")
    } catch (err) {
      console.error("DRAFT ERROR:", err);
      toast.error("Failed to save draft. Please try again.");
    } finally {
      setIsSavingDraft(false);
    }
  };


  const renderPersonalSection = () => (
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
        <FormField label="Prefix" name="prefix" value={formData.prefix} onChange={handleChange} options={["Mr", "Mrs", "Ms", "Dr"]} handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="First Name" name="Firstname" value={formData.Firstname} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Middle Name" name="Middlename" value={formData.Middlename} onChange={handleChange} handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Surname" name="Surname" value={formData.Surname} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Mobile Number" name="mobile" value={formData.mobile} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Alternative Mobile" name="alternativeMobile" value={formData.alternativeMobile} onChange={handleChange} handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="ID Number" name="idNumber" value={formData.idNumber} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Date of Birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Gender" name="gender" value={formData.gender} onChange={handleChange} options={["Male", "Female"]} handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Marital Status" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} options={["Single", "Married", "Separated/Divorced", "Other"]} handleNestedChange={handleNestedChange} errors={errors} />

        {formData.maritalStatus === "Married" && (
          <>
            <FormField label="Spouse Name" name="name" value={formData.spouse?.name || ''} section="spouse" required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Spouse ID Number" name="idNumber" value={formData.spouse?.idNumber || ''} section="spouse" required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Spouse Mobile" name="mobile" value={formData.spouse?.mobile || ''} section="spouse" required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Spouse Economic Activity" name="economicActivity" value={formData.spouse?.economicActivity || ''} section="spouse" required handleNestedChange={handleNestedChange} errors={errors} />
          </>
        )}

        <FormField label="Residence Status" name="residenceStatus" value={formData.residenceStatus} onChange={handleChange} options={["Own", "Rent", "Family", "Other"]} errors={errors} />
        <FormField label="Occupation" name="occupation" value={formData.occupation} onChange={handleChange} handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Postal Address" name="postalAddress" value={formData.postalAddress} onChange={handleChange} handleNestedChange={handleNestedChange} />
        <FormField label="Postal Code" name="code" type="number" value={formData.code} onChange={handleChange} handleNestedChange={handleNestedChange} />
        <FormField label="County" name="county" value={formData.county} onChange={handleChange} options={KENYA_COUNTIES} handleNestedChange={handleNestedChange} />
        <FormField label="Town/City" name="town" value={formData.town} onChange={handleChange} handleNestedChange={handleNestedChange} />
      </div>

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
  );

  const renderBusinessSection = () => (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-lg font-semibold text-text flex items-center">
          <BuildingOffice2Icon className="h-8 w-8 text-brand-primary mr-3" />
          Business Information
        </h2>
        <p className="text-muted mt-2">Enter business details and operations information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FormField label="Business Name" name="businessName" value={formData.businessName} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Business Type" name="businessType" value={formData.businessType} onChange={handleChange} placeholder="e.g. Retail, Wholesale" required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Year Established" name="yearEstablished" type="date" value={formData.yearEstablished} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Daily Sales (KES)" name="daily_Sales" type="number" value={formData.daily_Sales} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="County" name="businessCounty" value={formData.businessCounty} onChange={handleChange} options={KENYA_COUNTIES} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Business Location" name="businessLocation" value={formData.businessLocation} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Road" name="road" value={formData.road} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Landmark" name="landmark" value={formData.landmark} onChange={handleChange} placeholder="e.g. Near KCB Bank" required handleNestedChange={handleNestedChange} errors={errors} />
        <FormField label="Local Authority License" name="hasLocalAuthorityLicense" value={formData.hasLocalAuthorityLicense} onChange={handleChange} options={["Yes", "No"]} handleNestedChange={handleNestedChange} errors={errors} />
      </div>

      <div className="mt-8">
        <LocationPicker onChange={handleLocationChange} value={formData.businessCoordinates} county={formData.businessCounty} />
      </div>

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

          {(previews.business.length > 0 || businessImages.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Existing Images */}
              {previews.business.map((preview, index) => (
                <div key={`existing-${index}`} className="relative group rounded-xl overflow-hidden border border-gray-200">
                  <img src={preview.url} alt="Business" className="w-full h-32 object-cover" />
                  <button type="button" onClick={() => handleRemoveBusinessPreview(index)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white px-2 py-1 text-[10px] truncate">
                    Existing Image
                  </div>
                </div>
              ))}
              {/* New Images */}
              {businessImages.map((file, idx) => (
                <div key={`new-${idx}`} className="relative group rounded-xl overflow-hidden border border-gray-200">
                  <img src={URL.createObjectURL(file)} alt="Business" className="w-full h-32 object-cover" />
                  <button type="button" onClick={() => handleRemoveBusinessFile(idx)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderBorrowerSecuritySection = () => (
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
        <p className="text-muted mt-2">Add security type, description and estimated market value</p>
      </div>

      <div className="space-y-6">
        {securityItems.map((item, index) => (
          <div key={index} className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text flex items-center">
                <ShieldCheckIcon className="h-5 w-5 text-brand-primary mr-2" />
                Security {index + 1}
              </h3>
              {securityItems.length > 1 && (
                <button type="button" onClick={() => removeSecurityItem(index)} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50">
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600">Security Type</label>
                <select name="type" value={item.type} onChange={(e) => handleSecurityChange(e, index)} className="w-full border border-gray-300 rounded-lg p-2" required>
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
                  <option value="Fixed deposit / Savings security">Fixed deposit / Savings security</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Other">Other (specify)</option>
                </select>
              </div>

              {item.type === "Other" && (
                <FormField label="Specify Other Security" name="otherType" value={item.otherType || ""} onChange={(e) => handleSecurityChange(e, index)} required />
              )}

              <FormField label="Identification (e.g. Serial No/Reg No)" name="identification" value={item.identification} onChange={(e) => handleSecurityChange(e, index)} required />
              <FormField label="Description" name="description" value={item.description} onChange={(e) => handleSecurityChange(e, index)} required />
              <FormField label="Est. Market Value (KES)" name="value" type="number" value={item.value} onChange={(e) => handleSecurityChange(e, index)} required />
            </div>

            {imageUploadEnabled && (
              <div className="mt-10 pt-8 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-brand-primary mb-6 flex items-center gap-2">
                  <CameraIcon className="w-5 h-5" />
                  Security Images
                </h3>
                <div className="flex gap-4 mb-6">
                  <label className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary rounded-xl cursor-pointer hover:bg-brand-secondary/20 transition font-medium border border-brand-surface shadow-sm">
                    <ArrowUpTrayIcon className="w-5 h-5" />
                    Add Images
                    <input type="file" accept="image/*" multiple onChange={(e) => handleMultipleFiles(e, index, setSecurityItemImages)} className="hidden" />
                  </label>
                </div>

                {((securityItemImages[index] && securityItemImages[index].length > 0) || (previews.security?.[index] && previews.security[index].length > 0)) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {/* Existing Images */}
                    {previews.security?.[index]?.map((img, imgIdx) => (
                      <div key={`existing-${imgIdx}`} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <img src={img.url} alt="Security" className="w-full h-32 object-cover" />
                        <button type="button" onClick={() => handleRemoveSecurityPreview(index, imgIdx)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-md">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white px-2 py-1 text-[10px] truncate">
                          Existing Image
                        </div>
                      </div>
                    ))}
                    {/* New Images */}
                    {securityItemImages[index]?.map((file, fileIdx) => (
                      <div key={`new-${fileIdx}`} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <img src={URL.createObjectURL(file)} alt="Security" className="w-full h-32 object-cover" />
                        <button type="button" onClick={() => handleRemoveMultipleFile(index, fileIdx, setSecurityItemImages)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition duration-200">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
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
            Add Another Security Item
          </button>
        </div>
      </div>
    </div>
  );

  const renderLoanSection = () => (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-lg font-semibold text-text flex items-center">
          <CurrencyDollarIcon className="h-8 w-8 text-brand-primary mr-3" />
          Loan Information
        </h2>
        <p className="text-muted mt-2">Set loan amount and terms</p>
      </div>
      <div className="bg-brand-surface rounded-xl p-8 border border-brand-surface shadow-sm">
        <div className="max-w-md mx-auto">
          <FormField label="Pre-qualified Amount (KES)" name="prequalifiedAmount" type="number" value={formData.prequalifiedAmount} onChange={handleChange} className="text-center" required handleNestedChange={handleNestedChange} errors={errors} />
        </div>
  const renderGuarantorSection = () => (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-lg font-semibold text-text flex items-center">
          <UserGroupIcon className="h-8 w-8 text-brand-primary mr-3" />
          Guarantor Information
        </h2>
        <p className="text-muted mt-2">Enter guarantor personal details</p>
      </div>

      {formData.guarantors.map((guarantor, index) => (
        <div key={index} className="bg-brand-surface rounded-xl p-6 border border-brand-surface relative mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-md font-semibold text-brand-primary flex items-center">
              Guarantor {index + 1}
            </h3>
            {formData.guarantors.length > 1 && (
              <button type="button" onClick={() => removeGuarantor(index)} className="text-red-500 hover:text-red-700">
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField label="Prefix" name="prefix" value={guarantor.prefix} section="guarantors" index={index} options={["Mr", "Mrs", "Ms", "Dr"]} handleNestedChange={handleNestedChange} />
            <FormField label="First Name" name="Firstname" value={guarantor.Firstname} section="guarantors" index={index} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Middle Name" name="Middlename" value={guarantor.Middlename} section="guarantors" index={index} handleNestedChange={handleNestedChange} />
            <FormField label="Surname" name="Surname" value={guarantor.Surname} section="guarantors" index={index} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="ID Number" name="idNumber" value={guarantor.idNumber} section="guarantors" index={index} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Mobile Number" name="mobile" value={guarantor.mobile} section="guarantors" index={index} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Alternative Number" name="alternativeMobile" value={guarantor.alternativeMobile} section="guarantors" index={index} handleNestedChange={handleNestedChange} />
            <FormField label="Date of Birth" name="dateOfBirth" type="date" value={guarantor.dateOfBirth} section="guarantors" index={index} handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Gender" name="gender" value={guarantor.gender} section="guarantors" index={index} options={["Male", "Female"]} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Marital Status" name="maritalStatus" value={guarantor.maritalStatus} section="guarantors" index={index} options={["Single", "Married", "Separated/Divorced", "Other"]} handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Residence Status" name="residenceStatus" value={guarantor.residenceStatus} section="guarantors" index={index} options={["Own", "Rent", "Family", "Other"]} handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Occupation" name="occupation" value={guarantor.occupation} section="guarantors" index={index} handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Relationship" name="relationship" value={guarantor.relationship} section="guarantors" index={index} placeholder="e.g. Spouse, Friend" handleNestedChange={handleNestedChange} required />
            <FormField label="Postal Address" name="postalAddress" value={guarantor.postalAddress} section="guarantors" index={index} handleNestedChange={handleNestedChange} />
            <FormField label="Postal Code" name="code" type="number" value={guarantor.code} section="guarantors" index={index} handleNestedChange={handleNestedChange} />
            <FormField label="Guarantor County" name="county" value={guarantor?.county || ""} section="guarantors" index={index} options={KENYA_COUNTIES} handleNestedChange={handleNestedChange} />
            <FormField label="City/Town" name="cityTown" value={guarantor.cityTown} section="guarantors" index={index} handleNestedChange={handleNestedChange} />
          </div>

          {imageUploadEnabled && index === 0 && ( /* Keeping image uploads for the first guarantor as per current complex logic */
            <div className="mt-10 pt-8 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-brand-primary mb-6 flex items-center gap-2">
                <IdentificationIcon className="w-5 h-5" />
                Guarantor Documents (Primary)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { key: "guarantorPassport", label: "Passport Photo", handler: setGuarantorPassportFile },
                  { key: "guarantorIdFront", label: "ID Front", handler: setIdFrontFile },
                  { key: "guarantorIdBack", label: "ID Back", handler: setIdBackFile },
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
  );

  const renderGuarantorSecuritySection = () => (
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
        <p className="text-muted mt-2">Add guarantor security and collateral details</p>
      </div>

      <div className="space-y-6">
        {guarantorSecurityItems.map((item, index) => (
          <div key={index} className="bg-brand-surface rounded-xl p-6 border border-brand-surface">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-600 flex items-center">
                <ShieldCheckIcon className="h-5 w-5 text-brand-primary mr-2" />
                Guarantor Security Item {index + 1}
              </h3>
              {guarantorSecurityItems.length > 1 && (
                <button type="button" onClick={() => { setGuarantorSecurityItems((prev) => prev.filter((_, i) => i !== index)); setGuarantorSecurityImages((prev) => prev.filter((_, i) => i !== index)); }} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50">
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select name="type" value={item.type} onChange={(e) => handleGuarantorSecurityChange(e, index)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-brand-primary focus:border-brand-primary focus:outline-none" required>
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
              <FormField label="Identification (e.g. Serial No/Reg No)" name="identification" value={item.identification} onChange={(e) => handleGuarantorSecurityChange(e, index)} required errors={errors} index={index} className="mb-4" />
              <FormField label="Description" name="description" value={item.description} onChange={(e) => handleGuarantorSecurityChange(e, index)} required errors={errors} index={index} className="mb-4" />
              <FormField label="Est. Market Value (KES)" name="value" type="number" value={item.value} onChange={(e) => handleGuarantorSecurityChange(e, index)} required errors={errors} index={index} className="mb-4" />
            </div>

            {imageUploadEnabled && (
              <div className="mt-10 pt-8 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-brand-primary mb-6 flex items-center gap-2">
                  <CameraIcon className="w-5 h-5" />
                  Security Images
                </h3>
                <div className="flex gap-4 mb-6">
                  <label className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary rounded-xl cursor-pointer hover:bg-brand-secondary/20 transition font-medium border border-brand-surface shadow-sm text-sm">
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    Add Images
                    <input type="file" accept="image/*" multiple onChange={(e) => handleMultipleFiles(e, index, setGuarantorSecurityImages)} className="hidden" />
                  </label>
                </div>

                {((guarantorSecurityImages[index] && guarantorSecurityImages[index].length > 0) || (previews.guarantorSecurity?.[index] && previews.guarantorSecurity[index].length > 0)) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {/* Existing Images */}
                    {previews.guarantorSecurity?.[index]?.map((img, imgIdx) => (
                      <div key={`existing-${imgIdx}`} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <img src={img.url} alt="Security" className="w-full h-32 object-cover" />
                        <button type="button" onClick={() => handleRemoveGuarantorSecurityPreview(index, imgIdx)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-md">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white px-2 py-1 text-[10px] truncate">
                          Existing Image
                        </div>
                      </div>
                    ))}
                    {/* New Images */}
                    {guarantorSecurityImages[index]?.map((file, fileIdx) => (
                      <div key={`new-${fileIdx}`} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <img src={URL.createObjectURL(file)} alt="Guarantor Security" className="w-full h-32 object-cover" />
                        <button type="button" onClick={() => handleRemoveMultipleFile(index, fileIdx, setGuarantorSecurityImages)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition duration-200">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
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
            Add Another Guarantor Security Item
          </button>
        </div>
      </div>
    </div>
  );

  const renderNextOfKinSection = () => (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-lg font-semibold text-text flex items-center">
          <UserGroupIcon className="h-8 w-8 text-brand-primary mr-3" />
          Next of Kin Information
        </h2>
        <p className="text-muted mt-2">Enter next of kin details</p>
      </div>

      {formData.nextOfKins.map((nok, index) => (
        <div key={index} className="bg-brand-surface rounded-xl p-6 border border-brand-surface relative mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-md font-semibold text-brand-primary flex items-center">
              Next of Kin {index + 1}
            </h3>
            {formData.nextOfKins.length > 1 && (
              <button type="button" onClick={() => removeNextOfKin(index)} className="text-red-500 hover:text-red-700">
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField label="First Name" name="Firstname" value={nok.Firstname} section="nextOfKins" index={index} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Middle Name" name="Middlename" value={nok.Middlename} section="nextOfKins" index={index} handleNestedChange={handleNestedChange} />
            <FormField label="Surname" name="Surname" value={nok.Surname} section="nextOfKins" index={index} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="ID Number" name="idNumber" value={nok.idNumber} section="nextOfKins" index={index} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Mobile Number" name="mobile" value={nok.mobile} section="nextOfKins" index={index} required handleNestedChange={handleNestedChange} errors={errors} />
            <FormField label="Alternative Number" name="alternativeNumber" value={nok.alternativeNumber} section="nextOfKins" index={index} handleNestedChange={handleNestedChange} />

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Relationship *</label>
              <select name="relationship" value={nok.relationship} onChange={(e) => handleNestedChange(e, 'nextOfKins', index)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-brand-primary focus:border-brand-primary focus:outline-none" required>
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

            {nok.relationship === "Other" && (
              <FormField label="Specify Relationship" name="relationshipOther" value={nok.relationshipOther} section="nextOfKins" index={index} required handleNestedChange={handleNestedChange} />
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Employment Status</label>
              <select name="employmentStatus" value={nok.employmentStatus} onChange={(e) => handleNestedChange(e, 'nextOfKins', index)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-brand-primary focus:border-brand-primary focus:outline-none">
                <option value="">Select Employment Status</option>
                <option value="Employed">Employed</option>
                <option value="Self Employed">Self Employed</option>
                <option value="Unemployed">Unemployed</option>
              </select>
            </div>

            {nok.employmentStatus === "Employed" && (
              <>
                <FormField label="Company Name" name="companyName" value={nok.companyName} section="nextOfKins" index={index} handleNestedChange={handleNestedChange} />
                <FormField label="Estimated Salary (KES)" name="salary" type="number" value={nok.salary} section="nextOfKins" index={index} handleNestedChange={handleNestedChange} />
              </>
            )}

            {nok.employmentStatus === "Self Employed" && (
              <>
                <FormField label="Business Name" name="businessName" value={nok.businessName} section="nextOfKins" index={index} handleNestedChange={handleNestedChange} />
                <FormField label="Estimated Income (KES)" name="businessIncome" type="number" value={nok.businessIncome} section="nextOfKins" index={index} handleNestedChange={handleNestedChange} />
              </>
            )}

            <FormField label="Next of Kin County" name="county" value={nok.county} section="nextOfKins" index={index} options={KENYA_COUNTIES} handleNestedChange={handleNestedChange} />
            <FormField label="City/Town" name="cityTown" value={nok.cityTown} section="nextOfKins" index={index} handleNestedChange={handleNestedChange} />
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
  );

  const renderDocumentsSection = () => documentUploadEnabled ? (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-lg font-semibold text-text flex items-center">
          <DocumentTextIcon className="h-8 w-8 text-brand-primary mr-3" />
          Document Verification
        </h2>
        <p className="text-muted mt-2">Upload verification and officer images</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { key: "officerClient1", label: "First Officer & Client", handler: setOfficerClientImage1 },
          { key: "officerClient2", label: "Second Officer & Client", handler: setOfficerClientImage2 },
          { key: "bothOfficers", label: "Both Officers & Client", handler: setBothOfficersImage },
        ].map((file) => (
          <div key={file.key} className="flex flex-col items-start p-4 border border-brand-surface rounded-xl bg-brand-surface shadow-sm">
            <label className="block text-xs font-semibold text-text mb-3 uppercase tracking-wider">{file.label}</label>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <label className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-brand-surface text-brand-primary rounded-lg shadow-sm cursor-pointer hover:bg-brand-secondary/20 transition">
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Upload</span>
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, file.handler, file.key)} className="hidden" />
              </label>
            </div>
            {previews[file.key] && (
              <div className="mt-4 w-full">
                <div className="relative">
                  <img src={previews[file.key].url} alt={file.label} className="w-full h-40 object-cover rounded-lg border border-brand-surface shadow-sm" />
                  <button type="button" onClick={() => handleRemoveFile(file.key, file.handler)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 p-2 bg-white rounded border border-gray-200 text-sm">
                  <p className="text-xs text-muted truncate" title={previews[file.key].fileName}>
                    {previews[file.key].isExisting ? '📁 ' : '📄 '}
                    {previews[file.key].fileName}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-muted py-8 font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header and Navigation Tabs */}
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
            {activeSection === "personal" && renderPersonalSection()}
            {activeSection === "business" && renderBusinessSection()}
            {activeSection === "borrowerSecurity" && renderBorrowerSecuritySection()}
            {activeSection === "loan" && renderLoanSection()}
            {activeSection === "guarantor" && renderGuarantorSection()}
            {activeSection === "guarantorSecurity" && renderGuarantorSecuritySection()}
            {activeSection === "nextOfKin" && renderNextOfKinSection()}
            {activeSection === "documents" && renderDocumentsSection()}

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
                    disabled={isSubmitting || isSavingDraft || isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral text-text rounded-lg hover:bg-brand-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSubmitting || isLoading}
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
                    key="next-button"
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral text-text rounded-lg hover:bg-brand-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting || isSavingDraft || isValidating || isLoading}
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
                    key="submit-button"
                    type="submit"
                    disabled={isSubmitting || isSavingDraft || isLoading}
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
        </div>
      </div>
    </div>
  );
};

export default CustomerDraft;