import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ClipboardDocumentCheckIcon,
  AdjustmentsHorizontalIcon,
  ChartBarSquareIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  UserCircleIcon,
  CheckCircleIcon,

  ClockIcon,
} from "@heroicons/react/24/outline";
import Spinner from "../../components/Spinner";

const CustomerInteractions = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newInteraction, setNewInteraction] = useState({
    interaction_type: "",
    notes: "",
    subject: "", // Added subject field
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("interactions");
  const [editingLimit, setEditingLimit] = useState(false);
  const [newLimit, setNewLimit] = useState(0);
  const [limitComment, setLimitComment] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [showInteractionForm, setShowInteractionForm] = useState(false); // Added for form toggle

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("id, full_name, role")
          .eq("auth_id", user.id)
          .single();
        setCurrentUser(data);
      }
    };
    fetchUser();
  }, []);

  // Fetch customer data and interactions
  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        setLoading(true);

        // Fetch customer
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .single();

        if (customerError) throw customerError;
        setCustomer(customerData);
        setNewLimit(customerData?.loan_limit || 0);

        // Fetch interactions and approval history in parallel
        await Promise.all([
          fetchInteractions(customerId),
          fetchApprovalHistory(customerId)
        ]);

      } catch (error) {
        console.error("Error fetching customer data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (customerId) fetchCustomerData();
  }, [customerId]);

  // Fetch interactions
  const fetchInteractions = async (customerId) => {
    try {
      const { data, error } = await supabase
        .from("customer_interactions")
        .select(
          `
          id,
          interaction_type,
          notes,
          subject,
          created_at,
          created_by,
          profiles:created_by (
            users:profiles_user_id_fkey (
              full_name,
              email
            )
          )
        `
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInteractions(data || []);
    } catch (error) {
      console.error("Error fetching interactions:", error);
    }
  };

  // Fetch approval history
  const fetchApprovalHistory = async (customerId) => {
    try {
      const { data, error } = await supabase
        .from("customer_verifications")
        .select(
          `
          id,
          created_at,
          branch_manager_final_decision,
          branch_manager_overall_comment,
          branch_manager_verified_at,
          branch_manager_verified_by,
          branch_manager_loan_scored_amount,
          branch_manager_loan_comment,
          branch_manager_profile:branch_manager_verified_by (
            users:profiles_user_id_fkey (
              full_name,
              email
            )
          ),
          credit_analyst_officer_final_decision,
          credit_analyst_officer_overall_comment,
          credit_analyst_officer_verified_at,
          credit_analyst_officer_verified_by,
          credit_analyst_officer_loan_scored_amount,
          credit_analyst_officer_loan_comment,
          cao_profile:credit_analyst_officer_verified_by (
            users:profiles_user_id_fkey (
              full_name,
              email
            )
          ),
          co_final_decision,
          co_overall_comment,
          co_verified_at,
          co_verified_by,
          co_loan_scored_amount,
          co_loan_comment,
          co_profile:co_verified_by (
            users:profiles_user_id_fkey (
              full_name,
              email
            )
          )
        `
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApprovalHistory(data || []);
    } catch (error) {
      console.error("Error fetching approval history:", error);
    }
  };

  // Add new interaction
  const handleAddInteraction = async (e) => {
    e.preventDefault();
    if (!newInteraction.interaction_type || !newInteraction.notes.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data, error } = await supabase
        .from("customer_interactions")
        .insert([
          {
            customer_id: customerId,
            interaction_type: newInteraction.interaction_type,
            subject: newInteraction.subject || null,
            notes: newInteraction.notes,
            created_by: user?.id,
          },
        ])
        .select(
          `
          id,
          interaction_type,
          notes,
          subject,
          created_at,
          created_by,
          profiles:created_by (
            users:profiles_user_id_fkey (
              full_name,
              email
            )
          )
        `
        )
        .single();

      if (error) throw error;

      setInteractions((prev) => [data, ...prev]);
      setNewInteraction({ 
        interaction_type: "", 
        notes: "",
        subject: "" 
      });
      setShowInteractionForm(false);
      alert("Interaction added successfully!");
    } catch (error) {
      console.error("Error saving interaction:", error);
      alert(`Failed to save interaction: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Update customer limit
  const handleUpdateLimit = async () => {
    if (!limitComment.trim()) {
      alert("Please provide a comment for this limit adjustment");
      return;
    }

    try {
      setSaving(true);

      // Update customer limit
      const { error: updateError } = await supabase
        .from("customers")
        .update({ loan_limit: newLimit })
        .eq("id", customerId);

      if (updateError) throw updateError;

      // Log the limit adjustment
      const { error: logError } = await supabase
        .from("customer_interactions")
        .insert([
          {
            customer_id: customerId,
            interaction_type: "limit_adjustment",
            subject: "Loan Limit Adjustment",
            notes: `Limit ${newLimit > customer.loan_limit ? 'increased' : 'decreased'} from ${customer.loan_limit} to ${newLimit}. Comment: ${limitComment}`,
            created_by: currentUser?.id,
          },
        ]);

      if (logError) throw logError;

      alert("Loan limit updated successfully!");
      setEditingLimit(false);
      setLimitComment("");
      
      // Refresh customer data to show updated limit
      const { data: updatedCustomer } = await supabase
        .from("customers")
        .select("loan_limit")
        .eq("id", customerId)
        .single();
      
      setCustomer(prev => ({ ...prev, loan_limit: updatedCustomer.loan_limit }));
      setNewLimit(updatedCustomer.loan_limit);
      
      // Refresh interactions
      await fetchInteractions(customerId);
      
    } catch (error) {
      console.error("Error updating limit:", error);
      alert("Failed to update limit");
    } finally {
      setSaving(false);
    }
  };

  // Helper to render approval entry
  const renderApprovalEntry = (role, decision, comment, verifiedAt, verifiedBy, profile) => {
    if (!decision && !comment) return null;

    return (
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-800 text-sm">{role}</h4>
          {decision && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                decision.toLowerCase() === "approved"
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : decision.toLowerCase() === "rejected"
                  ? "bg-red-100 text-red-800 border border-red-200"
                  : "bg-yellow-100 text-yellow-800 border border-yellow-200"
              }`}
            >
              {decision}
            </span>
          )}
        </div>
        {comment && (
          <p className="text-sm text-gray-600 mb-3 bg-white p-3 rounded-md border border-gray-100">{comment}</p>
        )}
        <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100">
          <div className="flex items-center">
            <UserCircleIcon className="h-4 w-4 mr-1.5 text-gray-400" />
            <span>{profile?.users?.full_name || profile?.users?.email || "Unknown"}</span>
          </div>
          {verifiedAt && (
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-1.5 text-gray-400" />
              <span>{new Date(verifiedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper to get scored amounts from verification
  const getScoredAmounts = (verification) => {
    const amounts = [];
    if (verification.branch_manager_loan_scored_amount) {
      amounts.push({
        role: "Branch Manager",
        amount: verification.branch_manager_loan_scored_amount,
        comment: verification.branch_manager_loan_comment,
        date: verification.branch_manager_verified_at,
        verifiedBy: verification.branch_manager_profile?.users?.full_name || "Unknown",
      });
    }
    if (verification.credit_analyst_officer_loan_scored_amount) {
      amounts.push({
        role: "Credit Analyst Officer",
        amount: verification.credit_analyst_officer_loan_scored_amount,
        comment: verification.credit_analyst_officer_loan_comment,
        date: verification.credit_analyst_officer_verified_at,
        verifiedBy: verification.cao_profile?.users?.full_name || "Unknown",
      });
    }
    if (verification.co_loan_scored_amount) {
      amounts.push({
        role: "Customer Service Officer",
        amount: verification.co_loan_scored_amount,
        comment: verification.co_loan_comment,
        date: verification.co_verified_at,
        verifiedBy: verification.co_profile?.users?.full_name || "Unknown",
      });
    }
    return amounts;
  };

  // Interaction Form Component
  const renderInteractionForm = () => (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
      <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2 text-[#586ab1]" />
        Record New Interaction
      </h4>
      <form onSubmit={handleAddInteraction} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Interaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interaction Type <span className="text-red-500">*</span>
            </label>
            <select
              value={newInteraction.interaction_type}
              onChange={(e) =>
                setNewInteraction({
                  ...newInteraction,
                  interaction_type: e.target.value,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] transition text-sm"
              required
            >
              <option value="">Select Type</option>
              <option value="call"> Phone Call</option>
              <option value="email">Email</option>
              <option value="visit"> Physical Visit</option>
              <option value="meeting"> Meeting</option>
              <option value="follow_up"> Follow-up</option>
              <option value="complaint"> Complaint</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={newInteraction.subject}
              onChange={(e) =>
                setNewInteraction({
                  ...newInteraction,
                  subject: e.target.value,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] transition text-sm"
              placeholder="Brief subject or title..."
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes / Details <span className="text-red-500">*</span>
          </label>
          <textarea
            value={newInteraction.notes}
            onChange={(e) =>
              setNewInteraction({
                ...newInteraction,
                notes: e.target.value,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] resize-none transition text-sm"
            rows="4"
            placeholder="Enter detailed notes about this interaction..."
            required
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5c9d] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md font-medium text-sm"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
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
            onClick={() => {
              setShowInteractionForm(false);
              setNewInteraction({ 
                interaction_type: "", 
                notes: "",
                subject: "" 
              });
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  // Interaction Item Component
  const renderInteractionItem = (interaction) => (
    <div
      key={interaction.id}
      className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Header Section */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <span
              className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                interaction.interaction_type === "call"
                  ? "bg-blue-100 text-blue-800"
                  : interaction.interaction_type === "sms"
                  ? "bg-green-100 text-green-800"
                  : interaction.interaction_type === "email"
                  ? "bg-purple-100 text-purple-800"
                  : interaction.interaction_type === "visit"
                  ? "bg-orange-100 text-orange-800"
                  : interaction.interaction_type === "meeting"
                  ? "bg-[#586ab1] bg-opacity-10 text-[#586ab1]"
                  : interaction.interaction_type === "follow_up"
                  ? "bg-yellow-100 text-yellow-800"
                  : interaction.interaction_type === "complaint"
                  ? "bg-red-100 text-red-800"
                  : interaction.interaction_type === "limit_adjustment"
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {interaction.interaction_type === "call" && "📞"}
              {interaction.interaction_type === "sms" && "💬"}
              {interaction.interaction_type === "email" && "📧"}
              {interaction.interaction_type === "visit" && "🏢"}
              {interaction.interaction_type === "meeting" && "👥"}
              {interaction.interaction_type === "follow_up" && "🔄"}
              {interaction.interaction_type === "complaint" && "⚠️"}
              {interaction.interaction_type === "limit_adjustment" && "💰"}
              <span className="ml-1.5">
                {interaction.interaction_type?.charAt(0).toUpperCase() +
                  interaction.interaction_type
                    ?.slice(1)
                    .replace("_", " ") || "Interaction"}
              </span>
            </span>
            <div className="flex items-center text-xs text-gray-500">
              <ClockIcon className="h-3.5 w-3.5 mr-1" />
              {new Date(interaction.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              at{" "}
              {new Date(interaction.created_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-5 py-4">
        {/* Subject */}
        {interaction.subject && (
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
              Subject
            </label>
            <h4 className="text-sm font-semibold text-slate-600">
              {interaction.subject}
            </h4>
          </div>
        )}

        {/* Message/Notes */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
            {interaction.subject ? "Details" : "Notes"}
          </label>
          <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-md p-3 border border-gray-100">
            {interaction.notes || "No notes provided"}
          </div>
        </div>

        {/* Footer with Officer Info */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          {interaction.profiles?.users?.full_name ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#586ab1] bg-opacity-10">
                <UserCircleIcon className="h-4 w-4 text-[#586ab1]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Handled by</p>
                <p className="text-sm font-medium text-slate-600">
                  {interaction.profiles.users.full_name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
                <UserCircleIcon className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400">
                Officer not specified
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const tabs = [
    {
      id: "interactions",
      name: "Customer Interactions",
      icon: ChatBubbleLeftRightIcon,
      content: (
        <div className="space-y-6">
          {/* Header with Add Button */}
          <div className="flex justify-between items-center">
            <div>
              {/* <h3 className="text-xl  text-slate-600">
                Customer Interactions
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Track all customer communication and touchpoints
              </p> */}
            </div>
            <button
              onClick={() => setShowInteractionForm(!showInteractionForm)}
              className="flex items-center gap-2 px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5c9d] transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
            >
              {showInteractionForm ? (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Interaction
                </>
              )}
            </button>
          </div>

          {/* Interaction Form */}
          {showInteractionForm && renderInteractionForm()}

          {/* Interactions List */}
          {interactions.length > 0 ? (
            <div className="space-y-3">
              {interactions.map((interaction) => renderInteractionItem(interaction))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
              <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">
                No interactions recorded
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Click "Add Interaction" to record your first customer interaction
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "approvals",
      name: "Approval History",
      icon: ClipboardDocumentCheckIcon,
      content: (
        <div className="space-y-6">
          {/* <div>
            <h3 className="text-xl  text-slate-600 mb-2">
              Customer Approval History
            </h3>
            <p className="text-sm text-gray-600">
              Review all verification and approval records
            </p>
          </div> */}

          {approvalHistory.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
              <ClipboardDocumentCheckIcon className="h-16 w-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">
                No approval history found
              </p>
              <p className="text-sm text-gray-500 mt-1">
                This customer has no verification records yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvalHistory.map((verification) => (
                <div key={verification.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className=" text-slate-600">Verification Record</h4>
                      <p className="text-xs text-gray-500">
                        {new Date(verification.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {renderApprovalEntry(
                      "Branch Manager",
                      verification.branch_manager_final_decision,
                      verification.branch_manager_overall_comment,
                      verification.branch_manager_verified_at,
                      verification.branch_manager_verified_by,
                      verification.branch_manager_profile
                    )}
                    
                    {renderApprovalEntry(
                      "Credit Analyst Officer",
                      verification.credit_analyst_officer_final_decision,
                      verification.credit_analyst_officer_overall_comment,
                      verification.credit_analyst_officer_verified_at,
                      verification.credit_analyst_officer_verified_by,
                      verification.cao_profile
                    )}
                    
                    {renderApprovalEntry(
                      "Customer Service Officer",
                      verification.co_final_decision,
                      verification.co_overall_comment,
                      verification.co_verified_at,
                      verification.co_verified_by,
                      verification.co_profile
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "limits",
      name: "Limit Adjustments",
      icon: AdjustmentsHorizontalIcon,
      content: (
        <div className="space-y-6">
          <div>
            {/* <h3 className="text-sm  text-slate-600 mb-2">
              Loan Limit Management
            </h3> */}
           
          </div>
          
          {/* Current Limit Card */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 mb-1">Current Loan Limit</p>
                <p className="text-xl  text-slate-600">
                  KES {customer?.loan_limit?.toLocaleString() || 0}
                </p>
              </div>
              {!editingLimit && (
                <button
                  onClick={() => setEditingLimit(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5c9d] transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Adjust Limit
                </button>
              )}
            </div>
          </div>

          {/* Limit Adjustment Form */}
          {editingLimit && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-sm  text-slate-600 mb-4 flex items-center">
                <PencilSquareIcon className="h-5 w-5 mr-2 text-[#586ab1]" />
                Adjust Loan Limit
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Limit Amount (KES)
                  </label>
                  <input
                    type="number"
                    value={newLimit}
                    onChange={(e) => setNewLimit(parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] text-sm"
                    placeholder="Enter new limit"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comment/Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={limitComment}
                    onChange={(e) => setLimitComment(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] text-sm"
                    rows="3"
                    placeholder="Explain the reason for this adjustment..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleUpdateLimit}
                    disabled={saving || !limitComment.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md font-medium text-sm"
                  >
                    {saving ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingLimit(false);
                      setNewLimit(customer?.loan_limit || 0);
                      setLimitComment("");
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Adjustment History */}
          <div>
            <h4 className="text-sm  text-slate-600 mb-4">Adjustment History</h4>
            <div className="space-y-3">
              {interactions.filter(i => i.interaction_type === "limit_adjustment").length === 0 ? (
                <div className="text-center py-8 bg-white border border-dashed border-gray-300 rounded-xl">
                  <AdjustmentsHorizontalIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No limit adjustments recorded</p>
                  <p className="text-sm text-gray-500 mt-1">Adjust the loan limit to see history here</p>
                </div>
              ) : (
                interactions
                  .filter(i => i.interaction_type === "limit_adjustment")
                  .map((item) => renderInteractionItem(item))
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "scores",
      name: "Scored Amount History",
      icon: ChartBarSquareIcon,
      content: (
        <div className="space-y-6">
          <div>
            {/* <h3 className="text-sm  text-slate-600 mb-2">
              Scored Amount History
            </h3> */}
           
          </div>
          
          {approvalHistory.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
              <ChartBarSquareIcon className="h-16 w-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No scored amounts recorded</p>
              <p className="text-sm text-gray-500 mt-1">
                This customer has no loan scoring records yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvalHistory.map((verification) => {
                const amounts = getScoredAmounts(verification);
                if (amounts.length === 0) return null;

                return (
                  <div key={verification.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="mb-4">
                      <h4 className=" text-slate-600 text-sm">Scoring Session</h4>
                      <p className="text-xs text-gray-500">
                        {new Date(verification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {amounts.map((scoreData, idx) => (
                        <div key={idx} className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-xl border border-gray-200">
                          <p className="text-xs font-medium text-gray-600 mb-2">
                            {scoreData.role}
                          </p>
                          <p className="text-2xl font-bold text-[#586ab1] mb-3">
                            KES {scoreData.amount?.toLocaleString() || 0}
                          </p>
                          {scoreData.comment && (
                            <p className="text-sm text-gray-600 mb-3 bg-white p-2 rounded-md border border-gray-100">
                              {scoreData.comment}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-200">
                            <div className="flex items-center">
                              <UserCircleIcon className="h-4 w-4 mr-1.5 text-gray-400" />
                              <span>{scoreData.verifiedBy}</span>
                            </div>
                            {scoreData.date && (
                              <div className="flex items-center">
                                <ClockIcon className="h-4 w-4 mr-1.5 text-gray-400" />
                                <span>{new Date(scoreData.date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
  ];

   if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
        <Spinner text="Loading interactions..." />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Customer not found</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5c9d] transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-4 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            {/* Back Button */}
            <div className="mb-6">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back to Customers</span>
              </button>
            </div>


            {/* Tabs Section */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-t-lg text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-[#586ab1] text-white border-b-2 border-[#586ab1] shadow-sm"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-gray-500'}`} />
                    {tab.name}
                  </button>
                );
              })}
            </div>

            {/* Active Tab Content */}
            <div className="pt-2">{tabs.find((t) => t.id === activeTab)?.content}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerInteractions;