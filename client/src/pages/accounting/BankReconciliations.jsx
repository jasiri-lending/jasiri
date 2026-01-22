import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  Search,
  FileText,
  CheckCircle,
  AlertCircle,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { supabase } from "../../supabaseClient";

function BankReconciliations() {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [reconciliationResults, setReconciliationResults] = useState({
    successful: 0,
    failed: 0,
    details: [],
  });

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(false);
    setReconciliationResults({ successful: 0, failed: 0, details: [] });
    setFileName(file.name);

    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];

    if (
      !validTypes.includes(file.type) &&
      !file.name.match(/\.(xlsx|xls|csv)$/)
    ) {
      setUploadError("Please upload a valid Excel or CSV file");
      return;
    }

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsedData = XLSX.utils.sheet_to_json(sheet);

        if (parsedData.length === 0) {
          setUploadError("The file appears to be empty");
          return;
        }

        const cleanData = parsedData
          .map((row, index) => {
            const amountRaw =
              row.amount ||
              row.transaction_amount ||
              row.Amount ||
              row.AMOUNT ||
              0;
            const amount = parseFloat(amountRaw);

            if (isNaN(amount) || amount <= 0) {
              console.warn(`Invalid amount in row ${index + 1}:`, amountRaw);
            }

            const dateRaw =
              row.date ||
              row.transaction_date ||
              row.Date ||
              row.DATE ||
              row.transactionDate ||
              "";
            let processedDate = "";

            if (dateRaw) {
              try {
                let dateObj;

                if (typeof dateRaw === "number") {
                  processedDate = XLSX.SSF.format("yyyy-mm-dd", dateRaw);
                } else if (typeof dateRaw === "string") {
                  dateObj = new Date(dateRaw);

                  if (isNaN(dateObj.getTime())) {
                    const formats = [
                      "DD/MM/YYYY",
                      "MM/DD/YYYY",
                      "YYYY-MM-DD",
                      "DD-MM-YYYY",
                      "MM-DD-YYYY",
                      "YYYY/MM/DD",
                    ];

                    for (const format of formats) {
                      const parts = dateRaw.split(/[/\-]/);
                      if (parts.length === 3) {
                        let year, month, day;

                        if (
                          format === "DD/MM/YYYY" ||
                          format === "DD-MM-YYYY"
                        ) {
                          day = parts[0];
                          month = parts[1];
                          year = parts[2];
                        } else if (
                          format === "MM/DD/YYYY" ||
                          format === "MM-DD-YYYY"
                        ) {
                          month = parts[0];
                          day = parts[1];
                          year = parts[2];
                        } else if (
                          format === "YYYY-MM-DD" ||
                          format === "YYYY/MM/DD"
                        ) {
                          year = parts[0];
                          month = parts[1];
                          day = parts[2];
                        }

                        if (year && year.length === 2) {
                          year = "20" + year;
                        }

                        dateObj = new Date(
                          `${year}-${month.padStart(2, "0")}-${day.padStart(
                            2,
                            "0"
                          )}`
                        );
                        if (!isNaN(dateObj.getTime())) break;
                      }
                    }
                  }

                  if (dateObj && !isNaN(dateObj.getTime())) {
                    processedDate = dateObj.toISOString().split("T")[0];
                  } else {
                    processedDate = dateRaw;
                  }
                }
              } catch (error) {
                console.warn(
                  `Could not parse date in row ${index + 1}:`,
                  dateRaw
                );
                processedDate = dateRaw.toString();
              }
            }

            // Enhanced mobile number normalization
            let mobileRaw = (
              row.mobile ||
              row.phone ||
              row.Mobile ||
              row.PHONE ||
              row.phone_number ||
              ""
            )
              .toString()
              .trim();

            let mobile = "";
            if (mobileRaw && mobileRaw !== "N/A" && mobileRaw !== "null") {
              let digits = mobileRaw.replace(/\D/g, "");

              // Convert 2547xxxxxxxx to 07xxxxxxxx
              if (digits.startsWith("2547") && digits.length === 12) {
                digits = "0" + digits.substring(3);
              }
              // Convert +2547xxxxxxxx to 07xxxxxxxx
              else if (digits.startsWith("2547") && digits.length === 13) {
                digits = "0" + digits.substring(3);
              }
              // Convert 7xxxxxxxx to 07xxxxxxxx
              else if (digits.length === 9 && digits.startsWith("7")) {
                digits = "0" + digits;
              }
              // Convert +254 formats
              else if (digits.startsWith("254") && digits.length === 12) {
                digits = "0" + digits.substring(3);
              }

              // Validate final format: 07xxxxxxxx or 01xxxxxxxx
              if (
                digits.length === 10 &&
                digits.startsWith("0") &&
                /^0[17]\d{8}$/.test(digits)
              ) {
                mobile = digits;
              } else {
                console.warn(
                  `Invalid mobile number format in row ${index + 1}:`,
                  mobileRaw,
                  "->",
                  digits
                );
              }
            }

            return {
              id: index + 1,
              name: (
                row.name ||
                row.customer_name ||
                row.Customer ||
                row.NAME ||
                "Unknown"
              )
                .toString()
                .trim(),
              mobile: mobile,
              amount: isNaN(amount) ? 0 : amount,
              mpesa_ref: (
                row.mpesa_ref ||
                row.transaction_ref ||
                row.Reference ||
                row.REFERENCE ||
                "N/A"
              )
                .toString()
                .trim(),
              bank_ref: (
                row.bank_ref ||
                row.bank_transaction_id ||
                row["Bank Ref"] ||
                row.BANK_REF ||
                "N/A"
              )
                .toString()
                .trim(),
              date: processedDate,
              status: "Pending",
              reconciliation_status: "Not Processed",
              customer_match: null,
              error_message: null,
              imported_at: new Date().toISOString(),
            };
          })
          .filter((row) => {
            const hasValidMobile =
              row.mobile &&
              row.mobile.length >= 10 &&
              /^0[17]\d{8}$/.test(row.mobile);
            const hasValidAmount = row.amount > 0;
            const hasValidName =
              row.name && row.name !== "Unknown" && row.name.trim() !== "";

            if (!hasValidMobile) {
              console.warn(`Filtered out row due to invalid mobile:`, row);
            }
            if (!hasValidAmount) {
              console.warn(`Filtered out row due to invalid amount:`, row);
            }
            if (!hasValidName) {
              console.warn(`Filtered out row due to invalid name:`, row);
            }

            return hasValidMobile && hasValidAmount && hasValidName;
          });

        if (cleanData.length === 0) {
          setUploadError(
            "No valid transactions found in the file. Please check that all records have valid mobile numbers (10 digits starting with 07 or 01), names, and positive amounts."
          );
          return;
        }

        setTransactions(cleanData);
        setUploadError(null);
      } catch (error) {
        console.error("Error parsing file:", error);
        setUploadError(
          "Error parsing file. Please check the file format and try again."
        );
      }
    };

    reader.onerror = () => {
      setUploadError("Error reading file. Please try again.");
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleUploadToServer = async () => {
    if (transactions.length === 0) {
      setUploadError("No transactions to upload");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const results = { successful: 0, failed: 0, details: [] };

    try {
      for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];

        setTransactions((prev) => {
          const copy = [...prev];
          copy[i] = {
            ...t,
            reconciliation_status: "Processing...",
            status: "Processing",
          };
          return copy;
        });

        try {
          // 1️⃣ Match customer
          const { data: customer, error: customerError } = await supabase
            .from("customers")
            .select("id, Firstname, Surname, mobile")
            .eq("mobile", t.mobile)
            .single();

          if (customerError || !customer) {
            throw new Error(`Customer with mobile ${t.mobile} not found`);
          }

          // 2️⃣ Fetch active loans with detailed debugging
          console.log(`Fetching loans for customer ${customer.id} (${customer.Firstname} ${customer.Surname})`);
          
          const { data: allLoans } = await supabase
            .from("loans")
            .select("id, status, repayment_state, total_payable, scored_amount")
            .eq("customer_id", customer.id);

          console.log("All customer loans:", allLoans);

          // Try to get disbursed loans first
          let activeLoans = allLoans?.filter(
            (loan) =>
              loan.status === "disbursed" &&
              (loan.repayment_state === "ongoing" || loan.repayment_state === "partial")
          );

          // If no disbursed+ongoing/partial loans, try just disbursed
          if (!activeLoans || activeLoans.length === 0) {
            console.log("No ongoing/partial loans found, checking all disbursed loans...");
            activeLoans = allLoans?.filter((loan) => loan.status === "disbursed");
          }

          // If still nothing, try any loan that's not rejected
          if (!activeLoans || activeLoans.length === 0) {
            console.log("No disbursed loans found, checking all non-rejected loans...");
            activeLoans = allLoans?.filter((loan) => loan.status !== "rejected");
          }

          if (!activeLoans || activeLoans.length === 0) {
            const loanStatuses = allLoans?.map(l => `${l.status}/${l.repayment_state}`).join(", ") || "none";
            throw new Error(
              `No eligible loans found for payment. Customer has ${allLoans?.length || 0} loan(s) with status: ${loanStatuses}. Only 'disbursed' loans can receive payments.`
            );
          }

          console.log(`Found ${activeLoans.length} eligible loan(s) for payment`);

          let remainingAmount = t.amount;
          let reconciled = false;
          const reconciliationDetails = [];

          // 3️⃣ Process each loan
          for (const loan of activeLoans) {
            if (remainingAmount <= 0) break;

            // Fetch unpaid installments - FIXED QUERY
            const { data: installments, error: instErr } = await supabase
              .from("loan_installments")
              .select("*")
              .eq("loan_id", loan.id)
              .neq("status", "paid")
              .order("due_date", { ascending: true });

            if (instErr) {
              console.error(
                `Error fetching installments for loan ${loan.id}:`,
                instErr
              );
              continue;
            }

            if (!installments || installments.length === 0) {
              console.log(`No unpaid installments for loan ${loan.id}. Checking all installments...`);
              
              // Check all installments for this loan
              const { data: allInst } = await supabase
                .from("loan_installments")
                .select("id, installment_number, status, due_amount, paid_amount")
                .eq("loan_id", loan.id)
                .order("due_date", { ascending: true });
              
              console.log(`Loan ${loan.id} has ${allInst?.length || 0} total installments:`, allInst);
              continue;
            }

            console.log(`Processing ${installments.length} unpaid installments for loan ${loan.id}`);

            // 4️⃣ Apply payment to installments
            for (const inst of installments) {
              if (remainingAmount <= 0) break;

              const outstanding = Number(inst.due_amount) - Number(inst.paid_amount);
              const amountToApply = Math.min(remainingAmount, outstanding);
              
              if (amountToApply <= 0) continue;

              const newPaid = Number(inst.paid_amount) + amountToApply;
              const newStatus = newPaid >= Number(inst.due_amount) ? "paid" : "partial";

              // Update installment
              const { error: updInstErr } = await supabase
                .from("loan_installments")
                .update({ 
                  paid_amount: newPaid, 
                  status: newStatus,
                  paid_date: newStatus === "paid" ? new Date().toISOString().split('T')[0] : null
                })
                .eq("id", inst.id);

              if (updInstErr) {
                console.error("Installment update error:", updInstErr);
                throw new Error(
                  `Failed to update installment: ${updInstErr.message}`
                );
              }

              reconciliationDetails.push({
                loan_id: loan.id,
                installment_id: inst.id,
                installment_number: inst.installment_number,
                amount_applied: amountToApply,
                installment_status: newStatus,
              });

              remainingAmount -= amountToApply;
              reconciled = true;

              console.log(
                `Applied ${amountToApply} to installment ${inst.installment_number}, new status: ${newStatus}`
              );
            }

            // Recalculate repayment_state
            const { data: remainingInstallments } = await supabase
              .from("loan_installments")
              .select("id, status")
              .eq("loan_id", loan.id)
              .neq("status", "paid");

            const newLoanState =
              remainingInstallments && remainingInstallments.length > 0
                ? "partial"
                : "completed";

            if (newLoanState !== loan.repayment_state) {
              const { error: updateLoanErr } = await supabase
                .from("loans")
                .update({ repayment_state: newLoanState })
                .eq("id", loan.id);

              if (updateLoanErr) {
                console.error("Loan state update error:", updateLoanErr);
              } else {
                console.log(
                  `Updated loan ${loan.id} repayment_state to ${newLoanState}`
                );
              }
            }
          }

          if (!reconciled) {
            throw new Error("Payment could not be applied to any installment");
          }

          // 5️⃣ Save reconciliation records for each installment payment
          for (const detail of reconciliationDetails) {
            const { error: recErr } = await supabase
              .from("bank_reconciliation")
              .insert({
                loan_id: detail.loan_id,
                installment_id: detail.installment_id,
                customer_id: customer.id,
                customer_name: t.name,
                mobile: t.mobile,
                amount: detail.amount_applied,
                mpesa_ref: t.mpesa_ref,
                bank_ref: t.bank_ref,
                payment_date: t.date || new Date().toISOString().split('T')[0],
                date: t.date || new Date().toISOString().split('T')[0],
                status: "reconciled",
              });

            if (recErr) {
              console.error("Reconciliation save error:", recErr);
              throw new Error(
                `Failed to save reconciliation: ${recErr.message}`
              );
            }
          }

          // Update transaction in UI
          setTransactions((prev) => {
            const copy = [...prev];
            copy[i] = {
              ...t,
              reconciliation_status: "Reconciled",
              status: "Reconciled",
              customer_id: customer.id,
              customer_match: `Matched ${customer.Firstname} ${customer.Surname}`,
            };
            return copy;
          });

          results.successful++;
          results.details.push({
            transaction: t.mpesa_ref,
            status: "Success",
            message: `Reconciled KSh ${t.amount.toLocaleString()} for ${
              customer.Firstname
            }`,
          });
        } catch (err) {
          console.error(`Reconciliation failed for ${t.mpesa_ref}:`, err);

          setTransactions((prev) => {
            const copy = [...prev];
            copy[i] = {
              ...t,
              reconciliation_status: "Failed",
              status: "Failed",
              error_message: err.message,
            };
            return copy;
          });

          results.failed++;
          results.details.push({
            transaction: t.mpesa_ref,
            status: "Failed",
            message: err.message,
          });

          // Save failed reconciliation record
          await supabase.from("bank_reconciliation").insert({
            customer_id: customer?.id || null,
            customer_name: t.name,
            mobile: t.mobile,
            amount: t.amount,
            mpesa_ref: t.mpesa_ref,
            bank_ref: t.bank_ref,
            payment_date: t.date || new Date().toISOString().split('T')[0],
            date: t.date || new Date().toISOString().split('T')[0],
            status: "mismatch",
          });
        }
      }

      setReconciliationResults(results);
      setUploadSuccess(true);
    } catch (finalErr) {
      console.error("Upload process error:", finalErr);
      setUploadError(`Upload failed: ${finalErr.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredTransactions = transactions.filter((transaction) =>
    Object.values(transaction).some(
      (value) =>
        value &&
        value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const hasData = transactions.length > 0;

  const getStatusBadge = (status, reconciliationStatus) => {
    if (reconciliationStatus === "Reconciled") {
      return "bg-green-100 text-green-800";
    } else if (reconciliationStatus === "Failed") {
      return "bg-red-100 text-red-800";
    } else if (status === "Processing") {
      return "bg-blue-100 text-blue-800";
    }
    return "bg-yellow-100 text-yellow-800";
  };

  const getCustomerMatchIcon = (reconciliationStatus, customerMatch) => {
    if (reconciliationStatus === "Reconciled") {
      return <UserCheck className="w-4 h-4 text-green-600" />;
    } else if (reconciliationStatus === "Failed") {
      return <UserX className="w-4 h-4 text-red-600" />;
    } else if (customerMatch) {
      return <UserCheck className="w-4 h-4 text-blue-600" />;
    }
    return <User className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-brand-surface p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-sm sm:text-sm lg:text-sm font-semibold text-slate-600 text-start">
            Bank Reconciliation
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-sm sm:text-sm font-semibold text-slate-600">
                Import Payment Data
              </h2>
             
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileImport}
                    className="hidden"
                    id="file-import"
                  />
                  <label
                    htmlFor="file-import"
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#475293] cursor-pointer transition-colors text-xs sm:text-sm"
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                    Import File
                  </label>
                </div>

                <button
                  onClick={handleUploadToServer}
                  disabled={!hasData || isUploading}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      Reconcile Payments
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-red-600 bg-red-50 p-3 rounded-lg mt-3">
              <AlertCircle className="w-4 h-4" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="bg-green-50 p-4 rounded-lg mt-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-800 mb-2">
                <CheckCircle className="w-4 h-4" />
                Reconciliation Complete!
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="text-green-700">
                  <span className="font-semibold">Successful:</span>{" "}
                  {reconciliationResults.successful}
                </div>
                <div className="text-red-700">
                  <span className="font-semibold">Failed:</span>{" "}
                  {reconciliationResults.failed}
                </div>
              </div>
              {reconciliationResults.details.length > 0 && (
                <div className="mt-2 text-xs text-green-600">
                  Check the table below for detailed results
                </div>
              )}
            </div>
          )}

          {fileName && !uploadError && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-blue-50 p-3 rounded-lg mt-3">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <span className="font-medium">{fileName}</span>
              <span className="text-gray-500">
                • {transactions.length} valid records found
              </span>
            </div>
          )}

         
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-base sm:text-lg font-semibold text-slate-600">
                Payment Records
              </h3>

              <div className="relative w-full sm:w-64">
                <Search className="w-3 h-3 sm:w-4 sm:h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer Match
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Mobile Number
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Mpesa Reference
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Bank Reference
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {hasData ? (
                  filteredTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {getCustomerMatchIcon(
                            transaction.reconciliation_status,
                            transaction.customer_match
                          )}
                        </div>
                        {transaction.customer_match && (
                          <div className="text-xs text-gray-500 text-center mt-1">
                            {transaction.customer_match}
                          </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-medium text-gray-900">
                          {transaction.name}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm text-gray-600 font-mono">
                          {transaction.mobile}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-semibold text-gray-900">
                          KSh {transaction.amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm text-gray-600 font-mono">
                          {transaction.mpesa_ref}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm text-gray-600 font-mono">
                          {transaction.bank_ref}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                              transaction.status,
                              transaction.reconciliation_status
                            )}`}
                          >
                            {transaction.reconciliation_status ||
                              transaction.status}
                          </span>
                          {transaction.error_message && (
                            <div className="text-xs text-red-600 max-w-xs">
                              {transaction.error_message}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm text-gray-600">
                          {transaction.date || "No date"}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 sm:py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <FileText className="w-8 h-8 sm:w-12 sm:h-12 mb-2 sm:mb-3 text-gray-300" />
                        <p className="text-sm sm:text-lg font-medium text-gray-900 mb-1">
                          No records to display
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600">
                          Import a file to see payment records
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasData && (
            <div className="px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs sm:text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-medium">
                    {filteredTransactions.length}
                  </span>{" "}
                  of <span className="font-medium">{transactions.length}</span>{" "}
                  records
                </p>
                {searchTerm &&
                  filteredTransactions.length < transactions.length && (
                    <p className="text-xs sm:text-sm text-gray-500">
                      Filtered by: "{searchTerm}"
                    </p>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BankReconciliations;