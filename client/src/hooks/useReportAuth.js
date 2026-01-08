import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

export function useReportAuth() {
  const { user, profile, initializing } = useAuth();
  const [reportUser, setReportUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const validateReportUser = () => {
    if (!user || !profile?.tenant_id) {
      localStorage.removeItem("reportUser");
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
  };

  useEffect(() => {
    if (initializing) return;
    validateReportUser();
  }, [user, profile, initializing]);

  // ✅ LISTEN FOR REPORT LOGIN
  useEffect(() => {
    const refresh = () => {
      setChecking(true);
      validateReportUser();
    };

    window.addEventListener("report-login", refresh);
    return () => window.removeEventListener("report-login", refresh);
  }, [user, profile]);

  return {
    reportUser,
    checking,
    isReportAuthenticated: !!reportUser,
  };
}
