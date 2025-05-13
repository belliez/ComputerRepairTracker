import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface Currency {
  code: string;
  name: string;
  symbol: string;
  isDefault: boolean;
}

interface CurrencySymbolProps {
  currencyCode?: string;
  className?: string;
}

export function CurrencySymbol({ currencyCode, className = "mr-1" }: CurrencySymbolProps) {
  // Get all currencies and default currency
  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ['/api/settings/currencies'],
  });
  
  const { data: defaultCurrency } = useQuery<Currency>({
    queryKey: ['/api/settings/currencies/default'],
  });

  // State to track the selected currency symbol
  const [symbol, setSymbol] = useState<string>('');

  useEffect(() => {
    console.log("CURRENCY SYMBOL DEBUG: Looking for symbol for currency code:", currencyCode);
    console.log("CURRENCY SYMBOL DEBUG: Available currencies:", currencies);
    console.log("CURRENCY SYMBOL DEBUG: Default currency:", defaultCurrency);
    
    // If a specific currency code is provided, use that
    if (currencyCode && currencies) {
      const selectedCurrency = currencies.find(c => c.code === currencyCode);
      console.log("CURRENCY SYMBOL DEBUG: Selected currency:", selectedCurrency);
      if (selectedCurrency?.symbol) {
        console.log("CURRENCY SYMBOL DEBUG: Setting symbol to:", selectedCurrency.symbol);
        setSymbol(selectedCurrency.symbol);
        return;
      }
    }
    
    // Otherwise use the default currency
    if (defaultCurrency?.symbol) {
      console.log("CURRENCY SYMBOL DEBUG: Setting symbol to default:", defaultCurrency.symbol);
      setSymbol(defaultCurrency.symbol);
    }
  }, [currencies, defaultCurrency, currencyCode]);

  return <span className={className}>{symbol}</span>;
}