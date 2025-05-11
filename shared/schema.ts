import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json, primaryKey, real, varchar, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id"), // Make nullable for backward compatibility
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  notes: text("notes"),
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  deleted: true,
  deletedAt: true,
});

// Devices
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id"), // Make nullable for backward compatibility
  customerId: integer("customer_id").notNull().references(() => customers.id),
  type: text("type").notNull(), // laptop, desktop, tablet, etc.
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  serialNumber: text("serial_number"),
  password: text("password"),
  condition: text("condition"),
  accessories: text("accessories"),
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
});

// Technicians
export const technicians = pgTable("technicians", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  role: text("role").notNull(), // senior technician, hardware specialist, etc.
  specialty: text("specialty"),
  isActive: boolean("is_active").default(true),
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertTechnicianSchema = createInsertSchema(technicians).omit({
  id: true,
});

// Parts/Inventory
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  sku: text("sku"),
  price: doublePrecision("price").notNull(),
  cost: doublePrecision("cost"),
  quantity: integer("quantity").default(0),
  location: text("location"),
  supplier: text("supplier"),
  minLevel: integer("min_level").default(1),
  isActive: boolean("is_active").default(true),
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
});

// Repair Tickets
export const repairStatuses = [
  "intake",
  "diagnosing",
  "awaiting_approval",
  "parts_ordered",
  "in_repair",
  "ready_for_pickup",
  "completed",
  "on_hold",
  "cancelled",
] as const;

export const repairs = pgTable("repairs", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  deviceId: integer("device_id").references(() => devices.id), // Made optional by removing .notNull()
  technicianId: integer("technician_id").references(() => technicians.id),
  status: text("status").$type<(typeof repairStatuses)[number]>().notNull().default("intake"),
  issue: text("issue").notNull(),
  notes: text("notes"),
  intakeDate: timestamp("intake_date").notNull().defaultNow(),
  estimatedCompletionDate: timestamp("estimated_completion_date"),
  actualCompletionDate: timestamp("actual_completion_date"),
  priorityLevel: integer("priority_level").default(3), // 1-5, 1 being highest
  isUnderWarranty: boolean("is_under_warranty").default(false),
  diagnosticNotes: text("diagnostic_notes"),
  customerApproval: boolean("customer_approval"),
  totalCost: doublePrecision("total_cost"),
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

// First create the base schema
const baseInsertRepairSchema = createInsertSchema(repairs).omit({
  id: true,
  actualCompletionDate: true,
  customerApproval: true,
  totalCost: true,
});

// Then extend it to handle the date conversion
export const insertRepairSchema = baseInsertRepairSchema.extend({
  // Override estimatedCompletionDate to accept null or undefined
  estimatedCompletionDate: z.union([
    z.null(),
    z.undefined(),
    z.date(),
    z.string().transform(val => {
      try {
        return new Date(val);
      } catch (e) {
        return null;
      }
    })
  ])
});

// Repair Items (parts or services added to a repair)
export const repairItems = pgTable("repair_items", {
  id: serial("id").primaryKey(),
  repairId: integer("repair_id").notNull().references(() => repairs.id),
  inventoryItemId: integer("inventory_item_id").references(() => inventoryItems.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: doublePrecision("unit_price").notNull(),
  itemType: text("item_type").notNull(), // 'part' or 'service'
  isCompleted: boolean("is_completed").default(false),
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertRepairItemSchema = createInsertSchema(repairItems).omit({
  id: true,
});

// Quotes
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  repairId: integer("repair_id").notNull().references(() => repairs.id),
  quoteNumber: text("quote_number").notNull().unique(),
  dateCreated: timestamp("date_created").notNull().defaultNow(),
  expirationDate: timestamp("expiration_date"),
  subtotal: doublePrecision("subtotal").notNull(),
  tax: doublePrecision("tax"),
  total: doublePrecision("total").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  notes: text("notes"),
  currencyCode: text("currency_code").default("USD").references(() => currencies.code),
  taxRateId: integer("tax_rate_id").references(() => taxRates.id),
  itemIds: json("item_ids").default('[]'), // JSON array to store the IDs of items associated with this quote (legacy)
  itemsData: text("items_data"), // JSON string to store complete item data including custom items
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Create a base insert schema
const baseQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
});

// Create a custom schema with proper date transformations
export const insertQuoteSchema = baseQuoteSchema.extend({
  dateCreated: z.coerce.date().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  repairId: integer("repair_id").notNull().references(() => repairs.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  dateIssued: timestamp("date_issued").notNull().defaultNow(),
  datePaid: timestamp("date_paid"),
  subtotal: doublePrecision("subtotal").notNull(),
  tax: doublePrecision("tax"),
  total: doublePrecision("total").notNull(),
  status: text("status").notNull().default("unpaid"), // unpaid, partial, paid
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  currencyCode: text("currency_code").default("USD").references(() => currencies.code),
  taxRateId: integer("tax_rate_id").references(() => taxRates.id),
  itemIds: json("item_ids").default('[]'), // JSON array to store the IDs of items associated with this invoice (legacy)
  itemsData: text("items_data"), // JSON string to store complete item data including custom items
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Create a base insert schema for invoices
const baseInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  datePaid: true,
});

// Create a custom schema with proper date transformations
export const insertInvoiceSchema = baseInvoiceSchema.extend({
  dateIssued: z.coerce.date().optional(),
});

// Define TypeScript types for the database models
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export type Technician = typeof technicians.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

export type Repair = typeof repairs.$inferSelect;
export type InsertRepair = z.infer<typeof insertRepairSchema>;

export type RepairItem = typeof repairItems.$inferSelect;
export type InsertRepairItem = z.infer<typeof insertRepairItemSchema>;

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// System Settings
export const currencies = pgTable("currencies", {
  code: text("code").notNull().primaryKey(), // Like USD, EUR, GBP
  name: text("name").notNull(), // US Dollar, Euro, British Pound
  symbol: text("symbol").notNull(), // $, €, £
  isDefault: boolean("is_default").default(false),
  // No organization_id because currencies are global
});

export const insertCurrencySchema = createInsertSchema(currencies);

// Tax rates for different regions
export const taxRates = pgTable("tax_rates", {
  id: serial("id").primaryKey(),
  countryCode: text("country_code"), // US, GB, etc (optional for organization-specific settings)
  regionCode: text("region_code"), // State/province code like CA, TX, etc
  name: text("name").notNull(), // Sales Tax, VAT
  rate: doublePrecision("rate").notNull(), // 0.07 for 7%
  isDefault: boolean("is_default").default(false),
  // No organization_id because tax rates are global
});

export const insertTaxRateSchema = createInsertSchema(taxRates).omit({
  id: true,
});

// Extended types for the frontend
export type RepairWithRelations = Repair & {
  customer: Customer;
  device: Device;
  technician?: Technician;
  items?: RepairItem[];
  quote?: Quote;
  invoice?: Invoice;
};

// Define new types
export type Currency = typeof currencies.$inferSelect;
export type InsertCurrency = z.infer<typeof insertCurrencySchema>;

export type TaxRate = typeof taxRates.$inferSelect;
export type InsertTaxRate = z.infer<typeof insertTaxRateSchema>;

// Multi-tenancy tables
// Users table to store authentication information
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Firebase UID
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
  isAdmin: boolean("is_admin").default(false),
  stripeCustomerId: text("stripe_customer_id"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  stripeCustomerId: true,
});

// Organizations table (each user can be part of multiple organizations)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("inactive"), // "active", "inactive", "past_due", "canceled", "trialing"
  subscriptionTier: text("subscription_tier").default("free"), // "free", "basic", "premium", "enterprise"
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  maxUsers: integer("max_users").default(1),
  maxStorage: integer("max_storage").default(0), // in MB
  settings: json("settings").default({}),
  deleted: boolean("deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stripeSubscriptionId: true,
  subscriptionStatus: true,
  subscriptionTier: true,
  subscriptionExpiresAt: true,
  maxUsers: true,
  maxStorage: true,
  settings: true,
  deleted: true,
  deletedAt: true,
});

// OrganizationUser - junction table for many-to-many relationship between users and organizations
export const organizationUsers = pgTable("organization_users", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"), // "owner", "admin", "member"
  inviteAccepted: boolean("invite_accepted").default(false),
  inviteEmail: text("invite_email"),
  inviteToken: text("invite_token"),
  inviteExpires: timestamp("invite_expires"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    userOrgIdx: primaryKey(table.organizationId, table.userId),
  };
});

