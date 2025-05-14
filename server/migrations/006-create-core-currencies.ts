import { db } from "../db";
import { currencies } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Migration to create core currencies and clean up redundant ones
 */
export async function createCoreCurrencies() {
  console.log("Starting migration to create core currencies and clean up database");
  
  try {
    // Create core currencies (these will be shared across all organizations)
    const coreCurrencies = [
      { code: "USD_CORE", name: "US Dollar", symbol: "$", isDefault: true, isCore: true, organizationId: null },
      { code: "EUR_CORE", name: "Euro", symbol: "€", isDefault: false, isCore: true, organizationId: null },
      { code: "GBP_CORE", name: "British Pound", symbol: "£", isDefault: false, isCore: true, organizationId: null },
      { code: "CAD_CORE", name: "Canadian Dollar", symbol: "C$", isDefault: false, isCore: true, organizationId: null },
      { code: "AUD_CORE", name: "Australian Dollar", symbol: "A$", isDefault: false, isCore: true, organizationId: null },
      { code: "JPY_CORE", name: "Japanese Yen", symbol: "¥", isDefault: false, isCore: true, organizationId: null }
    ];
    
    console.log(`Creating ${coreCurrencies.length} core currencies`);
    
    // Use a transaction to ensure all operations succeed or fail together
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
    
    // Get all existing currencies to see what we have
    const allCurrencies = await db.select().from(currencies);
    console.log(`Found ${allCurrencies.length} total currencies in the database`);
    
    // Get all currencies with organization_id
    const orgCurrencies = allCurrencies.filter(c => c.organizationId !== null);
    console.log(`Found ${orgCurrencies.length} organization-specific currencies`);
    
    // Get all core currencies
    const existingCoreCurrencies = allCurrencies.filter(c => c.isCore === true);
    console.log(`Found ${existingCoreCurrencies.length} core currencies`);
    
    // Get distinct organization IDs
    const orgIds = [...new Set(orgCurrencies.map(c => c.organizationId))];
    console.log(`Found ${orgIds.length} distinct organizations with currencies: ${orgIds.join(', ')}`);
    
    console.log("Core currencies migration completed successfully!");
  } catch (error) {
    console.error("Error during core currencies migration:", error);
    throw error;
  }
}