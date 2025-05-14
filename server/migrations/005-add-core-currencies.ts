import { sql } from "drizzle-orm";
import { db } from "../db";
import { currencies } from "@shared/schema";

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
    
    // If the column doesn't exist yet, add it
    if (columns.rows.length === 0) {
      console.log("Column 'is_core' doesn't exist yet. Adding it now...");
      
      // Add the isCore column to the currencies table
      await db.execute(sql`
        ALTER TABLE currencies 
        ADD COLUMN is_core BOOLEAN NOT NULL DEFAULT FALSE
      `);
      
      console.log("Added 'is_core' column to currencies table");
    }
    
    // 2. Mark global currencies as core currencies
    // We're using raw SQL here for maximum compatibility
    await db.execute(sql`
      UPDATE currencies 
      SET is_core = TRUE 
      WHERE organization_id IS NULL
    `);
    
    console.log("Core currencies migration completed successfully!");
    return true;
  } catch (error) {
    console.error("Error setting up core currencies:", error);
    // Return false instead of throwing to prevent app startup failure
    return false;
  }
}