import { supabaseAdmin } from "./supabaseClient.js";

async function debugStart() {
  const tenantId = "e06aef07-f29a-4dff-816f-948a5352050e";
  const workflowType = "customer_onboarding";

  // 1. Get definition
  const { data: workflowDef, error: wfError } = await supabaseAdmin
      .from('workflow_definitions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('type', workflowType)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .single();

  console.log("workflowDef:", workflowDef);

  if (!workflowDef) return;

  // 2. Find start node
  const { data: startNode, error: nodeError } = await supabaseAdmin
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', workflowDef.id)
      .eq('type', 'START')
      .single();

  console.log("startNode:", startNode);

  if (!startNode) return;

  // 3. Find edges
  const { data: edges, error: edgeError } = await supabaseAdmin
      .from('workflow_edges')
      .select(`
          *,
          workflow_conditions(*)
      `)
      .eq('workflow_id', workflowDef.id)
      .eq('source_node_id', startNode.node_client_id);

  console.log("edges:", edges);
  console.log("edgeError:", edgeError);
}

debugStart();
