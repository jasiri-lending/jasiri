// src/hooks/useAuth.js
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useGlobalLoading } from "./LoadingContext";

export function useAuth() {
  const savedProfile = localStorage.getItem("profile");
  const savedTenant = localStorage.getItem("tenant");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(savedProfile ? JSON.parse(savedProfile) : null);
  const [tenant, setTenant] = useState(savedTenant ? JSON.parse(savedTenant) : null);
  const { setLoading: setGlobalLoading } = useGlobalLoading();
  const [initializing, setInitializing] = useState(true);

  // Function to fetch tenant data
  const fetchTenantData = useCallback(async (tenantId) => {
    if (!tenantId) return null;
    
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .single();

      if (error) {
        console.warn("Error fetching tenant data:", error);
        return null;
      }
      
      // Store tenant data in localStorage
      localStorage.setItem("tenant", JSON.stringify(data));
      setTenant(data);
      return data;
    } catch (error) {
      console.error("Error fetching tenant data:", error);
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    try {
      setGlobalLoading(true);

      // Fetch user data with tenant_id
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, full_name, email, role, tenant_id")
        .eq("id", userId)
        .single();

      if (userError) {
        console.error("Error fetching user data:", userError);
        throw userError;
      }

      // Fetch tenant data if tenant_id exists
      if (userData?.tenant_id) {
        await fetchTenantData(userData.tenant_id);
      }

      // Fetch profile data - use maybeSingle instead of single with catch
      let profileData = null;
      const { data: profileResult, error: profileError } = await supabase
        .from("profiles")
        .select("branch_id, region_id, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.warn("Error fetching profile:", profileError);
      } else {
        profileData = profileResult;
      }

      // Fetch branch data
      let branchData = null;
      if (profileData?.branch_id) {
        const { data: branch } = await supabase
          .from("branches")
          .select("name, code")
          .eq("id", profileData.branch_id)
          .maybeSingle();
        branchData = branch;
      }

      // Fetch region data
      let regionData = null;
      if (profileData?.region_id) {
        const { data: region } = await supabase
          .from("regions")
          .select("name")
          .eq("id", profileData.region_id)
          .maybeSingle();
        regionData = region;
      }

      const profileObj = {
        id: userId,
        full_name: userData?.full_name || 'User',
        name: userData?.full_name || 'User',
        email: userData?.email || '',
        role: userData?.role || 'user',
        tenant_id: userData?.tenant_id || null,
        branch_id: profileData?.branch_id || null,
        region_id: profileData?.region_id || null,
        avatar: profileData?.avatar_url || null,
        branch: branchData?.name || "N/A",
        branch_code: branchData?.code || null,
        region: regionData?.name || "N/A",
        status: 'online',
        lastLogin: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      setProfile(profileObj);
      localStorage.setItem("profile", JSON.stringify(profileObj));

    } catch (err) {
      console.error("Auth loading error:", err);
      setProfile(null);
      localStorage.removeItem("profile");
    } finally {
      setGlobalLoading(false);
      setInitializing(false);
    }
  }, [fetchTenantData, setGlobalLoading]);

  useEffect(() => {
    // Check supabase session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setInitializing(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setTenant(null);
          localStorage.removeItem("profile");
          localStorage.removeItem("reportUser");
          localStorage.removeItem("tenant");
          setInitializing(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setProfile(null);
      setTenant(null);
      localStorage.removeItem("profile");
      localStorage.removeItem("reportUser");
      localStorage.removeItem("tenant");
      window.location.href = "/";
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  return { 
    user, 
    profile, 
    tenant, 
    initializing, 
    logout, 
    setUser, 
    setProfile,
    refreshProfile 
  };
}