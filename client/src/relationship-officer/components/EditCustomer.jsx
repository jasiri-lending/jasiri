import React, { useState, useEffect, memo, useCallback } from "react";
import {
  UserCircleIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import Form, { KENYA_COUNTIES, COUNTY_TOWNS, INDUSTRIES } from "./Form";

const parseNumber = (val) => {
  if (val === null || val === undefined || val === "" || val === "undefined") {
    return null;
  }
  const n = Number(val);
  return isNaN(n) ? null : n;
};

const EditCustomerForm = ({ customerId, onClose }) => {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeSection, setActiveSection] = useState("personal");

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

  const sections = [
    { id: "personal", label: "Personal", icon: UserCircleIcon },
    { id: "business", label: "Business", icon: BuildingOffice2Icon },
    { id: "borrowerSecurity", label: "Security", icon: ShieldCheckIcon },
    { id: "loan", label: "Loan", icon: CurrencyDollarIcon },
    { id: "guarantor", label: "Guarantors", icon: UserGroupIcon },
    { id: "guarantorSecurity", label: "G-Security", icon: ShieldCheckIcon },
    { id: "nextOfKin", label: "Next of Kin", icon: UserGroupIcon },
  ];

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

  const removeGuarantor = (index) => {
    setFormData(prev => ({
      ...prev,
      guarantors: prev.guarantors.filter((_, i) => i !== index)
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

  const removeNextOfKin = (index) => {
    setFormData(prev => ({
      ...prev,
      nextOfKins: prev.nextOfKins.filter((_, i) => i !== index)
    }));
  };

  const addSecurityItem = () => {
    setSecurityItems([...securityItems, { item: "", description: "", identification: "", value: "" }]);
  };

  const removeSecurityItem = (index) => {
    setSecurityItems(securityItems.filter((_, i) => i !== index));
  };

  const handleSecurityChange = (e, index) => {
    const { name, value } = e.target;
    setSecurityItems(prev => prev.map((item, idx) => idx === index ? { ...item, [name]: value } : item));
  };

  const addGuarantorSecurityItem = () => {
    setGuarantorSecurityItems([...guarantorSecurityItems, { item: "", description: "", identification: "", value: "" }]);
  };

  const removeGuarantorSecurityItem = (index) => {
    setGuarantorSecurityItems(guarantorSecurityItems.filter((_, i) => i !== index));
  };

  const handleGuarantorSecurityChange = (e, index) => {
    const { name, value } = e.target;
    setGuarantorSecurityItems(prev => prev.map((item, idx) => idx === index ? { ...item, [name]: value } : item));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);

    try {
      const [custResult] = await Promise.all([
        supabase
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
          .eq("id", customerId),

        formData.maritalStatus === "Married" ? 
          supabase.from("spouse").upsert({
            customer_id: customerId,
            name: formData.spouse.name,
            id_number: formData.spouse.idNumber,
            mobile: formData.spouse.mobile,
            economic_activity: formData.spouse.economicActivity,
            tenant_id: profile?.tenant_id
          }, { onConflict: "customer_id" }) : 
          supabase.from("spouse").delete().eq("customer_id", customerId),

        supabase.from("guarantors").delete().eq("customer_id", customerId),
        supabase.from("next_of_kin").delete().eq("customer_id", customerId),
        supabase.from("security_items").delete().eq("customer_id", customerId)
      ]);

      if (custResult.error) throw custResult.error;

      const insertPromises = [];

      if (formData.nextOfKins.length > 0) {
        insertPromises.push(supabase.from("next_of_kin").insert(formData.nextOfKins.map(nk => ({
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
        }))));
      }

      if (securityItems.length > 0) {
        insertPromises.push(supabase.from("security_items").insert(securityItems.map(s => ({
          customer_id: customerId,
          item: s.item,
          description: s.description,
          identification: s.identification,
          value: parseNumber(s.value),
          tenant_id: profile?.tenant_id
        }))));
      }

      if (formData.guarantors.length > 0) {
        const guarantorAction = async () => {
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
        };
        insertPromises.push(guarantorAction());
      }

      await Promise.all(insertPromises);

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
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4 font-body">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl border border-gray-200 flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white z-10 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserCircleIcon className="h-6 w-6 text-brand-primary" />
            Edit Customer Registry Details
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Form
            mode="modal"
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            formData={formData}
            handleChange={handleChange}
            handleNestedChange={handleNestedChange}
            errors={errors}
            sections={sections}
            completedSections={new Set()}
            isSubmitting={isSubmitting}
            securityItems={securityItems}
            handleSecurityChange={handleSecurityChange}
            addSecurityItem={addSecurityItem}
            removeSecurityItem={removeSecurityItem}
            guarantorSecurityItems={guarantorSecurityItems}
            handleGuarantorSecurityChange={handleGuarantorSecurityChange}
            addGuarantorSecurityItem={addGuarantorSecurityItem}
            removeGuarantorSecurityItem={removeGuarantorSecurityItem}
            addGuarantor={addGuarantor}
            removeGuarantor={removeGuarantor}
            addNextOfKin={addNextOfKin}
            removeNextOfKin={removeNextOfKin}
            handleSubmit={handleSubmit}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default EditCustomerForm;
