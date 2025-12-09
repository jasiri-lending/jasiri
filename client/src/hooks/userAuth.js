import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useGlobalLoading } from "./LoadingContext";

export function useAuth() {
  // Load profile from localStorage initially
  const savedProfile = localStorage.getItem("profile");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(savedProfile ? JSON.parse(savedProfile) : null);
  const { setLoading: setGlobalLoading } = useGlobalLoading();
  const [initializing, setInitializing] = useState(true);

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

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          localStorage.removeItem("profile"); // remove profile on logout
            localStorage.removeItem("reportUser"); 
          setInitializing(false);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    try {
      setGlobalLoading(true);

      const { data: userData } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("id", userId)
        .single();

      const { data: profileData } = await supabase
        .from("profiles")
        .select("branch_id, region_id")
        .eq("id", userId)
        .single();

      const { data: branchData } = await supabase
        .from("branches")
        .select("name")
        .eq("id", profileData?.branch_id)
        .maybeSingle();

      const { data: regionData } = await supabase
        .from("regions")
        .select("name")
        .eq("id", profileData?.region_id)
        .maybeSingle();

      const profileObj = {
        id: userId,
        name: userData.full_name,
        email: userData.email,
        role: userData.role,
        branch_id: profileData?.branch_id || null,
        region_id: profileData?.region_id || null,
        branch: branchData?.name || "N/A",
        region: regionData?.name || "N/A",
      };

      setProfile(profileObj);
      localStorage.setItem("profile", JSON.stringify(profileObj)); // persist profile

    } catch (err) {
      console.error("Auth loading error:", err);
      setProfile(null);
      localStorage.removeItem("profile");
    } finally {
      setGlobalLoading(false);
      setInitializing(false);
    }
  }

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    localStorage.removeItem("profile");
     localStorage.removeItem("reportUser");
    window.location.href = "/";
  };

  return { user, profile, initializing, logout, setUser, setProfile };
}
