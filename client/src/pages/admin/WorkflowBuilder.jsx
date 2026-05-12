import { useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    MiniMap,
    Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { Save, ArrowLeft, Settings, Edit, Zap, GitBranch, Search, CheckCircle, Play, XCircle, Trash2, Plus, Info } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { StartNode, ApprovalNode, ReviewNode, DecisionNode, AutoProcessNode, EndNode } from '../../components/workflow/CustomNodes';
import { useToast } from '../../components/Toast';
import { supabase } from '../../supabaseClient';
import axios from 'axios';
import { useAuth } from '../../hooks/userAuth';

const nodeTypes = {
    start: StartNode,
    approval: ApprovalNode,
    review: ReviewNode,
    decision: DecisionNode,
    autoprocess: AutoProcessNode,
    end: EndNode,
};

const initialNodes = [
    { id: '1', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Start Process' } }
];

const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: true,
    style: { strokeWidth: 2, stroke: '#6366f1' },
};

const WorkflowBuilder = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const toast = useToast();

    const isViewMode = new URLSearchParams(location.search).get('view') === 'true';

    // Form state
    const [workflowName, setWorkflowName] = useState('New Business Process');
    const [workflowType, setWorkflowType] = useState('customer_onboarding');
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    
    // Selection state
    const [selectedElement, setSelectedElement] = useState(null); // Can be node or edge
    const [saving, setSaving] = useState(false);

    const { id } = useParams();

    useEffect(() => {
        const fetchData = async () => {
            const { data: session } = await supabase.auth.getSession();
            
            // Fetch roles
            const { data: roleData } = await supabase.from('roles').select('*');
            if (roleData) setRoles(roleData);

            // Fetch permissions
            const { data: permData } = await supabase.from('permissions').select('*').order('resource');
            if (permData) setPermissions(permData);

            // Fetch existing workflow if editing
            if (id && id !== 'new') {
                try {
                    const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/${id}/graph`, {
                        headers: { Authorization: `Bearer ${session.session?.access_token}` }
                    });
                    
                    if (response.data.success) {
                        const { def, nodes: savedNodes, edges: savedEdges } = response.data.data;
                        setWorkflowName(def.name);
                        setWorkflowType(def.type);
                        
                        const mappedNodes = savedNodes.map(n => ({
                            id: n.node_client_id,
                            type: n.type.toLowerCase(),
                            position: { x: n.position_x, y: n.position_y },
                            data: { 
                                label: n.name,
                                description: n.description,
                                sla_timeout_minutes: n.sla_timeout_minutes,
                                escalation_node_id: n.escalation_node_id,
                                on_entry_actions: n.on_entry_actions || [],
                                permissions: n.permissions || {},
                                roleName: roleData?.find(r => n.permissions?.roles?.includes(r.id))?.name,
                            }
                        }));
                        
                        const mappedEdges = savedEdges.map(e => ({
                            id: e.edge_client_id,
                            source: e.source_node_id,
                            target: e.target_node_id,
                            label: e.event,
                            data: { 
                                event: e.event,
                                roles_allowed: e.roles_allowed || [],
                                conditions: e.workflow_conditions || []
                            },
                            type: 'smoothstep',
                            animated: true,
                            style: { strokeWidth: 2, stroke: '#6366f1' },
                        }));

                        setNodes(mappedNodes);
                        setEdges(mappedEdges);
                    }
                } catch (err) {
                    console.error("Error loading workflow:", err);
                    toast.error("Failed to load workflow");
                }
            }
        };
        fetchData();
    }, [id]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ 
            ...params, 
            label: 'APPROVE',
            data: { event: 'APPROVE', roles_allowed: [], conditions: [] } 
        }, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: uuidv4(),
                type,
                position,
                data: { 
                    label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                    on_entry_actions: [],
                    permissions: { roles: [] }
                },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes],
    );

    const onElementClick = (event, element) => {
        setSelectedElement(element);
    };

    const handleUpdateNodeData = (key, value) => {
        if (!selectedElement || !selectedElement.id) return;
        
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === selectedElement.id) {
                    const newData = { ...n.data, [key]: value };
                    // Special case: update roleName for visualization if roles changed
                    if (key === 'permissions' && value.roles?.length > 0) {
                        const r = roles.find(ro => ro.id === value.roles[0]);
                        newData.roleName = r ? r.name : '';
                    }
                    return { ...n, data: newData };
                }
                return n;
            })
        );
        setSelectedElement((prev) => ({ ...prev, data: { ...prev.data, [key]: value } }));
    };

    const handleUpdateEdgeData = (key, value) => {
        if (!selectedElement || !selectedElement.id) return;

        setEdges((eds) =>
            eds.map((e) => {
                if (e.id === selectedElement.id) {
                    const newData = { ...e.data, [key]: value };
                    return { 
                        ...e, 
                        data: newData,
                        label: key === 'event' ? value : e.label 
                    };
                }
                return e;
            })
        );
        setSelectedElement((prev) => ({ 
            ...prev, 
            data: { ...prev.data, [key]: value },
            label: key === 'event' ? value : prev.label 
        }));
    };

    const handleSave = async () => {
        if (saving) return;
        try {
            setSaving(true);
            const { data: session } = await supabase.auth.getSession();
            
            const payload = {
                id: (id === 'new' || !id) ? null : id,
                name: workflowName,
                type: workflowType,
                nodes: nodes,
                edges: edges,
                config: {} // Overall workflow config if needed
            };

            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/workflows/save`, payload, {
                headers: { Authorization: `Bearer ${session.session?.access_token}` }
            });

            if (response.data.success) {
                toast.success('Workflow saved successfully!');
                if (!id || id === 'new') {
                    navigate(`/workflow-setting/admin/builder/${response.data.workflow_id}`, { replace: true });
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to save workflow.');
        } finally {
            setSaving(false);
        }
    };

    const addCondition = () => {
        const currentConditions = selectedElement.data.conditions || [];
        handleUpdateEdgeData('conditions', [...currentConditions, { field: '', operator: 'equals', value: '' }]);
    };

    const removeCondition = (index) => {
        const currentConditions = [...(selectedElement.data.conditions || [])];
        currentConditions.splice(index, 1);
        handleUpdateEdgeData('conditions', currentConditions);
    };

    const updateCondition = (index, field, value) => {
        const currentConditions = [...(selectedElement.data.conditions || [])];
        currentConditions[index][field] = value;
        handleUpdateEdgeData('conditions', currentConditions);
    };

    return (
        <div className="flex flex-col h-screen bg-white font-inter">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between z-30 shadow-sm">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => navigate('/workflow-setting/admin')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 border border-gray-100 shadow-sm"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                            <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workflow Designer</h1>
                            <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter">
                                {id === 'new' ? 'Draft' : 'Revision'}
                            </span>
                        </div>
                        <input 
                            type="text" 
                            value={workflowName} 
                            onChange={(e) => setWorkflowName(e.target.value)}
                            className="text-xs font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 w-64 mt-0.5"
                            placeholder="Unnamed Workflow Process"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Entity Type</span>
                        <select 
                            value={workflowType}
                            onChange={(e) => setWorkflowType(e.target.value)}
                            disabled={isViewMode}
                            className={`h-8 text-[10px] font-bold text-slate-700 border-none bg-transparent focus:ring-0 py-0 px-2 transition-all ${isViewMode ? 'cursor-default opacity-80' : 'cursor-pointer hover:text-slate-900'}`}
                        >
                            <optgroup label="Customer Management">
                                <option value="customer_onboarding">Customer Onboarding</option>
                                <option value="customer_edits">Customer Edits / Amendments</option>
                                <option value="customer_transfer">Customer Transfer</option>
                                <option value="customer_exit">Customer Exit / Offboarding</option>
                                <option value="customer_blacklisting">Customer Blacklisting</option>
                            </optgroup>
                            <optgroup label="Loan Lifecycle">
                                <option value="loan_application">Loan Application & Approval</option>
                                <option value="loan_disbursement">Loan Disbursement</option>
                                <option value="loan_restructuring">Loan Restructuring</option>
                                <option value="loan_write_off">Loan Write-off</option>
                                <option value="loan_closure">Loan Closure / Settlement</option>
                                <option value="loan_top_up">Loan Top-up</option>
                            </optgroup>
                            <optgroup label="Finance & Accounting">
                                <option value="journal_creation">Journal Creation & Approval</option>
                                <option value="refund_approval">Refund Approval</option>
                                <option value="penalty_approval">Penalty Approval</option>
                                <option value="fee_waiver">Fee Waiver</option>
                                <option value="transaction_reconciliation">Transaction Reconciliation</option>
                            </optgroup>
                            <optgroup label="System Configuration">
                                <option value="credit_settings_change">Credit Settings Changes</option>
                                <option value="penalty_settings_change">Penalty Settings Changes</option>
                                <option value="loan_product_config">Loan Product Configuration</option>
                            </optgroup>
                            <optgroup label="Sales & Collections">
                                <option value="lead_management">Lead Management</option>
                                <option value="collections_recovery">Collections & Recovery</option>
                                <option value="collateral_management">Collateral Management</option>
                            </optgroup>
                        </select>
                    </div>

                    {!isViewMode && (
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className={`h-8 flex items-center px-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all shadow-sm active:scale-95 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {saving ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Saving
                                </>
                            ) : (
                                <>
                                    <Save className="w-3 h-3 mr-2" /> Save Changes
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Node Palette */}
                {!isViewMode && (
                    <div className="w-72 bg-white border-r p-6 shadow-sm z-10 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Components</h3>
                            <Info className="w-4 h-4 text-gray-400 cursor-help" />
                        </div>
                        
                        <div className="space-y-4 overflow-y-auto pr-1">
                            <PaletteItem type="start" icon={<Play className="w-4 h-4" />} color="green" label="Start Point" description="Entry point for the process" />
                            <PaletteItem type="approval" icon={<CheckCircle className="w-4 h-4" />} color="blue" label="Approval Step" description="Requires user authorization" />
                            <PaletteItem type="review" icon={<Search className="w-4 h-4" />} color="amber" label="Manual Review" description="Check data accuracy" />
                            <PaletteItem type="decision" icon={<GitBranch className="w-4 h-4" />} color="purple" label="Decision / Split" description="Conditional routing point" />
                            <PaletteItem type="autoprocess" icon={<Zap className="w-4 h-4" />} color="indigo" label="Auto Action" description="System executed tasks" />
                            <PaletteItem type="end" icon={<XCircle className="w-4 h-4" />} color="red" label="Process End" description="Terminal state" />
                        </div>

                        {/* Quick Tips */}
                        <div className="mt-auto pt-6 border-t">
                            <div className="bg-brand-primary/5 p-4 rounded-xl border border-brand-primary/10">
                                <h4 className="text-xs font-bold text-brand-primary uppercase mb-2">Pro Tip</h4>
                                <p className="text-[11px] text-gray-600 leading-relaxed">
                                    Connect nodes by dragging from the (+) handles. Select a node or line to configure its properties.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Canvas */}
                <div className="flex-1 relative" ref={reactFlowWrapper}>
                    <ReactFlowProvider>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onInit={setReactFlowInstance}
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onNodeClick={isViewMode ? null : onElementClick}
                            onEdgeClick={isViewMode ? null : onElementClick}
                            onPaneClick={() => setSelectedElement(null)}
                            nodeTypes={nodeTypes}
                            defaultEdgeOptions={defaultEdgeOptions}
                            connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
                            nodesDraggable={!isViewMode}
                            nodesConnectable={!isViewMode}
                            elementsSelectable={!isViewMode}
                            fitView
                        >
                            <Controls />
                            <MiniMap nodeStrokeColor="#eee" nodeColor="#fff" zoomable pannable />
                            <Background variant="dots" gap={20} size={1} color="#cbd5e1" />
                        </ReactFlow>
                    </ReactFlowProvider>
                </div>

                {/* Properties Panel (Right Sidebar) */}
                {(selectedElement && !isViewMode) && (
                    <div className="w-80 bg-white border-l shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center">
                                <div className="bg-brand-primary/10 p-2 rounded-lg mr-3">
                                    <Settings className="w-5 h-5 text-brand-primary" />
                                </div>
                                <h3 className="font-bold text-gray-800">
                                    {selectedElement.source ? 'Transition' : 'Node Settings'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => {
                                    if (selectedElement.source) {
                                        setEdges((eds) => eds.filter((e) => e.id !== selectedElement.id));
                                    } else {
                                        setNodes((nds) => nds.filter((n) => n.id !== selectedElement.id));
                                    }
                                    setSelectedElement(null);
                                }}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {/* NODE SETTINGS */}
                            {!selectedElement.source ? (
                                <>
                                    <PropertyField label="Display Name" description="How users see this step">
                                        <input 
                                            type="text" 
                                            value={selectedElement.data.label || ''} 
                                            onChange={(e) => handleUpdateNodeData('label', e.target.value)}
                                            className="w-full text-sm border-gray-200 rounded-xl focus:ring-brand-primary focus:border-brand-primary py-2.5"
                                        />
                                    </PropertyField>

                                    {selectedElement.type !== 'start' && selectedElement.type !== 'end' && (
                                        <>
                                            <PropertyField label="SLA (Minutes)" description="Time allowed before escalation">
                                                <input 
                                                    type="number" 
                                                    value={selectedElement.data.sla_timeout_minutes || ''} 
                                                    onChange={(e) => handleUpdateNodeData('sla_timeout_minutes', parseInt(e.target.value))}
                                                    className="w-full text-sm border-gray-200 rounded-xl focus:ring-brand-primary focus:border-brand-primary py-2.5"
                                                    placeholder="e.g. 60"
                                                />
                                            </PropertyField>

                                            <PropertyField label="Assign to Roles" description="Roles authorized for this step">
                                                <select 
                                                    multiple
                                                    value={selectedElement.data.permissions?.roles || []}
                                                    onChange={(e) => {
                                                        const values = Array.from(e.target.selectedOptions, option => option.value);
                                                        handleUpdateNodeData('permissions', { ...selectedElement.data.permissions, roles: values });
                                                    }}
                                                    className="w-full text-sm border-gray-200 rounded-xl focus:ring-brand-primary focus:border-brand-primary h-32"
                                                >
                                                    {roles.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name}</option>
                                                    ))}
                                                </select>
                                                <p className="text-[10px] text-gray-400 mt-2">Hold Ctrl to select multiple roles</p>
                                            </PropertyField>
                                        </>
                                    )}

                                    <PropertyField label="On-Entry Actions" description="Automated tasks when entering this node">
                                        <div className="space-y-2">
                                            {['NOTIFY_USER', 'TRIGGER_WEBHOOK', 'PERFORM_CREDIT_CHECK'].map(action => (
                                                <label key={action} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 cursor-pointer transition-all">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedElement.data.on_entry_actions?.includes(action)}
                                                        onChange={(e) => {
                                                            const current = selectedElement.data.on_entry_actions || [];
                                                            const updated = e.target.checked ? [...current, action] : current.filter(a => a !== action);
                                                            handleUpdateNodeData('on_entry_actions', updated);
                                                        }}
                                                        className="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                                                    />
                                                    <span className="text-xs font-medium text-gray-700">{action.replace(/_/g, ' ')}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </PropertyField>
                                </>
                            ) : (
                                /* EDGE SETTINGS */
                                <>
                                    <PropertyField label="Trigger Event" description="The action name (e.g. APPROVE, REJECT)">
                                        <input 
                                            type="text" 
                                            value={selectedElement.data.event || ''} 
                                            onChange={(e) => handleUpdateEdgeData('event', e.target.value.toUpperCase())}
                                            className="w-full text-sm border-gray-200 rounded-xl focus:ring-brand-primary focus:border-brand-primary py-2.5 font-mono uppercase tracking-widest"
                                        />
                                    </PropertyField>

                                    <PropertyField label="Conditions" description="Logic for this transition to be valid">
                                        <div className="space-y-3">
                                            {(selectedElement.data.conditions || []).map((cond, idx) => (
                                                <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group/cond">
                                                    <button 
                                                        onClick={() => removeCondition(idx)}
                                                        className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 rounded-full shadow-sm border p-1 opacity-0 group-hover/cond:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    <div className="space-y-2">
                                                        <input 
                                                            placeholder="Context Field (e.g. amount)"
                                                            className="w-full text-[11px] border-gray-200 rounded-lg py-1.5"
                                                            value={cond.field}
                                                            onChange={(e) => updateCondition(idx, 'field', e.target.value)}
                                                        />
                                                        <select 
                                                            className="w-full text-[11px] border-gray-200 rounded-lg py-1.5"
                                                            value={cond.operator}
                                                            onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                                                        >
                                                            <option value="equals">Equals</option>
                                                            <option value="greater_than">Greater Than</option>
                                                            <option value="less_than">Less Than</option>
                                                            <option value="contains">Contains</option>
                                                        </select>
                                                        <input 
                                                            placeholder="Value"
                                                            className="w-full text-[11px] border-gray-200 rounded-lg py-1.5"
                                                            value={cond.value}
                                                            onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            <button 
                                                onClick={addCondition}
                                                className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-brand-primary hover:text-brand-primary transition-all flex items-center justify-center"
                                            >
                                                <Plus className="w-3.5 h-3.5 mr-2" /> Add Logic Condition
                                            </button>
                                        </div>
                                    </PropertyField>

                                    <PropertyField label="Allowed Roles" description="Who can trigger this transition">
                                        <select 
                                            multiple
                                            value={selectedElement.data.roles_allowed || []}
                                            onChange={(e) => {
                                                const values = Array.from(e.target.selectedOptions, option => option.value);
                                                handleUpdateEdgeData('roles_allowed', values);
                                            }}
                                            className="w-full text-sm border-gray-200 rounded-xl focus:ring-brand-primary focus:border-brand-primary h-32"
                                        >
                                            {roles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </PropertyField>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const PaletteItem = ({ type, icon, color, label, description }) => {
    const colors = {
        green: 'border-green-500 bg-green-50 text-green-700',
        blue: 'border-blue-500 bg-blue-50 text-blue-700',
        amber: 'border-amber-500 bg-amber-50 text-amber-700',
        purple: 'border-purple-500 bg-purple-50 text-purple-700',
        indigo: 'border-indigo-500 bg-indigo-50 text-indigo-700',
        red: 'border-red-500 bg-red-50 text-red-700',
    };

    return (
        <div 
            className={`p-4 border-2 ${colors[color]} rounded-2xl cursor-grab font-bold shadow-sm hover:shadow-md transition-all active:scale-95 group relative`} 
            onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', type); }} 
            draggable
        >
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
                <div>
                    <h4 className="text-xs uppercase tracking-tight">{label}</h4>
                    <p className="text-[10px] font-normal opacity-70 group-hover:opacity-100">{description}</p>
                </div>
            </div>
        </div>
    );
};

const PropertyField = ({ label, description, children }) => (
    <div className="space-y-2">
        <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-tight">{label}</span>
            {description && <span className="text-[10px] text-gray-400 italic">{description}</span>}
        </div>
        {children}
    </div>
);

export default WorkflowBuilder;

