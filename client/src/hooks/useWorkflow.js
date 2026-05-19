import { useState, useCallback, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./userAuth";

export function useWorkflow() {
  const { profile } = useAuth();
  const [userRoleIds, setUserRoleIds] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // Load user role IDs once on initialization
  useEffect(() => {
    const loadUserRoles = async () => {
      if (!profile?.tenant_id || !profile?.role) {
        setLoadingRoles(false);
        return;
      }
      try {
        const { data: roleData } = await supabase
          .from("roles")
          .select("id, name, code")
          .eq("tenant_id", profile.tenant_id);

        if (roleData) {
          const matchedRoles = roleData.filter(r => 
            r.name.toLowerCase() === profile.role.toLowerCase() || 
            r.code?.toLowerCase() === profile.role.toLowerCase()
          );
          setUserRoleIds(matchedRoles.map(r => r.id));
        }
      } catch (err) {
        console.error("Error loading workflow user roles:", err);
      } finally {
        setLoadingRoles(false);
      }
    };

    loadUserRoles();
  }, [profile]);

  /**
   * Fetch active workflow instance for a given entity
   */
  const fetchWorkflowInstance = useCallback(async (entityId, entityType) => {
    if (!profile?.tenant_id) return null;
    try {
      const { data, error } = await supabase
        .from("workflow_instances")
        .select(`
          *,
          current_node:current_node_id (
            id,
            node_client_id,
            name,
            type,
            permissions
          ),
          workflow_definitions:workflow_id (
            id,
            name,
            type
          )
        `)
        .eq("tenant_id", profile.tenant_id)
        .eq("entity_id", entityId)
        .eq("entity_type", entityType)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error fetching workflow instance:", err);
      return null;
    }
  }, [profile]);

  /**
   * Check if user is authorized to perform action on a workflow instance
   */
  const isUserAuthorized = useCallback((instance) => {
    if (!instance || !instance.current_node) return false;
    if (profile?.role === "admin" || profile?.role === "superadmin") return true;

    const allowedRoles = instance.current_node.permissions?.roles || [];
    return userRoleIds.some(id => allowedRoles.includes(id));
  }, [profile, userRoleIds]);

  /**
   * Transition workflow instance through an event
   */
  const transitionWorkflow = useCallback(async (instance, event) => {
    if (!instance || !instance.current_node) return null;
    try {
      // 1. Fetch outgoing edge
      const { data: edges, error: edgeError } = await supabase
        .from("workflow_edges")
        .select("*")
        .eq("workflow_id", instance.workflow_id)
        .eq("source_node_id", instance.current_node.node_client_id)
        .eq("event", event);

      if (edgeError) throw edgeError;
      if (!edges || edges.length === 0) return null;

      const targetEdge = edges[0];

      // 2. Fetch target node info
      const { data: nodes, error: nodeError } = await supabase
        .from("workflow_nodes")
        .select("*")
        .eq("workflow_id", instance.workflow_id)
        .eq("node_client_id", targetEdge.target_node_id);

      if (nodeError) throw nodeError;
      if (!nodes || nodes.length === 0) return null;

      const nextNode = nodes[0];

      // 3. Update database instance state
      const { error: updateError } = await supabase
        .from("workflow_instances")
        .update({
          current_node_id: nextNode.id,
          status: nextNode.type === "end" ? "completed" : "in_progress",
          updated_at: new Date().toISOString()
        })
        .eq("id", instance.id);

      if (updateError) throw updateError;

      return nextNode;
    } catch (err) {
      console.error("Error during workflow transition:", err);
      return null;
    }
  }, []);

  return {
    fetchWorkflowInstance,
    isUserAuthorized,
    transitionWorkflow,
    loadingRoles,
    userRoleIds
  };
}
