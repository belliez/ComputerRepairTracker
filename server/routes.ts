import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { initializeDemo } from "./init-db";
import { db } from "./db";
import { and, eq, desc, isNull, ne, not, or, sql } from "drizzle-orm";
import { sendEmail, sendEmailWithOverride, generateQuoteEmail, generateInvoiceEmail, EmailData, EmailSettings } from "./email";
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
  insertServiceSchema,
  insertTechnicianRateSchema,
  repairStatuses,
  currencies,
  taxRates,
  quotes,
  invoices,
  organizations,
  technicians,
  users,
  organizationUsers,
  organizationCurrencySettings,
  services,
  technicianRates,
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
      
      // Get the organization ID from the request headers
      const organizationId = parseInt(req.headers['x-organization-id'] as string) || null;
      console.log("PUBLIC API: Currencies request for organization:", organizationId);
      
      let allCurrencies;
      
      // If we have an organization ID, get both organization-specific and core currencies
      if (organizationId) {
        allCurrencies = await db.select()
          .from(currencies)
          .where(
            or(
              // Get organization-specific currencies
              eq(currencies.organizationId, organizationId),
              // Get core currencies that are available to all organizations
              eq(currencies.isCore, true)
            )
          );
        
        console.log(`PUBLIC API: Found ${allCurrencies.length} currencies for organization ${organizationId} (including core currencies)`);
      } else {
        // No organization ID, only return core currencies
        allCurrencies = await db.select()
          .from(currencies)
          .where(eq(currencies.isCore, true));
        
        console.log(`PUBLIC API: Found ${allCurrencies.length} core currencies`);
      }
      
      res.json(allCurrencies);
    } catch (error) {
      console.error("PUBLIC API: Error fetching currencies:", error);
      res.status(500).json({ message: "Error fetching currencies" });
    }
  });

  app.get('/api/public-settings/currencies/default', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC API: Getting default currency (public router)");
      
      // Get the organization ID from the request headers
      const organizationId = parseInt(req.headers['x-organization-id'] as string) || null;
      console.log("PUBLIC API: Default currency request for organization:", organizationId);
      
      // First try to find an organization-specific default currency
      if (organizationId) {
        const [orgDefaultCurrency] = await db.select()
          .from(currencies)
          .where(and(
            eq(currencies.isDefault, true),
            eq(currencies.organizationId, organizationId)
          ));
        
        if (orgDefaultCurrency) {
          console.log(`PUBLIC API: Found organization-specific default currency: ${orgDefaultCurrency.code}`);
          return res.json(orgDefaultCurrency);
        }
        
        // Check for organization-specific setting for a core currency
        const [orgCurrencySetting] = await db.select()
          .from(organizationCurrencySettings)
          .where(and(
            eq(organizationCurrencySettings.organizationId, organizationId),
            eq(organizationCurrencySettings.isDefault, true)
          ));
        
        if (orgCurrencySetting) {
          console.log(`PUBLIC API: Found organization currency setting for: ${orgCurrencySetting.currencyCode} (isDefault=${orgCurrencySetting.isDefault})`);
          // Get the core currency
          const [coreCurrency] = await db.select()
            .from(currencies)
            .where(eq(currencies.code, orgCurrencySetting.currencyCode));
            
          if (coreCurrency) {
            console.log(`PUBLIC API: Using core currency from organization settings: ${coreCurrency.code}`);
            return res.json({
              ...coreCurrency,
              isDefault: true // Make sure to show this currency as default
            });
          }
        }
      }
      
      // If no org-specific default is found, look for a core default currency
      const [coreDefaultCurrency] = await db.select()
        .from(currencies)
        .where(and(
          eq(currencies.isDefault, true),
          eq(currencies.isCore, true)
        ));
        
      if (coreDefaultCurrency) {
        console.log(`PUBLIC API: Found core default currency: ${coreDefaultCurrency.code}`);
        return res.json(coreDefaultCurrency);
      }
      
      // If no default currency found, try to get any organization-specific currency
      if (organizationId) {
        const [anyOrgCurrency] = await db.select()
          .from(currencies)
          .where(eq(currencies.organizationId, organizationId))
          .limit(1);
          
        if (anyOrgCurrency) {
          console.log(`PUBLIC API: No default currency found, using first organization currency: ${anyOrgCurrency.code}`);
          return res.json(anyOrgCurrency);
        }
      }
      
      // Last resort: Get any core currency
      const [anyCoreCurrency] = await db.select()
        .from(currencies)
        .where(eq(currencies.isCore, true))
        .limit(1);
        
      if (anyCoreCurrency) {
        console.log(`PUBLIC API: Using first available core currency: ${anyCoreCurrency.code}`);
        return res.json(anyCoreCurrency);
      }
      
      // If we get here, there are no currencies at all
      console.log("PUBLIC API: No currencies found in the system");
      return res.json(null);
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
  
  // Public API endpoint for services
  app.get('/api/public-settings/services', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC API: Getting services (public router)");
      
      // Set organization context from header if present
      const orgIdHeader = req.headers['x-organization-id'];
      let orgId: number;
      
      if (orgIdHeader) {
        orgId = parseInt(orgIdHeader as string);
        (global as any).currentOrganizationId = orgId;
        console.log(`PUBLIC API: Using organization ID from header: ${orgId}`);
      } else {
        // Default fallback
        orgId = 2;
        (global as any).currentOrganizationId = orgId;
        console.log(`PUBLIC API: Using default organization ID: ${orgId}`);
      }
      
      const allServices = await db.select().from(services)
        .where(and(
          eq(services.organizationId, orgId),
          eq(services.deleted, false),
          eq(services.isActive, true)
        ));
      
      console.log(`PUBLIC API: Found ${allServices.length} services for organization ${orgId}`);
      res.json(allServices);
    } catch (error) {
      console.error("PUBLIC API: Error fetching services:", error);
      res.status(500).json({ message: "Error fetching services" });
    }
  });
  
  // API endpoint to get unique service categories
  app.get('/api/public-settings/service-categories', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC API: Getting service categories (public router)");
      
      // Set organization context from header if present
      const orgIdHeader = req.headers['x-organization-id'];
      let orgId: number;
      
      if (orgIdHeader) {
        orgId = parseInt(orgIdHeader as string);
        (global as any).currentOrganizationId = orgId;
        console.log(`PUBLIC API: Using organization ID from header: ${orgId}`);
      } else {
        // Default fallback
        orgId = 2;
        (global as any).currentOrganizationId = orgId;
        console.log(`PUBLIC API: Using default organization ID: ${orgId}`);
      }
      
      // Query for distinct categories
      const categoriesQuery = db.selectDistinct({ category: services.category }).from(services)
        .where(and(
          eq(services.organizationId, orgId),
          eq(services.deleted, false),
          eq(services.isActive, true),
          not(isNull(services.category))
        ));
      
      const categories = await categoriesQuery;
      const categoryList = categories.map(c => c.category).filter(Boolean);
      
      console.log(`PUBLIC API: Found ${categoryList.length} unique service categories`);
      res.json(categoryList);
    } catch (error) {
      console.error("PUBLIC API: Error fetching service categories:", error);
      res.status(500).json({ message: "Error fetching service categories" });
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
      console.log("CUSTOMERS DEBUG: Request URL: /customers, Path: /customers, BaseURL: /api, OriginalURL: /api/customers");
      console.log(`CUSTOMERS DEBUG: Organization ID Header: ${req.headers['x-organization-id']}`);
      console.log(`CUSTOMERS DEBUG: Authorization Header: ${req.headers.authorization ? 'present' : 'missing'}`);
      console.log(`CUSTOMERS DEBUG: Debug client header: ${req.headers['x-debug-client']}`);
      
      // Make sure we have an organization ID for this request
      let orgId = (global as any).currentOrganizationId;
      
      // Verify req.organizationId exists from auth middleware
      if (req.organizationId && typeof req.organizationId === 'number') {
        orgId = req.organizationId;
        console.log(`CUSTOMERS DEBUG: Using organization ID from request context: ${orgId}`);
      } else if (req.headers['x-organization-id']) {
        // Fallback to header if not set in context
        const headerOrgId = parseInt(req.headers['x-organization-id'] as string, 10);
        if (!isNaN(headerOrgId)) {
          orgId = headerOrgId;
          console.log(`CUSTOMERS DEBUG: Using organization ID from header: ${orgId}`);
        }
      }
      
      if (!orgId) {
        return res.status(400).json({ error: "Missing organization context" });
      }
      
      // Save this organization ID for the request
      (global as any).currentOrganizationId = orgId;
      
      const customers = await storage.getCustomers();
      console.log(`CUSTOMERS DEBUG: Found ${customers.length} customers for organization: ${orgId}`);
      if (customers.length > 0) {
        console.log(`CUSTOMERS DEBUG: First customer:`, JSON.stringify(customers[0]));
      }
      
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
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
      console.log(`INVENTORY DEBUG: Request URL: ${req.originalUrl}`);
      console.log(`INVENTORY DEBUG: Headers:`, req.headers["x-debug-client"]);
      console.log(`INVENTORY DEBUG: Organization ID from context: ${(global as any).currentOrganizationId || 'not set'}`);
      
      // Set organization context from headers or use default
      const orgIdHeader = req.headers["x-organization-id"];
      if (orgIdHeader) {
        (global as any).currentOrganizationId = Number(orgIdHeader);
        console.log(`INVENTORY DEBUG: Setting organization ID from header: ${orgIdHeader}`);
      }
      
      // Check org ID is set
      if (!(global as any).currentOrganizationId) {
        console.error("INVENTORY DEBUG: No organization ID in context");
        return res.status(400).json({ message: "Organization ID is required" });
      }
      
      // Proceed with the request
      console.log(`INVENTORY DEBUG: Fetching inventory items for organization ${(global as any).currentOrganizationId}...`);
      const items = await storage.getInventoryItems();
      console.log(`INVENTORY DEBUG: Found ${items.length} items`);
      if (items.length > 0) {
        console.log(`INVENTORY DEBUG: First item: ${JSON.stringify(items[0])}`);
      } else {
        console.log(`INVENTORY DEBUG: No items found`);
      }
      res.json(items);
    } catch (error) {
      console.error("INVENTORY ERROR:", error);
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
      console.log(`INVENTORY DEBUG: Creating inventory item in organization: ${(global as any).currentOrganizationId || 'not set'}`);
      const validatedData = insertInventoryItemSchema.parse(req.body);
      console.log(`INVENTORY DEBUG: Validated data: ${JSON.stringify(validatedData)}`);
      const item = await storage.createInventoryItem(validatedData);
      console.log(`INVENTORY DEBUG: Created item: ${JSON.stringify(item)}`);
      
      // After creating, let's verify the item is retrievable
      const allItems = await storage.getInventoryItems();
      console.log(`INVENTORY DEBUG: After creation, found ${allItems.length} total items`);
      const justCreated = allItems.find(i => i.id === item.id);
      console.log(`INVENTORY DEBUG: Item retrieval verification: ${justCreated ? 'FOUND' : 'NOT FOUND'}`);
      
      res.status(201).json(item);
    } catch (error) {
      console.error("INVENTORY ERROR:", error);
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
  
  // Services endpoints
  apiRouter.get("/services", async (req: Request, res: Response) => {
    const organizationId = (global as any).currentOrganizationId;
    console.log(`Fetching services for organization: ${organizationId}`);
    
    try {
      const allServices = await db.select().from(services)
        .where(and(
          eq(services.organizationId, organizationId),
          eq(services.deleted, false)
        ));
      
      res.json(allServices);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });
  
  apiRouter.get("/services/:id", async (req: Request, res: Response) => {
    const organizationId = (global as any).currentOrganizationId;
    const { id } = req.params;
    
    try {
      const [service] = await db.select().from(services)
        .where(and(
          eq(services.id, parseInt(id)),
          eq(services.organizationId, organizationId),
          eq(services.deleted, false)
        ));
      
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ error: "Failed to fetch service" });
    }
  });
  
  apiRouter.post("/services", async (req: Request, res: Response) => {
    const organizationId = (global as any).currentOrganizationId;
    
    try {
      const parsedService = insertServiceSchema.parse({
        ...req.body,
        organizationId,
        deleted: false,
        deletedAt: null
      });
      
      const [newService] = await db.insert(services)
        .values(parsedService)
        .returning();
      
      res.status(201).json(newService);
    } catch (error) {
      console.error("Error creating service:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid service data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create service" });
    }
  });
  
  apiRouter.put("/services/:id", async (req: Request, res: Response) => {
    const organizationId = (global as any).currentOrganizationId;
    const { id } = req.params;
    
    try {
      const [existingService] = await db.select().from(services)
        .where(and(
          eq(services.id, parseInt(id)),
          eq(services.organizationId, organizationId),
          eq(services.deleted, false)
        ));
        
      if (!existingService) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      const [updatedService] = await db.update(services)
        .set({
          name: req.body.name,
          description: req.body.description,
          category: req.body.category,
          hourlyRate: req.body.hourlyRate,
          cost: req.body.cost,
          isActive: req.body.isActive
        })
        .where(and(
          eq(services.id, parseInt(id)),
          eq(services.organizationId, organizationId)
        ))
        .returning();
      
      res.json(updatedService);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });
  
  apiRouter.delete("/services/:id", async (req: Request, res: Response) => {
    const organizationId = (global as any).currentOrganizationId;
    const { id } = req.params;
    
    try {
      const [existingService] = await db.select().from(services)
        .where(and(
          eq(services.id, parseInt(id)),
          eq(services.organizationId, organizationId),
          eq(services.deleted, false)
        ));
        
      if (!existingService) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      const [deletedService] = await db.update(services)
        .set({
          deleted: true,
          deletedAt: new Date()
        })
        .where(and(
          eq(services.id, parseInt(id)),
          eq(services.organizationId, organizationId)
        ))
        .returning();
      
      res.json({ success: true, id: deletedService.id });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });
  
  // Technician rates endpoints
  apiRouter.get("/technician-rates", async (req: Request, res: Response) => {
    const organizationId = (global as any).currentOrganizationId;
    const { technicianId, serviceId } = req.query;
    
    try {
      let query = db.select({
        id: technicianRates.id,
        technicianId: technicianRates.technicianId,
        serviceId: technicianRates.serviceId,
        hourlyRate: technicianRates.hourlyRate,
        technicianFirstName: technicians.firstName,
        technicianLastName: technicians.lastName,
        serviceName: services.name,
        serviceCategory: services.category,
        serviceStandardRate: services.hourlyRate
      })
      .from(technicianRates)
      .leftJoin(technicians, eq(technicianRates.technicianId, technicians.id))
      .leftJoin(services, eq(technicianRates.serviceId, services.id))
      .where(eq(technicianRates.organizationId, organizationId));
      
      if (technicianId) {
        query = query.where(eq(technicianRates.technicianId, parseInt(technicianId as string)));
      }
      
      if (serviceId) {
        query = query.where(eq(technicianRates.serviceId, parseInt(serviceId as string)));
      }
      
      const rates = await query;
      res.json(rates);
    } catch (error) {
      console.error("Error fetching technician rates:", error);
      res.status(500).json({ error: "Failed to fetch technician rates" });
    }
  });
  
  apiRouter.post("/technician-rates", async (req: Request, res: Response) => {
    const organizationId = (global as any).currentOrganizationId;
    
    try {
      const parsedRate = insertTechnicianRateSchema.parse({
        ...req.body,
        organizationId
      });
      
      // Check if technician and service exist and belong to this organization
      const [technician] = await db.select().from(technicians)
        .where(and(
          eq(technicians.id, parsedRate.technicianId),
          eq(technicians.organizationId, organizationId),
          eq(technicians.deleted, false)
        ));
        
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }
      
      const [service] = await db.select().from(services)
        .where(and(
          eq(services.id, parsedRate.serviceId),
          eq(services.organizationId, organizationId),
          eq(services.deleted, false)
        ));
        
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      
      // Check if a rate already exists for this technician-service combination
      const [existingRate] = await db.select().from(technicianRates)
        .where(and(
          eq(technicianRates.technicianId, parsedRate.technicianId),
          eq(technicianRates.serviceId, parsedRate.serviceId),
          eq(technicianRates.organizationId, organizationId)
        ));
        
      if (existingRate) {
        // Update the existing rate
        const [updatedRate] = await db.update(technicianRates)
          .set({ hourlyRate: parsedRate.hourlyRate, updatedAt: new Date() })
          .where(and(
            eq(technicianRates.technicianId, parsedRate.technicianId),
            eq(technicianRates.serviceId, parsedRate.serviceId),
            eq(technicianRates.organizationId, organizationId)
          ))
          .returning();
          
        return res.json(updatedRate);
      }
      
      // Create a new rate
      const [newRate] = await db.insert(technicianRates)
        .values(parsedRate)
        .returning();
      
      res.status(201).json(newRate);
    } catch (error) {
      console.error("Error creating technician rate:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid technician rate data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create technician rate" });
    }
  });
  
  apiRouter.delete("/technician-rates/:id", async (req: Request, res: Response) => {
    const organizationId = (global as any).currentOrganizationId;
    const { id } = req.params;
    
    try {
      const deleteResult = await db.delete(technicianRates)
        .where(and(
          eq(technicianRates.id, parseInt(id)),
          eq(technicianRates.organizationId, organizationId)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting technician rate:", error);
      res.status(500).json({ error: "Failed to delete technician rate" });
    }
  });

  // Repairs
  // Create a dedicated middleware-bypassing route for repair status counts
  // This is registered before the auth middleware to ensure it remains accessible
  app.get("/repair-status-counts", async (req: Request, res: Response) => {
    console.log("REPAIR STATS PUBLIC DEBUG: Accessing public repair status counts endpoint");
    
    try {
      // Set global organization context from header
      if (req.headers['x-organization-id']) {
        const orgId = parseInt(req.headers['x-organization-id'] as string, 10);
        (global as any).currentOrganizationId = orgId;
        console.log(`Setting global organization context to ${orgId} from request header`);
      } else {
        // Default fallback organization
        (global as any).currentOrganizationId = 2;
        console.log(`Using default organization ID: 2`);
      }
      
      // Use the optimized SQL aggregation method
      const statusCounts = await storage.getRepairStatusCounts();
      console.log(`Found status counts:`, statusCounts);
      
      res.json(statusCounts);
    } catch (error) {
      console.error("Error fetching repair status counts:", error);
      res.status(500).json({ error: "Failed to fetch repair status counts" });
    }
  });
  
  // Keep the authenticated version for the API router as well (not strictly needed but kept for consistency)
  apiRouter.get("/repair-status-counts", async (req: Request, res: Response) => {
    try {
      console.log("REPAIRS STATS DEBUG: Fetching repair status counts for dashboard");
      
      // Make sure we have an organization ID for this request
      let orgId = (global as any).currentOrganizationId;
      
      // Verify req.organizationId exists from auth middleware
      if (req.organizationId && typeof req.organizationId === 'number') {
        orgId = req.organizationId;
      } else if (req.headers['x-organization-id']) {
        // Fallback to header if not set in context
        const headerOrgId = parseInt(req.headers['x-organization-id'] as string, 10);
        if (!isNaN(headerOrgId)) {
          orgId = headerOrgId;
        }
      }
      
      if (!orgId) {
        return res.status(400).json({ error: "Missing organization context" });
      }
      
      // Save this organization ID for the request
      (global as any).currentOrganizationId = orgId;
      
      // Use the optimized SQL aggregation method
      const statusCounts = await storage.getRepairStatusCounts();
      console.log(`Found status counts for organization ${orgId}:`, statusCounts);
      
      res.json(statusCounts);
    } catch (error) {
      console.error("Error fetching repair status counts:", error);
      res.status(500).json({ error: "Failed to fetch repair status counts" });
    }
  });

  apiRouter.get("/repairs", async (req: Request, res: Response) => {
    try {
      // Log full details of the request for debugging
      console.log("REPAIRS DEBUG: Request URL: /repairs, Path: /repairs, BaseURL: /api, OriginalURL: /api/repairs");
      console.log(`REPAIRS DEBUG: Organization ID Header: ${req.headers['x-organization-id']}`);
      console.log(`REPAIRS DEBUG: Authorization Header: ${req.headers.authorization ? 'present' : 'missing'}`);
      console.log(`REPAIRS DEBUG: Debug client header: ${req.headers['x-debug-client']}`);
      
      // Make sure we have an organization ID for this request
      let orgId = (global as any).currentOrganizationId;
      
      // Verify req.organizationId exists from auth middleware
      if (req.organizationId && typeof req.organizationId === 'number') {
        orgId = req.organizationId;
        console.log(`REPAIRS DEBUG: Using organization ID from request context: ${orgId}`);
      } else if (req.headers['x-organization-id']) {
        // Fallback to header if not set in context
        const headerOrgId = parseInt(req.headers['x-organization-id'] as string, 10);
        if (!isNaN(headerOrgId)) {
          orgId = headerOrgId;
          console.log(`REPAIRS DEBUG: Using organization ID from header: ${orgId}`);
        }
      }
      
      if (!orgId) {
        return res.status(400).json({ error: "Missing organization context" });
      }
      
      // Save this organization ID for the request
      (global as any).currentOrganizationId = orgId;
      
      // Parse query parameters
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      const technicianId = req.query.technicianId ? parseInt(req.query.technicianId as string) : undefined;
      const status = req.query.status as string;
      const priority = req.query.priority as string;
      
      console.log(`REPAIRS DEBUG: GET /repairs with query params: ${JSON.stringify({ customerId, technicianId, status, priority })} for organization: ${orgId}`);
      
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

      console.log("DEBUG - Repair update request body:", req.body);
      
      // Create a copy of the data to safely manipulate
      let processedData = { ...req.body };
      
      // Process priorityLevel to ensure it's a number
      if (processedData.priorityLevel !== undefined) {
        if (typeof processedData.priorityLevel === 'string') {
          // Convert named priorities to numbers
          switch (processedData.priorityLevel.toLowerCase()) {
            case 'urgent':
              processedData.priorityLevel = 1;
              break;
            case 'high':
              processedData.priorityLevel = 2;
              break;
            case 'normal':
              processedData.priorityLevel = 3;
              break;
            case 'low':
              processedData.priorityLevel = 4;
              break;
            case 'very low':
              processedData.priorityLevel = 5;
              break;
            default:
              // Try to parse it as a number
              const numPriority = parseInt(processedData.priorityLevel);
              if (!isNaN(numPriority) && numPriority >= 1 && numPriority <= 5) {
                processedData.priorityLevel = numPriority;
              } else {
                // Default to normal if parsing fails
                processedData.priorityLevel = 3;
              }
          }
        }
        
        // Ensure priorityLevel is within valid range
        processedData.priorityLevel = Math.max(1, Math.min(5, processedData.priorityLevel));
      }
      
      // Process estimatedCompletionDate - if it's an empty string, set it to null
      if (processedData.estimatedCompletionDate === '') {
        processedData.estimatedCompletionDate = null;
      }
      
      // Process status to ensure it's a valid enum value
      if (processedData.status !== undefined) {
        // Check if it's a DOM element button click (likely comes from the UI status buttons)
        if (processedData.status === 'in-repair') {
          processedData.status = 'in_repair';
        } else if (processedData.status === 'ready-for-pickup') {
          processedData.status = 'ready_for_pickup';
        } else if (processedData.status === 'on-hold') {
          processedData.status = 'on_hold';
        } else if (processedData.status === 'awaiting-approval') {
          processedData.status = 'awaiting_approval';
        } else if (processedData.status === 'parts-ordered') {
          processedData.status = 'parts_ordered';
        }
        
        // Check if this is a valid status
        const validStatuses = ["intake", "diagnosing", "awaiting_approval", "parts_ordered", 
                              "in_repair", "ready_for_pickup", "completed", "on_hold", "cancelled"];
        
        if (!validStatuses.includes(processedData.status)) {
          console.log(`Invalid status: "${processedData.status}" - defaulting to "intake"`);
          processedData.status = "intake";
        }
      }
      
      console.log("DEBUG - Processed repair data:", processedData);
      
      try {
        // Sanitize date values that might cause issues
        const sanitizedData = { ...processedData };
        
        // Handle all date fields to ensure they are properly formatted or null
        if (sanitizedData.estimatedCompletionDate === '') {
          sanitizedData.estimatedCompletionDate = null;
        }
        
        if (sanitizedData.actualCompletionDate === '') {
          sanitizedData.actualCompletionDate = null;
        }
        
        if (sanitizedData.intakeDate === '') {
          sanitizedData.intakeDate = null;
        }
        
        // Remove any empty string dates that could cause issues
        for (const key in sanitizedData) {
          if (sanitizedData[key] === '' && 
              (key.includes('Date') || key.includes('date'))) {
            console.log(`Replacing empty string in date field: ${key}`);
            sanitizedData[key] = null;
          }
        }
        
        console.log("DEBUG - Final sanitized repair data:", sanitizedData);
        
        // Use the sanitized data without Zod validation
        const updatedRepair = await storage.updateRepair(id, sanitizedData);
        
        if (!updatedRepair) {
          return res.status(404).json({ error: "Repair not found" });
        }
        
        console.log("DEBUG - Successfully updated repair:", updatedRepair);
        res.json(updatedRepair);
      } catch (dbError) {
        console.error("Database error updating repair:", dbError);
        res.status(500).json({ error: "Database error updating repair", details: dbError.message });
      }
    } catch (error) {
      console.error("ERROR updating repair:", error);
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
      console.log("Received repair item creation request");
      const repairId = parseInt(req.params.repairId);
      if (isNaN(repairId)) {
        console.log("Invalid repair ID format:", req.params.repairId);
        return res.status(400).json({ error: "Invalid repair ID format" });
      }

      console.log(`Looking up repair with ID ${repairId}...`);
      const repair = await storage.getRepair(repairId);
      if (!repair) {
        console.log(`Repair not found with ID: ${repairId}`);
        return res.status(404).json({ error: "Repair not found" });
      }
      console.log(`Found repair: ${repair.id}, status: ${repair.status}`);

      console.log("Validating repair item data...");
      const validatedData = insertRepairItemSchema.parse({
        ...req.body,
        repairId,
      });
      console.log(`Repair item data validated successfully, type: ${validatedData.itemType}`);

      console.log("Creating repair item in database...");
      const item = await storage.createRepairItem(validatedData);
      console.log(`Repair item created successfully with ID: ${item.id}`);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error in repair item data:", error.errors);
        return res.status(400).json({ error: "Invalid repair item data", details: error.errors });
      }
      console.error("Error creating repair item:", error);
      res.status(500).json({ 
        error: "Failed to create repair item", 
        message: error instanceof Error ? error.message : String(error) 
      });
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
      console.log("Received quote data:", JSON.stringify(req.body, null, 2).substring(0, 200) + "...");
      
      // First try to validate
      try {
        console.log("Validating quote data with Zod schema...");
        const validatedData = insertQuoteSchema.parse(req.body);
        console.log("Quote data validated successfully");
        
        // Check for items data but don't log the full data which could be very large
        if (validatedData.itemsData) {
          try {
            const parsedItems = JSON.parse(validatedData.itemsData);
            console.log(`Quote includes itemsData with ${parsedItems.length} items, data length: ${validatedData.itemsData.length} characters`);
          } catch (parseError) {
            console.error("Failed to parse itemsData:", parseError);
          }
        }
        
        console.log("Calling storage.createQuote...");
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
      res.status(500).json({ error: "Failed to create quote", message: error instanceof Error ? error.message : String(error) });
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
      // Add special handling for bypassing auth check when needed (similar to /api/customers)
      console.log(`INVOICES DEBUG: Request URL: ${req.path}, Path: ${req.path}, BaseURL: ${req.baseUrl}, OriginalURL: ${req.originalUrl}`);
      console.log(`INVOICES DEBUG: Organization ID Header: ${req.headers['x-organization-id']}`);
      console.log(`INVOICES DEBUG: Authorization Header: ${req.headers.authorization ? 'present' : 'missing'}`);
      console.log(`INVOICES DEBUG: Debug client header: ${req.headers['x-debug-client']}`);
      
      // Set organization context from header if it exists
      let orgId = (global as any).currentOrganizationId || 2;
      const orgIdHeader = req.headers['x-organization-id'];
      
      if (orgIdHeader) {
        const parsedOrgId = parseInt(orgIdHeader as string);
        if (!isNaN(parsedOrgId)) {
          console.log(`INVOICES DEBUG: Setting organization ID from header: ${parsedOrgId}`);
          (global as any).currentOrganizationId = parsedOrgId;
          orgId = parsedOrgId;
        }
      }
      
      console.log(`INVOICES DEBUG: Using organization ID from request context: ${orgId}`);
      
      const repairId = req.query.repairId ? parseInt(req.query.repairId as string) : undefined;
      
      if (repairId) {
        console.log(`INVOICES DEBUG: Fetching invoices for repair ${repairId}`);
        const invoices = await storage.getInvoicesByRepair(repairId);
        console.log(`INVOICES DEBUG: Found ${invoices.length} invoices for repair ${repairId}`);
        return res.json(invoices);
      }
      
      console.log(`INVOICES DEBUG: Fetching all invoices for organization ${orgId}`);
      const invoices = await storage.getInvoices();
      console.log(`INVOICES DEBUG: Found ${invoices.length} invoices for organization ${orgId}`);
      
      // Log the first invoice if available for debugging
      if (invoices.length > 0) {
        console.log(`INVOICES DEBUG: First invoice preview: ${JSON.stringify(invoices[0]).substring(0, 100)}...`);
      }
      
      res.json(invoices);
    } catch (error) {
      console.error("INVOICES DEBUG: Error fetching invoices:", error);
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
        subject: `Quote #${quote.quoteNumber} for your repair`,
        html: emailHtml,
        organizationId: quote.organizationId || req.organizationId || 1 // Ensure organization ID is never null
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
  // Test email endpoint (does not require authentication)
  app.post("/api/test-email", async (req: Request, res: Response) => {
    try {
      const { to, emailSettings } = req.body;
      
      if (!to || !emailSettings) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      // Create a test email using the provided settings
      const emailData: EmailData = {
        to,
        subject: "Test Email from RepairTrack",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Test Email</h1>
            <p>This is a test email from your RepairTrack system to verify your email settings.</p>
            <p>If you're receiving this email, your email configuration is working correctly!</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <h3>Your Email Configuration</h3>
              <p><strong>Provider:</strong> ${emailSettings.provider === 'smtp' ? 'SMTP Server' : 'SendGrid API'}</p>
              <p><strong>From Email:</strong> ${emailSettings.fromEmail}</p>
              <p><strong>From Name:</strong> ${emailSettings.fromName}</p>
              <p><strong>Reply-To:</strong> ${emailSettings.replyTo || 'Same as From Email'}</p>
              <p><strong>Footer Text:</strong> ${emailSettings.footerText || 'Not set'}</p>
              
              ${emailSettings.provider === 'smtp' ? `
              <div style="margin-top: 15px; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">
                <h4 style="margin-top: 0;">SMTP Settings</h4>
                <p><strong>Host:</strong> ${emailSettings.smtpHost || 'Not set'}</p>
                <p><strong>Port:</strong> ${emailSettings.smtpPort || '587'}</p>
                <p><strong>Secure:</strong> ${emailSettings.smtpSecure ? 'Yes (TLS/SSL)' : 'No'}</p>
              </div>
              ` : ''}
            </div>
          </div>
        `,
        organizationId: req.organizationId || 0
      };
      
      // Override global settings with the provided test settings
      const overrideSettings: EmailSettings = {
        enabled: emailSettings.enabled,
        fromEmail: emailSettings.fromEmail,
        fromName: emailSettings.fromName,
        replyTo: emailSettings.replyTo || '',
        footerText: emailSettings.footerText || '',
        
        // Email provider
        provider: emailSettings.provider || 'sendgrid',
        
        // SendGrid settings
        sendgridApiKey: emailSettings.sendgridApiKey || '',
        
        // SMTP settings
        smtpHost: emailSettings.smtpHost || '',
        smtpPort: typeof emailSettings.smtpPort === 'number' ? emailSettings.smtpPort : 587,
        smtpUser: emailSettings.smtpUser || '',
        smtpPassword: emailSettings.smtpPassword || '',
        smtpSecure: emailSettings.smtpSecure || false,
        
        // Mailgun settings
        mailgunApiKey: emailSettings.mailgunApiKey || '',
        mailgunDomain: emailSettings.mailgunDomain || '',
        mailgunRegion: emailSettings.mailgunRegion || 'us'
      };
      
      // Send the test email with overridden settings
      const success = await sendEmailWithOverride(emailData, overrideSettings);
      
      if (success) {
        return res.status(200).json({ message: "Test email sent successfully" });
      } else {
        return res.status(500).json({ 
          error: "Failed to send test email",
          details: "Email service returned failure. Check your API key and email settings."
        });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      
      let errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      let errorDetails = errorMessage;
      
      // Special handling for Gmail authentication errors
      if (overrideSettings.provider === 'smtp' && overrideSettings.smtpHost?.includes('gmail.com')) {
        const errorString = String(error).toLowerCase();
        
        if (errorString.includes('auth') || errorString.includes('credentials') || 
            errorString.includes('login') || errorString.includes('535')) {
          errorDetails = "Gmail authentication failed. If you're using Gmail with 2-Step Verification, " +
            "you need to use an App Password instead of your regular password. " +
            "Go to your Google Account > Security > App Passwords to generate one.";
        } else if (errorString.includes('ssl') || errorString.includes('tls')) {
          errorDetails = "TLS/SSL connection to Gmail failed. Try changing the port to 465 (for SSL) " +
            "or 587 (for TLS) and make sure SSL/TLS is enabled.";
        }
      }
      
      // Special handling for Mailgun errors
      if (overrideSettings.provider === 'mailgun') {
        const errorString = String(error).toLowerCase();
        
        if (errorString.includes('unauthorized') || errorString.includes('401') || 
            errorString.includes('api key')) {
          errorDetails = "Mailgun authentication failed. Please verify your API key is correct and active.";
        } else if (errorString.includes('domain') || errorString.includes('not found')) {
          errorDetails = "Mailgun domain error. Make sure your domain is properly configured and verified in your Mailgun account.";
        } else if (errorString.includes('region')) {
          errorDetails = "Mailgun region error. Make sure you've selected the correct region (US or EU) where your Mailgun account is hosted.";
        }
      }
      
      return res.status(500).json({ 
        error: "Failed to send test email", 
        details: errorDetails,
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  });

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
        subject: `Invoice #${invoice.invoiceNumber} for your repair`,
        html: emailHtml,
        organizationId: invoice.organizationId || req.organizationId || 1 // Ensure organization ID is never null
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
      const organizationId = (global as any).currentOrganizationId;
      console.log("Getting currencies for organization ID:", organizationId);
      
      // Get both organization-specific currencies and core currencies
      const allCurrencies = await db.select().from(currencies)
        .where(
          or(
            // Get organization-specific currencies
            eq(currencies.organizationId, organizationId),
            // Get core currencies that are available to all organizations
            eq(currencies.isCore, true)
          )
        );
      
      // Get organization-specific settings for core currencies
      const orgSettings = await db.select().from(organizationCurrencySettings)
        .where(eq(organizationCurrencySettings.organizationId, organizationId));
      
      // Create a map of currency code -> settings for quick lookup
      const settingsMap = new Map();
      for (const setting of orgSettings) {
        settingsMap.set(setting.currencyCode, setting);
      }
      
      // Enhance the currency objects with organization-specific settings
      console.log('Organization currency settings for org', organizationId, ':', orgSettings);
      
      // First, set all currencies' isDefault to false if they're core currencies
      // We'll then apply the organization-specific settings
      const currenciesWithDefaults = allCurrencies.map(currency => {
        if (currency.isCore) {
          // For core currencies, default to false initially
          return {
            ...currency,
            isDefault: false
          };
        }
        return currency;
      });
      
      // Now apply organization-specific settings
      const enhancedCurrencies = currenciesWithDefaults.map(currency => {
        // For core currencies, check if we have organization-specific settings
        if (currency.isCore && settingsMap.has(currency.code)) {
          const settings = settingsMap.get(currency.code);
          console.log(`Enhancing ${currency.code} with org settings: isDefault=${settings.isDefault}`);
          return {
            ...currency,
            isDefault: settings.isDefault  // Override the isDefault with org-specific setting
          };
        }
        
        return currency;
      });
      
      console.log(`Found ${allCurrencies.length} currencies for organization ${organizationId}`);
      return res.json(enhancedCurrencies);
    } catch (error: any) {
      console.error("Error fetching currencies:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.get("/settings/currencies/default", async (req: Request, res: Response) => {
    try {
      const orgId = (global as any).currentOrganizationId;
      console.log("Getting default currency for organization ID:", orgId);
      
      // First try to find an organization-specific default currency
      const [orgDefaultCurrency] = await db.select()
        .from(currencies)
        .where(and(
          eq(currencies.isDefault, true),
          eq(currencies.organizationId, orgId)
        ));
      
      if (orgDefaultCurrency) {
        console.log(`Found organization-specific default currency: ${orgDefaultCurrency.code}`);
        return res.json(orgDefaultCurrency);
      }
      
      // Check for organization-specific setting for a core currency
      const [orgCurrencySetting] = await db.select()
        .from(organizationCurrencySettings)
        .where(and(
          eq(organizationCurrencySettings.organizationId, orgId),
          eq(organizationCurrencySettings.isDefault, true)
        ));
      
      if (orgCurrencySetting) {
        console.log(`Found organization currency setting for: ${orgCurrencySetting.currencyCode} (isDefault=${orgCurrencySetting.isDefault})`);
        // Get the core currency
        const [coreCurrency] = await db.select()
          .from(currencies)
          .where(eq(currencies.code, orgCurrencySetting.currencyCode));
          
        if (coreCurrency) {
          console.log(`Using core currency from organization settings: ${coreCurrency.code}`);
          return res.json({
            ...coreCurrency,
            isDefault: true // Make sure to show this currency as default
          });
        }
      }
      
      // If no org-specific default is found, look for a core default currency
      const [coreDefaultCurrency] = await db.select()
        .from(currencies)
        .where(and(
          eq(currencies.isDefault, true),
          eq(currencies.isCore, true)
        ));
        
      if (coreDefaultCurrency) {
        console.log(`Found core default currency: ${coreDefaultCurrency.code}`);
        return res.json(coreDefaultCurrency);
      }
      
      // If no default currency found, try to get any organization-specific currency
      const [anyOrgCurrency] = await db.select()
        .from(currencies)
        .where(eq(currencies.organizationId, orgId))
        .limit(1);
        
      if (anyOrgCurrency) {
        console.log(`No default currency found, using first organization currency: ${anyOrgCurrency.code}`);
        return res.json(anyOrgCurrency);
      }
      
      // Last resort: Get any core currency
      const [anyCoreCurrency] = await db.select()
        .from(currencies)
        .where(eq(currencies.isCore, true))
        .limit(1);
        
      if (anyCoreCurrency) {
        console.log(`Using first available core currency: ${anyCoreCurrency.code}`);
        return res.json(anyCoreCurrency);
      }
      
      // If we really don't have any currency, return a fallback USD as before
      console.log("No currencies found in the system, returning fallback USD");
      return res.json({ code: "USD", symbol: "$", name: "US Dollar" });
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
      
      console.log(`Updating currency for organization ID: ${organizationId}, currency code: ${code}`);
      
      // Check if this is a core currency by examining the code
      const isCoreCurrency = code.includes('_CORE');
      
      // If setting as default, unset any existing defaults for this organization,
      // regardless of whether we're updating a core or organization-specific currency
      if (isDefault) {
        // First, update any organization-specific currencies to not be default
        await db.update(currencies)
          .set({ isDefault: false })
          .where(
            and(
              eq(currencies.isDefault, true),
              eq(currencies.organizationId, organizationId)
            )
          );
          
        // For core currencies, we need to update the organization settings table
        // to remove default flag from any existing settings
        await db.update(organizationCurrencySettings)
          .set({ isDefault: false })
          .where(
            and(
              eq(organizationCurrencySettings.isDefault, true),
              eq(organizationCurrencySettings.organizationId, organizationId)
            )
          );
          
        console.log(`Removed default flag from existing organization settings for org ${organizationId}`);
      }
      
      let updatedCurrency;
      
      // Handle core currencies differently than organization-specific currencies
      if (isCoreCurrency) {
        console.log(`Updating a core currency: ${code}`);
        
        // For core currencies, we need to create an organization-specific default setting record
        // First, find the core currency
        const [coreCurrency] = await db.select().from(currencies)
          .where(eq(currencies.code, code));
          
        if (!coreCurrency) {
          return res.status(404).json({ error: "Core currency not found" });
        }
        
        // Find if we already have an organization-specific setting for this currency
        const [orgCurrencySetting] = await db.select().from(organizationCurrencySettings)
          .where(
            and(
              eq(organizationCurrencySettings.currencyCode, code),
              eq(organizationCurrencySettings.organizationId, organizationId)
            )
          );
          
        if (orgCurrencySetting) {
          // Update existing setting
          const [updatedSetting] = await db.update(organizationCurrencySettings)
            .set({ isDefault })
            .where(
              and(
                eq(organizationCurrencySettings.currencyCode, code),
                eq(organizationCurrencySettings.organizationId, organizationId)
              )
            )
            .returning();
            
          // Combine the core currency and the organization setting
          updatedCurrency = {
            ...coreCurrency,
            isDefault: updatedSetting.isDefault,
          };
        } else {
          // Create new setting
          const [newSetting] = await db.insert(organizationCurrencySettings)
            .values({
              organizationId,
              currencyCode: code,
              isDefault
            })
            .returning();
            
          // Combine the core currency and the organization setting
          updatedCurrency = {
            ...coreCurrency,
            isDefault: newSetting.isDefault,
          };
        }
      } else {
        // Regular update for organization-specific currencies
        const [updated] = await db.update(currencies)
          .set({ name, symbol, isDefault })
          .where(
            and(
              eq(currencies.code, code),
              eq(currencies.organizationId, organizationId)
            )
          )
          .returning();
          
        updatedCurrency = updated;
      }
        
      if (!updatedCurrency) {
        return res.status(404).json({ 
          error: "Currency not found for this organization",
          details: {
            code,
            organizationId,
            isCoreCurrency
          }
        });
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
      
      console.log(`Deleting currency for organization ID: ${organizationId}, code: ${code}`);
      
      // Check if this is a core currency
      const isCoreCurrency = code.includes('_CORE');
      
      if (isCoreCurrency) {
        console.log(`Attempting to delete a core currency setting: ${code}`);
        
        // For core currencies, we're actually removing the organization setting for that currency
        // First check if the setting exists
        const [orgSetting] = await db.select()
          .from(organizationCurrencySettings)
          .where(
            and(
              eq(organizationCurrencySettings.currencyCode, code),
              eq(organizationCurrencySettings.organizationId, organizationId)
            )
          );
          
        if (!orgSetting) {
          return res.status(404).json({
            error: "No organization-specific setting found for this core currency"
          });
        }
        
        // Check if it's the default currency setting
        if (orgSetting.isDefault) {
          return res.status(400).json({
            error: "Cannot remove the default currency setting. Set another currency as default first."
          });
        }
        
        // Delete the organization setting for this core currency
        await db.delete(organizationCurrencySettings)
          .where(
            and(
              eq(organizationCurrencySettings.currencyCode, code),
              eq(organizationCurrencySettings.organizationId, organizationId)
            )
          );
          
        return res.status(204).send();
      }
      
      // For non-core currencies, proceed with the existing logic
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
        case 'email':
          try {
            console.log('Processing email settings update:', JSON.stringify(data, null, 2));
            
            // Get current organization settings
            const orgEmailResult = await db.select({ settings: organizations.settings })
              .from(organizations)
              .where(eq(organizations.id, organizationId));
            
            const currentSettings = orgEmailResult[0]?.settings || {};
            
            // Create updated settings object with email settings
            const newEmailSettings = data.settings || {};
            
            // Log the incoming settings object 
            console.log('Email settings received:', JSON.stringify(newEmailSettings, null, 2));
            
            // Make sure the provider field is correctly stored and not overridden
            const newProvider = newEmailSettings.provider || 'sendgrid';
            console.log('Email provider from form:', newProvider);
            
            // Get the current email settings if they exist
            const currentEmailSettings = currentSettings.email || {};
            
            // Create a merged email settings object that preserves provider-specific settings
            // even when switching between providers
            let mergedEmailSettings = {
              // Start with all existing email settings
              ...currentEmailSettings,
              
              // Update with the new common settings
              enabled: newEmailSettings.enabled,
              fromEmail: newEmailSettings.fromEmail,
              fromName: newEmailSettings.fromName,
              replyTo: newEmailSettings.replyTo,
              footerText: newEmailSettings.footerText,
              
              // Set the active provider
              provider: newProvider
            };
            
            // Now, update only the provider-specific settings based on the new provider
            if (newProvider === 'sendgrid') {
              // Update SendGrid-specific settings
              mergedEmailSettings.sendgridApiKey = newEmailSettings.sendgridApiKey;
            } else if (newProvider === 'smtp') {
              // Update SMTP-specific settings
              mergedEmailSettings.smtpHost = newEmailSettings.smtpHost;
              mergedEmailSettings.smtpPort = newEmailSettings.smtpPort;
              mergedEmailSettings.smtpUser = newEmailSettings.smtpUser;
              mergedEmailSettings.smtpPassword = newEmailSettings.smtpPassword;
              mergedEmailSettings.smtpSecure = newEmailSettings.smtpSecure;
            } else if (newProvider === 'mailgun') {
              // Update Mailgun-specific settings
              mergedEmailSettings.mailgunApiKey = newEmailSettings.mailgunApiKey;
              mergedEmailSettings.mailgunDomain = newEmailSettings.mailgunDomain;
              mergedEmailSettings.mailgunRegion = newEmailSettings.mailgunRegion;
            }
            
            // Log the merged email settings
            console.log('Merged email settings to be saved:', JSON.stringify(mergedEmailSettings, null, 2));
            
            let updatedSettings = {
              ...currentSettings,
              email: mergedEmailSettings
            };
            
            console.log('Final organization settings to be saved:', JSON.stringify(updatedSettings, null, 2));
            
            // Update the organization with new settings
            await db.update(organizations)
              .set({
                settings: updatedSettings,
                updatedAt: new Date()
              })
              .where(eq(organizations.id, organizationId));
              
            console.log('Email settings updated successfully');
            
            // Return the updated settings
            return res.status(200).json({ 
              message: "Email settings updated successfully",
              settings: updatedSettings.email
            });
          } catch (emailError) {
            console.error('Error updating email settings:', emailError);
            res.status(500).json({ 
              error: "Failed to update email settings",
              details: emailError.message 
            });
          }
          break;
            
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
          // Handle the enableTax setting - explicitly convert to boolean
          const enableTax = data.enableTax === false ? false : data.enableTax === true ? true : currentSettings.enableTax !== false;
          
          console.log('Enable tax setting:', enableTax, 'from data:', data.enableTax);
          
          const updatedSettings = {
            ...currentSettings,
            email: email,
            phone: phone,
            address: address,
            enableTax: enableTax
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
  
  // Email settings endpoint to retrieve configuration
  apiRouter.get("/settings/email", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const organizationId = req.organizationId || 1;
      console.log(`Getting email settings for organization: ${organizationId}`);
      
      // Get organization email settings from the database
      const [orgSettings] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, organizationId));
      
      if (!orgSettings) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      // Extract email settings
      let emailSettings = {};
      
      if (orgSettings.settings) {
        // Handle the case where email is stored as an object
        if (orgSettings.settings.email && typeof orgSettings.settings.email === 'object') {
          // Check if it's the string array format that needs conversion
          if (Array.isArray(orgSettings.settings.email) || '0' in orgSettings.settings.email) {
            console.log('Converting email string array to proper email object');
            // It's stored as an array of characters or object with numeric keys, reconstruct it properly
            emailSettings = {
              enabled: true,
              provider: 'sendgrid', // Default provider if not specified
              fromEmail: Object.values(orgSettings.settings.email).join(''), // Convert to string
              fromName: orgSettings.name || 'Repair Shop'
            };
          } else {
            // It's already an object with the right properties
            emailSettings = orgSettings.settings.email;
          }
        } else if (typeof orgSettings.settings.email === 'string') {
          // Handle case where email is just a string (email address)
          emailSettings = {
            enabled: true,
            provider: 'sendgrid',
            fromEmail: orgSettings.settings.email,
            fromName: orgSettings.name || 'Repair Shop'
          };
        }
      }
      
      console.log(`Found email settings for org ${organizationId}:`, 
        JSON.stringify(emailSettings, null, 2));
      
      res.json(emailSettings);
    } catch (error) {
      console.error("Error fetching email settings:", error);
      res.status(500).json({ 
        message: "Error fetching email settings",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a separate router for settings endpoints that don't require authentication
  const settingsRouter = express.Router();
  
  // Settings - Currencies
  settingsRouter.get("/currencies", async (req: Request, res: Response) => {
    try {
      // Get organization ID from global context or default to 1
      const orgId = (global as any).currentOrganizationId || 1;
      console.log(`Getting currencies for organization: ${orgId} (public router)`);
      
      // Get both organization-specific currencies and core currencies
      const allCurrencies = await db.select()
        .from(currencies)
        .where(
          or(
            // Get organization-specific currencies
            eq(currencies.organizationId, orgId),
            // Get core currencies that are available to all organizations
            eq(currencies.isCore, true)
          )
        );
      
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
      
      // First try to find an organization-specific default currency
      const [orgDefaultCurrency] = await db.select()
        .from(currencies)
        .where(and(
          eq(currencies.isDefault, true),
          eq(currencies.organizationId, orgId)
        ));
      
      if (orgDefaultCurrency) {
        console.log(`Found organization-specific default currency: ${orgDefaultCurrency.code}`);
        return res.json(orgDefaultCurrency);
      }
      
      // Check for organization-specific setting for a core currency
      const [orgCurrencySetting] = await db.select()
        .from(organizationCurrencySettings)
        .where(and(
          eq(organizationCurrencySettings.organizationId, orgId),
          eq(organizationCurrencySettings.isDefault, true)
        ));
      
      if (orgCurrencySetting) {
        console.log(`Found organization currency setting for: ${orgCurrencySetting.currencyCode} (isDefault=${orgCurrencySetting.isDefault})`);
        // Get the core currency
        const [coreCurrency] = await db.select()
          .from(currencies)
          .where(eq(currencies.code, orgCurrencySetting.currencyCode));
          
        if (coreCurrency) {
          console.log(`Using core currency from organization settings: ${coreCurrency.code}`);
          return res.json({
            ...coreCurrency,
            isDefault: true // Make sure to show this currency as default
          });
        }
      }
      
      // If no org-specific default is found, look for a core default currency
      const [coreDefaultCurrency] = await db.select()
        .from(currencies)
        .where(and(
          eq(currencies.isDefault, true),
          eq(currencies.isCore, true)
        ));
        
      if (coreDefaultCurrency) {
        console.log(`Found core default currency: ${coreDefaultCurrency.code}`);
        return res.json(coreDefaultCurrency);
      }
      
      // If no default currency found at all, return null
      console.log('No default currency found');
      res.json(null);
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
  
  // Public Inventory endpoint
  app.get("/api/inventory", async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC INVENTORY DEBUG: Request URL:", req.originalUrl);
      console.log("PUBLIC INVENTORY DEBUG: Headers:", req.headers["x-debug-client"]);
      
      // Set organization context from headers or use default
      const orgIdHeader = req.headers["x-organization-id"];
      if (orgIdHeader) {
        (global as any).currentOrganizationId = Number(orgIdHeader);
        console.log(`PUBLIC INVENTORY DEBUG: Setting organization ID from header: ${orgIdHeader}`);
      } else {
        console.log("PUBLIC INVENTORY DEBUG: No organization ID in header, using default");
        (global as any).currentOrganizationId = 2; // Default to org ID 2 if none provided
      }
      
      // Proceed with the request
      console.log(`PUBLIC INVENTORY DEBUG: Fetching inventory items for organization ${(global as any).currentOrganizationId}...`);
      const items = await storage.getInventoryItems();
      console.log(`PUBLIC INVENTORY DEBUG: Found ${items.length} items`);
      if (items.length > 0) {
        console.log(`PUBLIC INVENTORY DEBUG: First item: ${JSON.stringify(items[0])}`);
      } else {
        console.log(`PUBLIC INVENTORY DEBUG: No items found`);
      }
      res.json(items);
    } catch (error) {
      console.error("PUBLIC INVENTORY ERROR:", error);
      res.status(500).json({ error: "Failed to fetch inventory items" });
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
  
  // Add public inventory endpoint that doesn't require authentication
  app.get('/api/public/inventory', async (req: Request, res: Response) => {
    try {
      console.log("PUBLIC INVENTORY DEBUG: Request URL:", req.originalUrl);
      
      // Get organization ID from headers
      const orgIdHeader = req.header('X-Organization-ID');
      console.log("PUBLIC INVENTORY DEBUG: Setting organization ID from header:", orgIdHeader);
      
      if (!orgIdHeader) {
        console.log("PUBLIC INVENTORY DEBUG: No organization ID header found");
        return res.status(400).json({ error: "Organization ID is required" });
      }
      
      const orgId = parseInt(orgIdHeader);
      if (isNaN(orgId)) {
        console.log("PUBLIC INVENTORY DEBUG: Invalid organization ID format:", orgIdHeader);
        return res.status(400).json({ error: "Invalid organization ID format" });
      }
      
      console.log(`PUBLIC INVENTORY DEBUG: Fetching inventory items for organization ${orgId}...`);
      const inventoryItems = await storage.getInventoryItems(orgId);
      
      console.log(`PUBLIC INVENTORY DEBUG: Found ${inventoryItems.length} items`);
      if (inventoryItems.length > 0) {
        console.log(`PUBLIC INVENTORY DEBUG: First item:`, inventoryItems[0]);
      }
      
      res.json(inventoryItems);
    } catch (error) {
      console.error("PUBLIC INVENTORY DEBUG: Error fetching inventory items:", error);
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  // Mount API router - This needs to happen after all routes are defined
  app.use("/api", apiRouter);
  
  const httpServer = createServer(app);
  return httpServer;
}
