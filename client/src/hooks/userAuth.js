// src/hooks/useAuth.js - CORRECTED VERSION
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useGlobalLoading } from "./LoadingContext";

export function useAuth() {
  // Initialize from localStorage immediately (synchronously)
  const getInitialProfile = () => {
    try {
      const savedProfile = localStorage.getItem("profile");
      return savedProfile ? JSON.parse(savedProfile) : null;
    } catch (error) {
      console.error("Error parsing saved profile:", error);
      return null;
    }
  };

  const getInitialTenant = () => {
    try {
      const savedTenant = localStorage.getItem("tenant");
      return savedTenant ? JSON.parse(savedTenant) : null;
    } catch (error) {
      console.error("Error parsing saved tenant:", error);
      return null;
    }
  };

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(getInitialProfile());
  const [tenant, setTenant] = useState(getInitialTenant());
  const { setLoading: setGlobalLoading } = useGlobalLoading();
  const [initializing, setInitializing] = useState(true);

  console.log("🔍 [AUTH HOOK] Current state:");
  console.log("- user:", user?.email || "null");
  console.log("- profile:", profile?.email || "null");
  console.log("- tenant:", tenant?.company_name || "null");
  console.log("- initializing:", initializing);

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
      
      console.log("✅ [AUTH HOOK] Fetched tenant:", data.company_name);
      localStorage.setItem("tenant", JSON.stringify(data));
      setTenant(data);
      return data;
    } catch (error) {
      console.error("Error fetching tenant data:", error);
      return null;
    }
  }, []);

const fetchProfile = useCallback(async (userId) => {
  console.log("\n🔍 [AUTH HOOK] ========== fetchProfile START ==========");
  console.log("🔍 [AUTH HOOK] userId:", userId);
  
  try {
    setGlobalLoading(true);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email, role, tenant_id")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("❌ [AUTH HOOK] User fetch error:", userError);
      throw userError;
    }

    console.log("✅ [AUTH HOOK] User data fetched:", {
      email: userData.email,
      role: userData.role,
      tenant_id: userData.tenant_id
    });

    // Fetch tenant data if tenant_id exists
    if (userData?.tenant_id) {
      await fetchTenantData(userData.tenant_id);
    }

    let profileData = null;
    const { data: profileResult, error: profileError } = await supabase
      .from("profiles")
      .select("branch_id, region_id, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.warn("⚠️ [AUTH HOOK] Profile fetch error:", profileError);
    } else {
      profileData = profileResult;
      console.log("📋 [AUTH HOOK] Profile data:", {
        exists: !!profileData,
        branch_id: profileData?.branch_id || 'null',
        region_id: profileData?.region_id || 'null'
      });
    }

    let branchData = null;
    let resolvedRegionId = profileData?.region_id;

    if (profileData?.branch_id) {
      console.log(`🏢 [AUTH HOOK] Fetching branch: ${profileData.branch_id}`);
      
      const { data: branch } = await supabase
        .from("branches")
        .select("name, code, region_id")
        .eq("id", profileData.branch_id)
        .maybeSingle();
      
      branchData = branch;
      console.log("🏢 [AUTH HOOK] Branch data:", {
        found: !!branch,
        name: branch?.name || 'null',
        code: branch?.code || 'null',
        region_id: branch?.region_id || 'null'
      });
      
      if (!resolvedRegionId && branch?.region_id) {
        resolvedRegionId = branch.region_id;
        console.log("📍 [AUTH HOOK] Using region_id from branch:", resolvedRegionId);
      }
    } else {
      console.log("⚠️ [AUTH HOOK] No branch_id in profile");
    }

    let regionData = null;
    if (resolvedRegionId) {
      console.log(`🌍 [AUTH HOOK] Fetching region: ${resolvedRegionId}`);
      
      const { data: region } = await supabase
        .from("regions")
        .select("name")
        .eq("id", resolvedRegionId)
        .maybeSingle();
      
      regionData = region;
      console.log("🌍 [AUTH HOOK] Region data:", {
        found: !!region,
        name: region?.name || 'null'
      });
    } else {
      console.log("⚠️ [AUTH HOOK] No region_id to fetch");
    }

    const profileObj = {
      id: userId,
      full_name: userData?.full_name || 'User',
      name: userData?.full_name || 'User',
      email: userData?.email || '',
      role: userData?.role || 'user',
      tenant_id: userData?.tenant_id || null,
      branch_id: profileData?.branch_id || null,
      region_id: resolvedRegionId || null,
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

    console.log("📊 [AUTH HOOK] Final profile object:", {
      email: profileObj.email,
      role: profileObj.role,
      branch_id: profileObj.branch_id,
      branch: profileObj.branch,
      region_id: profileObj.region_id,
      region: profileObj.region
    });

    setProfile(profileObj);
    localStorage.setItem("profile", JSON.stringify(profileObj));

    console.log("✅ [AUTH HOOK] ========== fetchProfile COMPLETE ==========\n");

  } catch (err) {
    console.error("💥 [AUTH HOOK] Auth loading error:", err);
    setProfile(null);
    localStorage.removeItem("profile");
  } finally {
    setGlobalLoading(false);
    setInitializing(false);
  }
}, [fetchTenantData, setGlobalLoading]);

  useEffect(() => {
    console.log("🔍 [AUTH HOOK] useEffect running");
    
    // Check for custom session first
    const customSessionToken = localStorage.getItem("sessionToken");
    const customUserId = localStorage.getItem("userId");
    
    if (customSessionToken && customUserId) {
      console.log("✅ [AUTH HOOK] Found custom session, using localStorage data");
      
      // We already initialized from localStorage, so just set user and finish
      const savedProfile = getInitialProfile();
      if (savedProfile) {
        setUser({
          id: savedProfile.id,
          email: savedProfile.email,
          role: savedProfile.role
        });
        
        // Ensure tenant is loaded if we have tenant_id but no tenant data
        if (savedProfile.tenant_id && !tenant) {
          console.log("🔍 [AUTH HOOK] Loading tenant for custom session");
          fetchTenantData(savedProfile.tenant_id);
        }
      }
      setInitializing(false);
      return; // Don't set up Supabase listeners
    }
    
    // No custom session, use Supabase auth
    console.log("🔍 [AUTH HOOK] No custom session, checking Supabase...");
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🔍 [AUTH HOOK] Supabase session check:", session?.user?.email || "no session");
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setInitializing(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔍 [AUTH HOOK] Supabase auth state change:", event, session?.user?.email || "no session");
        
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
  }, []); // Empty dependency array - only run once on mount

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
      localStorage.removeItem("sessionToken");
      localStorage.removeItem("userId");
      localStorage.removeItem("sessionExpiresAt");
      window.location.href = "/";
    }
  };

  const refreshProfile = async () => {
    const userId = user?.id || localStorage.getItem("userId");
    if (userId) {
      await fetchProfile(userId);
    }
  };

  return { 
    user, 
    profile, 
    tenant, 
    initializing,
    isLoading: initializing, // Add this for SharedHeader compatibility
    logout, 
    setUser, 
    setProfile,
    refreshProfile 
  };
}