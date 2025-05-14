import { sql } from "drizzle-orm";
import { db } from "../db";
import { currencies, organizations, taxRates } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";

/**
 * Migration to ensure all organizations have currencies and tax rates
 * This adds default currency and tax rate records for any organizations that don't have them
 */
export async function fixCurrenciesAndTaxRates() {
  console.log("Running migration to fix currencies and tax rates for all organizations...");
  
  try {
    // 1. First, get all organizations that exist in the system
    const orgs = await db.select().from(organizations);
    console.log(`Found ${orgs.length} organizations to check for currencies and tax rates`);
    
    // 2. Process each organization
    for (const org of orgs) {
      console.log(`Processing organization: ${org.id} - ${org.name}`);
      
      // Check if this organization has any currencies
      const orgCurrencies = await db.select()
        .from(currencies)
        .where(eq(currencies.organizationId, org.id));
      
      if (orgCurrencies.length === 0) {
        console.log(`Organization ${org.id} has no currencies, adding defaults...`);
        
        // Add default currencies
        await db.insert(currencies).values([
          { code: 'USD', name: 'US Dollar', symbol: '$', isDefault: true, organizationId: org.id },
          { code: 'EUR', name: 'Euro', symbol: '€', isDefault: false, organizationId: org.id },
          { code: 'GBP', name: 'British Pound', symbol: '£', isDefault: false, organizationId: org.id },
          { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', isDefault: false, organizationId: org.id },
          { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', isDefault: false, organizationId: org.id },
          { code: 'JPY', name: 'Japanese Yen', symbol: '¥', isDefault: false, organizationId: org.id },
        ]);
        
        console.log(`Added default currencies for organization ${org.id}`);
      } else {
        console.log(`Organization ${org.id} already has ${orgCurrencies.length} currencies`);
      }
      
      // Check if this organization has any tax rates
      const orgTaxRates = await db.select()
        .from(taxRates)
        .where(eq(taxRates.organizationId, org.id));
      
      if (orgTaxRates.length === 0) {
        console.log(`Organization ${org.id} has no tax rates, adding defaults...`);
        
        // Add default tax rates
        await db.insert(taxRates).values([
          { countryCode: 'US', regionCode: null, name: 'No Tax', rate: 0, isDefault: false, organizationId: org.id },
          { countryCode: 'US', regionCode: 'CA', name: 'California Sales Tax', rate: 7.25, isDefault: true, organizationId: org.id },
          { countryCode: 'US', regionCode: 'NY', name: 'New York Sales Tax', rate: 8.875, isDefault: false, organizationId: org.id },
          { countryCode: 'US', regionCode: 'TX', name: 'Texas Sales Tax', rate: 6.25, isDefault: false, organizationId: org.id },
          { countryCode: 'CA', regionCode: null, name: 'Canada GST', rate: 5, isDefault: false, organizationId: org.id },
          { countryCode: 'GB', regionCode: null, name: 'UK VAT', rate: 20, isDefault: false, organizationId: org.id },
          { countryCode: 'AU', regionCode: null, name: 'Australia GST', rate: 10, isDefault: false, organizationId: org.id },
        ]);
        
        console.log(`Added default tax rates for organization ${org.id}`);
      } else {
        console.log(`Organization ${org.id} already has ${orgTaxRates.length} tax rates`);
      }
    }
    
    console.log("Currency and tax rate migration completed successfully!");
    return true;
  } catch (error) {
    console.error("Error running currency and tax rate migration:", error);
    throw error;
  }
}