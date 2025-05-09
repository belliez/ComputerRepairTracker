import { db } from './db';
import { 
  customers, 
  devices, 
  technicians, 
  inventoryItems, 
  repairs,
  repairItems,
  quotes,
  invoices
} from "@shared/schema";

// Initialize demo data
export async function initializeDemo() {
  console.log('Initializing demo data...');
  
  // Check if we already have data
  const existingCustomers = await db.select().from(customers);
  if (existingCustomers.length > 0) {
    console.log('Demo data already exists. Skipping initialization.');
    return;
  }

  // Create customers
  const [customer1] = await db.insert(customers).values({
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    phone: '555-123-4567',
    address: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    postalCode: '12345',
    notes: 'Preferred customer'
  }).returning();

  const [customer2] = await db.insert(customers).values({
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '555-987-6543',
    address: '456 Oak Ave',
    city: 'Somewhere',
    state: 'NY',
    postalCode: '67890',
    notes: null
  }).returning();

  console.log('Created customers');

  // Create devices
  const [device1] = await db.insert(devices).values({
    customerId: customer1.id,
    type: 'Laptop',
    brand: 'Dell',
    model: 'XPS 15',
    serialNumber: 'DELL12345',
    password: 'password123',
    condition: 'Good, minor scratches',
    accessories: 'Charger, case'
  }).returning();

  const [device2] = await db.insert(devices).values({
    customerId: customer2.id,
    type: 'Desktop',
    brand: 'HP',
    model: 'Pavilion',
    serialNumber: 'HP67890',
    password: null,
    condition: 'Fair, dusty inside',
    accessories: 'Keyboard, mouse'
  }).returning();

  console.log('Created devices');

  // Create technicians
  const [technician1] = await db.insert(technicians).values({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.tech@example.com',
    phone: '555-111-2222',
    role: 'Senior Technician',
    specialty: 'Hardware Repairs',
    isActive: true
  }).returning();

  const [technician2] = await db.insert(technicians).values({
    firstName: 'Robert',
    lastName: 'Smith',
    email: 'robert.tech@example.com',
    phone: '555-333-4444',
    role: 'Junior Technician',
    specialty: 'Software Troubleshooting',
    isActive: true
  }).returning();

  console.log('Created technicians');

  // Create inventory items
  const [item1] = await db.insert(inventoryItems).values({
    name: 'SSD 1TB',
    description: 'Solid State Drive 1TB',
    category: 'Storage',
    sku: 'SSD-1TB-001',
    price: 120.00,
    cost: 80.00,
    quantity: 10,
    location: 'Shelf A1',
    supplier: 'Tech Distributors Inc.',
    minLevel: 2,
    isActive: true
  }).returning();

  const [item2] = await db.insert(inventoryItems).values({
    name: 'RAM 16GB DDR4',
    description: 'Memory module 16GB DDR4',
    category: 'Memory',
    sku: 'RAM-16GB-001',
    price: 75.00,
    cost: 45.00,
    quantity: 15,
    location: 'Shelf B2',
    supplier: 'Tech Distributors Inc.',
    minLevel: 3,
    isActive: true
  }).returning();

  const [item3] = await db.insert(inventoryItems).values({
    name: 'Laptop Screen 15.6"',
    description: 'Replacement laptop screen 15.6" FHD',
    category: 'Display',
    sku: 'SCREEN-156-001',
    price: 150.00,
    cost: 90.00,
    quantity: 5,
    location: 'Shelf C3',
    supplier: 'Screen Suppliers LLC',
    minLevel: 1,
    isActive: true
  }).returning();

  console.log('Created inventory items');

  // Create repairs
  const [repair1] = await db.insert(repairs).values({
    ticketNumber: 'RT-2301',
    customerId: customer1.id,
    deviceId: device1.id,
    technicianId: technician1.id,
    status: 'diagnosing',
    issue: 'Laptop not powering on',
    notes: 'Customer mentioned liquid spill',
    intakeDate: new Date('2023-01-15'),
    estimatedCompletionDate: new Date('2023-01-20'),
    actualCompletionDate: null,
    priorityLevel: 2,
    isUnderWarranty: false,
    diagnosticNotes: 'Possible motherboard short',
    customerApproval: null,
    totalCost: null
  }).returning();

  const [repair2] = await db.insert(repairs).values({
    ticketNumber: 'RT-2302',
    customerId: customer2.id,
    deviceId: device2.id,
    technicianId: technician2.id,
    status: 'completed',
    issue: 'System running slow, possible virus',
    notes: 'Customer needs data backup',
    intakeDate: new Date('2023-01-18'),
    estimatedCompletionDate: new Date('2023-01-22'),
    actualCompletionDate: new Date('2023-01-21'),
    priorityLevel: 3,
    isUnderWarranty: false,
    diagnosticNotes: 'Multiple malware found and removed',
    customerApproval: true,
    totalCost: 120.00
  }).returning();

  console.log('Created repairs');

  // Create repair items
  const [repairItem1] = await db.insert(repairItems).values({
    repairId: repair1.id,
    inventoryItemId: item1.id,
    description: 'SSD Replacement',
    quantity: 1,
    unitPrice: item1.price,
    itemType: 'part',
    isCompleted: false
  }).returning();

  const [repairItem2] = await db.insert(repairItems).values({
    repairId: repair1.id,
    inventoryItemId: null,
    description: 'Diagnostic Service',
    quantity: 1,
    unitPrice: 50.00,
    itemType: 'service',
    isCompleted: true
  }).returning();

  const [repairItem3] = await db.insert(repairItems).values({
    repairId: repair2.id,
    inventoryItemId: null,
    description: 'Virus Removal',
    quantity: 1,
    unitPrice: 80.00,
    itemType: 'service',
    isCompleted: true
  }).returning();

  const [repairItem4] = await db.insert(repairItems).values({
    repairId: repair2.id,
    inventoryItemId: null,
    description: 'Data Backup',
    quantity: 1,
    unitPrice: 40.00,
    itemType: 'service',
    isCompleted: true
  }).returning();

  console.log('Created repair items');

  // Create quotes
  const [quote1] = await db.insert(quotes).values({
    repairId: repair1.id,
    quoteNumber: 'Q-2023-001',
    dateCreated: new Date('2023-01-17'),
    expirationDate: new Date('2023-01-31'),
    subtotal: 170.00,
    tax: 13.60,
    total: 183.60,
    status: 'pending',
    notes: 'Awaiting customer approval'
  }).returning();

  console.log('Created quotes');

  // Create invoices
  const [invoice1] = await db.insert(invoices).values({
    repairId: repair2.id,
    invoiceNumber: 'INV-2023-001',
    dateIssued: new Date('2023-01-21'),
    datePaid: new Date('2023-01-21'),
    subtotal: 120.00,
    tax: 9.60,
    total: 129.60,
    status: 'paid',
    paymentMethod: 'Credit Card',
    notes: null
  }).returning();

  console.log('Created invoices');
  
  console.log('Demo data initialization complete');
}