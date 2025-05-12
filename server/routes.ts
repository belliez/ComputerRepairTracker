import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { initializeDemo } from "./init-db";
import { db } from "./db";
import { and, eq, desc } from "drizzle-orm";
import { sendEmail, generateQuoteEmail, generateInvoiceEmail, EmailData } from "./email";
import Stripe from "stripe";
import {
  insertCustomerSchema,
  insertDeviceSchema,
  insertInventoryItemSchema,
  insertInvoiceSchema,
  insertQuoteSchema,
  insertRepairItemSchema,
  insertRepairSchema,
  insertTechnicianSchema,
  repairStatuses,
  currencies,
  taxRates,
  quotes,
  invoices,
  organizations,
  technicians,
  users,
  organizationUsers,
} from "@shared/schema";
import { 
  authenticateJWT, 
  getCurrentUser, 
  createOrganization, 
  getUserOrganizations,
  addUserToOrganization,
  acceptOrganizationInvite,
  addOrganizationContext
} from "./auth";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Stripe
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("STRIPE_SECRET_KEY is not set. Payment processing will not work.");
  }
  const stripe = process.env.STRIPE_SECRET_KEY 
    ? new Stripe(process.env.STRIPE_SECRET_KEY) 
    : null;
  
  // Initialize demo data
  try {
    await initializeDemo();
    console.log("Database initialization completed");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
  
  // Create API router
  const apiRouter = express.Router();
  
  // IMPORTANT: Intentionally adding these routes BEFORE any middleware to ensure they're accessible
  
  // Public routes (no auth required)
  // Serve static files from the public directory
  app.use('/public', express.static('public'));
  
  // Direct route to our simplified auth test page
  app.get('/simple-auth', (req: Request, res: Response) => {
    console.log('Serving simple auth page');
    res.sendFile('simple-auth.html', { root: './public' });
  });
  
  // Direct route to our comprehensive auth debugging page
  app.get('/auth-debug', (req: Request, res: Response) => {
    console.log('Serving auth debugging page');
    res.sendFile('auth-debug.html', { root: './public' });
  });
  
  // Auth page data route - always publicly accessible
  app.get('/api/auth-data', (req: Request, res: Response) => {
    console.log('Auth data endpoint called');
    res.status(200).json({
      message: 'Auth data fetched successfully', 
      appName: 'RepairTrack',
      appDescription: 'Professional repair shop management system',
      enableGoogleAuth: true
    });
  });
  
  // Add public settings endpoints before any authentication
  app.get('/api/public-settings/currencies', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC API: Getting currencies (public router)");
      const allCurrencies = await db.select().from(currencies);
      console.log("PUBLIC API: All currencies:", JSON.stringify(allCurrencies));
      res.json(allCurrencies);
    } catch (error) {
      console.error("PUBLIC API: Error fetching currencies:", error);
      res.status(500).json({ message: "Error fetching currencies" });
    }
  });

  app.get('/api/public-settings/currencies/default', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC API: Getting default currency (public router)");
      const defaultCurrency = await db.select().from(currencies).where(eq(currencies.isDefault, true)).limit(1);
      console.log("PUBLIC API: Default currency:", JSON.stringify(defaultCurrency[0] || null));
      
      if (defaultCurrency.length > 0) {
        res.json(defaultCurrency[0]);
      } else {
        // If no default currency is set, return the first one or null
        const anyCurrency = await db.select().from(currencies).limit(1);
        res.json(anyCurrency[0] || null);
      }
    } catch (error) {
      console.error("PUBLIC API: Error fetching default currency:", error);
      res.status(500).json({ message: "Error fetching default currency" });
    }
  });

  app.get('/api/public-settings/tax-rates', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC API: Getting tax rates (public router)");
      const allTaxRates = await db.select().from(taxRates);
      console.log("PUBLIC API: All tax rates:", JSON.stringify(allTaxRates));
      res.json(allTaxRates);
    } catch (error) {
      console.error("PUBLIC API: Error fetching tax rates:", error);
      res.status(500).json({ message: "Error fetching tax rates" });
    }
  });

  app.get('/api/public-settings/tax-rates/default', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC API: Getting default tax rate (public router)");
      const defaultTaxRate = await db.select().from(taxRates).where(eq(taxRates.isDefault, true)).limit(1);
      console.log("PUBLIC API: Default tax rate:", JSON.stringify(defaultTaxRate[0] || null));
      
      if (defaultTaxRate.length > 0) {
        res.json(defaultTaxRate[0]);
      } else {
        // If no default tax rate is set, return the first one or null
        const anyTaxRate = await db.select().from(taxRates).limit(1);
        res.json(anyTaxRate[0] || null);
      }
    } catch (error) {
      console.error("PUBLIC API: Error fetching default tax rate:", error);
      res.status(500).json({ message: "Error fetching default tax rate" });
    }
  });

  app.get('/api/public-settings/technicians', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC API: Getting technicians (public router)");
      const allTechnicians = await db.select().from(technicians).where(eq(technicians.deleted, false));
      console.log("PUBLIC API: Technicians count:", allTechnicians.length);
      res.json(allTechnicians);
    } catch (error) {
      console.error("PUBLIC API: Error fetching technicians:", error);
      res.status(500).json({ message: "Error fetching technicians" });
    }
  });

  // Add a simple endpoint to check auth status
  app.get('/api/auth-status', (req: Request, res: Response) => {
    console.log('Auth status endpoint called');
    
    // Check if authorization header exists
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(200).json({
        authenticated: false,
        message: 'No authorization header present',
        headers: req.headers,
      });
    }
    
    // Return full authorization info for debugging
    res.status(200).json({
      authenticated: true,
      authHeader: authHeader,
      headers: req.headers,
      message: 'Authorization header present',
    });
  });
  
  // Directly serve static resources needed for the auth page
  app.use('/assets', express.static('client/public/assets'));
  
  // Development routes
  if (process.env.NODE_ENV === 'development') {
    // Development-only endpoints with no auth
    app.post('/api/dev-login', (req: Request, res: Response) => {
      console.log('Using development login endpoint');
      
      // Extract data from request
      const { email, name } = req.body;
      
      // Generate a comprehensive mock user for development
      const mockUser = {
        id: 'dev-user-123',
        email: email || 'dev@example.com',
        displayName: name || 'Development User',
        photoURL: null,
        lastLoginAt: new Date().toISOString()
      };
      
      // Create a mock organization with complete properties
      const mockOrg = {
        id: 1,
        name: 'Development Organization',
        slug: 'dev-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'dev-user-123',
        logo: null,
        stripeSubscriptionId: 'mock_sub_123',
        subscriptionStatus: 'active',
        trialEndsAt: null,
        planId: 'free',
        billingEmail: email || 'dev@example.com',
        billingName: name || 'Development User',
        billingAddress: null,
        deleted: false,
        deletedAt: null,
        role: 'owner'
      };
      
      // Generate a token that will be recognized by our dev auth middleware
      const mockToken = 'dev-token-' + Date.now();
      
      // Return success with the complete mock data
      res.status(200).json({ 
        message: 'Development login successful',
        user: {
          ...mockUser,
          organization: mockOrg
        },
        token: mockToken,
        devMode: true
      });
    });
    
    // Development diagnostic endpoint
    app.get('/api/status', (req: Request, res: Response) => {
      console.log('Status endpoint called');
      res.status(200).json({ 
        status: 'ok',
        environment: process.env.NODE_ENV,
        time: new Date().toISOString()
      });
    });
  }
  
  // Apply authentication middleware to protected API routes
  apiRouter.use(authenticateJWT);
  
  // Apply organization context middleware for authenticated users
  apiRouter.use(addOrganizationContext);
  
  // Auth and organization API routes
  apiRouter.get('/me', getCurrentUser);
  apiRouter.get('/organizations', getUserOrganizations);
  apiRouter.post('/organizations', createOrganization);
  apiRouter.post('/organizations/invite', addUserToOrganization);
  apiRouter.post('/organizations/accept-invite', acceptOrganizationInvite);
  apiRouter.post('/set-organization', (req: Request, res: Response) => {
    const { organizationId } = req.body;
    if (!organizationId) {
      return res.status(400).json({ message: 'Organization ID is required' });
    }
    const orgId = Number(organizationId);
    req.organizationId = orgId;
    
    // Set the global organization context for this request and future requests
    (global as any).currentOrganizationId = orgId;
    console.log(`Setting global organization context to ${orgId} from request`);
    
    res.json({ message: 'Organization context set', organizationId });
  });

  // Customers
  apiRouter.get("/customers", async (req: Request, res: Response) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  apiRouter.get("/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  apiRouter.post("/customers", async (req: Request, res: Response) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  apiRouter.put("/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const validatedData = insertCustomerSchema.partial().parse(req.body);
      const updatedCustomer = await storage.updateCustomer(id, validatedData);
      
      if (!updatedCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(updatedCustomer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  apiRouter.delete("/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const success = await storage.deleteCustomer(id);
      if (!success) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Failed to delete customer", details: error.message });
    }
  });

  // Devices
  apiRouter.get("/devices", async (req: Request, res: Response) => {
    try {
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      
      if (customerId) {
        const devices = await storage.getDevicesByCustomer(customerId);
        return res.json(devices);
      }
      
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  apiRouter.get("/devices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const device = await storage.getDevice(id);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device" });
    }
  });

  apiRouter.post("/devices", async (req: Request, res: Response) => {
    try {
      const validatedData = insertDeviceSchema.parse(req.body);
      const device = await storage.createDevice(validatedData);
      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid device data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create device" });
    }
  });

  apiRouter.put("/devices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const validatedData = insertDeviceSchema.partial().parse(req.body);
      const updatedDevice = await storage.updateDevice(id, validatedData);
      
      if (!updatedDevice) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.json(updatedDevice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid device data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update device" });
    }
  });

  apiRouter.delete("/devices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const success = await storage.deleteDevice(id);
      if (!success) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device" });
    }
  });

  // Technicians
  apiRouter.get("/technicians", async (req: Request, res: Response) => {
    try {
      console.log("Getting technicians - bypassing auth for debugging...");
      
      // Query directly from database to bypass organization filtering for debugging
      const techData = await db.select()
        .from(technicians)
        .where(eq(technicians.deleted, false));
      
      console.log("Technicians found:", techData.length, techData);
      return res.json(techData);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      return res.status(500).json({ error: "Failed to fetch technicians" });
    }
  });

  apiRouter.get("/technicians/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const technician = await storage.getTechnician(id);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }

      res.json(technician);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technician" });
    }
  });

  apiRouter.post("/technicians", async (req: Request, res: Response) => {
    try {
      const validatedData = insertTechnicianSchema.parse(req.body);
      const technician = await storage.createTechnician(validatedData);
      res.status(201).json(technician);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid technician data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create technician" });
    }
  });

  apiRouter.put("/technicians/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const validatedData = insertTechnicianSchema.partial().parse(req.body);
      const updatedTechnician = await storage.updateTechnician(id, validatedData);
      
      if (!updatedTechnician) {
        return res.status(404).json({ error: "Technician not found" });
      }

      res.json(updatedTechnician);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid technician data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update technician" });
    }
  });

  apiRouter.delete("/technicians/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const success = await storage.deleteTechnician(id);
      if (!success) {
        return res.status(404).json({ error: "Technician not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete technician" });
    }
  });

  // Inventory Items
  apiRouter.get("/inventory", async (req: Request, res: Response) => {
    try {
      const items = await storage.getInventoryItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  apiRouter.get("/inventory/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const item = await storage.getInventoryItem(id);
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory item" });
    }
  });

  apiRouter.post("/inventory", async (req: Request, res: Response) => {
    try {
      const validatedData = insertInventoryItemSchema.parse(req.body);
      const item = await storage.createInventoryItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid inventory item data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  apiRouter.put("/inventory/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const validatedData = insertInventoryItemSchema.partial().parse(req.body);
      const updatedItem = await storage.updateInventoryItem(id, validatedData);
      
      if (!updatedItem) {
        return res.status(404).json({ error: "Inventory item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid inventory item data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  apiRouter.delete("/inventory/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const success = await storage.deleteInventoryItem(id);
      if (!success) {
        return res.status(404).json({ error: "Inventory item not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete inventory item" });
    }
  });

  apiRouter.post("/inventory/:id/adjust", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const { quantity } = req.body;
      if (typeof quantity !== 'number') {
        return res.status(400).json({ error: "Quantity must be a number" });
      }

      const updatedItem = await storage.adjustInventoryQuantity(id, quantity);
      if (!updatedItem) {
        return res.status(404).json({ error: "Inventory item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to adjust inventory quantity" });
    }
  });

  // Repairs
  apiRouter.get("/repairs", async (req: Request, res: Response) => {
    try {
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      const technicianId = req.query.technicianId ? parseInt(req.query.technicianId as string) : undefined;
      const status = req.query.status as string;
      const priority = req.query.priority as string;
      const orgId = (global as any).currentOrganizationId;
      
      console.log(`GET /repairs with query params: ${JSON.stringify({ customerId, technicianId, status, priority })} for organization: ${orgId}`);
      
      // Filter by customer first if specified
      if (customerId) {
        const repairs = await storage.getRepairsByCustomer(customerId);
        console.log(`Found ${repairs.length} repairs for customer ${customerId}`);
        return res.json(repairs);
      }
      
      // Filter by technician if specified
      if (technicianId) {
        const repairs = await storage.getRepairsByTechnician(technicianId);
        console.log(`Found ${repairs.length} repairs for technician ${technicianId}`);
        return res.json(repairs);
      }
      
      // Filter by status if it's a valid status and is actually provided
      if (status && status.length > 0 && repairStatuses.includes(status as any)) {
        console.log(`Filtering repairs by status: ${status}`);
        const repairs = await storage.getRepairsByStatus(status as any);
        console.log(`Found ${repairs.length} repairs with status: ${status}`);
        return res.json(repairs);
      }
      
      // Filter by priority if it's provided
      if (priority) {
        console.log(`Filtering repairs by priority: ${priority}`);
        // Check if it's an array (comma-separated values) or a single value
        if (priority.includes(',')) {
          // Handle array of priorities
          const priorityLevels = priority.split(',').map(p => parseInt(p.trim()));
          const repairs = await storage.getRepairsByPriority(priorityLevels);
          console.log(`Found ${repairs.length} repairs with priorities: ${priorityLevels.join(', ')}`);
          return res.json(repairs);
        } else {
          // Handle single priority
          const priorityLevel = parseInt(priority);
          const repairs = await storage.getRepairsByPriority(priorityLevel);
          console.log(`Found ${repairs.length} repairs with priority: ${priorityLevel}`);
          return res.json(repairs);
        }
      }
      
      // If no filters are active, return all repairs
      console.log(`Getting all repairs for organization: ${orgId}`);
      const repairs = await storage.getRepairs();
      console.log(`Found ${repairs.length} total repairs for organization: ${orgId}`);
      res.json(repairs);
    } catch (error) {
      console.error("Error fetching repairs:", error);
      res.status(500).json({ error: "Failed to fetch repairs" });
    }
  });

  apiRouter.get("/repairs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const repair = await storage.getRepair(id);
      if (!repair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      res.json(repair);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repair" });
    }
  });

  apiRouter.get("/repairs/:id/details", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      // First, check if the basic repair exists
      const repair = await storage.getRepair(id);
      if (!repair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      try {
        const repairDetails = await storage.getRepairWithRelations(id);
        if (!repairDetails) {
          return res.status(404).json({ error: "Repair details not found" });
        }
        res.json(repairDetails);
      } catch (detailsError) {
        console.error(`Error fetching repair details for repair ID ${id}:`, detailsError);
        
        // If we can't get the full details, return the basic repair info instead
        // This prevents the UI from showing an error
        const basicRepair = await storage.getRepair(id);
        const items = await storage.getRepairItems(id);
        
        // Return a simplified version with just the basic repair and items
        return res.json({
          ...basicRepair,
          items: items || [],
          customer: null, // These will be populated by the UI from other sources if needed
          device: null,
          technician: null,
          quote: null,
          invoice: null
        });
      }
    } catch (error) {
      console.error("Failed to fetch repair details:", error);
      res.status(500).json({ error: "Failed to fetch repair details" });
    }
  });

  apiRouter.post("/repairs", async (req: Request, res: Response) => {
    try {
      const orgId = (global as any).currentOrganizationId;
      console.log(`Creating repair with organization context: ${orgId}`);
      
      const validatedData = insertRepairSchema.parse(req.body);
      console.log("Repair data validated successfully:", validatedData);
      
      const repair = await storage.createRepair(validatedData);
      console.log("Repair created successfully:", repair);
      
      res.status(201).json(repair);
    } catch (error) {
      console.error("Error creating repair:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid repair data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create repair" });
    }
  });

  apiRouter.put("/repairs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      // Allow partial updates for repair
      const validatedData = insertRepairSchema.partial().parse(req.body);
      
      // Ensure the status is properly typed
      if (validatedData.status) {
        const repairData = {
          ...validatedData,
          status: validatedData.status as (typeof repairStatuses)[number]
        };
        const updatedRepair = await storage.updateRepair(id, repairData);
        
        if (!updatedRepair) {
          return res.status(404).json({ error: "Repair not found" });
        }
        
        res.json(updatedRepair);
      } else {
        const updatedRepair = await storage.updateRepair(id, validatedData);
        
        if (!updatedRepair) {
          return res.status(404).json({ error: "Repair not found" });
        }
        
        res.json(updatedRepair);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid repair data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update repair" });
    }
  });

  apiRouter.delete("/repairs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const success = await storage.deleteRepair(id);
      if (!success) {
        return res.status(404).json({ error: "Repair not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete repair" });
    }
  });

  // Repair Items
  apiRouter.get("/repairs/:repairId/items", async (req: Request, res: Response) => {
    try {
      const repairId = parseInt(req.params.repairId);
      if (isNaN(repairId)) {
        return res.status(400).json({ error: "Invalid repair ID format" });
      }

      const items = await storage.getRepairItems(repairId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repair items" });
    }
  });
  
  // Get single repair item
  apiRouter.get("/repairs/:repairId/items/:id", async (req: Request, res: Response) => {
    try {
      const repairId = parseInt(req.params.repairId);
      const itemId = parseInt(req.params.id);
      
      if (isNaN(repairId) || isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const item = await storage.getRepairItem(itemId);
      
      if (!item) {
        return res.status(404).json({ error: "Repair item not found" });
      }
      
      // Verify the item belongs to the specified repair
      if (item.repairId !== repairId) {
        return res.status(404).json({ error: "Repair item not found in this repair" });
      }
      
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repair item" });
    }
  });

  apiRouter.post("/repairs/:repairId/items", async (req: Request, res: Response) => {
    try {
      const repairId = parseInt(req.params.repairId);
      if (isNaN(repairId)) {
        return res.status(400).json({ error: "Invalid repair ID format" });
      }

      const repair = await storage.getRepair(repairId);
      if (!repair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      const validatedData = insertRepairItemSchema.parse({
        ...req.body,
        repairId,
      });

      const item = await storage.createRepairItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid repair item data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create repair item" });
    }
  });

  apiRouter.put("/repairs/:repairId/items/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const repairId = parseInt(req.params.repairId);
      if (isNaN(id) || isNaN(repairId)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const repair = await storage.getRepair(repairId);
      if (!repair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      const validatedData = insertRepairItemSchema.partial().parse(req.body);
      const updatedItem = await storage.updateRepairItem(id, validatedData);
      
      if (!updatedItem) {
        return res.status(404).json({ error: "Repair item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid repair item data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update repair item" });
    }
  });

  apiRouter.delete("/repairs/:repairId/items/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const repairId = parseInt(req.params.repairId);
      if (isNaN(id) || isNaN(repairId)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const repair = await storage.getRepair(repairId);
      if (!repair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      const success = await storage.deleteRepairItem(id);
      if (!success) {
        return res.status(404).json({ error: "Repair item not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete repair item" });
    }
  });

  // Quotes
  apiRouter.get("/quotes", async (req: Request, res: Response) => {
    try {
      const repairId = req.query.repairId ? parseInt(req.query.repairId as string) : undefined;
      
      if (repairId) {
        const quotes = await storage.getQuotesByRepair(repairId);
        return res.json(quotes);
      }
      
      const quotes = await storage.getQuotes();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  apiRouter.get("/quotes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  apiRouter.post("/quotes", async (req: Request, res: Response) => {
    try {
      console.log("Received quote data:", JSON.stringify(req.body));
      // First try to validate
      try {
        const validatedData = insertQuoteSchema.parse(req.body);
        console.log("Validated quote data:", JSON.stringify(validatedData));
        
        // Check for items data
        if (validatedData.itemsData) {
          console.log("Quote includes itemsData:", validatedData.itemsData);
          try {
            const parsedItems = JSON.parse(validatedData.itemsData);
            console.log("Parsed itemsData successfully, contains", parsedItems.length, "items");
          } catch (parseError) {
            console.error("Failed to parse itemsData:", parseError);
          }
        }
        
        const quote = await storage.createQuote(validatedData);
        console.log("Quote created successfully with ID:", quote.id);
        res.status(201).json(quote);
      } catch (validationError) {
        console.error("Quote validation error:", validationError);
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({ 
            error: "Invalid quote data", 
            details: validationError.errors,
            receivedData: req.body 
          });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Quote creation error:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  apiRouter.put("/quotes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      console.log("Updating quote with ID:", id);
      console.log("Received update data:", JSON.stringify(req.body));
      
      const validatedData = insertQuoteSchema.partial().parse(req.body);
      console.log("Validated quote update data:", JSON.stringify(validatedData));
      
      // Check for items data
      if (validatedData.itemsData) {
        console.log("Quote update includes itemsData:", validatedData.itemsData);
        try {
          const parsedItems = JSON.parse(validatedData.itemsData);
          console.log("Parsed update itemsData successfully, contains", parsedItems.length, "items");
        } catch (parseError) {
          console.error("Failed to parse update itemsData:", parseError);
        }
      }
      
      const updatedQuote = await storage.updateQuote(id, validatedData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      console.log("Quote updated successfully:", updatedQuote.id);
      res.json(updatedQuote);
    } catch (error) {
      console.error("Quote update error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid quote data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update quote" });
    }
  });

  apiRouter.delete("/quotes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const success = await storage.deleteQuote(id);
      if (!success) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  // Invoices
  apiRouter.get("/invoices", async (req: Request, res: Response) => {
    try {
      const repairId = req.query.repairId ? parseInt(req.query.repairId as string) : undefined;
      
      if (repairId) {
        const invoices = await storage.getInvoicesByRepair(repairId);
        return res.json(invoices);
      }
      
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  apiRouter.get("/invoices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  apiRouter.post("/invoices", async (req: Request, res: Response) => {
    try {
      console.log("Received invoice data:", JSON.stringify(req.body));
      const validatedData = insertInvoiceSchema.parse(req.body);
      console.log("Validated invoice data:", JSON.stringify(validatedData));
      
      // Check for items data
      if (validatedData.itemsData) {
        console.log("Invoice includes itemsData:", validatedData.itemsData);
        try {
          const parsedItems = JSON.parse(validatedData.itemsData);
          console.log("Parsed itemsData successfully, contains", parsedItems.length, "items");
        } catch (parseError) {
          console.error("Failed to parse itemsData:", parseError);
        }
      }
      
      const invoice = await storage.createInvoice(validatedData);
      console.log("Invoice created successfully with ID:", invoice.id);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Invoice creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid invoice data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  apiRouter.put("/invoices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      console.log("Updating invoice with ID:", id);
      console.log("Received update data:", JSON.stringify(req.body));
      
      const validatedData = insertInvoiceSchema.partial().parse(req.body);
      console.log("Validated invoice update data:", JSON.stringify(validatedData));
      
      // Check for items data
      if (validatedData.itemsData) {
        console.log("Invoice update includes itemsData:", validatedData.itemsData);
        try {
          const parsedItems = JSON.parse(validatedData.itemsData);
          console.log("Parsed update itemsData successfully, contains", parsedItems.length, "items");
        } catch (parseError) {
          console.error("Failed to parse update itemsData:", parseError);
        }
      }
      
      const updatedInvoice = await storage.updateInvoice(id, validatedData);
      
      if (!updatedInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      console.log("Invoice updated successfully:", updatedInvoice.id);
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Invoice update error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid invoice data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  apiRouter.delete("/invoices/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const success = await storage.deleteInvoice(id);
      if (!success) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // Mark invoice as paid
  apiRouter.post("/invoices/:id/pay", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const { paymentMethod, paymentIntentId } = req.body;
      if (!paymentMethod) {
        return res.status(400).json({ error: "Payment method is required" });
      }

      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // If payment was made via Stripe, verify the payment intent is successful
      if (paymentMethod === "credit_card" && paymentIntentId && stripe) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          if (paymentIntent.status !== "succeeded") {
            return res.status(400).json({ error: "Payment has not been completed" });
          }
        } catch (stripeError) {
          console.error("Error verifying Stripe payment:", stripeError);
          return res.status(400).json({ error: "Could not verify payment" });
        }
      }

      const updatedInvoice = await storage.updateInvoice(id, {
        status: "paid",
        datePaid: new Date(),
        paymentMethod,
        stripePaymentIntentId: paymentIntentId || null
      });

      // Also update the repair status to completed if it's ready for pickup
      const repair = await storage.getRepair(invoice.repairId);
      if (repair && repair.status === "ready_for_pickup") {
        await storage.updateRepair(repair.id, {
          status: "completed",
          actualCompletionDate: new Date(),
        });
      }

      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(500).json({ error: "Failed to process payment" });
    }
  });
  
  // Stripe webhook handler for payment confirmations
  apiRouter.post("/stripe-webhook", express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    if (!stripe) {
      return res.status(400).json({ error: "Stripe is not configured" });
    }

    const sig = req.headers['stripe-signature'];

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ error: "Stripe webhook signature or secret is missing" });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Extract the invoice ID from metadata
      const invoiceId = paymentIntent.metadata?.invoiceId;
      if (invoiceId) {
        const id = parseInt(invoiceId);
        if (!isNaN(id)) {
          try {
            const invoice = await storage.getInvoice(id);
            if (invoice && invoice.status !== "paid") {
              // Update the invoice to paid
              await storage.updateInvoice(id, {
                status: "paid",
                datePaid: new Date(),
                paymentMethod: "credit_card",
                stripePaymentIntentId: paymentIntent.id
              });
              
              // Update the repair status if needed
              const repair = await storage.getRepair(invoice.repairId);
              if (repair && repair.status === "ready_for_pickup") {
                await storage.updateRepair(repair.id, {
                  status: "completed",
                  actualCompletionDate: new Date(),
                });
              }
            }
          } catch (error) {
            console.error("Error processing webhook payment:", error);
          }
        }
      }
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  });

  // Email Quote to Customer
  apiRouter.post("/quotes/:id/email", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid quote ID format" });
      }

      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Get the repair
      const repair = await storage.getRepair(quote.repairId);
      if (!repair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      // Get the customer
      const customer = await storage.getCustomer(repair.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Get repair items (these will be used as a fallback if itemsData is not available)
      const items = await storage.getRepairItems(repair.id);
      
      console.log(`Sending quote email for quote #${quote.quoteNumber}, repair #${repair.ticketNumber}`);
      
      // Check for itemsData
      if (quote.itemsData) {
        console.log("Quote email: Using itemsData for items");
        try {
          const parsedItems = JSON.parse(quote.itemsData);
          console.log(`Quote email: Found ${parsedItems.length} items in itemsData`);
        } catch (parseError) {
          console.error("Quote email: Failed to parse itemsData:", parseError);
        }
      } else if (quote.itemIds) {
        console.log("Quote email: Using legacy itemIds format");
      } else {
        console.log("Quote email: No item data found, using all repair items as fallback");
      }

      // Generate email HTML
      const emailHtml = generateQuoteEmail(quote, customer, repair, items);

      // Setup email data
      const emailData: EmailData = {
        to: customer.email,
        from: process.env.SENDGRID_FROM_EMAIL || "service@repairshop.com", // Should be configured in .env
        subject: `Quote #${quote.quoteNumber} for your repair`,
        html: emailHtml
      };

      // Send email
      const success = await sendEmail(emailData);
      if (!success) {
        if (!process.env.SENDGRID_API_KEY) {
          return res.status(400).json({ 
            error: "Email configuration missing", 
            message: "SENDGRID_API_KEY is not configured"
          });
        }
        return res.status(500).json({ error: "Failed to send email" });
      }

      console.log("Quote email sent successfully to:", customer.email);
      res.json({ success: true, message: "Quote email sent successfully" });
    } catch (error) {
      console.error("Error sending quote email:", error);
      res.status(500).json({ error: "Failed to send quote email" });
    }
  });

  // Email Invoice to Customer
  apiRouter.post("/invoices/:id/email", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice ID format" });
      }

      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Get the repair
      const repair = await storage.getRepair(invoice.repairId);
      if (!repair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      // Get the customer
      const customer = await storage.getCustomer(repair.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Get repair items (these will be used as a fallback if itemsData is not available)
      const items = await storage.getRepairItems(repair.id);
      
      console.log(`Sending invoice email for invoice #${invoice.invoiceNumber}, repair #${repair.ticketNumber}`);
      
      // Check for itemsData
      if (invoice.itemsData) {
        console.log("Invoice email: Using itemsData for items");
        try {
          const parsedItems = JSON.parse(invoice.itemsData);
          console.log(`Invoice email: Found ${parsedItems.length} items in itemsData`);
        } catch (parseError) {
          console.error("Invoice email: Failed to parse itemsData:", parseError);
        }
      } else if (invoice.itemIds) {
        console.log("Invoice email: Using legacy itemIds format");
      } else {
        console.log("Invoice email: No item data found, using all repair items as fallback");
      }

      // Generate email HTML
      const emailHtml = generateInvoiceEmail(invoice, customer, repair, items);

      // Setup email data
      const emailData: EmailData = {
        to: customer.email,
        from: process.env.SENDGRID_FROM_EMAIL || "service@repairshop.com", // Should be configured in .env
        subject: `Invoice #${invoice.invoiceNumber} for your repair`,
        html: emailHtml
      };

      // Send email
      const success = await sendEmail(emailData);
      if (!success) {
        if (!process.env.SENDGRID_API_KEY) {
          return res.status(400).json({ 
            error: "Email configuration missing", 
            message: "SENDGRID_API_KEY is not configured"
          });
        }
        return res.status(500).json({ error: "Failed to send email" });
      }

      console.log("Invoice email sent successfully to:", customer.email);
      res.json({ success: true, message: "Invoice email sent successfully" });
    } catch (error) {
      console.error("Error sending invoice email:", error);
      res.status(500).json({ error: "Failed to send invoice email" });
    }
  });
  
  // Create a payment intent for Stripe
  apiRouter.post("/invoices/:id/create-payment-intent", async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(400).json({ 
          error: "Payment processing unavailable", 
          message: "Stripe is not configured. Please set the STRIPE_SECRET_KEY environment variable." 
        });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice ID format" });
      }

      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Get the repair
      const repair = await storage.getRepair(invoice.repairId);
      if (!repair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      // Get the customer
      const customer = await storage.getCustomer(repair.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Get currency information
      let currencyCode = "usd"; // Default fallback
      if (invoice.currencyCode) {
        // Use invoice currency if set
        currencyCode = invoice.currencyCode.toLowerCase();
      } else {
        // Get default currency
        const [defaultCurrency] = await db.select().from(currencies).where(eq(currencies.isDefault, true));
        if (defaultCurrency) {
          currencyCode = defaultCurrency.code.toLowerCase();
        }
      }
      
      // Create a payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(invoice.total * 100), // Convert to cents
        currency: currencyCode,
        metadata: {
          invoiceId: invoice.id.toString(),
          repairId: repair.id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerEmail: customer.email
        },
        receipt_email: customer.email,
        description: `Invoice #${invoice.invoiceNumber} for Repair #${repair.ticketNumber}`
      });

      // Return the client secret to the client
      res.json({ 
        clientSecret: paymentIntent.client_secret 
      });

    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // Settings API - Currencies - Fixed GET method with auth bypass for debugging
  apiRouter.get("/settings/currencies", async (req: Request, res: Response) => {
    try {
      console.log("Getting currencies for organization ID:", (global as any).currentOrganizationId);
      
      // Get organization-specific currencies or global ones
      const allCurrencies = await db.select().from(currencies)
        .where(
          // Get either organization-specific currencies or global ones
          sql`(${currencies.organizationId} = ${(global as any).currentOrganizationId} OR ${currencies.organizationId} IS NULL)`
        );
      
      console.log("Currencies found:", allCurrencies.length, allCurrencies);
      return res.json(allCurrencies);
    } catch (error: any) {
      console.error("Error fetching currencies:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.get("/settings/currencies/default", async (req: Request, res: Response) => {
    try {
      console.log("Getting default currency for organization ID:", (global as any).currentOrganizationId);
      
      // Get organization-specific currencies or global ones
      const orgCurrencies = await db.select().from(currencies)
        .where(
          sql`(${currencies.organizationId} = ${(global as any).currentOrganizationId} OR ${currencies.organizationId} IS NULL)`
        );
        
      // First try to find a default currency specific to this organization
      let defaultCurrency = orgCurrencies.find(currency => 
        currency.isDefault === true && 
        currency.organizationId === (global as any).currentOrganizationId
      );
      
      // If no org-specific default, try to find a global default
      if (!defaultCurrency) {
        defaultCurrency = orgCurrencies.find(currency => 
          currency.isDefault === true && 
          (currency.organizationId === null || currency.organizationId === undefined)
        );
      }
      
      // If no default at all, try to find USD in the org currencies
      if (!defaultCurrency) {
        const usdCurrency = orgCurrencies.find(currency => currency.code === "USD");
        return res.json(usdCurrency || { code: "USD", symbol: "$", name: "US Dollar" });
      }
      
      return res.json(defaultCurrency);
    } catch (error: any) {
      console.error("Error fetching default currency:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.post("/settings/currencies", async (req: Request, res: Response) => {
    try {
      const { code, name, symbol, isDefault } = req.body;
      const organizationId = (global as any).currentOrganizationId;
      
      console.log(`Creating currency for organization ID: ${organizationId}`);
      
      // If setting as default, unset any existing defaults for this organization
      if (isDefault) {
        await db.update(currencies)
          .set({ isDefault: false })
          .where(
            and(
              eq(currencies.isDefault, true),
              eq(currencies.organizationId, organizationId)
            )
          );
      }
      
      const [currency] = await db.insert(currencies)
        .values({ 
          code, 
          name, 
          symbol, 
          isDefault,
          organizationId 
        })
        .returning();
        
      res.status(201).json(currency);
    } catch (error: any) {
      console.error("Error creating currency:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.put("/settings/currencies/:code", async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const { name, symbol, isDefault } = req.body;
      const organizationId = (global as any).currentOrganizationId;
      
      console.log(`Updating currency for organization ID: ${organizationId}`);
      
      // If setting as default, unset any existing defaults for this organization
      if (isDefault) {
        await db.update(currencies)
          .set({ isDefault: false })
          .where(
            and(
              eq(currencies.isDefault, true),
              eq(currencies.organizationId, organizationId)
            )
          );
      }
      
      const [updatedCurrency] = await db.update(currencies)
        .set({ name, symbol, isDefault })
        .where(
          and(
            eq(currencies.code, code),
            eq(currencies.organizationId, organizationId)
          )
        )
        .returning();
        
      if (!updatedCurrency) {
        return res.status(404).json({ error: "Currency not found for this organization" });
      }
      
      res.json(updatedCurrency);
    } catch (error: any) {
      console.error("Error updating currency:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.delete("/settings/currencies/:code", async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const organizationId = (global as any).currentOrganizationId;
      
      console.log(`Deleting currency for organization ID: ${organizationId}`);
      
      // Check if currency is in use within this organization
      const quotesUsingCurrency = await db.select({ count: sql`count(*)` })
        .from(quotes)
        .where(
          and(
            eq(quotes.currencyCode, code),
            eq(quotes.organizationId, organizationId)
          )
        );
        
      const invoicesUsingCurrency = await db.select({ count: sql`count(*)` })
        .from(invoices)
        .where(
          and(
            eq(invoices.currencyCode, code),
            eq(invoices.organizationId, organizationId)
          )
        );
        
      if (quotesUsingCurrency[0].count > 0 || invoicesUsingCurrency[0].count > 0) {
        return res.status(400).json({ 
          error: "Cannot delete currency that is in use by quotes or invoices" 
        });
      }
      
      // Check if it's the default currency for this organization
      const [currencyToDelete] = await db.select()
        .from(currencies)
        .where(
          and(
            eq(currencies.code, code),
            eq(currencies.organizationId, organizationId)
          )
        );
        
      if (!currencyToDelete) {
        return res.status(404).json({ 
          error: "Currency not found for this organization" 
        });
      }
        
      if (currencyToDelete?.isDefault) {
        return res.status(400).json({ 
          error: "Cannot delete the default currency. Set another currency as default first." 
        });
      }
      
      await db.delete(currencies)
        .where(
          and(
            eq(currencies.code, code),
            eq(currencies.organizationId, organizationId)
          )
        );
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Settings API - Tax Rates
  apiRouter.get("/settings/tax-rates", async (req: Request, res: Response) => {
    try {
      console.log("Getting tax rates for organization ID:", (global as any).currentOrganizationId);
      
      // Get organization-specific tax rates or global ones
      const allTaxRates = await db.select().from(taxRates)
        .where(
          // Get either organization-specific tax rates or global ones
          sql`(${taxRates.organizationId} = ${(global as any).currentOrganizationId} OR ${taxRates.organizationId} IS NULL)`
        );
      
      console.log("Tax rates found:", allTaxRates.length, allTaxRates);
      return res.json(allTaxRates);
    } catch (error: any) {
      console.error("Error fetching tax rates:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.get("/settings/tax-rates/default", async (req: Request, res: Response) => {
    try {
      console.log("Getting default tax rate for organization ID:", (global as any).currentOrganizationId);
      
      // Get organization-specific tax rates or global ones
      const orgTaxRates = await db.select().from(taxRates)
        .where(
          sql`(${taxRates.organizationId} = ${(global as any).currentOrganizationId} OR ${taxRates.organizationId} IS NULL)`
        );
      
      // First try to find a default tax rate specific to this organization
      let defaultTaxRate = orgTaxRates.find(rate => 
        rate.isDefault === true && 
        rate.organizationId === (global as any).currentOrganizationId
      );
      
      // If no org-specific default, try to find a global default
      if (!defaultTaxRate) {
        defaultTaxRate = orgTaxRates.find(rate => 
          rate.isDefault === true && 
          (rate.organizationId === null || rate.organizationId === undefined)
        );
      }
      
      // If no default at all, fall back to first tax rate or provide a default
      if (!defaultTaxRate) {
        const firstTaxRate = orgTaxRates[0];
        return res.json(firstTaxRate || { rate: 0, name: "No Tax" });
      }
      
      return res.json(defaultTaxRate);
    } catch (error: any) {
      console.error("Error fetching default tax rate:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.post("/settings/tax-rates", async (req: Request, res: Response) => {
    try {
      const { countryCode, regionCode, name, rate, isDefault } = req.body;
      const organizationId = (global as any).currentOrganizationId;
      
      console.log(`Creating tax rate for organization ID: ${organizationId}`);
      
      // If setting as default, unset any existing defaults for this organization
      if (isDefault) {
        await db.update(taxRates)
          .set({ isDefault: false })
          .where(
            and(
              eq(taxRates.isDefault, true),
              eq(taxRates.organizationId, organizationId)
            )
          );
      }
      
      const [taxRate] = await db.insert(taxRates)
        .values({ 
          countryCode, 
          regionCode, 
          name, 
          rate, 
          isDefault,
          organizationId 
        })
        .returning();
        
      res.status(201).json(taxRate);
    } catch (error: any) {
      console.error("Error creating tax rate:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.put("/settings/tax-rates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { countryCode, regionCode, name, rate, isDefault } = req.body;
      const organizationId = (global as any).currentOrganizationId;
      
      console.log(`Updating tax rate for organization ID: ${organizationId}`);
      
      // If setting as default, unset any existing defaults for this organization
      if (isDefault) {
        await db.update(taxRates)
          .set({ isDefault: false })
          .where(
            and(
              eq(taxRates.isDefault, true),
              eq(taxRates.organizationId, organizationId)
            )
          );
      }
      
      const [updatedTaxRate] = await db.update(taxRates)
        .set({ countryCode, regionCode, name, rate, isDefault })
        .where(
          and(
            eq(taxRates.id, id),
            eq(taxRates.organizationId, organizationId)
          )
        )
        .returning();
        
      if (!updatedTaxRate) {
        return res.status(404).json({ error: "Tax rate not found for this organization" });
      }
      
      res.json(updatedTaxRate);
    } catch (error: any) {
      console.error("Error updating tax rate:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.delete("/settings/tax-rates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const organizationId = (global as any).currentOrganizationId;
      
      console.log(`Deleting tax rate for organization ID: ${organizationId}`);
      
      // Check if tax rate is in use within this organization
      const quotesUsingTaxRate = await db.select({ count: sql`count(*)` })
        .from(quotes)
        .where(
          and(
            eq(quotes.taxRateId, id),
            eq(quotes.organizationId, organizationId)
          )
        );
        
      const invoicesUsingTaxRate = await db.select({ count: sql`count(*)` })
        .from(invoices)
        .where(
          and(
            eq(invoices.taxRateId, id),
            eq(invoices.organizationId, organizationId)
          )
        );
        
      if (quotesUsingTaxRate[0].count > 0 || invoicesUsingTaxRate[0].count > 0) {
        return res.status(400).json({ 
          error: "Cannot delete tax rate that is in use by quotes or invoices" 
        });
      }
      
      // Check if it's the default tax rate for this organization
      const [taxRateToDelete] = await db.select()
        .from(taxRates)
        .where(
          and(
            eq(taxRates.id, id),
            eq(taxRates.organizationId, organizationId)
          )
        );
        
      if (!taxRateToDelete) {
        return res.status(404).json({ 
          error: "Tax rate not found for this organization" 
        });
      }
        
      if (taxRateToDelete?.isDefault) {
        return res.status(400).json({ 
          error: "Cannot delete the default tax rate. Set another tax rate as default first." 
        });
      }
      
      await db.delete(taxRates)
        .where(
          and(
            eq(taxRates.id, id),
            eq(taxRates.organizationId, organizationId)
          )
        );
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Organization settings endpoint for onboarding
  apiRouter.post("/settings/organization", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const { type, ...data } = req.body;
      
      // Log the request details for debugging
      console.log('DEBUG: Settings for organization:', req.organizationId, 'type:', type, 'isDevelopmentMode:', process.env.NODE_ENV === 'development');
      console.log('Received data:', JSON.stringify(data, null, 2));
      
      // Special handling for development mode
      const authHeader = req.headers.authorization;
      const isDevelopmentMode = process.env.NODE_ENV === 'development' && 
        authHeader && authHeader.startsWith('Bearer dev-token-');
      
      // For new organizations during onboarding, get the organization ID from user organizations
      let organizationId = isDevelopmentMode ? 1 : req.organizationId;
      
      // If organization ID is not set and we're not in development mode, try to find user's organization
      if (!organizationId && !isDevelopmentMode && req.user) {
        try {
          console.log('No organization ID found on request, searching for user organizations');
          
          // Find the user's organization
          const userOrgs = await db
            .select()
            .from(organizationUsers)
            .where(eq(organizationUsers.userId, req.user.uid))
            .orderBy(desc(organizationUsers.createdAt));
            
          if (userOrgs.length > 0) {
            const userOrg = userOrgs[0]; // Use the most recently created one
            organizationId = userOrg.organizationId;
            console.log(`Found organization ${organizationId} for user ${req.user.uid}`);
            
            // Set for this request
            req.organizationId = organizationId;
            (global as any).currentOrganizationId = organizationId;
          } else {
            console.log('No organizations found for user, creating new one');
            
            // If this is a company profile setup, create an organization
            if (type === 'company' && data.name) {
              try {
                console.log('Creating new organization with name:', data.name);
                
                // The addOrganizationContext middleware should handle this, 
                // but as a fallback we'll do it here too
                const [newOrg] = await db
                  .insert(organizations)
                  .values({
                    name: data.name,
                    slug: data.name.toLowerCase().replace(/\s+/g, '-'),
                    ownerId: req.user.uid,
                    settings: {}
                  })
                  .returning();
                
                // Link the user to the organization
                await db
                  .insert(organizationUsers)
                  .values({
                    userId: req.user.uid,
                    organizationId: newOrg.id,
                    role: 'owner',
                    inviteAccepted: true
                  });
                
                organizationId = newOrg.id;
                req.organizationId = organizationId;
                (global as any).currentOrganizationId = organizationId;
                
                console.log(`Created new organization '${newOrg.name}' with ID ${newOrg.id} as fallback`);
              } catch (createOrgError) {
                console.error('Error creating new organization in settings endpoint:', createOrgError);
              }
            }
          }
        } catch (orgError) {
          console.error('Error finding user organization:', orgError);
        }
      }
      
      console.log(`Processing settings for organization: ${organizationId}, type: ${type}, isDevelopmentMode: ${isDevelopmentMode}`);
      console.log(`Received data:`, JSON.stringify(data, null, 2));
      
      if (!organizationId) {
        return res.status(403).json({ message: "No organization selected" });
      }
      
      // For development mode, make sure the user and organization exist with defaults
      if (isDevelopmentMode) {
        try {
          // First check if dev user exists
          const existingUsers = await db.select().from(users).where(eq(users.id, 'dev-user-123'));
          
          if (existingUsers.length === 0) {
            console.log('Creating development user');
            // Create development user first
            await db.insert(users).values({
              id: 'dev-user-123',
              email: 'dev@example.com',
              name: 'Development User',
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
          
          // Now check for organization
          const existingOrgs = await db.select().from(organizations).where(eq(organizations.id, 1));
          if (existingOrgs.length === 0) {
            // Create default organization for development
            await db.insert(organizations).values({
              id: 1,
              name: 'Development Organization',
              slug: 'dev-org',
              createdAt: new Date(),
              updatedAt: new Date(),
              ownerId: 'dev-user-123',
              settings: {}
            });
            console.log('Created default development organization');
          }
        } catch (error) {
          console.error('Error setting up development environment:', error);
        }
      }
      
      // Handle different types of settings
      switch (type) {
        case 'company':
          // Update the organization name
          await db.update(organizations)
            .set({
              name: data.name,
              updatedAt: new Date()
            })
            .where(eq(organizations.id, organizationId));
            
          // Update the company contact details in the settings JSON - one SQL statement at a time
          // First get the current settings
          const orgResult = await db.select({ settings: organizations.settings })
            .from(organizations)
            .where(eq(organizations.id, organizationId));
            
          const currentSettings = orgResult[0]?.settings || {};
          
          // Create an updated settings object
          console.log('Company data received:', data);
          
          // Convert empty/null/undefined values to empty strings to avoid null in the database
          const email = data.email === null || data.email === undefined ? '' : data.email;
          const phone = data.phone === null || data.phone === undefined ? '' : data.phone;
          const address = data.address === null || data.address === undefined ? '' : data.address;
          
          const updatedSettings = {
            ...currentSettings,
            email: email,
            phone: phone,
            address: address
          };
          
          console.log('Final updated settings object to be saved:', JSON.stringify(updatedSettings));
          console.log('Updated settings object:', updatedSettings);
          
          // Update with the new settings object
          await db.update(organizations)
            .set({
              settings: updatedSettings,
              updatedAt: new Date()
            })
            .where(eq(organizations.id, organizationId));
          break;
          
        case 'tax':
          // For now, handle tax settings in the organization settings
          // First, get all existing tax rates
          const existingTaxRates = await db.execute(sql`SELECT * FROM tax_rates`);
          console.log('Existing tax rates:', existingTaxRates.rows);
          
          // Add new tax rates or update existing ones
          if (data.taxRates && Array.isArray(data.taxRates)) {
            // Validate the tax rates before inserting
            console.log('Tax rates before processing:', data.taxRates);
            
            // Ensure we have at least one default tax rate
            let hasDefault = data.taxRates.some(tax => tax.isDefault);
            if (!hasDefault && data.taxRates.length > 0) {
              data.taxRates[0].isDefault = true;
            }
            
            // If no tax rates, add/update with a default one
            if (data.taxRates.length === 0) {
              data.taxRates.push({
                name: 'Sales Tax',
                rate: 7.5,
                isDefault: true
              });
            }
            
            // First, set all tax rates to non-default
            await db.execute(sql`UPDATE tax_rates SET is_default = false`);
            
            // Then update or insert each tax rate
            for (const tax of data.taxRates) {
              // Ensure all required properties exist
              const name = tax.name || 'Sales Tax';
              const rate = typeof tax.rate === 'number' ? tax.rate : 0;
              const isDefault = !!tax.isDefault;
              
              console.log('Processing tax rate:', { name, rate, isDefault });
              
              // Check if we have existing records
              if (existingTaxRates.rows.length > 0) {
                // Update an existing tax rate
                await db.execute(sql`
                  UPDATE tax_rates 
                  SET name = ${name}, rate = ${rate}, is_default = ${isDefault}
                  WHERE id = ${existingTaxRates.rows[0].id}
                `);
              } else {
                // Insert new tax rate
                await db.execute(sql`
                  INSERT INTO tax_rates (name, rate, is_default) 
                  VALUES (${name}, ${rate}, ${isDefault})
                `);
              }
            }
          } else {
            // If taxRates is missing or not an array, update with a default one
            if (existingTaxRates.rows.length > 0) {
              await db.execute(sql`
                UPDATE tax_rates 
                SET name = 'Sales Tax', rate = 7.5, is_default = true
                WHERE id = ${existingTaxRates.rows[0].id}
              `);
            } else {
              await db.execute(sql`
                INSERT INTO tax_rates (name, rate, is_default) 
                VALUES ('Sales Tax', 7.5, true)
              `);
            }
          }
          break;
          
        case 'currency':
          // For now, handle currency settings globally
          // First, get all existing currencies
          const existingCurrencies = await db.execute(sql`SELECT * FROM currencies`);
          console.log('Existing currencies:', existingCurrencies.rows);
          
          // Set all currencies to non-default first
          await db.execute(sql`UPDATE currencies SET is_default = false`);
            
          // Add or update currency
          if (data.currency) {
            // Check if the currency already exists
            const existingCurrency = existingCurrencies.rows.find(
              c => c.code === data.currency.code
            );
            
            if (existingCurrency) {
              // Update existing currency
              await db.execute(sql`
                UPDATE currencies
                SET name = ${data.currency.name}, 
                    symbol = ${data.currency.symbol}, 
                    is_default = ${!!data.currency.isDefault}
                WHERE code = ${data.currency.code}
              `);
            } else {
              // Create a new currency code that doesn't conflict
              // First check if there are any currencies we can update
              if (existingCurrencies.rows.length > 0) {
                // Update the first currency we find
                await db.execute(sql`
                  UPDATE currencies
                  SET name = ${data.currency.name}, 
                      symbol = ${data.currency.symbol}, 
                      is_default = ${!!data.currency.isDefault}
                  WHERE code = ${existingCurrencies.rows[0].code}
                `);
              } else {
                // Insert new currency if there are none
                await db.execute(sql`
                  INSERT INTO currencies (code, symbol, name, is_default) 
                  VALUES (
                    ${data.currency.code}, 
                    ${data.currency.symbol}, 
                    ${data.currency.name}, 
                    ${!!data.currency.isDefault}
                  )
                `);
              }
            }
          }
          break;
          
        case 'technicians':
          // We need to insert technicians with firstName and lastName
          if (data.technicians && Array.isArray(data.technicians)) {
            for (const tech of data.technicians) {
              if (tech.name) {
                // Split the name into first and last name
                const nameParts = tech.name.trim().split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                
                // Generate a default email if none provided - required field
                const defaultEmail = `${firstName.toLowerCase()}@${organizationId}.example.com`;
                
                await db.execute(sql`
                  INSERT INTO technicians (
                    first_name, 
                    last_name, 
                    email, 
                    phone, 
                    role, 
                    is_active
                  ) 
                  VALUES (
                    ${firstName},
                    ${lastName},
                    ${tech.email || defaultEmail},
                    ${tech.phone || null},
                    ${tech.role || 'Technician'}, 
                    ${tech.isActive !== false}
                  )
                `);
              }
            }
          }
          break;
          
        case 'onboarding':
          console.log(`Setting onboarding complete for organization ${organizationId}`);
          
          // First get current settings
          const orgData = await db.select({ settings: organizations.settings })
            .from(organizations)
            .where(eq(organizations.id, organizationId));
            
          const currentOrgSettings = orgData[0]?.settings || {};
          console.log('Current org settings before onboarding update:', currentOrgSettings);
          
          // Create updated settings object with onboardingCompleted=true
          const updatedOrgSettings = {
            ...currentOrgSettings,
            onboardingCompleted: true
          };
          
          console.log('Updated org settings for onboarding:', updatedOrgSettings);
          
          // Using raw SQL for maximum compatibility in development mode
          const result = await db.execute(sql`
            UPDATE organizations 
            SET settings = ${JSON.stringify(updatedOrgSettings)}::jsonb,
                updated_at = ${new Date()}
            WHERE id = ${organizationId}
            RETURNING id, name, settings
          `);
          
          console.log('Update onboarding result:', result.rows[0]);
          break;
          
        default:
          return res.status(400).json({ message: "Invalid settings type" });
      }
      
      // Return the organization ID along with success status
      return res.json({ 
        success: true,
        organizationId: organizationId
      });
    } catch (error) {
      console.error("Error updating organization settings:", error);
      return res.status(500).json({ 
        message: "Failed to update organization settings", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete All Data endpoint
  // Trash management - view and restore deleted records
  apiRouter.get("/trash/customers", async (req: Request, res: Response) => {
    try {
      const deletedCustomers = await storage.getDeletedCustomers();
      res.json(deletedCustomers);
    } catch (error) {
      console.error("Error fetching deleted customers:", error);
      res.status(500).json({ error: "Failed to fetch deleted customers" });
    }
  });

  apiRouter.get("/trash/devices", async (req: Request, res: Response) => {
    try {
      const deletedDevices = await storage.getDeletedDevices();
      res.json(deletedDevices);
    } catch (error) {
      console.error("Error fetching deleted devices:", error);
      res.status(500).json({ error: "Failed to fetch deleted devices" });
    }
  });

  apiRouter.get("/trash/repairs", async (req: Request, res: Response) => {
    try {
      const deletedRepairs = await storage.getDeletedRepairs();
      res.json(deletedRepairs);
    } catch (error) {
      console.error("Error fetching deleted repairs:", error);
      res.status(500).json({ error: "Failed to fetch deleted repairs" });
    }
  });

  apiRouter.get("/trash/technicians", async (req: Request, res: Response) => {
    try {
      const deletedTechnicians = await storage.getDeletedTechnicians();
      res.json(deletedTechnicians);
    } catch (error) {
      console.error("Error fetching deleted technicians:", error);
      res.status(500).json({ error: "Failed to fetch deleted technicians" });
    }
  });

  apiRouter.get("/trash/inventory", async (req: Request, res: Response) => {
    try {
      const deletedInventoryItems = await storage.getDeletedInventoryItems();
      res.json(deletedInventoryItems);
    } catch (error) {
      console.error("Error fetching deleted inventory items:", error);
      res.status(500).json({ error: "Failed to fetch deleted inventory items" });
    }
  });

  apiRouter.get("/trash/quotes", async (req: Request, res: Response) => {
    try {
      const deletedQuotes = await storage.getDeletedQuotes();
      res.json(deletedQuotes);
    } catch (error) {
      console.error("Error fetching deleted quotes:", error);
      res.status(500).json({ error: "Failed to fetch deleted quotes" });
    }
  });

  apiRouter.get("/trash/invoices", async (req: Request, res: Response) => {
    try {
      const deletedInvoices = await storage.getDeletedInvoices();
      res.json(deletedInvoices);
    } catch (error) {
      console.error("Error fetching deleted invoices:", error);
      res.status(500).json({ error: "Failed to fetch deleted invoices" });
    }
  });

  // Restore endpoints
  apiRouter.post("/trash/customers/:id/restore", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const restoredCustomer = await storage.restoreCustomer(id);
      if (!restoredCustomer) {
        return res.status(404).json({ error: "Customer not found or could not be restored" });
      }

      res.json(restoredCustomer);
    } catch (error) {
      console.error("Error restoring customer:", error);
      res.status(500).json({ error: "Failed to restore customer" });
    }
  });

  apiRouter.post("/trash/devices/:id/restore", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const restoredDevice = await storage.restoreDevice(id);
      if (!restoredDevice) {
        return res.status(404).json({ error: "Device not found or could not be restored" });
      }

      res.json(restoredDevice);
    } catch (error) {
      console.error("Error restoring device:", error);
      res.status(500).json({ error: "Failed to restore device" });
    }
  });

  apiRouter.post("/trash/repairs/:id/restore", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const restoredRepair = await storage.restoreRepair(id);
      if (!restoredRepair) {
        return res.status(404).json({ error: "Repair not found or could not be restored" });
      }

      res.json(restoredRepair);
    } catch (error) {
      console.error("Error restoring repair:", error);
      res.status(500).json({ error: "Failed to restore repair" });
    }
  });

  apiRouter.post("/trash/technicians/:id/restore", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const restoredTechnician = await storage.restoreTechnician(id);
      if (!restoredTechnician) {
        return res.status(404).json({ error: "Technician not found or could not be restored" });
      }

      res.json(restoredTechnician);
    } catch (error) {
      console.error("Error restoring technician:", error);
      res.status(500).json({ error: "Failed to restore technician" });
    }
  });

  apiRouter.post("/trash/inventory/:id/restore", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const restoredItem = await storage.restoreInventoryItem(id);
      if (!restoredItem) {
        return res.status(404).json({ error: "Inventory item not found or could not be restored" });
      }

      res.json(restoredItem);
    } catch (error) {
      console.error("Error restoring inventory item:", error);
      res.status(500).json({ error: "Failed to restore inventory item" });
    }
  });

  apiRouter.post("/trash/quotes/:id/restore", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const restoredQuote = await storage.restoreQuote(id);
      if (!restoredQuote) {
        return res.status(404).json({ error: "Quote not found or could not be restored" });
      }

      res.json(restoredQuote);
    } catch (error) {
      console.error("Error restoring quote:", error);
      res.status(500).json({ error: "Failed to restore quote" });
    }
  });

  apiRouter.post("/trash/invoices/:id/restore", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const restoredInvoice = await storage.restoreInvoice(id);
      if (!restoredInvoice) {
        return res.status(404).json({ error: "Invoice not found or could not be restored" });
      }

      res.json(restoredInvoice);
    } catch (error) {
      console.error("Error restoring invoice:", error);
      res.status(500).json({ error: "Failed to restore invoice" });
    }
  });

  apiRouter.delete("/settings/delete-all-data", async (req: Request, res: Response) => {
    try {
      // Check if the request is from a development user (auth token or header)
      const authHeader = req.headers.authorization;
      let orgId = (global as any).currentOrganizationId;
      
      // If we have a dev token, ensure we use organization ID 1
      if (process.env.NODE_ENV === 'development' && authHeader && authHeader.startsWith('Bearer dev-token-')) {
        console.log('Development token detected, setting organization ID to 1 for data deletion');
        orgId = 1;
      }
      
      if (!orgId) {
        return res.status(400).json({ error: "No organization context found" });
      }
      
      console.log(`Starting data deletion for organization: ${orgId}`);
      
      // Use a single transaction with cascading deletes to handle foreign key constraints
      try {
        console.log(`Organization ${orgId}: Starting deletion with single transaction approach`);
        
        // Use a transaction to ensure all operations succeed or fail together
        await db.transaction(async (tx) => {
          // First, let's check what's in the database for this organization
          const customerCount = await tx.execute(sql`
            SELECT COUNT(*) FROM customers WHERE organization_id = ${orgId}
          `);
          console.log(`Organization ${orgId}: Found ${customerCount.rows[0].count} customers`);
          
          const repairCount = await tx.execute(sql`
            SELECT COUNT(*) FROM repairs WHERE organization_id = ${orgId}
          `);
          console.log(`Organization ${orgId}: Found ${repairCount.rows[0].count} repairs`);
          
          // 1. First delete repair items (they reference repairs)
          console.log(`Organization ${orgId}: Deleting repair items`);
          await tx.execute(sql`
            DELETE FROM repair_items 
            WHERE repair_id IN (
              SELECT id FROM repairs 
              WHERE organization_id = ${orgId}
            )
          `);
          
          // 2. Delete quotes (they reference repairs)
          console.log(`Organization ${orgId}: Deleting quotes`);
          await tx.execute(sql`
            DELETE FROM quotes 
            WHERE organization_id = ${orgId}
          `);
          
          // 3. Delete invoices (they reference repairs)
          console.log(`Organization ${orgId}: Deleting invoices`);
          await tx.execute(sql`
            DELETE FROM invoices 
            WHERE organization_id = ${orgId}
          `);
          
          // 4. Delete repairs (they reference customers)
          console.log(`Organization ${orgId}: Deleting repairs`);
          await tx.execute(sql`
            DELETE FROM repairs 
            WHERE organization_id = ${orgId}
          `);
          
          // 5. Delete devices (they reference customers)
          console.log(`Organization ${orgId}: Deleting devices`);
          await tx.execute(sql`
            DELETE FROM devices 
            WHERE organization_id = ${orgId}
          `);
          
          // 6. Delete customers
          console.log(`Organization ${orgId}: Deleting customers`);
          await tx.execute(sql`
            DELETE FROM customers 
            WHERE organization_id = ${orgId}
          `);
          
          // 7. Delete technicians
          console.log(`Organization ${orgId}: Deleting technicians`);
          await tx.execute(sql`
            DELETE FROM technicians 
            WHERE organization_id = ${orgId}
          `);
          
          // 8. Delete inventory items
          console.log(`Organization ${orgId}: Deleting inventory items`);
          await tx.execute(sql`
            DELETE FROM inventory_items 
            WHERE organization_id = ${orgId}
          `);
          
          console.log(`Organization ${orgId}: Transaction completed successfully`);
        });
        
        // Success!
        console.log(`Successfully deleted all data for organization: ${orgId}`);
        res.status(200).json({ 
          message: "All data has been deleted successfully",
          organizationId: orgId
        });
      } catch (sqlError: any) {
        console.error(`SQL Error while deleting data: ${sqlError.message}`);
        return res.status(500).json({ 
          error: sqlError.message || "Database error while deleting data",
          details: sqlError
        });
      }
    } catch (error: any) {
      console.error("Error deleting all data:", error);
      res.status(500).json({ error: error.message || "Failed to delete all data" });
    }
  });

  // Authentication routes
  apiRouter.get("/user", authenticateJWT, getCurrentUser);
  apiRouter.get("/organizations", authenticateJWT, getUserOrganizations);
  apiRouter.post("/organizations", authenticateJWT, createOrganization);
  apiRouter.post("/organizations/:organizationId/users", authenticateJWT, addUserToOrganization);
  apiRouter.get("/auth/accept-invite/:token", acceptOrganizationInvite);
  
  // Create a separate router for settings endpoints that don't require authentication
  const settingsRouter = express.Router();
  
  // Settings - Currencies
  settingsRouter.get("/currencies", async (req: Request, res: Response) => {
    try {
      // Get organization ID from global context or default to 1
      const orgId = (global as any).currentOrganizationId || 1;
      console.log(`Getting currencies for organization: ${orgId} (public router)`);
      
      const allCurrencies = await db.select()
        .from(currencies)
        .where(eq((currencies as any).organizationId, orgId));
      
      console.log(`Found ${allCurrencies.length} currencies for organization: ${orgId}`);
      res.json(allCurrencies);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      res.status(500).json({ message: "Error fetching currencies" });
    }
  });

  settingsRouter.get("/currencies/default", async (req: Request, res: Response) => {
    try {
      // Get organization ID from global context or default to 1
      const orgId = (global as any).currentOrganizationId || 1;
      console.log(`Getting default currency for organization: ${orgId} (public router)`);
      
      const [defaultCurrency] = await db.select()
        .from(currencies)
        .where(and(
          eq(currencies.isDefault, true),
          eq((currencies as any).organizationId, orgId)
        ));
      
      res.json(defaultCurrency || null);
    } catch (error) {
      console.error("Error fetching default currency:", error);
      res.status(500).json({ message: "Error fetching default currency" });
    }
  });

  // Settings - Tax Rates
  settingsRouter.get("/tax-rates", async (req: Request, res: Response) => {
    try {
      // Get organization ID from global context or default to 1
      const orgId = (global as any).currentOrganizationId || 1;
      console.log(`Getting tax rates for organization: ${orgId} (public router)`);
      
      const allTaxRates = await db.select()
        .from(taxRates)
        .where(eq((taxRates as any).organizationId, orgId));
      
      console.log(`Found ${allTaxRates.length} tax rates for organization: ${orgId}`);
      res.json(allTaxRates);
    } catch (error) {
      console.error("Error fetching tax rates:", error);
      res.status(500).json({ message: "Error fetching tax rates" });
    }
  });

  settingsRouter.get("/tax-rates/default", async (req: Request, res: Response) => {
    try {
      // Get organization ID from global context or default to 1
      const orgId = (global as any).currentOrganizationId || 1;
      console.log(`Getting default tax rate for organization: ${orgId} (public router)`);
      
      const [defaultTaxRate] = await db.select()
        .from(taxRates)
        .where(and(
          eq(taxRates.isDefault, true),
          eq((taxRates as any).organizationId, orgId)
        ));
      
      res.json(defaultTaxRate || null);
    } catch (error) {
      console.error("Error fetching default tax rate:", error);
      res.status(500).json({ message: "Error fetching default tax rate" });
    }
  });

  // Public Technicians endpoint
  app.get("/api/technicians", async (req, res) => {
    try {
      console.log("Getting technicians (public endpoint)");
      const allTechnicians = await db
        .select()
        .from(technicians)
        .where(
          and(
            eq(technicians.deleted, false)
          )
        );
      console.log("Technicians count:", allTechnicians.length);
      res.json(allTechnicians);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ message: "Error fetching technicians" });
    }
  });

  // Mount the settings router BEFORE applying authentication
  app.use("/api/settings", settingsRouter);

  // Authentication is already applied on the API router - don't duplicate it globally
  // app.use(authenticateJWT);
  // app.use(addOrganizationContext);
  
  // Stripe subscription endpoints
  if (stripe) {
    apiRouter.post("/subscriptions", authenticateJWT, async (req: Request, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: 'Not authenticated' });
        }
        
        const { organizationId, priceId } = req.body;
        
        if (!organizationId || !priceId) {
          return res.status(400).json({ message: 'Organization ID and price ID are required' });
        }
        
        // Get user and organization info
        const [user] = await db.select().from(users).where(eq(users.id, req.user.uid));
        const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
        
        if (!user || !organization) {
          return res.status(404).json({ message: 'User or organization not found' });
        }
        
        // Check if user has permission
        const [membership] = await db.select()
          .from(organizationUsers)
          .where(eq(organizationUsers.organizationId, organizationId))
          .where(eq(organizationUsers.userId, req.user.uid));
          
        if (!membership || membership.role !== 'owner') {
          return res.status(403).json({ message: 'Only organization owners can manage subscriptions' });
        }
        
        // Create or get Stripe customer
        let customerId = user.stripeCustomerId;
        
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: user.displayName || user.email,
            metadata: {
              userId: user.id,
              organizationId: organization.id.toString()
            }
          });
          
          customerId = customer.id;
          
          // Update user with Stripe customer ID
          await db.update(users)
            .set({ stripeCustomerId: customerId })
            .where(eq(users.id, user.id));
        }
        
        // Create a subscription
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            organizationId: organization.id.toString()
          }
        });
        
        // Update organization with subscription info
        await db.update(organizations)
          .set({ 
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            subscriptionTier: priceId.includes('basic') ? 'basic' : 
                             priceId.includes('premium') ? 'premium' : 
                             priceId.includes('enterprise') ? 'enterprise' : 'free',
            subscriptionExpiresAt: new Date(subscription.current_period_end * 1000)
          })
          .where(eq(organizations.id, organizationId));
        
        // Return the subscription details
        res.json({
          subscriptionId: subscription.id,
          clientSecret: (subscription.latest_invoice as any).payment_intent.client_secret,
          status: subscription.status
        });
      } catch (error: any) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ message: error.message || 'Error creating subscription' });
      }
    });
    
    // Stripe webhook handler for subscription events
    apiRouter.post("/webhooks/stripe", express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
      const sig = req.headers['stripe-signature'] as string;
      
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(500).json({ message: 'Stripe webhook secret not configured' });
      }
      
      try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        
        switch (event.type) {
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted':
            const subscription = event.data.object as any;
            
            // Update organization subscription status
            if (subscription.metadata && subscription.metadata.organizationId) {
              const organizationId = parseInt(subscription.metadata.organizationId);
              
              await db.update(organizations)
                .set({ 
                  subscriptionStatus: subscription.status,
                  subscriptionExpiresAt: new Date(subscription.current_period_end * 1000)
                })
                .where(eq(organizations.id, organizationId));
            }
            break;
            
          case 'invoice.payment_succeeded':
            const invoice = event.data.object as any;
            
            if (invoice.subscription) {
              const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
              
              if (subscription.metadata && subscription.metadata.organizationId) {
                const organizationId = parseInt(subscription.metadata.organizationId);
                
                await db.update(organizations)
                  .set({ 
                    subscriptionStatus: 'active',
                    subscriptionExpiresAt: new Date(subscription.current_period_end * 1000)
                  })
                  .where(eq(organizations.id, organizationId));
              }
            }
            break;
            
          case 'invoice.payment_failed':
            const failedInvoice = event.data.object as any;
            
            if (failedInvoice.subscription) {
              const subscription = await stripe.subscriptions.retrieve(failedInvoice.subscription);
              
              if (subscription.metadata && subscription.metadata.organizationId) {
                const organizationId = parseInt(subscription.metadata.organizationId);
                
                await db.update(organizations)
                  .set({ subscriptionStatus: 'past_due' })
                  .where(eq(organizations.id, organizationId));
              }
            }
            break;
        }
        
        res.json({ received: true });
      } catch (err: any) {
        console.error('Error processing webhook:', err);
        res.status(400).send(`Webhook Error: ${err.message}`);
      }
    });
  }
  
  // Mount API router - This needs to happen after all routes are defined
  app.use("/api", apiRouter);
  
  const httpServer = createServer(app);
  return httpServer;
}
