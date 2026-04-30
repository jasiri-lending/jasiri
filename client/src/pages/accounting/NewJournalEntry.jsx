import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Phone, Building, X, ArrowRight, IdCard } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import { useToast } from "../../components/Toast.jsx";
import { usePermissions } from "../../hooks/usePermissions";

function NewJournalEntry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const [amountError, setAmountError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  // Search state for Primary Customer (Sender/Main)
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef(null);

  // Search state for Recipient (Transfer To)
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const recipientDropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    journal_type: "",
    account_type: "",
    account_name: "",
    amount: "",
    description: "",
    customer_id: "",
    customer_phone: "",
    customer_name: "",
    customer_id_number: "",
    account_search: "",
    // Recipient fields
    recipient_id: "",
    recipient_name: "",
    recipient_id_number: "",
    recipient_phone: "",
    recipient_search: "",
    customer_wallet_balance: 0
  });

  const { profile } = useAuth();

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setShowAccountDropdown(false);
      }
      if (recipientDropdownRef.current && !recipientDropdownRef.current.contains(event.target)) {
        setShowRecipientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Search customers when user types
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (formData.account_search && formData.account_search.length >= 2) {
        searchCustomers(formData.account_search, 'primary');
      } else {
        setCustomers([]);
        setShowAccountDropdown(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [formData.account_search]);

  // Search recipients when user types
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (formData.recipient_search && formData.recipient_search.length >= 2) {
        searchCustomers(formData.recipient_search, 'recipient');
      } else {
        setRecipients([]);
        setShowRecipientDropdown(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [formData.recipient_search]);

  const searchCustomers = async (searchTerm, type) => {
    if (!profile?.tenant_id) return;

    if (type === 'primary') setSearchingCustomers(true);
    else setSearchingRecipients(true);

    try {
      const response = await apiFetch(
        `/api/journals/search-customers?tenant_id=${profile.tenant_id}&search=${encodeURIComponent(searchTerm)}`
      );
      const data = await response.json();
      if (data.success) {
        if (type === 'primary') {
          setCustomers(data.customers || []);
          setShowAccountDropdown(true);
        } else {
          setRecipients(data.customers || []);
          setShowRecipientDropdown(true);
        }
      } else {
        toast.error("Error searching customers: " + data.error);
      }
    } catch (error) {
      console.error("Error searching customers:", error);
      toast.error("Failed to search customers. Please try again.");
    } finally {
      if (type === 'primary') setSearchingCustomers(false);
      else setSearchingRecipients(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear description error when typing
    if (name === 'description' && value.trim()) {
      setDescriptionError("");
    }

    // Live Validation for Amount
    if (name === 'amount' || name === 'journal_type') {
      const amount = name === 'amount' ? parseFloat(value) : parseFloat(formData.amount);
      const type = name === 'journal_type' ? value : formData.journal_type;
      const balance = parseFloat(formData.customer_wallet_balance);

      if (amount && (type === 'transfer' || type === 'debit')) {
        if (amount > balance) {
          setAmountError(`Amount exceeds wallet balance (KES ${balance.toLocaleString()})`);
        } else {
          setAmountError("");
        }
      } else {
        setAmountError("");
      }
    }
  };

  const selectCustomer = (customer) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customer.id,
      customer_phone: customer.phone,
      customer_id_number: customer.id_number,
      customer_name: customer.display_name,
      account_name: customer.display_name,
      account_search: customer.display_name,
      customer_wallet_balance: customer.wallet_balance || 0
    }));
    setShowAccountDropdown(false);
    
    // Clear amount error when customer changes
    setAmountError("");
  };

  const selectRecipient = (customer) => {
    setFormData(prev => ({
      ...prev,
      recipient_id: customer.id,
      recipient_name: customer.display_name,
      recipient_id_number: customer.id_number,
      recipient_phone: customer.phone,
      recipient_search: customer.display_name
    }));
    setShowRecipientDropdown(false);
  };

  const clearCustomerSelection = () => {
    setFormData(prev => ({
      ...prev,
      customer_id_number: "",
      customer_name: "",
      account_name: "",
      account_search: ""
    }));
    setCustomers([]);
  };

  const clearRecipientSelection = () => {
    setFormData(prev => ({
      ...prev,
      recipient_id: "",
      recipient_name: "",
      recipient_id_number: "",
      recipient_phone: "",
      recipient_search: ""
    }));
    setRecipients([]);
  };
  
  const resetForm = () => {
    setFormData({
      journal_type: "",
      account_type: "",
      account_name: "",
      amount: "",
      description: "",
      customer_id: "",
      customer_phone: "",
      customer_name: "",
      customer_id_number: "",
      account_search: "",
      recipient_id: "",
      recipient_name: "",
      recipient_id_number: "",
      recipient_phone: "",
      recipient_search: "",
      customer_wallet_balance: 0
    });
    setAmountError("");
    setDescriptionError("");
    setCustomers([]);
    setRecipients([]);
  };

  const createJournal = async () => {
    if (!formData.journal_type) {
      toast.error("Please select a journal type.");
      return;
    }

    if (!formData.account_type) {
      toast.error("Please select an account type.");
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }

    if (!formData.customer_id) {
      toast.error("Please select a primary customer.");
      return;
    }

    if (formData.journal_type === 'transfer') {
      if (!formData.recipient_id) {
        toast.error("Please select a recipient for the transfer.");
        return;
      }
      if (formData.customer_id === formData.recipient_id) {
        toast.error("Sender and Recipient cannot be the same.");
        return;
      }
    }

    // Wallet Balance Validation for Transfer and Debit
    if (formData.journal_type === 'transfer' || formData.journal_type === 'debit') {
      const amount = parseFloat(formData.amount);
      const balance = parseFloat(formData.customer_wallet_balance);
      if (amount > balance) {
        toast.error(`Insufficient funds. Customer wallet balance is KES ${balance.toLocaleString()}.`);
        return;
      }
    }

    if (!formData.description || !formData.description.trim()) {
      setDescriptionError("Description is required.");
      toast.error("Please enter a description.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        journal_type: formData.journal_type,
        account_type: formData.account_type,
        amount: parseFloat(formData.amount),
        description: formData.description,
        tenant_id: profile?.tenant_id,
        customer_id: formData.customer_id,
        customer_name: formData.customer_name,
        recipient_id: formData.recipient_id || null
      };

      const response = await apiFetch(`/api/journals`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Journal created successfully!");
        // Use a slight delay or direct path to ensure navigation
        navigate("/accounting/journals");
        return;
      } else {
        toast.error(`Failed to create journal: ${data.error}`);
      }
    } catch (error) {
      console.error("Error creating journal:", error);
      toast.error("Failed to create journal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const journalTypes = [
    { value: "debit", label: "Debit (Withdrawal/Charge)" },
    { value: "credit", label: "Credit (Deposit/Top Up)" },
    { value: "transfer", label: "Transfer (Customer to Customer)" }
  ];

  const accountTypes = [
    { value: "Customer Account", label: "Customer Account" },
    { value: "General Ledger", label: "General Ledger" },
    { value: "Income", label: "Income" },
    { value: "Expense", label: "Expense" }
  ];

  // Helper Labels based on type
  const getPrimaryLabel = () => {
    if (formData.journal_type === 'transfer') return "Sender (From)";
    return "Customer Account";
  };

  return (
    <div className="p-6 bg-muted min-h-screen">
      <div className="mb-4 text-sm text-gray-600">
        Journals / Create Journal Voucher
      </div>

      {(!permsLoading && !hasPermission('journal.create')) ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-8 rounded-lg text-center">
          <h2 className="text-lg font-bold mb-2">Access Denied</h2>
          <p>You do not have permission to create journal entries.</p>
          <button 
            onClick={() => navigate("/accounting/journals")}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b">
          <div className="px-6 py-3">
            <span className="inline-block px-4 py-2 bg-brand-secondary text-white text-sm rounded">
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
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-btn focus:border-brand-btn"
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
                Account Type
              </label>
              <select
                name="account_type"
                value={formData.account_type}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-btn focus:border-brand-btn"
              >
                <option value="">Select account type...</option>
                {accountTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <span className="inline-block px-4 py-2 bg-brand-secondary text-white text-sm rounded">
              Transaction Details
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* PRIMARY ACCOUNT (Customer / Sender) */}
            <div className="relative" ref={accountDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getPrimaryLabel()}
              </label>
              <div className="relative">
                <input
                  name="account_search"
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-1 focus:ring-brand-btn focus:border-brand-btn"
                  type="text"
                  placeholder="Search Customer"
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
                              <div className="flex items-center gap-1 ml-2 border-l pl-2 border-gray-200">
                                <IdCard size={12} className="text-gray-400" />
                                <span className="text-xs text-gray-500">ID: {customer.id_number}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RECIPIENT ACCOUNT (Only for Transfers) */}
            {formData.journal_type === 'transfer' && (
              <div className="relative" ref={recipientDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient (To)
                </label>
                <div className="relative">
                  <input
                    name="recipient_search"
                    className="w-full border border-gray-300 rounded px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-1 focus:ring-brand-btn focus:border-brand-btn"
                    type="text"
                    placeholder="Search Recipient"
                    value={formData.recipient_search}
                    onChange={handleInputChange}
                    autoComplete="off"
                  />
                  {formData.recipient_id && (
                    <button
                      type="button"
                      onClick={clearRecipientSelection}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {showRecipientDropdown && recipients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                    {recipients.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => selectRecipient(customer)}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start gap-3">
                          <div className="bg-purple-50 p-2 rounded-full">
                            <User size={14} className="text-purple-600" />
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
                                <div className="flex items-center gap-1 ml-2 border-l pl-2 border-gray-200">
                                  <IdCard size={12} className="text-gray-400" />
                                  <span className="text-xs text-gray-500">ID: {customer.id_number}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <input
                name="amount"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-btn focus:border-brand-btn"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={handleInputChange}
              />
              {amountError && (
                <p className="mt-1 text-xs text-red-500 font-medium">{amountError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-btn focus:border-brand-btn resize-none"
                rows="3"
                placeholder="Enter description..."
                value={formData.description}
                onChange={handleInputChange}
              />
              {descriptionError && (
                <p className="mt-1 text-xs text-red-500 font-medium">{descriptionError}</p>
              )}
            </div>
          </div>

          {/* SELECTION SUMMARY */}
          {(formData.customer_id || formData.recipient_id) && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center gap-4">
                {/* Sender / Primary */}
                {formData.customer_id && (
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-1.5 rounded-full">
                      <User size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{formData.customer_name}</p>
                      <p className="text-[10px] text-gray-500">{formData.customer_phone} {formData.customer_id_number && `| ID: ${formData.customer_id_number}`}</p>
                      <p className="text-[10px] text-brand-primary font-semibold mt-1">Wallet Balance: KES {formData.customer_wallet_balance.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {/* Arrow if Transfer */}
                {formData.journal_type === 'transfer' && formData.customer_id && formData.recipient_id && (
                  <div className="flex-shrink-0">
                    <ArrowRight size={16} className="text-gray-400" />
                  </div>
                )}

                {/* Recipient */}
                {formData.recipient_id && (
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-100 p-1.5 rounded-full">
                      <User size={14} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{formData.recipient_name}</p>
                      <p className="text-[10px] text-gray-500">
                        {formData.recipient_phone} {formData.recipient_id_number && `| ID: ${formData.recipient_id_number}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="border-t px-6 py-4 flex justify-between items-center bg-gray-50">
          <button
            onClick={() => navigate("/accounting/journals")}
            className="px-4 py-2 rounded flex items-center gap-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex gap-3">
            <button
              onClick={createJournal}
              disabled={loading || !!amountError}
              className={`px-6 py-2 rounded text-sm font-medium text-white bg-brand-primary hover:bg-[#1E3A8A] transition-colors ${loading || amountError ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => navigate("/accounting/journals")}
              className="px-6 py-2 rounded text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

export default NewJournalEntry;
