// Button.jsx
import React from 'react';
import { theme, typography } from './theme';

const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  startIcon,
  endIcon,
  onClick,
  type = 'button',
  className = '',
  ...props
}, ref) => {
  
  const baseStyles = {
    fontFamily: theme.typography.fontFamily,
    fontWeight: typography.button.fontWeight,
    fontSize: typography.button.fontSize,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    transition: `all ${theme.transitions.normal} ease`,
    outline: 'none',
    position: 'relative',
    overflow: 'hidden',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap'
  };

  const variants = {
    primary: {
      backgroundColor: theme.colors.primary,
      color: 'white',
      '&:hover:not(:disabled)': {
        backgroundColor: theme.colors.authority,
        boxShadow: theme.shadows.md
      },
      '&:active:not(:disabled)': {
        transform: 'translateY(1px)'
      },
      '&:focus-visible': {
        boxShadow: `0 0 0 3px ${theme.colors.primary}40`
      }
    },
    secondary: {
      backgroundColor: theme.colors.secondary,
      color: 'white',
      '&:hover:not(:disabled)': {
        backgroundColor: '#5a8bc4',
        boxShadow: theme.shadows.md
      },
      '&:active:not(:disabled)': {
        transform: 'translateY(1px)'
      },
      '&:focus-visible': {
        boxShadow: `0 0 0 3px ${theme.colors.secondary}40`
      }
    },
    outline: {
      backgroundColor: 'transparent',
      color: theme.colors.primary,
      border: `1px solid ${theme.colors.primary}`,
      '&:hover:not(:disabled)': {
        backgroundColor: `${theme.colors.primary}10`,
        boxShadow: theme.shadows.sm
      },
      '&:active:not(:disabled)': {
        transform: 'translateY(1px)'
      },
      '&:focus-visible': {
        boxShadow: `0 0 0 3px ${theme.colors.primary}40`
      }
    },
    ghost: {
      backgroundColor: 'transparent',
      color: theme.colors.neutral[700],
      '&:hover:not(:disabled)': {
        backgroundColor: theme.colors.neutral[100]
      },
      '&:active:not(:disabled)': {
        backgroundColor: theme.colors.neutral[200]
      },
      '&:focus-visible': {
        boxShadow: `0 0 0 3px ${theme.colors.neutral[300]}`
      }
    },
    destructive: {
      backgroundColor: theme.colors.error[500],
      color: 'white',
      '&:hover:not(:disabled)': {
        backgroundColor: theme.colors.error[700],
        boxShadow: theme.shadows.md
      },
      '&:active:not(:disabled)': {
        transform: 'translateY(1px)'
      },
      '&:focus-visible': {
        boxShadow: `0 0 0 3px ${theme.colors.error[500]}40`
      }
    },
    success: {
      backgroundColor: theme.colors.success[500],
      color: 'white',
      '&:hover:not(:disabled)': {
        backgroundColor: theme.colors.success[700],
        boxShadow: theme.shadows.md
      },
      '&:active:not(:disabled)': {
        transform: 'translateY(1px)'
      },
      '&:focus-visible': {
        boxShadow: `0 0 0 3px ${theme.colors.success[500]}40`
      }
    }
  };

  const sizes = {
    small: {
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      height: '32px',
      fontSize: theme.typography.sizes.sm
    },
    medium: {
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      height: '40px',
      fontSize: theme.typography.sizes.base
    },
    large: {
      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
      height: '48px',
      fontSize: theme.typography.sizes.base
    }
  };

  const getStyles = () => {
    const variantStyles = variants[variant] || variants.primary;
    const sizeStyles = sizes[size] || sizes.medium;
    
    return {
      ...baseStyles,
      ...sizeStyles,
      ...variantStyles,
      '&:hover:not(:disabled)': variantStyles['&:hover:not(:disabled)'],
      '&:active:not(:disabled)': variantStyles['&:active:not(:disabled)'],
      '&:focus-visible': variantStyles['&:focus-visible']
    };
  };

  const style = getStyles();

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`fintech-button ${className}`}
      style={style}
      {...props}
    >
      {loading && (
        <span style={{ marginRight: theme.spacing.xs }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
        </span>
      )}
      {startIcon && <span className="button-icon-start">{startIcon}</span>}
      <span style={{ flex: 1, textAlign: 'center' }}>{children}</span>
      {endIcon && <span className="button-icon-end">{endIcon}</span>}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;