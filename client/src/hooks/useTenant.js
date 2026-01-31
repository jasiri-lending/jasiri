// src/hooks/useTenant.js - CORRECTED VERSION
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./userAuth";

export function useTenant() {
  const { profile } = useAuth();
  
  // Initialize from localStorage immediately
  const getInitialTenant = () => {
    try {
      const savedTenant = localStorage.getItem("tenant");
      if (savedTenant) {
        const parsed = JSON.parse(savedTenant);
        // Remove timestamp if it exists
        const { _cachedAt, ...cleanTenant } = parsed;
        return cleanTenant;
      }
    } catch (e) {
      console.warn("Failed to parse saved tenant:", e);
    }
    return null;
  };

  const [tenant, setTenant] = useState(getInitialTenant());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log("🔍 [TENANT HOOK] Current state:");
  console.log("- tenant:", tenant?.company_name || "null");
  console.log("- profile?.tenant_id:", profile?.tenant_id || "null");
  console.log("- loading:", loading);

  const fetchTenant = useCallback(async (tenantId) => {
    if (!tenantId) {
      console.log("🔍 [TENANT HOOK] No tenantId, clearing tenant");
      setTenant(null);
      setLoading(false);
      return;
    }

    // If we already have the correct tenant, don't fetch again
    if (tenant?.id === tenantId) {
      console.log("✅ [TENANT HOOK] Already have correct tenant:", tenant.company_name);
      setLoading(false);
      return;
    }

    // Check localStorage first
    const savedTenant = localStorage.getItem("tenant");
    if (savedTenant) {
      try {
        const parsedTenant = JSON.parse(savedTenant);
        const { _cachedAt, ...cleanTenant } = parsedTenant;
        
        if (cleanTenant.id === tenantId) {
          console.log("✅ [TENANT HOOK] Using cached tenant:", cleanTenant.company_name);
          setTenant(cleanTenant);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn("Failed to parse saved tenant:", e);
      }
    }

    // Fetch from database
    try {
      console.log("🔍 [TENANT HOOK] Fetching tenant from database:", tenantId);
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .single();

      if (fetchError) {
        console.error("❌ [TENANT HOOK] Fetch error:", fetchError);
        throw fetchError;
      }

      if (data) {
        console.log("✅ [TENANT HOOK] Fetched tenant:", data.company_name);
        localStorage.setItem("tenant", JSON.stringify(data));
        setTenant(data);
      } else {
        console.warn("⚠️ [TENANT HOOK] No tenant data returned");
        setTenant(null);
      }
    } catch (err) {
      console.error("❌ [TENANT HOOK] Error loading tenant:", err);
      setError(err.message);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]); // Only depend on tenant.id to prevent unnecessary refetches

  useEffect(() => {
    console.log("🔍 [TENANT HOOK] useEffect triggered");
    console.log("- profile:", profile?.email || "null");
    console.log("- profile.tenant_id:", profile?.tenant_id || "null");
    
    if (profile?.tenant_id) {
      fetchTenant(profile.tenant_id);
    } else {
      console.log("⚠️ [TENANT HOOK] No tenant_id in profile, clearing tenant");
      setTenant(null);
      setLoading(false);
    }
  }, [profile?.tenant_id, fetchTenant]);

  const refreshTenant = async () => {
    if (profile?.tenant_id) {
      localStorage.removeItem("tenant");
      setTenant(null);
      await fetchTenant(profile.tenant_id);
    }
  };

  const clearTenantCache = () => {
    localStorage.removeItem("tenant");
    setTenant(null);
  };

  return { 
    tenant, 
    loading, 
    error, 
    refreshTenant, 
    clearTenantCache 
  };
}