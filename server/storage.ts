import {
  Customer,
  Device,
  InsertCustomer,
  InsertDevice,
  InsertInventoryItem,
  InsertInvoice,
  InsertQuote,
  InsertRepair,
  InsertRepairItem,
  InsertTechnician,
  InventoryItem,
  Invoice,
  Quote,
  Repair,
  RepairItem,
  Technician,
  repairStatuses,
} from "@shared/schema";

// Modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<Customer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;

  // Devices
  getDevices(): Promise<Device[]>;
  getDevicesByCustomer(customerId: number): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: number, device: Partial<Device>): Promise<Device | undefined>;
  deleteDevice(id: number): Promise<boolean>;

  // Technicians
  getTechnicians(): Promise<Technician[]>;
  getTechnician(id: number): Promise<Technician | undefined>;
  createTechnician(technician: InsertTechnician): Promise<Technician>;
  updateTechnician(id: number, technician: Partial<Technician>): Promise<Technician | undefined>;
  deleteTechnician(id: number): Promise<boolean>;

  // Inventory
  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, item: Partial<InventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: number): Promise<boolean>;
  adjustInventoryQuantity(id: number, quantity: number): Promise<InventoryItem | undefined>;

  // Repairs
  getRepairs(): Promise<Repair[]>;
  getRepair(id: number): Promise<Repair | undefined>;
  getRepairByTicketNumber(ticketNumber: string): Promise<Repair | undefined>;
  getRepairsByCustomer(customerId: number): Promise<Repair[]>;
  getRepairsByTechnician(technicianId: number): Promise<Repair[]>;
  getRepairsByStatus(status: (typeof repairStatuses)[number]): Promise<Repair[]>;
  createRepair(repair: InsertRepair): Promise<Repair>;
  updateRepair(id: number, repair: Partial<Repair>): Promise<Repair | undefined>;
  deleteRepair(id: number): Promise<boolean>;

  // Repair Items
  getRepairItems(repairId: number): Promise<RepairItem[]>;
  getRepairItem(id: number): Promise<RepairItem | undefined>;
  createRepairItem(item: InsertRepairItem): Promise<RepairItem>;
  updateRepairItem(id: number, item: Partial<RepairItem>): Promise<RepairItem | undefined>;
  deleteRepairItem(id: number): Promise<boolean>;

  // Quotes
  getQuotes(): Promise<Quote[]>;
  getQuotesByRepair(repairId: number): Promise<Quote[]>;
  getQuote(id: number): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: number, quote: Partial<Quote>): Promise<Quote | undefined>;
  deleteQuote(id: number): Promise<boolean>;

  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoicesByRepair(repairId: number): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<Invoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;

  // Extended functions for joining data
  getRepairWithRelations(id: number): Promise<any>;
}

export class MemStorage implements IStorage {
  private customers: Map<number, Customer>;
  private devices: Map<number, Device>;
  private technicians: Map<number, Technician>;
  private inventoryItems: Map<number, InventoryItem>;
  private repairs: Map<number, Repair>;
  private repairItems: Map<number, RepairItem>;
  private quotes: Map<number, Quote>;
  private invoices: Map<number, Invoice>;

  private customerId: number;
  private deviceId: number;
  private technicianId: number;
  private inventoryItemId: number;
  private repairId: number;
  private repairItemId: number;
  private quoteId: number;
  private invoiceId: number;

  private ticketCounter: number;
  private quoteCounter: number;
  private invoiceCounter: number;

