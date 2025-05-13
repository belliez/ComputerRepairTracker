import { useQuery } from "@tanstack/react-query";

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  isDefault: boolean;
};

export function useCurrency() {
  // Get the default currency - staleTime: 0 ensures it always refetches
  const { data: defaultCurrency } = useQuery<Currency>({
    queryKey: ['/api/settings/currencies/default'],
    staleTime: 0, // Don't use cache, always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Get all available currencies
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['/api/settings/currencies'],
    staleTime: 0, // Don't use cache, always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Format a currency value based on provided currency code or default currency
  const formatCurrency = (amount: number | string | null | undefined, customCurrencyCode?: string) => {
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
    
    // Use custom currency code if provided, otherwise use default currency from API, or fallback to JPY
    const currencyCode = customCurrencyCode || defaultCurrency?.code || 'JPY';
    
    // Choose locale based on the currency code
    let locale: string;
    switch(currencyCode) {
      case 'GBP':
        locale = 'en-GB';
        break;
      case 'JPY':
        locale = 'ja-JP';
        break;
      case 'EUR':
        locale = 'de-DE';
        break;
      default:
        locale = 'en-US';
    }
    
    console.log("FORMAT CURRENCY DEBUG: Using currency code:", currencyCode, "with locale:", locale);
    
    // Set decimal digit options based on currency
    const minimumFractionDigits = currencyCode === 'JPY' ? 0 : 2;
    const maximumFractionDigits = currencyCode === 'JPY' ? 0 : 2;
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits,
      maximumFractionDigits
    }).format(numericAmount);
  };

  return {
    defaultCurrency,
    currencies,
    formatCurrency
  };
}