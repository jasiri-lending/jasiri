import { useState } from 'react';
import { useEffect } from "react";

import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import CustomerAccountModal from './CustomerAccountModal';
import LoanDisbursementReport from './DisbursementLoansReport';
import LoanDueReport from './LoanDueReport';
import CustomerListing from './CustomerListing';
import MpesaRepaymentReports from './MpesaRepaymentReports';
import LoanOfficerPerformanceReport from './LoanOfficerPerformanceReport';
import NonPerformingLoansReport from './NonPerformingLoansReport';
import OutstandingLoanBalanceReport from './OutstandingLoanBalanceReport';
import PendingDisbursementReport from './LoansPendingDisbursementReport';
import LoanListing from './LoanListing';
import SuspensePaymentsReport from './SuspensePaymentsReport';
import TraceMpesaTransaction from './TraceMpesaTransaction';
import LoanArrearsReport from './LoanArrearsReport';
import InactiveCustomers from './InactiveCustomers';
import LoginModal from '../registry/LoginModal';
import Spinner from '../../components/Spinner';

const Reports = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const reportsPerPage = 10;
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingReport, setPendingReport] = useState(null);

  const allReports = [
    {
      id: 1,
      name: "Customer Account Statement",
      description: "Detailed statement of customer transactions, balances, and account activity",
      component: CustomerAccountModal,
      route: '/reports/customer-account-statement',
      permission: 'report.customer_account_statement'
    },
    {
      id: 2,
      name: "Disbursement Loans",
      description: "Report of all loans that have been disbursed to customers",
      component: LoanDisbursementReport,
      route: '/reports/disbursement-loans',
      permission: 'report.loan_disbursement'
    },
    {
      id: 3,
      name: "Loan Due Report",
      description: "List of loans with upcoming or overdue payment dates",
      component: LoanDueReport,
      route: '/reports/loan-due',
      permission: 'report.loan_due'
    },
    {
      id: 4,
      name: "Customer Listing",
      description: "Comprehensive list of all registered customers with their details",
      component: CustomerListing,
      route: '/reports/customer-listing',
      permission: 'report.customer_listing'
    },
    {
      id: 5,
      name: "M-Pesa Repayment Reports",
      description: "Track all loan repayments made through M-Pesa mobile money",
      component: MpesaRepaymentReports,
      route: '/reports/mpesa-repayment',
      permission: 'report.mpesa_repayment'
    },
    {
      id: 6,
      name: "Loan Officer Performance",
      description: "Performance metrics and statistics for each loan officer",
      component: LoanOfficerPerformanceReport,
      route: '/reports/loan-officer-performance',
      permission: 'report.loan_officer_performance'
    },
    {
      id: 7,
      name: "Non-Performance Loan",
      description: "Report on loans that are not performing or are in default",
      component: NonPerformingLoansReport,
      route: '/reports/non-performing-loans',
      permission: 'report.non_performing_loans'
    },
    {
      id: 8,
      name: "Outstanding Loan Balance",
      description: "Summary of all outstanding loan balances across all customers",
      component: OutstandingLoanBalanceReport,
      route: '/reports/outstanding-balance',
      permission: 'report.outstanding_balance'
    },
    {
      id: 9,
      name: "Loan Pending Disbursement",
      description: "Approved loans awaiting disbursement to customers",
      component: PendingDisbursementReport,
      route: '/reports/pending-disbursement',
      permission: 'report.pending_disbursement'
    },
    {
      id: 10,
      name: "Loan Listing",
      description: "Complete listing of all loans in the system with key details",
      component: LoanListing,
      route: '/reports/loan-listing',
      permission: 'report.loan_listing'
    },
    {
      id: 11,
      name: "Installments Report",
      description: "Detailed report showing all loan installments",
      component: LoanListing,
      route: '/reports/installments-report',
      permission: 'report.installments'
    },
    {
      id: 12,
      name: "OLB as at the End of Month",
      description: "Summary of all outstanding loan balances across all customers",
      component: OutstandingLoanBalanceReport,
      route: '/reports/outstandEOM',
      permission: 'report.outstanding_eom'
    },
    {
      id: 13,
      name: "Trace M-Pesa Transaction",
      description: "Search and track specific M-Pesa transactions by reference",
      component: TraceMpesaTransaction,
      route: '/reports/trace-mpesa',
      permission: 'report.trace_mpesa'
    },
    {
      id: 14,
      name: "Inactive Customers",
      description: "List of customers with no recent activity or transactions",
      component: InactiveCustomers,
      route: '/reports/inactive-customers',
      permission: 'report.inactive_customers'
    },
    {
      id: 15,
      name: "Loan Arrears Report",
      description: "Detailed report of loans in arrears with aging analysis",
      component: LoanArrearsReport,
      route: '/reports/loan-arrears',
      permission: 'report.loan_arrears'
    },
    {
      id: 16,
      name: "Suspense Payment Report",
      description: "View and manage unallocated or pending M-Pesa payments",
      component: SuspensePaymentsReport,
      route: '/reports/suspense-payments',
      permission: 'report.suspense_payments'
    }
  ];

  const { hasPermission, loading: permsLoading } = usePermissions();

  const filteredReports = allReports.filter(report => {
    const matchesSearch =
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && hasPermission(report.permission);
  });

  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
  const startIdx = (currentPage - 1) * reportsPerPage;
  const endIdx = startIdx + reportsPerPage;
  const currentReports = filteredReports.slice(startIdx, endIdx);


  const handleViewReport = (report) => {
    const reportUser = localStorage.getItem("reportUser");

    if (reportUser) {
      // already logged in for reports
      navigate(report.route);
    } else {
      setPendingReport(report);
      setLoginOpen(true);
    }
  };


  useEffect(() => {
    const onReportLogin = () => {
      setLoginOpen(false);
    };

    window.addEventListener("report-login", onReportLogin);

    return () => {
      window.removeEventListener("report-login", onReportLogin);
    };
  }, []);




  const handleLoginSuccess = () => {
    if (pendingReport) {
      navigate(pendingReport.route); // navigate after successful login
      setPendingReport(null);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-brand-surface text-gray-800 border-r border-gray-200 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title & Description */}
            <div>
              <h1 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Reports</h1>
              <p className="text-sm text-gray-600 mt-1">
                Generate and view comprehensive loan management reports
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search reports by name or description..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm 
                   focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-500 text-sm"
              />
            </div>
          </div>

          {/* Optional search feedback */}
          {searchTerm && (
            <p className="mt-3 text-sm text-gray-600">
              Found {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''} matching "<span className="font-medium text-gray-800">{searchTerm}</span>"
            </p>
          )}
        </div>


        {/* Reports Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredReports.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Report Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Description</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentReports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5" style={{ color: "#586ab1" }} />
                            <span className="  text-blue-900">{report.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {report.description}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleViewReport(report)}
                              className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                              style={{ backgroundColor: "#586ab1" }}
                            >
                              <FileText className="w-3 h-3" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-medium">{startIdx + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(endIdx, filteredReports.length)}</span> of{' '}
                    <span className="font-medium">{filteredReports.length}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${currentPage === 1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>

                    <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                      Page <span className="font-medium">{currentPage}</span> of{' '}
                      <span className="font-medium">{totalPages}</span>
                    </div>

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${currentPage === totalPages
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No reports found</h3>
              {searchTerm && (
                <>
                  <p className="mt-2 text-gray-500">
                    No reports matched &ldquo;{searchTerm}&rdquo;
                  </p>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Clear search
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default Reports;