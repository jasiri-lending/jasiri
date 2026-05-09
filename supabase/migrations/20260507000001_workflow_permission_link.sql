ALTER TABLE public.workflow_nodes ADD COLUMN required_permission_id UUID REFERENCES public.permissions(id) ON DELETE SET NULL;
