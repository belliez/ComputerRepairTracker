import { useQuery } from "@tanstack/react-query";

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  isDefault: boolean;
};

export function useCurrency() {
  // Get the default currency
  const { data: defaultCurrency } = useQuery<Currency>({
    queryKey: ['/api/settings/currencies/default'],
  });

  // Get all available currencies
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['/api/settings/currencies'],
  });

  // Format a currency value based on the default currency
  const formatCurrency = (amount: number | string | null | undefined) => {
    // Handle undefined, null, or non-numeric values
    if (amount === undefined || amount === null) {
      return '-';
    }
    
    // Convert to number if it's a string
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Handle NaN values
    if (isNaN(numericAmount)) {
      return '-';
    }
    
    // Use the default currency from the API, or fallback to GBP
    const currencyCode = defaultCurrency?.code || 'GBP';
    const locale = currencyCode === 'GBP' ? 'en-GB' : 'en-US';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericAmount);
  };

  return {
    defaultCurrency,
    currencies,
    formatCurrency
  };
}