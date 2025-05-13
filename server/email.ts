import { MailService } from '@sendgrid/mail';
import nodemailer, { TransportOptions, Transport } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { organizations } from '@shared/schema';

// Types for email data
export interface EmailData {
  to: string;
  from?: string; // Now optional, can be derived from organization settings
  subject: string;
  text?: string;
  html: string;
  organizationId: number; // Required to fetch organization-specific settings
}

// Email settings interface
export interface EmailSettings {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  footerText?: string;
  provider: 'sendgrid' | 'smtp' | 'mailgun'; // Support SendGrid, SMTP, and Mailgun
  
  // SendGrid specific settings
  sendgridApiKey?: string;
  
  // SMTP specific settings
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  
  // Mailgun specific settings
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunRegion?: 'us' | 'eu'; // Mailgun supports US and EU regions
}

/**
 * Get organization email settings
 * @param organizationId The organization ID
 * @returns The email settings for the organization, or default settings if not configured
 */
export async function getOrganizationEmailSettings(organizationId: number): Promise<EmailSettings | null> {
  try {
    // Query the organization from the database
    const [organization] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    
    if (!organization) {
      console.error(`Organization with ID ${organizationId} not found`);
      return null;
    }
    
    // Extract email settings from the organization settings
    const settings = organization.settings as any || {};
    const emailSettings = settings.email || {};
    
    // Return with defaults for missing values
    const defaultFromEmail = `no-reply@repair${organizationId}.com`;
    const orgName = settings.companyName || 'Repair Shop';
    
    return {
      enabled: emailSettings.enabled ?? true,
      fromEmail: emailSettings.fromEmail || defaultFromEmail,
      fromName: emailSettings.fromName || orgName,
      replyTo: emailSettings.replyTo || emailSettings.fromEmail || defaultFromEmail,
      footerText: emailSettings.footerText || `© ${new Date().getFullYear()} ${orgName}`,
      
      // Email provider settings
      provider: emailSettings.provider || 'sendgrid',
      
      // SendGrid settings
      sendgridApiKey: emailSettings.sendgridApiKey || '',
      
      // SMTP settings
      smtpHost: emailSettings.smtpHost || '',
      smtpPort: emailSettings.smtpPort || 587,
      smtpUser: emailSettings.smtpUser || '',
      smtpPassword: emailSettings.smtpPassword || '',
      smtpSecure: emailSettings.smtpSecure || false,
      
      // Mailgun settings
      mailgunApiKey: emailSettings.mailgunApiKey || '',
      mailgunDomain: emailSettings.mailgunDomain || '',
      mailgunRegion: emailSettings.mailgunRegion || 'us'
    };
  } catch (error) {
    console.error('Error fetching organization email settings:', error);
    return null;
  }
}

/**
 * Send an email using SendGrid API with organization-specific settings
 * @param emailData The email data to send including organizationId
 * @returns Promise resolving to a boolean indicating success
 */
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  // Get organization email settings and use them
  const orgSettings = await getOrganizationEmailSettings(emailData.organizationId);
  return sendEmailWithOverride(emailData, orgSettings);
}

/**
 * Send an email using the configured provider (SendGrid or SMTP) with explicitly provided settings
 * @param emailData The email data to send
 * @param overrideSettings Email settings to use, overriding organization settings
 * @returns Promise resolving to a boolean indicating success
 */
