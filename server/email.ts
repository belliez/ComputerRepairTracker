import { MailService } from '@sendgrid/mail';

// Types for email data
export interface EmailData {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html: string;
}

/**
 * Send an email using SendGrid API
 * @param emailData The email data to send
 * @returns Promise resolving to a boolean indicating success
 */
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('Missing SENDGRID_API_KEY environment variable');
    return false;
  }

  try {
    const mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    
    await mailService.send({
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      text: emailData.text || emailData.html.replace(/<[^>]*>/g, ''), // Fallback plain text
      html: emailData.html,
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Generate HTML for a quote email
 */
export function generateQuoteEmail(quote: any, customer: any, repair: any, items: any[]): string {
  // Format the dates
  const dateCreated = new Date(quote.dateCreated).toLocaleDateString();
  const expirationDate = quote.expirationDate 
    ? new Date(quote.expirationDate).toLocaleDateString()
    : 'N/A';
  
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
        ${items.map(item => `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: left;">${item.description}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: left;">${item.itemType === 'part' ? 'Part' : 'Service'}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">${item.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">$${(item.unitPrice * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('')}
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
export function generateInvoiceEmail(invoice: any, customer: any, repair: any, items: any[]): string {
  // Format the dates
  const dateIssued = new Date(invoice.dateIssued).toLocaleDateString();
  const datePaid = invoice.datePaid
    ? new Date(invoice.datePaid).toLocaleDateString()
    : 'Not paid';
  
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
        ${items.map(item => `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: left;">${item.description}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: left;">${item.itemType === 'part' ? 'Part' : 'Service'}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">${item.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px 12px; text-align: right;">$${(item.unitPrice * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('')}
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