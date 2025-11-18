import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const parseNumber = (val) => {
  if (val === null || val === undefined || val === "" || val === "undefined") {
    return null;
  }
  const n = Number(val);
  return isNaN(n) ? null : n;
};

const EditCustomerForm = ({ customerId, onClose }) => {
  const [securityItems, setSecurityItems] = useState([]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([
    { item: "", description: "", identification: "", value: "" },
  ]);

  const [formData, setFormData] = useState({
    prefix: "",
    Firstname: "",
    Surname: "",
    Middlename: "",
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
    yearEstablished: "",
    businessLocation: "",
    road: "",
    landmark: "",
    hasLocalAuthorityLicense: "",
    guarantor: {
      prefix: "",
      Firstname: "",
      Surname: "",
      Middlename: "",
      idNumber: "",
      maritalStatus: "",
      gender: "",
      dateOfBirth: "",
      mobile: "",
      postalAddress: "",
      code: "",
      occupation: "",
      relationship: "",
    },
    nextOfKin: {
      Firstname: "",
      Surname: "",
      Middlename: "",
      idNumber: "",
      relationship: "",
      mobile: "",
    },
  });

  // Fetch existing customer data
  useEffect(() => {
    if (!customerId) return;

    const fetchCustomerData = async () => {
      try {
        // Fetch customer
        const { data: customer, error: custError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .single();
        if (custError) throw custError;

        setFormData((prev) => ({
          ...prev,
          prefix: customer.prefix || "",
          Firstname: customer.Firstname || "",
          Middlename: customer.Middlename || "",
          Surname: customer.Surname || "",
          dateOfBirth: customer.date_of_birth || "",
          gender: customer.gender || "",
          maritalStatus: customer.marital_status || "",
          residenceStatus: customer.residence_status || "",
          mobile: customer.mobile || "",
          idNumber: customer.id_number ? customer.id_number.toString() : "",
          postalAddress: customer.postal_address || "",
          code: customer.code ? customer.code.toString() : "",
          town: customer.town || "",
          county: customer.county || "",
          businessName: customer.business_name || "",
          yearEstablished: customer.year_established
            ? customer.year_established.toString()
            : "",
          businessLocation: customer.business_location || "",
          road: customer.road || "",
          landmark: customer.landmark || "",
          hasLocalAuthorityLicense: customer.has_local_authority_license
            ? "Yes"
            : "No",
        }));

        // Fetch guarantor
        const { data: guarantor } = await supabase
          .from("guarantors")
          .select("*")
          .eq("customer_id", customerId)
          .single();
        if (guarantor) {
          setFormData((prev) => ({
            ...prev,
            guarantor: {
              prefix: guarantor.prefix || "",
              Firstname: guarantor.Firstname || "",
              Middlename: guarantor.Middlename || "",
              Surname: guarantor.Surname || "",
              idNumber: guarantor.id_number
                ? guarantor.id_number.toString()
                : "",
              maritalStatus: guarantor.marital_status || "",
              gender: guarantor.gender || "",
              dateOfBirth: guarantor.date_of_birth || "",
              mobile: guarantor.mobile || "",
              postalAddress: guarantor.postal_address || "",
              code: guarantor.code ? guarantor.code.toString() : "",
              occupation: guarantor.occupation || "",
              relationship: guarantor.relationship || "",
            },
          }));

          // Fetch guarantor security
          const { data: gSecurity } = await supabase
            .from("guarantor_security")
            .select("*")
            .eq("guarantor_id", guarantor.id);

          setGuarantorSecurityItems(
            gSecurity && gSecurity.length
              ? gSecurity.map((item) => ({
                  item: item.item || "",
                  description: item.description || "",
                  identification: item.identification || "",
                  value: item.estimated_market_value
                    ? item.estimated_market_value.toString()
                    : "",
                }))
              : [{ item: "", description: "", identification: "", value: "" }]
          );
        }

        // Fetch next of kin
        const { data: nextOfKin } = await supabase
          .from("next_of_kin")
          .select("*")
          .eq("customer_id", customerId)
          .single();
        if (nextOfKin) {
          setFormData((prev) => ({
            ...prev,
            nextOfKin: {
              Firstname: nextOfKin.Firstname || "",
              Surname: nextOfKin.Surname || "",
              Middlename: nextOfKin.Middlename || "",
              idNumber: nextOfKin.id_number
                ? nextOfKin.id_number.toString()
                : "",
              relationship: nextOfKin.relationship || "",
              mobile: nextOfKin.mobile || "",
            },
          }));
        }

        // Fetch borrower security
        const { data: security } = await supabase
          .from("security_items")
          .select("*")
          .eq("customer_id", customerId);

        setSecurityItems(
          security && security.length
            ? security.map((s) => ({
                item: s.item || "",
                description: s.description || "",
                identification: s.identification || "",
                value: s.value ? s.value.toString() : "",
              }))
            : [{ item: "", description: "", identification: "", value: "" }]
        );
      } catch (err) {
        console.error("Error fetching customer data:", err.message);
      }
    };

    fetchCustomerData();
  }, [customerId]);

  // Change handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value || "" }));
  };

  const handleNestedChange = (e, section) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [name]: value || "" },
    }));
  };

  const handleSecurityChange = (e, index) => {
    const { name, value } = e.target;
    const newItems = [...securityItems];
    newItems[index][name] = value || "";
    setSecurityItems(newItems);
  };

  const addSecurityItem = () => {
    setSecurityItems([
      ...securityItems,
      { item: "", description: "", identification: "", value: "" },
    ]);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Customer update
      const customerUpdate = {
        prefix: formData.prefix || null,
        Firstname: formData.Firstname || null,
        Surname: formData.Surname || null,
        Middlename: formData.Middlename || null,
        marital_status: formData.maritalStatus || null,
        residence_status: formData.residenceStatus || null,
        mobile: formData.mobile || null,
        id_number: parseNumber(formData.idNumber),
        postal_address: formData.postalAddress || null,
        code: parseNumber(formData.code),
        town: formData.town || null,
        county: formData.county || null,
        business_name: formData.businessName || null,
        year_established: parseNumber(formData.yearEstablished),
        business_location: formData.businessLocation || null,
        road: formData.road || null,
        landmark: formData.landmark || null,
        has_local_authority_license:
          formData.hasLocalAuthorityLicense === "Yes",
      };
      await supabase.from("customers").update(customerUpdate).eq("id", customerId);

      // Guarantor update
      const guarantorUpdate = {
        customer_id: customerId,
        prefix: formData.guarantor.prefix || null,
        Firstname: formData.guarantor.Firstname || null,
        Surname: formData.guarantor.Surname || null,
        Middlename: formData.guarantor.Middlename || null,
        id_number: parseNumber(formData.guarantor.idNumber),
        marital_status: formData.guarantor.maritalStatus || null,
        gender: formData.guarantor.gender || null,
        date_of_birth: formData.guarantor.dateOfBirth || null,
        mobile: formData.guarantor.mobile || null,
        postal_address: formData.guarantor.postalAddress || null,
        code: parseNumber(formData.guarantor.code),
        occupation: formData.guarantor.occupation || null,
        relationship: formData.guarantor.relationship || null,
      };

      const { data: guarantorData, error: guarError } = await supabase
        .from("guarantors")
        .upsert(guarantorUpdate, { onConflict: "customer_id" })
        .select()
        .single();
      if (guarError) throw guarError;

      // Guarantor security update
      if (guarantorSecurityItems && guarantorSecurityItems.length > 0) {
        const payload = guarantorSecurityItems
          .filter((i) => i.item || i.description || i.identification || i.value)
          .map((i) => ({
            guarantor_id: guarantorData.id,
            item: i.item,
            description: i.description,
            identification: i.identification,
            estimated_market_value: parseNumber(i.value),
          }));
        if (payload.length > 0) {
          await supabase.from("guarantor_security").upsert(payload, { onConflict: "id" });
        }
      }

      // Next of kin update
      const nextOfKinUpdate = {
        customer_id: customerId,
        Firstname: formData.nextOfKin.Firstname || null,
        Surname: formData.nextOfKin.Surname || null,
        Middlename: formData.nextOfKin.Middlename || null,
        id_number: parseNumber(formData.nextOfKin.idNumber),
        relationship: formData.nextOfKin.relationship || null,
        mobile: formData.nextOfKin.mobile || null,
      };
      await supabase.from("next_of_kin").upsert(nextOfKinUpdate, { onConflict: "customer_id" });

      // Borrower security update
      await supabase.from("security_items").delete().eq("customer_id", customerId);
      for (const item of securityItems) {
        if (item.item || item.description || item.identification || item.value) {
          const securityItem = {
            customer_id: customerId,
            item: item.item || null,
            description: item.description || null,
            identification: item.identification || null,
            value: parseNumber(item.value),
          };
          await supabase.from("security_items").insert(securityItem);
        }
      }

      toast.success("Customer details updated successfully!");
      onClose();
    } catch (err) {
      console.error("Update error:", err.message);
      toast.error("Failed to update: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
      <div className="bg-white w-full max-w-6xl h-[90vh] overflow-y-auto rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            Mular Credit Limited - Edit Customer
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit}>
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              Personal Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                name="prefix"
                value={formData.prefix}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              >
                <option value="">Select Prefix</option>
                <option>Mr</option>
                <option>Mrs</option>
                <option>Ms</option>
              </select>
              <input
                type="text"
                name="Firstname"
                placeholder="First Name"
                value={formData.Firstname}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="Surname"
                placeholder="Surname"
                value={formData.Surname}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <select
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              >
                <option value="">Select Marital Status</option>
                <option>Single</option>
                <option>Married</option>
                <option>Separated/Divorced</option>
                <option>Other</option>
              </select>
              <select
                name="residenceStatus"
                value={formData.residenceStatus}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              >
                <option value="">Residence Status</option>
                <option>Own</option>
                <option>Rent</option>
                <option>Family</option>
                <option>Other</option>
              </select>
              <input
                type="text"
                name="mobile"
                placeholder="Mobile Number"
                onChange={handleChange}
                value={formData.mobile}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="idNumber"
                placeholder="ID Number"
                value={formData.idNumber}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="postalAddress"
                placeholder="Postal Address"
                value={formData.postalAddress}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="code"
                placeholder="Code"
                value={formData.code}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="town"
                placeholder="Town / City"
                value={formData.town}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="county"
                placeholder="County"
                value={formData.county}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
            </div>
          </section>
          {/* BUSINESS INFORMATION */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              Business Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="businessName"
                placeholder="Business Name"
                value={formData.businessName}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="number"
                name="yearEstablished"
                placeholder="Year Established"
                value={formData.yearEstablished}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="businessLocation"
                placeholder="Business Location"
                value={formData.businessLocation}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="road"
                placeholder="Road"
                value={formData.road}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="landmark"
                placeholder="Landmark (e.g. Mosque)"
                value={formData.landmark}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
              <select
                name="hasLocalAuthorityLicense"
                value={formData.hasLocalAuthorityLicense}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              >
                <option value="">Have Local Authority Licence?</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </section>

          {/* BORROWER SECURITY */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              Borrower Security
            </h3>
            {securityItems.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3"
              >
                <input
                  type="text"
                  name="item"
                  placeholder="Item"
                  value={item.item}
                  onChange={(e) => handleSecurityChange(e, index)}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="text"
                  name="description"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => handleSecurityChange(e, index)}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="text"
                  name="identification"
                  placeholder="Identification (e.g. Serial No.)"
                  value={item.identification}
                  onChange={(e) => handleSecurityChange(e, index)}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="number"
                  name="value"
                  placeholder="Est. Market Value (KES)"
                  value={item.value}
                  onChange={(e) => handleSecurityChange(e, index)}
                  className="border p-2 rounded w-full"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addSecurityItem}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              + Add Item
            </button>
          </section>

          {/* GUARANTOR DETAILS */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              Guarantor Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                name="prefix"
                value={formData.guarantor.prefix}
                onChange={(e) => handleNestedChange(e, "guarantor")}
                className="border p-2 rounded w-full"
              >
                <option value="">Select Prefix</option>
                <option>Mr</option>
                <option>Mrs</option>
                <option>Ms</option>
              </select>
              <select
                name="maritalStatus"
                value={formData.guarantor.maritalStatus}
                onChange={(e) => handleNestedChange(e, "guarantor")}
                className="border p-2 rounded w-full"
              >
                <option value="">Select Marital Status</option>
                <option>Single</option>
                <option>Married</option>
                <option>Separated/Divorced</option>
                <option>Other</option>
              </select>
              <select
                name="gender"
                value={formData.guarantor.gender}
                onChange={(e) => handleNestedChange(e, "guarantor")}
                className="border p-2 rounded w-full"
              >
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
              </select>
              <input
                type="text"
                name="mobile"
                placeholder="Mobile Number"
                value={formData.guarantor.mobile}
                onChange={(e) => handleNestedChange(e, "guarantor")}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="postalAddress"
                placeholder="Postal Address"
                value={formData.guarantor.postalAddress}
                onChange={(e) => handleNestedChange(e, "guarantor")}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="code"
                placeholder="Code"
                value={formData.guarantor.code}
                onChange={(e) => handleNestedChange(e, "guarantor")}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="occupation"
                placeholder="Occupation"
                value={formData.guarantor.occupation}
                onChange={(e) => handleNestedChange(e, "guarantor")}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="relationship"
                placeholder="Relationship with Borrower"
                value={formData.guarantor.relationship}
                onChange={(e) => handleNestedChange(e, "guarantor")}
                className="border p-2 rounded w-full"
              />
            </div>
          </section>

          {/* GUARANTOR SECURITY */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              Guarantor Security
            </h3>
            {guarantorSecurityItems.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3"
              >
                <input
                  type="text"
                  name="item"
                  placeholder="Item"
                  value={item.item}
                  onChange={(e) => {
                    const newItems = [...guarantorSecurityItems];
                    newItems[index][e.target.name] = e.target.value;
                    setGuarantorSecurityItems(newItems);
                  }}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="text"
                  name="description"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => {
                    const newItems = [...guarantorSecurityItems];
                    newItems[index][e.target.name] = e.target.value;
                    setGuarantorSecurityItems(newItems);
                  }}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="text"
                  name="identification"
                  placeholder="Identification"
                  value={item.identification}
                  onChange={(e) => {
                    const newItems = [...guarantorSecurityItems];
                    newItems[index][e.target.name] = e.target.value;
                    setGuarantorSecurityItems(newItems);
                  }}
                  className="border p-2 rounded w-full"
                />
                <input
                  type="number"
                  name="value"
                  placeholder="Est. Market Value (KES)"
                  value={item.value}
                  onChange={(e) => {
                    const newItems = [...guarantorSecurityItems];
                    newItems[index][e.target.name] = e.target.value;
                    setGuarantorSecurityItems(newItems);
                  }}
                  className="border p-2 rounded w-full"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setGuarantorSecurityItems([
                  ...guarantorSecurityItems,
                  { item: "", description: "", identification: "", value: "" },
                ])
              }
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              + Add Guarantor Security
            </button>
          </section>

          {/* NEXT OF KIN */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              Next of Kin
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                name="Firstname"
                placeholder="First Name"
                value={formData.nextOfKin.Firstname}
                onChange={(e) => handleNestedChange(e, "nextOfKin")}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="Surname"
                placeholder="Surname Name"
                value={formData.nextOfKin.Surname}
                onChange={(e) => handleNestedChange(e, "nextOfKin")}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="Middlename"
                placeholder="Middle Name"
                value={formData.nextOfKin.Middlename}
                onChange={(e) => handleNestedChange(e, "nextOfKin")}
                className="border p-2 rounded w-full"
              />

              <input
                type="text"
                name="idNumber"
                placeholder="ID Number"
                value={formData.nextOfKin.idNumber}
                onChange={(e) => handleNestedChange(e, "nextOfKin")}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="relationship"
                placeholder="Relationship"
                value={formData.nextOfKin.relationship}
                onChange={(e) => handleNestedChange(e, "nextOfKin")}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                name="mobile"
                placeholder="Mobile Number"
                value={formData.nextOfKin.mobile}
                onChange={(e) => handleNestedChange(e, "nextOfKin")}
                className="border p-2 rounded w-full"
              />
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCustomerForm;
