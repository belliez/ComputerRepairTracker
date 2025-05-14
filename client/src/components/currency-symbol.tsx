import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface Currency {
  code: string;
  name: string;
  symbol: string;
  isDefault: boolean;
  isCore?: boolean;
  organizationId?: number | null;
}

interface CurrencySymbolProps {
  currencyCode?: string;
  className?: string;
}

export function CurrencySymbol({ currencyCode, className = "mr-1" }: CurrencySymbolProps) {
  // Get all currencies and default currency with no caching
  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ['/api/settings/currencies'],
    staleTime: 0, // Don't use cache, always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
  
  // Use our new fixed endpoint
  const { data: defaultCurrency } = useQuery<Currency>({
    queryKey: ['/api/settings/currencies/default-fixed'],
    staleTime: 0, // Don't use cache, always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // State to track the selected currency symbol
  const [symbol, setSymbol] = useState<string>('');

  useEffect(() => {
    console.log("CURRENCY SYMBOL DEBUG: Looking for symbol for currency code:", currencyCode);
    console.log("CURRENCY SYMBOL DEBUG: Available currencies:", currencies);
    console.log("CURRENCY SYMBOL DEBUG: Default currency from API:", defaultCurrency);
    
    // If a specific currency code is provided, use that
    if (currencyCode && currencies) {
      // First, look for exact match
      let selectedCurrency = currencies.find(c => c.code === currencyCode);
      
      // If no exact match and currencyCode doesn't have _CORE suffix, check for core version
      if (!selectedCurrency && !currencyCode.includes('_CORE')) {
        // Try to find a core currency that starts with the provided code
        selectedCurrency = currencies.find(c => 
          c.isCore && c.code.startsWith(currencyCode)
        );
      }
      
      // If the currency has _CORE suffix, also try with just the base code
      if (!selectedCurrency && currencyCode.includes('_CORE')) {
        const baseCode = currencyCode.split('_')[0];
        selectedCurrency = currencies.find(c => c.code === baseCode);
      }
      
      console.log("CURRENCY SYMBOL DEBUG: Selected currency by code:", selectedCurrency);
      
      if (selectedCurrency?.symbol) {
        console.log("CURRENCY SYMBOL DEBUG: Setting symbol to:", selectedCurrency.symbol);
        setSymbol(selectedCurrency.symbol);
        return;
      }
    }
    
    // If no specific code provided or not found, look for a currency marked as default in the array
    if (currencies && currencies.length > 0) {
      const defaultFromArray = currencies.find(c => c.isDefault === true);
      console.log("CURRENCY SYMBOL DEBUG: Default currency from array:", defaultFromArray);
      if (defaultFromArray?.symbol) {
        console.log("CURRENCY SYMBOL DEBUG: Setting symbol to default from array:", defaultFromArray.symbol);
        setSymbol(defaultFromArray.symbol);
        return;
      }
    }
    
    // Final fallback to default currency from API
    if (defaultCurrency?.symbol) {
      console.log("CURRENCY SYMBOL DEBUG: Setting symbol to default from API:", defaultCurrency.symbol);
      setSymbol(defaultCurrency.symbol);
    }
  }, [currencies, defaultCurrency, currencyCode]);

  return <span className={className}>{symbol}</span>;
}