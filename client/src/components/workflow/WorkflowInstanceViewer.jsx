import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../../supabaseClient';
import { CheckCircle, Clock, AlertCircle, History, ArrowRight, User, MessageSquare } from 'lucide-react';
import { toast } from 'react-toastify';

const WorkflowInstanceViewer = ({ entityType, entityId, onActionComplete }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const { data: session } = await supabase.auth.getSession();
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/status/${entityType}/${entityId}`,
                { headers: { Authorization: `Bearer ${session.session?.access_token}` } }
            );
            
            if (response.data.success) {
                setData(response.data.data);
            }
        } catch (err) {
            console.error("Error fetching workflow status:", err);
            // toast.error("Failed to load workflow status");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (entityType && entityId) {
            fetchStatus();
        }
    }, [entityType, entityId]);

    const handleAction = async (event) => {
        try {
            setSubmitting(true);
            const { data: session } = await supabase.auth.getSession();
            
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/action`,
                {
                    instance_id: data.instance.id,
                    event,
                    comments: comment,
                    updated_context: {} // Can be expanded to include form data
                },
                { headers: { Authorization: `Bearer ${session.session?.access_token}` } }
            );

            if (response.data.success) {
                toast.success(`Action '${event}' performed successfully`);
                setComment('');
                fetchStatus();
                if (onActionComplete) onActionComplete(response.data.instance);
            }
        } catch (err) {
            console.error("Action error:", err);
            toast.error(err.response?.data?.error || "Failed to perform action");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="animate-pulse flex space-x-4 p-4 bg-white rounded-xl shadow-sm"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="space-y-2"><div className="h-4 bg-gray-200 rounded"></div><div className="h-4 bg-gray-200 rounded w-5/6"></div></div></div></div>;

    if (!data || !data.instance) {
        return (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No active workflow for this {entityType}.</p>
            </div>
        );
    }

    const { instance, currentNode, actions, history } = data;

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden font-inter">
            {/* Header / Current Status */}
            <div className="p-6 bg-gradient-to-r from-brand-primary to-indigo-600 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Current State</h3>
                        <div className="flex items-center space-x-2">
                            <span className="text-2xl font-black">{currentNode?.name || 'In Progress'}</span>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                                instance.overall_status === 'completed' ? 'bg-green-400/20 text-green-100' :
                                instance.overall_status === 'rejected' ? 'bg-red-400/20 text-red-100' :
                                'bg-white/20 text-white'
                            }`}>
                                {instance.overall_status}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                         <CheckCircle className="w-8 h-8 text-white/80" />
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* Available Actions */}
                {instance.overall_status === 'in_progress' && actions.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">Required Action</h4>
                            <span className="text-[10px] text-brand-primary font-bold bg-brand-primary/10 px-2 py-0.5 rounded">Awaiting Input</span>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <textarea 
                                placeholder="Add internal notes or comments..."
                                className="w-full bg-white border-gray-200 rounded-xl text-sm focus:ring-brand-primary focus:border-brand-primary p-3 mb-4 min-h-[80px]"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                            
                            <div className="flex flex-wrap gap-3">
                                {actions.map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => handleAction(action.event)}
                                        disabled={submitting}
                                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center ${
                                            action.event.includes('REJECT') || action.event.includes('CANCEL')
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                : 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20'
                                        }`}
                                    >
                                        {action.event}
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Audit Trail / History */}
                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <History className="w-5 h-5 text-gray-400" />
                        <h4 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">Audit Trail</h4>
                    </div>
                    
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                        {history.map((item, idx) => (
                            <div key={item.id} className="relative group">
                                <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm transition-all group-hover:scale-125 ${
                                    idx === history.length - 1 ? 'bg-brand-primary animate-pulse' : 'bg-gray-300'
                                }`} />
                                
                                <div className="bg-white group-hover:bg-gray-50/50 p-3 rounded-2xl transition-all border border-transparent group-hover:border-gray-100">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-black text-gray-800">
                                            {item.to_node?.name || item.event}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            {new Date(item.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center space-x-4 mb-2">
                                        <div className="flex items-center text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                            <User className="w-3 h-3 mr-1" />
                                            System / {item.acted_by?.slice(0, 8)}
                                        </div>
                                        <div className="flex items-center text-[10px] font-bold text-brand-primary">
                                            {item.from_node?.name || 'START'} <ArrowRight className="w-2.5 h-2.5 mx-1" /> {item.to_node?.name}
                                        </div>
                                    </div>

                                    {item.comments && (
                                        <div className="flex items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <MessageSquare className="w-3 h-3 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                                            <p className="text-[11px] text-gray-600 leading-relaxed italic">
                                                "{item.comments}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                    <span className="text-[10px] text-gray-500 font-medium">Workflow engine v2.0 (Multi-tenant ready)</span>
                </div>
                <div className="text-[10px] text-gray-400 font-bold uppercase">
                    Instance: {instance.id.slice(0, 13)}
                </div>
            </div>
        </div>
    );
};

export default WorkflowInstanceViewer;