  constructor() {
    this.customers = new Map();
    this.devices = new Map();
    this.technicians = new Map();
    this.inventoryItems = new Map();
    this.repairs = new Map();
    this.repairItems = new Map();
    this.quotes = new Map();
    this.invoices = new Map();

    this.customerId = 1;
    this.deviceId = 1;
    this.technicianId = 1;
    this.inventoryItemId = 1;
    this.repairId = 1;
    this.repairItemId = 1;
    this.quoteId = 1;
    this.invoiceId = 1;

    this.ticketCounter = 2301;
    this.quoteCounter = 1001;
    this.invoiceCounter = 5001;

    // Initialize with demo data
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Add demo technicians
    const tech1 = this.createTechnician({
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "555-123-4567",
      role: "Senior Technician",
      specialty: "Hardware Repair",
      isActive: true,
    });

    const tech2 = this.createTechnician({
      firstName: "Amanda",
      lastName: "Rodriguez",
      email: "amanda.rodriguez@example.com",
      phone: "555-234-5678",
      role: "Hardware Specialist",
      specialty: "Apple Products",
      isActive: true,
    });

    const tech3 = this.createTechnician({
      firstName: "Tom",
      lastName: "Keller",
      email: "tom.keller@example.com",
      phone: "555-345-6789",
      role: "Software Engineer",
      specialty: "Data Recovery",
      isActive: true,
    });

    // Add demo customers
    const customer1 = this.createCustomer({
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.johnson@example.com",
      phone: "555-111-2222",
      address: "123 Main St",
      city: "Anytown",
      state: "CA",
      postalCode: "12345",
    });

    const customer2 = this.createCustomer({
      firstName: "Michael",
      lastName: "Chen",
      email: "michael.chen@example.com",
      phone: "555-222-3333",
      address: "456 Oak Ave",
      city: "Othertown",
      state: "NY",
      postalCode: "67890",
    });

    const customer3 = this.createCustomer({
      firstName: "Emily",
      lastName: "Rodriguez",
      email: "emily.rodriguez@example.com",
      phone: "555-333-4444",
      address: "789 Pine Rd",
      city: "Somewhere",
      state: "TX",
      postalCode: "54321",
    });

    const customer4 = this.createCustomer({
      firstName: "David",
      lastName: "Wilson",
      email: "david.wilson@example.com",
      phone: "555-444-5555",
      address: "321 Elm St",
      city: "Nowhere",
      state: "FL",
      postalCode: "98765",
    });

    const customer5 = this.createCustomer({
      firstName: "Jessica",
      lastName: "Brown",
      email: "jessica.brown@example.com",
      phone: "555-555-6666",
      address: "654 Maple Dr",
      city: "Elsewhere",
      state: "WA",
      postalCode: "13579",
    });

    // Add demo devices
    const device1 = this.createDevice({
      customerId: customer1.id,
      type: "Laptop",
      brand: "Apple",
      model: "MacBook Pro (2020)",
      serialNumber: "C02XL0LGJGH7",
      password: "1234",
      condition: "Good - Minor scratches",
      accessories: "Charger, Case",
    });

    const device2 = this.createDevice({
      customerId: customer2.id,
      type: "Laptop",
      brand: "Dell",
      model: "XPS 15",
      serialNumber: "5GHXYZABC123",
      password: "none",
      condition: "Fair - Scratches on lid",
      accessories: "Charger",
    });

    const device3 = this.createDevice({
      customerId: customer3.id,
      type: "Desktop",
      brand: "Custom",
      model: "Desktop PC",
      serialNumber: "N/A",
      password: "emily123",
      condition: "Good",
      accessories: "Keyboard, Mouse, Monitor",
    });

    const device4 = this.createDevice({
      customerId: customer4.id,
      type: "Laptop",
      brand: "HP",
      model: "Pavilion",
      serialNumber: "HP78901234ZYX",
      password: "5678",
      condition: "Poor - Cracked case",
      accessories: "None",
    });

    const device5 = this.createDevice({
      customerId: customer5.id,
      type: "Laptop",
      brand: "Lenovo",
      model: "ThinkPad",
      serialNumber: "LN1234567890",
      password: "lenovo2023",
      condition: "Excellent",
      accessories: "Docking station, charger",
    });

    // Add demo inventory items
    const item1 = this.createInventoryItem({
      name: "Macbook Pro Display Assembly",
      description: "Retina display assembly for 2019-2020 Macbook Pro 13\"",
      category: "Display",
      sku: "MLB-DISP-2020",
      price: 299.99,
      cost: 199.99,
      quantity: 5,
      location: "Shelf A1",
      supplier: "Apple Parts Inc",
      minLevel: 2,
      isActive: true,
    });

    const item2 = this.createInventoryItem({
      name: "Dell XPS Battery",
      description: "Replacement battery for Dell XPS 15 (2019+)",
      category: "Battery",
      sku: "DELL-BAT-XPS15",
      price: 149.99,
      cost: 89.99,
      quantity: 8,
      location: "Shelf B3",
      supplier: "Dell Parts Supply",
      minLevel: 3,
      isActive: true,
    });

    const item3 = this.createInventoryItem({
      name: "SSD 1TB",
      description: "Samsung 970 EVO NVMe SSD 1TB",
      category: "Storage",
      sku: "SSD-1TB-NVME",
      price: 179.99,
      cost: 120.00,
      quantity: 12,
      location: "Shelf C2",
      supplier: "Tech Supplies Inc",
      minLevel: 5,
      isActive: true,
    });

    const item4 = this.createInventoryItem({
      name: "16GB RAM",
      description: "Crucial 16GB DDR4 3200MHz Memory",
      category: "Memory",
      sku: "RAM-16GB-DDR4",
      price: 89.99,
      cost: 60.00,
      quantity: 15,
      location: "Shelf C1",
      supplier: "Tech Supplies Inc",
      minLevel: 5,
      isActive: true,
    });

    const item5 = this.createInventoryItem({
      name: "Laptop Keyboard",
      description: "Generic laptop keyboard replacement",
      category: "Input Devices",
      sku: "KB-GENERIC",
      price: 59.99,
      cost: 35.00,
      quantity: 10,
      location: "Shelf D2",
      supplier: "PC Parts Wholesale",
      minLevel: 4,
      isActive: true,
    });

    // Add demo repairs
    const repair1 = this.createRepair({
      ticketNumber: `RT-${this.ticketCounter++}`,
      customerId: customer1.id,
      deviceId: device1.id,
      technicianId: tech1.id,
      status: "diagnosing",
      issue: "Display Issue",
      notes: "Screen flickering and showing lines",
      intakeDate: new Date(),
      estimatedCompletionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 days
      priorityLevel: 2,
      isUnderWarranty: false,
      diagnosticNotes: "Likely faulty display assembly",
    });

    const repair2 = this.createRepair({
      ticketNumber: `RT-${this.ticketCounter++}`,
      customerId: customer2.id,
      deviceId: device2.id,
      technicianId: tech2.id,
      status: "parts_ordered",
      issue: "Battery Replacement",
      notes: "Battery only lasts 30 minutes",
      intakeDate: new Date(),
      estimatedCompletionDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // +5 days
      priorityLevel: 3,
      isUnderWarranty: true,
      diagnosticNotes: "Battery needs replacement, ordered new one",
    });

    const repair3 = this.createRepair({
      ticketNumber: `RT-${this.ticketCounter++}`,
      customerId: customer3.id,
      deviceId: device3.id,
      technicianId: tech3.id,
      status: "ready_for_pickup",
      issue: "Hardware Upgrade",
      notes: "Customer wants more RAM and new SSD",
      intakeDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // -5 days
      estimatedCompletionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // -1 day
      actualCompletionDate: new Date(),
      priorityLevel: 4,
      isUnderWarranty: false,
      diagnosticNotes: "Compatible with requested upgrades",
      customerApproval: true,
      totalCost: 299.98, // price of RAM + SSD
    });

    const repair4 = this.createRepair({
      ticketNumber: `RT-${this.ticketCounter++}`,
      customerId: customer4.id,
      deviceId: device4.id,
      technicianId: tech1.id,
      status: "awaiting_approval",
      issue: "Data Recovery",
      notes: "Cannot boot to Windows, needs data recovery",
      intakeDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // -2 days
      estimatedCompletionDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // +4 days
      priorityLevel: 2,
      isUnderWarranty: false,
      diagnosticNotes: "Hard drive failure, need to replace drive and recover data",
    });

    const repair5 = this.createRepair({
      ticketNumber: `RT-${this.ticketCounter++}`,
      customerId: customer5.id,
      deviceId: device5.id,
      technicianId: tech3.id,
      status: "on_hold",
      issue: "Software Installation",
      notes: "Fresh Windows install with software package",
      intakeDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // -3 days
      estimatedCompletionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // +2 days
      priorityLevel: 3,
      isUnderWarranty: false,
      diagnosticNotes: "Waiting for customer to provide software licenses",
    });

    // Add demo repair items
    const repairItem1 = this.createRepairItem({
      repairId: repair1.id,
      inventoryItemId: item1.id,
      description: "Macbook Pro Display Assembly",
      quantity: 1,
      unitPrice: item1.price,
      itemType: "part",
      isCompleted: false,
    });

    const repairItem2 = this.createRepairItem({
      repairId: repair1.id,
      inventoryItemId: null,
      description: "Diagnostic Service",
      quantity: 1,
      unitPrice: 75.00,
      itemType: "service",
      isCompleted: true,
    });

    const repairItem3 = this.createRepairItem({
      repairId: repair2.id,
      inventoryItemId: item2.id,
      description: "Dell XPS Battery",
      quantity: 1,
      unitPrice: item2.price,
      itemType: "part",
      isCompleted: false,
    });

    const repairItem4 = this.createRepairItem({
      repairId: repair2.id,
      inventoryItemId: null,
      description: "Battery Installation",
      quantity: 1,
      unitPrice: 50.00,
      itemType: "service",
      isCompleted: false,
    });

    const repairItem5 = this.createRepairItem({
      repairId: repair3.id,
      inventoryItemId: item3.id,
      description: "SSD 1TB",
      quantity: 1,
      unitPrice: item3.price,
      itemType: "part",
      isCompleted: true,
    });

    const repairItem6 = this.createRepairItem({
      repairId: repair3.id,
      inventoryItemId: item4.id,
      description: "16GB RAM",
      quantity: 1,
      unitPrice: item4.price,
      itemType: "part",
      isCompleted: true,
    });

    const repairItem7 = this.createRepairItem({
      repairId: repair3.id,
      inventoryItemId: null,
      description: "Hardware Installation",
      quantity: 1,
      unitPrice: 75.00,
      itemType: "service",
      isCompleted: true,
    });

    // Demo quotes
    const quote1 = this.createQuote({
      repairId: repair1.id,
      quoteNumber: `QT-${this.quoteCounter++}`,
      dateCreated: new Date(),
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      subtotal: 374.99, // Display + Diagnostic
      tax: 37.50,
      total: 412.49,
      status: "pending",
      notes: "Awaiting customer approval",
    });

    const quote2 = this.createQuote({
      repairId: repair4.id,
      quoteNumber: `QT-${this.quoteCounter++}`,
      dateCreated: new Date(),
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      subtotal: 299.99, // Item + Labor
      tax: 30.00,
      total: 329.99,
      status: "pending",
      notes: "Data recovery may not be 100% successful",
    });

    const quote3 = this.createQuote({
      repairId: repair3.id,
      quoteNumber: `QT-${this.quoteCounter++}`,
      dateCreated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // -7 days
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      subtotal: 344.98, // Parts + Labor
      tax: 34.50,
      total: 379.48,
      status: "approved",
      notes: "Customer approved via email",
    });

    // Demo invoices
    const invoice1 = this.createInvoice({
      repairId: repair3.id,
      invoiceNumber: `INV-${this.invoiceCounter++}`,
      dateIssued: new Date(),
      datePaid: new Date(),
      subtotal: 344.98, // Parts + Labor
      tax: 34.50,
      total: 379.48,
      status: "paid",
      paymentMethod: "Credit Card",
      notes: "Payment received in full",
    });
  }

