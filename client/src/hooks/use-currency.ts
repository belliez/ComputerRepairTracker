import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getAuthToken } from "../lib/auth";

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  isDefault: boolean;
};

export function useCurrency() {
  // Use useState to store currencies and defaultCurrency
  const [defaultCurrency, setDefaultCurrency] = useState<Currency | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // Function to directly fetch currency data from the API without using React Query
  const fetchCurrencyData = async () => {
    console.log("CURRENCY: Directly fetching currency data from API");
    
    // Get current organization ID from localStorage
    const currentOrgId = localStorage.getItem('currentOrganizationId') || '3';
    
    // Set up headers
    const headers: Record<string, string> = {
      'X-Debug-Client': 'RepairTrackerClient',
      'X-Organization-ID': currentOrgId, // Use the current organization ID from localStorage
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    // Add auth token if available
    const authToken = getAuthToken();
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    try {
      // Fetch all currencies
      const currenciesResponse = await fetch('/api/settings/currencies', {
        method: 'GET',
        headers,
        cache: 'no-store'
      });
      
      if (currenciesResponse.ok) {
        const allCurrencies = await currenciesResponse.json();
        console.log("CURRENCY: Successfully fetched", allCurrencies.length, "currencies");
        setCurrencies(allCurrencies);
        
        // Find the default currency in the list
        const defaultFromList = allCurrencies.find((c: Currency) => c.isDefault);
        if (defaultFromList) {
          console.log("CURRENCY: Found default currency in list:", defaultFromList.code);
          setDefaultCurrency(defaultFromList);
        } else {
          // If no default in the list, try to fetch it directly
          const defaultResponse = await fetch('/api/settings/currencies/default', {
            method: 'GET',
            headers,
            cache: 'no-store'
          });
          
          if (defaultResponse.ok) {
            const defaultData = await defaultResponse.json();
            console.log("CURRENCY: Fetched default currency directly:", defaultData?.code);
            setDefaultCurrency(defaultData);
          }
        }
      } else {
        console.error("CURRENCY: Failed to fetch currencies", currenciesResponse.status);
      }
    } catch (error) {
      console.error("CURRENCY: Error fetching currency data:", error);
    }
    
    // Update last refresh time
    setLastRefreshTime(Date.now());
  };
  
  // Fetch currency data on component mount and when explicitly refreshed
  useEffect(() => {
    fetchCurrencyData();
    
    // Set up interval to refresh every 15 seconds
    const intervalId = setInterval(() => {
      fetchCurrencyData();
    }, 15000);
    
    // Also refresh on window focus
    const handleFocus = () => {
      console.log("CURRENCY: Window focused, refreshing currency data");
      fetchCurrencyData();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Clean up
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  // Function to explicitly refresh all currency data
  const refreshCurrencyData = async () => {
    console.log("CURRENCY: Explicitly refreshing all currency data");
    await fetchCurrencyData();
    return true;
  };

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
    
    // Always try to get the default currency from most recently fetched data
    const currentDefaultCurrency = currencies.find(c => c.isDefault);
    
    // Use custom currency code if provided, otherwise use default from all currencies (most reliable),
    // then try the direct default currency endpoint, and finally fall back to EUR
    let currencyCode = customCurrencyCode || 
                        currentDefaultCurrency?.code || 
                        defaultCurrency?.code || 
                        'EUR';
    
    // Handle special currency codes with organization IDs (like USD_3) or _CORE suffix
    // Extract the base currency code (USD, EUR, etc.) from our special format
    if (currencyCode && currencyCode.includes('_')) {
      // Split by underscore and take the first part as the standard currency code
      currencyCode = currencyCode.split('_')[0];
      console.log(`CURRENCY FORMAT: Converted code from ${currencyCode}_* to ${currencyCode}`);
    }
    
    // Ensure it's a valid 3-letter currency code for Intl.NumberFormat
    if (!currencyCode || currencyCode.length !== 3) {
      // Fallback to a safe default
      currencyCode = 'USD';
    }
    
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
    
    // Log detailed information about which currency is being used
    console.log("CURRENCY FORMAT: Using", currencyCode, 
      "with locale", locale, 
      "| Default from list:", currentDefaultCurrency?.code,
      "| API default:", defaultCurrency?.code,
      "| Last refresh:", new Date(lastRefreshTime).toLocaleTimeString());
    
    // Set decimal digit options based on currency
    const minimumFractionDigits = currencyCode === 'JPY' ? 0 : 2;
    const maximumFractionDigits = currencyCode === 'JPY' ? 0 : 2;
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits,
        maximumFractionDigits
      }).format(numericAmount);
    } catch (error) {
      console.error(`Currency formatting error with code "${currencyCode}":`, error);
      // Fallback to simple formatting with the currency symbol as a prefix
      const symbol = 
        currencyCode === 'GBP' ? '£' : 
        currencyCode === 'EUR' ? '€' : 
        currencyCode === 'JPY' ? '¥' : '$';
      return `${symbol}${numericAmount.toFixed(maximumFractionDigits)}`;
    }
  };

  return {
    defaultCurrency: defaultCurrency || undefined,
    currencies,
    formatCurrency,
    refreshCurrencyData,
    lastRefreshTime
  };
}