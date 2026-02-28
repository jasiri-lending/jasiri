// src/App.jsx
import { useState, memo, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./hooks/userAuth";
import { ToastProvider } from "./components/Toast";

// Shared components
import ProtectedRoute from "./components/ProtectedRoute";
import { usePermissions } from "./hooks/usePermissions";
import { Lock } from "lucide-react";
import Spinner from "./components/Spinner";

// Layout Components
import SharedSidebar from "./components/SharedSidebar";
import SharedHeader from "./components/SharedHeader";
import { PermissionProvider } from "./context/PermissionContext";

// Relationship Officer Pages
const OfficerDashboard = lazy(() => import("./relationship-officer/Dashboard"));
const Leads = lazy(() => import("./relationship-officer/Leads"));
const Customers = lazy(() => import("./relationship-officer/Customers"));
const Loans = lazy(() => import("./relationship-officer/loans/Loans"));
const LoanApplication = lazy(() => import("./relationship-officer/loans/LoanApplication"));
const ApprovalQueue = lazy(() => import("./relationship-officer/loans/ApprovalQueue"));
const Approval = lazy(() => import("./relationship-officer/Approval"));
const Amendments = lazy(() => import("./relationship-officer/amendments/Amendments"));
const ConversionChart = lazy(() => import("./relationship-officer/components/CoversionChart"));

// Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AllUsers = lazy(() => import("./pages/admin/AllUsers"));
const AddUsers = lazy(() => import("./pages/admin/AddUsers"));
const SuspendedUsers = lazy(() => import("./pages/admin/SuspendedUsers.jsx"));
const AllLoansAdmin = lazy(() => import("./pages/admin/loans/AllLoansAdmin"));
const PendingLoans = lazy(() => import("./pages/admin/loans/PendingLoans"));
const ApprovedLoans = lazy(() => import("./pages/admin/loans/ApprovedLoans"));
const LoanProduct = lazy(() => import("./pages/admin/loans/LoanProduct"));
const RestructureLoans = lazy(() => import("./pages/admin/loans/RestructureLoans"));
const RejectedLoans = lazy(() => import("./pages/loaning/RejectedLoans"));
const LoanWriteOff = lazy(() => import("./pages/admin/loans/LoanWriteOff"));
const DisbursedLoansAdmin = lazy(() => import("./pages/admin/loans/DisbursedLoansAdmin"));

// Shared Pages
import Login from "./pages/Login";
// Shared Pages
const OperationsManagement = lazy(() => import("./pages/operations/Operations"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Accounting = lazy(() => import("./pages/accounting/Accounting"));
const Transactions = lazy(() => import("./pages/accounting/Transactions"));
const ChartOfAccounts = lazy(() => import("./pages/accounting/ChartOfAccounts"));
const BankReconciliations = lazy(() => import("./pages/accounting/BankReconciliations"));
const Journals = lazy(() => import("./pages/accounting/Journals"));
const Registry = lazy(() => import("./pages/registry/Registry"));
const PendingAmendments = lazy(() => import("./pages/registry/PendingAmendments"));
const ApprovalPending = lazy(() => import("./pages/registry/ApprovalPending"));
const CustomerTransfer = lazy(() => import("./pages/registry/CustomerTransfer"));
const CustomerCategories = lazy(() => import("./pages/registry/CustomerCategories"));
const CustomerEdits = lazy(() => import("./pages/registry/MainEdit.jsx"));
const AllLoans = lazy(() => import("./pages/loaning/AllLoans"));
const LoanPendingRm = lazy(() => import("./pages/loaning/LoanPendingRm"));
const LoanPendingBm = lazy(() => import("./pages/loaning/LoanPendingBm"));
const LoanPendingDisbursement = lazy(() => import("./pages/loaning/LoanPendingDisbursement"));
const ApproveLoanbm = lazy(() => import("./pages/loaning/ApproveLoan"));
const HQReports = lazy(() => import("./pages/reports/HQReports"));
const CallbacksPending = lazy(() => import("./pages/registry/CallbacksPending"));
const AllCustomers = lazy(() => import("./pages/registry/AllCustomers"));
const DisbursedLoans = lazy(() => import("./pages/loaning/DisbursementLoans"));
const PromiseToPayList = lazy(() => import("./pages/ptp/PromiseToPay"));
const FinancialReports = lazy(() => import("./pages/reports/FinancialReports"));
const LoanReports = lazy(() => import("./pages/reports/LoanReports"));
const OfficerReports = lazy(() => import("./pages/reports/OfficerReports"));
const PTPReports = lazy(() => import("./pages/reports/PTPReports"));
const CustomerDrafts = lazy(() => import("./pages/drafts/CustomerDrafts"));
const LoanDrafts = lazy(() => import("./pages/drafts/LoanDrafts"));
const OtherDrafts = lazy(() => import("./pages/drafts/OtherDrafts"));
const Reports = lazy(() => import("./pages/reports/Reports"));
const SuspensePaymentsReport = lazy(() => import("./pages/reports/SuspensePaymentsReport"));
const LoanArrearsReport = lazy(() => import("./pages/reports/LoanArrearsReport"));
const InactiveCustomers = lazy(() => import("./pages/reports/InactiveCustomers"));
const TraceMpesaTransaction = lazy(() => import("./pages/reports/TraceMpesaTransaction"));
const LoanListing = lazy(() => import("./pages/reports/LoanListing"));
const PendingDisbursementReport = lazy(() => import("./pages/reports/LoansPendingDisbursementReport"));
const OutstandingLoanBalanceReport = lazy(() => import("./pages/reports/OutstandingLoanBalanceReport"));
const NonPerformingLoansReport = lazy(() => import("./pages/reports/NonPerformingLoansReport"));
const LoanOfficerPerformanceReport = lazy(() => import("./pages/reports/LoanOfficerPerformanceReport"));
const MpesaRepaymentReports = lazy(() => import("./pages/reports/MpesaRepaymentReports"));
const CustomerListing = lazy(() => import("./pages/reports/CustomerListing"));
const LoanDueReport = lazy(() => import("./pages/reports/LoanDueReport"));
const DisbursementLoansReport = lazy(() => import("./pages/reports/DisbursementLoansReport"));
const CustomerAccountModal = lazy(() => import("./pages/reports/CustomerAccountModal"));
const CustomerDraft = lazy(() => import("./relationship-officer/components/CustomerDraftModal.jsx"));
const CustomerStatementModal = lazy(() => import("./pages/reports/AccountList"));
const OutstandingLoanBalanceReportEOM = lazy(() => import("./pages/reports/OLBatEOM"));
const Customer360View = lazy(() => import("./pages/registry/360View"));
const CustomerDetailsModal = lazy(() => import("./relationship-officer/components/CustomerDetailsModal.jsx"));
const ReconcileTransaction = lazy(() => import("./pages/accounting/ReconcileTransaction"));
const CustomerInteractions = lazy(() => import("./pages/registry/CustomerInteractions"));
const LoanDetails = lazy(() => import("./pages/registry/LoanDetails.jsx"));
const PromiseToPay = lazy(() => import("./pages/registry/PromiseToPay.jsx"));
const AddCustomer = lazy(() => import("./relationship-officer/components/AddCustomer.jsx"));
const EditAmendment = lazy(() => import("./relationship-officer/amendments/EditAmendment.jsx"));
const AmendmentDetailsModal = lazy(() => import("./relationship-officer/amendments/AmendmentDetailsModal.jsx"));
const AmendmentDetailsPage = lazy(() => import("./relationship-officer/amendments/AmendmentDetailsPage.jsx"));
const OfficerDrafts = lazy(() => import("./relationship-officer/components/OfficerDrafts.jsx"));
const LoanBookingForm = lazy(() => import("./relationship-officer/loans/LoanBooking.jsx"));
const CustomerForm = lazy(() => import("./relationship-officer/components/CustomerForm.jsx"));
const CustomerVerification = lazy(() => import("./pages/registry/CustomerVerification.jsx"));
const Verification = lazy(() => import("./pages/registry/Verification.jsx"));
const ViewLoan = lazy(() => import("./pages/loaning/ViewLoan.jsx"));
const LoanInteraction = lazy(() => import("./pages/loaning/LoanInteraction.jsx"));
const ChangePassword = lazy(() => import("./pages/ChangePassword.jsx"));
const LoanProducts = lazy(() => import("./pages/loaning/LoanProducts.jsx"));
const ViewDisbursedLoan = lazy(() => import("./pages/loaning/ViewDisbursedLoan.jsx"));
const ViewLoansPendingDisbursement = lazy(() => import("./pages/loaning/ViewLoansPendingDisbursement.jsx"));
const NewJournalEntry = lazy(() => import("./pages/accounting/NewJournalEntry.jsx"));
const ViewJournal = lazy(() => import("./pages/accounting/ViewJournal.jsx"));
const GeneralLedgerEntries = lazy(() => import("./pages/accounting/GeneralLedgerEntries.jsx"));
const NewAccount = lazy(() => import("./pages/accounting/NewAccount.jsx"));
const EditAccount = lazy(() => import("./pages/accounting/EditAccount.jsx"));
const PendingBM = lazy(() => import("./pages/registry/PendingBM.jsx"));
const HQPending = lazy(() => import("./pages/registry/HQPending.jsx"));
const CustomerTransferForm = lazy(() => import("./pages/registry/CustomerTransferForm.jsx"));
const ParentCustomerEditComponent = lazy(() => import("./pages/registry/MainEdit.jsx"));
const LoanInstallmentReport = lazy(() => import("./pages/reports/LoanInstallmentReport.jsx"));
const Guarantors = lazy(() => import("./pages/registry/Guarantors.jsx"));
const AdminCreateReportUser = lazy(() => import("./pages/admin/components/AdminCreateReportUser.jsx"));
const AdminCreateTenant = lazy(() => import("./pages/admin/components/AdminCreateTenant.jsx"));
const TenantMpesaForm = lazy(() => import("./pages/admin/components/TenantMpesa.jsx"));
const TenantViewPage = lazy(() => import("./pages/admin/components/TenantViewPage.jsx"));
const PenaltySettingsManager = lazy(() => import("./pages/admin/components/PenaltySettingsManager.jsx"));
const AnalyticsDashBoard = lazy(() => import("./pages/analytics/AnalyticsDashboard.jsx"));
const PenaltySettings = lazy(() => import("./pages/registry/Penalties.jsx"));
const Regions = lazy(() => import("./pages/admin/Regions.jsx"));
const Branches = lazy(() => import("./pages/admin/Branches.jsx"));
const UserGroups = lazy(() => import("./pages/admin/UserGroups.jsx"));
const Partners = lazy(() => import("./pages/admin/Partners.jsx"));
const WorkflowSettings = lazy(() => import("./pages/admin/WorkflowSettings.jsx"));
const WorkflowStatuses = lazy(() => import("./pages/admin/WorkflowStatuses.jsx"));
const RolePermissionManager = lazy(() => import("./pages/admin/RolePermissionManager.jsx"));
const OperationsDashboard = lazy(() => import("./pages/operationdashbaord/OperationsDashboard.jsx"));
const FinancialDashboard = lazy(() => import("./pages/FinancialDashboard.jsx"));
const UserProfile = lazy(() => import("./pages/UserProfile.jsx"));
const ReportsLayout = lazy(() => import("./context/ReportsLayout.jsx"));

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, profile, initializing } = useAuth();

  const role = profile?.role;

  // Updated: Include admin and superadmin in sharedRoles
  const sharedRoles = ['admin', 'superadmin', 'branch_manager', 'regional_manager', 'credit_analyst_officer', 'customer_service_officer', 'relationship_officer'];
  const isSharedRole = sharedRoles.includes(role);

  const renderSidebar = () => {
    if (isSharedRole) {
      return (
        <SharedSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          userRole={role}
        />
      );
    }
    return null;
  };

  const renderHeader = () => {
    if (isSharedRole) {
      return (
        <SharedHeader
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          userRole={role}
        />
      );
    }
    return null;
  };

  const getDefaultRoute = () => {
    switch (role) {
      case "relationship_officer":
      case "branch_manager":
      case "regional_manager":
      case "credit_analyst_officer":
      case "customer_service_officer":
        return "/dashboard";
      case "admin":
      case "superadmin":
        return "/dashboard/admin";
      default:
        return "/dashboard";
    }
  };

  const ReportWrapper = memo(function ReportWrapper({ component: Component, userRole, permission }) {
    const { hasPermission, loading: permsLoading } = usePermissions();

    // While permissions are loading, we don't show the "Access Denied" UI 
    // to avoid flickering. We also don't show a spinner per the goal.
    if (permsLoading) return null;

    // Remove the blocking spinner - since access is checked in the dashboard
    // and this wrapper is for routing security, we can allow the component 
    // to render and handle any specific "no access" states internally or 
    // let it resolve in sub-seconds.

    if (permission && !hasPermission(permission)) {
      return (
        <div className="min-h-screen bg-brand-surface flex flex-col items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-gray-200">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">
              You do not have the required permissions to view this report.
              Please contact your administrator if you believe this is an error.
            </p>
            <button
              onClick={() => window.history.back()}
              className="w-full bg-brand-secondary text-white py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-4">
        {Component && <Component userRole={userRole} />}
      </div>
    );
  });

  return (
    <Router>
      <PermissionProvider>
        <ToastProvider>
          <div className="flex h-screen bg-gray-100 overflow-hidden">
            {!initializing && profile && window.location.pathname !== "/login" && <>{renderSidebar()}</>}

            <div className="flex flex-col flex-1 min-w-0">
              {!initializing && profile && window.location.pathname !== "/login" && renderHeader()}

              <div className="flex-1 overflow-y-auto p-6">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <Spinner text="Loading component..." />
                  </div>
                }>
                  <Routes>
                    {/* Public route */}
                    <Route
                      path="/"
                      element={
                        initializing ? (
                          <div className="min-h-screen bg-brand-surface flex items-center justify-center">
                            <Spinner text="Initializing application..." />
                          </div>
                        ) : user && profile ? (
                          <Navigate to={getDefaultRoute()} replace />
                        ) : (
                          <Navigate to="/login" replace />
                        )
                      }
                    />

                    <Route
                      path="/login"
                      element={
                        initializing ? (
                          <div className="min-h-screen bg-brand-surface flex items-center justify-center">
                            <Spinner text="Initializing application..." />
                          </div>
                        ) : user && profile ? (
                          <Navigate to={getDefaultRoute()} replace />
                        ) : (
                          <Login />
                        )
                      }
                    />

                    <Route
                      path="/change-password"
                      element={
                        initializing ? (
                          <div className="min-h-screen bg-brand-surface flex items-center justify-center">
                            <Spinner text="Loading password reset..." />
                          </div>
                        ) : user ? (
                          <ChangePassword />
                        ) : (
                          <Navigate to="/login" replace />
                        )
                      }
                    />

                    {/* Shared Routes for all roles including Admin */}
                    {isSharedRole && (
                      <>
                        {/* Dashboard - role-specific data filtering */}
                        <Route
                          path="/dashboard"
                          element={
                            <ProtectedRoute>
                              <Dashboard userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        {/* Accounting */}
                        <Route
                          path="/accounting"
                          element={
                            <ProtectedRoute>
                              <Accounting userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/accounting/transactions"
                          element={
                            <ProtectedRoute>
                              <Transactions userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/accounting/reconcile/:id"
                          element={
                            <ProtectedRoute>
                              <ReconcileTransaction userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/accounting/chart-of-accounts"
                          element={
                            <ProtectedRoute>
                              <ChartOfAccounts userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/accounting/bank-reconciliations"
                          element={
                            <ProtectedRoute>
                              <BankReconciliations userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/accounting/journals"
                          element={
                            <ProtectedRoute>
                              <Journals userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/journals/new"
                          element={
                            <ProtectedRoute>
                              <NewJournalEntry userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/journals/:id"
                          element={
                            <ProtectedRoute>
                              <ViewJournal userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/accounting/gl-entries"
                          element={
                            <ProtectedRoute>
                              <GeneralLedgerEntries userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        {/* Registry */}
                        <Route
                          path="/registry"
                          element={
                            <ProtectedRoute>
                              <Registry userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/registry/customers"
                          element={
                            <ProtectedRoute>
                              <AllCustomers userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/registry/pending-amendments"
                          element={
                            <ProtectedRoute>
                              <PendingAmendments userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/registry/hq-pending"
                          element={
                            <ProtectedRoute>
                              <HQPending userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/transfer"
                          element={
                            <ProtectedRoute>
                              <CustomerTransferForm userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/registry/approvals-pending"
                          element={
                            <ProtectedRoute>
                              <ApprovalPending userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/registry/bm-pending"
                          element={
                            <ProtectedRoute>
                              <PendingBM userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/registry/customer-transfer"
                          element={
                            <ProtectedRoute>
                              <CustomerTransfer userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/registry/customer-categories"
                          element={
                            <ProtectedRoute>
                              <CustomerCategories userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/registry/customer-edits"
                          element={
                            <ProtectedRoute>
                              <ParentCustomerEditComponent userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/registry/callbacks-pending"
                          element={
                            <ProtectedRoute>
                              <CallbacksPending userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/chart-of-accounts/new"
                          element={
                            <ProtectedRoute>
                              <NewAccount userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/loaning/penalty-settings"
                          element={
                            <ProtectedRoute>
                              <PenaltySettings userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/analytics"
                          element={
                            <ProtectedRoute>
                              <AnalyticsDashBoard userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        {/* Edit Existing Account */}
                        <Route
                          path="/chart-of-accounts/edit/:id"
                          element={
                            <ProtectedRoute>
                              <EditAccount userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        {/* Relationship Officer Specific Routes */}
                        {role === 'relationship_officer' && (
                          <>
                            <Route
                              path="/officer/leads"
                              element={
                                <ProtectedRoute>
                                  <Leads />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/customers"
                              element={
                                <ProtectedRoute>
                                  <Customers />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/customers/add"
                              element={
                                <ProtectedRoute>
                                  <AddCustomer />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/loans"
                              element={
                                <ProtectedRoute>
                                  <Loans />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/loan-booking/:customerId"
                              element={
                                <ProtectedRoute>
                                  <LoanBookingForm />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/customer-form"
                              element={
                                <ProtectedRoute>
                                  <CustomerForm />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/loans/applications"
                              element={
                                <ProtectedRoute>
                                  <LoanApplication />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/loans/approval"
                              element={
                                <ProtectedRoute>
                                  <ApprovalQueue />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/customers/approval"
                              element={
                                <ProtectedRoute>
                                  <Approval />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/customers/amendments"
                              element={
                                <ProtectedRoute>
                                  <Amendments />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/customers/drafts"
                              element={
                                <ProtectedRoute>
                                  <OfficerDrafts />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/loans/drafts"
                              element={
                                <ProtectedRoute>
                                  <LoanDrafts />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/:customerId/details"
                              element={
                                <ProtectedRoute>
                                  <CustomerDetailsModal />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/drafts/view/:draftId"
                              element={
                                <ProtectedRoute>
                                  <CustomerDraft />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/officer/conversions"
                              element={
                                <ProtectedRoute>
                                  <ConversionChart />
                                </ProtectedRoute>
                              }
                            />
                            <Route path="/officer/editamendments/:customerId" element={<EditAmendment />} />
                            <Route path="/officer/viewamendments/:amendmentId" element={<AmendmentDetailsPage />} />
                          </>
                        )}

                        {/* Customer 360 View Routes */}
                        <Route
                          path="/customer/:customerId/360"
                          element={
                            <ProtectedRoute>
                              <Customer360View userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/customer/:customerId/details"
                          element={
                            <ProtectedRoute>
                              <CustomerDetailsModal />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/customer/:customerId/verify"
                          element={
                            <ProtectedRoute>
                              <CustomerVerification />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/customer/:customerId/verify-amendment"
                          element={
                            <ProtectedRoute>
                              <CustomerVerification />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/customer/:customerId/verify-customer_service_officer"
                          element={
                            <ProtectedRoute>
                              <Verification />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/customer/:customerId/interactions"
                          element={
                            <ProtectedRoute>
                              <CustomerInteractions />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/customer/:customerId/loan-details"
                          element={
                            <ProtectedRoute>
                              <LoanDetails />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/registry/guarantors"
                          element={
                            <ProtectedRoute>
                              <Guarantors />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/customer/:customerId/promise-to-pay"
                          element={
                            <ProtectedRoute>
                              <PromiseToPay />
                            </ProtectedRoute>
                          }
                        />

                        {/* Reports */}
                        <Route
                          path="/reports"
                          element={
                            <ProtectedRoute>
                              <ReportsLayout>
                                <Reports userRole={role} />
                              </ReportsLayout>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/hq-reports"
                          element={
                            <ProtectedRoute>
                              <HQReports userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/accountlist/:customerId"
                          element={
                            <ProtectedRoute>
                              <CustomerStatementModal userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/reports/outstandEOM"
                          element={
                            <ProtectedRoute>
                              <OutstandingLoanBalanceReportEOM userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/financial"
                          element={
                            <ProtectedRoute>
                              <FinancialReports userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/reports/installments-report"
                          element={
                            <ProtectedRoute>
                              <LoanInstallmentReport userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/reports/all"
                          element={
                            <ProtectedRoute>
                              <Reports userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/officers"
                          element={
                            <ProtectedRoute>
                              <OfficerReports userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/ptp"
                          element={
                            <ProtectedRoute>
                              <PTPReports userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/drafts/customers"
                          element={
                            <ProtectedRoute>
                              <CustomerDrafts userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/drafts/loans"
                          element={
                            <ProtectedRoute>
                              <LoanDrafts userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/drafts/others"
                          element={
                            <ProtectedRoute>
                              <OtherDrafts userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        {/* Loaning */}
                        <Route
                          path="/loaning/all"
                          element={
                            <ProtectedRoute>
                              <AllLoans userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/loaning/products"
                          element={
                            <ProtectedRoute>
                              <LoanProducts userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/loaning/pending-regional-manager"
                          element={
                            <ProtectedRoute>
                              <LoanPendingRm userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/loaning/pending-branch-manager"
                          element={
                            <ProtectedRoute>
                              <LoanPendingBm userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/loaning/pending-disbursement"
                          element={
                            <ProtectedRoute>
                              <LoanPendingDisbursement userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/loaning/disbursement-loans"
                          element={
                            <ProtectedRoute>
                              <DisbursedLoans userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/viewdisbursedloans/:loanId"
                          element={
                            <ProtectedRoute>
                              <ViewDisbursedLoan userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/view-disbursed-loans/:id"
                          element={
                            <ProtectedRoute>
                              <ViewLoansPendingDisbursement userRole={role} />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/loaning/loan-approval"
                          element={
                            <ProtectedRoute>
                              <ApproveLoanbm userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/loans/:loanId"
                          element={
                            <ProtectedRoute>
                              <ViewLoan userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/loans/:loanId/interactions"
                          element={
                            <ProtectedRoute>
                              <LoanInteraction userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/promise-to-pay"
                          element={
                            <ProtectedRoute>
                              <PromiseToPayList userRole={role} />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/loaning/rejected-loans"
                          element={
                            <ProtectedRoute>
                              <RejectedLoans userRole={role} />
                            </ProtectedRoute>
                          }
                        />




                        <Route
                          path="/operations/dashboard"
                          element={
                            <ProtectedRoute>
                              <OperationsDashboard userRole={role} />
                            </ProtectedRoute>
                          }
                        />


                        <Route
                          path="/profile"
                          element={
                            <ProtectedRoute>
                              <UserProfile userRole={role} />
                            </ProtectedRoute>
                          }
                        />



                        <Route
                          path="/financial/dashboard"
                          element={
                            <ProtectedRoute>
                              <FinancialDashboard userRole={role} />
                            </ProtectedRoute>
                          }
                        />






                        {/* Report Routes with Wrapper */}
                        <Route
                          path="/reports/disbursement-loans"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={DisbursementLoansReport} userRole={role} permission="report.loan_disbursement" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/customer-account-statement"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={CustomerAccountModal} userRole={role} permission="report.customer_account_statement" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/loan-due"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={LoanDueReport} userRole={role} permission="report.loan_due" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/customer-listing"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={CustomerListing} userRole={role} permission="report.customer_listing" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/mpesa-repayment"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={MpesaRepaymentReports} userRole={role} permission="report.mpesa_repayment" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/loan-officer-performance"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={LoanOfficerPerformanceReport} userRole={role} permission="report.loan_officer_performance" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/non-performing-loans"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={NonPerformingLoansReport} userRole={role} permission="report.non_performing_loans" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/outstanding-balance"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={OutstandingLoanBalanceReport} userRole={role} permission="report.outstanding_balance" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/pending-disbursement"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={PendingDisbursementReport} userRole={role} permission="report.pending_disbursement" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/loan-listing"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={LoanListing} userRole={role} permission="report.loan_listing" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/trace-mpesa"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={TraceMpesaTransaction} userRole={role} permission="report.trace_mpesa" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/installments"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={LoanInstallmentReport} userRole={role} permission="report.installments" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/inactive-customers"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={InactiveCustomers} userRole={role} permission="report.inactive_customers" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/loan-arrears"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={LoanArrearsReport} userRole={role} permission="report.loan_arrears" />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/suspense-payments"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={SuspensePaymentsReport} userRole={role} permission="report.suspense_payments" />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/reports/customer-statement/:customerId"
                          element={
                            <ProtectedRoute>
                              <ReportWrapper component={CustomerStatementModal} userRole={role} permission="report.customer_account_statement" />
                            </ProtectedRoute>
                          }
                        />
                      </>
                    )}

                    {/* Operations */}
                    <Route path="/operations" element={<OperationsManagement />} />

                    {/* Admin Routes */}
                    {(role === "admin" || role === "superadmin") && (
                      <>
                        <Route path="/dashboard/admin" element={<AdminDashboard />} />
                        <Route path="/users/all/admin" element={<AllUsers />} />
                        <Route path="/users/add/admin" element={<AddUsers />} />
                        <Route
                          path="/users/suspended/admin"
                          element={<SuspendedUsers />}
                        />
                        <Route path="/loans/all/admin" element={<AllLoansAdmin />} />
                        <Route
                          path="/loans/pending/admin"
                          element={<PendingLoans />}
                        />

                        <Route
                          path="/penalty-settings/admin"
                          element={<PenaltySettingsManager />}
                        />

                        <Route
                          path="/users/report-access/admin"
                          element={<AdminCreateReportUser />}
                        />
                        <Route
                          path="/users/create-tenant/admin"
                          element={<AdminCreateTenant />}
                        />
                        <Route
                          path="/loans/product/admin"
                          element={<LoanProduct />}
                        />
                        <Route
                          path="/loans/restructure/admin"
                          element={<RestructureLoans />}
                        />

                        <Route
                          path="/tenants_details/:tenantId"
                          element={<TenantViewPage />}
                        />

                        <Route
                          path="/tenants/mpesa-config/admin"
                          element={<TenantMpesaForm />}
                        />
                        <Route
                          path="/loans/rejected/admin"
                          element={<RejectedLoans />}
                        />
                        <Route
                          path="/loans/disbursed/admin"
                          element={<DisbursedLoansAdmin />}
                        />
                        <Route
                          path="/loans/writeoffs/admin"
                          element={<LoanWriteOff />}
                        />

                        {/* New Admin Routes */}
                        <Route path="/branches/admin" element={<Branches />} />
                        <Route path="/regions/admin" element={<Regions />} />
                        <Route path="/user-groups/admin" element={<UserGroups />} />
                        <Route path="/partners/admin" element={<Partners />} />
                        <Route path="/workflow-setting/admin" element={<WorkflowSettings />} />
                        <Route path="/workflow-statuses/admin" element={<WorkflowStatuses />} />
                        <Route path="/roles/admin" element={<RolePermissionManager />} />
                      </>
                    )}

                    <Route
                      path="*"
                      element={
                        initializing ? (
                          <div className="min-h-screen bg-brand-surface flex items-center justify-center">
                            <Spinner text="Initializing application..." />
                          </div>
                        ) : user && profile ? (
                          <Navigate to={getDefaultRoute()} replace />
                        ) : (
                          <Navigate to="/login" replace />
                        )
                      }
                    />
                  </Routes>
                </Suspense>
              </div>
            </div>
          </div>
        </ToastProvider>
      </PermissionProvider>
    </Router>
  );
}

export default App;
