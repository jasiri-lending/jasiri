// src/hooks/useTenant.js
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./userAuth";

export function useTenant() {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTenant = useCallback(async (tenantId) => {
    if (!tenantId) {
      setTenant(null);
      setLoading(false);
      return;
    }

    // Check localStorage first
    const savedTenant = localStorage.getItem("tenant");
    if (savedTenant) {
      try {
        const parsedTenant = JSON.parse(savedTenant);
        if (parsedTenant.id === tenantId) {
          setTenant(parsedTenant);
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

      if (fetchError) throw fetchError;

      if (data) {
        // Store in localStorage with a timestamp
        const tenantWithTimestamp = {
          ...data,
          _cachedAt: Date.now()
        };
        localStorage.setItem("tenant", JSON.stringify(tenantWithTimestamp));
        setTenant(data);
      } else {
        setTenant(null);
      }
    } catch (err) {
      console.error("Error loading tenant:", err);
      setError(err.message);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchTenant(profile.tenant_id);
    } else {
      setTenant(null);
      setLoading(false);
    }
  }, [profile?.tenant_id, fetchTenant]);

  const refreshTenant = async () => {
    if (profile?.tenant_id) {
      localStorage.removeItem("tenant");
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