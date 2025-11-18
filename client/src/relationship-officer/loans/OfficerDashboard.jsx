// src/components/OfficerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import LoanVerificationForm from '../../pages/registry/CustomerVerification';
import LoanBookingForm from './LoanBookingForm';

const OfficerDashboard = () => {
  const [user, setUser] = useState(null);
  const [loans, setLoans] = useState([]);
  const [assignedLoans, setAssignedLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'verification', 'booking'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchLoans();
      fetchAssignedLoans();
    }
  }, [user]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchLoans = async () => {
    try {
      const { data } = await supabase
        .from('loans')
        .select('*, customers(*)')
        .order('created_at', { ascending: false });
      
      setLoans(data || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedLoans = async () => {
    try {
      const { data } = await supabase
        .from('loan_assignments')
        .select('*, loans(*, customers(*))')
        .eq('assigned_to', user.id)
        .eq('status', 'unbooked');
      
      setAssignedLoans(data || []);
    } catch (error) {
      console.error('Error fetching assigned loans:', error);
    }
  };

  const handleVerificationStart = (loan) => {
    setSelectedLoan(loan);
    setView('verification');
  };

  const handleBookingStart = (loan) => {
    setSelectedLoan(loan);
    setView('booking');
  };

  const handleComplete = () => {
    setSelectedLoan(null);
    setView('dashboard');
    fetchLoans();
    fetchAssignedLoans();
  };

  if (view === 'verification' && selectedLoan) {
    return <LoanVerificationForm loanId={selectedLoan.id} onComplete={handleComplete} />;
  }

  if (view === 'booking' && selectedLoan) {
    return <LoanBookingForm loanId={selectedLoan.loans.id} onComplete={handleComplete} />;
  }

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Officer Dashboard</h1>
      
      {/* Assigned Loans for Booking */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Loans Assigned for Booking</h2>
        {assignedLoans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedLoans.map(assignment => (
              <div key={assignment.id} className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-semibold">Loan #{assignment.loans.id}</h3>
                <p>Customer: {assignment.loans.customers.Firstname} {assignment.loans.customers.Surname}</p>
                <p>Amount: KES {assignment.loans.approved_amount?.toLocaleString()}</p>
                <button
                  onClick={() => handleBookingStart(assignment)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Process Booking
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No loans assigned for booking</p>
        )}
      </div>

      {/* Loans for Verification */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Loans Pending Verification</h2>
        {loans.filter(loan => loan.status === 'pending').length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2">Loan ID</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Requested Amount</th>
                  <th className="px-4 py-2">Application Date</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans
                  .filter(loan => loan.status === 'pending')
                  .map(loan => (
                    <tr key={loan.id}>
                      <td className="px-4 py-2">{loan.id}</td>
                      <td className="px-4 py-2">{loan.customers.Firstname} {loan.customers.Surname}</td>
                      <td className="px-4 py-2">KES {loan.requested_amount?.toLocaleString()}</td>
                      <td className="px-4 py-2">{new Date(loan.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleVerificationStart(loan)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Verify
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No loans pending verification</p>
        )}
      </div>
    </div>
  );
};

export default OfficerDashboard;