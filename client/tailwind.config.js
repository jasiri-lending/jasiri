/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // make sure it scans your React files
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["Inter", "sans-serif"],       // Clean and readable font
        heading: ["Poppins", "sans-serif"],  // Modern for headings
      },
      colors: {
        primary: "#1E3A8A",     // Navy Blue – Trust & Stability
        accent: "#10B981",      // Emerald Green – Growth & Prosperity
        neutral: "#F3F4F6",     // Cool Gray – Minimalist Background
        highlight: "#FACC15",   // Gold – Premium Highlight
        text: "#111827",        // Default text color
        background: "#FFFFFF",  // Clean white background
        muted: "#6B7280",       // Subtle gray for secondary text
        brand: {
          surface: "#E7F0FA",   // Backgrounds / surfaces
          secondary: "#7BA4D0", // Secondary elements
          primary: "#2E5E99",   // Primary actions
          btn: "#586ab1",       // Buttons
        },      },
    },
  },
  plugins: [],
}
