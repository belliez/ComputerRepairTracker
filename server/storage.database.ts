import { eq, and, inArray } from "drizzle-orm";
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
  // Methods for deleted records management
  async getDeletedCustomers(): Promise<Customer[]> {
    return db.select().from(customers).where(eq(customers.deleted, true));
  }
  
  async getDeletedDevices(): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.deleted, true));
  }
  
  async getDeletedRepairs(): Promise<Repair[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching deleted repairs for organization: ${orgId}`);
    
    return db.select()
      .from(repairs)
      .where(and(
        eq(repairs.deleted, true),
        eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ));
  }
  
  async getDeletedTechnicians(): Promise<Technician[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching deleted technicians for organization: ${orgId}`);
    
    return db.select()
      .from(technicians)
      .where(and(
        eq(technicians.deleted, true),
        eq((technicians as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ));
  }
  
  async getDeletedInventoryItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(eq(inventoryItems.deleted, true));
  }
  
  async getDeletedQuotes(): Promise<Quote[]> {
    return db.select().from(quotes).where(eq(quotes.deleted, true));
  }
  
  async getDeletedInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.deleted, true));
  }
  
  async restoreCustomer(id: number): Promise<Customer | undefined> {
    const [restoredCustomer] = await db
      .update(customers)
      .set({
        deleted: false,
        deletedAt: null
      })
      .where(eq(customers.id, id))
      .returning();
    return restoredCustomer;
  }
  
  async restoreDevice(id: number): Promise<Device | undefined> {
    const [restoredDevice] = await db
      .update(devices)
      .set({
        deleted: false,
        deletedAt: null
      })
      .where(eq(devices.id, id))
      .returning();
    return restoredDevice;
  }
  
  async restoreRepair(id: number): Promise<Repair | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Restoring repair ${id} in organization: ${orgId}`);
    
    const [restoredRepair] = await db
      .update(repairs)
      .set({
        deleted: false,
        deletedAt: null
      })
      .where(and(
        eq(repairs.id, id),
        eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ))
      .returning();
    return restoredRepair;
  }
  
  async restoreTechnician(id: number): Promise<Technician | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Restoring technician ${id} in organization: ${orgId}`);
    
    const [restoredTechnician] = await db
      .update(technicians)
      .set({
        deleted: false,
        deletedAt: null
      })
      .where(and(
        eq(technicians.id, id),
        eq((technicians as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ))
      .returning();
    return restoredTechnician;
  }
  
  async restoreInventoryItem(id: number): Promise<InventoryItem | undefined> {
    const [restoredItem] = await db
      .update(inventoryItems)
      .set({
        deleted: false,
        deletedAt: null
      })
      .where(eq(inventoryItems.id, id))
      .returning();
    return restoredItem;
  }
  
  async restoreQuote(id: number): Promise<Quote | undefined> {
    const [restoredQuote] = await db
      .update(quotes)
      .set({
        deleted: false,
        deletedAt: null
      })
      .where(eq(quotes.id, id))
      .returning();
    return restoredQuote;
  }
  
  async restoreInvoice(id: number): Promise<Invoice | undefined> {
    const [restoredInvoice] = await db
      .update(invoices)
      .set({
        deleted: false,
        deletedAt: null
      })
      .where(eq(invoices.id, id))
      .returning();
    return restoredInvoice;
  }
  
  // Customer methods
  async getCustomers(): Promise<Customer[]> {
    // Get organization context from request
    const orgId = (global as any).currentOrganizationId || 1; // Default to org 1 in dev mode
    console.log(`Fetching customers for organization: ${orgId}`);
    
    return db.select()
      .from(customers)
      .where(
        and(
          eq(customers.deleted, false),
          eq(customers.organizationId, orgId)
        )
      );
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching customer ${id} for organization: ${orgId}`);
    
    const [customer] = await db.select()
      .from(customers)
      .where(and(
        eq(customers.id, id),
        eq(customers.deleted, false),
        eq(customers.organizationId, orgId)
      ));
    return customer;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching customer by email for organization: ${orgId}`);
    
    const [customer] = await db.select()
      .from(customers)
      .where(and(
        eq(customers.email, email),
        eq(customers.deleted, false),
        eq(customers.organizationId, orgId)
      ));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Creating customer for organization: ${orgId}`);
    
    // Ensure organizationId is set
    const customerData = {
      ...customer,
      organizationId: orgId
    };
    
    const [newCustomer] = await db.insert(customers).values(customerData).returning();
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
    try {
      // First, check if this customer has devices
      const customerDevices = await this.getDevicesByCustomer(id);
      
      // For each device, soft delete them
      for (const device of customerDevices) {
        // Soft delete any repairs associated with this device
        const associatedRepairs = await db.select()
          .from(repairs)
          .where(and(
            eq(repairs.deviceId, device.id),
            eq(repairs.deleted, false)
          ));
          
        for (const repair of associatedRepairs) {
          // Soft delete repair items
          const repairItems = await this.getRepairItems(repair.id);
          for (const item of repairItems) {
            await this.deleteRepairItem(item.id);
          }
          
          // Soft delete any quotes or invoices related to this repair
          const repairQuotes = await this.getQuotesByRepair(repair.id);
          for (const quote of repairQuotes) {
            await this.deleteQuote(quote.id);
          }
          
          const repairInvoices = await this.getInvoicesByRepair(repair.id);
          for (const invoice of repairInvoices) {
            await this.deleteInvoice(invoice.id);
          }
          
          // Now soft delete the repair
          await this.deleteRepair(repair.id);
        }
        
        // Now soft delete the device
        await this.deleteDevice(device.id);
      }
      
      // Also find and soft delete any repairs directly associated with this customer (not via a device)
      const customerRepairs = await db.select()
        .from(repairs)
        .where(and(
          eq(repairs.customerId, id),
          eq(repairs.deleted, false)
        ));
        
      for (const repair of customerRepairs) {
        // Soft delete repair items
        const repairItems = await this.getRepairItems(repair.id);
        for (const item of repairItems) {
          await this.deleteRepairItem(item.id);
        }
        
        // Soft delete any quotes or invoices related to this repair
        const repairQuotes = await this.getQuotesByRepair(repair.id);
        for (const quote of repairQuotes) {
          await this.deleteQuote(quote.id);
        }
        
        const repairInvoices = await this.getInvoicesByRepair(repair.id);
        for (const invoice of repairInvoices) {
          await this.deleteInvoice(invoice.id);
        }
        
        // Now soft delete the repair
        await this.deleteRepair(repair.id);
      }
      
      // Finally, soft delete the customer by setting deleted flag
      const [updatedCustomer] = await db
        .update(customers)
        .set({ 
          deleted: true, 
          deletedAt: new Date() 
        })
        .where(eq(customers.id, id))
        .returning();
        
      return !!updatedCustomer;
    } catch (error) {
      console.error("Error in deleteCustomer:", error);
      throw error;
    }
  }

  // Device methods
  async getDevices(): Promise<Device[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching all devices for organization: ${orgId}`);
    
    return db.select()
      .from(devices)
      .where(and(
        eq(devices.deleted, false),
        eq(devices.organizationId, orgId)
      ));
  }

  async getDevicesByCustomer(customerId: number): Promise<Device[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching devices for customer ${customerId} in organization: ${orgId}`);
    
    return db.select()
      .from(devices)
      .where(and(
        eq(devices.customerId, customerId),
        eq(devices.deleted, false),
        eq(devices.organizationId, orgId)
      ));
  }

  async getDevice(id: number): Promise<Device | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching device ${id} for organization: ${orgId}`);
    
    const [device] = await db.select()
      .from(devices)
      .where(and(
        eq(devices.id, id),
        eq(devices.deleted, false),
        eq(devices.organizationId, orgId)
      ));
    return device;
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Creating device in organization: ${orgId}`);
    
    const [newDevice] = await db.insert(devices)
      .values({
        ...device,
        organizationId: orgId
      })
      .returning();
    return newDevice;
  }

  async updateDevice(id: number, deviceData: Partial<Device>): Promise<Device | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Updating device ${id} in organization: ${orgId}`);
    
    const [updatedDevice] = await db
      .update(devices)
      .set(deviceData)
      .where(and(
        eq(devices.id, id),
        eq(devices.organizationId, orgId)
      ))
      .returning();
    return updatedDevice;
  }

  async deleteDevice(id: number): Promise<boolean> {
    try {
      const orgId = (global as any).currentOrganizationId || 1;
      console.log(`Deleting device ${id} in organization: ${orgId}`);
      
      // Find repairs associated with this device
      const associatedRepairs = await db.select()
        .from(repairs)
        .where(and(
          eq(repairs.deviceId, id),
          eq(repairs.deleted, false),
          eq(repairs.organizationId, orgId)
        ));
      
      // For each repair, soft delete dependent entities first
      for (const repair of associatedRepairs) {
        await this.deleteRepair(repair.id);
      }
      
      // Now soft delete the device by setting deleted flag
      const [updatedDevice] = await db
        .update(devices)
        .set({
          deleted: true,
          deletedAt: new Date()
        })
        .where(and(
          eq(devices.id, id),
          eq(devices.organizationId, orgId)
        ))
        .returning();
        
      return !!updatedDevice;
    } catch (error) {
      console.error("Error in deleteDevice:", error);
      throw error;
    }
  }

  // Technician methods
  async getTechnicians(): Promise<Technician[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching all technicians for organization: ${orgId}`);
    
    return db.select()
      .from(technicians)
      .where(and(
        eq(technicians.deleted, false),
        eq(technicians.organizationId, orgId)
      ));
  }

  async getTechnician(id: number): Promise<Technician | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching technician ${id} for organization: ${orgId}`);
    
    const [technician] = await db.select()
      .from(technicians)
      .where(and(
        eq(technicians.id, id),
        eq(technicians.deleted, false),
        eq(technicians.organizationId, orgId)
      ));
    return technician;
  }

  async createTechnician(technician: InsertTechnician): Promise<Technician> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Creating technician in organization: ${orgId}`);
    
    // Cast to any to bypass TypeScript type checking since the schema definition 
    // doesn't yet include organizationId in the type but the DB column exists
    const technicianWithOrg = {
      ...technician,
      organizationId: orgId
    } as any;
    
    const [newTechnician] = await db.insert(technicians).values(technicianWithOrg).returning();
    return newTechnician;
  }

  async updateTechnician(id: number, technicianData: Partial<Technician>): Promise<Technician | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Updating technician ${id} in organization: ${orgId}`);
    
    const [updatedTechnician] = await db
      .update(technicians)
      .set(technicianData)
      .where(and(
        eq(technicians.id, id),
        eq((technicians as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ))
      .returning();
    return updatedTechnician;
  }

  async deleteTechnician(id: number): Promise<boolean> {
    try {
      const orgId = (global as any).currentOrganizationId || 1;
      console.log(`Deleting technician ${id} in organization: ${orgId}`);
      
      // Check if technician is assigned to any repairs
      const technicianRepairs = await this.getRepairsByTechnician(id);
      
      // If there are repairs with this technician, set them to null
      for (const repair of technicianRepairs) {
        await this.updateRepair(repair.id, { technicianId: null });
      }
      
      // Now soft delete the technician by setting deleted flag
      const [updatedTechnician] = await db
        .update(technicians)
        .set({
          deleted: true,
          deletedAt: new Date()
        })
        .where(and(
          eq(technicians.id, id),
          eq((technicians as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
        ))
        .returning();
        
      return !!updatedTechnician;
    } catch (error) {
      console.error("Error in deleteTechnician:", error);
      throw error;
    }
  }

  // Inventory methods
  async getInventoryItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(eq(inventoryItems.deleted, false));
  }

  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    const [item] = await db.select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.deleted, false)
      ));
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
    try {
      // Find any repair items using this inventory item
      const affectedRepairItems = await db.select()
        .from(repairItems)
        .where(and(
          eq(repairItems.inventoryItemId, id),
          eq(repairItems.deleted, false)
        ));
      
      // For each repair item, unlink it from this inventory item
      for (const item of affectedRepairItems) {
        await this.updateRepairItem(item.id, { inventoryItemId: null });
      }
      
      // Now soft delete the inventory item
      const [updatedItem] = await db
        .update(inventoryItems)
        .set({
          deleted: true,
          deletedAt: new Date()
        })
        .where(eq(inventoryItems.id, id))
        .returning();
        
      return !!updatedItem;
    } catch (error) {
      console.error("Error in deleteInventoryItem:", error);
      throw error;
    }
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
    return db.select().from(repairs).where(eq(repairs.deleted, false));
  }

  async getRepair(id: number): Promise<Repair | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching repair ${id} for organization: ${orgId}`);
    
    const [repair] = await db.select()
      .from(repairs)
      .where(and(
        eq(repairs.id, id),
        eq(repairs.deleted, false),
        eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ));
    return repair;
  }

  async getRepairByTicketNumber(ticketNumber: string): Promise<Repair | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching repair by ticket number ${ticketNumber} for organization: ${orgId}`);
    
    const [repair] = await db.select()
      .from(repairs)
      .where(and(
        eq(repairs.ticketNumber, ticketNumber),
        eq(repairs.deleted, false),
        eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ));
    return repair;
  }

  async getRepairsByCustomer(customerId: number): Promise<Repair[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching repairs for customer ${customerId} in organization: ${orgId}`);
    
    return db.select()
      .from(repairs)
      .where(and(
        eq(repairs.customerId, customerId),
        eq(repairs.deleted, false),
        eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ));
  }

  async getRepairsByTechnician(technicianId: number): Promise<Repair[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching repairs for technician ${technicianId} in organization: ${orgId}`);
    
    return db.select()
      .from(repairs)
      .where(and(
        eq(repairs.technicianId, technicianId),
        eq(repairs.deleted, false),
        eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ));
  }

  async getRepairsByStatus(status: typeof repairStatuses[number]): Promise<Repair[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching repairs with status ${status} for organization: ${orgId}`);
    
    return db.select()
      .from(repairs)
      .where(and(
        eq(repairs.status, status),
        eq(repairs.deleted, false),
        eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ));
  }

  async getRepairsByPriority(priority: number | number[]): Promise<Repair[]> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Fetching repairs by priority for organization: ${orgId}`);
    
    if (Array.isArray(priority)) {
      // If it's an array of priorities, use SQL IN clause
      const priorityNumbers = priority.map(p => Number(p));
      return db.select()
        .from(repairs)
        .where(and(
          inArray(repairs.priorityLevel, priorityNumbers),
          eq(repairs.deleted, false),
          eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
        ));
    } else {
      // If it's a single priority level
      return db.select()
        .from(repairs)
        .where(and(
          eq(repairs.priorityLevel, Number(priority)),
          eq(repairs.deleted, false),
          eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
        ));
    }
  }

  async createRepair(repair: InsertRepair): Promise<Repair> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Creating repair in organization: ${orgId}`);
    
    // Explicitly cast the status to the correct type and add organization ID
    const repairData = {
      ...repair,
      status: repair.status as (typeof repairStatuses)[number],
      organizationId: orgId // Add organization ID to the repair
    } as any; // Cast to any to bypass TypeScript type checking
    
    const [newRepair] = await db.insert(repairs).values(repairData).returning();
    return newRepair;
  }

  async updateRepair(id: number, repairData: Partial<Repair>): Promise<Repair | undefined> {
    const orgId = (global as any).currentOrganizationId || 1;
    console.log(`Updating repair ${id} in organization: ${orgId}`);
    
    const [updatedRepair] = await db
      .update(repairs)
      .set(repairData)
      .where(and(
        eq(repairs.id, id),
        eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
      ))
      .returning();
    return updatedRepair;
  }

  async deleteRepair(id: number): Promise<boolean> {
    try {
      // Soft delete all repair items associated with this repair
      const repairItems = await this.getRepairItems(id);
      for (const item of repairItems) {
        await this.deleteRepairItem(item.id);
      }
      
      // Soft delete any quotes related to this repair
      const repairQuotes = await this.getQuotesByRepair(id);
      for (const quote of repairQuotes) {
        await this.deleteQuote(quote.id);
      }
      
      // Soft delete any invoices related to this repair
      const repairInvoices = await this.getInvoicesByRepair(id);
      for (const invoice of repairInvoices) {
        await this.deleteInvoice(invoice.id);
      }
      
      // Now soft delete the repair by setting deleted flag
      const orgId = (global as any).currentOrganizationId || 1;
      console.log(`Deleting repair ${id} in organization: ${orgId}`);
      
      const [updatedRepair] = await db
        .update(repairs)
        .set({
          deleted: true,
          deletedAt: new Date()
        })
        .where(and(
          eq(repairs.id, id),
          eq((repairs as any).organizationId, orgId) // Cast to any to bypass TypeScript type checking
        ))
        .returning();
        
      return !!updatedRepair;
    } catch (error) {
      console.error("Error in deleteRepair:", error);
      throw error;
    }
  }

  // Repair Item methods
  async getRepairItems(repairId: number): Promise<RepairItem[]> {
    return db.select()
      .from(repairItems)
      .where(and(
        eq(repairItems.repairId, repairId),
        eq(repairItems.deleted, false)
      ));
  }

  async getRepairItem(id: number): Promise<RepairItem | undefined> {
    const [item] = await db.select()
      .from(repairItems)
      .where(and(
        eq(repairItems.id, id),
        eq(repairItems.deleted, false)
      ));
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
    // Soft delete the repair item by setting deleted flag
    const [updatedItem] = await db
      .update(repairItems)
      .set({
        deleted: true,
        deletedAt: new Date()
      })
      .where(eq(repairItems.id, id))
      .returning();
      
    return !!updatedItem;
  }

  // Quote methods
  async getQuotes(): Promise<Quote[]> {
    return db.select().from(quotes).where(eq(quotes.deleted, false));
  }

  async getQuotesByRepair(repairId: number): Promise<Quote[]> {
    return db.select()
      .from(quotes)
      .where(and(
        eq(quotes.repairId, repairId),
        eq(quotes.deleted, false)
      ));
  }

  async getQuote(id: number): Promise<Quote | undefined> {
    const [quote] = await db.select()
      .from(quotes)
      .where(and(
        eq(quotes.id, id),
        eq(quotes.deleted, false)
      ));
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
    // Soft delete the quote by setting deleted flag
    const [updatedQuote] = await db
      .update(quotes)
      .set({
        deleted: true,
        deletedAt: new Date()
      })
      .where(eq(quotes.id, id))
      .returning();
      
    return !!updatedQuote;
  }

  // Invoice methods
  async getInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.deleted, false));
  }

  async getInvoicesByRepair(repairId: number): Promise<Invoice[]> {
    return db.select()
      .from(invoices)
      .where(and(
        eq(invoices.repairId, repairId),
        eq(invoices.deleted, false)
      ));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select()
      .from(invoices)
      .where(and(
        eq(invoices.id, id),
        eq(invoices.deleted, false)
      ));
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
    // Soft delete the invoice by setting deleted flag
    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        deleted: true,
        deletedAt: new Date()
      })
      .where(eq(invoices.id, id))
      .returning();
      
    return !!updatedInvoice;
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