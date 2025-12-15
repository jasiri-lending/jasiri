// config.js
// Location: frontend/src/config.js

// Domain configuration
export const DOMAIN = import.meta.env.VITE_DOMAIN;

// API Base URL configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV 
    ? "http://localhost:5000"  // Development: local backend
    : "https://jasiri-backend.onrender.com"  // Production: your live backend
  );

// Debug in development mode
if (import.meta.env.DEV) {
  console.log("🔧 Development Mode");
  console.log("🌐 API_BASE_URL:", API_BASE_URL);
  console.log("🌐 DOMAIN:", DOMAIN);
}