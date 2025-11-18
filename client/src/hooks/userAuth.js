// src/hooks/useAuth.js
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fetch profile with better error handling
  async function fetchProfile(userId) {
    try {
      // Get user data from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("id", userId)
        .single();

      if (userError) {
        console.error("Error fetching user data:", userError);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Get profile data (branch_id, region_id)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, branch_id, region_id")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile data:", profileError);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Then get related data
      let branchName = "N/A";
      let regionName = "N/A";

      if (profileData.branch_id) {
        const { data: branchData, error: branchError } = await supabase
          .from("branches")
          .select("name")
          .eq("id", profileData.branch_id)
          .single();
        
        if (!branchError && branchData) {
          branchName = branchData.name;
        }
      }

      if (profileData.region_id) {
        const { data: regionData, error: regionError } = await supabase
          .from("regions")
          .select("name")
          .eq("id", profileData.region_id)
          .single();
        
        if (!regionError && regionData) {
          regionName = regionData.name;
        }
      }

      setProfile({
        id: userData.id,
        name: userData.full_name,
        email: userData.email,
        role: userData.role,
        branch_id: profileData.branch_id,
        region_id: profileData.region_id,
        branch: branchName,
        region: regionName,
      });
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  // Logout function
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  };

  return { 
    user, 
    profile, 
    loading, 
    logout, 
    setUser, 
    setProfile 
  };
}