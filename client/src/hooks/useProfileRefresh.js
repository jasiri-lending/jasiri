// src/hooks/useProfileRefresh.js
import { useCallback } from "react";
import { useAuth } from "./useAuth";

export function useProfileRefresh() {
  const { refreshProfile, profile } = useAuth();

  const refresh = useCallback(async () => {
    await refreshProfile();
  }, [refreshProfile]);

  return {
    refreshProfile: refresh,
    profile
  };
}