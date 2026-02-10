import { useState, useMemo } from "react";
import { LoadingContext } from "./LoadingContext";

export function LoadingProvider({ children }) {
  const [loading, setLoading] = useState(false);

  const value = useMemo(() => ({ loading, setLoading }), [loading]);

  return (
    <LoadingContext.Provider value={value}>
      {/* Global loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-[9999]" />
      )}

      {children}
    </LoadingContext.Provider>
  );
}