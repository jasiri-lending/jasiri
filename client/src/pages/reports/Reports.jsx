import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
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
import ROCumulativePerformanceReport from './ROCumulativePerformanceReport';
import IncomeStatement from './IncomeStatement';
import { Pagination } from '../../components/Pagination.jsx';
import CustomSelect from '../../components/CustomSelect';
import { SkeletonTable } from '../../components/Skeleton';

const Reports = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const navigate = useNavigate();
  const reportsPerPage = 10;
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingReport, setPendingReport] = useState(null);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'customer', label: 'Customer Reports' },
    { value: 'loan', label: 'Loan Reports' },
    { value: 'financial', label: 'Financial Reports' },
    { value: 'performance', label: 'Performance Reports' },
    { value: 'payment', label: 'Payment & M-Pesa' }
  ];

  const allReports = [
    {
      id: 18,
      name: "Income Statement",
      description: "Comprehensive breakdown of revenue from interest, fees, and penalties grouped by product",
      component: IncomeStatement,
      route: '/reports/income-statement',
      category: 'financial'
    },
    {
      id: 1,
      name: "Customer Account Statement",
      description: "Detailed statement of customer transactions, balances, and account activity",
      component: CustomerAccountModal,
      route: '/reports/customer-account-statement',
      permission: 'report.customer_account_statement',
      category: 'customer'
    },
    {
      id: 2,
      name: "Disbursement Loans",
      description: "Report of all loans that have been disbursed to customers",
      component: LoanDisbursementReport,
      route: '/reports/disbursement-loans',
      permission: 'report.loan_disbursement',
      category: 'loan'
    },
    {
      id: 3,
      name: "Loan Due Report",
      description: "List of loans with upcoming or overdue payment dates",
      component: LoanDueReport,
      route: '/reports/loan-due',
      permission: 'report.loan_due',
      category: 'loan'
    },
    {
      id: 4,
      name: "Customer Listing",
      description: "Comprehensive list of all registered customers with their details",
      component: CustomerListing,
      route: '/reports/customer-listing',
      permission: 'report.customer_listing',
      category: 'customer'
    },
    {
      id: 5,
      name: "M-Pesa Repayment Reports",
      description: "Track all loan repayments made through M-Pesa mobile money",
      component: MpesaRepaymentReports,
      route: '/reports/mpesa-repayment',
      permission: 'report.mpesa_repayment',
      category: 'payment'
    },
    {
      id: 6,
      name: "Loan Officer Performance",
      description: "Performance metrics and statistics for each loan officer",
      component: LoanOfficerPerformanceReport,
      route: '/reports/loan-officer-performance',
      permission: 'report.loan_officer_performance',
      category: 'performance'
    },
    {
      id: 17,
      name: "RO Cumulative Performance",
      description: "Cumulative Performance Report for Relationship Officers",
      component: ROCumulativePerformanceReport,
      route: '/reports/ro-cumulative',
      permission: 'report.loan_officer_performance',
      category: 'performance'
    },
    {
      id: 7,
      name: "Non-Performance Loan",
      description: "Report on loans that are not performing or are in default",
      component: NonPerformingLoansReport,
      route: '/reports/non-performing-loans',
      permission: 'report.non_performing_loans',
      category: 'loan'
    },
    {
      id: 8,
      name: "Outstanding Loan Balance",
      description: "Summary of all outstanding loan balances across all customers",
      component: OutstandingLoanBalanceReport,
      route: '/reports/outstanding-balance',
      permission: 'report.outstanding_balance',
      category: 'loan'
    },
    {
      id: 9,
      name: "Loan Pending Disbursement",
      description: "Approved loans awaiting disbursement to customers",
      component: PendingDisbursementReport,
      route: '/reports/pending-disbursement',
      permission: 'report.pending_disbursement',
      category: 'loan'
    },
    {
      id: 10,
      name: "Loan Listing",
      description: "Complete listing of all loans in the system with key details",
      component: LoanListing,
      route: '/reports/loan-listing',
      permission: 'report.loan_listing',
      category: 'loan'
    },
    {
      id: 11,
      name: "Installments Report",
      description: "Detailed report showing all loan installments",
      component: LoanListing,
      route: '/reports/installments-report',
      permission: 'report.installments',
      category: 'loan'
    },
    {
      id: 12,
      name: "OLB as at the End of Month",
      description: "Summary of all outstanding loan balances across all customers",
      component: OutstandingLoanBalanceReport,
      route: '/reports/outstandEOM',
      permission: 'report.outstanding_eom',
      category: 'loan'
    },
    {
      id: 13,
      name: "Trace M-Pesa Transaction",
      description: "Search and track specific M-Pesa transactions by reference",
      component: TraceMpesaTransaction,
      route: '/reports/trace-mpesa',
      permission: 'report.trace_mpesa',
      category: 'payment'
    },
    {
      id: 14,
      name: "Inactive Customers",
      description: "List of customers with no recent activity or transactions",
      component: InactiveCustomers,
      route: '/reports/inactive-customers',
      permission: 'report.inactive_customers',
      category: 'customer'
    },
    {
      id: 15,
      name: "Loan Arrears Report",
      description: "Detailed report of loans in arrears with aging analysis",
      component: LoanArrearsReport,
      route: '/reports/loan-arrears',
      permission: 'report.loan_arrears',
      category: 'loan'
    },
    {
      id: 16,
      name: "Suspense Payment Report",
      description: "View and manage unallocated or pending M-Pesa payments",
      component: SuspensePaymentsReport,
      route: '/reports/suspense-payments',
      permission: 'report.suspense_payments',
      category: 'payment'
    }
  ];

  const { hasPermission, loading: permsLoading } = usePermissions();

  const filteredReports = allReports.filter(report => {
    const matchesSearch =
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || report.category === selectedCategory;

    // Explicitly allow Income Statement without permission check for now
    if (report.name === "Income Statement") return matchesSearch && matchesCategory;
    
    return matchesSearch && matchesCategory && (!report.permission || hasPermission(report.permission));
  });

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

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    setCurrentPage(1);
  };

  if (permsLoading) {
    return (
      <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
        <SkeletonTable rows={5} cols={3} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <h1 className="text-xs text-slate-500 mb-4 font-medium font-outfit">
        Reports / All Reports
      </h1>

      <div className="bg-card rounded-xl shadow-card border border-border">
        {/* Table Header Card */}
        <div className="p-4 border-b border-border-light flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-surface">
          <div>
            <h2 className="text-xs font-semibold text-heading font-outfit">
              All Reports
            </h2>
            <p className="text-[10px] text-muted mt-0.5">
              Generate and view comprehensive loan management reports
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Category Dropdown */}
            <div className="w-full sm:w-48 z-10">
              <CustomSelect
                value={selectedCategory}
                onChange={handleCategoryChange}
                options={categories}
                compact
                fullWidth
              />
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card text-body focus:border-brand-primary focus:outline-none transition-colors duration-200"
              />
            </div>
          </div>
        </div>

        {/* Reports Table */}
        <div className="overflow-x-auto font-outfit">
          <table className="min-w-full divide-y divide-border-light">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">
                  Report Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">
                  Description
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium whitespace-nowrap text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {filteredReports.slice((currentPage - 1) * reportsPerPage, currentPage * reportsPerPage).map((report) => (
                <tr key={report.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold font-outfit text-body">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-brand" />
                      <span className="text-xs font-semibold text-heading">{report.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-outfit text-muted">
                    {report.description}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleViewReport(report)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-brand-primary hover:bg-brand-surface transition-colors"
                        aria-label="View report"
                      >
                        <FileText size={12} />
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-xs text-muted" colSpan={3}>
                    No reports found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Pagination 
            totalItems={filteredReports.length} 
            itemsPerPage={reportsPerPage} 
            currentPage={currentPage} 
            onPageChange={setCurrentPage} 
          />
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