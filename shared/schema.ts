import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  notes: text("notes"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
});

// Devices
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  type: text("type").notNull(), // laptop, desktop, tablet, etc.
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  serialNumber: text("serial_number"),
  password: text("password"),
  condition: text("condition"),
  accessories: text("accessories"),
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

// Extended types for the frontend
export type RepairWithRelations = Repair & {
  customer: Customer;
  device: Device;
  technician?: Technician;
  items?: RepairItem[];
  quote?: Quote;
  invoice?: Invoice;
};
