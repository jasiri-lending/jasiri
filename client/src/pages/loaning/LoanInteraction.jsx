// src/pages/LoanInteractionsPage.jsx
import { useState, useEffect } from 'react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from '../../components/Spinner';
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
    { value: 'Phone Call', icon: PhoneIcon, color: 'text-[#586ab1]' },
    { value: 'SMS', icon: DevicePhoneMobileIcon, color: 'text-[#586ab1]' },
    { value: 'Visit', icon: UserGroupIcon, color: 'text-[#586ab1]' },
    { value: 'Reminder', icon: BellAlertIcon, color: 'text-[#586ab1]' },
    { value: 'Follow-up', icon: ClockIcon, color: 'text-[#586ab1]' },
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
    if (!interaction) return <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-600" />;
    
    const Icon = interaction.icon;
    return <Icon className={`h-4 w-4 ${interaction.color}`} />;
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-100 text-green-800 border border-green-200 text-xs px-2 py-1 rounded-full',
      pending: 'bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2 py-1 rounded-full',
      'follow-up scheduled': 'bg-[#586ab1]/10 text-[#586ab1] border border-[#586ab1]/20 text-xs px-2 py-1 rounded-full',
    };
    return badges[status] || 'bg-gray-100 text-gray-800 border border-gray-200 text-xs px-2 py-1 rounded-full';
  };

  if (loading) {
    return (
     <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
               <Spinner text="Loading ..." />
             </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="text-center">
          <h2 className="text-sm text-gray-800 mb-2">Loan Not Found</h2>
          <p className="text-gray-600 text-xs mb-4">The requested loan could not be found.</p>
          <button
            onClick={() => navigate('/loans')}
            className="px-4 py-2 bg-[#586ab1] text-white text-sm rounded-lg hover:bg-[#47578c] transition-colors"
          >
            Back to Loans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ArrowLeftIcon className="h-4 w-4 text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#586ab1]/10 rounded-lg">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-[#586ab1]" />
                </div>
                <div>
                  <h1 className="text-sm font-medium text-gray-800">Loan Interactions</h1>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {loan.customers?.Firstname} {loan.customers?.Surname} • 
                    Loan #{loan.id} • 
                    KES {loan.scored_amount?.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Branch: {loan.customers?.branches?.name} • 
                    Phone: {loan.customers?.mobile}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#586ab1]/10 rounded-lg border border-[#586ab1]/20">
              <ClockIcon className="h-4 w-4 text-[#586ab1]" />
              <span className="text-[#586ab1] text-sm font-medium">
                {interactions.length} Interactions
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Add Interaction Button */}
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#586ab1] text-white text-sm rounded-lg hover:bg-[#47578c] transition-all shadow-sm hover:shadow font-medium"
              >
                <PlusCircleIcon className="h-4 w-4" />
                Log New Interaction
              </button>
            )}

            {/* Interaction Form */}
            {showForm && (
              <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">New Interaction</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Interaction Type
                    </label>
                    <select
                      value={formData.interaction_type}
                      onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value })}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1]"
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
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] min-h-[100px]"
                      placeholder="Enter details about this interaction..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Next Follow-up Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={formData.next_follow_up_date}
                        onChange={(e) => setFormData({ ...formData, next_follow_up_date: e.target.value })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1]"
                        required
                      >
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="follow-up scheduled">Follow-up Scheduled</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#586ab1] text-white text-sm rounded-lg hover:bg-[#47578c] transition-all shadow-sm hover:shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4" />
                          Save Interaction
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Interactions List */}
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <ClockIcon className="h-4 w-4 text-gray-600" />
                Interaction History ({interactions.length})
              </h3>

              {interactions.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-medium text-gray-800 mb-1.5">No interactions yet</h3>
                  <p className="text-gray-600 text-xs">
                    Log your first interaction with this customer to start tracking communication.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-50 rounded-lg">
                            {getInteractionIcon(interaction.interaction_type)}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800 text-sm">
                              {interaction.interaction_type}
                            </h4>
                            <p className="text-gray-500 text-xs">
                              by {interaction.users?.full_name || 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <span className={getStatusBadge(interaction.status)}>
                          {interaction.status}
                        </span>
                      </div>

                      <p className="text-gray-700 mb-3 bg-gray-50 p-3 rounded-lg text-sm">
                        {interaction.notes}
                      </p>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4 text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <CalendarIcon className="h-3.5 w-3.5" />
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
                          <span className="flex items-center gap-1.5 text-[#586ab1] font-medium">
                            <ClockIcon className="h-3.5 w-3.5" />
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
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 sticky top-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Loan Summary</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Customer</label>
                  <p className="text-sm font-medium text-gray-800">
                    {loan.customers?.Firstname} {loan.customers?.Surname}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-600">Loan Amount</label>
                  <p className="text-base font-bold text-[#586ab1]">
                    KES {loan.scored_amount?.toLocaleString()}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-600">Duration</label>
                  <p className="text-sm font-medium text-gray-800">
                    {loan.duration_weeks} weeks
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-600">Branch</label>
                  <p className="text-sm font-medium text-gray-800">
                    {loan.customers?.branches?.name}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-600">Status</label>
                  <p className="text-sm font-medium text-[#586ab1] capitalize">
                    {loan.status?.replace('_', ' ')}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-600">Created</label>
                  <p className="text-sm font-medium text-gray-800">
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