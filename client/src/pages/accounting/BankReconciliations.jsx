import { useState, useEffect } from "react";
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
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import { useToast } from "../../components/Toast";
import { Pagination } from "../../components/Pagination.jsx";

function BankReconciliations() {
  const { profile } = useAuth();
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
  const [selectedBank, setSelectedBank] = useState("KCB");
  const toast = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const banks = [
    "KCB",
    "Equity",
    "National Bank",
    "Cooperative Bank",
    "I&M Bank",
  ];

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

    try {
      const response = await apiFetch("/api/bank-reconciliation/bulk-process", {
        method: "POST",
        body: JSON.stringify({
          transactions,
          bank_name: selectedBank,
          tenant_id: profile?.tenant_id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process reconciliation");
      }

      setReconciliationResults(data.results);
      setUploadSuccess(true);
      toast.success(`Successfully processed ${data.results.successful} transactions`);

      // Update the transactions list with results from server if needed
      // For now, we'll just show the summary results
      if (data.results.details && data.results.details.length > 0) {
        const detailsMap = {};
        data.results.details.forEach(d => {
          detailsMap[d.reference] = d;
        });

        setTransactions(prev => prev.map(t => {
          const ref = t.mpesa_ref || t.bank_ref;
          const result = detailsMap[ref];
          if (result) {
            return {
              ...t,
              reconciliation_status: result.status === "Success" ? "Reconciled" : "Failed",
              status: result.status === "Success" ? "Reconciled" : "Failed",
              error_message: result.status === "Failed" ? result.message : null
            };
          }
          return t;
        }));
      }

    } catch (finalErr) {
      console.error("Upload process error:", finalErr);
      setUploadError(`Upload failed: ${finalErr.message}`);
      toast.error(`Reconciliation failed: ${finalErr.message}`);
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

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
    <div className="min-h-screen bg-muted p-4 sm:p-6 lg:p-8 font-outfit">
      <div className="max-w-7xl mx-auto">
        <div className="mb-2 sm:mb-6">
          <h1 className="text-sm sm:text-sm lg:text-sm font-outfit text-slate-600 text-start">
            Bank Reconciliation
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-sm sm:text-sm font-outfit text-slate-600 mb-2">
                Import Payment Data
              </h2>
              <div className="flex items-center gap-3">
                <label className="text-xs font-outfit text-gray-500">Source Bank:</label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:border-slate-500 outline-none"
                >
                  {banks.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>
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
                    className="flex items-center justify-center gap-2 px-2 sm:px-4 py-1.5 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 cursor-pointer transition-colors text-xs sm:text-sm"
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                    Import File
                  </label>
                </div>

                <button
                  onClick={handleUploadToServer}
                  disabled={!hasData || isUploading}
                  className="flex items-center justify-center gap-2 px-2 sm:px-4 py-1.5 bg-green-600 text-white text-xs font-outfit rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors  sm:text-sm"
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
              <h3 className="text-xs text-slate-600 font-outfit sm:text-lg font-semibold ">
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

          <div className="overflow-x-auto font-outfit">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">
                    Customer Match
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">
                    Mobile Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">
                    Mpesa Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">
                    Bank Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 whitespace-nowrap">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {hasData ? (
                  paginatedTransactions.map((transaction) => (
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
            <Pagination
              totalItems={filteredTransactions.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default BankReconciliations;