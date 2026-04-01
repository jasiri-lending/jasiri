import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '../services/supabase';
import apiClient from '../services/apiClient';
import { Session, User } from '@supabase/supabase-js';

interface Profile {
  full_name: string;
  email: string;
  role: string;
  tenant_id: string;
  branch: string;
  branch_id: string;
  region: string;
  phone: string;
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; needsOtp?: boolean; userId?: string; error?: string }>;
  verifyOtp: (userId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  biometricAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

function useProtectedRoute(session: Session | null, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, loading]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useProtectedRoute(session, loading);

  useEffect(() => {
    // Restore session from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id, session.access_token);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id, session.access_token);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string, token: string) {
    try {
      const res = await apiClient.get(`/profile/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data);
    } catch (e) {
      console.warn('Profile load failed', e);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      // Step 1 — verify credentials with our backend (sends OTP)
      const res = await apiClient.post('/login', { email, password });
      if (!res.data.success) {
        return { success: false, error: res.data.error ?? 'Login failed' };
      }
      // Step 2 — also sign into Supabase client-side to get a live JWT
      const { error: sbError } = await supabase.auth.signInWithPassword({ email, password });
      if (sbError) return { success: false, error: sbError.message };

      return { success: true, needsOtp: true, userId: res.data.userId };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error ?? 'Network error' };
    }
  }

  async function verifyOtp(userId: string, code: string) {
    try {
      const res = await apiClient.post('/verify-code', { userId, code });
      if (!res.data.success) return { success: false, error: res.data.error };
      // Session already set via onAuthStateChange from signInWithPassword above
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.error ?? 'Verification failed' };
    }
  }

  async function biometricAuth(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Jasiri RO Suite',
      fallbackLabel: 'Use Password',
      cancelLabel: 'Cancel',
    });

    if (result.success) {
      // Re-hydrate session from SecureStore (already done in useEffect on mount)
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    }
    return false;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, verifyOtp, signOut, biometricAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
