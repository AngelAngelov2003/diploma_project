export const formatCurrency = (value, currency = "EUR", locale = "en-IE") => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "€0";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: numericValue % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
};
