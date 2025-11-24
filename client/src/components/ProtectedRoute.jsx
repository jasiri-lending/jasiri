// src/components/ProtectedRoute.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../hooks/userAuth";

function ProtectedRoute({ children }) {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !profile) {
      toast.error("You must log in to continue");
      navigate("/login");
    }
  }, [profile, loading, navigate]);

  if (loading) return <div>Loading...</div>;

  if (!profile) return null; // prevent flicker

  return children;
}

export default ProtectedRoute;
