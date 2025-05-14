/**
 * Utility functions for handling printing and document generation
 * Fixed version to correctly handle currency symbols in print documents
 */
import { Currency } from "@/hooks/use-currency";
import { getStandardHeaders, getCurrentOrgId } from "@/lib/organization-utils";

export interface PrintableDocument {
  title: string;
  content: string;
  // Add more properties as needed (e.g., CSS styles)
}

/**
 * Helper function to get a currency symbol based on currency code
 * Used for consistent direct symbol injection in HTML templates
 */
export function getCurrencySymbol(currencyCode: string): string {
  if (!currencyCode) {
    return '$'; // Default to $ if no currency code provided
  }
  
  // Handle special organization-specific currency codes like 'USD_2'
  const baseCurrency = currencyCode.split('_')[0];
  
  switch (baseCurrency) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'JPY':
      return '¥';
    case 'CAD':
      return 'C$';
    case 'AUD':
      return 'A$';
    default:
      return '$'; // Default fallback
  }
}

/**
 * Helper function to format currency for printing with a symbol
 */
export function formatCurrencyForPrint(amount: number, currencyCode: string = 'USD'): string {
  if (amount === null || amount === undefined) {
    return getCurrencySymbol(currencyCode) + '0.00';
  }
  
  const symbol = getCurrencySymbol(currencyCode);
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return symbol + formatter.format(amount);
}

/**
 * Function to fetch the organization's default currency
 */
export async function fetchDefaultCurrency(): Promise<Currency | null> {
  try {
    const response = await fetch('/api/settings/currencies', {
      method: 'GET',
      headers: {
        ...getStandardHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch currencies');
      return null;
    }
    
    const currencies: Currency[] = await response.json();
    
    // Find the default currency
    const defaultCurrency = currencies.find(c => c.isDefault);
    
    return defaultCurrency || null;
  } catch (error) {
    console.error('Error fetching default currency:', error);
    return null;
  }
}

/**
 * Main function to print a document
 * Takes repair data and items, generates HTML, and opens a print dialog
 */
export function printDocument(repair: any, items: any[] = []) {
  const title = `Repair Form - ${repair.ticketNumber}`;
  const content = generateRepairFormHTML(repair, items);
  
  const printDoc: PrintableDocument = {
    title,
    content
  };
  
  openAndPrint(printDoc);
}

/**
 * Function to create and download a quote document
 */
export async function createQuoteDocument(repair: any, items: any[]): Promise<any> {
  try {
    // First, create the quote in the database
    const quoteResponse = await fetch(`/api/repairs/${repair.id}/quote`, {
      method: 'POST',
      headers: {
        ...getStandardHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        items: items.map(item => ({
          itemId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0
        }))
      })
    });
    
    if (!quoteResponse.ok) {
      throw new Error(`Failed to create quote: ${quoteResponse.status}`);
    }
    
    const quoteData = await quoteResponse.json();
    
    // Now generate the quote PDF/HTML
    const quoteHTML = generateQuoteHTML(repair, items, quoteData);
    
    const printDoc: PrintableDocument = {
      title: `Quote - ${quoteData.quoteNumber}`,
      content: quoteHTML
    };
    
    // Open in a new window for printing/downloading
    openAndPrint(printDoc);
    
    return quoteData;
  } catch (error) {
    console.error('Error creating quote document:', error);
    throw error;
  }
}

/**
 * Function to create and download an invoice document
 */
export async function createInvoiceDocument(repair: any, items: any[]): Promise<any> {
  try {
    // First, create the invoice in the database
    const invoiceResponse = await fetch(`/api/repairs/${repair.id}/invoice`, {
      method: 'POST',
      headers: {
        ...getStandardHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        items: items.map(item => ({
          itemId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0
        }))
      })
    });
    
    if (!invoiceResponse.ok) {
      throw new Error(`Failed to create invoice: ${invoiceResponse.status}`);
    }
    
    const invoiceData = await invoiceResponse.json();
    
    // Now generate the invoice PDF/HTML
    const invoiceHTML = generateInvoiceHTML(repair, items, invoiceData);
    
    const printDoc: PrintableDocument = {
      title: `Invoice - ${invoiceData.invoiceNumber}`,
      content: invoiceHTML
    };
    
    // Open in a new window for printing/downloading
    openAndPrint(printDoc);
    
    return invoiceData;
  } catch (error) {
    console.error('Error creating invoice document:', error);
    throw error;
  }
}

