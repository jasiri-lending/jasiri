// theme.jsx
export const theme = {
  // Color System (From your specification)
  colors: {
    // Primary Palette
    background: '#E7F0FA',
    secondary: '#7BA4D0',
    primary: '#2E5E99',
    authority: '#0D2440',
    
    // Semantic Colors
    success: {
      100: '#D1FAE5',
      500: '#10B981',
      700: '#047857'
    },
    warning: {
      100: '#FEF3C7',
      500: '#F59E0B',
      700: '#B45309'
    },
    error: {
      100: '#FEE2E2',
      500: '#EF4444',
      700: '#B91C1C'
    },
    neutral: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827'
    }
  },

  // Typography System
  typography: {
    fontFamily: "'Inter', sans-serif",
    weights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    sizes: {
      xs: '12px',    // Helper text
      sm: '14px',    // Labels, small text
      base: '16px',  // Body text, buttons
      md: '18px',    // Section titles
      lg: '24px',    // Page titles
      xl: '32px'     // Large displays
    }
  },

  // Spacing System (in rem units)
  spacing: {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '3rem',  // 48px
    '3xl': '4rem'   // 64px
  },

  // Border Radius
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  },

  // Animation
  transitions: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms'
  }
};

// Helper function to apply typography styles
export const typography = {
  pageTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    lineHeight: '1.2'
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    lineHeight: '1.3'
  },
  tableHeader: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  body: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.regular,
    lineHeight: '1.5'
  },
  button: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium
  },
  helper: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.regular
  },
  numeric: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    fontVariantNumeric: 'tabular-nums'
  }
};

// CSS-in-JS styles utility
export const createStyles = (styles) => styles;