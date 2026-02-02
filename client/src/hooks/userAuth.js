// src/hooks/useAuth.js - UPDATED WITH CORRECT REGION LOGIC
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useGlobalLoading } from "./LoadingContext";

export function useAuth() {
  // Initialize from localStorage immediately
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
  const logoutTimerRef = useRef(null);
  const logoutCalledRef = useRef(false);

  console.log("🔍 [AUTH HOOK] Current state:", {
    user: user?.email || "null",
    profile: profile?.email || "null",
    tenant: tenant?.company_name || "null",
    initializing
  });

  // Helper function to check if session has expired
  const isSessionExpired = () => {
    const sessionExpiresAt = localStorage.getItem("sessionExpiresAt");
    if (!sessionExpiresAt) return true;

    const now = new Date();
    const expiryTime = new Date(sessionExpiresAt);

    console.log("🕒 [AUTH HOOK] Session expiry check:", {
      now: now.toISOString(),
      expiresAt: expiryTime.toISOString(),
      expired: expiryTime < now
    });

    return expiryTime < now;
  };

  // Auto logout when session expires
  const setupAutoLogout = () => {
    const sessionExpiresAt = localStorage.getItem("sessionExpiresAt");
    if (!sessionExpiresAt) return;

    const expiryTime = new Date(sessionExpiresAt).getTime();
    const now = new Date().getTime();
    const timeUntilExpiry = expiryTime - now;

    console.log("⏰ [AUTH HOOK] Setting up auto-logout timer:", {
      timeUntilExpiry: timeUntilExpiry / 1000 + " seconds"
    });

    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }

    if (timeUntilExpiry > 0) {
      logoutTimerRef.current = setTimeout(() => {
        console.log("🔐 [AUTH HOOK] Session expired, logging out...");
        logout();
      }, timeUntilExpiry);
    } else {
      console.log("🔐 [AUTH HOOK] Session already expired");
      logout();
    }
  };

  // Enhanced logout function
  const logout = useCallback(async () => {
    if (logoutCalledRef.current) {
      console.log("⚠️ [AUTH HOOK] Logout already in progress");
      return;
    }

    logoutCalledRef.current = true;
    console.log("🚪 [AUTH HOOK] Logging out...");

    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }

    try {
      const sessionToken = localStorage.getItem("sessionToken");
      if (sessionToken) {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          await fetch(`${API_BASE_URL}/api/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${sessionToken}`
            },
            signal: controller.signal
          }).catch(error => {
            if (error.name === 'AbortError') {
              console.warn("⚠️ [AUTH HOOK] Logout request timed out");
            } else {
              console.warn("⚠️ [AUTH HOOK] Could not clear server session:", error.message);
            }
          });

          clearTimeout(timeoutId);
        } catch (error) {
          console.warn("⚠️ [AUTH HOOK] Could not clear server session:", error);
        }
      }

      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("profile");
      localStorage.removeItem("reportUser");
      localStorage.removeItem("tenant");
      localStorage.removeItem("sessionToken");
      localStorage.removeItem("userId");
      localStorage.removeItem("sessionExpiresAt");

      setUser(null);
      setProfile(null);
      setTenant(null);
      setInitializing(false);

      setTimeout(() => {
        logoutCalledRef.current = false;
      }, 1000);

      if (window.location.pathname !== "/login") {
        console.log("🔐 [AUTH HOOK] Redirecting to login...");
        window.location.href = "/login";
      } else {
        console.log("✅ [AUTH HOOK] Already on login page");
      }
    }
  }, []);

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

  // Fetch profile with correct region logic
  const fetchProfile = useCallback(async (userId) => {
    console.log("\n🔍 [AUTH HOOK] ========== fetchProfile START ==========");
    console.log("🔍 [AUTH HOOK] userId:", userId);

    if (isSessionExpired()) {
      console.log("❌ [AUTH HOOK] Session expired, logging out...");
      logout();
      return;
    }

    try {
      setGlobalLoading(true);

      // Fetch user data from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, full_name, email, role, tenant_id, last_login, created_at, phone, session_expires_at")
        .eq("id", userId)
        .single();

      if (userError) {
        console.error("❌ [AUTH HOOK] User fetch error:", userError);
        throw userError;
      }

      if (userData?.session_expires_at && new Date(userData.session_expires_at) < new Date()) {
        console.log("❌ [AUTH HOOK] Database session expired");
        logout();
        return;
      }

      console.log("✅ [AUTH HOOK] User data fetched:", {
        email: userData.email,
        role: userData.role,
        tenant_id: userData.tenant_id
      });

      // For superadmin and tenant admin, they don't need branch/region
      const isAdminUser = ["superadmin", "admin"].includes(userData.role);

      if (userData?.tenant_id) {
        await fetchTenantData(userData.tenant_id);

        // DEBUG: Fetch and log all regions for this tenant as requested
        console.log(`🔍 [AUTH HOOK DEBUG] Fetching ALL regions for tenant: ${userData.tenant_id}`);
        const { data: tenantRegions, error: trError } = await supabase
          .from('regions')
          .select('*')
          .eq('tenant_id', userData.tenant_id);

        if (trError) {
          console.error('❌ [AUTH HOOK DEBUG] Error fetching tenant regions:', trError);
        } else {
          console.log(`✅ [AUTH HOOK DEBUG] Found ${tenantRegions?.length || 0} regions for tenant ${userData.tenant_id}:`, tenantRegions);
        }
      }

      // For non-admin users, fetch profile with branch/region
      let profileData = null;
      let branchData = null;
      let regionData = null;
      let branchName = "N/A";
      let branchCode = null;
      let regionName = "N/A";

      // Fetch profile data for ALL users (including admins) to ensure we get region/branch info if available
      // if (!isAdminUser) {
      if (true) {
        // Fetch profile data
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
            avatar_url: profileData?.avatar_url || 'null',
            branch_id: profileData?.branch_id || 'null',
            region_id: profileData?.region_id || 'null'
          });
        }

        // Fetch branch data if branch_id exists
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

          if (branchData) {
            branchName = branchData.name;
            branchCode = branchData.code;

            // Fetch region from branch's region_id
            if (branchData.region_id) {
              console.log(`🌍 [AUTH HOOK] Fetching region from branch: ${branchData.region_id}`);

              const { data: region } = await supabase
                .from("regions")
                .select("name")
                .eq("id", branchData.region_id)
                .maybeSingle();

              if (region) {
                regionData = region;
                regionName = region.name;
                console.log(`✅ [AUTH HOOK] Region from branch: ${regionName}`);
              }
            }
          }
        }

        // If still no region, try to fetch from profile's region_id
        if (!regionData && profileData?.region_id) {
          console.log(`🌍 [AUTH HOOK] Fetching region from profile: ${profileData.region_id}`);

          const { data: region } = await supabase
            .from("regions")
            .select("name")
            .eq("id", profileData.region_id)
            .maybeSingle();

          if (region) {
            regionData = region;
            regionName = region.name;
            console.log(`✅ [AUTH HOOK] Region from profile: ${regionName}`);
          }
        }
      }

      // Construct profile object
      const profileObj = {
        id: userId,
        full_name: userData?.full_name || 'User',
        name: userData?.full_name || 'User',
        email: userData?.email || '',
        phone: userData?.phone || null,
        role: userData?.role || 'user',
        tenant_id: userData?.tenant_id || null,
        branch_id: profileData?.branch_id || null,
        region_id: branchData?.region_id || profileData?.region_id || null,
        avatar_url: profileData?.avatar_url || null,
        branch: branchName,
        branch_code: branchCode,
        region: regionName,
        last_login: userData?.last_login || null,
        created_at: userData?.created_at || null,
        session_expires_at: userData?.session_expires_at || null
      };

      console.log("🖼️ [AUTH HOOK] User profile:", {
        name: profileObj.full_name,
        role: profileObj.role,
        branch: profileObj.branch,
        region: profileObj.region,
        isAdmin: isAdminUser
      });

      setProfile(profileObj);
      setUser(userData); // Set user state so auth checks pass
      localStorage.setItem("profile", JSON.stringify(profileObj));
      localStorage.setItem("userId", userData.id); // Ensure userId is in localStorage

      if (userData?.session_expires_at) {
        localStorage.setItem("sessionExpiresAt", userData.session_expires_at);
        setupAutoLogout();
      }

      console.log("✅ [AUTH HOOK] ========== fetchProfile COMPLETE ==========\n");

    } catch (err) {
      console.error("💥 [AUTH HOOK] Auth loading error:", err);
      setProfile(null);
      localStorage.removeItem("profile");
    } finally {
      setGlobalLoading(false);
      setInitializing(false);
    }
  }, [fetchTenantData, setGlobalLoading, logout]);

  useEffect(() => {
    console.log("🔍 [AUTH HOOK] useEffect running");

    if (isSessionExpired()) {
      console.log("❌ [AUTH HOOK] Session expired on mount, logging out...");
      logout();
      return;
    }

    const customSessionToken = localStorage.getItem("sessionToken");
    const customUserId = localStorage.getItem("userId");

    if (customSessionToken && customUserId) {
      console.log("✅ [AUTH HOOK] Found custom session, fetching fresh data");
      fetchProfile(customUserId);
      setupAutoLogout();
      return;
    }

    console.log("🔍 [AUTH HOOK] No custom session, checking Supabase...");

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🔍 [AUTH HOOK] Supabase session check:", session?.user?.email || "no session");
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setInitializing(false);
      }
    }).catch(err => {
      console.warn("⚠️ [AUTH HOOK] Supabase session check failed (expected if using custom auth):", err.message);
      setInitializing(false);
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
          localStorage.removeItem("sessionToken");
          localStorage.removeItem("userId");
          localStorage.removeItem("sessionExpiresAt");
          setInitializing(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, [fetchProfile, logout]);

  const refreshProfile = async () => {
    const userId = user?.id || localStorage.getItem("userId");
    if (userId) {
      console.log("🔄 [AUTH HOOK] Manually refreshing profile");
      await fetchProfile(userId);
    }
  };

  return {
    user,
    profile,
    tenant,
    initializing,
    isLoading: initializing,
    logout,
    setUser,
    setProfile,
    refreshProfile
  };
}