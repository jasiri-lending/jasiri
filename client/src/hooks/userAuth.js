import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useGlobalLoading } from "./LoadingContext";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
const { setLoading: setGlobalLoading } = useGlobalLoading();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
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

      setProfile({
        id: userId,
        name: userData.full_name,
        email: userData.email,
        role: userData.role,
        branch_id: profileData?.branch_id || null,
        region_id: profileData?.region_id || null,
        branch: branchData?.name || "N/A",
        region: regionData?.name || "N/A",
      });
    } catch (err) {
      console.error("Auth loading error:", err);
      setProfile(null);
    } finally {
      setGlobalLoading(false);
      setInitializing(false);
    }
  }

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/";
  };

  return { user, profile, initializing, logout, setUser, setProfile };
}
