import { sql } from 'drizzle-orm';
import { db } from '../db';

// This migration script fixes missing organization_id fields and data issues
export async function fixOrganizationRelations() {
  console.log('Running organization relations fix migration...');
  
  try {
    // Check if technicians table has organization_id column
    const techColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'technicians' AND column_name = 'organization_id'
    `);

    // Add organization_id column to technicians table if it doesn't exist
    if (techColumns.rows.length === 0) {
      console.log('Adding organization_id column to technicians table');
      await db.execute(sql`
        ALTER TABLE technicians 
        ADD COLUMN organization_id INTEGER
      `);
    }

    // Check if inventory_items table has organization_id column
    const inventoryColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_items' AND column_name = 'organization_id'
    `);

    // Add organization_id column to inventory_items table if it doesn't exist
    if (inventoryColumns.rows.length === 0) {
      console.log('Adding organization_id column to inventory_items table');
      await db.execute(sql`
        ALTER TABLE inventory_items 
        ADD COLUMN organization_id INTEGER
      `);
    }

    // Check if repairs table has organization_id column
    const repairsColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'repairs' AND column_name = 'organization_id'
    `);

    // Add organization_id column to repairs table if it doesn't exist
    if (repairsColumns.rows.length === 0) {
      console.log('Adding organization_id column to repairs table');
      await db.execute(sql`
        ALTER TABLE repairs 
        ADD COLUMN organization_id INTEGER
      `);
    }

    // Check if quotes table has organization_id column
    const quotesColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quotes' AND column_name = 'organization_id'
    `);

    // Add organization_id column to quotes table if it doesn't exist
    if (quotesColumns.rows.length === 0) {
      console.log('Adding organization_id column to quotes table');
      await db.execute(sql`
        ALTER TABLE quotes 
        ADD COLUMN organization_id INTEGER
      `);
    }

    // Check if invoices table has organization_id column
    const invoicesColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invoices' AND column_name = 'organization_id'
    `);

    // Add organization_id column to invoices table if it doesn't exist
    if (invoicesColumns.rows.length === 0) {
      console.log('Adding organization_id column to invoices table');
      await db.execute(sql`
        ALTER TABLE invoices 
        ADD COLUMN organization_id INTEGER
      `);
    }

    // Update technicians with NULL organization_id to use organization 1 (development org)
    console.log('Fixing technicians with NULL organization_id');
    await db.execute(sql`
      UPDATE technicians
      SET organization_id = 1
      WHERE organization_id IS NULL
    `);

    // Update inventory_items with NULL organization_id to use organization 1 (development org)
    console.log('Fixing inventory_items with NULL organization_id');
    await db.execute(sql`
      UPDATE inventory_items
      SET organization_id = 1
      WHERE organization_id IS NULL
    `);

    // Ensure all repairs have proper organization_id
    console.log('Fixing repairs with NULL organization_id');
    await db.execute(sql`
      UPDATE repairs
      SET organization_id = 1
      WHERE organization_id IS NULL
    `);

    // Ensure all quotes have proper organization_id
    console.log('Fixing quotes with NULL organization_id');
    await db.execute(sql`
      UPDATE quotes
      SET organization_id = 1
      WHERE organization_id IS NULL
    `);

    // Ensure all invoices have proper organization_id
    console.log('Fixing invoices with NULL organization_id');
    await db.execute(sql`
      UPDATE invoices
      SET organization_id = 1
      WHERE organization_id IS NULL
    `);

    console.log('Organization relations fix migration completed successfully!');
  } catch (error) {
    console.error('Error during organization relations fix migration:', error);
    throw error;
  }
}