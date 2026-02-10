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



  const fetchTenant = useCallback(async (tenantId) => {
    if (!tenantId) {
      setTenant(null);
      setLoading(false);
      return;
    }

    // If we already have the correct tenant, don't fetch again
    if (tenant?.id === tenantId) {
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
        localStorage.setItem("tenant", JSON.stringify(data));
        setTenant(data);
      } else {
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
    if (profile?.tenant_id) {
      fetchTenant(profile.tenant_id);
    } else {
      setTenant(null);
      setLoading(false);
    }
  }, [profile?.tenant_id, fetchTenant]);

  const refreshTenant = useCallback(async () => {
    if (profile?.tenant_id) {
      localStorage.removeItem("tenant");
      setTenant(null);
      await fetchTenant(profile.tenant_id);
    }
  }, [profile?.tenant_id, fetchTenant]);

  const clearTenantCache = useCallback(() => {
    localStorage.removeItem("tenant");
    setTenant(null);
  }, []);

  return {
    tenant,
    loading,
    error,
    refreshTenant,
    clearTenantCache
  };
}