import { supabaseAdmin } from "./supabaseClient.js";

const denormalizeEntityId = (uuidStr) => {
  if (!uuidStr) return uuidStr;
  const str = String(uuidStr).toLowerCase();
  if (str.startsWith('00000000-0000-4000-a000-')) {
    const hex = str.split('-').pop();
    return parseInt(hex, 16);
  }
  return uuidStr;
};

async function run() {
  try {
    // Mock user profile: branch_manager in tenant e06aef07-f29a-4dff-816f-948a5352050e
    const mockProfile = {
      tenant_id: "e06aef07-f29a-4dff-816f-948a5352050e",
      role: "branch_manager"
    };

    console.log("Mock profile:", mockProfile);

    // 1. Fetch userRoleIds logic
    const { data: roleData } = await supabaseAdmin
      .from("roles")
      .select("id, name, base_role")
      .eq("tenant_id", mockProfile.tenant_id);

    let userRoleIds = [];
    if (roleData) {
      const matchedRoles = roleData.filter(r => 
        r.name.toLowerCase() === mockProfile.role.toLowerCase() || 
        r.base_role?.toLowerCase() === mockProfile.role.toLowerCase()
      );
      userRoleIds = matchedRoles.map(r => r.id);
    }
    console.log("UserRoleIds fetched for mock user:", userRoleIds);

    const isUserAuthorized = (instance) => {
      if (!instance || !instance.current_node) return false;
      if (mockProfile.role === "admin" || mockProfile.role === "superadmin") return true;

      const allowedRoles = instance.current_node.permissions?.roles || [];
      console.log(`Checking instance ${instance.id}: allowedRoles =`, allowedRoles, "userRoleIds =", userRoleIds);
      return userRoleIds.some(id => allowedRoles.includes(id));
    };

    // 2. Fetch workflow instances
    const { data: instanceData, error: instanceError } = await supabaseAdmin
      .from("workflow_instances")
      .select(`
        *,
        workflow_nodes!current_node_id (id, node_client_id, name, type, permissions),
        workflow_definitions!workflow_id (id, name, type)
      `)
      .eq("tenant_id", mockProfile.tenant_id)
      .eq("status", "in_progress");

    console.log(`Fetched ${instanceData?.length || 0} instances. Error:`, instanceError);

    // 3. Group entity IDs
    const grouped = {};
    for (const inst of (instanceData || [])) {
      const original_entity_id = inst.entity_id;
      inst.entity_id = denormalizeEntityId(inst.entity_id);
      const type = inst.entity_type;
      console.log(`Entity ID ${original_entity_id} denormalized to ${inst.entity_id} for type ${type}`);
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(inst.entity_id);
    }
    console.log("Grouped entities:", grouped);

    // 4. Fetch entities
    const entityMaps = {};
    if (grouped.customer_onboarding?.length) {
      const { data, error } = await supabaseAdmin
        .from("customers")
        .select("*, branches(id, name), regions(id, name), created_by_user:created_by(full_name)")
        .in("id", grouped.customer_onboarding);
      console.log(`Fetched ${data?.length || 0} customers. Error:`, error);
      (data || []).forEach(r => { 
        entityMaps[r.id] = r; 
      });
    }

    console.log("EntityMaps keys:", Object.keys(entityMaps));

    // 5. Enrich and filter
    const enriched = (instanceData || []).map(inst => {
      const parsedInstance = { ...inst, current_node: inst.workflow_nodes };
      const isAuthorized = isUserAuthorized(parsedInstance);
      const entity = entityMaps[inst.entity_id] || null;
      console.log(`Enriching instance ${inst.id}: inst.entity_id = ${inst.entity_id} (type: ${typeof inst.entity_id}), found entity? ${!!entity}, isAuthorized? ${isAuthorized}`);
      return { ...inst, entity, isAuthorized };
    });

    const filtered = enriched.filter(i => i.isAuthorized && i.entity);
    console.log(`Filtered down to ${filtered.length} visible tasks.`);

  } catch (err) {
    console.error(err);
  }
}
run();