export async function sendEmailWithOverride(emailData: EmailData, overrideSettings: EmailSettings | null): Promise<boolean> {
  try {
    // Use override settings if provided, otherwise fall back to organization settings
    let settings: EmailSettings | null = overrideSettings;
    
    // If no override settings provided, get from database
    if (!settings) {
      settings = await getOrganizationEmailSettings(emailData.organizationId);
    }
    
    if (!settings) {
      console.error(`Failed to retrieve email settings for organization ${emailData.organizationId}`);
      return false;
    }
    
    if (!settings.enabled) {
      console.log(`Email sending is disabled for organization ${emailData.organizationId}`);
      return false;
    }
    
    // Construct the from field with name and email
    const from = emailData.from || `${settings.fromName} <${settings.fromEmail}>`;
    
    // Log the email that will be sent
    console.log('Sending email with the following data:');
    console.log('To:', emailData.to);
    console.log('From:', from);
    console.log('Subject:', emailData.subject);
    console.log('Provider:', settings.provider);
    
    // Create a clean HTML text version
    const textContent = emailData.text || emailData.html.replace(/<[^>]*>/g, '');
    
    // Add footer if configured
    let htmlContent = emailData.html;
    if (settings.footerText) {
      htmlContent += `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
        ${settings.footerText}
      </div>`;
    }
    
    // Create email content object for both providers
    const mailContent = {
      to: emailData.to,
      from: from,
      replyTo: settings.replyTo,
      subject: emailData.subject,
      text: textContent,
      html: htmlContent,
    };
    
    // Send using the appropriate provider
    if (settings.provider === 'smtp') {
      return await sendWithSMTP(mailContent, settings);
    } else if (settings.provider === 'mailgun') {
      return await sendWithMailgun(mailContent, settings);
    } else {
      // Default to SendGrid
      return await sendWithSendGrid(mailContent, settings);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send email using SendGrid
 */
async function sendWithSendGrid(mailContent: any, settings: EmailSettings): Promise<boolean> {
  try {
    // Use custom API key if provided in settings, otherwise use environment variable
    const apiKey = settings.sendgridApiKey || process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      throw new Error('Missing SendGrid API key. Please provide it in the settings or as SENDGRID_API_KEY environment variable.');
    }
    
    // Initialize SendGrid Mail Service
    const mailService = new MailService();
    mailService.setApiKey(apiKey);
    
    // Send the email
    await mailService.send(mailContent);
    console.log('Email sent successfully using SendGrid');
    return true;
  } catch (error) {
    console.error('SendGrid error:', error);
    throw error; // Re-throw to be caught by the main function
  }
}

/**
 * Send email using Mailgun
 */
async function sendWithMailgun(mailContent: any, settings: EmailSettings): Promise<boolean> {
  try {
    // Use custom API key if provided in settings, otherwise use environment variable
    const apiKey = settings.mailgunApiKey || process.env.MAILGUN_API_KEY;
    const domain = settings.mailgunDomain || process.env.MAILGUN_DOMAIN;
    const region = settings.mailgunRegion || 'us';
    
    if (!apiKey) {
      throw new Error('Missing Mailgun API key. Please provide it in the settings or as MAILGUN_API_KEY environment variable.');
    }
    
    if (!domain) {
      throw new Error('Missing Mailgun domain. Please provide it in the settings or as MAILGUN_DOMAIN environment variable.');
    }
    
    // Initialize Mailgun client
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: 'api',
      key: apiKey,
      url: region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
    });
    
    // Prepare Mailgun message format
    const mgMessage = {
      from: mailContent.from,
      to: mailContent.to,
      subject: mailContent.subject,
      html: mailContent.html,
      text: mailContent.text
    };
    
    // Create a properly typed message object
    const messageData: any = { ...mgMessage };
    
    // Add reply-to if specified
    if (mailContent.replyTo) {
      messageData['h:Reply-To'] = mailContent.replyTo;
    }
    
    // Add CC and BCC if they exist
    if (mailContent.cc) messageData.cc = mailContent.cc;
    if (mailContent.bcc) messageData.bcc = mailContent.bcc;
    
    // Send the message
    console.log(`Sending email via Mailgun to ${mailContent.to} using domain ${domain}`);
    await mg.messages.create(domain, messageData);
    console.log('Email sent successfully using Mailgun');
    return true;
  } catch (error) {
    console.error('Mailgun error:', error);
    throw error; // Re-throw to be caught by the main function
  }
}

/**
 * Send email using SMTP
 */
async function sendWithSMTP(mailContent: any, settings: EmailSettings): Promise<boolean> {
  try {
    if (!settings.smtpHost || !settings.smtpPort) {
      throw new Error('Missing SMTP configuration. Please provide host and port in settings.');
    }
    
    // Special handling for different email providers
    const isGmail = settings.smtpHost?.includes('gmail.com');
    let transportConfig: any;
    
    // Gmail-specific configuration
    if (isGmail) {
      console.log('Using Gmail-specific SMTP configuration');
      
      // Gmail requires different configuration based on port
      transportConfig = {
        host: 'smtp.gmail.com',
        port: settings.smtpPort, 
        secure: settings.smtpPort === 465, // true for 465, false for other ports
        requireTLS: true, // Force TLS for Gmail
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPassword || '',
          // Add XOAuth2 option for older Gmail setups
          type: 'login'
        },
        tls: {
          // Gmail often requires these settings for proper TLS support
          rejectUnauthorized: false,
        },
        debug: true, // Enable debug output for troubleshooting
        logger: true  // Use console for logging
      };
      
      // Log important info about the connection
      console.log(`Gmail configuration: Using port ${settings.smtpPort} with secure=${settings.smtpPort === 465}, username: ${settings.smtpUser}`);
      console.log(`Note: For Gmail to work, you need to use an app-specific password if 2FA is enabled`);
      
    } else {
      // Regular SMTP config for non-Gmail servers
      const isSecure = settings.smtpSecure === true || settings.smtpPort === 465;
      console.log(`SMTP Configuration: Host=${settings.smtpHost}, Port=${settings.smtpPort}, Secure=${isSecure}`);
      
      transportConfig = {
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: isSecure, // true for 465, false for other ports
        auth: settings.smtpUser ? {
          user: settings.smtpUser,
          pass: settings.smtpPassword || '',
        } : undefined,
        tls: {
          // Do not fail on invalid certs
          rejectUnauthorized: false,
          // Force TLS version
          minVersion: 'TLSv1.2'
        }
      };
    }
    
    // Safely log config without exposing passwords
    console.log('Using SMTP transport config:', JSON.stringify({
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      auth: transportConfig.auth ? { 
        user: transportConfig.auth.user,
        pass: '********' // Mask password in logs
      } : undefined,
      tls: transportConfig.tls ? { ...transportConfig.tls } : undefined
    }, null, 2));
    
    // Create SMTP transport with the determined configuration
    // Cast to SMTPTransport.Options to fix TypeScript issues
    const transport = nodemailer.createTransport(transportConfig as SMTPTransport.Options);
    
    // Enhanced error handling for connection verification
    try {
      console.log('Verifying SMTP connection...');
      await transport.verify();
      console.log('SMTP connection verified successfully');
      
      // Send mail
      const result = await transport.sendMail(mailContent);
      console.log('Email sent successfully using SMTP', result);
      return true;
    } catch (verifyError) {
      console.error('Failed to verify SMTP connection or send email:', verifyError);
      
      // Try sending directly without verification as a fallback
      console.log('Attempting to send email directly without verification...');
      try {
        const result = await transport.sendMail(mailContent);
        console.log('Email sent successfully using SMTP (without verification)', result);
        return true;
      } catch (sendError) {
        console.error('Failed to send email directly:', sendError);
        throw sendError;
      }
    }
  } catch (error) {
    console.error('SMTP error:', error);
    throw error; // Re-throw to be caught by the main function
  }
}

/**
 * Generate HTML for a quote email
 */
export function generateQuoteEmail(quote: any, customer: any, repair: any, itemsFromRepair: any[]): string {
  // Format the dates
  const dateCreated = new Date(quote.dateCreated).toLocaleDateString();
  const expirationDate = quote.expirationDate 
    ? new Date(quote.expirationDate).toLocaleDateString()
    : 'N/A';
  
  // Use itemsData from quote if available, otherwise fall back to passed items
  let itemsToDisplay = itemsFromRepair;
  
  // Check for itemsData field (new format)
  if (quote.itemsData) {
    try {
      const parsedItems = JSON.parse(quote.itemsData);
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        itemsToDisplay = parsedItems;
      }
    } catch (error) {
      console.error("Failed to parse quote itemsData:", error);
    }
  }
  // If no itemsData, try legacy itemIds format
  else if (quote.itemIds && itemsFromRepair.length > 0) {
    try {
      const itemIds = JSON.parse(quote.itemIds);
      if (Array.isArray(itemIds) && itemIds.length > 0) {
        itemsToDisplay = itemsFromRepair.filter(item => itemIds.includes(item.id));
      }
    } catch (error) {
      console.error("Failed to parse quote itemIds:", error);
    }
  }
  
  // Generate items table
  const itemsTable = `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: left; background-color: #f2f7ff;">Description</th>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: left; background-color: #f2f7ff;">Type</th>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; background-color: #f2f7ff;">Unit Price</th>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; background-color: #f2f7ff;">Quantity</th>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; background-color: #f2f7ff;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsToDisplay.length > 0 ? itemsToDisplay.map(item => {
          const unitPrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 1);
          const total = unitPrice * quantity;
          
          return `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: left;">${item.description || 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: left;">${item.itemType === 'part' ? 'Part' : 'Service'}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">$${unitPrice.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">${quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">$${total.toFixed(2)}</td>
          </tr>
        `;
        }).join('') : '<tr><td colspan="5" style="border: 1px solid #ddd; padding: 8px 12px; text-align: center;">No items</td></tr>'}
      </tbody>
    </table>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Quote #${quote.quoteNumber}</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
        <h1 style="margin: 0; color: #2563eb;">Quote #${quote.quoteNumber}</h1>
        <div>
          <strong>Status:</strong> ${quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${customer.firstName} ${customer.lastName}</p>
            <p><strong>Email:</strong> ${customer.email}</p>
            <p><strong>Phone:</strong> ${customer.phone}</p>
          </div>
          <div>
            <h3>Quote Details</h3>
            <p><strong>Date Created:</strong> ${dateCreated}</p>
            <p><strong>Expiration Date:</strong> ${expirationDate}</p>
            <p><strong>Repair Ticket:</strong> ${repair.ticketNumber}</p>
          </div>
        </div>
      </div>
      
      <h3>Items</h3>
      ${itemsTable}
      
      <div style="margin-top: 20px; margin-left: auto; width: 300px;">
        <table style="margin-left: auto; width: 100%; border-collapse: collapse;">
          <tr>
            <th style="border: 1px solid #ddd; padding: 5px 12px; text-align: left; background-color: #f2f7ff;">Subtotal</th>
            <td style="border: 1px solid #ddd; padding: 5px 12px; text-align: right;">$${quote.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 5px 12px; text-align: left; background-color: #f2f7ff;">Tax</th>
            <td style="border: 1px solid #ddd; padding: 5px 12px; text-align: right;">$${(quote.tax || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 5px 12px; text-align: left; background-color: #f2f7ff;">Total</th>
            <td style="border: 1px solid #ddd; padding: 5px 12px; text-align: right;"><strong>$${quote.total.toFixed(2)}</strong></td>
          </tr>
        </table>
      </div>
      
      ${quote.notes ? `
        <div style="margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <h3>Notes</h3>
          <p>${quote.notes}</p>
        </div>
      ` : ''}
      
      <p style="margin-top: 30px;">Please review this quote and contact us if you have any questions or would like to proceed with the repair.</p>
      
      <p>Thank you for choosing our service.</p>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for an invoice email
 */
export function generateInvoiceEmail(invoice: any, customer: any, repair: any, itemsFromRepair: any[]): string {
  // Format the dates
  const dateIssued = new Date(invoice.dateIssued).toLocaleDateString();
  const datePaid = invoice.datePaid
    ? new Date(invoice.datePaid).toLocaleDateString()
    : 'Not paid';
  
  // Use itemsData from invoice if available, otherwise fall back to passed items
  let itemsToDisplay = itemsFromRepair;
  
  // Check for itemsData field (new format)
  if (invoice.itemsData) {
    try {
      const parsedItems = JSON.parse(invoice.itemsData);
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        itemsToDisplay = parsedItems;
      }
    } catch (error) {
      console.error("Failed to parse invoice itemsData:", error);
    }
  }
  // If no itemsData, try legacy itemIds format
  else if (invoice.itemIds && itemsFromRepair.length > 0) {
    try {
      const itemIds = JSON.parse(invoice.itemIds);
      if (Array.isArray(itemIds) && itemIds.length > 0) {
        itemsToDisplay = itemsFromRepair.filter(item => itemIds.includes(item.id));
      }
    } catch (error) {
      console.error("Failed to parse invoice itemIds:", error);
    }
  }
  
  // Generate items table
  const itemsTable = `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: left; background-color: #f2f7ff;">Description</th>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: left; background-color: #f2f7ff;">Type</th>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; background-color: #f2f7ff;">Unit Price</th>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; background-color: #f2f7ff;">Quantity</th>
          <th style="border: 1px solid #ddd; padding: 8px 12px; text-align: right; background-color: #f2f7ff;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsToDisplay.length > 0 ? itemsToDisplay.map(item => {
          const unitPrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 1);
          const total = unitPrice * quantity;
          
          return `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: left;">${item.description || 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: left;">${item.itemType === 'part' ? 'Part' : 'Service'}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">$${unitPrice.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">${quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">$${total.toFixed(2)}</td>
          </tr>
        `;
        }).join('') : '<tr><td colspan="5" style="border: 1px solid #ddd; padding: 8px 12px; text-align: center;">No items</td></tr>'}
      </tbody>
    </table>
  `;

  // Get the payment status label
  let statusLabel = 'Unpaid';
  let statusColor = '#f44336'; // Red
  
  if (invoice.status === 'paid') {
    statusLabel = 'Paid';
    statusColor = '#4caf50'; // Green
  } else if (invoice.status === 'partial') {
    statusLabel = 'Partially Paid';
    statusColor = '#ff9800'; // Orange
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice #${invoice.invoiceNumber}</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
        <h1 style="margin: 0; color: #2563eb;">Invoice #${invoice.invoiceNumber}</h1>
        <div>
          <strong>Status:</strong> <span style="color: ${statusColor};">${statusLabel}</span>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${customer.firstName} ${customer.lastName}</p>
            <p><strong>Email:</strong> ${customer.email}</p>
            <p><strong>Phone:</strong> ${customer.phone}</p>
          </div>
          <div>
            <h3>Invoice Details</h3>
            <p><strong>Date Issued:</strong> ${dateIssued}</p>
            <p><strong>Date Paid:</strong> ${datePaid}</p>
            <p><strong>Payment Method:</strong> ${invoice.paymentMethod === 'none' ? 'Not Paid Yet' : invoice.paymentMethod}</p>
            <p><strong>Repair Ticket:</strong> ${repair.ticketNumber}</p>
          </div>
        </div>
      </div>
      
      <h3>Items</h3>
      ${itemsTable}
      
      <div style="margin-top: 20px; margin-left: auto; width: 300px;">
        <table style="margin-left: auto; width: 100%; border-collapse: collapse;">
          <tr>
            <th style="border: 1px solid #ddd; padding: 5px 12px; text-align: left; background-color: #f2f7ff;">Subtotal</th>
            <td style="border: 1px solid #ddd; padding: 5px 12px; text-align: right;">$${invoice.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 5px 12px; text-align: left; background-color: #f2f7ff;">Tax</th>
            <td style="border: 1px solid #ddd; padding: 5px 12px; text-align: right;">$${(invoice.tax || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 5px 12px; text-align: left; background-color: #f2f7ff;">Total</th>
            <td style="border: 1px solid #ddd; padding: 5px 12px; text-align: right;"><strong>$${invoice.total.toFixed(2)}</strong></td>
          </tr>
        </table>
      </div>
      
      ${invoice.notes ? `
        <div style="margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <h3>Notes</h3>
          <p>${invoice.notes}</p>
        </div>
      ` : ''}
      
      <p style="margin-top: 30px;">${invoice.status === 'paid' ? 
        'Thank you for your payment.' : 
        'Please submit payment for this invoice at your earliest convenience.'}</p>
      
      <p>Thank you for choosing our service.</p>
    </body>
    </html>
  `;
}