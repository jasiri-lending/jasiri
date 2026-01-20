// Table.jsx
import React from 'react';
import { theme, typography } from './theme';
import Button from './button';

export const Table = ({
  data = [],
  columns = [],
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  striped = true,
  hoverable = true,
  compact = false,
  className = '',
  ...props
}) => {
  const containerStyle = {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    boxShadow: theme.shadows.sm,
    border: `1px solid ${theme.colors.neutral[200]}`,
    width: '100%'
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: theme.typography.fontFamily
  };

  const thStyle = {
    backgroundColor: theme.colors.neutral[50],
    padding: compact ? theme.spacing.sm : theme.spacing.md,
    textAlign: 'left',
    fontWeight: typography.tableHeader.fontWeight,
    fontSize: typography.tableHeader.fontSize,
    color: theme.colors.neutral[700],
    borderBottom: `2px solid ${theme.colors.neutral[200]}`,
    whiteSpace: 'nowrap',
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  };

  const tdStyle = {
    padding: compact ? theme.spacing.sm : theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.neutral[100]}`,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.neutral[800],
    verticalAlign: 'middle'
  };

  const trStyle = (index) => ({
    backgroundColor: striped && index % 2 === 0 ? theme.colors.neutral[50] : 'white',
    transition: hoverable ? `background-color ${theme.transitions.fast}` : 'none',
    cursor: onRowClick ? 'pointer' : 'default',
    '&:hover': hoverable ? {
      backgroundColor: theme.colors.neutral[100]
    } : {}
  });

  if (loading) {
    return (
      <div style={{ ...containerStyle, padding: theme.spacing.xl, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', marginBottom: theme.spacing.md }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth="2"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
        </div>
        <p style={{ color: theme.colors.neutral[600], margin: 0 }}>
          Loading data...
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ ...containerStyle, padding: theme.spacing.xl, textAlign: 'center' }}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke={theme.colors.neutral[400]}
          strokeWidth="1.5"
          style={{ marginBottom: theme.spacing.sm }}
        >
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p style={{ color: theme.colors.neutral[600], margin: 0 }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle} className={className} {...props}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key || index}
                style={{
                  ...thStyle,
                  width: column.width || 'auto',
                  textAlign: column.align || 'left'
                }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              style={trStyle(rowIndex)}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((column, colIndex) => {
                const cellValue = column.render 
                  ? column.render(row[column.dataIndex], row, rowIndex)
                  : row[column.dataIndex];

                const isNumeric = column.dataType === 'numeric' || column.dataType === 'currency';
                
                return (
                  <td
                    key={colIndex}
                    style={{
                      ...tdStyle,
                      textAlign: column.align || (isNumeric ? 'right' : 'left'),
                      fontWeight: isNumeric ? typography.numeric.fontWeight : 'normal',
                      fontVariantNumeric: isNumeric ? 'tabular-nums' : 'normal',
                      color: isNumeric ? theme.colors.authority : theme.colors.neutral[800]
                    }}
                  >
                    {column.dataType === 'currency' && typeof cellValue === 'number' 
                      ? `KSh ${cellValue.toLocaleString()}`
                      : cellValue}
                    {column.dataType === 'status' && (
                      <StatusBadge status={cellValue} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Status Badge Component for Table
const StatusBadge = ({ status }) => {
  const statusConfig = {
    successful: {
      color: theme.colors.success[500],
      bgColor: theme.colors.success[100],
      label: 'Successful'
    },
    pending: {
      color: theme.colors.warning[500],
      bgColor: theme.colors.warning[100],
      label: 'Pending'
    },
    suspense: {
      color: theme.colors.warning[500],
      bgColor: theme.colors.warning[100],
      label: 'Suspense'
    },
    failed: {
      color: theme.colors.error[500],
      bgColor: theme.colors.error[100],
      label: 'Failed'
    },
    reconciled: {
      color: theme.colors.success[500],
      bgColor: theme.colors.success[100],
      label: 'Reconciled'
    },
    archived: {
      color: theme.colors.neutral[500],
      bgColor: theme.colors.neutral[100],
      label: 'Archived'
    },
    applied: {
      color: theme.colors.success[500],
      bgColor: theme.colors.success[100],
      label: 'Applied'
    }
  };

  const config = statusConfig[status?.toLowerCase()] || {
    color: theme.colors.neutral[500],
    bgColor: theme.colors.neutral[100],
    label: status
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        borderRadius: theme.borderRadius.full,
        backgroundColor: config.bgColor,
        color: config.color,
        fontSize: theme.typography.sizes.xs,
        fontWeight: typography.button.fontWeight,
        lineHeight: 1
      }}
    >
      {config.label}
    </span>
  );
};

// Table Search Component
export const TableSearch = ({ placeholder = "Search...", value, onChange }) => {
  return (
    <div style={{ position: 'relative', maxWidth: '320px' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          padding: `${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} 40px`,
          borderRadius: theme.borderRadius.md,
          border: `1px solid ${theme.colors.neutral[300]}`,
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.base,
          color: theme.colors.neutral[800],
          backgroundColor: 'white',
          transition: `border-color ${theme.transitions.normal}`,
          '&:focus': {
            outline: 'none',
            borderColor: theme.colors.primary,
            boxShadow: `0 0 0 3px ${theme.colors.primary}20`
          }
        }}
      />
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={theme.colors.neutral[400]}
        strokeWidth="2"
        style={{
          position: 'absolute',
          left: theme.spacing.md,
          top: '50%',
          transform: 'translateY(-50%)'
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    </div>
  );
};

// Table Pagination Component
export const TablePagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  pageSize,
  totalItems 
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderTop: `1px solid ${theme.colors.neutral[200]}`,
      backgroundColor: theme.colors.neutral[50]
    }}>
      <div style={{ color: theme.colors.neutral[600], fontSize: theme.typography.sizes.sm }}>
        Showing <strong>{Math.min((currentPage - 1) * pageSize + 1, totalItems)}</strong> to{' '}
        <strong>{Math.min(currentPage * pageSize, totalItems)}</strong> of{' '}
        <strong>{totalItems}</strong> entries
      </div>
      <div style={{ display: 'flex', gap: theme.spacing.xs }}>
        <Button
          variant="ghost"
          size="small"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </Button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          
          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'primary' : 'ghost'}
              size="small"
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="small"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default Table;