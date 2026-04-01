import axios from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = 'https://jasiri-backend.onrender.com';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach Supabase JWT automatically
apiClient.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {}
  return config;
}, (error) => Promise.reject(error));

// Handle token expiry
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Attempt token refresh
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session) {
        error.config.headers.Authorization = `Bearer ${session.access_token}`;
        return axios(error.config);
      }
      // Force sign-out if refresh fails
      await supabase.auth.signOut();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
export { API_BASE_URL };
