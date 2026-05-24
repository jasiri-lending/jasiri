import React, { memo } from "react";
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
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import LocationPicker from "./LocationPicker";

export const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo Marakwet", "Embu",
  "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
  "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui",
  "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera",
  "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
  "Samburu", "Siaya", "Taita Taveta", "Tana River", "Tharaka Nithi",
  "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
];

export const COUNTY_TOWNS = {
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

export const INDUSTRIES = {
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

export const FormField = memo(
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
    isAmendment = false, // From EditAmendment
  }) => {
    let errorMessage = '';

    if (section && index !== undefined && index !== null) {
      errorMessage = errors[`${section}_${index}_${name}`] ||
                     errors[`security_${name}_${index}`] ||
                     errors[`guarantor_security_${name}_${index}`];
    } else if (section) {
      errorMessage = errors[`${section}${name.charAt(0).toUpperCase() + name.slice(1)}`] ||
                     errors[section]?.[name];
    } else {
      errorMessage = errors?.[name];
    }

    const fieldClasses = isAmendment
      ? "border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500"
      : "border-gray-300 bg-white focus:outline-none focus:border-slate-400";

    return (
      <div className={className}>
        <label className="text-xs text-slate-600 mb-1 block">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {options ? (
          <select
            name={name}
            value={value || ""}
            onChange={section ? (e) => handleNestedChange(e, section, index) : onChange}
            className={`w-full max-w-sm px-3 py-2 text-sm border rounded-md transition-colors ${fieldClasses} ${errorMessage ? "border-red-500" : ""}`}
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
            className={`w-full max-w-sm px-3 py-2 text-sm border rounded-md transition-colors ${fieldClasses} ${errorMessage ? "border-red-500" : ""}`}
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

const Form = ({
  activeSection,
  setActiveSection,
  formData,
  handleChange,
  handleNestedChange,
  errors,
  sections,
  completedSections,
  isSubmitting,
  isValidating,
  isSavingDraft,
  isCustomIndustry,
  isCustomType,
  securityItems = [],
  handleSecurityChange,
  addSecurityItem,
  removeSecurityItem,
  guarantorSecurityItems = [],
  handleGuarantorSecurityChange,
  addGuarantorSecurityItem,
  removeGuarantorSecurityItem,
  previews = {},
  handleFileUpload,
  handleRemoveFile,
  handleMultipleFiles,
  handleRemoveMultipleFile,
  handleBusinessImages,
  handleRemoveBusinessImage,
  imageUploadEnabled,
  documentUploadEnabled,
  handleLocationChange,
  addGuarantor,
  removeGuarantor,
  addNextOfKin,
  removeNextOfKin,
  handleSubmit,
  handleSaveDraft,
  handleNext,
  existingImages = {},
  handleRemoveExistingImage,
  amendmentSections = new Set(),
  amendmentData = [],
  setPassportFile,
  setIdFrontFile,
  setIdBackFile,
  setHouseImageFile,
  setSecurityItemImages,
  setGuarantorSecurityImages,
  setOfficerClientImage1,
  setOfficerClientImage2,
  setBothOfficersImage,
  guarantorPassportFiles = [],
  setGuarantorPassportFiles,
  guarantorIdFrontFiles = [],
  setGuarantorIdFrontFiles,
  guarantorIdBackFiles = [],
  setGuarantorIdBackFiles,
  businessImages = [],
  securityItemImages = [],
  guarantorSecurityImages = [],
  mode = "page", // "page" or "modal"
  onClose,
  sectionAmendmentDetails = [],
  disabled = false,
  isAmendmentMode = false,
}) => {
  const isAmendmentView = amendmentData.length > 0;
  const isPending = formData.status === 'pending';
  const canEditField = disabled === false;

  const content = (
    <div className="min-h-screen bg-white pt-6 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <div className="bg-gray-100 backdrop-blur-md rounded-lg p-2 mb-2 border border-white/50 flex items-center gap-2">
          <div className="flex-1 grid grid-cols-4 md:grid-cols-8 gap-1">
            {sections.map(({ id, label, icon: Icon }) => {
              const isCompleted = completedSections.has(id);
              const isActive = activeSection === id;
              const hasAmendment = amendmentSections.has(id);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (id !== activeSection) {
                      setActiveSection(id);
                    }
                  }}
                  className={`flex flex-col items-center gap-1 transition-all duration-300 group ${hasAmendment ? "relative" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition-all duration-300 relative ${
                      isActive
                        ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20 scale-105"
                        : isCompleted
                        ? "bg-accent text-white shadow-md shadow-accent/20 border border-accent"
                        : "bg-gray-100 text-slate-700 border border-gray-200 group-hover:bg-gray-200 group-hover:border-gray-300"
                    } ${hasAmendment ? "ring-2 ring-red-500" : ""}`}
                  >
                    {isCompleted && !isActive ? (
                      <CheckCircleIcon className="h-4 w-4 text-white" />
                    ) : (
                      <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-700"}`} />
                    )}
                  </div>

                  <span
                    className={`text-xs whitespace-nowrap transition-all duration-300 ${
                      isActive ? "text-brand-primary font-semibold" : "text-slate-600 opacity-80 group-hover:opacity-100"
                    }`}
                  >
                    {label}
                  </span>
                  {hasAmendment && (
                    <div className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 ml-2 border border-gray-200 bg-white shadow-sm">
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {amendmentData.length > 0 && (
          <div className="mb-2 px-4 py-2 bg-red-50 border border-red-100 rounded-lg flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-red-800 tracking-tight flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                Amendment Request
              </h1>
              <p className="text-red-600 text-xs mt-0.5">
                Review and update the required fields
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8">

            {/* ── Personal Information ── */}
            {activeSection === "personal" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-sm text-slate-600 flex items-center">
                    <UserCircleIcon className="h-4 w-4 text-brand-primary mr-3" />
                    Personal Information
                  </h2>
                  {sectionAmendmentDetails.length > 0 && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs text-red-700 font-medium flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                        Required Amendments: {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField label="Prefix" name="prefix" value={formData.prefix} onChange={handleChange} options={["Mr", "Mrs", "Ms", "Dr"]} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="First Name" name="Firstname" value={formData.Firstname} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Middle Name" name="Middlename" value={formData.Middlename} onChange={handleChange} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Surname" name="Surname" value={formData.Surname} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Mobile Number" name="mobile" value={formData.mobile} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Alternative Mobile" name="alternativeMobile" value={formData.alternativeMobile} onChange={handleChange} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="ID Number" name="idNumber" value={formData.idNumber} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Date of Birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Gender" name="gender" value={formData.gender} onChange={handleChange} options={["Male", "Female"]} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Marital Status" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} options={["Single", "Married", "Separated/Divorced", "Other"]} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />

                  {formData.maritalStatus === "Married" && formData.spouse && (
                    <>
                      <FormField label="Spouse Name" name="name" value={formData.spouse.name} section="spouse" required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Spouse ID Number" name="idNumber" value={formData.spouse.idNumber} section="spouse" required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Spouse Mobile" name="mobile" value={formData.spouse.mobile} section="spouse" required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Spouse Economic Activity" name="economicActivity" value={formData.spouse.economicActivity} section="spouse" required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                    </>
                  )}

                  <FormField label="Residence Status" name="residenceStatus" value={formData.residenceStatus} onChange={handleChange} options={["Own", "Rent", "Family", "Other"]} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Occupation" name="occupation" value={formData.occupation} onChange={handleChange} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Postal Address" name="postalAddress" value={formData.postalAddress} onChange={handleChange} handleNestedChange={handleNestedChange} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Postal Code" name="code" type="number" value={formData.code} onChange={handleChange} handleNestedChange={handleNestedChange} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="County" name="county" value={formData.county} onChange={handleChange} options={KENYA_COUNTIES} required errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Town/City" name="town" value={formData.town} onChange={handleChange} options={formData.county ? COUNTY_TOWNS[formData.county] : []} required errors={errors} placeholder="Select County first" isAmendment={isAmendmentMode} disabled={disabled} />
                </div>

                {imageUploadEnabled && (
                  <div className="mt-10 pt-8 border-t border-gray-100">
                    <h3 className="text-sm text-slate-600 mb-6 flex items-center gap-2">
                      <IdentificationIcon className="w-5 h-5" /> Personal Documents
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { key: "passport", label: "Passport Photo", handler: setPassportFile },
                        { key: "idFront", label: "ID Front", handler: setIdFrontFile },
                        { key: "idBack", label: "ID Back", handler: setIdBackFile },
                        { key: "houseImage", label: "Residence Image", handler: setHouseImageFile },
                      ].map((file) => (
                        <div key={file.key} className="p-4 border border-brand-surface rounded-xl bg-muted">
                          <label className="block text-xs text-slate-600 mb-3 ">{file.label}</label>
                          <div className="flex gap-2">
                            <label className="flex-1 flex items-center text-xs justify-center gap-2 px-1 py-0.5 bg-brand-primary border border-gray-200 text-white rounded-lg cursor-pointer hover:bg-brand-secondary transition ">
                              <ArrowUpTrayIcon className="w-3 h-3" />
                              {existingImages[file.key] ? "Replace" : "Upload"}
                              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, file.handler, file.key)} className="hidden" />
                            </label>
                          </div>
                          {existingImages[file.key] && !previews[file.key] && (
                            <div className="mt-3 relative">
                              <img src={existingImages[file.key]} alt={file.label} className="w-full h-24 object-cover rounded-lg border border-white shadow-sm" />
                              <div className="absolute top-1 left-1 bg-brand-primary text-white text-[10px] px-1.5 rounded-md">Existing</div>
                              <button type="button" onClick={() => handleRemoveExistingImage(file.key)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md"><XMarkIcon className="w-3 h-3" /></button>
                            </div>
                          )}
                          {previews[file.key] && (
                            <div className="mt-3 relative">
                              <img src={previews[file.key].url || previews[file.key]} alt={file.label} className="w-full h-24 object-cover rounded-lg border border-brand-primary shadow-sm" />
                              <div className="absolute top-1 left-1 bg-green-600 text-white text-[10px] px-1.5 rounded-md">New</div>
                              <button type="button" onClick={() => handleRemoveFile(file.key, file.handler)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md"><XMarkIcon className="w-3 h-3" /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Business Information ── */}
            {activeSection === "business" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-sm text-slate-600 flex items-center">
                    <BuildingOffice2Icon className="h-4 w-4 text-brand-primary mr-3" /> Business Information
                  </h2>
                  {sectionAmendmentDetails.length > 0 && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs text-red-700 font-medium flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                        Required Amendments: {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField label="Business Name" name="businessName" value={formData.businessName} onChange={handleChange} required errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Industry" name="industry" value={formData.industry} onChange={handleChange} options={[...Object.keys(INDUSTRIES), "Other"]} required errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  {isCustomIndustry && (
                    <FormField label="Specific Industry" name="industry" value={formData.industry === "Other" ? "" : formData.industry} onChange={handleChange} required errors={errors} placeholder="Enter specific industry" isAmendment={isAmendmentMode} disabled={disabled} />
                  )}
                  <FormField
                    label="Business Type" name="businessType" value={formData.businessType} onChange={handleChange}
                    options={formData.industry && INDUSTRIES[formData.industry] ? [...INDUSTRIES[formData.industry], "Other"] : ["Other"]}
                    required errors={errors} placeholder={isCustomIndustry ? "Select Industry/Other first" : "Select Industry first"} isAmendment={isAmendmentMode} disabled={disabled}
                  />
                  {isCustomType && (
                    <FormField label="Specific Business Type" name="businessType" value={formData.businessType === "Other" ? "" : formData.businessType} onChange={handleChange} required errors={errors} placeholder="Enter specific business type" isAmendment={isAmendmentMode} disabled={disabled} />
                  )}
                  <FormField label="Year Established" name="yearEstablished" type="date" value={formData.yearEstablished} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Daily Sales (KES)" name="daily_Sales" type="number" value={formData.daily_Sales} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="County" name="businessCounty" value={formData.businessCounty} onChange={handleChange} options={KENYA_COUNTIES} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Business Location" name="businessLocation" value={formData.businessLocation} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Road" name="road" value={formData.road} onChange={handleChange} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Landmark" name="landmark" value={formData.landmark} onChange={handleChange} placeholder="e.g. Near KCB Bank" required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  <FormField label="Local Authority License" name="hasLocalAuthorityLicense" value={formData.hasLocalAuthorityLicense} onChange={handleChange} options={["Yes", "No"]} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                </div>

                <div className="mt-8">
                  <LocationPicker value={formData.businessCoordinates} onChange={handleLocationChange} county={formData.businessCounty} />
                </div>

                {imageUploadEnabled && (
                  <div className="mt-10 pt-8 border-t border-gray-100">
                    <h3 className="text-sm text-slate-600 mb-6 flex items-center gap-2">
                      <BuildingOffice2Icon className="w-5 h-5" /> Business Images
                    </h3>
                    <div className="flex gap-4 mb-6">
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-brand-primary text-white text-xs rounded-lg cursor-pointer hover:bg-brand-secondary transition  ">
                        <ArrowUpTrayIcon className="w-3 h-3" /> Add Business Images
                        <input type="file" accept="image/*" multiple onChange={handleBusinessImages} className="hidden" />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {existingImages.business?.map((url, idx) => url && (
                        <div key={`exist-biz-${idx}`} className="relative group rounded-xl overflow-hidden border border-indigo-100 shadow-sm">
                          <img src={url} alt="Existing Business" className="w-full h-32 object-cover" />
                          <div className="absolute top-2 left-2 bg-brand-primary text-white text-[10px] px-1.5 rounded-md">Existing</div>
                          <button type="button" onClick={() => handleRemoveExistingImage("business", idx)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition"><XMarkIcon className="w-4 h-4" /></button>
                        </div>
                      ))}
                      {businessImages.map((file, idx) => (
                        <div key={`new-biz-${idx}`} className="relative group rounded-xl overflow-hidden border border-brand-primary shadow-sm">
                          <img src={file instanceof File ? URL.createObjectURL(file) : file} alt="New Business" className="w-full h-32 object-cover" />
                          <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] px-1.5 rounded-md">New</div>
                          <button type="button" onClick={() => handleRemoveBusinessImage(idx)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition"><XMarkIcon className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Borrower Security ── */}
            {activeSection === "borrowerSecurity" && (
              <div className="space-y-8">
                {errors.securityItems && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-700 text-sm">{errors.securityItems}</p>
                  </div>
                )}
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-sm text-slate-600 flex items-center">
                    <ShieldCheckIcon className="h-4 w-4 text-slate-600 mr-3" /> Borrower Security
                  </h2>
                </div>

                <div className="space-y-6">
                  {securityItems.map((item, index) => (
                    <div key={index} className="bg-muted rounded-xl p-6 border border-brand-surface">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm text-slate-600 flex items-center">
                          <ShieldCheckIcon className="h-4 w-5 text-slate-600 mr-2" /> Security {index + 1}
                        </h3>
                        {securityItems.length > 1 && (
                          <button type="button" onClick={() => removeSecurityItem(index)} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs mb-1 text-slate-600 block">
                            Security Type
                          </label>

                          <select
                            name="type"
                            value={item.type || item.item || ""}
                            onChange={(e) => handleSecurityChange(e, index)}
                            className={`w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-slate-400 transition-colors ${isAmendmentMode ? "border-red-300 bg-red-50" : ""}`}
                            required
                            disabled={disabled}
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
                            <option value="Fixed deposit / Savings security">Fixed deposit / Savings security</option>
                            <option value="Electronics">Electronics</option>
                            <option value="Other">Other (specify)</option>
                          </select>
                        </div>
                        {item.type === "Other" && (
                          <FormField label="Specify Other Security" name="otherType" value={item.otherType || ""} onChange={(e) => handleSecurityChange(e, index)} required isAmendment={isAmendmentMode} disabled={disabled} />
                        )}
                        <FormField label="Description" name="description" value={item.description} onChange={(e) => handleSecurityChange(e, index)} required isAmendment={isAmendmentMode} disabled={disabled} />
                        <FormField label="Est. Market Value (KES)" name="value" type="number" value={item.value} onChange={(e) => handleSecurityChange(e, index)} required isAmendment={isAmendmentMode} disabled={disabled} />
                      </div>

                      {imageUploadEnabled && (
                        <div className="mt-6">
                          <label className=" text-xs mb-2 text-slate-699">Security Images</label>
                          <div className="flex gap-3 mb-3">
                            <label className="flex items-center justify-center gap-3 px-1.5 py-0.5 text-xs bg-brand-primary text-white rounded-lg cursor-pointer hover:bg-brand-secondary ">
                              <ArrowUpTrayIcon className="w-2 h-2" /> Upload Security Images
                              <input type="file" accept="image/*" multiple onChange={(e) => handleMultipleFiles(e, index, setSecurityItemImages)} className="hidden" />
                            </label>
                            <label className="flex md:hidden items-center justify-center gap-2 px-6 py-3 bg-brand-btn text-white rounded-lg cursor-pointer hover:bg-brand-primary font-medium">
                              <CameraIcon className="w-4 h-4" /> Camera
                              <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => handleMultipleFiles(e, index, setSecurityItemImages)} className="hidden" />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                            {existingImages.security?.[index]?.map((url, imgIdx) => url && (
                              <div key={`exist-sec-${index}-${imgIdx}`} className="relative group">
                                <img src={url} alt={`Existing Security ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-indigo-100 shadow-sm" />
                                <div className="absolute top-1 left-1 bg-brand-primary text-white text-[10px] px-1.5 rounded-md">Existing</div>
                                <button type="button" onClick={() => handleRemoveExistingImage("security", index, imgIdx)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-md"><XMarkIcon className="w-3 h-3" /></button>
                              </div>
                            ))}
                            {securityItemImages[index]?.map((img, imgIdx) => (
                              <div key={`new-sec-${index}-${imgIdx}`} className="relative group">
                                <img src={img instanceof Blob ? URL.createObjectURL(img) : img} alt={`New Security ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-brand-primary shadow-sm" />
                                <div className="absolute top-1 left-1 bg-green-600 text-white text-[10px] px-1.5 rounded-md">New</div>
                                <button type="button" onClick={() => handleRemoveMultipleFile(index, imgIdx, setSecurityItemImages)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-md"><XMarkIcon className="w-3 h-3" /></button>
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
                      onClick={addSecurityItem}
                      className="flex items-center text-sm gap-2 px-4 py-2 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all "
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Another Security Item
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Loan Details ── */}
            {activeSection === "loan" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-sm text-slate-600 flex items-center">
                    <CurrencyDollarIcon className="h-4 w-4 text-slate-600 text-sm mr-3" /> Loan Information
                  </h2>
                  {sectionAmendmentDetails.length > 0 && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs text-red-700 font-medium flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                        Required Amendments: {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                      </p>
                    </div>
                  )}
                </div>
                <div className="bg-muted rounded-xl p-8 border border-brand-surface">
                  <div className="max-w-md mx-auto">
                    <FormField label="Pre-qualified Amount (KES)" name="prequalifiedAmount" type="number" value={formData.prequalifiedAmount} onChange={handleChange} className="text-center" required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Guarantor Details ── */}
            {activeSection === "guarantor" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-sm text-slate-600 flex items-center">
                    <UserGroupIcon className="h-4 w-4 text-slate-600 mr-3" /> Guarantor Information
                  </h2>
                  {sectionAmendmentDetails.length > 0 && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs text-red-700 font-medium flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                        Required Amendments: {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                      </p>
                    </div>
                  )}
                </div>

                {formData.guarantors.map((g, index) => (
                  <div key={index} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
                      <h3 className="text-sm text-slate-600 flex items-center gap-2">
                        <span className="w-4 h-4 bg-brand-primary text-white text-xs rounded-full flex items-center justify-center">{index + 1}</span>
                        {index === 0 ? "Primary Guarantor" : `Secondary Guarantor ${index}`}
                      </h3>
                      {formData.guarantors.length > 1 && (
                        <button type="button" onClick={() => removeGuarantor(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"><TrashIcon className="w-5 h-5" /></button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FormField label="Prefix" name="prefix" section="guarantors" index={index} value={g.prefix} options={["Mr", "Mrs", "Ms", "Dr"]} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="First Name" name="Firstname" section="guarantors" index={index} value={g.Firstname} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Middle Name" name="Middlename" section="guarantors" index={index} value={g.Middlename} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Surname" name="Surname" section="guarantors" index={index} value={g.Surname} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="ID Number" name="idNumber" section="guarantors" index={index} value={g.idNumber} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Mobile Number" name="mobile" section="guarantors" index={index} value={g.mobile} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Alternative Number" name="alternativeMobile" section="guarantors" index={index} value={g.alternativeMobile} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Date of Birth" name="dateOfBirth" type="date" section="guarantors" index={index} value={g.dateOfBirth} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Gender" name="gender" section="guarantors" index={index} value={g.gender} options={["Male", "Female"]} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Relationship" name="relationship" section="guarantors" index={index} value={g.relationship} placeholder="e.g. Spouse, Friend" handleNestedChange={handleNestedChange} required errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Occupation" name="occupation" section="guarantors" index={index} value={g.occupation} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="County" name="county" section="guarantors" index={index} value={g.county} options={KENYA_COUNTIES} handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="City/Town" name="cityTown" section="guarantors" index={index} value={g.cityTown} options={g.county ? COUNTY_TOWNS[g.county] : []} handleNestedChange={handleNestedChange} errors={errors} placeholder="Select County first" isAmendment={isAmendmentMode} disabled={disabled} />
                    </div>

                    {imageUploadEnabled && (
                      <div className="mt-8 pt-6 border-t border-gray-50">
                        <h4 className="text-sm text-slate-600 mb-4 flex items-center gap-2">
                          <IdentificationIcon className="w-4 h-4" /> Guarantor {index + 1} Documents
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {[
                            { key: "passport", label: "Passport Photo", setter: setGuarantorPassportFiles, files: guarantorPassportFiles },
                            { key: "idFront", label: "ID Front", setter: setGuarantorIdFrontFiles, files: guarantorIdFrontFiles },
                            { key: "idBack", label: "ID Back", setter: setGuarantorIdBackFiles, files: guarantorIdBackFiles },
                          ].map((file) => (
                            <div key={file.key} className="p-4 border border-brand-surface rounded-xl bg-muted">
                              <label className="block text-xs mb-3 ">{file.label}</label>
                              <div className="flex flex-col gap-2">
                                <label className="w-full flex items-center justify-center gap-2 px-1 py-0.5 bg-white border border-gray-200 text-brand-primary rounded-lg cursor-pointer hover:bg-brand-surface transition text-sm font-medium">
                                  <ArrowUpTrayIcon className="w-4 h-4" /> Upload
                                  <input type="file" accept="image/*" onChange={(e) => {
                                    const f = e.target.files[0];
                                    if (f) file.setter(prev => { const n = [...prev]; n[index] = f; return n; });
                                  }} className="hidden" />
                                </label>
                                <label className="flex md:hidden items-center justify-center gap-2 px-1 py-0.5 bg-brand-btn text-white rounded-lg cursor-pointer hover:bg-brand-primary font-medium text-sm">
                                  <CameraIcon className="w-4 h-4" /> Camera
                                  <input type="file" accept="image/*" capture={file.key === "passport" ? "user" : "environment"} onChange={(e) => {
                                    const f = e.target.files[0];
                                    if (f) file.setter(prev => { const n = [...prev]; n[index] = f; return n; });
                                  }} className="hidden" />
                                </label>
                              </div>
                              {existingImages[`guarantor${file.key.charAt(0).toUpperCase() + file.key.slice(1)}`]?.[index] && !file.files[index] && (
                                <div className="mt-3 relative">
                                  <img src={existingImages[`guarantor${file.key.charAt(0).toUpperCase() + file.key.slice(1)}`][index]} alt={file.label} className="w-full h-24 object-cover rounded-lg border border-indigo-100 shadow-sm" />
                                  <div className="absolute top-1 left-1 bg-brand-primary text-white text-[10px] px-1.5 rounded-md">Existing</div>
                                  <button type="button" onClick={() => handleRemoveExistingImage(`guarantor${file.key.charAt(0).toUpperCase() + file.key.slice(1)}`, index)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md"><XMarkIcon className="w-3 h-3" /></button>
                                </div>
                              )}
                              {file.files[index] && (
                                <div className="mt-3 relative">
                                  <img src={file.files[index] instanceof File ? URL.createObjectURL(file.files[index]) : file.files[index]} alt={file.label} className="w-full h-24 object-cover rounded-lg border border-brand-primary shadow-sm" />
                                  <div className="absolute top-1 left-1 bg-green-600 text-white text-[10px] px-1.5 rounded-md">New</div>
                                  <button type="button" onClick={() => file.setter(prev => { const n = [...prev]; n[index] = null; return n; })} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md"><XMarkIcon className="w-3 h-3" /></button>
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
                      className="flex items-center gap-2 px-4 py-2 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                    >
                      <PlusIcon className="h-3 w-3" />
                      Add Another Guarantor
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Guarantor Security ── */}
            {activeSection === "guarantorSecurity" && (
              <div className="space-y-8">
                {errors.guarantorSecurityItems && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-700 text-sm">{errors.guarantorSecurityItems}</p>
                  </div>
                )}
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-sm text-slate-600 flex items-center">
                    <ShieldCheckIcon className="h-4 w-4 text-slate-600 mr-3" /> Guarantor Security Items
                  </h2>
                  {sectionAmendmentDetails.length > 0 && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs text-red-700 font-medium flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                        Required Amendments: {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {guarantorSecurityItems.map((item, index) => (
                    <div key={index} className="bg-muted rounded-xl p-6 border border-brand-surface">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm text-slate-600 flex items-center">
                          <ShieldCheckIcon className="h-5 w-5 text-brand-primary mr-2" /> Guarantor Security Item {index + 1}
                        </h3>
                        {guarantorSecurityItems.length > 1 && (
                          <button type="button" onClick={() => removeGuarantorSecurityItem(index)} className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="mb-4">
                          <label className=" text-sm text-slate-600 mb-1">Type</label>
                          <select name="type" value={item.type || ""} onChange={(e) => handleGuarantorSecurityChange(e, index)} className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none ${isAmendmentMode ? "border-red-300 bg-red-50" : ""}`} required disabled={disabled}>
                            <option className="text-600 text-sm" value="">-- Select Security Type --</option>
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

                        {item.type === "Other (specify)" && (
                          <div className="mb-4">
                            <FormField label="Specific Security Type" name="otherType" value={item.otherType} onChange={(e) => handleGuarantorSecurityChange(e, index)} placeholder="Describe the security type..." required errors={errors} index={index} isAmendment={isAmendmentMode} disabled={disabled} />
                          </div>
                        )}
                        <FormField label="Description" name="description" value={item.description} onChange={(e) => handleGuarantorSecurityChange(e, index)} required errors={errors} index={index} className="mb-4" isAmendment={isAmendmentMode} />
                        <FormField label="Est. Market Value (KES)" name="value" type="number" value={item.value} onChange={(e) => handleGuarantorSecurityChange(e, index)} required errors={errors} index={index} className="mb-4" isAmendment={isAmendmentMode} />
                      </div>

                      {imageUploadEnabled && (
                        <div className="mt-6">
                          <label className=" text-sm font-medium mb-3 text-slate-600">Item Images</label>
                          <div className="flex gap-3 mb-4">
                            <label className="flex items-center justify-center gap-2 px-1 py-0.5 bg-brand-primary text-white text-xs rounded-lg cursor-pointer hover:bg-brand-secondary transition  border border-brand-surface">
                              <ArrowUpTrayIcon className="w-2 h-2" /> Upload
                              <input type="file" accept="image/*" multiple onChange={(e) => handleMultipleFiles(e, index, setGuarantorSecurityImages)} className="hidden" />
                            </label>
                            <label className="flex md:hidden items-center justify-center gap-2 px-4 py-2 bg-brand-btn text-white rounded-lg cursor-pointer hover:bg-brand-primary transition-all duration-200">
                              <CameraIcon className="w-4 h-4" /> Camera
                              <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => handleMultipleFiles(e, index, setGuarantorSecurityImages)} className="hidden" />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                            {existingImages.guarantorSecurity?.[index]?.map((url, imgIdx) => url && (
                              <div key={`exist-gsec-${index}-${imgIdx}`} className="relative group">
                                <img src={url} alt={`Existing Guarantor Security ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-indigo-100 shadow-sm" />
                                <div className="absolute top-1 left-1 bg-brand-primary text-white text-[10px] px-1.5 rounded-md">Existing</div>
                                <button type="button" onClick={() => handleRemoveExistingImage("guarantorSecurity", index, imgIdx)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-md"><XMarkIcon className="w-3 h-3" /></button>
                              </div>
                            ))}
                            {guarantorSecurityImages[index]?.map((img, imgIdx) => (
                              <div key={`new-gsec-${index}-${imgIdx}`} className="relative group">
                                <img src={img instanceof Blob ? URL.createObjectURL(img) : img} alt={`New Guarantor Security ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-brand-primary shadow-sm" />
                                <div className="absolute top-1 left-1 bg-green-600 text-white text-[10px] px-1.5 rounded-md">New</div>
                                <button type="button" onClick={() => handleRemoveMultipleFile(index, imgIdx, setGuarantorSecurityImages)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-md"><XMarkIcon className="w-4 h-4" /></button>
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
                      onClick={addGuarantorSecurityItem}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Another Guarantor Security Item
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Next of Kin ── */}
            {activeSection === "nextOfKin" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-sm text-slate-600 flex items-center">
                    <UserGroupIcon className="h-4 w-4 text-slate-600 mr-3" /> Next of Kin Information
                  </h2>
                  {sectionAmendmentDetails.length > 0 && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs text-red-700 font-medium flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                        Required Amendments: {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                      </p>
                    </div>
                  )}
                </div>

                {formData.nextOfKins.map((nok, index) => (
                  <div key={index} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
                      <h3 className="text-sm text-slate-600 flex items-center gap-2">
                        <span className="w-4 h-4 bg-brand-primary text-white text-xs rounded-full flex items-center justify-center">{index + 1}</span>
                        Next of Kin Entry {index + 1}
                      </h3>
                      {formData.nextOfKins.length > 1 && (
                        <button type="button" onClick={() => removeNextOfKin(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"><TrashIcon className="w-5 h-5" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FormField label="First Name" name="Firstname" section="nextOfKins" index={index} value={nok.Firstname} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Surname" name="Surname" section="nextOfKins" index={index} value={nok.Surname} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="ID Number" name="idNumber" section="nextOfKins" index={index} value={nok.idNumber} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      <FormField label="Relationship" name="relationship" section="nextOfKins" index={index} value={nok.relationship} options={["Spouse", "Parent", "Sibling", "Child", "Other"]} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      {nok.relationship === "Other" && (
                        <FormField label="Specify Relationship" name="relationshipOther" section="nextOfKins" index={index} value={nok.relationshipOther} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      )}
                      <FormField label="Mobile Number" name="mobile" section="nextOfKins" index={index} value={nok.mobile} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                      
                      <div className="mb-4">
                        <label className=" text-xs text-slate-600 mb-1">Employment Status *</label>
                        <select
                          name="employmentStatus"
                          value={nok.employmentStatus || ""}
                          onChange={(e) => handleNestedChange(e, 'nextOfKins', index)}
                          className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-primary/20 focus:outline-none ${isAmendmentMode ? "border-red-300 bg-red-50" : ""}`}
                          required
                          disabled={disabled}
                        >
                          <option value="">Select Employment Status</option>
                          <option value="Employed">Employed</option>
                          <option value="Self Employed">Self Employed</option>
                        </select>
                      </div>

                      {nok.employmentStatus === "Employed" && (
                        <>
                          <FormField label="Company Name" name="companyName" section="nextOfKins" index={index} value={nok.companyName} handleNestedChange={handleNestedChange} isAmendment={isAmendmentMode} disabled={disabled} />
                          <FormField label="Estimated Salary (KES)" name="salary" type="number" section="nextOfKins" index={index} value={nok.salary} handleNestedChange={handleNestedChange} isAmendment={isAmendmentMode} disabled={disabled} />
                        </>
                      )}

                      {nok.employmentStatus === "Self Employed" && (
                        <>
                          <FormField label="Business Name" name="businessName" section="nextOfKins" index={index} value={nok.businessName} handleNestedChange={handleNestedChange} isAmendment={isAmendmentMode} disabled={disabled} />
                          <FormField label="Estimated Income (KES)" name="businessIncome" type="number" section="nextOfKins" index={index} value={nok.businessIncome} handleNestedChange={handleNestedChange} isAmendment={isAmendmentMode} disabled={disabled} />
                        </>
                      )}
                      <FormField label="County" name="county" section="nextOfKins" index={index} value={nok.county} options={KENYA_COUNTIES} required handleNestedChange={handleNestedChange} errors={errors} isAmendment={isAmendmentMode} disabled={disabled} />
                    </div>
                  </div>
                ))}

                {formData.nextOfKins.length < 3 && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={addNextOfKin}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Another Next of Kin
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Documents ── */}
            {activeSection === "documents" && (
              <div className="space-y-8">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-sm font-semibold text-slate-600 flex items-center">
                    <DocumentTextIcon className="h-4 w-4 text-slate-600 mr-3" /> Document Verification
                  </h2>
                  {sectionAmendmentDetails.length > 0 && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs text-red-700 font-medium flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                        Required Amendments: {sectionAmendmentDetails.map(detail => detail.fields?.join(', ')).join('; ')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { key: "officerClient1", label: "First Officer & Client", handler: setOfficerClientImage1 },
                    { key: "officerClient2", label: "Second Officer & Client", handler: setOfficerClientImage2 },
                    { key: "bothOfficers", label: "Both Officers & Client", handler: setBothOfficersImage },
                  ].map((file) => (
                    <div key={file.key} className="flex flex-col items-start p-4 border border-brand-surface rounded-xl bg-muted shadow-sm hover:shadow-md transition">
                      <label className="block text-sm font-medium text-brand-primary mb-3">{file.label}</label>
                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <label className="flex-1 flex items-center justify-center gap-2 px-2 py-0.5 bg-brand-primary text-white rounded-lg shadow-sm cursor-pointer hover:bg-brand-secondary transition">
                          <ArrowUpTrayIcon className="w-4 h-4" />
                          <span className="text-sm text-white">{existingImages[file.key] ? "Replace" : "Upload"}</span>
                          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, file.handler, file.key)} className="hidden" />
                        </label>
                      </div>
                      {existingImages[file.key] && !previews[file.key] && (
                        <div className="mt-4 w-full">
                          <div className="relative">
                            <img src={existingImages[file.key]} alt={file.label} className="w-full h-40 object-cover rounded-lg border border-indigo-100 shadow-sm" />
                            <div className="absolute top-2 left-2 bg-brand-primary text-white text-[10px] px-1.5 rounded-md">Existing</div>
                            <button type="button" onClick={() => handleRemoveExistingImage(file.key)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md"><XMarkIcon className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                      {previews[file.key] && (
                        <div className="mt-4 w-full">
                          <div className="relative group">
                            <img src={previews[file.key].url || previews[file.key]} alt={file.label} className="w-full h-40 object-cover rounded-lg border border-brand-primary shadow-sm" />
                            <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] px-1.5 rounded-md">New</div>
                            <button type="button" onClick={() => handleRemoveFile(file.key, file.handler)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-md"><XMarkIcon className="w-4 h-4" /></button>
                          </div>
                          {previews[file.key].fileName && (
                            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                              <p className="text-xs text-muted truncate" title={previews[file.key].fileName}>📄 {previews[file.key].fileName}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-200">
              <div className="flex items-center gap-4">
                {activeSection !== sections[0].id && (
                  <button type="button" onClick={() => { const i = sections.findIndex(s => s.id === activeSection); setActiveSection(sections[i - 1].id); }} className="flex items-center gap-2 px-4 py-2 bg-neutral text-slate-600 text-xs rounded-lg hover:bg-brand-surface transition-colors" disabled={isSubmitting || isSavingDraft}>
                    <ChevronLeftIcon className="h-4 w-4" /> Previous
                  </button>
                )}
                {handleSaveDraft && (
                  <button type="button" onClick={handleSaveDraft} disabled={isSavingDraft || isSubmitting} className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs rounded-lg hover:bg-brand-primary/80 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSavingDraft ? (
                      <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Saving Draft...</div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs"><DocumentTextIcon className="h-4 w-4" />Save as Draft</div>
                    )}
                  </button>
                )}
              </div>

              <div>
                {activeSection !== sections[sections.length - 1].id ? (
                  <button type="button" onClick={handleNext} className="flex items-center gap-2 px-4 py-2 bg-neutral text-salte-600 text-xs rounded-lg hover:bg-brand-surface transition-colors disabled:opacity-50" disabled={isSubmitting || isSavingDraft || isValidating}>
                    {isValidating ? (
                      <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-primary border-t-transparent"></div>Validating...</div>
                    ) : (
                      <><span className="text-xs ">Next</span><ChevronRightIcon className="h-4 w-4" /></>
                    )}
                  </button>
                ) : (
                  <button type="submit" disabled={isSubmitting || isSavingDraft} className="px-4 py-2 bg-accent text-white text-xs rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? (
                      <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Submitting Application...</div>
                    ) : (
                      <div className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 " />Submit Application</div>
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

  return content;
};

export default Form;
