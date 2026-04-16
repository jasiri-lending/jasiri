import React, { useState, useEffect, memo, useCallback } from "react";
import {
  UserCircleIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";

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

const parseNumber = (val) => {
  if (val === null || val === undefined || val === "" || val === "undefined") {
    return null;
  }
  const n = Number(val);
  return isNaN(n) ? null : n;
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

    if (section && index !== undefined && index !== null) {
      errorMessage = errors[`${section}_${index}_${name}`];
    } else if (section) {
      errorMessage = errors[`${section}${name.charAt(0).toUpperCase() + name.slice(1)}`] || errors[section]?.[name];
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
            onChange={section ? (e) => handleNestedChange(e, section, index) : onChange}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors ${errorMessage ? "border-red-500" : "border-gray-300"}`}
            required={required}
            disabled={disabled}
          >
            <option value="">{placeholder || `Select ${label}`}</option>
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            name={name}
            type={type}
            value={value || ""}
            onChange={section ? (e) => handleNestedChange(e, section, index) : onChange}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors ${errorMessage ? "border-red-500" : "border-gray-300"}`}
            required={required}
            placeholder={placeholder}
            disabled={disabled}
          />
        )}
        {errorMessage && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}
      </div>
    );
  }
);

const EditCustomerForm = ({ customerId, onClose }) => {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    prefix: "",
    Firstname: "",
    Middlename: "",
    Surname: "",
    gender: "",
    dateOfBirth: "",
    maritalStatus: "",
    residenceStatus: "",
    mobile: "",
    idNumber: "",
    postalAddress: "",
    code: "",
    town: "",
    county: "",
    businessName: "",
    industry: "",
    businessType: "",
    yearEstablished: "",
    businessLocation: "",
    road: "",
    landmark: "",
    hasLocalAuthorityLicense: "",
    daily_Sales: "",
    prequalifiedAmount: "",
    guarantors: [],
    nextOfKins: [],
    spouse: {
      name: "",
      idNumber: "",
      mobile: "",
      economicActivity: "",
    },
  });

  const [securityItems, setSecurityItems] = useState([]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([]);

  useEffect(() => {
    if (!customerId) return;
    fetchCustomerData();
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const { data: customer, error: custError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();
      if (custError) throw custError;

      const [
        { data: guarantors },
        { data: nextOfKins },
        { data: security },
        { data: spouseData },
        { data: guarantorSecurity }
      ] = await Promise.all([
        supabase.from("guarantors").select("*").eq("customer_id", customerId),
        supabase.from("next_of_kin").select("*").eq("customer_id", customerId),
        supabase.from("security_items").select("*").eq("customer_id", customerId),
        supabase.from("spouse").select("*").eq("customer_id", customerId),
        supabase.from("guarantor_security").select("*, guarantors!inner(customer_id)").eq("guarantors.customer_id", customerId)
      ]);

      const spouse = spouseData?.[0] || null;

      setFormData({
        prefix: customer.prefix || "",
        Firstname: customer.Firstname || "",
        Middlename: customer.Middlename || "",
        Surname: customer.Surname || "",
        dateOfBirth: customer.date_of_birth || "",
        gender: customer.gender || "",
        maritalStatus: customer.marital_status || "",
        residenceStatus: customer.residence_status || "",
        mobile: customer.mobile || "",
        idNumber: customer.id_number?.toString() || "",
        postalAddress: customer.postal_address || "",
        code: customer.code?.toString() || "",
        town: customer.town || "",
        county: customer.county || "",
        businessName: customer.business_name || "",
        industry: customer.industry || "",
        businessType: customer.business_type || "",
        yearEstablished: customer.year_established || "",
        businessLocation: customer.business_location || "",
        road: customer.road || "",
        landmark: customer.landmark || "",
        hasLocalAuthorityLicense: customer.has_local_authority_license ? "Yes" : "No",
        daily_Sales: customer.daily_Sales?.toString() || "",
        prequalifiedAmount: customer.prequalifiedAmount?.toString() || "",
        spouse: {
          name: spouse?.name || "",
          idNumber: spouse?.id_number || "",
          mobile: spouse?.mobile || "",
          economicActivity: spouse?.economic_activity || "",
        },
        guarantors: guarantors?.map(g => ({
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
          postalAddress: g.postal_address || "",
          code: g.code?.toString() || "",
          occupation: g.occupation || "",
          relationship: g.relationship || "",
          county: g.county || "",
          cityTown: g.city_town || ""
        })) || [],
        nextOfKins: nextOfKins?.map(nk => ({
          id: nk.id,
          Firstname: nk.Firstname || "",
          Middlename: nk.Middlename || "",
          Surname: nk.Surname || "",
          idNumber: nk.id_number?.toString() || "",
          relationship: nk.relationship || "",
          mobile: nk.mobile || "",
          county: nk.county || "",
          cityTown: nk.city_town || ""
        })) || [],
      });

      setSecurityItems(security?.map(s => ({
        item: s.item || "",
        description: s.description || "",
        identification: s.identification || "",
        value: s.value?.toString() || ""
      })) || []);

      setGuarantorSecurityItems(guarantorSecurity?.map(gs => ({
        item: gs.item || "",
        description: gs.description || "",
        identification: gs.identification || "",
        value: gs.estimated_market_value?.toString() || ""
      })) || []);

    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load customer data");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === "county") updated.town = "";
      if (name === "industry") updated.businessType = "";
      return updated;
    });
  };

  const handleNestedChange = (e, section, index = null) => {
    const { name, value } = e.target;
    setFormData(prev => {
      if (index !== null) {
        const newList = [...prev[section]];
        newList[index] = { ...newList[index], [name]: value };
        if (name === "county") newList[index].cityTown = "";
        return { ...prev, [section]: newList };
      }
      return { ...prev, [section]: { ...prev[section], [name]: value } };
    });
  };

  const addGuarantor = () => {
    if (formData.guarantors.length >= 3) return toast.error("Max 3 guarantors");
    setFormData(prev => ({
      ...prev,
      guarantors: [...prev.guarantors, {
        prefix: "", Firstname: "", Surname: "", Middlename: "", idNumber: "",
        maritalStatus: "", gender: "", mobile: "", postalAddress: "", code: "",
        occupation: "", relationship: "", dateOfBirth: "", county: "", cityTown: ""
      }]
    }));
  };

  const addNextOfKin = () => {
    if (formData.nextOfKins.length >= 3) return toast.error("Max 3 Next of Kin");
    setFormData(prev => ({
      ...prev,
      nextOfKins: [...prev.nextOfKins, {
        Firstname: "", Surname: "", Middlename: "", idNumber: "",
        relationship: "", mobile: "", county: "", cityTown: ""
      }]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Update Customer
      const { error: custError } = await supabase
        .from("customers")
        .update({
          prefix: formData.prefix,
          Firstname: formData.Firstname,
          Middlename: formData.Middlename,
          Surname: formData.Surname,
          date_of_birth: formData.dateOfBirth,
          gender: formData.gender,
          marital_status: formData.maritalStatus,
          residence_status: formData.residenceStatus,
          mobile: formData.mobile,
          id_number: parseNumber(formData.idNumber),
          postal_address: formData.postalAddress,
          code: parseNumber(formData.code),
          town: formData.town,
          county: formData.county,
          business_name: formData.businessName,
          industry: formData.industry,
          business_type: formData.businessType,
          year_established: formData.yearEstablished,
          business_location: formData.businessLocation,
          road: formData.road,
          landmark: formData.landmark,
          has_local_authority_license: formData.hasLocalAuthorityLicense === "Yes",
          daily_Sales: parseNumber(formData.daily_Sales),
          prequalifiedAmount: parseNumber(formData.prequalifiedAmount),
          updated_at: new Date().toISOString()
        })
        .eq("id", customerId);
      if (custError) throw custError;

      // 2. Spouse
      if (formData.maritalStatus === "Married") {
        await supabase.from("spouse").upsert({
          customer_id: customerId,
          name: formData.spouse.name,
          id_number: formData.spouse.idNumber,
          mobile: formData.spouse.mobile,
          economic_activity: formData.spouse.economicActivity,
          tenant_id: profile?.tenant_id
        }, { onConflict: "customer_id" });
      }

      // 3. Delete then Insert Strategy
      await Promise.all([
        supabase.from("guarantors").delete().eq("customer_id", customerId),
        supabase.from("next_of_kin").delete().eq("customer_id", customerId),
        supabase.from("security_items").delete().eq("customer_id", customerId)
      ]);

      // Insert Guarantors
      if (formData.guarantors.length > 0) {
        const { data: insertedGuarantors, error: gError } = await supabase
          .from("guarantors")
          .insert(formData.guarantors.map(g => ({
            customer_id: customerId,
            prefix: g.prefix,
            Firstname: g.Firstname,
            Middlename: g.Middlename,
            Surname: g.Surname,
            id_number: parseNumber(g.idNumber),
            marital_status: g.maritalStatus,
            gender: g.gender,
            date_of_birth: g.dateOfBirth,
            mobile: g.mobile,
            postal_address: g.postalAddress,
            code: parseNumber(g.code),
            occupation: g.occupation,
            relationship: g.relationship,
            county: g.county,
            city_town: g.cityTown,
            tenant_id: profile?.tenant_id,
            branch_id: profile?.branch_id
          })))
          .select();
        if (gError) throw gError;

        // Guarantor Security (Link to first guarantor for simplicity as per plan)
        if (guarantorSecurityItems.length > 0 && insertedGuarantors?.[0]) {
          await supabase.from("guarantor_security").delete().eq("guarantor_id", insertedGuarantors[0].id);
          await supabase.from("guarantor_security").insert(guarantorSecurityItems.map(gs => ({
            guarantor_id: insertedGuarantors[0].id,
            item: gs.item,
            description: gs.description,
            identification: gs.identification,
            estimated_market_value: parseNumber(gs.value),
            tenant_id: profile?.tenant_id
          })));
        }
      }

      // Insert Next of Kin
      if (formData.nextOfKins.length > 0) {
        await supabase.from("next_of_kin").insert(formData.nextOfKins.map(nk => ({
          customer_id: customerId,
          Firstname: nk.Firstname,
          Middlename: nk.Middlename,
          Surname: nk.Surname,
          id_number: parseNumber(nk.idNumber),
          relationship: nk.relationship,
          mobile: nk.mobile,
          county: nk.county,
          city_town: nk.cityTown,
          tenant_id: profile?.tenant_id
        })));
      }

      // Insert Security Items
      if (securityItems.length > 0) {
        await supabase.from("security_items").insert(securityItems.map(s => ({
          customer_id: customerId,
          item: s.item,
          description: s.description,
          identification: s.identification,
          value: parseNumber(s.value),
          tenant_id: profile?.tenant_id
        })));
      }

      toast.success("Customer updated successfully!");
      onClose();
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to update customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-gray-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserCircleIcon className="h-6 w-6 text-brand-primary" />
            Edit Customer Registry Details
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form className="p-8 space-y-10" onSubmit={handleSubmit}>
          {/* Personal Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b border-gray-200 pb-4">
              <UserCircleIcon className="h-6 w-6 text-brand-primary" />
              <h3 className="text-lg font-bold text-gray-800">Personal Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField label="Prefix" name="prefix" value={formData.prefix} onChange={handleChange} options={["Mr", "Mrs", "Ms", "Dr"]} />
              <FormField label="First Name" name="Firstname" value={formData.Firstname} onChange={handleChange} required />
              <FormField label="Middle Name" name="Middlename" value={formData.Middlename} onChange={handleChange} />
              <FormField label="Surname" name="Surname" value={formData.Surname} onChange={handleChange} required />
              <FormField label="Gender" name="gender" value={formData.gender} onChange={handleChange} options={["Male", "Female"]} />
              <FormField label="Date of Birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} />
              <FormField label="Marital Status" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} options={["Single", "Married", "Separated/Divorced", "Other"]} />
              <FormField label="Mobile" name="mobile" value={formData.mobile} onChange={handleChange} />
              <FormField label="ID Number" name="idNumber" value={formData.idNumber} onChange={handleChange} />
              <FormField label="County" name="county" value={formData.county} onChange={handleChange} options={KENYA_COUNTIES} />
              <FormField label="Town" name="town" value={formData.town} onChange={handleChange} options={formData.county ? COUNTY_TOWNS[formData.county] : []} />
              <FormField label="Postal Address" name="postalAddress" value={formData.postalAddress} onChange={handleChange} />
            </div>

            {formData.maritalStatus === "Married" && (
              <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-md font-bold mb-4">Spouse Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="Spouse Name" name="name" value={formData.spouse.name} section="spouse" handleNestedChange={handleNestedChange} />
                  <FormField label="Spouse ID" name="idNumber" value={formData.spouse.idNumber} section="spouse" handleNestedChange={handleNestedChange} />
                  <FormField label="Spouse Mobile" name="mobile" value={formData.spouse.mobile} section="spouse" handleNestedChange={handleNestedChange} />
                  <FormField label="Economic Activity" name="economicActivity" value={formData.spouse.economicActivity} section="spouse" handleNestedChange={handleNestedChange} />
                </div>
              </div>
            )}
          </section>

          {/* Business Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b border-gray-200 pb-4">
              <BuildingOffice2Icon className="h-6 w-6 text-brand-primary" />
              <h3 className="text-lg font-bold text-gray-800">Business Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField label="Business Name" name="businessName" value={formData.businessName} onChange={handleChange} />
              <FormField label="Industry" name="industry" value={formData.industry} onChange={handleChange} options={Object.keys(INDUSTRIES)} />
              <FormField label="Business Type" name="businessType" value={formData.businessType} onChange={handleChange} options={formData.industry ? INDUSTRIES[formData.industry] : []} />
              <FormField label="Year Established" name="yearEstablished" value={formData.yearEstablished} onChange={handleChange} />
              <FormField label="Daily Sales (KES)" name="daily_Sales" type="number" value={formData.daily_Sales} onChange={handleChange} />
              <FormField label="Location" name="businessLocation" value={formData.businessLocation} onChange={handleChange} />
            </div>
          </section>

          {/* Guarantors Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b border-gray-200 pb-4">
              <UserGroupIcon className="h-6 w-6 text-brand-primary" />
              <h3 className="text-lg font-bold text-gray-800">Guarantors</h3>
            </div>
            {formData.guarantors.map((g, i) => (
              <div key={i} className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 relative">
                {formData.guarantors.length > 1 && (
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, guarantors: prev.guarantors.filter((_, idx) => idx !== i) }))} className="absolute top-4 right-4 text-red-500 hover:text-red-700">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
                <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Guarantor {i + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField label="First Name" name="Firstname" value={g.Firstname} section="guarantors" index={i} handleNestedChange={handleNestedChange} />
                  <FormField label="Surname" name="Surname" value={g.Surname} section="guarantors" index={i} handleNestedChange={handleNestedChange} />
                  <FormField label="ID Number" name="idNumber" value={g.idNumber} section="guarantors" index={i} handleNestedChange={handleNestedChange} />
                  <FormField label="Mobile" name="mobile" value={g.mobile} section="guarantors" index={i} handleNestedChange={handleNestedChange} />
                  <FormField label="Relationship" name="relationship" value={g.relationship} section="guarantors" index={i} handleNestedChange={handleNestedChange} />
                  <FormField label="County" name="county" value={g.county} section="guarantors" index={i} handleNestedChange={handleNestedChange} options={KENYA_COUNTIES} />
                  <FormField label="Town" name="cityTown" value={g.cityTown} section="guarantors" index={i} handleNestedChange={handleNestedChange} options={g.county ? COUNTY_TOWNS[g.county] : []} />
                </div>
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
          </section>

          {/* Next of Kin Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b border-gray-200 pb-4">
              <UserGroupIcon className="h-6 w-6 text-brand-primary" />
              <h3 className="text-lg font-bold text-gray-800">Next of Kin</h3>
            </div>
            {formData.nextOfKins.map((nk, i) => (
              <div key={i} className="mb-6 p-6 bg-gray-50 rounded-xl border border-gray-200 relative">
                {formData.nextOfKins.length > 1 && (
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, nextOfKins: prev.nextOfKins.filter((_, idx) => idx !== i) }))} className="absolute top-4 right-4 text-red-500 hover:text-red-700">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField label="First Name" name="Firstname" value={nk.Firstname} section="nextOfKins" index={i} handleNestedChange={handleNestedChange} />
                  <FormField label="Surname" name="Surname" value={nk.Surname} section="nextOfKins" index={i} handleNestedChange={handleNestedChange} />
                  <FormField label="Mobile" name="mobile" value={nk.mobile} section="nextOfKins" index={i} handleNestedChange={handleNestedChange} />
                  <FormField label="Relationship" name="relationship" value={nk.relationship} section="nextOfKins" index={i} handleNestedChange={handleNestedChange} />
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
          </section>

          {/* Security Section */}
          <section>
            <div className="flex items-center gap-3 mb-6 border-b border-gray-200 pb-4">
              <ShieldCheckIcon className="h-6 w-6 text-brand-primary" />
              <h3 className="text-lg font-bold text-gray-800">Borrower Security</h3>
            </div>
            {securityItems.map((s, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                <input placeholder="Item" value={s.item} onChange={(e) => setSecurityItems(prev => prev.map((item, idx) => idx === i ? { ...item, item: e.target.value } : item))} className="p-3 border rounded-lg" />
                <input placeholder="Description" value={s.description} onChange={(e) => setSecurityItems(prev => prev.map((item, idx) => idx === i ? { ...item, description: e.target.value } : item))} className="p-3 border rounded-lg" />
                <input placeholder="Identification" value={s.identification} onChange={(e) => setSecurityItems(prev => prev.map((item, idx) => idx === i ? { ...item, identification: e.target.value } : item))} className="p-3 border rounded-lg" />
                <input placeholder="Value" type="number" value={s.value} onChange={(e) => setSecurityItems(prev => prev.map((item, idx) => idx === i ? { ...item, value: e.target.value } : item))} className="p-3 border rounded-lg" />
              </div>
            ))}
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() => setSecurityItems([...securityItems, { item: "", description: "", identification: "", value: "" }])}
                className="flex items-center gap-2 px-6 py-3 bg-brand-surface text-brand-primary border border-brand-primary border-dashed rounded-lg hover:bg-brand-primary/5 transition-all font-medium"
              >
                <PlusIcon className="h-5 w-5" />
                Add Security Item
              </button>
            </div>
          </section>

          <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-all font-bold shadow-lg disabled:opacity-50">
              {isSubmitting ? "Updating..." : "Update Customer Registry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCustomerForm;
