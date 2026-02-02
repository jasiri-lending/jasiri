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

const LoanBookingForm = ({ customerData }) => {
  const [duration, setDuration] = useState(4);
  const location = useLocation();
  const navigate = useNavigate();
  const customer = customerData || location.state?.customerData;

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

  //  RM takes precedence → use RM if available, else BM
  const approved_amount = caScoredAmount ?? bmScoredAmount ?? 0;



  // Product types configuration
  const productTypes = {
    Inuka: [
      { weeks: 4, name: "Inuka 4 Weeks" },
      { weeks: 5, name: "Inuka 5 Weeks" },
      { weeks: 6, name: "Inuka 6 Weeks" },
      { weeks: 7, name: "Inuka 7 Weeks" },
      { weeks: 8, name: "Inuka 8 Weeks" },
    ],
    Kuza: [
      { weeks: 4, name: "Kuza 4 Weeks" },
      { weeks: 5, name: "Kuza 5 Weeks" },
      { weeks: 6, name: "Kuza 6 Weeks" },
      { weeks: 7, name: "Kuza 7 Weeks" },
      { weeks: 8, name: "Kuza 8 Weeks" },

    ],
    Fadhili: [
      { weeks: 4, name: "Fadhili 4 Weeks" },
      { weeks: 5, name: "Fadhili 5 Weeks" },
      { weeks: 6, name: "Fadhili 6 Weeks" },
      { weeks: 7, name: "Fadhili 7 Weeks" },
      { weeks: 8, name: "Fadhili 8 Weeks" },
    ]
  };

  useEffect(() => {
    if (id) {
      checkCustomerType(id);
    }
  }, [id]);

  useEffect(() => {
    if (principalAmount > 0) {
      calculateLoan();
      autoSelectProductType();
    }
    // eslint-disable-next-line
  }, [duration, isNewCustomer, principalAmount]);

  useEffect(() => {
    // Update duration when product type is selected
    if (selectedProductType) {
      const productType = getAvailableProductTypes().find(
        type => type.name === selectedProductType
      );
      if (productType) {
        setDuration(productType.weeks);
      }
    }
  }, [selectedProductType]);

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
    if (amount >= 1000 && amount <= 5000) {
      return {
        product: "Inuka",
        productName: "Inuka (1K-5K)",
        range: "KES 1,000 - 5,000",
        baseName: "Inuka"
      };
    } else if (amount >= 6000 && amount <= 10000) {
      return {
        product: "Kuza",
        productName: "Kuza (6K-10K)",
        range: "KES 6,000 - 10,000",
        baseName: "Kuza"
      };
    } else if (amount > 10000) {
      return {
        product: "Fadhili",
        productName: "Fadhili (10K+)",
        range: "KES 10,000 and above",
        baseName: "Fadhili"
      };
    } else {
      return {
        product: "",
        productName: "Invalid Amount",
        range: "Amount must be KES 1,000 or more",
        baseName: ""
      };
    }
  };

  // Get available product types based on current product
  const getAvailableProductTypes = () => {
    const productInfo = getProductInfo(principalAmount);
    return productTypes[productInfo.baseName] || [];
  };

  // Auto-select product type when amount changes
  const autoSelectProductType = () => {
    const productInfo = getProductInfo(principalAmount);
    const availableTypes = productTypes[productInfo.baseName];

    if (availableTypes && availableTypes.length > 0) {
      // Find the type that matches current duration or default to first option
      const matchingType = availableTypes.find(type => type.weeks === duration) || availableTypes[0];
      setSelectedProductType(matchingType.name);
    } else {
      setSelectedProductType("");
    }
  };

  // recalc repayment schedule
  const calculateLoan = () => {
    const principal = Number(principalAmount) || 0;
    const processingFee = principal <= 10000 ? 500 : principal * 0.05;
    const registrationFee = isNewCustomer ? 300 : 0;

    const weeklyRate = 6.25;
    const interestRate = weeklyRate * duration;
    const totalInterest = (principal * interestRate) / 100;

    const totalPayable = principal + totalInterest;
    const weeklyPayment = totalPayable / duration;

    const productInfo = getProductInfo(principal);

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
      productType: selectedProductType,
    });

    // repayment schedule
    const schedule = [];
    const today = new Date();

    for (let week = 1; week <= duration; week++) {
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + week * 7);
      schedule.push({
        week,
        due_date: dueDate.toISOString().split("T")[0],
        principal: week === duration ? principal : 0,
        interest: totalInterest / duration,
        processing_fee: week === 1 ? processingFee : 0,
        registration_fee: week === 1 ? registrationFee : 0,
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
      alert(
        `Please enter a valid loan amount (KES 1,000 - ${approved_amount?.toLocaleString() || 0
        }) and select a product type`
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

      alert("Loan successfully booked!");
      navigate(-1);

    } catch (error) {
      console.error(" Error booking loan:", error.message);
      alert("Error booking loan. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  if (!customer) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="h-full bg-brand-surface p-6 min-h-screen flex items-center justify-center ">
          <Spinner text="Loading ..." />
        </div>
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
                          <option key={type.name} value={type.name}>
                            {type.name} - {type.description}
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
                      KES {(repaymentSchedule.reduce((sum, payment) => sum + payment.total, 0)).toLocaleString()}
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
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Loan Duration (weeks)
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
                  >
                    {[4, 5, 6, 7, 8].map(weeks => (
                      <option key={weeks} value={weeks}>
                        {weeks} weeks
                      </option>
                    ))}
                  </select>
                </div> */}
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
                              KES {payment.principal.toLocaleString()}
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
                <div className={`bg-white p-4 rounded-lg border ${calculated.product === 'Inuka' ? 'border-purple-300 ring-2 ring-purple-200' : 'border-purple-100'
                  }`}>
                  <h4 className="font-semibold text-purple-700 mb-2">Inuka</h4>
                  <p className="text-sm text-gray-600">KES 1,000 - 5,000</p>
                  <p className="text-xs text-gray-500 mt-2">4-6 weeks duration</p>

                </div>
                <div className={`bg-white p-4 rounded-lg border ${calculated.product === 'Kuza' ? 'border-blue-300 ring-2 ring-blue-200' : 'border-blue-100'
                  }`}>
                  <h4 className="font-semibold text-blue-700 mb-2">Kuza</h4>
                  <p className="text-sm text-gray-600">KES 6,000 - 10,000</p>
                  <p className="text-xs text-gray-500 mt-2">4-7 weeks duration</p>

                </div>
                <div className={`bg-white p-4 rounded-lg border ${calculated.product === 'Fadhili' ? 'border-green-300 ring-2 ring-green-200' : 'border-green-100'
                  }`}>
                  <h4 className="font-semibold text-green-700 mb-2">Fadhili</h4>
                  <p className="text-sm text-gray-600">KES 10,000 and above</p>
                  <p className="text-xs text-gray-500 mt-2">4-8 weeks duration</p>

                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <p><span className="font-semibold">Processing Fee:</span> KES 500 for loans up to 10K, 5% of principal for loans above 10K</p>
                <p><span className="font-semibold">Registration Fee:</span> KES 300 (one-time payment for new customers only)</p>
                {/* <p><span className="font-semibold">Interest Rate:</span> 25% over 4 weeks (6.25% per week)</p> */}
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