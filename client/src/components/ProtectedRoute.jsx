import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../hooks/userAuth";

export default function ProtectedRoute({ children }) {
  const { profile, initializing } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initializing && !profile) {
      toast.error("You must log in to continue");
      navigate("/login");
    }
  }, [initializing, profile]);

  if (initializing) return null; // keep UI stable while auth initializes

  return children;
}
