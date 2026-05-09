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
import { Save, ArrowLeft, Settings, Edit } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { StartNode, ApprovalNode, EndNode } from '../../components/workflow/CustomNodes';
import { toast } from 'react-toastify';
import { supabase } from '../../supabaseClient';
import axios from 'axios';
import { useAuth } from '../../hooks/userAuth';

const nodeTypes = {
    start: StartNode,
    approval: ApprovalNode,
    end: EndNode,
};

const initialNodes = [
    { id: '1', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Start Process' } }
];

const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: true,
    style: { strokeWidth: 2, stroke: '#6366f1' }, // Indigo-500 for good visibility
};

const WorkflowBuilder = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    // Form state
    const [workflowName, setWorkflowName] = useState('Loan Approval Workflow');
    const [workflowType, setWorkflowType] = useState('loan');
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    
    // Properties Panel state
    const [selectedNode, setSelectedNode] = useState(null);

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
                        
                        // Map database nodes back to React Flow nodes
                        const mappedNodes = savedNodes.map(n => ({
                            id: n.node_client_id,
                            type: n.type.toLowerCase(),
                            position: { x: n.position_x, y: n.position_y },
                            data: { 
                                label: n.name, 
                                roleName: roleData?.find(r => r.id === n.workflow_node_roles?.[0]?.role_id)?.name,
                                required_permission_id: n.required_permission_id,
                                permissionName: permData?.find(p => p.id === n.required_permission_id)?.name
                            }
                        }));
                        
                        // Map database edges back to React Flow edges
                        const mappedEdges = savedEdges.map(e => ({
                            id: e.edge_client_id,
                            source: e.source_node_id,
                            target: e.target_node_id,
                            data: { action: e.action_type },
                            label: e.action_type.charAt(0).toUpperCase() + e.action_type.slice(1),
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
        (params) => setEdges((eds) => addEdge({ ...params, data: { action: 'approve' }, label: 'Approve' }, eds)),
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
                data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes],
    );

    const handleNodeClick = (event, node) => {
        setSelectedNode(node);
    };

    const handleUpdateNode = (key, value) => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === selectedNode.id) {
                    let roleName = n.data.roleName;
                    let permissionName = n.data.permissionName;
                    
                    if (key === 'role_id') {
                        const r = roles.find(ro => ro.id === value);
                        roleName = r ? r.name : '';
                    }
                    
                    if (key === 'required_permission_id') {
                        const p = permissions.find(per => per.id === value);
                        permissionName = p ? p.name : '';
                    }
                    
                    return { ...n, data: { ...n.data, [key]: value, roleName, permissionName } };
                }
                return n;
            })
        );
        setSelectedNode((prev) => ({ ...prev, data: { ...prev.data, [key]: value } }));
    };

    const handleSave = async () => {
        try {
            // Build the payload
            const token = user?.token; // assuming useAuth provides token, or use session
            const { data: session } = await supabase.auth.getSession();
            
            // Extract roles assignments from nodes
            const nodeRoles = nodes
                .filter(n => n.data.role_id)
                .map(n => ({ node_id: n.id, role_id: n.data.role_id }));

            const payload = {
                id: id === 'new' ? null : id,
                name: workflowName,
                type: workflowType,
                nodes: nodes.map(n => ({
                    ...n,
                    required_permission_id: n.data.required_permission_id
                })),
                edges,
                roles: nodeRoles
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
            toast.error('Failed to save workflow.');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm">
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h2 className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-0.5">
                            {id === 'new' ? 'New Workflow' : 'Edit Workflow'}
                        </h2>
                        <div className="flex items-center group">
                            <input 
                                type="text" 
                                value={workflowName} 
                                onChange={(e) => setWorkflowName(e.target.value)}
                                placeholder="Enter workflow name..."
                                className="text-xl font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-brand-primary focus:ring-0 p-0 bg-transparent transition-colors min-w-[200px]"
                            />
                            <Edit className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 ml-2 transition-opacity" />
                        </div>
                        <div className="flex items-center mt-1 space-x-2">
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Process Type:</span>
                            <select 
                                value={workflowType}
                                onChange={(e) => {
                                    const newType = e.target.value;
                                    setWorkflowType(newType);
                                    // Update name if it's still default
                                    if (workflowName === 'New Workflow' || workflowName === '' || workflowName.includes(' Approval Workflow')) {
                                        const typeLabels = {
                                            loan: 'Loan Approval',
                                            customer: 'Customer Onboarding',
                                            journal: 'Journal Approval',
                                            lead: 'Lead Conversion'
                                        };
                                        setWorkflowName(`${typeLabels[newType]} Workflow`);
                                    }
                                }}
                                className="text-xs text-gray-500 border-none bg-transparent focus:ring-0 p-0 cursor-pointer hover:text-brand-primary transition-colors font-medium"
                            >
                                <option value="loan">Loan Approval</option>
                                <option value="customer">Customer Onboarding</option>
                                <option value="journal">Journal Approval</option>
                                <option value="lead">Lead Conversion</option>
                            </select>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={handleSave}
                    className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm"
                >
                    <Save className="w-4 h-4 mr-2" /> Save Workflow
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-white border-r p-4 shadow-sm z-10 flex flex-col">
                    <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wider">Drag Nodes</h3>
                    <div className="space-y-3">
                        <div 
                            className="p-3 border-2 border-green-400 bg-green-50 rounded-lg text-center cursor-grab font-medium text-green-700 shadow-sm hover:shadow" 
                            onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'start'); }} 
                            draggable
                        >
                            Start Node
                        </div>
                        <div 
                            className="p-3 border-2 border-blue-400 bg-blue-50 rounded-lg text-center cursor-grab font-medium text-blue-700 shadow-sm hover:shadow" 
                            onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'approval'); }} 
                            draggable
                        >
                            Approval Step
                        </div>
                        <div 
                            className="p-3 border-2 border-red-400 bg-red-50 rounded-lg text-center cursor-grab font-medium text-red-700 shadow-sm hover:shadow" 
                            onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'end'); }} 
                            draggable
                        >
                            End Node
                        </div>
                    </div>

                    {/* Properties Panel */}
                    {selectedNode && (
                        <div className="mt-8 border-t pt-4 flex-1">
                            <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
                                <Settings className="w-4 h-4 mr-2" /> Node Settings
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Label</label>
                                    <input 
                                        type="text" 
                                        value={selectedNode.data.label || ''} 
                                        onChange={(e) => handleUpdateNode('label', e.target.value)}
                                        className="w-full text-sm border-gray-300 rounded focus:ring-brand-primary focus:border-brand-primary"
                                    />
                                </div>
                                
                                {(selectedNode.type === 'approval' || selectedNode.type === 'start') && (
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            {selectedNode.type === 'start' ? 'Who can start this?' : 'Assign Role'}
                                        </label>
                                        <select 
                                            value={selectedNode.data.role_id || ''}
                                            onChange={(e) => handleUpdateNode('role_id', e.target.value)}
                                            className="w-full text-sm border-gray-300 rounded focus:ring-brand-primary focus:border-brand-primary"
                                        >
                                            <option value="">{selectedNode.type === 'start' ? 'Anyone' : 'Select a Role...'}</option>
                                            {roles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(selectedNode.type === 'approval' || selectedNode.type === 'start') && (
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Required System Permission
                                        </label>
                                        <select 
                                            value={selectedNode.data.required_permission_id || ''}
                                            onChange={(e) => handleUpdateNode('required_permission_id', e.target.value)}
                                            className="w-full text-sm border-gray-300 rounded focus:ring-brand-primary focus:border-brand-primary"
                                        >
                                            <option value="">None (Anyone in Role)</option>
                                            {permissions.map(p => (
                                                <option key={p.id} value={p.id}>{p.resource}: {p.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-400 mt-1 italic">
                                            User must have this specific permission in the Roles & Permissions manager to execute actions at this step.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Canvas */}
                <div className="flex-1" ref={reactFlowWrapper}>
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
                            onNodeClick={handleNodeClick}
                            onPaneClick={() => setSelectedNode(null)}
                            nodeTypes={nodeTypes}
                            defaultEdgeOptions={defaultEdgeOptions}
                            connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
                            fitView
                        >
                            <Controls />
                            <MiniMap nodeStrokeColor="#ccc" nodeColor="#fff" />
                            <Background variant="dots" gap={12} size={1} color="#e5e7eb" />
                        </ReactFlow>
                    </ReactFlowProvider>
                </div>
            </div>
        </div>
    );
};

export default WorkflowBuilder;
