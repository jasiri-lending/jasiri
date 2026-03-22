// src/hooks/useAuth.js - UPDATED WITH GLOBAL AUTH CONTEXT
import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { supabase } from "../supabaseClient";
import { useGlobalLoading } from "./LoadingContext";
import { apiFetch } from "../utils/api";

// Create the context
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
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

  const initialProfile = getInitialProfile();
  const initialTenant = getInitialTenant();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(initialProfile);
  const [tenant, setTenant] = useState(initialTenant);
  const { setLoading: setGlobalLoading } = useGlobalLoading();
  const [initializing, setInitializing] = useState(true);
  const logoutTimerRef = useRef(null);
  const logoutCalledRef = useRef(false);
  const isLoggingOutRef = useRef(false);
  const isFetchingRef = useRef(false);



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
    logoutCalledRef.current = true;
    isLoggingOutRef.current = true;
    sessionStorage.setItem("isLoggingOut", "true"); // PERSIST logout state across reloads
    console.log("🔓 [AUTH HOOK] Starting logout sequence and setting sessionStorage lock...");

    // 1️⃣ IMMEDIATELY clear localStorage before any async calls
    // This breaks the loop if the page reloads mid-logout
    localStorage.removeItem("profile");
    localStorage.removeItem("tenant");
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("sessionExpiresAt");
    localStorage.removeItem("reportUser");

    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }

    try {
      const sessionToken = localStorage.getItem("sessionToken");
      if (sessionToken) {
        // Clear server session if needed
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
        await fetch(`${API_BASE_URL}/api/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionToken}`
          }
        }).catch(() => { });
      }

      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("profile");
      localStorage.removeItem("tenant");
      localStorage.removeItem("sessionToken");
      localStorage.removeItem("userId");
      localStorage.removeItem("sessionExpiresAt");
      localStorage.removeItem("reportUser");

      setUser(null);
      setProfile(null);
      setTenant(null);
      setInitializing(false);

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
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
    if (!userId || isLoggingOutRef.current || isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setGlobalLoading(true);

      // Fetch profile data from our secure Node API layer
      const response = await apiFetch(`/api/profile/${userId}`, {
        method: "GET"
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn(`⚠️ [AUTH HOOK] API returned ${response.status} for ${userId}. Logging out...`);
          logout();
          return;
        }
        throw new Error(`API error ${response.status}`);
      }

      const profileData = await response.json();

      // The API returns an enriched profile object including tenant info
      setProfile(profileData);
      setTenant(profileData.tenant);

      localStorage.setItem("profile", JSON.stringify(profileData));
      if (profileData.tenant) {
        localStorage.setItem("tenant", JSON.stringify(profileData.tenant));
      }

      localStorage.setItem("userId", userId);

      if (profileData.session_expires_at) {
        localStorage.setItem("sessionExpiresAt", profileData.session_expires_at);
        setupAutoLogout();
      }

      // Success! Clear the logout lock if it existed
      sessionStorage.removeItem("isLoggingOut");
      isLoggingOutRef.current = false;



    } catch (err) {
      console.error("💥 [AUTH HOOK] Auth loading error:", err);
      setProfile(null);
      localStorage.removeItem("profile");
    } finally {
      setGlobalLoading(false);
      isFetchingRef.current = false;
      setInitializing(false);
    }
  }, [logout]); // 🚩 REMOVED setGlobalLoading and fetchTenantData from dependencies

  useEffect(() => {
    // Only check session expiry if a session expiry timestamp actually exists.
    const sessionExpiresAt = localStorage.getItem("sessionExpiresAt");
    if (sessionExpiresAt && isSessionExpired()) {
      logout();
      return;
    }

    const customSessionToken = localStorage.getItem("sessionToken");
    const customUserId = localStorage.getItem("userId");
    const isLocked = sessionStorage.getItem("isLoggingOut") === "true";

    if (isLocked) {
      console.log("🔒 [AUTH HOOK] UseAuth blocked by sessionStorage logout lock.");
      setInitializing(false);
      return;
    }

    // If we already have a token in localStorage, use it directly.
    if (customSessionToken && customUserId) {
      if (!profile || profile.id !== customUserId) {
        fetchProfile(customUserId);
      } else {
        setInitializing(false);
      }
      setupAutoLogout();
    } else {
      // No localStorage token — check Supabase for an existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          localStorage.setItem("sessionToken", session.access_token);
          localStorage.setItem("userId", session.user.id);
          fetchProfile(session.user.id);
        } else {
          setInitializing(false);
        }
      }).catch(err => {
        console.warn("⚠️ [AUTH HOOK] Supabase session check failed:", err.message);
        setInitializing(false);
      });
    }

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // 🚩 CRITICAL: If we are in the middle of a logout, ignore all SIGNED_IN events
        const isLocked = sessionStorage.getItem("isLoggingOut") === "true";
        if (isLoggingOutRef.current || isLocked) {
          console.log(`🔇 [AUTH HOOK] Ignoring ${event} event because logout is in progress or lock is active.`);
          return;
        }

        // Only react to meaningful events, skip TOKEN_REFRESHED to avoid duplicate fetches
        if (event === "SIGNED_IN" && session?.user && session.access_token) {
          console.log("🔑 [AUTH HOOK] SIGNED_IN event detected.");
          
          setUser(session.user);
          localStorage.setItem("sessionToken", session.access_token);
          localStorage.setItem("userId", session.user.id);
          
          // Only fetch if profile isn't already loaded for this user
          if (!profile || profile.id !== session.user.id) {
            // Set initializing=true so ProtectedRoute shows a spinner and does NOT
            // redirect to login while the profile API fetch is in progress.
            setInitializing(true);
            fetchProfile(session.user.id);
          }
        }
 else if (event === "TOKEN_REFRESHED" && session?.access_token) {
          // Just update the token, don't re-fetch profile
          localStorage.setItem("sessionToken", session.access_token);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setTenant(null);
          localStorage.removeItem("sessionToken");
          localStorage.removeItem("userId");
          localStorage.removeItem("profile");
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

  const getDefaultRoute = useCallback((userRole) => {
    switch (userRole) {
      case "relationship_officer":
      case "branch_manager":
      case "regional_manager":
      case "credit_analyst_officer":
      case "customer_service_officer":
        return "/dashboard";
      case "admin":
      case "superadmin":
        return "/dashboard/admin";
      default:
        return "/dashboard";
    }
  }, []);

  const value = {
    user,
    profile,
    tenant,
    initializing,
    isLoading: initializing,
    logout,
    setUser: (u) => { setUser(u); setInitializing(false); },
    setProfile: (p) => { setProfile(p); setInitializing(false); },
    setTenant,
    refreshProfile,
    getDefaultRoute
  };

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};