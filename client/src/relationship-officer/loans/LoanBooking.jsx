// src/components/LoanBookingForm.jsx
import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";

import {
  CurrencyDollarIcon,
  CalendarIcon,
  UserIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  TagIcon,
  PencilIcon, ArrowLeftIcon,
} from "@heroicons/react/24/outline";

import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from "../../../config";
import Spinner from "../../components/Spinner.jsx";
import { useToast } from "../../components/Toast.jsx";

const LoanBookingForm = ({ customerData }) => {
  const [duration, setDuration] = useState(4);
  const location = useLocation();
  const navigate = useNavigate();
  const customer = customerData || location.state?.customerData;
  const toast = useToast();

  // Get customerData from navigation state

  const [principalAmount, setPrincipalAmount] = useState("");
  const [calculated, setCalculated] = useState({});
  const [repaymentSchedule, setRepaymentSchedule] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerType, setCustomerType] = useState("Unknown");
  const [selectedProductType, setSelectedProductType] = useState("");
  const { profile } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [products, setProducts] = useState([]);
  const [dbProductTypes, setDbProductTypes] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  //  destructure customer info + latest BM/RM values from parent
  const {
    id,
    id_number,
    Firstname,
    Surname,
    mobile,
    bmScoredAmount,
    caScoredAmount,
  } = customer || {};

  //  RM takes precedence → use CA score if available, else BM score
  const approved_amount = Number(caScoredAmount || bmScoredAmount || 0);

  // DEBUG: Log approved amount source on mount
  useEffect(() => {
    console.log("[LoanBooking] Customer & Approved Amount:", {
      customerId: id,
      name: `${Firstname} ${Surname}`,
      caScoredAmount,
      bmScoredAmount,
      approved_amount,
    });
  }, [approved_amount]);

  // Fetch products and types on mount
  useEffect(() => {
    if (profile?.tenant_id) {
      fetchAllData();
    }
  }, [profile?.tenant_id]);

  const fetchAllData = async () => {
    setIsInitialLoading(true);
    try {
      await Promise.all([
        fetchProducts(),
        fetchProductTypes()
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/loan-products?tenant_id=${profile.tenant_id}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const fetchProductTypes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/loan-products/types?tenant_id=${profile.tenant_id}`);
      const data = await res.json();
      if (data.success) {
        setDbProductTypes(data.data);
      }
    } catch (err) {
      console.error("Error fetching product types:", err);
    }
  };

  useEffect(() => {
    if (id) {
      checkCustomerType(id);
    }
  }, [id]);

  // Effect 1: Auto-select product type when principal or customer type changes
  useEffect(() => {
    if (principalAmount > 0 && dbProductTypes.length > 0) {
      autoSelectProductType();
    }
    // eslint-disable-next-line
  }, [principalAmount, isNewCustomer, dbProductTypes.length]);

  // Effect 2: Recalculate loan when product type, duration or principal changes
  useEffect(() => {
    if (principalAmount > 0 && selectedProductType) {
      calculateLoan();
    }
    // eslint-disable-next-line
  }, [principalAmount, duration, selectedProductType, isNewCustomer]);

  useEffect(() => {
    // Update duration when product type is selected
    if (selectedProductType) {
      const productType = dbProductTypes.find(
        type => type.product_type === selectedProductType
      );
      if (productType) {
        setDuration(productType.duration_weeks);
      }
    }
  }, [selectedProductType, dbProductTypes]);

  //  determine if customer is new or returning
  const checkCustomerType = async (customerId) => {
    const { data: loans, error } = await supabase
      .from("loans")
      .select("status")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) return;

    if (!loans || loans.length === 0) {
      setCustomerType("New Loan");
      setIsNewCustomer(true);
    } else {
      const hasApprovedLoan = loans.some(
        (ln) => ln.status === "disbursed" || ln.status === "pending_disbursement"
      );
      setCustomerType(hasApprovedLoan ? "Repeat" : "New Loan");
      setIsNewCustomer(!hasApprovedLoan);
    }
  };

  //  loan products by amount
  const getProductInfo = (amount) => {
    if (!amount || amount < 0) return { product: "", productName: "", range: "", baseName: "" };

    const matchedProduct = products.find(p => {
      const min = parseFloat(p.min_amount);
      const max = p.max_amount ? parseFloat(p.max_amount) : Infinity;
      return amount >= min && amount <= max;
    });

    if (matchedProduct) {
      return {
        product: matchedProduct.id,
        productName: matchedProduct.product_name,
        range: `KES ${parseFloat(matchedProduct.min_amount).toLocaleString()} - ${matchedProduct.max_amount ? parseFloat(matchedProduct.max_amount).toLocaleString() : 'Above'}`,
        baseName: matchedProduct.product_name,
        id: matchedProduct.id,
        registrationFee: parseFloat(matchedProduct.registration_fee || 0)
      };
    }

    return {
      product: "",
      productName: "Invalid Amount",
      range: "Enter a valid amount to see products",
      baseName: ""
    };
  };

  // Get available product types based on current product
  const getAvailableProductTypes = () => {
    const productInfo = getProductInfo(principalAmount);
    if (!productInfo.id) return [];
    return dbProductTypes.filter(type => type.loan_product_id === productInfo.id);
  };

  // Auto-select product type when amount changes
  const autoSelectProductType = () => {
    const availableTypes = getAvailableProductTypes();

    if (availableTypes && availableTypes.length > 0) {
      // Find the type that matches current duration or default to first option
      const matchingType = availableTypes.find(type => type.duration_weeks === duration) || availableTypes[0];
      setSelectedProductType(matchingType.product_type);
    } else {
      setSelectedProductType("");
    }
  };

  // recalc repayment schedule
  const calculateLoan = () => {
    const principal = Number(principalAmount) || 0;
    const productInfo = getProductInfo(principal);
    const availableTypes = getAvailableProductTypes();
    const activeType = availableTypes.find(t => t.product_type === selectedProductType) || availableTypes[0];

    if (!activeType) {
      setCalculated({ principal });
      return;
    }

    const durationWeeks = activeType.duration_weeks;
    const registrationFee = isNewCustomer ? (productInfo.registrationFee || 0) : 0;

    let processingFee = 0;
    if (activeType.processing_fee_mode === 'percentage') {
      processingFee = (principal * (activeType.processing_fee_rate || 0)) / 100;
    } else {
      processingFee = parseFloat(activeType.processing_fee_rate || 0);
    }

    // Interest = rate/100 * principal (rate stored as full duration rate in DB, e.g. 25 for 25%)
    const interestRate = parseFloat(activeType.interest_rate || 0);
    const totalInterest = (principal * interestRate) / 100;

    // Total Repayment = principal + interest ONLY (fees are NOT included)
    const totalPayable = principal + totalInterest;
    const weeklyPayment = totalPayable / durationWeeks;

    // DEBUG: comprehensive log
    console.log("[LoanBooking] Computation:", {
      principal,
      approved_amount,
      product: productInfo.productName,
      productType: activeType.product_type,
      interestRate,
      totalInterest,
      processingFee,
      registrationFee,
      totalPayable,
      weeklyPayment,
      durationWeeks,
    });

    setCalculated({
      principal,
      processingFee,
      registrationFee,
      interestRate,
      totalInterest,
      totalPayable,
      weeklyPayment,
      product: productInfo.product,
      productName: productInfo.productName,
      productRange: productInfo.range,
      baseName: productInfo.baseName,
      productType: activeType.product_type,
      id: productInfo.id
    });

    const schedule = [];
    const today = new Date();

    // Use durationWeeks from activeType (not stale `duration` state)
    for (let week = 1; week <= durationWeeks; week++) {
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + week * 7);
      schedule.push({
        week,
        due_date: dueDate.toISOString().split("T")[0],
        interest: totalInterest / durationWeeks,
        processing_fee: week === 1 ? processingFee : 0,
        registration_fee: week === 1 ? registrationFee : 0,
        // Weekly installment = (principal + interest) / weeks — fees shown separately
        total: weeklyPayment,
      });
    }
    setRepaymentSchedule(schedule);
  };
  const handlePrincipalChange = (e) => {
    const value = e.target.value;

    // Allow empty input
    if (value === "") {
      setPrincipalAmount("");
      setCalculated({});
      setRepaymentSchedule([]);
      setSelectedProductType("");
      setErrorMessage("");
      return;
    }

    const num = Number(value);

    // Ignore invalid numbers
    if (isNaN(num)) return;

    // EXCEEDS LIMIT → RESET TO ZERO AND SHOW ERROR
    if (num > approved_amount) {
      setPrincipalAmount(0);
      setCalculated({});
      setRepaymentSchedule([]);
      setSelectedProductType("");
      setErrorMessage(`Amount exceeds approved limit of KES ${approved_amount?.toLocaleString()}. Please enter a valid amount.`);

      // Clear error after 4 seconds
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    // Clear error for valid input
    setErrorMessage("");

    // Valid input
    setPrincipalAmount(num);
  };




  // Handle product type selection
  const handleProductTypeChange = (e) => {
    setSelectedProductType(e.target.value);
  };

  const isValidAmount = () => {
    return (
      principalAmount >= 1000 &&
      principalAmount <= approved_amount &&
      calculated.product !== "" &&
      selectedProductType !== ""
    );
  };

  // Book loan
  const handleBookLoan = async () => {
    if (!isValidAmount()) {
      toast.warning(
        `Please enter a valid loan amount (KES 1,000 - ${approved_amount?.toLocaleString() || 0}) and select a product type`
      );
      return;
    }

    setLoading(true);
    try {
      // Check if customer has ever had a successfully disbursed loan
      const { data: previousLoans, error: prevError } = await supabase
        .from("loans")
        .select("id, status")
        .eq("customer_id", id)
        .eq("status", "disbursed");

      if (prevError) throw prevError;

      const isFirstLoan = !previousLoans || previousLoans.length === 0;


      const initialStatus = "bm_review";

      const { error } = await supabase.from("loans").insert([
        {
          customer_id: id,
          product: calculated.product,
          product_name: calculated.productName,
          product_type: selectedProductType,
          prequalified_amount: approved_amount,
          scored_amount: calculated.principal,
          duration_weeks: duration,
          processing_fee: calculated.processingFee,
          registration_fee: calculated.registrationFee,
          interest_rate: calculated.interestRate,
          total_interest: calculated.totalInterest,
          total_payable: calculated.totalPayable,
          weekly_payment: calculated.weeklyPayment,
          status: initialStatus,
          booked_at: new Date().toISOString(),
          is_new_loan: isFirstLoan,
          booked_by: profile?.id || null,
          branch_id: profile?.branch_id,
          region_id: profile?.region_id,
          tenant_id: profile?.tenant_id,
        },
      ]);

      if (error) throw error;

      toast.success("Loan successfully booked!");
      navigate(-1);

    } catch (error) {
      console.error(" Error booking loan:", error.message);
      toast.error("Error booking loan. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  if (!customer || isInitialLoading) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading product settings..." />
      </div>
    );
  }

  const availableProductTypes = getAvailableProductTypes();

  return (
    <div className="min-h-screen bg-brand-surface">


      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className=" p-4 mb-4 flex items-center justify-between">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-text rounded-xl hover:bg-brand-surface transition-all font-medium shadow-sm"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>

          {/* Title & Subtitle */}
          <div className=" text-center">
            <h1 className="text-2xl font-bold text-text">
              Loan Booking Confirmation
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Review and confirm loan disbursement details
            </p>
          </div>

          {/* Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-sm ${isValidAmount()
              ? 'bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-200 text-emerald-700'
              : 'bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-200 text-amber-700'
              }`}
          >
            <CheckCircleIcon
              className={`h-5 w-5 ${isValidAmount() ? 'text-emerald-600' : 'text-amber-600'}`}
            />
            <span>{isValidAmount() ? 'Ready to Book' : 'Check Amount & Product'}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-brand-surface overflow-hidden">
          {/* Customer and Loan Overview */}
          <div className="p-8 bg-brand-surface border-b border-brand-surface">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Customer Details */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-indigo-100">
                <h3 className="text-lg font-bold text-text flex items-center mb-4">
                  <UserIcon className="h-6 w-6 text-brand-primary mr-3" />
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Name:</span>
                    <span className="text-gray-900 font-semibold">
                      {Firstname} {Surname}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Customer ID:</span>
                    <span className="text-brand-primary font-mono font-bold">
                      {id_number || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Mobile:</span>
                    <span className="text-gray-900 font-semibold">
                      {mobile || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Loan Type:</span>
                    <span className={`font-semibold ${isNewCustomer ? 'text-green-600' : 'text-blue-600'}`}>
                      {customerType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Approved Amount:</span>
                    <span className="text-emerald-600 font-bold">
                      KES {approved_amount?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Loan Summary */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-indigo-100">
                <h3 className="text-lg font-bold text-text flex items-center mb-4">
                  <CurrencyDollarIcon className="h-6 w-6 text-accent mr-3" />
                  Loan Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Product:</span>
                    <span className={`font-semibold ${calculated.product ? 'text-indigo-600' : 'text-red-600'
                      }`}>
                      {calculated.productName || 'Select Valid Amount'}
                    </span>
                  </div>

                  {/* Product Type Selection */}
                  {calculated.baseName && (
                    <div className="space-y-2">
                      <label className="text-gray-600 font-medium">Product Type:</label>
                      <select
                        value={selectedProductType}
                        onChange={handleProductTypeChange}
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all bg-white text-sm"
                      >
                        <option value="">Select product type</option>
                        {availableProductTypes.map((type) => (
                          <option key={type.id} value={type.product_type}>
                            {type.product_type} - {type.duration_weeks} Weeks
                          </option>
                        ))}
                      </select>
                      {selectedProductType && (
                        <p className="text-xs text-green-600">
                          Selected: {selectedProductType} ({duration} weeks)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Editable Principal Amount */}
                  <div className="space-y-2">
                    <label className="text-gray-600 font-medium">Principal Amount:</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="number"
                          value={principalAmount}
                          onChange={handlePrincipalChange}
                          min="1000"
                          max={approved_amount}
                          step="100"
                          className={`w-full p-3 pr-12 border rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-bold text-lg ${isValidAmount()
                            ? 'border-accent/30 bg-accent/5 text-accent'
                            : 'border-red-300 bg-red-50 text-red-600'
                            }`}
                          placeholder="Enter amount"
                        />
                        <PencilIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      </div>
                    </div>

                    {/* Error message for exceeding limit - SHOWS IMMEDIATELY BELOW INPUT */}
                    {errorMessage && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-pulse">
                        <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-red-700 font-medium">{errorMessage}</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      Maximum allowed: KES {approved_amount?.toLocaleString()} (Approved amount)
                    </p>

                    {/* Validation messages - only show if no errorMessage */}
                    {!isValidAmount() && principalAmount > 0 && !errorMessage && (
                      <p className="text-xs text-red-600">
                        {principalAmount < 1000
                          ? "Minimum amount is KES 1,000"
                          : principalAmount > approved_amount
                            ? "Amount exceeds approved limit"
                            : "Please select product type"}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Duration:</span>
                    <span className="text-gray-900 font-semibold">{duration} weeks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Processing Fee:</span>
                    <span className="text-gray-900 font-semibold">
                      KES {calculated.processingFee?.toLocaleString() || '0'}
                    </span>
                  </div>
                  {isNewCustomer && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">Registration Fee:</span>
                      <span className="text-gray-900 font-semibold">
                        KES {calculated.registrationFee?.toLocaleString() || '0'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-600 font-medium">Total Repayment:</span>
                    <span className="text-xl font-bold text-brand-primary">
                      KES {(calculated.totalPayable || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Repayment Terms Configuration */}
          <div className="p-8">
            <div className="bg-brand-surface rounded-2xl p-8 border border-brand-surface mb-8">
              <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-6">
                <ClockIcon className="h-6 w-6 text-brand-primary mr-3" />
                Repayment Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Selected Product Type
                  </label>
                  <div className="p-3 bg-white border border-gray-300 rounded-lg">
                    <span className={`font-semibold ${selectedProductType ? 'text-indigo-600' : 'text-gray-400'
                      }`}>
                      {selectedProductType || 'No product type selected'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Repayment Schedule */}
            {repaymentSchedule.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-6">
                  <DocumentTextIcon className="h-6 w-6 text-purple-600 mr-3" />
                  Repayment Schedule - {selectedProductType}
                </h3>

                <div className="bg-white rounded-2xl border border-brand-surface overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="text-white text-sm bg-brand-primary">

                          <th className="px-6 py-4 text-left font-semibold">Week</th>
                          <th className="px-6 py-4 text-left font-semibold">Due Date</th>
                          <th className="px-6 py-4 text-right font-semibold">Principal</th>
                          <th className="px-6 py-4 text-right font-semibold">Fees</th>
                          <th className="px-6 py-4 text-right font-semibold">Installments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {repaymentSchedule.map((payment, index) => (
                          <tr
                            key={index}
                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-brand-surface/50'
                              } hover:bg-brand-surface transition-colors`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                  <span className="text-brand-primary font-bold text-sm">
                                    {payment.week}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center text-slate-600">
                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                {new Date(payment.due_date).toLocaleDateString('en-GB')}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-slate-600">
                              KES {(payment.total || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-amber-600">
                              KES {(payment.processing_fee + payment.registration_fee).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-brand-primary">
                              KES {payment.total.toLocaleString()}
                            </td>
                          </tr>
                        ))}

                        {/* Totals Row */}
                        <tr className="bg-brand-surface border-t-2 border-brand-secondary text-sm">
                          <td className="px-6 py-4 font-semibold text-slate-600" colSpan="2">
                            TOTAL
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-600">
                            KES {principalAmount?.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-amber-600">
                            KES {(
                              repaymentSchedule.reduce(
                                (sum, payment) => sum + payment.processing_fee + payment.registration_fee,
                                0
                              )
                            ).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-brand-primary text-xl">
                            KES {(
                              repaymentSchedule.reduce((sum, payment) => sum + payment.total, 0)
                            ).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Loan Product Information */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 mb-8">
              <h3 className="text-sm font-semibold text-slate-600 flex items-center mb-6">
                <TagIcon className="h-6 w-6 text-purple-600 mr-3" />
                Loan Product Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {products.map((p) => (
                  <div key={p.id} className={`bg-white p-4 rounded-lg border ${calculated.id === p.id ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-gray-100'
                    }`}>
                    <h4 className="font-semibold text-brand-primary mb-2">{p.product_name}</h4>
                    <p className="text-sm text-gray-600">
                      KES {parseFloat(p.min_amount).toLocaleString()} - {p.max_amount ? parseFloat(p.max_amount).toLocaleString() : 'Above'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Dynamic settings from branch</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <p><span className="font-semibold">Fees & Interest:</span> Rates are dynamically calculated based on the selected product type.</p>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-end pt-8 border-t border-gray-200">
              <button
                onClick={handleBookLoan}
                disabled={loading || !isValidAmount()}
                className={`flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{
                  backgroundColor: isValidAmount() ? "#586ab1" : "#cbd5e1",
                }}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-6 w-6" />
                    {isValidAmount() ? `Book ${selectedProductType}` : "Enter Valid Amount"}
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanBookingForm;