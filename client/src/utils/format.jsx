// Utility function to format currency in compact form
export const formatCurrencyCompact = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Ksh 0";
  }

  const numAmount = Number(amount);
  
  // For large amounts, use K, M, B notation
  if (numAmount >= 1000000000) {
    return `Ksh ${(numAmount / 1000000000).toFixed(1)}B`;
  }
  
  if (numAmount >= 1000000) {
    return `Ksh ${(numAmount / 1000000).toFixed(1)}M`;
  }
  
  if (numAmount >= 1000) {
    return `Ksh ${(numAmount / 1000).toFixed(1)}K`;
  }

  return `Ksh ${numAmount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

// Alternative: Format with full thousands separators
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Ksh 0";
  }

  const numAmount = Number(amount);
  
  return `Ksh ${numAmount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

// Format percentage
export const formatPercentage = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return "0%";
  }
  
  return `${Math.round(value)}%`;
};

// Format number with commas
export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) {
    return "0";
  }
  
  return Number(num).toLocaleString("en-KE");
};