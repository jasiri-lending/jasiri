// src/utils/api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Standard API fetch wrapper that includes the Supabase JWT in the Authorization header.
 * @param {string} endpoint - The API endpoint (e.g., "/create-user" or "/api/tenant")
 * @param {Object} options - Standard fetch options
 * @returns {Promise<Response>}
 */
export const apiFetch = async (endpoint, options = {}) => {
    const sessionToken = localStorage.getItem("sessionToken");
    // Only send the token if it exists and looks like a valid JWT (3 segments)
    const isValidJwt = sessionToken && sessionToken !== "undefined" && sessionToken !== "null" && sessionToken.split(".").length === 3;

    const headers = {
        "Content-Type": "application/json",
        ...(isValidJwt && { "Authorization": `Bearer ${sessionToken}` }),
        ...(options.headers || {})
    };

    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

    return fetch(url, {
        ...options,
        headers
    });
};
