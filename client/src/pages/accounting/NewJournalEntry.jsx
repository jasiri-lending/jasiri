import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Phone, Building, X } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { API_BASE_URL } from "../../../config";

function NewJournalEntry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef(null);
  
  const [formData, setFormData] = useState({
    journal_type: "",
    account_type: "",
    account_name: "",
    amount: "",
    description: "",
    customer_id: "",
    customer_phone: "",
    customer_name: "",
    account_search: ""
  });

  const { profile } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setShowAccountDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Search customers when user types in account name field
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (formData.account_search && formData.account_search.length >= 2) {
        searchCustomers(formData.account_search);
      } else {
        setCustomers([]);
        setShowAccountDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.account_search]);

  const searchCustomers = async (searchTerm) => {
    if (!profile?.tenant_id) return;
    
    setSearchingCustomers(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch(
        `${API_BASE_URL}/api/journals/search-customers?tenant_id=${profile.tenant_id}&search=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setCustomers(data.customers || []);
        setShowAccountDropdown(true);
      }
    } catch (error) {
      console.error("Error searching customers:", error);
    } finally {
      setSearchingCustomers(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const selectCustomer = (customer) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customer.id,
      customer_phone: customer.phone,
      customer_name: customer.display_name,
      account_name: customer.display_name,
      account_search: customer.display_name
    }));
    setShowAccountDropdown(false);
  };

  const clearCustomerSelection = () => {
    setFormData(prev => ({
      ...prev,
      customer_id: "",
      customer_phone: "",
      customer_name: "",
      account_name: "",
      account_search: ""
    }));
    setCustomers([]);
  };

  const createJournal = async () => {
    if (!formData.journal_type) {
      alert("Please select a journal type.");
      return;
    }

    if (!formData.account_type) {
      alert("Please select an account type.");
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    if (!formData.account_name || !formData.customer_id) {
      alert("Please search and select a customer.");
      return;
    }

    if (!formData.description) {
      alert("Please enter a description.");
      return;
    }

    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_BASE_URL}/api/journals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          journal_type: formData.journal_type,
          account_type: formData.account_type,
          amount: parseFloat(formData.amount),
          description: formData.description,
          tenant_id: profile?.tenant_id,
          customer_id: formData.customer_id,
          customer_name: formData.customer_name
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert("Journal created successfully!");
        navigate("/journals");
      } else {
        alert(`Failed to create journal: ${data.error}`);
      }
    } catch (error) {
      console.error("Error creating journal:", error);
      alert("Failed to create journal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const journalTypes = [
    { value: "debit", label: "Debit" },
    { value: "credit", label: "Credit" }
  ];

  const accountTypes = [
    { value: "Customer Account", label: "Customer Account" },
    { value: "General Ledger", label: "General Ledger" }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-4 text-sm text-gray-600">
        Journals / Create Journal Voucher
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b">
          <div className="px-6 py-3">
            <span className="inline-block px-4 py-2 bg-teal-500 text-white text-sm rounded">
              Journal Voucher
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                name="journal_type"
                value={formData.journal_type}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select type...</option>
                {journalTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Name
              </label>
              <input
                name="account_name"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                type="text"
                value={formData.account_name}
                readOnly
                placeholder="Selected customer will appear here"
              />
            </div>
          </div>

          <div className="mb-4">
            <span className="inline-block px-4 py-2 bg-teal-500 text-white text-sm rounded">
              Journal Details
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
              </label>
              <select
                name="account_type"
                value={formData.account_type}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select account type...</option>
                {accountTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative" ref={accountDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Name
              </label>
              <div className="relative">
                <input
                  name="account_search"
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  type="text"
                  placeholder="Search Account"
                  value={formData.account_search}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
                {formData.customer_id && (
                  <button
                    type="button"
                    onClick={clearCustomerSelection}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {showAccountDropdown && customers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                  {searchingCustomers ? (
                    <div className="p-3 text-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Searching...</p>
                    </div>
                  ) : (
                    <>
                      {customers.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => selectCustomer(customer)}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className="bg-blue-50 p-2 rounded-full">
                              {customer.business_name ? (
                                <Building size={14} className="text-blue-600" />
                              ) : (
                                <User size={14} className="text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {customer.display_name}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {customer.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone size={12} className="text-gray-500" />
                                    <span className="text-xs text-gray-600">{customer.phone}</span>
                                  </div>
                                )}
                                {customer.id_number && (
                                  <span className="text-xs text-gray-500">
                                    ID: {customer.id_number}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {formData.account_search && customers.length === 0 && !searchingCustomers && formData.account_search.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    No customer found. Try phone number or ID.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <input
                name="amount"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 resize-none"
                rows="3"
                placeholder="Enter description..."
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {formData.customer_id && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <User size={16} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formData.customer_name}</p>
                    {formData.customer_phone && (
                      <div className="flex items-center gap-1 mt-1">
                        <Phone size={12} className="text-gray-500" />
                        <span className="text-xs text-gray-600">{formData.customer_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearCustomerSelection}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Change
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4 flex justify-between items-center bg-gray-50">
          <button
            onClick={() => navigate("/journals")}
            className="px-4 py-2 rounded flex items-center gap-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex gap-3">
            <button
              onClick={createJournal}
              disabled={loading}
              className={`px-6 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => navigate("/journals")}
              className="px-6 py-2 rounded text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewJournalEntry;