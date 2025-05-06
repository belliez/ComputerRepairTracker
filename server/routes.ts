import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { initializeDemo } from "./init-db";
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
} from "@shared/schema";
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
  
  // API routes prefix
  const apiRouter = express.Router();
  app.use("/api", apiRouter);

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
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer" });
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
      const technicians = await storage.getTechnicians();
      res.json(technicians);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technicians" });
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
      
      console.log("GET /repairs with query params:", { customerId, technicianId, status });
      
      // Filter by customer first if specified
      if (customerId) {
        const repairs = await storage.getRepairsByCustomer(customerId);
        return res.json(repairs);
      }
      
      // Filter by technician if specified
      if (technicianId) {
        const repairs = await storage.getRepairsByTechnician(technicianId);
        return res.json(repairs);
      }
      
      // Filter by status if it's a valid status and is actually provided
      if (status && status.length > 0 && repairStatuses.includes(status as any)) {
        console.log(`Filtering repairs by status: ${status}`);
        const repairs = await storage.getRepairsByStatus(status as any);
        return res.json(repairs);
      }
      
      // If no filters are active, return all repairs
      console.log("No filters active, returning all repairs");
      const repairs = await storage.getRepairs();
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

      const repairDetails = await storage.getRepairWithRelations(id);
      if (!repairDetails) {
        return res.status(404).json({ error: "Repair not found" });
      }

      res.json(repairDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repair details" });
    }
  });

  apiRouter.post("/repairs", async (req: Request, res: Response) => {
    try {
      const validatedData = insertRepairSchema.parse(req.body);
      const repair = await storage.createRepair(validatedData);
      res.status(201).json(repair);
    } catch (error) {
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
      const updatedRepair = await storage.updateRepair(id, validatedData);
      
      if (!updatedRepair) {
        return res.status(404).json({ error: "Repair not found" });
      }

      res.json(updatedRepair);
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
        const quote = await storage.createQuote(validatedData);
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

      const validatedData = insertQuoteSchema.partial().parse(req.body);
      const updatedQuote = await storage.updateQuote(id, validatedData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json(updatedQuote);
    } catch (error) {
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
      const validatedData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(validatedData);
      res.status(201).json(invoice);
    } catch (error) {
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

      const validatedData = insertInvoiceSchema.partial().parse(req.body);
      const updatedInvoice = await storage.updateInvoice(id, validatedData);
      
      if (!updatedInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(updatedInvoice);
    } catch (error) {
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

      // Get repair items
      const items = await storage.getRepairItems(repair.id);

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

      // Get repair items
      const items = await storage.getRepairItems(repair.id);

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

  // Settings API - Currencies
  apiRouter.get("/settings/currencies", async (req: Request, res: Response) => {
    try {
      const allCurrencies = await db.select().from(currencies);
      res.json(allCurrencies);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.get("/settings/currencies/default", async (req: Request, res: Response) => {
    try {
      const [defaultCurrency] = await db.select().from(currencies).where(eq(currencies.isDefault, true));
      if (!defaultCurrency) {
        // If no default, return USD as fallback
        const [usdCurrency] = await db.select().from(currencies).where(eq(currencies.code, "USD"));
        return res.json(usdCurrency || { code: "USD", symbol: "$", name: "US Dollar" });
      }
      res.json(defaultCurrency);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.post("/settings/currencies", async (req: Request, res: Response) => {
    try {
      const { code, name, symbol, isDefault } = req.body;
      
      // If setting as default, unset any existing default
      if (isDefault) {
        await db.update(currencies)
          .set({ isDefault: false })
          .where(eq(currencies.isDefault, true));
      }
      
      const [currency] = await db.insert(currencies)
        .values({ code, name, symbol, isDefault })
        .returning();
        
      res.status(201).json(currency);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.put("/settings/currencies/:code", async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const { name, symbol, isDefault } = req.body;
      
      // If setting as default, unset any existing default
      if (isDefault) {
        await db.update(currencies)
          .set({ isDefault: false })
          .where(eq(currencies.isDefault, true));
      }
      
      const [updatedCurrency] = await db.update(currencies)
        .set({ name, symbol, isDefault })
        .where(eq(currencies.code, code))
        .returning();
        
      if (!updatedCurrency) {
        return res.status(404).json({ error: "Currency not found" });
      }
      
      res.json(updatedCurrency);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.delete("/settings/currencies/:code", async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      
      // Check if currency is in use
      const quotesUsingCurrency = await db.select({ count: sql`count(*)` })
        .from(quotes)
        .where(eq(quotes.currencyCode, code));
        
      const invoicesUsingCurrency = await db.select({ count: sql`count(*)` })
        .from(invoices)
        .where(eq(invoices.currencyCode, code));
        
      if (quotesUsingCurrency[0].count > 0 || invoicesUsingCurrency[0].count > 0) {
        return res.status(400).json({ 
          error: "Cannot delete currency that is in use by quotes or invoices" 
        });
      }
      
      // Check if it's the default currency
      const [currencyToDelete] = await db.select()
        .from(currencies)
        .where(eq(currencies.code, code));
        
      if (currencyToDelete?.isDefault) {
        return res.status(400).json({ 
          error: "Cannot delete the default currency. Set another currency as default first." 
        });
      }
      
      await db.delete(currencies).where(eq(currencies.code, code));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Settings API - Tax Rates
  apiRouter.get("/settings/tax-rates", async (req: Request, res: Response) => {
    try {
      const allTaxRates = await db.select().from(taxRates);
      res.json(allTaxRates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.get("/settings/tax-rates/default", async (req: Request, res: Response) => {
    try {
      const [defaultTaxRate] = await db.select().from(taxRates).where(eq(taxRates.isDefault, true));
      if (!defaultTaxRate) {
        // Fall back to first tax rate if no default
        const [firstTaxRate] = await db.select().from(taxRates).limit(1);
        return res.json(firstTaxRate || { rate: 0, name: "No Tax" });
      }
      res.json(defaultTaxRate);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.post("/settings/tax-rates", async (req: Request, res: Response) => {
    try {
      const { countryCode, regionCode, name, rate, isDefault } = req.body;
      
      // If setting as default, unset any existing default
      if (isDefault) {
        await db.update(taxRates)
          .set({ isDefault: false })
          .where(eq(taxRates.isDefault, true));
      }
      
      const [taxRate] = await db.insert(taxRates)
        .values({ countryCode, regionCode, name, rate, isDefault })
        .returning();
        
      res.status(201).json(taxRate);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.put("/settings/tax-rates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { countryCode, regionCode, name, rate, isDefault } = req.body;
      
      // If setting as default, unset any existing default
      if (isDefault) {
        await db.update(taxRates)
          .set({ isDefault: false })
          .where(eq(taxRates.isDefault, true));
      }
      
      const [updatedTaxRate] = await db.update(taxRates)
        .set({ countryCode, regionCode, name, rate, isDefault })
        .where(eq(taxRates.id, id))
        .returning();
        
      if (!updatedTaxRate) {
        return res.status(404).json({ error: "Tax rate not found" });
      }
      
      res.json(updatedTaxRate);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  apiRouter.delete("/settings/tax-rates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if tax rate is in use
      const quotesUsingTaxRate = await db.select({ count: sql`count(*)` })
        .from(quotes)
        .where(eq(quotes.taxRateId, id));
        
      const invoicesUsingTaxRate = await db.select({ count: sql`count(*)` })
        .from(invoices)
        .where(eq(invoices.taxRateId, id));
        
      if (quotesUsingTaxRate[0].count > 0 || invoicesUsingTaxRate[0].count > 0) {
        return res.status(400).json({ 
          error: "Cannot delete tax rate that is in use by quotes or invoices" 
        });
      }
      
      // Check if it's the default tax rate
      const [taxRateToDelete] = await db.select()
        .from(taxRates)
        .where(eq(taxRates.id, id));
        
      if (taxRateToDelete?.isDefault) {
        return res.status(400).json({ 
          error: "Cannot delete the default tax rate. Set another tax rate as default first." 
        });
      }
      
      await db.delete(taxRates).where(eq(taxRates.id, id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
