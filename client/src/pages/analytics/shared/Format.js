export const formatCurrencyCompact = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Ksh 0";
  }

  const numAmount = Number(amount);

  return `Ksh ${numAmount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};