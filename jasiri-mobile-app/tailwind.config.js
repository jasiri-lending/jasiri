// tailwind.config.js
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A8A",     // Navy Blue – Trust & Stability
        accent: "#10B981",      // Emerald Green – Growth & Prosperity
        neutral: "#F3F4F6",     // Cool Gray – Minimalist Background
        highlight: "#FACC15",   // Gold – Premium Highlight
        text: "#111827",        // Default text color
        background: "#FFFFFF",  // Clean white background
        muted: "#d9e2e8",       // Subtle gray for secondary text
        brand: {
          surface: "#E7F0FA",   // Backgrounds / surfaces
          secondary: "#7BA4D0", // Secondary elements
          primary: "#2E5E99",   // Primary actions
          btn: "#586ab1",       // Buttons
        },
      },
      fontFamily: {
        // You can add custom fonts here if you've loaded them with expo-font
        body: ["Inter"],
        heading: ["Poppins"],
      },
    },
  },
  plugins: [],
};
