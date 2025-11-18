import { useState, memo, useCallback } from "react";
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
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";

import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { checkUniqueValue } from "../../utils/Unique";

// Draft Saved Modal Component
const DraftSavedModal = ({ isOpen, draftId, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in">
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-100 rounded-full p-4">
            <CheckCircleIcon className="h-12 w-12 text-emerald-600" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
          Draft Saved Successfully
        </h2>
        
        <p className="text-center text-gray-600 mb-6">
          Your form has been saved as a draft. You can continue editing it later.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500 mb-2">Draft ID:</p>
          <p className="font-mono text-sm text-gray-900 break-all">{draftId}</p>
        </div>
        
        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-medium py-3 rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all"
        >
          Continue Editing
        </button>
      </div>
    </div>
  );
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
    
    if (index !== undefined && index !== null) {
      errorMessage = errors[`security_${name}_${index}`] || errors[`guarantor_security_${name}_${index}`];
    } else if (section) {
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

const AddCustomer = ({ profile, onClose }) => {
  const [activeSection, setActiveSection] = useState("personal");
  const [securityItems, setSecurityItems] = useState([
    { item: "", description: "", identification: "", value: "" },
  ]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([
    { item: "", description: "", identification: "", value: "" },
  ]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSavedId, setDraftSavedId] = useState(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

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

  const sections = [
    { id: "personal", label: "Personal Info", icon: UserCircleIcon },
    { id: "business", label: "Business Info", icon: BuildingOffice2Icon },
    { id: "borrowerSecurity", label: "Borrower Security", icon: ShieldCheckIcon },
    { id: "loan", label: "Loan Details", icon: CurrencyDollarIcon },
    { id: "guarantor", label: "Guarantor", icon: UserGroupIcon },
    { id: "guarantorSecurity", label: "Guarantor Security", icon: ShieldCheckIcon },
    { id: "nextOfKin", label: "Next of Kin", icon: UserGroupIcon },
    { id: "documents", label: "Documents", icon: DocumentTextIcon },
  ];

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
      const errorKey = `${section}${name.charAt(0).toUpperCase() + name.slice(1)}`;
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

  const saveDraftToDatabase = async () => {
    setIsSavingDraft(true);
    try {
      const { data, error } = await supabase
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
            daily_Sales: formData.daily_Sales ? parseFloat(formData.daily_Sales) : null,
            year_established: formData.yearEstablished ? parseInt(formData.yearEstablished) : null,
            business_location: formData.businessLocation || null,
            road: formData.road || null,
            landmark: formData.landmark || null,
            has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
            prequalifiedAmount: formData.prequalifiedAmount ? parseFloat(formData.prequalifiedAmount) : null,
            status: "pending",
            form_status: "draft",
            created_by: profile?.id,
            branch_id: profile?.branch_id,
            region_id: profile?.region_id,
            created_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (error) {
        console.error("Draft save error:", error);
        toast.error("Failed to save draft. Please try again.", {
          position: "top-right",
          autoClose: 3000,
        });
        setIsSavingDraft(false);
        return;
      }

      setDraftSavedId(data.id);
      setShowDraftModal(true);
      toast.success("Draft saved successfully!", {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Unexpected error saving draft:", error);
      toast.error("An unexpected error occurred while saving draft.", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

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
      setter(file);
      setPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
      console.log(`File saved for ${key}:`, file.name);
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
    setter((prev) => [...prev, ...files]);
  };

  const handleRemoveBusinessImage = (index) => {
    setBusinessImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    const nextIndex = sections.findIndex((item) => item.id === activeSection) + 1;
    if (nextIndex < sections.length) {
      setActiveSection(sections[nextIndex].id);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    toast.success("Form submitted successfully!", {
      position: "top-right",
      autoClose: 3000,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex justify-center items-start overflow-auto">
      <DraftSavedModal
        isOpen={showDraftModal}
        draftId={draftSavedId}
        onClose={() => setShowDraftModal(false)}
      />

      <div className="bg-white w-full max-w-7xl mx-4 my-8 rounded-xl shadow-lg p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-blue-700 bg-clip-text text-transparent">
                Customer Application
              </h1>
              <p className="text-gray-600 mt-2">
                Complete customer onboarding and loan application
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
              disabled={isSubmitting || isSavingDraft}
            >
              <XCircleIcon className="h-8 w-8" />
            </button>
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
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md"
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
            {/* Personal Information Section */}
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
                    errors={errors}
                  />
                  <FormField
                    label="First Name"
                    name="Firstname"
                    value={formData.Firstname}
                    onChange={handleChange}
                    required
                    errors={errors}
                  />
                  <FormField
                    label="Middle Name"
                    name="Middlename"
                    value={formData.Middlename}
                    onChange={handleChange}
                    errors={errors}
                  />
                  <FormField
                    label="Surname"
                    name="Surname"
                    value={formData.Surname}
                    onChange={handleChange}
                    required
                    errors={errors}
                  />
                  <FormField
                    label="Mobile Number"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    required
                    errors={errors}
                  />
                  <FormField
                    label="ID Number"
                    name="idNumber"
                    value={formData.idNumber}
                    onChange={handleChange}
                    required
                    errors={errors}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-200 gap-4">
              <button
                type="button"
                onClick={saveDraftToDatabase}
                disabled={isSavingDraft || isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                {isSavingDraft ? "Saving..." : "Save as Draft"}
              </button>

              <div className="flex gap-4">
                {activeSection !== sections[0].id && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = sections.findIndex(
                        (s) => s.id === activeSection
                      );
                      setActiveSection(sections[currentIndex - 1].id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    disabled={isSubmitting || isSavingDraft}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </button>
                )}

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
                    className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5" />
                    )}
                    {isSubmitting ? "Submitting..." : "Submit Application"}
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