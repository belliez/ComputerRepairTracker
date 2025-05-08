/**
 * Utility functions for handling printing and document generation
 */
import { Currency } from "@/hooks/use-currency";

export interface PrintableDocument {
  title: string;
  content: string;
  // Add more properties as needed (e.g., CSS styles)
}

/**
 * Format a currency value based on the provided currency
 * This is a non-hook version of formatCurrency from use-currency.ts
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency?: Currency | null
): string {
  // Handle undefined, null, or non-numeric values
  if (amount === undefined || amount === null) {
    return '-';
  }
  
  // Convert to number if it's a string
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN values
  if (isNaN(numericAmount)) {
    return '-';
  }
  
  // Use the provided currency, or fallback to USD
  const currencyCode = currency?.code || 'USD';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericAmount);
}

/**
 * Print a document in a new window
 * @param document The document to print
 */
export function printDocument(document: PrintableDocument): void {
  // Create a new window for the document
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    console.error('Failed to open print window. Please check your popup settings.');
    alert('Failed to open print window. Please check your popup settings.');
    return;
  }
  
  // Write the document content to the new window
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${document.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.5;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .print-only {
            display: block;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 10px;
          }
          .print-header h1 {
            margin: 0;
            color: #2563eb;
          }
          .print-info {
            margin-bottom: 20px;
          }
          .print-info p {
            margin: 5px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
          }
          th {
            background-color: #f2f7ff;
            font-weight: bold;
          }
          .text-right {
            text-align: right;
          }
          .totals {
            margin-top: 20px;
            margin-left: auto;
            width: 300px;
          }
          .totals table {
            margin-left: auto;
            width: 100%;
          }
          .totals th, .totals td {
            padding: 5px 12px;
          }
          .notes {
            margin-top: 30px;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 5px;
          }
          @media print {
            body {
              font-size: 12pt;
            }
            .no-print {
              display: none;
            }
            button {
              display: none;
            }
          }
          .print-actions {
            margin-top: 20px;
            padding: 10px 0;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: flex-end;
          }
          .print-actions button {
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 10px;
          }
          .print-actions button:hover {
            background-color: #1d4ed8;
          }
        </style>
      </head>
      <body>
        ${document.content}
        <div class="print-actions no-print">
          <button onclick="window.print()">Print</button>
          <button onclick="window.close()">Close</button>
        </div>
      </body>
    </html>
  `);
  
  // Focus on the new window and initialize it
  printWindow.document.close();
  printWindow.focus();
}

/**
 * Create a quote document for printing
 */
export function createQuoteDocument(quote: any, customer: any, repair: any, items: any[]): PrintableDocument {
  // Format the dates
  const dateCreated = new Date(quote.dateCreated).toLocaleDateString();
  const expirationDate = quote.expirationDate 
    ? new Date(quote.expirationDate).toLocaleDateString()
    : 'N/A';
  
  // Create currency object from quote's currency code
  const currency = quote.currencyCode 
    ? { code: quote.currencyCode, name: '', symbol: '', isDefault: false } 
    : null;
  
  // Generate items table
  const itemsTable = `
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Type</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Quantity</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.description}</td>
            <td>${item.itemType === 'part' ? 'Part' : 'Service'}</td>
            <td class="text-right">${formatCurrency(item.unitPrice, currency)}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unitPrice * item.quantity, currency)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Create the document content
  const content = `
    <div class="print-header">
      <h1>Quote #${quote.quoteNumber}</h1>
      <div>
        <strong>Status:</strong> ${quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
      </div>
    </div>
    
    <div class="print-info">
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
          ${quote.currencyCode ? `<p><strong>Currency:</strong> ${quote.currencyCode}</p>` : ''}
        </div>
      </div>
    </div>
    
    <h3>Items</h3>
    ${itemsTable}
    
    <div class="totals">
      <table>
        <tr>
          <th>Subtotal</th>
          <td class="text-right">${formatCurrency(quote.subtotal, currency)}</td>
        </tr>
        <tr>
          <th>Tax</th>
          <td class="text-right">${formatCurrency(quote.tax || quote.taxAmount || (quote.total - quote.subtotal) || 0, currency)}</td>
        </tr>
        <tr>
          <th>Total</th>
          <td class="text-right"><strong>${formatCurrency(quote.total, currency)}</strong></td>
        </tr>
      </table>
    </div>
    
    ${quote.notes ? `
      <div class="notes">
        <h3>Notes</h3>
        <p>${quote.notes}</p>
      </div>
    ` : ''}
  `;

  return {
    title: `Quote ${quote.quoteNumber}`,
    content
  };
}

/**
 * Create an invoice document for printing
 */
export function createInvoiceDocument(invoice: any, customer: any, repair: any, items: any[]): PrintableDocument {
  // Format the dates
  const dateIssued = new Date(invoice.dateIssued).toLocaleDateString();
  const datePaid = invoice.datePaid
    ? new Date(invoice.datePaid).toLocaleDateString()
    : 'Not paid';
  
  // Create currency object from invoice's currency code
  const currency = invoice.currencyCode 
    ? { code: invoice.currencyCode, name: '', symbol: '', isDefault: false } 
    : null;
  
  // Generate items table
  const itemsTable = `
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Type</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Quantity</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.description}</td>
            <td>${item.itemType === 'part' ? 'Part' : 'Service'}</td>
            <td class="text-right">${formatCurrency(item.unitPrice, currency)}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unitPrice * item.quantity, currency)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Get the payment status label
  let statusLabel = 'Unpaid';
  let statusColor = 'text-red-500';
  
  if (invoice.status === 'paid') {
    statusLabel = 'Paid';
    statusColor = 'text-green-500';
  } else if (invoice.status === 'partial') {
    statusLabel = 'Partially Paid';
    statusColor = 'text-yellow-500';
  }

  // Create the document content
  const content = `
    <div class="print-header">
      <h1>Invoice #${invoice.invoiceNumber}</h1>
      <div>
        <strong>Status:</strong> <span class="${statusColor}">${statusLabel}</span>
      </div>
    </div>
    
    <div class="print-info">
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
          ${invoice.currencyCode ? `<p><strong>Currency:</strong> ${invoice.currencyCode}</p>` : ''}
        </div>
      </div>
    </div>
    
    <h3>Items</h3>
    ${itemsTable}
    
    <div class="totals">
      <table>
        <tr>
          <th>Subtotal</th>
          <td class="text-right">${formatCurrency(invoice.subtotal, currency)}</td>
        </tr>
        <tr>
          <th>Tax</th>
          <td class="text-right">${formatCurrency(invoice.tax || invoice.taxAmount || (invoice.total - invoice.subtotal) || 0, currency)}</td>
        </tr>
        <tr>
          <th>Total</th>
          <td class="text-right"><strong>${formatCurrency(invoice.total, currency)}</strong></td>
        </tr>
      </table>
    </div>
    
    ${invoice.notes ? `
      <div class="notes">
        <h3>Notes</h3>
        <p>${invoice.notes}</p>
      </div>
    ` : ''}
  `;

  return {
    title: `Invoice ${invoice.invoiceNumber}`,
    content
  };
}