import { db } from "../db";
import { currencies, quotes, invoices } from "@shared/schema";
import { eq, sql, and, isNull } from "drizzle-orm";

/**
 * Migration to create core currencies and clean up redundant ones
 */
export async function createCoreCurrencies() {
  console.log("Starting migration to create core currencies and clean up database");
  
  try {
    // 1. Create core currencies (these will be shared across all organizations)
    const coreCurrencies = [
      { code: "USD_CORE", name: "US Dollar", symbol: "$", isDefault: true, isCore: true, organizationId: null },
      { code: "EUR_CORE", name: "Euro", symbol: "€", isDefault: false, isCore: true, organizationId: null },
      { code: "GBP_CORE", name: "British Pound", symbol: "£", isDefault: false, isCore: true, organizationId: null },
      { code: "CAD_CORE", name: "Canadian Dollar", symbol: "C$", isDefault: false, isCore: true, organizationId: null },
      { code: "AUD_CORE", name: "Australian Dollar", symbol: "A$", isDefault: false, isCore: true, organizationId: null },
      { code: "JPY_CORE", name: "Japanese Yen", symbol: "¥", isDefault: false, isCore: true, organizationId: null }
    ];
    
    console.log(`Creating ${coreCurrencies.length} core currencies`);
    
    // Insert core currencies if they don't exist
    for (const currency of coreCurrencies) {
      // Check if the currency already exists (to avoid duplicate key errors)
      const exists = await db.select()
        .from(currencies)
        .where(eq(currencies.code, currency.code));
      
      if (exists.length === 0) {
        await db.insert(currencies).values(currency);
        console.log(`Created core currency: ${currency.code}`);
      } else {
        console.log(`Core currency ${currency.code} already exists, skipping`);
      }
    }
    
    // 2. Analyze existing currencies
    const allCurrencies = await db.select().from(currencies);
    console.log(`Found ${allCurrencies.length} total currencies in the database`);
    
    // Get all currencies with organization_id
    const orgCurrencies = allCurrencies.filter(c => c.organizationId !== null);
    console.log(`Found ${orgCurrencies.length} organization-specific currencies`);
    
    // Get all core currencies
    const existingCoreCurrencies = allCurrencies.filter(c => c.isCore === true);
    console.log(`Found ${existingCoreCurrencies.length} core currencies`);
    
    // 3. Create a mapping from organization currencies to equivalent core currencies
    const currencyMapping = {};
    for (const orgCurrency of orgCurrencies) {
      // Remove the _X suffix to get the base currency code
      const baseCurrencyCode = orgCurrency.code.split('_')[0];
      
      // Find the equivalent core currency
      const coreCurrency = existingCoreCurrencies.find(c => 
        c.code.startsWith(baseCurrencyCode) || c.code.includes(baseCurrencyCode + '_')
      );
      
      if (coreCurrency) {
        currencyMapping[orgCurrency.code] = coreCurrency.code;
        console.log(`Mapping ${orgCurrency.code} -> ${coreCurrency.code}`);
      } else {
        // If no matching core currency, map to USD_CORE as a fallback
        currencyMapping[orgCurrency.code] = 'USD_CORE';
        console.log(`No matching core currency for ${orgCurrency.code}, mapping to USD_CORE`);
      }
    }
    
    // 4. Get distinct organization IDs
    const orgIdsSet = new Set(orgCurrencies.map(c => c.organizationId));
    const orgIds = Array.from(orgIdsSet);
    console.log(`Found ${orgIds.length} distinct organizations with currencies: ${orgIds.join(', ')}`);
    
    // 5. For each organization, update quotes and invoices to use core currencies
    for (const orgId of orgIds) {
      console.log(`Processing organization ${orgId}`);
      
      // Get all currencies for this organization
      const orgCurrenciesList = allCurrencies.filter(c => c.organizationId === orgId);
      console.log(`Organization ${orgId} has ${orgCurrenciesList.length} currencies`);
      
      // Find the default currency for this organization
      const defaultCurrency = orgCurrenciesList.find(c => c.isDefault === true) || orgCurrenciesList[0];
      
      if (defaultCurrency) {
        console.log(`Organization ${orgId} default currency: ${defaultCurrency.code}`);
        const mappedCoreCode = currencyMapping[defaultCurrency.code] || 'USD_CORE';
        
        // 5.1 First, update any quotes using this organization's currencies
        for (const orgCurrency of orgCurrenciesList) {
          // Get quotes using this currency
          const quotesUsingCurrency = await db.select()
            .from(quotes)
            .where(eq(quotes.currencyCode, orgCurrency.code));
          
          if (quotesUsingCurrency.length > 0) {
            console.log(`Found ${quotesUsingCurrency.length} quotes using ${orgCurrency.code}`);
            
            // Update quotes to use the corresponding core currency
            const targetCoreCode = currencyMapping[orgCurrency.code] || mappedCoreCode;
            await db.update(quotes)
              .set({ currencyCode: targetCoreCode })
              .where(eq(quotes.currencyCode, orgCurrency.code));
            
            console.log(`Updated ${quotesUsingCurrency.length} quotes to use ${targetCoreCode}`);
          }
          
          // 5.2 Then, update any invoices using this currency
          const invoicesUsingCurrency = await db.select()
            .from(invoices)
            .where(eq(invoices.currencyCode, orgCurrency.code));
          
          if (invoicesUsingCurrency.length > 0) {
            console.log(`Found ${invoicesUsingCurrency.length} invoices using ${orgCurrency.code}`);
            
            // Update invoices to use the corresponding core currency
            const targetCoreCode = currencyMapping[orgCurrency.code] || mappedCoreCode;
            await db.update(invoices)
              .set({ currencyCode: targetCoreCode })
              .where(eq(invoices.currencyCode, orgCurrency.code));
            
            console.log(`Updated ${invoicesUsingCurrency.length} invoices to use ${targetCoreCode}`);
          }
        }
        
        // 5.3 Now, we can safely delete all the org-specific currencies
        for (const orgCurrency of orgCurrenciesList) {
          try {
            await db.delete(currencies).where(eq(currencies.code, orgCurrency.code));
            console.log(`Deleted currency ${orgCurrency.code} for organization ${orgId}`);
          } catch (error) {
            console.error(`Error deleting currency ${orgCurrency.code}:`, error.message);
            // Continue with other currencies
          }
        }
      } else {
        console.log(`Organization ${orgId} has no currencies to process`);
      }
    }
    
    // 6. Get final currency counts to confirm cleanup
    const finalCurrencies = await db.select().from(currencies);
    console.log(`Final currency count after cleanup: ${finalCurrencies.length}`);
    const finalOrgCurrencies = finalCurrencies.filter(c => c.organizationId !== null);
    console.log(`Final organization-specific currency count: ${finalOrgCurrencies.length}`);
    const finalCoreCurrencies = finalCurrencies.filter(c => c.isCore === true);
    console.log(`Final core currency count: ${finalCoreCurrencies.length}`);
    
    console.log("Core currencies migration completed successfully!");
  } catch (error) {
    console.error("Error during core currencies migration:", error);
    throw error;
  }
}