import { sql } from "drizzle-orm";
import { db } from "../db";

export async function runMultiTenancyMigration() {
  console.log("Running multi-tenancy migration...");
  
  try {
    // Create new tables first
    await db.execute(sql`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT,
        photo_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMP,
        is_admin BOOLEAN DEFAULT FALSE,
        stripe_customer_id TEXT
      );

      -- Organizations table
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        logo TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        owner_id TEXT NOT NULL REFERENCES users(id),
        stripe_subscription_id TEXT,
        subscription_status TEXT DEFAULT 'inactive',
        subscription_tier TEXT DEFAULT 'free',
        subscription_expires_at TIMESTAMP,
        max_users INTEGER DEFAULT 1,
        max_storage INTEGER DEFAULT 0,
        settings JSONB DEFAULT '{}',
        deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at TIMESTAMP
      );

      -- Organization Users table (junction)
      CREATE TABLE IF NOT EXISTS organization_users (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'member',
        invite_accepted BOOLEAN DEFAULT FALSE,
        invite_email TEXT,
        invite_token TEXT,
        invite_expires TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id, user_id)
      );

      -- Subscription Plans table
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        stripe_price_id TEXT NOT NULL,
        features JSONB DEFAULT '{}',
        tier TEXT NOT NULL,
        price INTEGER NOT NULL,
        interval TEXT NOT NULL DEFAULT 'month',
        max_users INTEGER NOT NULL DEFAULT 1,
        max_storage INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Add organization_id columns to existing tables
    await db.execute(sql`
      -- Add organization_id to customers
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS organization_id INTEGER;

      -- Add organization_id to devices
      ALTER TABLE devices
      ADD COLUMN IF NOT EXISTS organization_id INTEGER;

      -- Add organization_id to technicians
      ALTER TABLE technicians
      ADD COLUMN IF NOT EXISTS organization_id INTEGER;

      -- Add organization_id to repairs
      ALTER TABLE repairs
      ADD COLUMN IF NOT EXISTS organization_id INTEGER;

      -- Add organization_id to inventory_items
      ALTER TABLE inventory_items
      ADD COLUMN IF NOT EXISTS organization_id INTEGER;

      -- Add organization_id to quotes
      ALTER TABLE quotes
      ADD COLUMN IF NOT EXISTS organization_id INTEGER;

      -- Add organization_id to invoices
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS organization_id INTEGER;
    `);

    console.log("Multi-tenancy migration completed successfully!");
    return true;
  } catch (error) {
    console.error("Error running multi-tenancy migration:", error);
    throw error;
  }
}