-- 1. Create workflow_conditions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workflow_conditions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    edge_id UUID NOT NULL,
    field TEXT NOT NULL,
    operator TEXT NOT NULL, -- equals, greater_than, less_than, contains, etc.
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT workflow_conditions_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_conditions_edge_id_fkey FOREIGN KEY (edge_id) REFERENCES public.workflow_edges(id) ON DELETE CASCADE
);

-- 2. Alter workflow_instance_history to add missing columns if they don't exist
ALTER TABLE public.workflow_instance_history 
    ADD COLUMN IF NOT EXISTS from_node_id UUID,
    ADD COLUMN IF NOT EXISTS to_node_id UUID,
    ADD COLUMN IF NOT EXISTS event TEXT,
    ADD COLUMN IF NOT EXISTS context_snapshot JSONB;

-- 3. Add foreign key constraints with explicit names expected by the code (if they don't already exist)
ALTER TABLE public.workflow_instance_history 
    DROP CONSTRAINT IF EXISTS workflow_instance_history_from_node_id_fkey,
    ADD CONSTRAINT workflow_instance_history_from_node_id_fkey 
    FOREIGN KEY (from_node_id) REFERENCES public.workflow_nodes(id) ON DELETE SET NULL;

ALTER TABLE public.workflow_instance_history 
    DROP CONSTRAINT IF EXISTS workflow_instance_history_to_node_id_fkey,
    ADD CONSTRAINT workflow_instance_history_to_node_id_fkey 
    FOREIGN KEY (to_node_id) REFERENCES public.workflow_nodes(id) ON DELETE SET NULL;

-- 4. Allow node_id and action_type to be nullable (as the history logging uses event/from_node_id/to_node_id instead)
ALTER TABLE public.workflow_instance_history ALTER COLUMN node_id DROP NOT NULL;
ALTER TABLE public.workflow_instance_history ALTER COLUMN action_type DROP NOT NULL;
