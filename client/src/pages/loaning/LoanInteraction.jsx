// src/pages/LoanInteractionsPage.jsx
import { useState, useEffect } from 'react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  DevicePhoneMobileIcon,
  UserGroupIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarIcon,
  PlusCircleIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

const LoanInteraction = () => {
  const { profile } = useAuth();
  const { loanId } = useParams();
  const navigate = useNavigate();
  
  const [loan, setLoan] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    interaction_type: 'Phone Call',
    notes: '',
    next_follow_up_date: '',
    status: 'completed',
  });

  const interactionTypes = [
    { value: 'Phone Call', icon: PhoneIcon, color: 'text-blue-600' },
    { value: 'SMS', icon: DevicePhoneMobileIcon, color: 'text-green-600' },
    { value: 'Visit', icon: UserGroupIcon, color: 'text-purple-600' },
    { value: 'Reminder', icon: BellAlertIcon, color: 'text-amber-600' },
    { value: 'Follow-up', icon: ClockIcon, color: 'text-indigo-600' },
  ];

  useEffect(() => {
    if (loanId) {
      fetchLoanAndInteractions();
    }
  }, [loanId]);

  const fetchLoanAndInteractions = async () => {
    try {
      setLoading(true);
      
      // Fetch loan details
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select(`
          *,
          customers (
            Firstname,
            Surname,
            mobile,
            id_number,
            branch_id,
            branches (
              id,
              name,
              region_id,
              regions (
                id,
                name
              )
            )
          )
        `)
        .eq('id', loanId)
        .single();

      if (loanError) throw loanError;

      // Fetch interactions
      const { data: interactionsData, error: interactionsError } = await supabase
        .from('loan_interactions')
        .select(`
          *,
          users (
            full_name,
            email
          )
        `)
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });

      if (interactionsError) throw interactionsError;

      setLoan(loanData);
      setInteractions(interactionsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load loan details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('loan_interactions')
        .insert([
          {
            customer_id: loan.customer_id,
            loan_id: loan.id,
            interaction_type: formData.interaction_type,
            notes: formData.notes,
            next_follow_up_date: formData.next_follow_up_date || null,
            status: formData.status,
            created_by: profile.id,
          }
        ]);

      if (error) throw error;

      // Reset form and refresh interactions
      setFormData({
        interaction_type: 'Phone Call',
        notes: '',
        next_follow_up_date: '',
        status: 'completed',
      });
      setShowForm(false);
      await fetchLoanAndInteractions();
      
      // Show success message
      alert('Interaction logged successfully!');
    } catch (error) {
      console.error('Error creating interaction:', error);
      alert('Failed to log interaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getInteractionIcon = (type) => {
    const interaction = interactionTypes.find(t => t.value === type);
    if (!interaction) return <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-600" />;
    
    const Icon = interaction.icon;
    return <Icon className={`h-5 w-5 ${interaction.color}`} />;
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      'follow-up scheduled': 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return badges[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading loan interactions...</p>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loan Not Found</h2>
          <p className="text-gray-600 mb-4">The requested loan could not be found.</p>
          <button
            onClick={() => navigate('/loans')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Loans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <ChatBubbleLeftRightIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Loan Interactions</h1>
                  <p className="text-gray-600 mt-1">
                    {loan.customers?.Firstname} {loan.customers?.Surname} • 
                    Loan #{loan.id} • 
                    KES {loan.scored_amount?.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Branch: {loan.customers?.branches?.name} • 
                    Phone: {loan.customers?.mobile}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <ClockIcon className="h-5 w-5 text-blue-600" />
              <span className="text-blue-700 font-semibold">
                {interactions.length} Interactions
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Add Interaction Button */}
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full mb-6 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-semibold text-lg"
              >
                <PlusCircleIcon className="h-6 w-6" />
                Log New Interaction
              </button>
            )}

            {/* Interaction Form */}
            {showForm && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-blue-200">
                <h3 className="text-xl font-bold text-gray-800 mb-6">New Interaction</h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Interaction Type
                    </label>
                    <select
                      value={formData.interaction_type}
                      onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value })}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      required
                    >
                      {interactionTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] text-lg"
                      placeholder="Enter details about this interaction..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Next Follow-up Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={formData.next_follow_up_date}
                        onChange={(e) => setFormData({ ...formData, next_follow_up_date: e.target.value })}
                        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                        required
                      >
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="follow-up scheduled">Follow-up Scheduled</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-6 w-6" />
                          Save Interaction
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-8 py-4 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold text-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Interactions List */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-200">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3 mb-6">
                <ClockIcon className="h-6 w-6 text-gray-600" />
                Interaction History ({interactions.length})
              </h3>

              {interactions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No interactions yet</h3>
                  <p className="text-gray-600">
                    Log your first interaction with this customer to start tracking communication.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {interactions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            {getInteractionIcon(interaction.interaction_type)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg">
                              {interaction.interaction_type}
                            </h4>
                            <p className="text-gray-500">
                              by {interaction.users?.full_name || 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusBadge(interaction.status)}`}>
                          {interaction.status}
                        </span>
                      </div>

                      <p className="text-gray-700 mb-4 bg-gray-50 p-4 rounded-lg text-lg">
                        {interaction.notes}
                      </p>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-6 text-gray-500">
                          <span className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {new Date(interaction.created_at).toLocaleDateString('en-GB')}
                          </span>
                          <span>
                            {new Date(interaction.created_at).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {interaction.next_follow_up_date && (
                          <span className="flex items-center gap-2 text-blue-600 font-medium">
                            <ClockIcon className="h-4 w-4" />
                            Follow-up: {new Date(interaction.next_follow_up_date).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Loan Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-200 sticky top-8">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Loan Summary</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">Customer</label>
                  <p className="text-lg font-medium text-gray-900">
                    {loan.customers?.Firstname} {loan.customers?.Surname}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-semibold text-gray-600">Loan Amount</label>
                  <p className="text-xl font-bold text-emerald-600">
                    KES {loan.scored_amount?.toLocaleString()}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-semibold text-gray-600">Duration</label>
                  <p className="text-lg font-medium text-gray-900">
                    {loan.duration_weeks} weeks
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-semibold text-gray-600">Branch</label>
                  <p className="text-lg font-medium text-gray-900">
                    {loan.customers?.branches?.name}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-semibold text-gray-600">Status</label>
                  <p className="text-lg font-medium text-blue-600 capitalize">
                    {loan.status?.replace('_', ' ')}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-semibold text-gray-600">Created</label>
                  <p className="text-lg font-medium text-gray-900">
                    {new Date(loan.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanInteraction;