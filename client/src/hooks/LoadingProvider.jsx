import { useState } from "react";
import { LoadingContext } from "./LoadingContext";

export function LoadingProvider({ children }) {
  const [loading, setLoading] = useState(false);

  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {/* Global loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-[9999]">
          {/* <div className="text-white text-lg font-semibold animate-pulse">
            Loading...
          </div> */}
        </div>
      )}

      {children}
    </LoadingContext.Provider>
  );
}