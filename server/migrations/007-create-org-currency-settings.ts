import { sql } from "drizzle-orm";
import { db } from "../db";

export async function createOrgCurrencySettings() {
  console.log("Running migration to create organization currency settings table");

  try {
    // Check if the table already exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'organization_currency_settings'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log("organization_currency_settings table already exists, skipping creation");
    } else {
      // Create the organization_currency_settings table
      await db.execute(sql`
        CREATE TABLE "organization_currency_settings" (
          "id" SERIAL PRIMARY KEY,
          "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id"),
          "currency_code" TEXT NOT NULL REFERENCES "currencies"("code"),
          "is_default" BOOLEAN DEFAULT false,
          "created_at" TIMESTAMP DEFAULT now() NOT NULL,
          "updated_at" TIMESTAMP DEFAULT now() NOT NULL,
          UNIQUE ("organization_id", "currency_code")
        )
      `);
      console.log("Created organization_currency_settings table successfully");
    }

    // Check for existing default currencies for each organization
    const organizations = await db.execute(sql`
      SELECT id FROM organizations WHERE deleted = false
    `);

    for (const org of organizations.rows) {
      const orgId = org.id;
      console.log(`Checking default currency for organization ${orgId}`);
      
      // Check if the organization has a default currency
      const defaultCurrency = await db.execute(sql`
        SELECT code FROM currencies 
        WHERE organization_id = ${orgId} AND is_default = true
      `);

      if (defaultCurrency.rows.length > 0) {
        const currencyCode = defaultCurrency.rows[0].code;
        console.log(`Organization ${orgId} has default currency: ${currencyCode}`);
      } else {
        // Check if there's a core default currency
        const coreDefault = await db.execute(sql`
          SELECT code FROM currencies 
          WHERE is_core = true AND is_default = true
        `);

        if (coreDefault.rows.length > 0) {
          const coreCurrencyCode = coreDefault.rows[0].code;
          console.log(`Using core default currency ${coreCurrencyCode} for organization ${orgId}`);

          // Check if the setting already exists
          const existingSetting = await db.execute(sql`
            SELECT id FROM organization_currency_settings
            WHERE organization_id = ${orgId} AND currency_code = ${coreCurrencyCode}
          `);

          if (existingSetting.rows.length > 0) {
            console.log(`Default currency setting already exists for organization ${orgId}, updating it`);
            await db.execute(sql`
              UPDATE organization_currency_settings
              SET is_default = true
              WHERE organization_id = ${orgId} AND currency_code = ${coreCurrencyCode}
            `);
          } else {
            // Create a setting for this organization to use the core default
            await db.execute(sql`
              INSERT INTO organization_currency_settings 
              (organization_id, currency_code, is_default)
              VALUES (${orgId}, ${coreCurrencyCode}, true)
            `);
            console.log(`Created default currency setting for organization ${orgId}`);
          }
        }
      }
    }

    console.log("Migration completed successfully");
    return true;
  } catch (error) {
    console.error("Error in migration:", error);
    return false;
  }
}