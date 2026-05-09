import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../hooks/userAuth';
import { CheckCircle, XCircle, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { toast } from 'react-toastify';

const WorkflowActionPanel = ({ entityId, entityType, onActionComplete }) => {
    const { profile } = useAuth();
    const [instance, setInstance] = useState(null);
    const [currentNode, setCurrentNode] = useState(null);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [comment, setComment] = useState('');
    const [requiredPermission, setRequiredPermission] = useState(null);
    const [canPerformAction, setCanPerformAction] = useState(false);
    const [reason, setReason] = useState(null);

    useEffect(() => {
        if (entityId && entityType && profile) {
            fetchWorkflowStatus();
        }
    }, [entityId, entityType, profile]);

    const fetchWorkflowStatus = async () => {
        try {
            setLoading(true);
            const { data: session } = await supabase.auth.getSession();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/status/${entityType}/${entityId}`,
                {
                    headers: { Authorization: `Bearer ${session.session?.access_token}` }
                }
            );

            if (response.data.success) {
                const data = response.data.data;
                setInstance(data.instance);
                setCurrentNode(data.currentNode);
                setActions(data.actions);
                setRequiredPermission(data.requiredPermission);
                
                // --- Authorization Logic ---
                const userRoleIds = profile?.role_ids || []; 
                const nodeRoleIds = data.nodeRoles?.map(nr => nr.role_id) || [];
                const requiredPerm = data.requiredPermission;

                // 1. Check Role Ownership (Is the user's role assigned to this step?)
                const hasRoleOwnership = nodeRoleIds.length === 0 || userRoleIds.some(rid => nodeRoleIds.includes(rid));

                // 2. Check Core Permission (Does the user have the authoritative system permission?)
                // Note: The backend status API already returned the required permission details.
                // We'll trust the backend validation for the final word, but for UI feedback:
                // If profile includes a list of permission names, we check it here.
                const userPermissionNames = profile?.permissions || [];
                const hasSystemPermission = !requiredPerm || userPermissionNames.includes(requiredPerm.name);

                if (!hasRoleOwnership) {
                    setCanPerformAction(false);
                    setReason(`Your role is not assigned to this step (${data.currentNode?.name}).`);
                } else if (!hasSystemPermission) {
                    setCanPerformAction(false);
                    setReason(`You lack the authoritative '${requiredPerm?.name}' permission required for this step.`);
                } else {
                    setCanPerformAction(true);
                    setReason(null);
                }
            } else {
                setInstance(null);
            }
        } catch (error) {
            console.error("Failed to fetch workflow status", error);
            setInstance(null);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (actionType) => {
        if (!comment.trim()) {
            toast.warning('Please provide a comment/reason.');
            return;
        }

        try {
            setProcessing(true);
            const { data: session } = await supabase.auth.getSession();
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/action`,
                {
                    instance_id: instance.id,
                    action_type: actionType,
                    comments: comment,
                    user_roles: profile?.role_ids || []
                },
                {
                    headers: { Authorization: `Bearer ${session.session?.access_token}` }
                }
            );

            if (response.data.success) {
                toast.success(`Action "${actionType}" performed successfully.`);
                setComment('');
                fetchWorkflowStatus();
                if (onActionComplete) onActionComplete(response.data);
            }
        } catch (error) {
            console.error("Workflow action failed", error);
            toast.error(error.response?.data?.error || "Failed to perform action.");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return (
        <div className="flex items-center space-x-2 text-gray-400 p-4">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-primary border-t-transparent"></div>
            <span className="text-sm font-medium">Loading workflow status...</span>
        </div>
    );

    if (!instance) return null;

    if (instance.status === 'completed') {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3">
                <CheckCircle className="text-green-500 h-5 w-5" />
                <div>
                    <div className="text-sm font-bold text-green-800">Workflow Completed</div>
                    <div className="text-xs text-green-600">This process has been finalized.</div>
                </div>
            </div>
        );
    }

    if (instance.status === 'rejected') {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
                <XCircle className="text-red-500 h-5 w-5" />
                <div>
                    <div className="text-sm font-bold text-red-800">Workflow Rejected</div>
                    <div className="text-xs text-red-600">This process was terminated.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Clock className="text-brand-primary h-4 w-4" />
                    <span className="text-sm font-semibold text-gray-700">Current Step: {currentNode?.name}</span>
                </div>
                <div className="flex items-center space-x-1">
                    <span className={`flex h-2 w-2 rounded-full ${canPerformAction ? 'bg-brand-primary animate-pulse' : 'bg-gray-300'}`}></span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                        {canPerformAction ? 'In Progress' : 'ReadOnly / Unauthorized'}
                    </span>
                </div>
            </div>

            {!canPerformAction && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center space-x-2">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] text-amber-700 font-medium">{reason}</span>
                </div>
            )}

            <div className="p-4 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 flex items-center">
                        <MessageSquare className="h-3 w-3 mr-1" /> Decision Comments
                    </label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={canPerformAction ? "Provide reasoning for your decision..." : "You are not authorized to take actions on this step."}
                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-brand-primary focus:border-brand-primary min-h-[80px] disabled:bg-gray-50 disabled:text-gray-400"
                        disabled={processing || !canPerformAction}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {actions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleAction(action.action_type)}
                            disabled={processing || !canPerformAction}
                            className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                                action.action_type === 'approve' || action.action_type === 'final_approve'
                                    ? 'bg-brand-primary text-white hover:bg-brand-primary/90'
                                    : action.action_type === 'reject'
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {processing ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-2"></div>
                            ) : action.action_type === 'approve' ? (
                                <CheckCircle className="h-4 w-4 mr-2" />
                            ) : action.action_type === 'reject' ? (
                                <XCircle className="h-4 w-4 mr-2" />
                            ) : (
                                <AlertCircle className="h-4 w-4 mr-2" />
                            )}
                            {action.action_type.charAt(0).toUpperCase() + action.action_type.slice(1).replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WorkflowActionPanel;
