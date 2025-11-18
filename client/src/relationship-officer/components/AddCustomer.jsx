import { useState, memo, useCallback } from "react";
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
  TrashIcon,ArrowLeftIcon ,
} from "@heroicons/react/24/outline";

import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { checkUniqueValue } from "../../utils/Unique";
import { useAuth } from "../../hooks/userAuth";
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
    index, // Add index prop for security items
  }) => {
    
    let errorMessage = '';
    
    if (index !== undefined && index !== null) {
      // Handle security items with index - match the error key format from validation
      errorMessage = errors[`security_${name}_${index}`] || errors[`guarantor_security_${name}_${index}`];
    } else if (section) {
      // Handle nested objects like guarantor, nextOfKin
      errorMessage = errors?.[section]?.[name];
    } else {
      // Handle regular fields
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


const AddCustomer = ({  onClose }) => {
  const [activeSection, setActiveSection] = useState("personal");
  const [securityItems, setSecurityItems] = useState([
    { item: "", description: "", identification: "", value: "" },
  ]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([
    { item: "", description: "", identification: "", value: "" },
  ]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
   const navigate = useNavigate();

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
    const { profile } = useAuth();

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
  const [isSavingDraft, setIsSavingDraft] = useState(false);

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


  // Fixed change handlers with useCallback to prevent re-renders
  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: null }));
      }
    },
    [errors]
  );

  const handleNestedChange = useCallback(
    (e, section) => {
      if (!e || !e.target) return;
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], [name]: value },
      }));
      const errorKey = `${section}${
        name.charAt(0).toUpperCase() + name.slice(1)
      }`;
      if (errors[errorKey]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[errorKey];
          return newErrors;
        });
      }
    },
    [errors]
  );

