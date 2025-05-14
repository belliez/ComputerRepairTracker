import { sql } from "drizzle-orm";
import { db } from "../db";
import { currencies, organizations } from "@shared/schema";
import { and, eq, isNull, ne, or } from "drizzle-orm";

/**
 * Migration to implement core currencies available to all organizations
 * This adds the isCore field to the currencies table and sets up the core currencies
 */
export async function setupCoreCurrencies() {
  console.log("Running migration to set up core currencies...");
  
  try {
    // 1. First, check if the isCore column exists
    const columns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'currencies' AND column_name = 'is_core'
    `);
    
    // If the column doesn't exist yet, schema hasn't been updated
    if (columns.rows.length === 0) {
      console.log("Column 'is_core' doesn't exist yet. Schema needs to be updated.");
      return false;
    }
    
    // 2. Get all existing currencies to see what we're working with
    const existingCurrencies = await db.select().from(currencies);
    console.log(`Found ${existingCurrencies.length} total currencies in the system`);
    
    // 3. Define the core currencies we want to ensure exist
    const coreCurrencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$', isDefault: true, isCore: true, organizationId: null },
      { code: 'EUR', name: 'Euro', symbol: '€', isDefault: false, isCore: true, organizationId: null },
      { code: 'GBP', name: 'British Pound', symbol: '£', isDefault: false, isCore: true, organizationId: null },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', isDefault: false, isCore: true, organizationId: null },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', isDefault: false, isCore: true, organizationId: null },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', isDefault: false, isCore: true, organizationId: null },
    ];
    
    // 4. Add each core currency if it doesn't exist
    for (const coreCurrency of coreCurrencies) {
      // Check if this core currency already exists
      const exists = existingCurrencies.some(c => 
        c.code === coreCurrency.code && 
        c.organizationId === null
      );
      
      if (exists) {
        console.log(`Core currency ${coreCurrency.code} already exists, updating it to be a core currency`);
        await db.update(currencies)
          .set({ isCore: true })
          .where(and(
            eq(currencies.code, coreCurrency.code),
            isNull(currencies.organizationId)
          ));
      } else {
        // Create the core currency
        console.log(`Creating core currency: ${coreCurrency.code}`);
        await db.insert(currencies).values(coreCurrency);
      }
    }
    
    // 5. Now update all organization-specific currencies to use the new format
    // This will help with the transition - we'll find any currencies that are duplicates of core currencies
    // (but organization-specific) and update their codes to use the special format:
    // Original code + "_" + organization ID (e.g., USD_1)
    
    // Get all organizations
    const orgs = await db.select().from(organizations);
    
    for (const org of orgs) {
      console.log(`Checking currencies for organization ${org.id}...`);
      
      // Get all currencies for this organization
      const orgCurrencies = await db.select()
        .from(currencies)
        .where(eq(currencies.organizationId, org.id));
      
      console.log(`Found ${orgCurrencies.length} currencies for organization ${org.id}`);
      
      for (const orgCurrency of orgCurrencies) {
        // Check if this currency is a duplicate of a core currency (same code)
        const isCoreDuplicate = coreCurrencies.some(c => c.code === orgCurrency.code);
        
        if (isCoreDuplicate) {
          // This is a duplicate of a core currency, update the code to use the special format
          const newCode = `${orgCurrency.code}_${org.id}`;
          console.log(`Updating currency ${orgCurrency.code} to ${newCode} for organization ${org.id}`);
          
          try {
            // First check if the new code doesn't already exist
            const exists = existingCurrencies.some(c => c.code === newCode);
            
            if (!exists) {
              await db.update(currencies)
                .set({ code: newCode })
                .where(and(
                  eq(currencies.code, orgCurrency.code),
                  eq(currencies.organizationId, org.id)
                ));
            } else {
              // The new code already exists, so this is a duplicate that we can remove
              console.log(`Currency ${newCode} already exists, removing duplicate ${orgCurrency.code}`);
              await db.delete(currencies)
                .where(and(
                  eq(currencies.code, orgCurrency.code),
                  eq(currencies.organizationId, org.id)
                ));
            }
          } catch (error) {
            console.error(`Error updating currency ${orgCurrency.code} for organization ${org.id}:`, error);
            // Continue with the next currency
          }
        }
      }
    }
    
    console.log("Core currencies migration completed successfully!");
    return true;
  } catch (error) {
    console.error("Error setting up core currencies:", error);
    // Return false instead of throwing to prevent app startup failure
    return false;
  }
}