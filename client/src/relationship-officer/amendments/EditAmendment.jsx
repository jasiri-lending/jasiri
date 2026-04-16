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
import { useToast } from "../../components/Toast";
import LocationPicker from "../components/LocationPicker";
import { useNavigate } from "react-router-dom";
import { useTenantFeatures } from "../../hooks/useTenantFeatures";
import { useAuth } from "../../hooks/userAuth";

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
    index,
  }) => {
    const fieldClasses = isAmendment
      ? "border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500"
      : "border-gray-300 bg-gray-50 focus:ring-brand-primary focus:border-brand-primary";

    let errorMessage = '';
    if (section && index !== undefined && index !== null) {
      errorMessage = errors[`${section}_${index}_${name}`];
    } else {
      errorMessage = errors[name];
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
            onChange={section ? (e) => handleNestedChange(e, section, index) : onChange}
            className={`w-full p-3 border rounded-lg focus:ring-brand-primary focus:border-brand-primary transition-colors ${fieldClasses} ${errorMessage ? "border-red-500" : ""}`}
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
            onChange={section ? (e) => handleNestedChange(e, section, index) : onChange}
            placeholder={placeholder}
            className={`w-full p-3 border rounded-lg focus:ring-brand-primary focus:border-brand-primary transition-colors ${fieldClasses} ${errorMessage ? "border-red-500" : ""}`}
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

function EditAmendment({ customerId, onClose }) {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("personal");
  const [completedSections, setCompletedSections] = useState(new Set());
  const toast = useToast();
  const [securityItems, setSecurityItems] = useState([]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { documentUploadEnabled, imageUploadEnabled } = useTenantFeatures();

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

    guarantors: [],
    nextOfKins: [],
    spouse: {
      name: "",
      idNumber: "",
      mobile: "",
      economicActivity: "",
    },
  });

  const [isCustomIndustry, setIsCustomIndustry] = useState(false);
  const [isCustomType, setIsCustomType] = useState(false);

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
        .maybeSingle();

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

      // Fetch related data in parallel
      const [
        { data: guarantorsData, error: guarantorsError },
        { data: nextOfKinData, error: nextOfKinError },
        { data: securityItemsData, error: securityError },
        { data: businessImagesData, error: businessError },
        { data: documentsData, error: documentsError },
        { data: spouseData, error: spouseError },
      ] = await Promise.all([
        supabase.from("guarantors").select("*").eq("customer_id", customerId),
        supabase.from("next_of_kin").select("*").eq("customer_id", customerId),
        supabase.from("security_items").select("*, security_item_images(image_url)").eq("customer_id", customerId),
        supabase.from("business_images").select("*").eq("customer_id", customerId),
        supabase.from("documents").select("id, document_type, document_url").eq("customer_id", customerId),
        supabase.from("spouse").select("*").eq("customer_id", customerId),
      ]);

      const guarantor = guarantorsData?.[0] || null;
      const spouse = spouseData?.[0] || null;

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

        guarantors: guarantorsData?.map(g => ({
          id: g.id,
          prefix: g.prefix || "",
          Firstname: g.Firstname || "",
          Middlename: g.Middlename || "",
          Surname: g.Surname || "",
          idNumber: g.id_number?.toString() || "",
          maritalStatus: g.marital_status || "",
          gender: g.gender || "",
          dateOfBirth: g.date_of_birth || "",
          mobile: g.mobile || "",
          alternativeMobile: g.alternative_mobile || "",
          residenceStatus: g.residence_status || "",
          postalAddress: g.postal_address || "",
          code: g.code?.toString() || "",
          occupation: g.occupation || "",
          relationship: g.relationship || "",
          county: g.county || "",
          cityTown: g.city_town || ""
        })) || [],

        spouse: {
          name: spouse?.name || "",
          idNumber: spouse?.id_number || "",
          mobile: spouse?.mobile || "",
          economicActivity: spouse?.economic_activity || "",
        },
        nextOfKins: nextOfKinData ? nextOfKinData.map(nk => ({
          id: nk.id,
          Firstname: nk.Firstname || "",
          Surname: nk.Surname || "",
          Middlename: nk.Middlename || "",
          idNumber: nk.id_number?.toString() || "",
          relationship: nk.relationship || "",
          relationshipOther: nk.relationship_other || "",
          mobile: nk.mobile || "",
          alternativeNumber: nk.alternative_number || "",
          employmentStatus: nk.employment_status || "",
          companyName: nk.company_name || "",
          salary: nk.salary || "",
          businessName: nk.business_name || "",
          businessIncome: nk.business_income || "",
          county: nk.county || "",
          cityTown: nk.city_town || "",
        })) : [],
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

  const handleNestedChange = (e, section, index = null) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (index !== null && Array.isArray(prev[section])) {
        const newList = [...prev[section]];
        newList[index] = { ...newList[index], [name]: value };

        // Dependent resets
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

  const addGuarantor = () => {
    if (formData.guarantors.length >= 3) return toast.error("Maximum 3 guarantors allowed");
    setFormData(prev => ({
      ...prev,
      guarantors: [...prev.guarantors, {
        prefix: "", Firstname: "", Surname: "", Middlename: "", idNumber: "",
        maritalStatus: "", gender: "", mobile: "", postalAddress: "", code: "",
        occupation: "", relationship: "", dateOfBirth: "", county: "", cityTown: ""
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
    if (formData.nextOfKins.length >= 3) return toast.error("Maximum 3 Next of Kin allowed");
    setFormData(prev => ({
      ...prev,
      nextOfKins: [...prev.nextOfKins, {
        Firstname: "", Surname: "", Middlename: "", idNumber: "",
        relationship: "", mobile: "", county: "", cityTown: ""
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
      { type: "", description: "", identification: "", value: "" },
    ]);
    setGuarantorSecurityImages([...guarantorSecurityImages, []]);
  };

  const uploadFile = async (file, path, bucket = "customers") => {
    if (!file) return null;
    try {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const projectRef = supabaseUrl.split('//')[1].split('.')[0];
      return `https://${projectRef}.supabase.co/storage/v1/object/public/${bucket}/${data.path}`;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const buildSyncPromises = (passportUrl, idFrontUrl, idBackUrl, houseImageUrl, finalBusinessUrls) => {
    const syncPromises = [];

    // Business images sync
    syncPromises.push(supabase.from("business_images").delete().eq("customer_id", customerId).then(() => {
      if (finalBusinessUrls.length > 0) {
        return supabase.from("business_images").insert(finalBusinessUrls.map((url) => ({
          customer_id: customerId, image_url: url, created_by: profile?.id,
          tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
        }))).then(res => res);
      }
    }));

    // Spouse sync
    if (formData.maritalStatus === "Married" && formData.spouse) {
      syncPromises.push(supabase.from("spouse").upsert({
        customer_id: customerId, name: formData.spouse.name || null, id_number: formData.spouse.idNumber || null,
        mobile: formData.spouse.mobile || null, economic_activity: formData.spouse.economicActivity || null,
        created_by: profile?.id, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, updated_at: new Date().toISOString(),
      }, { onConflict: "customer_id" }).then(res => res));
    } else {
      syncPromises.push(supabase.from("spouse").delete().eq("customer_id", customerId).then(res => res));
    }

    // Next of Kin sync
    syncPromises.push(supabase.from("next_of_kin").delete().eq("customer_id", customerId).then(() => {
      if (formData.nextOfKins.length > 0) {
        return supabase.from("next_of_kin").insert(formData.nextOfKins.map(nok => ({
          customer_id: customerId, Firstname: nok.Firstname || null, Surname: nok.Surname || null,
          Middlename: nok.Middlename || null, id_number: nok.idNumber || null, relationship: nok.relationship || null,
          mobile: nok.mobile || null, county: nok.county || null, city_town: nok.cityTown || null,
          created_by: profile?.id, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id, region_id: profile?.region_id, created_at: new Date().toISOString(),
        }))).then(res => res);
      }
    }));

    // Guarantors sync
    syncPromises.push(supabase.from("guarantors").delete().eq("customer_id", customerId).then(() => {
      if (formData.guarantors.length > 0) {
        const guarantorRecords = formData.guarantors.map((g, idx) => ({
          customer_id: customerId, Firstname: g.Firstname || null, Surname: g.Surname || null,
          Middlename: g.Middlename || null, id_number: g.idNumber || null, marital_status: g.maritalStatus || null,
          gender: g.gender || null, mobile: g.mobile || null, postal_address: g.postalAddress || null,
          code: g.code ? parseInt(g.code, 10) || null : null, occupation: g.occupation || null,
          relationship: g.relationship || null, date_of_birth: g.dateOfBirth || null, county: g.county || null,
          city_town: g.cityTown || null, tenant_id: profile?.tenant_id, branch_id: profile?.branch_id,
          created_at: new Date().toISOString(),
        }));
        return supabase.from("guarantors").insert(guarantorRecords).then(res => res);
      }
    }));

    // Security Items sync
    syncPromises.push(supabase.from("security_items").delete().eq("customer_id", customerId).then(() => {
      if (securityItems.length > 0) {
        return supabase.from("security_items").insert(securityItems.map(s => ({
          customer_id: customerId, item: s.type || s.item || null, description: s.description || null,
          identification: s.identification || null, value: s.value ? parseFloat(s.value) : null,
          tenant_id: profile?.tenant_id, created_by: profile?.id, created_at: new Date().toISOString()
        }))).then(res => res);
      }
    }));

    return syncPromises;
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
      const { data: currentCustomer, error: fetchError } = await supabase
        .from("customers")
        .select("status")
        .eq("id", customerId)
        .single();
      if (fetchError) throw fetchError;

      let newStatus = currentCustomer.status;
      if (currentCustomer.status === "sent_back_by_bm") {
        newStatus = "bm_review_amend";
      } else if (currentCustomer.status === "sent_back_by_rm") {
        newStatus = "rm_review_amend";
      } else if (currentCustomer.status === "sent_back_by_cso") {
        newStatus = "cso_review_amend";
      }

      const timestamp = Date.now();
      // 1. Parallel image uploads
      const [passportUrl, idFrontUrl, idBackUrl, houseImageUrl, newBusinessUrls] = await Promise.all([
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : Promise.resolve(existingImages.passport),
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : Promise.resolve(existingImages.idFront),
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : Promise.resolve(existingImages.idBack),
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : Promise.resolve(existingImages.house),
        businessImages.length > 0 ? Promise.all(businessImages.map(f => uploadFile(f, `business/${timestamp}_${f.name}`))) : Promise.resolve([]),
      ]);

      const finalBusinessUrls = [...(existingImages.business?.filter(Boolean) || []), ...newBusinessUrls.filter(Boolean)];

      // 2. Main customer record update
      const { error: customerError } = await supabase
        .from("customers")
        .update({
          prefix: formData.prefix,
          Firstname: formData.Firstname,
          Middlename: formData.Middlename,
          Surname: formData.Surname,
          marital_status: formData.maritalStatus,
          residence_status: formData.residenceStatus,
          occupation: formData.occupation,
          date_of_birth: formData.dateOfBirth,
          gender: formData.gender,
          id_number: parseNumber(formData.idNumber),
          postal_address: formData.postalAddress,
          code: parseNumber(formData.code),
          town: formData.town,
          county: formData.county,
          business_name: formData.businessName,
          business_type: formData.businessType,
          year_established: formData.yearEstablished,
          business_location: formData.businessLocation,
          daily_Sales: parseNumber(formData.daily_Sales),
          road: formData.road,
          landmark: formData.landmark,
          has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
          prequalifiedAmount: parseNumber(formData.prequalifiedAmount),
          status: newStatus,
          updated_at: new Date().toISOString(),
          passport_url: passportUrl,
          id_front_url: idFrontUrl,
          id_back_url: idBackUrl,
          house_image_url: houseImageUrl,
        })
        .eq("id", customerId)
        .then(res => res);
      if (customerError) throw customerError;

      // 3. Parallel child record synchronization
      const results = await Promise.all(buildSyncPromises(passportUrl, idFrontUrl, idBackUrl, houseImageUrl, finalBusinessUrls));
      const syncError = results.find(r => r?.error);
      if (syncError) throw syncError.error;

      toast.success("Amendments submitted successfully");
      onClose();
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Failed to submit amendments");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseNumber = (val) => {
    if (val === null || val === undefined || val === "" || val === "undefined") return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };


  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const timestamp = Date.now();
      // 1. Parallel image uploads
      const [passportUrl, idFrontUrl, idBackUrl, houseImageUrl, newBusinessUrls] = await Promise.all([
        passportFile ? uploadFile(passportFile, `personal/${timestamp}_passport_${passportFile.name}`) : Promise.resolve(existingImages.passport),
        idFrontFile ? uploadFile(idFrontFile, `personal/${timestamp}_id_front_${idFrontFile.name}`) : Promise.resolve(existingImages.idFront),
        idBackFile ? uploadFile(idBackFile, `personal/${timestamp}_id_back_${idBackFile.name}`) : Promise.resolve(existingImages.idBack),
        houseImageFile ? uploadFile(houseImageFile, `personal/${timestamp}_house_${houseImageFile.name}`) : Promise.resolve(existingImages.house),
        businessImages.length > 0 ? Promise.all(businessImages.map(f => uploadFile(f, `business/${timestamp}_${f.name}`))) : Promise.resolve([]),
      ]);

      const finalBusinessUrls = [...(existingImages.business?.filter(Boolean) || []), ...newBusinessUrls.filter(Boolean)];

      // 2. Update customer details (keep existing status)
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
          has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
          edited_at: new Date().toISOString(),
          passport_url: passportUrl,
          id_front_url: idFrontUrl,
          id_back_url: idBackUrl,
          house_image_url: houseImageUrl,
        })
        .eq("id", customerId)
        .then(res => res);

      if (customerError) throw customerError;

      // 3. Parallel sync of child records
      const results = await Promise.all(buildSyncPromises(passportUrl, idFrontUrl, idBackUrl, houseImageUrl, finalBusinessUrls));
      const syncError = results.find(r => r?.error);
      if (syncError) throw syncError.error;

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
    const isPending = formData.status === 'pending';
    const currentSectionHasAmendments = sectionHasAmendments(activeSection);
    const canEdit = currentSectionHasAmendments || isPending;
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
                {sectionAmendmentDetails.length > 0 && !isPending && (
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
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="First Name"
                name="Firstname"
                value={formData.Firstname}
                onChange={handleChange}
                required
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Middle Name"
                name="Middlename"
                value={formData.Middlename}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Surname"
                name="Surname"
                value={formData.Surname}
                onChange={handleChange}
                required
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Mobile Number"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Alternative Mobile"
                name="alternativeMobile"
                value={formData.alternativeMobile}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="ID Number"
                name="idNumber"
                value={formData.idNumber}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                options={["Male", "Female"]}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Marital Status"
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
                options={["Single", "Married", "Separated/Divorced", "Other"]}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />

              {/* Spouse Information - Conditionally Rendered */}
              {formData.maritalStatus === "Married" && (
                <>
                  <AmendmentField
                    label="Spouse Name"
                    name="name"
                    value={formData.spouse?.name || ""}
                    section="spouse"
                    required
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Spouse ID Number"
                    name="idNumber"
                    value={formData.spouse?.idNumber || ""}
                    section="spouse"
                    required
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Spouse Mobile"
                    name="mobile"
                    value={formData.spouse?.mobile || ""}
                    section="spouse"
                    required
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Spouse Economic Activity"
                    name="economicActivity"
                    value={formData.spouse?.economicActivity || ""}
                    section="spouse"
                    required
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                </>
              )}
              <AmendmentField
                label="Residence Status"
                name="residenceStatus"
                value={formData.residenceStatus}
                onChange={handleChange}
                options={["Own", "Rent", "Family", "Other"]}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Occupation"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Postal Address"
                name="postalAddress"
                value={formData.postalAddress}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Postal Code"
                name="code"
                type="number"
                value={formData.code}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Town/City"
                name="town"
                value={formData.town}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="County"
                name="county"
                value={formData.county}
                onChange={handleChange}
                options={KENYA_COUNTIES}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
            </div>

            {/* Document Uploads */}
            <div className="mt-8">
              <h3 className="text-lg text-slate-600 mb-6">
                Personal Documents
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {imageUploadEnabled && [
                  { key: "passport", label: "Passport Photo", handler: setPassportFile },
                  { key: "idFront", label: "ID Front", handler: setIdFrontFile },
                  { key: "idBack", label: "ID Back", handler: setIdBackFile },
                  { key: "house", label: "House Image", handler: setHouseImageFile },
                ].map((file) => (
                  <div key={file.key} className="flex flex-col items-start p-4 border border-blue-200 rounded-xl bg-white">
                    <label className="block text-sm font-medium text-blue-800 mb-3">
                      {file.label}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                      <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-brand-primary rounded-lg cursor-pointer hover:bg-brand-surface transition text-sm ${currentSectionHasAmendments && !isPending ? "ring-2 ring-red-500 shadow-sm" : ""
                        }`}>
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        <span>Upload</span>
                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, file.handler, file.key)} className="hidden"
                          disabled={!canEdit} />
                      </label>

                      <label className={`md:hidden flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-50 text-red-600 border border-red-200" : "bg-brand-btn text-white hover:bg-brand-primary"
                        }`}>
                        <CameraIcon className="w-5 h-5" />
                        <span className="font-medium">Camera</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture={file.key === "passport" ? "user" : "environment"}
                          onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                          className="hidden"
                          disabled={!canEdit}
                        />
                      </label>
                    </div>
                    {(previews[file.key] || existingImages[file.key]) && (
                      <div className="mt-4 relative w-full">
                        <img src={previews[file.key] || existingImages[file.key]} alt={file.label} className="w-full h-32 object-cover rounded border" />
                        <button type="button" onClick={() => handleRemoveFile(file.key, file.handler)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"
                          disabled={!canEdit}>
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
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Business Type"
                name="businessType"
                value={formData.businessType}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Year Established"
                name="yearEstablished"
                type="date"
                value={formData.yearEstablished}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Daily Sales (KES)"
                name="daily_Sales"
                type="number"
                value={formData.daily_Sales}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Business Location"
                name="businessLocation"
                value={formData.businessLocation}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Road"
                name="road"
                value={formData.road}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Landmark"
                name="landmark"
                value={formData.landmark}
                onChange={handleChange}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
              />
              <AmendmentField
                label="Local Authority License"
                name="hasLocalAuthorityLicense"
                value={formData.hasLocalAuthorityLicense}
                onChange={handleChange}
                options={["Yes", "No"]}
                isAmendment={currentSectionHasAmendments && !isPending}
                disabled={!canEdit}
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
                disabled={!canEdit}
              />
            </div>

            {/* Business Images */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Business Images
              </h3>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                {imageUploadEnabled && (
                  <>
                    <label className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-50 text-red-600 border border-red-200" : "bg-brand-surface text-brand-primary"
                      }`}>
                      <Upload className="w-5 h-5" />
                      <span className="font-medium">Add Images</span>
                      <input type="file" accept="image/*" multiple onChange={handleBusinessImages} className="hidden"
                        disabled={!canEdit} />
                    </label>

                    <label className={`flex md:hidden flex-1 items-center justify-center gap-2 px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-all hover:shadow-md ${currentSectionHasAmendments ? "bg-red-50 text-red-600 border border-red-200" : "bg-brand-btn text-white hover:bg-brand-primary"
                      }`}>
                      <CameraIcon className="w-5 h-5" />
                      <span className="font-medium">Camera</span>
                      <input type="file" accept="image/*" capture="environment" multiple onChange={handleBusinessImages} className="hidden"
                        disabled={!canEdit} />
                    </label>
                  </>
                )}
              </div>

              {/* Combined display for existing and new images */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Existing URLs */}
                {imageUploadEnabled && existingImages.business?.map((img, index) => (
                  <div key={`existing-${index}`} className="relative group">
                    <img src={img} alt={`Business Existing ${index + 1}`} className="w-full h-32 object-cover rounded-xl border border-gray-200 shadow-sm" />
                    <button
                      type="button"
                      onClick={() => setExistingImages(prev => ({ ...prev, business: prev.business.filter((_, i) => i !== index) }))}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition shadow-lg"
                      disabled={!canEdit}
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">Existing</div>
                  </div>
                ))}

                {/* Newly selected Files */}
                {imageUploadEnabled && businessImages.map((img, index) => (
                  <div key={`new-${index}`} className="relative group">
                    <img src={URL.createObjectURL(img)} alt={`Business New ${index + 1}`} className="w-full h-32 object-cover rounded-xl border border-brand-primary/30 shadow-md" />
                    <button
                      type="button"
                      onClick={() => handleRemoveBusinessImage(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg"
                      disabled={!canEdit}
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
                        disabled={!canEdit}
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
                      isAmendment={currentSectionHasAmendments && !isPending}
                      disabled={!canEdit}
                    />
                    <AmendmentField
                      label="Description"
                      name="description"
                      value={item.description}
                      onChange={(e) => handleSecurityChange(e, index)}
                      isAmendment={currentSectionHasAmendments && !isPending}
                      disabled={!canEdit}
                    />
                    <AmendmentField
                      label="Identification"
                      name="identification"
                      value={item.identification}
                      onChange={(e) => handleSecurityChange(e, index)}
                      placeholder="e.g. Serial No."
                      isAmendment={currentSectionHasAmendments && !isPending}
                      disabled={!canEdit}
                    />
                    <AmendmentField
                      label="Est. Market Value (KES)"
                      name="value"
                      type="number"
                      value={item.value}
                      onChange={(e) => handleSecurityChange(e, index)}
                      isAmendment={currentSectionHasAmendments && !isPending}
                      disabled={!canEdit}
                    />
                  </div>

                  {/* Security Item Images */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium mb-3 text-gray-800">
                      Item Images
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                      {imageUploadEnabled && (
                        <>
                          <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-50 text-red-600 border border-red-200" : "bg-brand-surface text-brand-primary"
                            }`}>
                            <Upload className="w-5 h-5" />
                            <span className="font-medium">Upload Images</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleMultipleFiles(e, index, setSecurityItemImages)}
                              className="hidden"
                              disabled={!canEdit}
                            />
                          </label>

                          <label className={`md:hidden flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-50 text-red-600 border border-red-200" : "bg-brand-btn text-white hover:bg-brand-primary"
                            }`}>
                            <CameraIcon className="w-5 h-5" />
                            <span className="font-medium">Camera</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              multiple
                              onChange={(e) => handleMultipleFiles(e, index, setSecurityItemImages)}
                              className="hidden"
                              disabled={!canEdit}
                            />
                          </label>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {/* Existing Images for this specific item if we had them mapped, 
                          but the state management here is a bit complex. 
                          Let's try to render what's in securityItemImages[index] */}
                      {imageUploadEnabled && securityItemImages[index]?.map((img, imgIndex) => {
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
                              disabled={!canEdit}
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

              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={addSecurityItem}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                  disabled={!canEdit}
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Another Security Item
                </button>
              </div>
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

            <div className="bg-brand-surface rounded-2xl p-8 border border-brand-surface">
              <div className="max-w-md mx-auto">
                <AmendmentField
                  label="Pre-qualified Amount (KES)"
                  name="prequalifiedAmount"
                  type="number"
                  value={formData.prequalifiedAmount}
                  onChange={handleChange}
                  className="text-center"
                  isAmendment={currentSectionHasAmendments && !isPending}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
        );

      case "guarantor":
        return (
          <div className="space-y-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <UserGroupIcon className="h-6 w-6 text-brand-primary" />
                <h3 className="text-lg font-bold text-gray-800">Guarantors Information</h3>
              </div>
            </div>

            {formData.guarantors.map((g, i) => (
              <div key={i} className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 relative">
                {formData.guarantors.length > 1 && (
                  <button type="button" onClick={() => removeGuarantor(i)} className="absolute top-4 right-4 text-red-500 hover:text-red-700">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
                <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Guarantor {i + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <AmendmentField
                    label="Prefix"
                    name="prefix"
                    value={g.prefix}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    options={["Mr", "Mrs", "Ms", "Dr"]}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="First Name"
                    name="Firstname"
                    value={g.Firstname}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Middle Name"
                    name="Middlename"
                    value={g.Middlename}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Surname"
                    name="Surname"
                    value={g.Surname}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="ID Number"
                    name="idNumber"
                    value={g.idNumber}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Mobile Number"
                    name="mobile"
                    value={g.mobile}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Relationship"
                    name="relationship"
                    value={g.relationship}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="County"
                    name="county"
                    value={g.county}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    options={KENYA_COUNTIES}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Town"
                    name="cityTown"
                    value={g.cityTown}
                    section="guarantors"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    options={g.county ? COUNTY_TOWNS[g.county] : []}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={addGuarantor}
                className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                disabled={!canEdit}
              >
                <PlusIcon className="h-5 w-5" />
                Add Another Guarantor
              </button>
            </div>

            {/* Guarantor Documents */}
            <div className="mt-8">
              <h3 className="text-lg  text-slate-600 mb-6">
                Guarantor Documents
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {imageUploadEnabled && [
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
                    className="bg-brand-surface rounded-xl p-6 border border-brand-surface shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <file.icon className="h-6 w-6 text-brand-primary" />
                      <h4 className="text-md font-medium text-gray-900">
                        {file.label}
                      </h4>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                      <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-brand-primary rounded-lg cursor-pointer hover:bg-brand-surface transition text-sm ${currentSectionHasAmendments && !isPending ? "ring-2 ring-red-500 shadow-sm" : ""
                        }`}>
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                          className="hidden"
                          disabled={!canEdit}
                        />
                      </label>

                      <label className={`md:hidden flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-brand-primary rounded-lg cursor-pointer hover:bg-brand-surface transition text-sm ${currentSectionHasAmendments && !isPending ? "ring-2 ring-red-500 shadow-sm" : ""
                        }`}>
                        <CameraIcon className="w-4 h-4" />
                        <span>Camera</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture={file.key === "guarantorPassport" ? "user" : "environment"}
                          onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                          className="hidden"
                          disabled={!canEdit}
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
                          disabled={!canEdit}
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
                        disabled={!canEdit}
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
                      isAmendment={currentSectionHasAmendments && !isPending}
                      disabled={!canEdit}
                    />
                    <AmendmentField
                      label="Description"
                      name="description"
                      value={item.description}
                      onChange={(e) => handleGuarantorSecurityChange(e, index)}
                      isAmendment={currentSectionHasAmendments && !isPending}
                      disabled={!canEdit}
                    />
                    <AmendmentField
                      label="Identification"
                      name="identification"
                      value={item.identification}
                      onChange={(e) => handleGuarantorSecurityChange(e, index)}
                      placeholder="e.g. Serial No."
                      isAmendment={currentSectionHasAmendments && !isPending}
                      disabled={!canEdit}
                    />
                    <AmendmentField
                      label="Est. Market Value (KES)"
                      name="value"
                      type="number"
                      value={item.value}
                      onChange={(e) => handleGuarantorSecurityChange(e, index)}
                      isAmendment={currentSectionHasAmendments && !isPending}
                      disabled={!canEdit}
                    />
                  </div>

                  {/* Guarantor Security Item Images */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium mb-3 text-gray-800">
                      Item Images
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                      {imageUploadEnabled && (
                        <>
                          <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-50 text-red-600 border border-red-200" : "bg-brand-surface text-brand-primary"
                            }`}>
                            <Upload className="w-5 h-5" />
                            <span className="font-medium">Upload Images</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleMultipleFiles(e, index, setGuarantorSecurityImages)}
                              className="hidden"
                              disabled={!canEdit}
                            />
                          </label>

                          <label className={`md:hidden flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md ${currentSectionHasAmendments ? "bg-red-50 text-red-600 border border-red-200" : "bg-brand-btn text-white hover:bg-brand-primary"
                            }`}>
                            <CameraIcon className="w-5 h-5" />
                            <span className="font-medium">Camera</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              multiple
                              onChange={(e) => handleMultipleFiles(e, index, setGuarantorSecurityImages)}
                              className="hidden"
                              disabled={!canEdit}
                            />
                          </label>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {imageUploadEnabled && guarantorSecurityImages[index]?.map((img, imgIndex) => {
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
                              disabled={!canEdit}
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

              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={addGuarantorSecurityItem}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                  disabled={!canEdit}
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Another Guarantor Security Item
                </button>
              </div>
            </div>
          </div>
        );

      case "nextOfKin":
        return (
          <div className="space-y-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <UserGroupIcon className="h-6 w-6 text-brand-primary" />
                <h3 className="text-lg font-bold text-gray-800">Next of Kin Information</h3>
              </div>
            </div>

            {formData.nextOfKins.map((nk, i) => (
              <div key={i} className="mb-6 p-6 bg-gray-50 rounded-xl border border-gray-200 relative">
                {formData.nextOfKins.length > 1 && (
                  <button type="button" onClick={() => removeNextOfKin(i)} className="absolute top-4 right-4 text-red-500 hover:text-red-700">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
                <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Next of Kin {i + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AmendmentField
                    label="First Name"
                    name="Firstname"
                    value={nk.Firstname}
                    section="nextOfKins"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Middle Name"
                    name="Middlename"
                    value={nk.Middlename}
                    section="nextOfKins"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Surname"
                    name="Surname"
                    value={nk.Surname}
                    section="nextOfKins"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="ID Number"
                    name="idNumber"
                    value={nk.idNumber}
                    section="nextOfKins"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Relationship"
                    name="relationship"
                    value={nk.relationship}
                    section="nextOfKins"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    options={["Sister", "Brother", "Guardian", "Father", "Mother", "Spouse", "Other"]}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="Mobile Number"
                    name="mobile"
                    value={nk.mobile}
                    section="nextOfKins"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="County"
                    name="county"
                    value={nk.county}
                    section="nextOfKins"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    options={KENYA_COUNTIES}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                  <AmendmentField
                    label="City/Town"
                    name="cityTown"
                    value={nk.cityTown}
                    section="nextOfKins"
                    index={i}
                    handleNestedChange={handleNestedChange}
                    options={nk.county ? COUNTY_TOWNS[nk.county] : []}
                    isAmendment={currentSectionHasAmendments && !isPending}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={addNextOfKin}
                className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                disabled={!canEdit}
              >
                <PlusIcon className="h-5 w-5" />
                Add Another Next of Kin
              </button>
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
              {documentUploadEnabled && [
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
                    <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-brand-primary rounded-lg cursor-pointer hover:bg-brand-surface transition text-sm ${currentSectionHasAmendments && !isPending ? "ring-2 ring-red-500 shadow-sm" : ""
                      }`}>
                      <ArrowUpTrayIcon className="w-4 h-4" />
                      <span className="text-sm">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                        className="hidden"
                        disabled={!canEdit}
                      />
                    </label>

                    <label className={`flex md:hidden flex-1 items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-brand-primary rounded-lg cursor-pointer hover:bg-brand-surface transition text-sm ${currentSectionHasAmendments && !isPending ? "ring-2 ring-red-500 shadow-sm" : ""
                      }`}>
                      <CameraIcon className="w-4 h-4" />
                      <span className="text-sm">Camera</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleFileUpload(e, file.handler, file.key)}
                        className="hidden"
                        disabled={!canEdit}
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
                        disabled={!canEdit}
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                      {file.existing && !file.preview && (
                        <div className="absolute top-2 left-2 bg-brand-primary text-white text-xs px-2 py-1 rounded">
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
    <div className="min-h-screen bg-muted py-8 font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header
        <div className="p-4 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-brand-primary transition"
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
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm p-3 mb-6 border border-white/50">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {allSections.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              const isAmended = sectionHasAmendments(id);
              const isCompleted = completedSections.has(id);
              return (
                <button
                  key={id}
                  onClick={() => {
                    if (id !== activeSection) {
                      setCompletedSections(prev => new Set([...prev, activeSection]));
                    }
                    setActiveSection(id);
                  }}
                  className="flex flex-col items-center gap-1.5 transition-all duration-300 group relative"
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-medium transition-all duration-300 relative ${isActive
                      ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/30 transform scale-105"
                      : isCompleted
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/30 border-2 border-green-500"
                        : isAmended
                          ? "bg-red-50 text-red-600 border-2 border-red-200 group-hover:bg-red-100 group-hover:border-red-300 group-hover:scale-105"
                          : "bg-gray-100 text-slate-700 border-2 border-gray-200 group-hover:bg-gray-200 group-hover:border-gray-300 group-hover:scale-105"
                      }`}
                  >
                    {isCompleted && !isActive ? (
                      <CheckCircleIcon className="h-5 w-5 text-white" />
                    ) : (
                      <Icon className={`h-5 w-5 ${isActive ? "text-white" : isAmended ? "text-red-500" : isCompleted ? "text-white" : "text-slate-700"}`} />
                    )}
                    {isAmended && !isActive && !isCompleted && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-medium text-center transition-all duration-300 ${isActive
                      ? "text-brand-primary font-bold"
                      : isCompleted
                        ? "text-green-600 font-semibold"
                        : isAmended
                          ? "text-red-600 font-semibold"
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
                      setCompletedSections(prev => new Set([...prev, activeSection]));
                      setActiveSection(allSections[currentIndex - 1].id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral text-text rounded-lg hover:bg-brand-surface transition-colors font-medium shadow-sm"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-secondary text-white rounded-lg hover:bg-brand-primary transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
                      setCompletedSections(prev => new Set([...prev, activeSection]));
                      setActiveSection(allSections[currentIndex + 1].id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral text-text rounded-lg hover:bg-brand-surface transition-colors font-medium shadow-sm"
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Submitting...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4" />
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