  private generatePaddedId(prefix: string, counter: number): string {
    return `${prefix}${counter.toString().padStart(4, '0')}`;
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(
      (customer) => customer.email === email,
    );
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const id = this.customerId++;
    const newCustomer: Customer = { ...customer, id };
    this.customers.set(id, newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: number, customer: Partial<Customer>): Promise<Customer | undefined> {
    const existingCustomer = this.customers.get(id);
    if (!existingCustomer) return undefined;

    const updatedCustomer = { ...existingCustomer, ...customer };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return this.customers.delete(id);
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    return Array.from(this.devices.values());
  }

  async getDevicesByCustomer(customerId: number): Promise<Device[]> {
    return Array.from(this.devices.values()).filter(
      (device) => device.customerId === customerId,
    );
  }

  async getDevice(id: number): Promise<Device | undefined> {
    return this.devices.get(id);
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const id = this.deviceId++;
    const newDevice: Device = { ...device, id };
    this.devices.set(id, newDevice);
    return newDevice;
  }

  async updateDevice(id: number, device: Partial<Device>): Promise<Device | undefined> {
    const existingDevice = this.devices.get(id);
    if (!existingDevice) return undefined;

    const updatedDevice = { ...existingDevice, ...device };
    this.devices.set(id, updatedDevice);
    return updatedDevice;
  }

  async deleteDevice(id: number): Promise<boolean> {
    return this.devices.delete(id);
  }

  // Technicians
  async getTechnicians(): Promise<Technician[]> {
    return Array.from(this.technicians.values());
  }

  async getTechnician(id: number): Promise<Technician | undefined> {
    return this.technicians.get(id);
  }

  async createTechnician(technician: InsertTechnician): Promise<Technician> {
    const id = this.technicianId++;
    const newTechnician: Technician = { ...technician, id };
    this.technicians.set(id, newTechnician);
    return newTechnician;
  }

  async updateTechnician(id: number, technician: Partial<Technician>): Promise<Technician | undefined> {
    const existingTechnician = this.technicians.get(id);
    if (!existingTechnician) return undefined;

    const updatedTechnician = { ...existingTechnician, ...technician };
    this.technicians.set(id, updatedTechnician);
    return updatedTechnician;
  }

  async deleteTechnician(id: number): Promise<boolean> {
    return this.technicians.delete(id);
  }

  // Inventory
  async getInventoryItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values());
  }

  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    return this.inventoryItems.get(id);
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const id = this.inventoryItemId++;
    const newItem: InventoryItem = { ...item, id };
    this.inventoryItems.set(id, newItem);
    return newItem;
  }

  async updateInventoryItem(id: number, item: Partial<InventoryItem>): Promise<InventoryItem | undefined> {
    const existingItem = this.inventoryItems.get(id);
    if (!existingItem) return undefined;

    const updatedItem = { ...existingItem, ...item };
    this.inventoryItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    return this.inventoryItems.delete(id);
  }

  async adjustInventoryQuantity(id: number, quantity: number): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;

    const updatedItem = {
      ...item,
      quantity: item.quantity + quantity,
    };
    
    this.inventoryItems.set(id, updatedItem);
    return updatedItem;
  }

  // Repairs
  async getRepairs(): Promise<Repair[]> {
    return Array.from(this.repairs.values());
  }

  async getRepair(id: number): Promise<Repair | undefined> {
    return this.repairs.get(id);
  }

  async getRepairByTicketNumber(ticketNumber: string): Promise<Repair | undefined> {
    return Array.from(this.repairs.values()).find(
      (repair) => repair.ticketNumber === ticketNumber,
    );
  }

  async getRepairsByCustomer(customerId: number): Promise<Repair[]> {
    return Array.from(this.repairs.values()).filter(
      (repair) => repair.customerId === customerId,
    );
  }

  async getRepairsByTechnician(technicianId: number): Promise<Repair[]> {
    return Array.from(this.repairs.values()).filter(
      (repair) => repair.technicianId === technicianId,
    );
  }

  async getRepairsByStatus(status: (typeof repairStatuses)[number]): Promise<Repair[]> {
    return Array.from(this.repairs.values()).filter(
      (repair) => repair.status === status,
    );
  }

  async createRepair(repair: InsertRepair): Promise<Repair> {
    const id = this.repairId++;
    // Generate ticket number if not provided
    const ticketNumber = repair.ticketNumber || `RT-${this.ticketCounter++}`;
    
    const newRepair: Repair = { 
      ...repair, 
      id, 
      ticketNumber,
      customerApproval: false,
      totalCost: 0,
      actualCompletionDate: null,
    };
    
    this.repairs.set(id, newRepair);
    return newRepair;
  }

  async updateRepair(id: number, repair: Partial<Repair>): Promise<Repair | undefined> {
    const existingRepair = this.repairs.get(id);
    if (!existingRepair) return undefined;

    const updatedRepair = { ...existingRepair, ...repair };
    this.repairs.set(id, updatedRepair);
    return updatedRepair;
  }

  async deleteRepair(id: number): Promise<boolean> {
    return this.repairs.delete(id);
  }

  // Repair Items
  async getRepairItems(repairId: number): Promise<RepairItem[]> {
    return Array.from(this.repairItems.values()).filter(
      (item) => item.repairId === repairId,
    );
  }

  async getRepairItem(id: number): Promise<RepairItem | undefined> {
    return this.repairItems.get(id);
  }

  async createRepairItem(item: InsertRepairItem): Promise<RepairItem> {
    const id = this.repairItemId++;
    const newItem: RepairItem = { ...item, id };
    this.repairItems.set(id, newItem);
    
    // If this is a part item, adjust inventory quantity
    if (item.inventoryItemId && item.itemType === 'part') {
      await this.adjustInventoryQuantity(item.inventoryItemId, -item.quantity);
    }
    
    return newItem;
  }

  async updateRepairItem(id: number, item: Partial<RepairItem>): Promise<RepairItem | undefined> {
    const existingItem = this.repairItems.get(id);
    if (!existingItem) return undefined;

    // If the quantity is being changed and it's a part, adjust inventory
    if (item.quantity !== undefined && 
        existingItem.inventoryItemId && 
        existingItem.itemType === 'part') {
      // Calculate difference in quantity
      const quantityDiff = existingItem.quantity - (item.quantity || 0);
      
      if (quantityDiff !== 0) {
        await this.adjustInventoryQuantity(existingItem.inventoryItemId, quantityDiff);
      }
    }

    const updatedItem = { ...existingItem, ...item };
    this.repairItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteRepairItem(id: number): Promise<boolean> {
    const item = this.repairItems.get(id);
    if (!item) return false;
    
    // If this is a part, return it to inventory
    if (item.inventoryItemId && item.itemType === 'part') {
      await this.adjustInventoryQuantity(item.inventoryItemId, item.quantity);
    }
    
    return this.repairItems.delete(id);
  }

  // Quotes
  async getQuotes(): Promise<Quote[]> {
    return Array.from(this.quotes.values());
  }

  async getQuotesByRepair(repairId: number): Promise<Quote[]> {
    return Array.from(this.quotes.values()).filter(
      (quote) => quote.repairId === repairId,
    );
  }

  async getQuote(id: number): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const id = this.quoteId++;
    // Generate quote number if not provided
    const quoteNumber = quote.quoteNumber || `QT-${this.quoteCounter++}`;
    
    const newQuote: Quote = { ...quote, id, quoteNumber };
    this.quotes.set(id, newQuote);
    return newQuote;
  }

  async updateQuote(id: number, quote: Partial<Quote>): Promise<Quote | undefined> {
    const existingQuote = this.quotes.get(id);
    if (!existingQuote) return undefined;

    const updatedQuote = { ...existingQuote, ...quote };
    this.quotes.set(id, updatedQuote);
    return updatedQuote;
  }

  async deleteQuote(id: number): Promise<boolean> {
    return this.quotes.delete(id);
  }

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values());
  }

  async getInvoicesByRepair(repairId: number): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      (invoice) => invoice.repairId === repairId,
    );
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const id = this.invoiceId++;
    // Generate invoice number if not provided
    const invoiceNumber = invoice.invoiceNumber || `INV-${this.invoiceCounter++}`;
    
    const newInvoice: Invoice = { 
      ...invoice, 
      id, 
      invoiceNumber,
      datePaid: null,
    };
    
    this.invoices.set(id, newInvoice);
    return newInvoice;
  }

  async updateInvoice(id: number, invoice: Partial<Invoice>): Promise<Invoice | undefined> {
    const existingInvoice = this.invoices.get(id);
    if (!existingInvoice) return undefined;

    const updatedInvoice = { ...existingInvoice, ...invoice };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    return this.invoices.delete(id);
  }

  // Extended functions for joining data
  async getRepairWithRelations(id: number): Promise<any> {
    const repair = await this.getRepair(id);
    if (!repair) return undefined;

    const customer = await this.getCustomer(repair.customerId);
    const device = await this.getDevice(repair.deviceId);
    const technician = repair.technicianId ? await this.getTechnician(repair.technicianId) : undefined;
    const items = await this.getRepairItems(repair.id);
    
    // Get the latest quote
    const quotes = await this.getQuotesByRepair(repair.id);
    const quote = quotes.length > 0 ? 
      quotes.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())[0] 
      : undefined;
      
    // Get the latest invoice
    const invoices = await this.getInvoicesByRepair(repair.id);
    const invoice = invoices.length > 0 ? 
      invoices.sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime())[0] 
      : undefined;
    
    // For each repair item that has an inventory item, get the inventory item details
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        if (item.inventoryItemId) {
          const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
          return {
            ...item,
            inventoryItem,
          };
        }
        return item;
      })
    );
    
    return {
      ...repair,
      customer,
      device,
      technician,
      items: itemsWithDetails,
      quote,
      invoice,
    };
  }
}

export const storage = new MemStorage();
