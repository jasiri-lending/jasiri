import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/userAuth";
import Spinner from "./Spinner";

export default function ProtectedRoute({ children }) {
  const { profile, initializing } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initializing && !profile) {
      // Redirect safely after auth initializes
      navigate("/login", { replace: true });
    }
  }, [initializing, profile, navigate]);

  // If we have a cached profile, render immediately (background refresh is happening silently)
  if (profile) {
    return children;
  }

  // Only show a spinner if we are truly loading with no cached data
  if (initializing) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading..." />
      </div>
    );
  }

  // No profile, not initializing — redirect will happen via useEffect
  return null;
}