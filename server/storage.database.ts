import { eq, and } from "drizzle-orm";
import { 
  Customer, 
  Device, 
  InventoryItem, 
  Invoice, 
  Quote, 
  Repair, 
  RepairItem, 
  Technician, 
  InsertCustomer, 
  InsertDevice, 
  InsertInventoryItem, 
  InsertInvoice, 
  InsertQuote, 
  InsertRepair, 
  InsertRepairItem, 
  InsertTechnician,
  repairStatuses,
  customers,
  devices,
  technicians,
  inventoryItems,
  repairs,
  repairItems,
  quotes,
  invoices,
} from "@shared/schema";
import { IStorage } from "./storage";
import { db } from "./db";

export class DatabaseStorage implements IStorage {
  // Customer methods
  async getCustomers(): Promise<Customer[]> {
    return db.select().from(customers);
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | undefined> {
    const [updatedCustomer] = await db
      .update(customers)
      .set(customerData)
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id));
    return !!result;
  }

  // Device methods
  async getDevices(): Promise<Device[]> {
    return db.select().from(devices);
  }

  async getDevicesByCustomer(customerId: number): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.customerId, customerId));
  }

  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const [newDevice] = await db.insert(devices).values(device).returning();
    return newDevice;
  }

  async updateDevice(id: number, deviceData: Partial<Device>): Promise<Device | undefined> {
    const [updatedDevice] = await db
      .update(devices)
      .set(deviceData)
      .where(eq(devices.id, id))
      .returning();
    return updatedDevice;
  }

  async deleteDevice(id: number): Promise<boolean> {
    const result = await db.delete(devices).where(eq(devices.id, id));
    return !!result;
  }

  // Technician methods
  async getTechnicians(): Promise<Technician[]> {
    return db.select().from(technicians);
  }

  async getTechnician(id: number): Promise<Technician | undefined> {
    const [technician] = await db.select().from(technicians).where(eq(technicians.id, id));
    return technician;
  }

  async createTechnician(technician: InsertTechnician): Promise<Technician> {
    const [newTechnician] = await db.insert(technicians).values(technician).returning();
    return newTechnician;
  }

  async updateTechnician(id: number, technicianData: Partial<Technician>): Promise<Technician | undefined> {
    const [updatedTechnician] = await db
      .update(technicians)
      .set(technicianData)
      .where(eq(technicians.id, id))
      .returning();
    return updatedTechnician;
  }

  async deleteTechnician(id: number): Promise<boolean> {
    const result = await db.delete(technicians).where(eq(technicians.id, id));
    return !!result;
  }

  // Inventory methods
  async getInventoryItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems);
  }

  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item;
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [newItem] = await db.insert(inventoryItems).values(item).returning();
    return newItem;
  }

  async updateInventoryItem(id: number, itemData: Partial<InventoryItem>): Promise<InventoryItem | undefined> {
    const [updatedItem] = await db
      .update(inventoryItems)
      .set(itemData)
      .where(eq(inventoryItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    const result = await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    return !!result;
  }

  async adjustInventoryQuantity(id: number, quantity: number): Promise<InventoryItem | undefined> {
    const item = await this.getInventoryItem(id);
    if (!item) {
      return undefined;
    }

    const currentQuantity = item.quantity || 0;
    const newQuantity = currentQuantity + quantity;

    return this.updateInventoryItem(id, { quantity: newQuantity });
  }

  // Repair methods
  async getRepairs(): Promise<Repair[]> {
    return db.select().from(repairs);
  }

  async getRepair(id: number): Promise<Repair | undefined> {
    const [repair] = await db.select().from(repairs).where(eq(repairs.id, id));
    return repair;
  }

  async getRepairByTicketNumber(ticketNumber: string): Promise<Repair | undefined> {
    const [repair] = await db.select().from(repairs).where(eq(repairs.ticketNumber, ticketNumber));
    return repair;
  }

  async getRepairsByCustomer(customerId: number): Promise<Repair[]> {
    return db.select().from(repairs).where(eq(repairs.customerId, customerId));
  }

  async getRepairsByTechnician(technicianId: number): Promise<Repair[]> {
    return db.select().from(repairs).where(eq(repairs.technicianId, technicianId));
  }

  async getRepairsByStatus(status: typeof repairStatuses[number]): Promise<Repair[]> {
    return db.select().from(repairs).where(eq(repairs.status, status));
  }

  async createRepair(repair: InsertRepair): Promise<Repair> {
    // Explicitly cast the status to the correct type
    const repairData = {
      ...repair,
      status: repair.status as (typeof repairStatuses)[number]
    };
    
    const [newRepair] = await db.insert(repairs).values(repairData).returning();
    return newRepair;
  }

  async updateRepair(id: number, repairData: Partial<Repair>): Promise<Repair | undefined> {
    const [updatedRepair] = await db
      .update(repairs)
      .set(repairData)
      .where(eq(repairs.id, id))
      .returning();
    return updatedRepair;
  }

  async deleteRepair(id: number): Promise<boolean> {
    const result = await db.delete(repairs).where(eq(repairs.id, id));
    return !!result;
  }

  // Repair Item methods
  async getRepairItems(repairId: number): Promise<RepairItem[]> {
    return db.select().from(repairItems).where(eq(repairItems.repairId, repairId));
  }

  async getRepairItem(id: number): Promise<RepairItem | undefined> {
    const [item] = await db.select().from(repairItems).where(eq(repairItems.id, id));
    return item;
  }

  async createRepairItem(item: InsertRepairItem): Promise<RepairItem> {
    const [newItem] = await db.insert(repairItems).values(item).returning();
    return newItem;
  }

  async updateRepairItem(id: number, itemData: Partial<RepairItem>): Promise<RepairItem | undefined> {
    const [updatedItem] = await db
      .update(repairItems)
      .set(itemData)
      .where(eq(repairItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteRepairItem(id: number): Promise<boolean> {
    const result = await db.delete(repairItems).where(eq(repairItems.id, id));
    return !!result;
  }

  // Quote methods
  async getQuotes(): Promise<Quote[]> {
    return db.select().from(quotes);
  }

  async getQuotesByRepair(repairId: number): Promise<Quote[]> {
    return db.select().from(quotes).where(eq(quotes.repairId, repairId));
  }

  async getQuote(id: number): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const [newQuote] = await db.insert(quotes).values(quote).returning();
    return newQuote;
  }

  async updateQuote(id: number, quoteData: Partial<Quote>): Promise<Quote | undefined> {
    const [updatedQuote] = await db
      .update(quotes)
      .set(quoteData)
      .where(eq(quotes.id, id))
      .returning();
    return updatedQuote;
  }

  async deleteQuote(id: number): Promise<boolean> {
    const result = await db.delete(quotes).where(eq(quotes.id, id));
    return !!result;
  }

  // Invoice methods
  async getInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices);
  }

  async getInvoicesByRepair(repairId: number): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.repairId, repairId));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async updateInvoice(id: number, invoiceData: Partial<Invoice>): Promise<Invoice | undefined> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set(invoiceData)
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return !!result;
  }

  // Extended functions
  async getRepairWithRelations(id: number): Promise<any> {
    try {
      const repair = await this.getRepair(id);
      if (!repair) {
        return null;
      }

      // Get customer and device information
      let customer = null;
      let device = null;
      let technician = null;
      
      try {
        if (repair.customerId) {
          customer = await this.getCustomer(repair.customerId);
        }
        
        if (repair.deviceId) {
          device = await this.getDevice(repair.deviceId);
        }
        
        if (repair.technicianId) {
          technician = await this.getTechnician(repair.technicianId);
        }
      } catch (error) {
        console.error("Error fetching related entities:", error);
      }
      
      // Get repair items
      const items = await this.getRepairItems(repair.id);
      
      // For each repair item with an inventory item, fetch the inventory item
      const itemsWithInventory = await Promise.all(
        items.map(async (item) => {
          if (item.inventoryItemId) {
            try {
              const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
              return { ...item, inventoryItem };
            } catch (error) {
              return item; // Return the item without inventory details if there's an error
            }
          }
          return item;
        })
      );

      let quoteList: any[] = [];
      let invoiceList: any[] = [];
      
      // Try to get quotes and invoices
      try {
        quoteList = await this.getQuotesByRepair(repair.id);
      } catch (error) {
        console.error("Error fetching quotes:", error);
      }
      
      try {
        invoiceList = await this.getInvoicesByRepair(repair.id);
      } catch (error) {
        console.error("Error fetching invoices:", error);
      }

      // Return the full repair with all its relations
      return {
        ...repair,
        customer,
        device,
        technician,
        items: itemsWithInventory,
        // Return all quotes, not just approved ones
        quote: quoteList.length > 0 ? quoteList[0] : null,
        quotes: quoteList,
        // Return all invoices, not just the first one
        invoice: invoiceList.length > 0 ? invoiceList[0] : null,
        invoices: invoiceList,
      };
    } catch (error) {
      console.error("Error in getRepairWithRelations:", error);
      throw error;
    }
  }
}