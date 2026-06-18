/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {

      /* ─── Typography ──────────────────────────────────────── */
      fontFamily: {
        outfit: ["Outfit", "sans-serif"],
      },

      /* ─── Font sizes (rem-based, root = 10px) ─────────────── */
      fontSize: {
        "xs":   ["1.0rem", { lineHeight: "1.4" }],  /* 10px */
        "sm":   ["1.2rem", { lineHeight: "1.5" }],  /* 12px */
        "base": ["1.4rem", { lineHeight: "1.65" }], /* 14px */
        "md":   ["1.6rem", { lineHeight: "1.5" }],  /* 16px */
        "lg":   ["1.8rem", { lineHeight: "1.45" }], /* 18px */
        "xl":   ["2.0rem", { lineHeight: "1.4" }],  /* 20px */
        "2xl":  ["2.4rem", { lineHeight: "1.3" }],  /* 24px */
        "3xl":  ["3.2rem", { lineHeight: "1.2" }],  /* 32px */
        "4xl":  ["4.0rem", { lineHeight: "1.1" }],  /* 40px */
        "5xl":  ["4.8rem", { lineHeight: "1.05" }], /* 48px */
      },

      /* ─── Color palette — Forest Finance ──────────────────── */
      colors: {

        /* Brand scale */
        midnight:     "#0F1F17",
        "forest-deep":"#1A4A30",
        brand:        "#1A7A4A",
        mint:         "#5DCAA5",
        "brand-primary": "#1A7A4A",
        "brand-secondary": "#5DCAA5",

        /* Surfaces & backgrounds */
        page:         "#F7FAF8",
        surface:      "#EAF4EE",
        card:         "#FFFFFF",
        sidebar:      "#0F1F17",

        /* Text */
        heading:      "#1A3028",
        body:         "#2A4A38",
        muted:        "#5A8068",

        /* Borders */
        border:       "#D1DDD6",
        "border-light":"#E0EBE4",

        /* Status — keep granular for badge/tag usage */
        success: {
          fill: "#C8EDDA",
          text: "#145C34",
          DEFAULT: "#1A7A4A",
        },
        warning: {
          fill: "#FDE8C0",
          text: "#7A4C0A",
          DEFAULT: "#E8930A",
        },
        danger: {
          fill: "#FCDCDC",
          text: "#8A1A1A",
          DEFAULT: "#C62828",
        },
        info: {
          fill: "#DFF0FB",
          text: "#0A4A6E",
          DEFAULT: "#0E7DB5",
        },

        /* Semantic aliases (for bg-primary, text-primary etc.) */
        primary:    "#1A7A4A",
        secondary:  "#5DCAA5",
        accent:     "#5DCAA5",
        background: "#F7FAF8",
        text:       "#2A4A38",
      },

      /* ─── Border radius ────────────────────────────────────── */
      borderRadius: {
        sm:   "4px",
        md:   "8px",
        lg:   "12px",
        xl:   "16px",
        pill: "9999px",
      },

      /* ─── Spacing extras ───────────────────────────────────── */
      spacing: {
        "0.5": "0.5px",   /* hairline borders */
        "4.5": "1.8rem",
        "13":  "5.2rem",
        "15":  "6.0rem",
        "18":  "7.2rem",
      },

      /* ─── Box shadows ──────────────────────────────────────── */
      boxShadow: {
        card:    "0 1px 4px rgba(15,31,23,0.08), 0 0 0 0.5px rgba(209,221,214,0.8)",
        modal:   "0 8px 32px rgba(15,31,23,0.16)",
        btn:     "0 1px 2px rgba(26,122,74,0.2)",
      },

      /* ─── Transitions ──────────────────────────────────────── */
      transitionDuration: {
        DEFAULT: "150ms",
      },
      transitionTimingFunction: {
        DEFAULT: "ease",
      },
    },
  },
  plugins: [],
}