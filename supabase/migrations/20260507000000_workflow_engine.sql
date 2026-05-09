-- Workflow Engine Schema

-- 1. Workflow Definitions
CREATE TABLE public.workflow_definitions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, active, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT workflow_definitions_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- 2. Workflow Nodes
CREATE TABLE public.workflow_nodes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL,
    node_client_id TEXT NOT NULL, -- Used by React Flow
    type TEXT NOT NULL, -- START, APPROVAL, REVIEW, DECISION, END, AUTO_PROCESS
    name TEXT NOT NULL,
    sla_timeout_minutes INTEGER,
    escalation_node_id UUID, -- self referential but we will enforce in code to avoid complex circular references
    position_x NUMERIC DEFAULT 0,
    position_y NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT workflow_nodes_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_nodes_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_definitions(id) ON DELETE CASCADE
);

-- 3. Workflow Node Roles (Assigning roles to a specific node)
CREATE TABLE public.workflow_node_roles (
    node_id UUID NOT NULL,
    role_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT workflow_node_roles_pkey PRIMARY KEY (node_id, role_id),
    CONSTRAINT workflow_node_roles_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
    CONSTRAINT workflow_node_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE
);

-- 4. Workflow Edges (Transitions)
CREATE TABLE public.workflow_edges (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL,
    edge_client_id TEXT NOT NULL, -- Used by React Flow
    source_node_id TEXT NOT NULL, -- references node_client_id
    target_node_id TEXT NOT NULL, -- references node_client_id
    action_type TEXT NOT NULL, -- approve, reject, send_back, escalate, cancel
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT workflow_edges_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_edges_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_definitions(id) ON DELETE CASCADE
);

-- 5. Workflow Conditions (Routing conditions for edges)
CREATE TABLE public.workflow_conditions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    edge_id UUID NOT NULL,
    field TEXT NOT NULL,
    operator TEXT NOT NULL, -- equals, greater_than, less_than, etc.
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT workflow_conditions_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_conditions_edge_id_fkey FOREIGN KEY (edge_id) REFERENCES public.workflow_edges(id) ON DELETE CASCADE
);

-- 6. Workflow Instances
CREATE TABLE public.workflow_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    entity_id UUID NOT NULL, -- The target entity (e.g., Loan ID, Customer ID)
    entity_type TEXT NOT NULL, -- E.g., 'loan', 'customer', 'journal'
    current_node_id UUID, -- References workflow_nodes.id
    status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, completed, cancelled, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT workflow_instances_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT workflow_instances_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_definitions(id) ON DELETE RESTRICT,
    CONSTRAINT workflow_instances_current_node_id_fkey FOREIGN KEY (current_node_id) REFERENCES public.workflow_nodes(id) ON DELETE SET NULL
);

-- 7. Workflow Instance History (Audit Trail)
CREATE TABLE public.workflow_instance_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL,
    node_id UUID NOT NULL, -- The node where action was taken
    action_type TEXT NOT NULL, -- approve, reject, etc.
    acted_by UUID, -- The user who took the action
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT workflow_instance_history_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_instance_history_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
    CONSTRAINT workflow_instance_history_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.workflow_nodes(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_workflow_instances_entity ON public.workflow_instances(entity_type, entity_id);
CREATE INDEX idx_workflow_instances_tenant ON public.workflow_instances(tenant_id);
CREATE INDEX idx_workflow_definitions_tenant ON public.workflow_definitions(tenant_id);
