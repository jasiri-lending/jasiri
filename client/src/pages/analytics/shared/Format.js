export const formatCurrencyCompact = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Ksh 0";
  }

  const numAmount = Number(amount);
  
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