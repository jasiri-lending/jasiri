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

  // Keep UI stable while auth initializes
  if (initializing) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Verifying session..." />
      </div>
    );
  }

  // Only render children if user is authenticated
  return profile ? children : (
    <div className="min-h-screen bg-brand-surface flex items-center justify-center">
      <Spinner text="Finalizing access..." />
    </div>
  );
}