// src/App.jsx
import { useState, memo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./hooks/userAuth";

// Shared components
import ProtectedRoute from "./components/ProtectedRoute";

// Layout Components
import SidebarAdmin from "./pages/admin/components/SidebarAdmin";
import HeaderAdmin from "./pages/admin/components/HeaderAdmin";
import SharedSidebar from "./components/SharedSidebar";
import SharedHeader from "./components/SharedHeader";

// Relationship Officer Pages
import OfficerDashboard from "./relationship-officer/Dashboard";
import Leads from "./relationship-officer/Leads";
import Customers from "./relationship-officer/Customers";
import Loans from "./relationship-officer/loans/Loans";
import LoanApplication from "./relationship-officer/loans/LoanApplication";
import ApprovalQueue from "./relationship-officer/loans/ApprovalQueue";
import Approval from "./relationship-officer/Approval";
import Amendments from "./relationship-officer/amendments/Amendments";
import ConversionChart from "./relationship-officer/components/CoversionChart";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AllUsers from "./pages/admin/AllUsers";
import AddUsers from "./pages/admin/AddUsers";
import SuspendedUsers from "./pages/admin/SuspendedUsers.jsx";
import AllLoansAdmin from "./pages/admin/loans/AllLoansAdmin";
import PendingLoans from "./pages/admin/loans/PendingLoans";
import ApprovedLoans from "./pages/admin/loans/ApprovedLoans";
import LoanProduct from "./pages/admin/loans/LoanProduct";
import RestructureLoans from "./pages/admin/loans/RestructureLoans";
import RejectedLoans from "./pages/loaning/RejectedLoans";
import LoanWriteOff from "./pages/admin/loans/LoanWriteOff";
import DisbursedLoansAdmin from "./pages/admin/loans/DisbursedLoansAdmin";

// Shared Pages
import Login from "./pages/Login";
import OperationsManagement from "./pages/operations/Operations";
import Dashboard from "./pages/Dashboard";
import Accounting from "./pages/accounting/Accounting";
import Transactions from "./pages/accounting/Transactions";
import ChartOfAccounts from "./pages/accounting/ChartOfAccounts";
import BankReconciliations from "./pages/accounting/BankReconciliations";
import Journals from "./pages/accounting/Journals";
import Registry from "./pages/registry/Registry";
import PendingAmendments from "./pages/registry/PendingAmendments";
import ApprovalPending from "./pages/registry/ApprovalPending";
import CustomerTransfer from "./pages/registry/CustomerTransfer";
import CustomerCategories from "./pages/registry/CustomerCategories";
import CustomerEdits from "./pages/registry/MainEdit.jsx";
import AllLoans from "./pages/loaning/AllLoans";
import LoanPendingRm from "./pages/loaning/LoanPendingRm";
import LoanPendingBm from "./pages/loaning/LoanPendingBm";
import LoanPendingDisbursement from "./pages/loaning/LoanPendingDisbursement";
import ApproveLoanbm from "./pages/loaning/ApproveLoan";
import HQReports from "./pages/reports/HQReports";
import CallbacksPending from "./pages/registry/CallbacksPending";
import AllCustomers from "./pages/registry/AllCustomers";
import DisbursedLoans from "./pages/loaning/DisbursementLoans";
import PromiseToPayList from "./pages/ptp/PromiseToPay";
import FinancialReports from "./pages/reports/FinancialReports";
import LoanReports from "./pages/reports/LoanReports";
import OfficerReports from "./pages/reports/OfficerReports";
import PTPReports from "./pages/reports/PTPReports";
import CustomerDrafts from "./pages/drafts/CustomerDrafts";
import LoanDrafts from "./pages/drafts/LoanDrafts";
import OtherDrafts from "./pages/drafts/OtherDrafts";
import Reports from "./pages/reports/Reports";
import SuspensePaymentsReport from "./pages/reports/SuspensePaymentsReport";
import LoanArrearsReport from "./pages/reports/LoanArrearsReport";
import InactiveCustomers from "./pages/reports/InactiveCustomers";
import TraceMpesaTransaction from "./pages/reports/TraceMpesaTransaction;";
import LoanListing from "./pages/reports/LoanListing";
import PendingDisbursementReport from "./pages/reports/LoansPendingDisbursementReport";
import OutstandingLoanBalanceReport from "./pages/reports/OutstandingLoanBalanceReport";
import NonPerformingLoansReport from "./pages/reports/NonPerformingLoansReport";
import LoanOfficerPerformanceReport from "./pages/reports/LoanOfficerPerformanceReport";
import MpesaRepaymentReports from "./pages/reports/MpesaRepaymentReports";
import CustomerListing from "./pages/reports/CustomerListing";
import LoanDueReport from "./pages/reports/LoanDueReport";
import DisbursementLoansReport from "./pages/reports/DisbursementLoansReport";
import CustomerAccountModal from "./pages/reports/CustomerAccountModal";
import CustomerDraft from "./relationship-officer/components/CustomerDraftModal.jsx";
import CustomerStatementModal from "./pages/reports/AccountList";
import OutstandingLoanBalanceReportEOM from "./pages/reports/OLBatEOM";
import Customer360View from "./pages/registry/360View";
import CustomerDetailsModal from "./relationship-officer/components/CustomerDetailsModal.jsx";
import CustomerInteractions from "./pages/registry/CustomerInteractions";
import LoanDetails from "./pages/registry/LoanDetails.jsx";
import PromiseToPay from "./pages/registry/PromiseToPay.jsx";
import AddCustomer from "./relationship-officer/components/AddCustomer.jsx";
import EditAmendment from "./relationship-officer/amendments/EditAmendment.jsx";
import AmendmentDetailsModal from "./relationship-officer/amendments/AmendmentDetailsModal.jsx"
import AmendmentDetailsPage from "./relationship-officer/amendments/AmendmentDetailsPage.jsx";
import OfficerDrafts from "./relationship-officer/components/OfficerDrafts.jsx";
import LoanBookingForm from "./relationship-officer/loans/LoanBooking.jsx";
import CustomerForm from "./relationship-officer/components/CustomerForm.jsx";
import CustomerVerification from "./pages/registry/CustomerVerification.jsx";
import Verification from "./pages/registry/Verification.jsx";
import ViewLoan from "./pages/loaning/ViewLoan.jsx";
import LoanInteraction from "./pages/loaning/LoanInteraction.jsx";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ViewDisbursedLoan from "./pages/loaning/ViewDisbursedLoan.jsx";
import ViewLoansPendingDisbursement from "./pages/loaning/ViewLoansPendingDisbursement.jsx";
import NewJournalEntry from "./pages/accounting/NewJournalEntry.jsx";
import ViewJournal from "./pages/accounting/ViewJournal.jsx";
import NewAccount from "./pages/accounting/NewAccount.jsx";
import EditAccount from "./pages/accounting/EditAccount.jsx";
import PendingBM from "./pages/registry/PendingBM.jsx";
import HQPending from "./pages/registry/HQPending.jsx";
import CustomerTransferForm from "./pages/registry/CustomerTransferForm.jsx";
import ParentCustomerEditComponent from "./pages/registry/MainEdit.jsx";
import LoanInstallmentReport from "./pages/reports/LoanInstallmentReport.jsx";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

const { user, profile } = useAuth();


 




  const role = profile?.role;

  // Roles that share the same layout and components (now includes relationship_officer)
  const sharedRoles = ['branch_manager', 'regional_manager', 'credit_analyst_officer', 'customer_service_officer', 'relationship_officer'];
  const isSharedRole = sharedRoles.includes(role);

  const renderSidebar = () => {
    if (role === "admin") {
      return (
        <SidebarAdmin
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      );
    }
    
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
    if (role === "admin") {
      return (
        <HeaderAdmin
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      );
    }
    
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
        return "/dashboard/admin";
      default:
        return "/dashboard";
    }
  };

  const ReportWrapper = memo(function ReportWrapper({ component: Component, userRole }) {
    return (
      <div className="mb-4">
        {Component && <Component userRole={userRole} />}
      </div>
    );
  });

  return (
    <Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        {profile && <>{renderSidebar()}</>}

        <div className="flex flex-col flex-1 min-w-0">
          {profile && renderHeader()}

          <div className="flex-1 overflow-y-auto p-6">

            <Routes>
              {/* Public route */}

              
 <Route
    path="/login"
    element={!user ? <Login /> : <Navigate to={getDefaultRoute()} replace />}
  />


              {/* Default redirect based on role */}
             <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard userRole={role} />
      </ProtectedRoute>
    }
  />

              {/* Shared Routes for RM, BM, CA, CSO, and Relationship Officer */}
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


                    <Route path="/journals/new" element={  <ProtectedRoute>
                        <NewJournalEntry userRole={role} />
                      </ProtectedRoute>} />
      <Route path="/journals/:id" element={  <ProtectedRoute>
                        <ViewJournal userRole={role} />
                      </ProtectedRoute>} />

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
          element={  <ProtectedRoute>
                        <NewAccount userRole={role} />
                      </ProtectedRoute>}
        />

        {/* Edit Existing Account */}
        <Route
          path="/chart-of-accounts/edit/:id"
          element={  <ProtectedRoute>
                        <EditAccount userRole={role} />
                      </ProtectedRoute>}
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
                  <Route path="/customer/:customerId/verify" element={
                    <ProtectedRoute>
                      <CustomerVerification />
                    </ProtectedRoute>
                  } />
                  <Route path="/customer/:customerId/verify-amendment" element={
                    <ProtectedRoute>
                      <CustomerVerification />
                    </ProtectedRoute>
                  } />
                  <Route path="/customer/:customerId/verify-customer_service_officer" element={
                    <ProtectedRoute>
                      <Verification />
                    </ProtectedRoute>
                  } />
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
                        <Reports userRole={role} />
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

                  <Route path="/viewdisbursedloans/:loanId" element={
                    
                  <ProtectedRoute>
                        <ViewDisbursedLoan userRole={role} />
                      </ProtectedRoute>
                    
                    
                    } />



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
                  <Route path="/loans/:loanId" element={
                    <ProtectedRoute>
                      <ViewLoan userRole={role} />
                    </ProtectedRoute>
                  } />
                  <Route path="/loans/:loanId/interactions" element={
                    <ProtectedRoute>
                      <LoanInteraction userRole={role} />
                    </ProtectedRoute>
                  } />
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

                  {/* Report Routes with Wrapper */}
                  <Route
                    path="/reports/disbursement-loans"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={DisbursementLoansReport} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/customer-account-statement"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={CustomerAccountModal} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/loan-due"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={LoanDueReport} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/customer-listing"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={CustomerListing} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/mpesa-repayment"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={MpesaRepaymentReports} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/loan-officer-performance"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={LoanOfficerPerformanceReport} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/non-performing-loans"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={NonPerformingLoansReport} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/outstanding-balance"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={OutstandingLoanBalanceReport} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/pending-disbursement"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={PendingDisbursementReport} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/loan-listing"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={LoanListing} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/trace-mpesa"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={TraceMpesaTransaction} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/inactive-customers"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={InactiveCustomers} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/loan-arrears"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={LoanArrearsReport} userRole={role} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports/suspense-payments"
                    element={
                      <ProtectedRoute>
                        <ReportWrapper component={SuspensePaymentsReport} userRole={role} />
                      </ProtectedRoute>
                    }
                  />

<Route
  path="/reports/customer-statement/:customerId"
  element={
    <ProtectedRoute>
                        <ReportWrapper component={CustomerStatementModal} userRole={role} />
                      </ProtectedRoute>
  }
/>


                </>
              )}

              {/* Operations */}
              <Route path="/operations" element={<OperationsManagement />} />

              {/* Admin Routes */}
              {role === "admin" && (
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
                    path="/loans/approved/admin"
                    element={<ApprovedLoans />}
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
                </>
              )}
            
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;