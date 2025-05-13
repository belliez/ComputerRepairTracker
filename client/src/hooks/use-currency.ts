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
    queryKey: ['/api/public-settings/currencies/default'],
  });

  // Get all available currencies
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['/api/public-settings/currencies'],
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
    
    // Hard-code GBP for testing
    const currencyCode = 'GBP';
    
    return new Intl.NumberFormat('en-GB', {
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