/**
 * Helper function to open a document in a new window and trigger the print dialog
 */
function openAndPrint(doc: PrintableDocument): void {
  // Create a new window
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('Please allow pop-ups to print documents');
    return;
  }
  
  // Write the HTML content to the new window
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${doc.title}</title>
        <style>
          /* Print-friendly styles */
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          
          @media print {
            body {
              width: 100%;
              margin: 0;
              padding: 0;
            }
            
            .no-print {
              display: none;
            }
            
            button {
              display: none;
            }
          }
          
          .print-header {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .print-controls {
            margin-bottom: 20px;
            text-align: center;
          }
          
          .print-button {
            background: #4F46E5;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
          }
          
          .close-button {
            background: #6B7280;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="print-controls no-print">
          <button class="print-button" onclick="window.print()">Print Document</button>
          <button class="close-button" onclick="window.close()">Close</button>
        </div>
        
        ${doc.content}
      </body>
    </html>
  `);
  
  // Focus the new window
  printWindow.focus();
}

/**
 * Generate HTML for a repair form
 */
function generateRepairFormHTML(repair: any, items: any[] = []): string {
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const taxRate = repair.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  
  // Format dates
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };
  
  // Get default currency code
  const currencyCode = 'USD'; // Default for now, could be fetched from settings
  
  return `
    <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; color: #4F46E5;">REPAIR DETAILS</h1>
        <h2 style="margin: 5px 0; color: #6B7280;">Ticket #${repair.ticketNumber}</h2>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div style="flex: 1;">
          <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Customer Information</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${repair.customerName || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${repair.customerEmail || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${repair.customerPhone || 'N/A'}</p>
        </div>
        
        <div style="flex: 1; margin-left: 20px;">
          <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Device Information</h3>
          <p style="margin: 5px 0;"><strong>Type:</strong> ${repair.deviceType || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Brand/Model:</strong> ${repair.deviceBrand || 'N/A'} ${repair.deviceModel || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Serial Number:</strong> ${repair.deviceSerialNumber || 'N/A'}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Repair Details</h3>
        <div style="display: flex; justify-content: space-between;">
          <div style="flex: 1;">
            <p style="margin: 5px 0;"><strong>Intake Date:</strong> ${formatDate(repair.intakeDate)}</p>
            <p style="margin: 5px 0;"><strong>Est. Completion:</strong> ${formatDate(repair.estimatedCompletionDate)}</p>
          </div>
          <div style="flex: 1;">
            <p style="margin: 5px 0;"><strong>Status:</strong> ${repair.status}</p>
            <p style="margin: 5px 0;"><strong>Technician:</strong> ${repair.technicianName || 'Not Assigned'}</p>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Issue Description</h3>
        <p style="margin: 5px 0; white-space: pre-wrap;">${repair.issue || 'No issue description provided.'}</p>
      </div>
      
      ${repair.notes ? `
        <div style="margin-bottom: 20px;">
          <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Notes</h3>
          <p style="margin: 5px 0; white-space: pre-wrap;">${repair.notes}</p>
        </div>
      ` : ''}
      
      ${repair.diagnosticNotes ? `
        <div style="margin-bottom: 20px;">
          <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Diagnostic Notes</h3>
          <p style="margin: 5px 0; white-space: pre-wrap;">${repair.diagnosticNotes}</p>
        </div>
      ` : ''}
      
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Parts & Services</h3>
        ${items.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #F3F4F6;">
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid #E5E7EB;">Item</th>
                <th style="text-align: center; padding: 8px; border-bottom: 1px solid #E5E7EB;">Qty</th>
                <th style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">Unit Price</th>
                <th style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #E5E7EB;">
                    <div>${item.name}</div>
                    ${item.description ? `<div style="font-size: 0.85em; color: #6B7280;">${item.description}</div>` : ''}
                  </td>
                  <td style="text-align: center; padding: 8px; border-bottom: 1px solid #E5E7EB;">${item.quantity}</td>
                  <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(item.unitPrice, currencyCode)}</td>
                  <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(item.unitPrice * item.quantity, currencyCode)}</td>
                </tr>
              `).join('')}
              
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Subtotal:</strong></td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(subtotal, currencyCode)}</td>
              </tr>
              
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Tax (${taxRate}%):</strong></td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(taxAmount, currencyCode)}</td>
              </tr>
              
              <tr>
                <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Total:</strong></td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB; font-weight: bold;">${formatCurrencyForPrint(total, currencyCode)}</td>
              </tr>
            </tbody>
          </table>
        ` : '<p>No parts or services have been added to this repair.</p>'}
      </div>
      
      <div style="margin-top: 40px; border-top: 1px solid #E5E7EB; padding-top: 20px;">
        <h3 style="margin-bottom: 10px;">Customer Signature</h3>
        <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 30px;"></div>
        <p style="margin: 5px 0; font-size: 0.85em;">Date: ________________________</p>
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a quote
 */
function generateQuoteHTML(repair: any, items: any[], quote: any): string {
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const taxRate = repair.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  
  // Format dates
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };
  
  // Get default currency code
  const currencyCode = 'USD'; // Default for now, could be fetched from settings
  
  return `
    <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; color: #4F46E5;">REPAIR QUOTE</h1>
        <h2 style="margin: 5px 0; color: #6B7280;">Quote #${quote.quoteNumber}</h2>
        <p style="margin: 5px 0; color: #6B7280;">Date: ${formatDate(new Date().toISOString())}</p>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div style="flex: 1;">
          <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Customer Information</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${repair.customerName || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${repair.customerEmail || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${repair.customerPhone || 'N/A'}</p>
        </div>
        
        <div style="flex: 1; margin-left: 20px;">
          <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Device Information</h3>
          <p style="margin: 5px 0;"><strong>Type:</strong> ${repair.deviceType || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Brand/Model:</strong> ${repair.deviceBrand || 'N/A'} ${repair.deviceModel || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Serial Number:</strong> ${repair.deviceSerialNumber || 'N/A'}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Repair Description</h3>
        <p style="margin: 5px 0; white-space: pre-wrap;">${repair.issue || 'No issue description provided.'}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Quote Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #F3F4F6;">
              <th style="text-align: left; padding: 8px; border-bottom: 1px solid #E5E7EB;">Item</th>
              <th style="text-align: center; padding: 8px; border-bottom: 1px solid #E5E7EB;">Qty</th>
              <th style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">Unit Price</th>
              <th style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #E5E7EB;">
                  <div>${item.name}</div>
                  ${item.description ? `<div style="font-size: 0.85em; color: #6B7280;">${item.description}</div>` : ''}
                </td>
                <td style="text-align: center; padding: 8px; border-bottom: 1px solid #E5E7EB;">${item.quantity}</td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(item.unitPrice, currencyCode)}</td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(item.unitPrice * item.quantity, currencyCode)}</td>
              </tr>
            `).join('')}
            
            <tr>
              <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Subtotal:</strong></td>
              <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(subtotal, currencyCode)}</td>
            </tr>
            
            <tr>
              <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Tax (${taxRate}%):</strong></td>
              <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(taxAmount, currencyCode)}</td>
            </tr>
            
            <tr>
              <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Total:</strong></td>
              <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB; font-weight: bold;">${formatCurrencyForPrint(total, currencyCode)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Terms & Conditions</h3>
        <p style="margin: 5px 0; font-size: 0.9em;">
          1. This quote is valid for 30 days from the issue date.<br>
          2. Full payment is required upon completion of repair.<br>
          3. Additional parts or services not listed in this quote will require customer approval.<br>
          4. We are not responsible for data loss during the repair process.<br>
          5. Abandoned devices (not picked up within 30 days of repair completion) may incur storage fees.
        </p>
      </div>
      
      <div style="margin-top: 40px; border-top: 1px solid #E5E7EB; padding-top: 20px;">
        <h3 style="margin-bottom: 10px;">Customer Approval</h3>
        <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 30px;"></div>
        <p style="margin: 5px 0; font-size: 0.85em;">Date: ________________________</p>
      </div>
    </div>
  `;
}

/**
 * Generate HTML for an invoice
 */
function generateInvoiceHTML(repair: any, items: any[], invoice: any): string {
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const taxRate = repair.taxRate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  
  // Format dates
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };
  
  // Get default currency code
  const currencyCode = 'USD'; // Default for now, could be fetched from settings
  
  return `
    <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; color: #4F46E5;">INVOICE</h1>
        <h2 style="margin: 5px 0; color: #6B7280;">Invoice #${invoice.invoiceNumber}</h2>
        <p style="margin: 5px 0; color: #6B7280;">Date: ${formatDate(new Date().toISOString())}</p>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div style="flex: 1;">
          <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Billed To</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${repair.customerName || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${repair.customerEmail || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${repair.customerPhone || 'N/A'}</p>
        </div>
        
        <div style="flex: 1; margin-left: 20px;">
          <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Repair Information</h3>
          <p style="margin: 5px 0;"><strong>Ticket #:</strong> ${repair.ticketNumber}</p>
          <p style="margin: 5px 0;"><strong>Device:</strong> ${repair.deviceBrand || 'N/A'} ${repair.deviceModel || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Serial Number:</strong> ${repair.deviceSerialNumber || 'N/A'}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Invoice Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #F3F4F6;">
              <th style="text-align: left; padding: 8px; border-bottom: 1px solid #E5E7EB;">Item</th>
              <th style="text-align: center; padding: 8px; border-bottom: 1px solid #E5E7EB;">Qty</th>
              <th style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">Unit Price</th>
              <th style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #E5E7EB;">
                  <div>${item.name}</div>
                  ${item.description ? `<div style="font-size: 0.85em; color: #6B7280;">${item.description}</div>` : ''}
                </td>
                <td style="text-align: center; padding: 8px; border-bottom: 1px solid #E5E7EB;">${item.quantity}</td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(item.unitPrice, currencyCode)}</td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(item.unitPrice * item.quantity, currencyCode)}</td>
              </tr>
            `).join('')}
            
            <tr>
              <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Subtotal:</strong></td>
              <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(subtotal, currencyCode)}</td>
            </tr>
            
            <tr>
              <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Tax (${taxRate}%):</strong></td>
              <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;">${formatCurrencyForPrint(taxAmount, currencyCode)}</td>
            </tr>
            
            <tr>
              <td colspan="3" style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB;"><strong>Total:</strong></td>
              <td style="text-align: right; padding: 8px; border-bottom: 1px solid #E5E7EB; font-weight: bold;">${formatCurrencyForPrint(total, currencyCode)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; margin-bottom: 10px;">Payment Information</h3>
        <p style="margin: 5px 0;">Please make payment within 15 days of receipt of this invoice.</p>
        <p style="margin: 5px 0;">Payment methods accepted: Credit Card, Cash, Check</p>
      </div>
      
      <div style="margin-top: 40px; border-top: 1px solid #E5E7EB; padding-top: 20px; text-align: center; font-size: 0.85em; color: #6B7280;">
        <p>Thank you for your business!</p>
      </div>
    </div>
  `;
}