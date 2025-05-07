import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique ticket number for repairs
 * Format: RT-YYMMDDHHMM (RT prefix, followed by date and time)
 */
export function generateTicketNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().substring(2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  const randomDigits = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  
  return `RT-${year}${month}${day}${randomDigits}`;
}

/**
 * Format currency with the given locale and currency code
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD', locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Helper to safely access nested properties in objects without errors
 */
export function safeGet(obj: any, path: string, defaultValue: any = null) {
  try {
    const pathParts = path.split('.');
    let current = obj;
    for (const part of pathParts) {
      if (current === null || current === undefined) return defaultValue;
      current = current[part];
    }
    return current === undefined ? defaultValue : current;
  } catch (error) {
    console.error(`Error accessing path ${path}:`, error);
    return defaultValue;
  }
}