export const insertOrganizationUserSchema = createInsertSchema(organizationUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Subscription Plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  stripePriceId: text("stripe_price_id").notNull(),
  features: json("features").default({}),
  tier: text("tier").notNull(), // "free", "basic", "premium", "enterprise"
  price: integer("price").notNull(), // in cents
  interval: text("interval").notNull().default("month"), // "month", "year"
  maxUsers: integer("max_users").notNull().default(1),
  maxStorage: integer("max_storage").notNull().default(0), // in MB
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Add organizationId to all tables that need tenant isolation
export const customersRelations = relations(customers, ({ one }) => ({
  organization: one(organizations, {
    fields: [customers.id],
    references: [organizations.id],
  }),
}));

export const devicesRelations = relations(devices, ({ one }) => ({
  organization: one(organizations, {
    fields: [devices.id],
    references: [organizations.id],
  }),
}));

export const techniciansRelations = relations(technicians, ({ one }) => ({
  organization: one(organizations, {
    fields: [technicians.id],
    references: [organizations.id],
  }),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [inventoryItems.id],
    references: [organizations.id],
  }),
}));

export const repairsRelations = relations(repairs, ({ one }) => ({
  organization: one(organizations, {
    fields: [repairs.id],
    references: [organizations.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  organization: one(organizations, {
    fields: [quotes.id],
    references: [organizations.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoices.id],
    references: [organizations.id],
  }),
}));

export const currenciesRelations = relations(currencies, ({ one }) => ({
  organization: one(organizations, {
    fields: [currencies.code],
    references: [organizations.id],
  }),
}));

export const taxRatesRelations = relations(taxRates, ({ one }) => ({
  organization: one(organizations, {
    fields: [taxRates.id],
    references: [organizations.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(organizationUsers),
}));

export const usersRelations = relations(users, ({ many }) => ({
  organizations: many(organizationUsers),
}));

export const organizationUsersRelations = relations(organizationUsers, ({ one }) => ({
  user: one(users, {
    fields: [organizationUsers.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationUsers.organizationId],
    references: [organizations.id],
  }),
}));

// Types for multi-tenant models
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type OrganizationUser = typeof organizationUsers.$inferSelect;
export type InsertOrganizationUser = z.infer<typeof insertOrganizationUserSchema>;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
