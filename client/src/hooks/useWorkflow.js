import { useState, useCallback, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./userAuth";
import axios from "axios";

export const normalizeEntityId = (id) => {
  if (!id) return id;
  const strId = String(id);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strId)) {
    return strId.toLowerCase();
  }
  if (/^\d+$/.test(strId)) {
    const hex = Number(strId).toString(16).padStart(12, '0');
    return `00000000-0000-4000-a000-${hex}`;
  }
  return strId;
};

export const denormalizeEntityId = (uuidStr) => {
  if (!uuidStr) return uuidStr;
  const str = String(uuidStr).toLowerCase();
  if (str.startsWith('00000000-0000-4000-a000-')) {
    const hex = str.split('-').pop();
    return parseInt(hex, 16);
  }
  return uuidStr;
};

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
          .select("id, name, base_role")
          .eq("tenant_id", profile.tenant_id);

        if (roleData) {
          const matchedRoles = roleData.filter(r => 
            r.name.toLowerCase() === profile.role.toLowerCase() || 
            r.base_role?.toLowerCase() === profile.role.toLowerCase()
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

  const fetchWorkflowInstance = useCallback(async (entityId, entityType) => {
    if (!profile?.tenant_id) return null;
    try {
      const token = localStorage.getItem("sessionToken");
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/workflows/status/${entityType}/${entityId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success && response.data.data) {
        const { instance, currentNode } = response.data.data;
        if (instance) {
          return {
            ...instance,
            current_node: currentNode,
          };
        }
      }
      return null;
    } catch (err) {
      console.error("Error fetching workflow instance:", err);
      return null;
    }
  }, [profile]);

  const fetchWorkflowStepsByType = useCallback(async (workflowType) => {
    if (!profile?.tenant_id) return [];
    try {
      const token = localStorage.getItem("sessionToken");
      const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };
      
      // 1. Fetch roles
      const { data: rolesData } = await supabase.from('roles').select('id, name').eq('tenant_id', profile.tenant_id);
      const roleMap = {};
      rolesData?.forEach(r => roleMap[r.id] = r.name);

      // 2. Fetch workflows
      const wfRes = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/workflows`, axiosConfig);
      
      if (wfRes.data?.success && wfRes.data.data) {
        const wf = wfRes.data.data.find(w => w.type === workflowType);
        
        if (wf) {
          // 3. Fetch graph
          const graphRes = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/workflows/${wf.id}/graph`, axiosConfig);
          if (graphRes.data?.success) {
            const nodes = graphRes.data.data.nodes || [];
            const edges = graphRes.data.data.edges || [];
            
            const orderedSteps = [];
            let currentNode = nodes.find(n => n.type === 'START');
            if (!currentNode && nodes.length > 0) {
               currentNode = nodes[0];
            }
            
            while (currentNode) {
              if (currentNode.type !== 'END') {
                const roles = currentNode.permissions?.roles || [];
                const roleNames = roles.map(rid => roleMap[rid]).filter(Boolean);
                const filteredRoles = roleNames; // Include admin role without filtering
                
                // Preserve the original node name; do not rename START nodes
                let stepName = currentNode.name;
                // No default role fallback – if a node has no associated roles, leave the role field empty
                let displayRole = filteredRoles.join(' / ');
                // If displayRole is empty, keep it as an empty string (UI can handle missing role)
                // Do not inject placeholder role names
                
                orderedSteps.push({
                  id: currentNode.id || currentNode.node_client_id,
                  name: stepName,
                  role: displayRole,
                  isActive: orderedSteps.length === 0
                });
              }
              
              const edge = edges.find(e => e.source_node_id === currentNode.node_client_id || e.source_node_id === currentNode.id);
              if (edge) {
                currentNode = nodes.find(n => n.node_client_id === edge.target_node_id || n.id === edge.target_node_id);
              } else {
                currentNode = null;
              }
            }
            console.log('Fetched workflow steps', orderedSteps);
            return orderedSteps;
          }
        }
      }
      return [];
    } catch (err) {
      console.error("Error fetching dynamic workflow steps:", err);
      return [];
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
    if (!instance) return null;
    try {
      const token = localStorage.getItem("sessionToken");
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/workflows/action`,
        {
          instance_id: instance.id,
          event
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success && response.data.nextNode) {
        return response.data.nextNode;
      }
      return null;
    } catch (err) {
      console.error("Error during workflow transition:", err);
      return null;
    }
  }, []);

  return {
    fetchWorkflowInstance,
    isUserAuthorized,
    transitionWorkflow,
    fetchWorkflowStepsByType,
    loadingRoles,
    userRoleIds
  };
}
