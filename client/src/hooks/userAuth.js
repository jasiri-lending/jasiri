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



  // Helper function to check if session has expired
  const isSessionExpired = () => {
    const sessionExpiresAt = localStorage.getItem("sessionExpiresAt");
    if (!sessionExpiresAt) return true;

    const now = new Date();
    const expiryTime = new Date(sessionExpiresAt);



    return expiryTime < now;
  };

  // Auto logout when session expires
  const setupAutoLogout = () => {
    const sessionExpiresAt = localStorage.getItem("sessionExpiresAt");
    if (!sessionExpiresAt) return;

    const expiryTime = new Date(sessionExpiresAt).getTime();
    const now = new Date().getTime();
    const timeUntilExpiry = expiryTime - now;



    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }

    if (timeUntilExpiry > 0) {
      logoutTimerRef.current = setTimeout(() => {
        logout();
      }, timeUntilExpiry);
    } else {
      logout();
    }
  };

  // Enhanced logout function
  const logout = useCallback(async () => {
    if (logoutCalledRef.current) {
      return;
    }

    logoutCalledRef.current = true;

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
              console.warn(" Logout request timed out");
            } else {
              console.warn(" Could not clear server session:", error.message);
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
        console.log("Redirecting to login...");
        window.location.href = "/login";
      } else {
        console.log(" Already on login page");
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


    if (isSessionExpired()) {
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
        throw userError;
      }

      if (userData?.session_expires_at && new Date(userData.session_expires_at) < new Date()) {
        logout();
        return;
      }



      // For superadmin and tenant admin, they don't need branch/region
      const isAdminUser = ["superadmin", "admin"].includes(userData.role);

      if (userData?.tenant_id) {
        await fetchTenantData(userData.tenant_id);
      }

      // For non-admin users, fetch profile with branch/region
      let profileData = null;
      let branchData = null;
      let regionData = null;
      let branchName = "N/A";
      let branchCode = null;
      let regionName = "N/A";

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

        }

        // Fetch branch data if branch_id exists
        if (profileData?.branch_id) {

          const { data: branch } = await supabase
            .from("branches")
            .select("name, code, region_id")
            .eq("id", profileData.branch_id)
            .maybeSingle();

          branchData = branch;


          if (branchData) {
            branchName = branchData.name;
            branchCode = branchData.code;

            // Fetch region from branch's region_id
            if (branchData.region_id) {

              const { data: region } = await supabase
                .from("regions")
                .select("name")
                .eq("id", branchData.region_id)
                .maybeSingle();

              if (region) {
                regionData = region;
                regionName = region.name;
              }
            }
          }
        }

        // If still no region, try to fetch from profile's region_id
        if (!regionData && profileData?.region_id) {

          const { data: region } = await supabase
            .from("regions")
            .select("name")
            .eq("id", profileData.region_id)
            .maybeSingle();

          if (region) {
            regionData = region;
            regionName = region.name;
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



      setProfile(profileObj);
      setUser(userData); // Set user state so auth checks pass
      localStorage.setItem("profile", JSON.stringify(profileObj));
      localStorage.setItem("userId", userData.id); // Ensure userId is in localStorage

      if (userData?.session_expires_at) {
        localStorage.setItem("sessionExpiresAt", userData.session_expires_at);
        setupAutoLogout();
      }


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

    if (isSessionExpired()) {
      logout();
      return;
    }

    const customSessionToken = localStorage.getItem("sessionToken");
    const customUserId = localStorage.getItem("userId");

    if (customSessionToken && customUserId) {
      fetchProfile(customUserId);
      setupAutoLogout();
      return;
    }


    supabase.auth.getSession().then(({ data: { session } }) => {
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

  const refreshProfile = useCallback(async () => {
    const userId = user?.id || localStorage.getItem("userId");
    if (userId) {
      await fetchProfile(userId);
    }
  }, [user?.id, fetchProfile]);

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