const handleSecurityChange = useCallback(
  (e, index) => {
    const { name, value } = e.target;
    setSecurityItems((prev) => {
      const newItems = [...prev];
      newItems[index][name] = value;
      return newItems;
    });
    
    // Clear specific error when user starts typing
    const errorKey = `security_${name}_${index}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  },
  [errors]
);

const handleGuarantorSecurityChange = useCallback(
  (e, index) => {
    const { name, value } = e.target;
    setGuarantorSecurityItems((prev) => {
      const newItems = [...prev];
      newItems[index][name] = value;
      return newItems;
    });
    
    // Clear specific error when user starts typing
    const errorKey = `guarantor_security_${name}_${index}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  },
  [errors]
);

  

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
    if (!item.item?.trim()) {
      errorsFound[`security_item_${index}`] = "Item name is required";
      toast.error(`Security Item ${index + 1}: Item name is required`, { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!item.description?.trim()) {
      errorsFound[`security_description_${index}`] = "Description is required";
      toast.error(`Security Item ${index + 1}: Description is required`, { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!item.identification?.trim()) {
      errorsFound[`security_identification_${index}`] = "Identification is required";
      toast.error(`Security Item ${index + 1}: Identification is required`, { position: "top-right", autoClose: 3000 });
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

  // ✅ Uniqueness checks
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
    if (!item.item?.trim()) {
      errorsFound[`guarantor_security_item_${index}`] = "Item name is required";
      toast.error(`Guarantor Security ${index + 1}: Item name is required`, { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!item.description?.trim()) {
      errorsFound[`guarantor_security_description_${index}`] = "Description is required";
      toast.error(`Guarantor Security ${index + 1}: Description is required`, { position: "top-right", autoClose: 3000 });
      hasErrors = true;
    }
    if (!item.identification?.trim()) {
      errorsFound[`guarantor_security_identification_${index}`] = "Identification is required";
      toast.error(`Guarantor Security ${index + 1}: Identification is required`, { position: "top-right", autoClose: 3000 });
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

  // format checks
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

  // optional checks
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

  // uniqueness check
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
    return; //  stop here if validation failed
  }

  // Only move to next section if validation passed
  const nextIndex = sections.findIndex((item) => item.id === activeSection) + 1;
  if (nextIndex < sections.length) {
    setActiveSection(sections[nextIndex].id);
  }
};

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

  const handleFileUpload = async (e, setter, key) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Save file for upload using the individual setter
      setter(file);

      // Save preview URL
      setPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));

      console.log(` File saved for ${key}:`, file.name);
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error during file selection.");
    }
  };

  const handleRemoveFile = (key, setter) => {
    setter(null);
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
  };

  const handleMultipleFiles = (e, setter) => {
    const files = Array.from(e.target.files);
    setter((prev) => [...prev, ...files]); // append new images
  };

  const handleRemoveBusinessImage = (index) => {
    setBusinessImages((prev) => prev.filter((_, i) => i !== index));
  };

  //  Master validation function
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
      console.warn(" Validation failed: ", {
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

  // Upload file helper function (keep the same)
  const uploadFile = async (file, path, bucket = "customers") => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data: urlData, error: urlError } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      if (urlError) throw urlError;

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(`Failed to upload file: ${error.message}`);
      return null;
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
      passportUrl = await uploadFile(
        passportFile,
        `personal/${Date.now()}_passport_${passportFile.name}`,
        "customers"
      );

    if (idFrontFile)
      idFrontUrl = await uploadFile(
        idFrontFile,
        `personal/${Date.now()}_id_front_${idFrontFile.name}`,
        "customers"
      );

    if (idBackFile)
      idBackUrl = await uploadFile(
        idBackFile,
        `personal/${Date.now()}_id_back_${idBackFile.name}`,
        "customers"
      );

    if (houseImageFile)
      houseImageUrl = await uploadFile(
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
  ? new Date(formData.yearEstablished) 
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
      
    });   navigate('/officer/customers'); 
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


  const handleSubmit = async (e) => {
    e.preventDefault();
 

    const isValid = await validateForm();
    if (!isValid) {
      toast.error("Please fix the errors in the form before submitting.");
      return;
    }

    setIsSubmitting(true);

    const logError = (section, error) => {
      console.group(` Error in ${section} section`);
      console.error(error.message, error);
      console.groupEnd();
      toast.error(`Error in ${section}: ${error.message}`);
    };

    try {
     

      // ========= 1. Upload customer personal images =========
      let passportUrl = null,
        idFrontUrl = null,
        idBackUrl = null,
        houseImageUrl = null;

      if (passportFile) {
        passportUrl = await uploadFile(
          passportFile,
          `personal/${Date.now()}_passport_${passportFile.name}`,
          "customers"
        );
        if (!passportUrl) throw new Error("Failed to upload passport image");
      }

      if (idFrontFile) {
        idFrontUrl = await uploadFile(
          idFrontFile,
          `personal/${Date.now()}_id_front_${idFrontFile.name}`,
          "customers"
        );
        if (!idFrontUrl) throw new Error("Failed to upload ID front image");
      }

      if (idBackFile) {
        idBackUrl = await uploadFile(
          idBackFile,
          `personal/${Date.now()}_id_back_${idBackFile.name}`,
          "customers"
        );
        if (!idBackUrl) throw new Error("Failed to upload ID back image");
      }

      if (houseImageFile) {
        houseImageUrl = await uploadFile(
          houseImageFile,
          `personal/${Date.now()}_house_${houseImageFile.name}`,
          "customers"
        );
        if (!houseImageUrl) throw new Error("Failed to upload house image");
      }

      // ========= 2. Insert customer =========
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .insert([
          {
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
  ? new Date(formData.yearEstablished) 
  : null,

            business_location: formData.businessLocation || null,
            road: formData.road || null,
            landmark: formData.landmark || null,
            has_local_authority_license:
              formData.hasLocalAuthorityLicense === "Yes",
            passport_url: passportUrl,
            id_front_url: idFrontUrl,
            id_back_url: idBackUrl,
            house_image_url: houseImageUrl,
            prequalifiedAmount: formData.prequalifiedAmount
              ? parseFloat(formData.prequalifiedAmount)
              : null,
            status: "bm_review",

            //  Metadata
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (customerError) {
       
        setIsSubmitting(false);
        return;
      }

      const customerId = customerData.id;

      // ========= 3. Upload business images =========
      if (businessImages.length > 0) {
        const businessImageUrls = [];
        for (const image of businessImages) {
          const url = await uploadFile(
            image,
            `business/${Date.now()}_${image.name}`,
            "customers"
          );
          if (url) businessImageUrls.push(url);
        }
        if (businessImageUrls.length > 0) {
          const { error: businessImageError } = await supabase
            .from("business_images")
            .insert(
              businessImageUrls.map((url) => ({
                customer_id: customerId,
                image_url: url,
                created_by: profile?.id,
                branch_id: profile?.branch_id,
                region_id: profile?.region_id,
                created_at: new Date().toISOString(),
              }))
            );
          if (businessImageError)
            logError("Business Images", businessImageError);
        }
      }

      // ========= 4. Next of Kin =========
      const nextOfKin = formData.nextOfKin || {};
      const nextOfKinFilled = Object.values(nextOfKin).some(
        (val) => val != null && String(val).trim() !== ""
      );
      if (nextOfKinFilled) {
        const { error: nextOfKinError } = await supabase
          .from("next_of_kin")
          .insert([
            {
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

              created_by: profile?.id,
              branch_id: profile?.branch_id,
              region_id: profile?.region_id,
              created_at: new Date().toISOString(),
            },
          ]);
        if (nextOfKinError) logError("Next of Kin", nextOfKinError);
      }

      // ========= 5. Guarantor =========
      const guarantor = formData.guarantor || {};
      const guarantorFilled = Object.values(guarantor).some(
        (val) => val != null && String(val).trim() !== ""
      );
      let guarantorId = null;

      if (guarantorFilled) {
        let guarantorPassportUrl = null,
          guarantorIdFrontUrl = null,
          guarantorIdBackUrl = null;

        if (guarantorPassportFile) {
          guarantorPassportUrl = await uploadFile(
            guarantorPassportFile,
            `guarantor/${Date.now()}_passport_${guarantorPassportFile.name}`,
            "customers"
          );
        }
        if (guarantorIdFrontFile) {
          guarantorIdFrontUrl = await uploadFile(
            guarantorIdFrontFile,
            `guarantor/${Date.now()}_id_front_${guarantorIdFrontFile.name}`,
            "customers"
          );
        }
        if (guarantorIdBackFile) {
          guarantorIdBackUrl = await uploadFile(
            guarantorIdBackFile,
            `guarantor/${Date.now()}_id_back_${guarantorIdBackFile.name}`,
            "customers"
          );
        }

        const { data: guarantorData, error: guarantorError } = await supabase
          .from("guarantors")
          .insert([
            {
              customer_id: customerId,
              Firstname: guarantor.Firstname || null,
              Surname: guarantor.Surname || null,
              Middlename: guarantor.Middlename || null,
              id_number: guarantor.idNumber || null,
              marital_status: guarantor.maritalStatus || null,
              gender: guarantor.gender || null,
              mobile: guarantor.mobile || null,
              alternative_number: guarantor.alternativeNumber,
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
            },
          ])
          .select("id")
          .single();

        if (guarantorError) logError("Guarantor", guarantorError);
        else guarantorId = guarantorData.id;
      }

      // ========= 6. Guarantor Security =========
      if (guarantorId && guarantorSecurityItems.length > 0) {
        const itemsToInsert = guarantorSecurityItems.map((s) => ({
          guarantor_id: guarantorId,
          item: s.item || null,
          description: s.description || null,
          identification: s.identification || null,
          estimated_market_value: s.value ? parseFloat(s.value) : null,

          created_by: profile?.id,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          created_at: new Date().toISOString(),
        }));

        const { data: insertedItems, error: gSecError } = await supabase
          .from("guarantor_security")
          .insert(itemsToInsert)
          .select("id");

        if (gSecError) logError("Guarantor Security", gSecError);
        else {
          for (let i = 0; i < insertedItems.length; i++) {
            const securityId = insertedItems[i].id;
            const files = guarantorSecurityImages[i] || [];
            const urls = [];
            for (const file of files) {
              const url = await uploadFile(
                file,
                `guarantor_security/${Date.now()}_${file.name}`,
                "customers"
              );
              if (url) urls.push(url);
            }
            if (urls.length > 0) {
              const { error: gSecImgError } = await supabase
                .from("guarantor_security_images")
                .insert(
                  urls.map((url) => ({
                    guarantor_security_id: securityId,
                    image_url: url,

                    created_by: profile?.id,
                    branch_id: profile?.branch_id,
                    region_id: profile?.region_id,
                    created_at: new Date().toISOString(),
                  }))
                );
              if (gSecImgError)
                logError("Guarantor Security Images", gSecImgError);
            }
          }
        }
      }

      // ========= 7. Borrower Security =========
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
          created_at: new Date().toISOString(),
        }));

        const { data: insertedItems, error: secError } = await supabase
          .from("security_items")
          .insert(itemsToInsert)
          .select("id");

        if (secError) {
          logError("Borrower Security", secError);
        } else {
          // 2. Upload images for each security item
          for (let i = 0; i < insertedItems.length; i++) {
            const securityId = insertedItems[i].id;
            const files = securityItemImages[i] || []; // images from frontend
            const urls = [];

            for (const file of files) {
              // Save in borrower_security folder
              const filePath = `borrower_security/${Date.now()}_${file.name}`;
              const url = await uploadFile(file, filePath, "customers"); // ensure bucket is 'customers'

              if (url) urls.push(url);
            }

            // 3. Save URLs in security_item_images table
            if (urls.length > 0) {
              const { error: secImgError } = await supabase
                .from("security_item_images")
                .insert(
                  urls.map((url) => ({
                    security_item_id: securityId,
                    image_url: url,
                    created_by: profile?.id,
                    branch_id: profile?.branch_id,
                    region_id: profile?.region_id,
                    created_at: new Date().toISOString(),
                  }))
                );

              if (secImgError)
                logError("Borrower Security Images", secImgError);
            }
          }
        }
      }

      // ========= 9. Documents =========
      const documentsToUpload = [
        { file: officerClientImage1, type: "First Officer and Client Image" },
        { file: officerClientImage2, type: "Second Officer and Client Image" },
        { file: bothOfficersImage, type: "Both Officers Image" },
      ];

      const uploadedDocs = [];
      for (const doc of documentsToUpload) {
        if (doc.file) {
          const url = await uploadFile(
            doc.file,
            `documents/${Date.now()}_${doc.file.name}`,
            "customers"
          );
          if (url)
            uploadedDocs.push({
              customer_id: customerId,
              document_type: doc.type,
              document_url: url,

              created_by: profile?.id,
              branch_id: profile?.branch_id,
              region_id: profile?.region_id,
              created_at: new Date().toISOString(),
            });
        }
      }

      if (uploadedDocs.length > 0) {
        const { error: docError } = await supabase
          .from("documents")
          .insert(uploadedDocs);
        if (docError) logError("Documents", docError);
      }

      // =========  Success =========
      toast.success("Customer & all related details saved successfully!", {
        position: "top-right",
        autoClose: 4000,
        theme: "colored",
      });
      navigate('/officer/customers'); 
      onClose();
    } catch (error) {
      console.error(" Unexpected error:", error);
      toast.error(
        error.message || "Unexpected error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
       


        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-indigo-100">
          <div className="flex flex-wrap gap-2">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeSection === id
                    ? "bg-gradient-to-r from-blue-300 to-blue-300 text-slate-600 shadow-lg"
                    : "bg-gray-100 text-slate-700 hover:bg-gray-200 hover:shadow-md"
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
  {/* Upload Button */}
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

  {/* Camera Button */}
  <label className="flex flex-1 items-center justify-center gap-2 px-4 py-3 bg-blue-400 text-white rounded-lg shadow-sm cursor-pointer hover:bg-blue-500 transition-all duration-200 w-full sm:w-1/2">
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
                          <div className="mt-4 w-full relative">
                            <img
                              src={previews[file.key]}
                              alt={`${file.label} preview`}
                              className="w-full h-40 object-cover rounded-lg border border-indigo-200 shadow-sm"
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
                    <h3 className="text-lg font-semibold text-slate-600">
                      Business Images
                    </h3>
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition-colors">
                      <PlusIcon className="h-4 w-4" />
                      Add Images
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) =>
                          handleMultipleFiles(e, setBusinessImages)
                        }
                        className="hidden"
                        handleNestedChange={handleNestedChange}
                      />
                    </label>
                  </div>

                  {businessImages.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {businessImages.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(img)}
                            alt={`Business ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg border border-gray-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveBusinessImage(index)}
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md opacity-90 group-hover:opacity-100"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

         {/* Borrower Security */}
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
        Borrower Security Items
      </h2>
      <p className="text-gray-600 mt-2">
        Add security items and collateral details
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Item"
              name="item"
              value={item.item}
              onChange={(e) => handleSecurityChange(e, index)}
              required
              errors={errors}
              index={index} // Add index prop
              className="mb-4"
            />
            <FormField
              label="Description"
              name="description"
              value={item.description}
              onChange={(e) => handleSecurityChange(e, index)}
              required
              errors={errors}
              index={index} // Add index prop
              className="mb-4"
            />
            <FormField
              label="Identification"
              name="identification"
              value={item.identification}
              onChange={(e) => handleSecurityChange(e, index)}
              placeholder="e.g. Serial No."
              required
              errors={errors}
              index={index} // Add index prop
              className="mb-4"
            />
            <FormField
              label="Est. Market Value (KES)"
              name="value"
              type="number"
              value={item.value}
              onChange={(e) => handleSecurityChange(e, index)}
              required
              errors={errors}
              index={index} // Add index prop
              className="mb-4"
            />
          </div>

          {/* Security Item Images */}
          <div className="mt-6">
            <label className="block text-sm font-medium mb-2 text-slate-600">
              Item Images
            </label>
            <div className="flex gap-3 mb-3">
              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-200 transition">
                <ArrowUpTrayIcon className="w-5 h-5" />
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

              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition">
                <CameraIcon className="w-5 h-5" />
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

            {securityItemImages[index] &&
              securityItemImages[index].length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {securityItemImages[index].map((img, imgIdx) => (
                    <div key={imgIdx} className="relative">
                      <img
                        src={URL.createObjectURL(img)}
                        alt={`Security ${index + 1} - Image ${imgIdx + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...securityItemImages];
                          updated[index] = updated[index].filter(
                            (_, i) => i !== imgIdx
                          );
                          setSecurityItemImages(updated);
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md"
                      >
                        <XMarkIcon className="w-4 h-4" />
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
        className="flex items-center gap-2 px-6 py-3 bg-blue-300 text-white rounded-lg hover:blue-500 transition-all shadow-md hover:shadow-lg"
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
                    errors={errors}
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
                        className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200 shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <file.icon className="h-6 w-6 text-indigo-600" />
                          <h4 className="text-md font-medium text-slate-600">
                            {file.label}
                          </h4>
                        </div>

                        <div className="flex gap-2 mb-3">
                          <label className="flex items-center justify-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded cursor-pointer hover:bg-indigo-200">
                            <ArrowUpTrayIcon className="w-4 h-4" />
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleFileUpload(e, file.handler, file.key)
                              }
                              className="hidden"
                              handleNestedChange={handleNestedChange}
                            />
                          </label>

                          <label className="flex items-center justify-center gap-1 px-3 py-1 bg-blue-300 text-white rounded cursor-pointer hover:bg-blue-500">
                            <CameraIcon className="w-4 h-4" />
                            Camera
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) =>
                                handleFileUpload(e, file.handler, file.key)
                              }
                              className="hidden"
                              handleNestedChange={handleNestedChange}
                            />
                          </label>
                        </div>

                        {previews[file.key] && (
                          <div className="relative">
                            <img
                              src={previews[file.key]}
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
                              <XMarkIcon className="w-4 h-4" />
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
            <FormField
              label="Item"
              name="item"
              value={item.item}
              onChange={(e) => handleGuarantorSecurityChange(e, index)}
              required
              errors={errors}
              index={index} // Add index prop
              className="mb-4"
            />
            <FormField
              label="Description"
              name="description"
              value={item.description}
              onChange={(e) => handleGuarantorSecurityChange(e, index)}
              required
              errors={errors}
              index={index} // Add index prop
              className="mb-4"
            />
            <FormField
              label="Identification"
              name="identification"
              value={item.identification}
              onChange={(e) => handleGuarantorSecurityChange(e, index)}
              placeholder="e.g. Serial No."
              required
              errors={errors}
              index={index} // Add index prop
              className="mb-4"
            />
            <FormField
              label="Est. Market Value (KES)"
              name="value"
              type="number"
              value={item.value}
              onChange={(e) => handleGuarantorSecurityChange(e, index)}
              required
              errors={errors}
              index={index} // Add index prop
              className="mb-4"
            />
          </div>

          {/* Guarantor Security Item Images */}
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

              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-300 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition">
                <CameraIcon className="w-5 h-5" />
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

            {guarantorSecurityImages[index] &&
              guarantorSecurityImages[index].length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {guarantorSecurityImages[index].map(
                    (img, imgIdx) => (
                      <div key={imgIdx} className="relative">
                        <img
                          src={URL.createObjectURL(img)}
                          alt={`Guarantor Security ${index + 1} - Image ${imgIdx + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-purple-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...guarantorSecurityImages];
                            updated[index] = updated[index].filter(
                              (_, i) => i !== imgIdx
                            );
                            setGuarantorSecurityImages(updated);
                          }}
                          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md"
                        >
                          <XMarkIcon className="w-4 h-4" />
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
                      label: "Both Officers",
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
                        <div className="mt-4 relative w-full">
                          <img
                            src={previews[file.key]}
                            alt={file.label}
                            className="w-full h-40 object-cover rounded-lg border border-indigo-200 shadow-sm"
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

  {/* Action Buttons */}

<div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-200">

  {/* Left Side: Previous Button */}
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

    {/*  Save as Draft Button */}
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

  {/* Right Side: Next or Submit Button */}
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

export default AddCustomer;
