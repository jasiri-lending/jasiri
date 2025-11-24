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
} from "@heroicons/react/24/outline";

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
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("interactions");
  const [editingLimit, setEditingLimit] = useState(false);
  const [newLimit, setNewLimit] = useState(0);
  const [limitComment, setLimitComment] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

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
    if (!newInteraction.interaction_type || !newInteraction.notes.trim()) return;

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
            notes: newInteraction.notes,
            created_by: user?.id,
          },
        ])
        .select(
          `
          id,
          interaction_type,
          notes,
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
      setNewInteraction({ interaction_type: "", notes: "" });
    } catch (error) {
      console.error("Error saving interaction:", error);
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
            interaction_type: "Limit Adjustment",
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
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-800">{role}</h4>
          {decision && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                decision.toLowerCase() === "approved"
                  ? "bg-green-100 text-green-800"
                  : decision.toLowerCase() === "rejected"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {decision}
            </span>
          )}
        </div>
        {comment && (
          <p className="text-sm text-gray-600 mb-2">{comment}</p>
        )}
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>
            👤 {profile?.users?.full_name || profile?.users?.email || "Unknown"}
          </span>
          {verifiedAt && (
            <span>{new Date(verifiedAt).toLocaleString()}</span>
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
        role: "Credit Officer",
        amount: verification.co_loan_scored_amount,
        comment: verification.co_loan_comment,
        date: verification.co_verified_at,
        verifiedBy: verification.co_profile?.users?.full_name || "Unknown",
      });
    }
    return amounts;
  };

  const tabs = [
    {
      id: "interactions",
      name: "Customer Interactions",
      icon: ChatBubbleLeftRightIcon,
      content: (
        <>
          <form
            onSubmit={handleAddInteraction}
            className="flex flex-col sm:flex-row gap-3 mb-6"
          >
            <select
              value={newInteraction.interaction_type}
              onChange={(e) =>
                setNewInteraction({
                  ...newInteraction,
                  interaction_type: e.target.value,
                })
              }
              className="border rounded-lg px-3 py-2 text-gray-700 w-full sm:w-1/3 focus:ring focus:ring-indigo-200"
            >
              <option value="">Select Type</option>
              <option value="Call">Call</option>
              <option value="SMS">SMS</option>
              <option value="Meeting">Meeting</option>
              <option value="Email">Email</option>
              <option value="Follow-up">Follow-up</option>
            </select>

            <input
              type="text"
              placeholder="Add interaction notes..."
              value={newInteraction.notes}
              onChange={(e) =>
                setNewInteraction({
                  ...newInteraction,
                  notes: e.target.value,
                })
              }
              className="border rounded-lg px-3 py-2 text-gray-700 flex-1 focus:ring focus:ring-indigo-200"
            />

            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center hover:bg-green-700 transition disabled:opacity-50"
            >
              <PaperAirplaneIcon className="h-5 w-5 mr-1" />
              {saving ? "Saving..." : "Add"}
            </button>
          </form>

          {interactions.length === 0 ? (
            <p className="text-gray-500">
              No recorded interactions for this customer yet.
            </p>
          ) : (
            <div className="bg-gray-50 border rounded-lg divide-y">
              {interactions.map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-white transition duration-150"
                >
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-gray-700">
                      {item.interaction_type}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    👤 Created by:{" "}
                    {item.profiles?.users?.full_name || 
                     item.profiles?.users?.email || 
                     "Unknown"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ),
    },
    {
      id: "approvals",
      name: "Approval History",
      icon: ClipboardDocumentCheckIcon,
      content: (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Customer Approval History
          </h3>
          {approvalHistory.length === 0 ? (
            <p className="text-gray-500">No approval history found for this customer.</p>
          ) : (
            <div className="space-y-6">
              {approvalHistory.map((verification) => (
                <div key={verification.id} className="border rounded-lg p-4 bg-white">
                  <p className="text-xs text-gray-400 mb-3">
                    Verification Date: {new Date(verification.created_at).toLocaleString()}
                  </p>
                  
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
                    "Credit Officer",
                    verification.co_final_decision,
                    verification.co_overall_comment,
                    verification.co_verified_at,
                    verification.co_verified_by,
                    verification.co_profile
                  )}
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
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Loan Limit Management
          </h3>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Current Loan Limit</p>
                <p className="text-2xl font-bold text-gray-800">
                  KES {customer?.loan_limit?.toLocaleString() || 0}
                </p>
              </div>
              {!editingLimit && (
                <button
                  onClick={() => setEditingLimit(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition"
                >
                  <PencilSquareIcon className="h-5 w-5 mr-1" />
                  Adjust Limit
                </button>
              )}
            </div>
          </div>

          {editingLimit && (
            <div className="bg-white border rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-800 mb-3">Adjust Loan Limit</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Limit Amount
                  </label>
                  <input
                    type="number"
                    value={newLimit}
                    onChange={(e) => setNewLimit(parseFloat(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 focus:ring focus:ring-indigo-200"
                    placeholder="Enter new limit"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comment/Reason (Required)
                  </label>
                  <textarea
                    value={limitComment}
                    onChange={(e) => setLimitComment(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring focus:ring-indigo-200"
                    rows="3"
                    placeholder="Explain the reason for this adjustment..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleUpdateLimit}
                    disabled={saving}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingLimit(false);
                      setNewLimit(customer?.loan_limit || 0);
                      setLimitComment("");
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <h4 className="font-semibold text-gray-800 mb-3">Adjustment History</h4>
          <div className="bg-gray-50 border rounded-lg divide-y">
            {interactions.filter(i => i.interaction_type === "Limit Adjustment").length === 0 ? (
              <p className="text-gray-500 p-4">No limit adjustments recorded yet.</p>
            ) : (
              interactions
                .filter(i => i.interaction_type === "Limit Adjustment")
                .map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-medium text-gray-700">Limit Adjustment</p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">{item.notes}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      👤 By: {item.profiles?.users?.full_name || item.profiles?.users?.email || "Unknown"}
                    </p>
                  </div>
                ))
            )}
          </div>
        </div>
      ),
    },
    {
      id: "scores",
      name: "Scored Amount History",
      icon: ChartBarSquareIcon,
      content: (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Scored Amount History
          </h3>
          {approvalHistory.length === 0 ? (
            <p className="text-gray-500">No scored amounts recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {approvalHistory.map((verification) => {
                const amounts = getScoredAmounts(verification);
                if (amounts.length === 0) return null;

                return (
                  <div key={verification.id} className="border rounded-lg p-4 bg-white">
                    <p className="text-xs text-gray-400 mb-3">
                      Verification Date: {new Date(verification.created_at).toLocaleString()}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {amounts.map((scoreData, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            {scoreData.role}
                          </p>
                          <p className="text-xl font-bold text-indigo-600 mb-2">
                            KES {scoreData.amount?.toLocaleString() || 0}
                          </p>
                          {scoreData.comment && (
                            <p className="text-xs text-gray-600 mb-2">
                              {scoreData.comment}
                            </p>
                          )}
                          <div className="text-xs text-gray-500">
                            <p>👤 {scoreData.verifiedBy}</p>
                            {scoreData.date && (
                              <p>{new Date(scoreData.date).toLocaleDateString()}</p>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="ml-3 text-gray-500">Loading interactions...</p>
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
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
     

      {/* Content */}
      <div className="max-w-7xl mx-auto py-2 sm:px-6 lg:px-8">
      <div className="px-4 py-2 sm:px-0">
  <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
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
    <div className="flex flex-wrap gap-2 border-b mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition ${
              active
                ? "bg-blue-200 text-slate-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Icon className="h-5 w-5" />
            {tab.name}
          </button>
        );
      })}
    </div>

    {/* Active Tab Content */}
    <div>{tabs.find((t) => t.id === activeTab)?.content}</div>
  </div>
</div>

      </div>
    </div>
  );
};

export default CustomerInteractions;