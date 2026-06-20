import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  UserIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  ArrowRightIcon,
  IdentificationIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import { useToast } from "../../components/Toast.jsx";
import { usePermissions } from "../../hooks/usePermissions";
import CustomSelect from "../../components/CustomSelect";
import Spinner from "../../components/Spinner";
import { SkeletonForm } from "../../components/Skeleton";

export default function NewJournalEntry() {
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
    customer_wallet_balance: 0,
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
        searchCustomers(formData.account_search, "primary");
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
        searchCustomers(formData.recipient_search, "recipient");
      } else {
        setRecipients([]);
        setShowRecipientDropdown(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [formData.recipient_search]);

  const searchCustomers = async (searchTerm, type) => {
    if (!profile?.tenant_id) return;

    if (type === "primary") setSearchingCustomers(true);
    else setSearchingRecipients(true);

    try {
      const response = await apiFetch(
        `/api/journals/search-customers?tenant_id=${profile.tenant_id}&search=${encodeURIComponent(
          searchTerm
        )}`
      );
      const data = await response.json();
      if (data.success) {
        if (type === "primary") {
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
      if (type === "primary") setSearchingCustomers(false);
      else setSearchingRecipients(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear description error when typing
    if (name === "description" && value.trim()) {
      setDescriptionError("");
    }

    // Live Validation for Amount
    if (name === "amount" || name === "journal_type") {
      const amount = name === "amount" ? parseFloat(value) : parseFloat(formData.amount);
      const type = name === "journal_type" ? value : formData.journal_type;
      const balance = parseFloat(formData.customer_wallet_balance);

      if (amount && (type === "transfer" || type === "debit")) {
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
    setFormData((prev) => ({
      ...prev,
      customer_id: customer.id,
      customer_phone: customer.phone,
      customer_id_number: customer.id_number,
      customer_name: customer.display_name,
      account_name: customer.display_name,
      account_search: customer.display_name,
      customer_wallet_balance: customer.wallet_balance || 0,
    }));
    setShowAccountDropdown(false);

    // Clear amount error when customer changes
    setAmountError("");
  };

  const selectRecipient = (customer) => {
    setFormData((prev) => ({
      ...prev,
      recipient_id: customer.id,
      recipient_name: customer.display_name,
      recipient_id_number: customer.id_number,
      recipient_phone: customer.phone,
      recipient_search: customer.display_name,
    }));
    setShowRecipientDropdown(false);
  };

  const clearCustomerSelection = () => {
    setFormData((prev) => ({
      ...prev,
      customer_id: "",
      customer_phone: "",
      customer_id_number: "",
      customer_name: "",
      account_name: "",
      account_search: "",
      customer_wallet_balance: 0,
    }));
    setCustomers([]);
  };

  const clearRecipientSelection = () => {
    setFormData((prev) => ({
      ...prev,
      recipient_id: "",
      recipient_name: "",
      recipient_id_number: "",
      recipient_phone: "",
      recipient_search: "",
    }));
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

    if (formData.journal_type === "transfer") {
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
    if (formData.journal_type === "transfer" || formData.journal_type === "debit") {
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
        recipient_id: formData.recipient_id || null,
      };

      const response = await apiFetch(`/api/journals`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Journal created successfully!");
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
    { value: "transfer", label: "Transfer (Customer to Customer)" },
  ];

  const accountTypes = [
    { value: "Customer Account", label: "Customer Account" },
    { value: "General Ledger", label: "General Ledger" },
    { value: "Income", label: "Income" },
    { value: "Expense", label: "Expense" },
  ];

  const getPrimaryLabel = () => {
    if (formData.journal_type === "transfer") return "Sender (From)";
    return "Customer Account";
  };

  const inputClass = (hasError) =>
    `block w-full rounded-lg border bg-card text-sm py-2 px-3 transition-all outline-none placeholder:text-muted ${
      hasError
        ? "border-danger/40 focus:border-danger focus:ring-2 focus:ring-danger-fill"
        : "border-border hover:border-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
    }`;

  if (permsLoading) {
    return (
      <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
        <div className="max-w-4xl mx-auto">
          <SkeletonForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumbs */}
        <div className="mb-2 text-xs text-muted">
          Journals / Create Journal Voucher
        </div>

        {!hasPermission("journal.create") ? (
          <div className="bg-card border border-danger/20 rounded-2xl shadow-card p-8 text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-danger-fill rounded-xl flex items-center justify-center mx-auto mb-4">
              <ShieldExclamationIcon className="w-6 h-6 text-danger" />
            </div>
            <h3 className="text-sm font-semibold text-heading mb-1">Access Denied</h3>
            <p className="text-xs text-muted mb-6">
              You do not have permission to create journal entries.
            </p>
            <button
              onClick={() => navigate("/accounting/journals")}
              className="w-full bg-brand-primary text-white py-2 rounded-lg hover:bg-brand-primary/90 transition-colors text-xs font-semibold"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-light bg-surface/10 flex items-center justify-between">
              <h1 className="text-sm font-semibold text-heading tracking-tight">
                Create Journal Voucher
              </h1>
              <span className="inline-block px-2.5 py-0.5 bg-success-fill text-success-text text-[10px] font-semibold tracking-wider uppercase rounded-full">
                Journal Voucher
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Type & Account Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-heading">
                    Type <span className="text-danger">*</span>
                  </label>
                  <CustomSelect
                    value={formData.journal_type}
                    onChange={(val) =>
                      handleInputChange({ target: { name: "journal_type", value: val } })
                    }
                    options={journalTypes}
                    placeholder="Select voucher type..."
                    fullWidth
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-heading">
                    Account Type <span className="text-danger">*</span>
                  </label>
                  <CustomSelect
                    value={formData.account_type}
                    onChange={(val) =>
                      handleInputChange({ target: { name: "account_type", value: val } })
                    }
                    options={accountTypes}
                    placeholder="Select account type..."
                    fullWidth
                  />
                </div>
              </div>

              {/* Section Divider */}
              <div className="pt-4 border-t border-border-light">
                <span className="text-xs font-semibold text-heading uppercase tracking-wider block mb-4">
                  Transaction Details
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* PRIMARY ACCOUNT (Customer / Sender) */}
                  <div className="relative space-y-1.5" ref={accountDropdownRef}>
                    <label className="block text-xs font-semibold text-heading">
                      {getPrimaryLabel()} <span className="text-danger">*</span>
                    </label>
                    <div className="relative">
                      <input
                        name="account_search"
                        className={inputClass(false)}
                        type="text"
                        placeholder="Search Customer..."
                        value={formData.account_search}
                        onChange={handleInputChange}
                        autoComplete="off"
                        disabled={!!formData.customer_id}
                      />
                      {formData.customer_id && (
                        <button
                          type="button"
                          onClick={clearCustomerSelection}
                          className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted hover:text-body transition-colors"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {showAccountDropdown && customers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-card border border-border shadow-card rounded-xl max-h-60 overflow-y-auto">
                        {customers.map((customer) => (
                          <div
                            key={customer.id}
                            onClick={() => selectCustomer(customer)}
                            className="p-3 hover:bg-surface cursor-pointer border-b border-border-light last:border-b-0 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="bg-success-fill p-2 rounded-lg text-brand-primary flex-shrink-0">
                                {customer.business_name ? (
                                  <BuildingOfficeIcon className="w-4 h-4" />
                                ) : (
                                  <UserIcon className="w-4 h-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-heading truncate">
                                  {customer.display_name}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {customer.phone && (
                                    <div className="flex items-center gap-1">
                                      <PhoneIcon className="w-3 h-3 text-muted" />
                                      <span className="text-[10px] text-muted">
                                        {customer.phone}
                                      </span>
                                    </div>
                                  )}
                                  {customer.id_number && (
                                    <div className="flex items-center gap-1 border-l pl-2 border-border-light">
                                      <IdentificationIcon className="w-3 h-3 text-muted" />
                                      <span className="text-[10px] text-muted">
                                        ID: {customer.id_number}
                                      </span>
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
                  {formData.journal_type === "transfer" && (
                    <div className="relative space-y-1.5" ref={recipientDropdownRef}>
                      <label className="block text-xs font-semibold text-heading">
                        Recipient (To) <span className="text-danger">*</span>
                      </label>
                      <div className="relative">
                        <input
                          name="recipient_search"
                          className={inputClass(false)}
                          type="text"
                          placeholder="Search Recipient..."
                          value={formData.recipient_search}
                          onChange={handleInputChange}
                          autoComplete="off"
                          disabled={!!formData.recipient_id}
                        />
                        {formData.recipient_id && (
                          <button
                            type="button"
                            onClick={clearRecipientSelection}
                            className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted hover:text-body transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {showRecipientDropdown && recipients.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-card border border-border shadow-card rounded-xl max-h-60 overflow-y-auto">
                          {recipients.map((customer) => (
                            <div
                              key={customer.id}
                              onClick={() => selectRecipient(customer)}
                              className="p-3 hover:bg-surface cursor-pointer border-b border-border-light last:border-b-0 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="bg-success-fill p-2 rounded-lg text-brand-primary flex-shrink-0">
                                  <UserIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-heading truncate">
                                    {customer.display_name}
                                  </p>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {customer.phone && (
                                      <div className="flex items-center gap-1">
                                        <PhoneIcon className="w-3 h-3 text-muted" />
                                        <span className="text-[10px] text-muted">
                                          {customer.phone}
                                        </span>
                                      </div>
                                    )}
                                    {customer.id_number && (
                                      <div className="flex items-center gap-1 border-l pl-2 border-border-light">
                                        <IdentificationIcon className="w-3 h-3 text-muted" />
                                        <span className="text-[10px] text-muted">
                                          ID: {customer.id_number}
                                        </span>
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
              </div>

              {/* Amount & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border-light">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-heading">
                    Amount (KES) <span className="text-danger">*</span>
                  </label>
                  <input
                    name="amount"
                    className={inputClass(amountError)}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={handleInputChange}
                  />
                  {amountError && (
                    <p className="mt-1 text-xs text-danger font-semibold">{amountError}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-heading">
                    Description <span className="text-danger">*</span>
                  </label>
                  <textarea
                    name="description"
                    className={`${inputClass(descriptionError)} resize-none`}
                    rows={3}
                    placeholder="Enter transaction narrative..."
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                  {descriptionError && (
                    <p className="mt-1 text-xs text-danger font-semibold">{descriptionError}</p>
                  )}
                </div>
              </div>

              {/* SELECTION SUMMARY */}
              {(formData.customer_id || formData.recipient_id) && (
                <div className="p-4 bg-surface/25 border border-border rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Sender / Primary */}
                    {formData.customer_id && (
                      <div className="flex items-start gap-3">
                        <div className="bg-success-fill p-2 rounded-lg text-brand-primary flex-shrink-0">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-heading">{formData.customer_name}</p>
                          <p className="text-[10px] text-muted">
                            Phone: {formData.customer_phone}{" "}
                            {formData.customer_id_number && `| ID: ${formData.customer_id_number}`}
                          </p>
                          <p className="text-[10px] text-brand-primary font-bold mt-1">
                            Wallet Balance: KES{" "}
                            {formData.customer_wallet_balance.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Arrow if Transfer */}
                    {formData.journal_type === "transfer" &&
                      formData.customer_id &&
                      formData.recipient_id && (
                        <div className="flex-shrink-0 self-center hidden sm:block">
                          <ArrowRightIcon className="w-4 h-4 text-muted" />
                        </div>
                      )}

                    {/* Recipient */}
                    {formData.recipient_id && (
                      <div className="flex items-start gap-3 border-t sm:border-t-0 sm:border-l border-border-light pt-3 sm:pt-0 sm:pl-4">
                        <div className="bg-success-fill p-2 rounded-lg text-brand-primary flex-shrink-0">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-heading">
                            {formData.recipient_name}
                          </p>
                          <p className="text-[10px] text-muted">
                            Phone: {formData.recipient_phone}{" "}
                            {formData.recipient_id_number &&
                              `| ID: ${formData.recipient_id_number}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Form Controls */}
            <div className="border-t border-border-light px-6 py-4 flex justify-between items-center bg-surface/20">
              <button
                type="button"
                onClick={() => navigate("/accounting/journals")}
                className="inline-flex items-center gap-1.5 bg-surface border border-border text-body px-3.5 py-2 rounded-lg hover:border-brand-primary/40 hover:text-brand-primary transition-colors text-xs font-medium"
              >
                <ArrowLeftIcon className="w-4 h-4" /> Back
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/accounting/journals")}
                  className="inline-flex items-center justify-center bg-surface border border-border text-body px-4 py-2 rounded-lg hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createJournal}
                  disabled={loading || !!amountError}
                  className="inline-flex items-center justify-center gap-1.5 bg-brand-primary text-white px-5 py-2 rounded-lg hover:bg-brand-primary/90 transition-all shadow-btn text-xs font-semibold active:scale-95 disabled:opacity-60"
                >
                  {loading ? <Spinner size="sm" /> : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
