import { sql } from "drizzle-orm";
import { db } from "../db";

export async function runSettingsOrganizationMigration() {
  console.log("Running settings organization columns migration...");
  
  try {
    // Add organization_id columns to settings tables
    await db.execute(sql`
      -- Add organization_id to currencies
      ALTER TABLE currencies
      ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);

      -- Add organization_id to tax_rates
      ALTER TABLE tax_rates
      ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);
    `);

    console.log("Settings organization columns migration completed successfully!");
    return true;
  } catch (error) {
    console.error("Error running settings organization columns migration:", error);
    throw error;
  }
}