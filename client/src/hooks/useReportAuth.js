import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/userAuth";

export function useReportAuth() {
  const { profile, initializing } = useAuth();
  const [reportUser, setReportUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const validateReportUser = useCallback(() => {
    if (!profile?.tenant_id) {
      setReportUser(null);
      setChecking(false);
      return;
    }

    const stored = localStorage.getItem("reportUser");
    if (!stored) {
      setReportUser(null);
      setChecking(false);
      return;
    }

    try {
      const parsed = JSON.parse(stored);

      if (parsed.tenant_id !== profile.tenant_id) {
        localStorage.removeItem("reportUser");
        setReportUser(null);
      } else {
        setReportUser(parsed);
      }
    } catch {
      localStorage.removeItem("reportUser");
      setReportUser(null);
    }

    setChecking(false);
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (initializing) return;
    validateReportUser();
  }, [profile, initializing, validateReportUser]);

  // ✅ LISTEN FOR REPORT LOGIN
  useEffect(() => {
    const refresh = () => {
      setChecking(true);
      validateReportUser();
    };

    window.addEventListener("report-login", refresh);
    return () => window.removeEventListener("report-login", refresh);
  }, [validateReportUser]);

  return {
    reportUser,
    checking,
    isReportAuthenticated: !!reportUser,
  };
}
