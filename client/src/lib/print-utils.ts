/**
 * Utility functions for handling printing and document generation
 * 
 * IMPORTANT: This version directly embeds currency symbols in the HTML templates
 * to avoid any issues with formatCurrency and browser formatting.
 */
import { Currency } from "@/hooks/use-currency";

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
    return ''; // No fallback, return empty string if no currency code provided
  }
  
  switch(currencyCode) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'JPY': return '¥';
    case 'AUD': return 'A$';
    case 'CAD': return 'C$';
    default: return ''; // No fallback for unknown currencies either
  }
}

/**
 * Format a number for display with the provided decimal places
 * Used for consistent formatting in HTML templates
 */
export function formatNumber(amount: number | string | null | undefined, decimalPlaces: number = 2): string {
  if (amount === undefined || amount === null) {
    return '0.00';
  }
  
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) {
    return '0.00';
  }
  
  // Format with the specified decimal places
  const formattedNumber = numericAmount.toFixed(decimalPlaces);
  
  // Add thousand separators
  const parts = formattedNumber.split('.');
  const wholePart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
  
  return wholePart + decimalPart;
}

/**
 * Print a document in a new window
 * Can accept either a PrintableDocument directly or a Promise that resolves to a PrintableDocument
 * @param documentOrPromise The document to print or a Promise that resolves to a document
 */
export async function printDocument(documentOrPromise: PrintableDocument | Promise<PrintableDocument>): Promise<void> {
  try {
    // If the parameter is a Promise, wait for it to resolve
    const document = documentOrPromise instanceof Promise 
      ? await documentOrPromise 
      : documentOrPromise;
    
    console.log("PRINT DOCUMENT: Printing document with title:", document.title);
    
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
  } catch (error) {
    console.error("PRINT DOCUMENT: Error during print process:", error);
    alert('Failed to print document. Please try again.');
  }
}

/**
 * Create a quote document for printing
 */
export async function createQuoteDocument(quote: any, customer: any, repair: any, itemsFromRepair: any[]): Promise<PrintableDocument> {
  // Format the dates
  const dateCreated = new Date(quote.dateCreated).toLocaleDateString();
  const expirationDate = quote.expirationDate 
    ? new Date(quote.expirationDate).toLocaleDateString()
    : 'N/A';
  
  console.log("PRINT DOCUMENT: Quote data received:", {
    quoteNumber: quote.quoteNumber,
    currencyCode: quote.currencyCode,
    dateCreated: quote.dateCreated,
    subtotal: quote.subtotal,
    tax: quote.tax,
    total: quote.total,
    raw: quote // Log the full quote object for debugging
  });
  
  // Initialize with the quote's currency code if available
  let currency = { 
    code: quote.currencyCode || 'GBP', // Default to GBP (will be overridden if we find the actual default)
    name: quote.currencyCode ? 
      (quote.currencyCode === 'USD' ? 'US Dollar' : 
       quote.currencyCode === 'EUR' ? 'Euro' : 
       quote.currencyCode === 'GBP' ? 'British Pound' : 
       quote.currencyCode === 'JPY' ? 'Japanese Yen' : 
       quote.currencyCode === 'AUD' ? 'Australian Dollar' : 
       quote.currencyCode === 'CAD' ? 'Canadian Dollar' : 
       `${quote.currencyCode} Currency`) : 'British Pound', 
    symbol: quote.currencyCode === 'EUR' ? '€' : 
            quote.currencyCode === 'GBP' ? '£' : 
            quote.currencyCode === 'USD' ? '$' : 
            quote.currencyCode === 'JPY' ? '¥' : 
            quote.currencyCode === 'AUD' ? 'A$' : 
            quote.currencyCode === 'CAD' ? 'C$' : 
            getCurrencySymbol(quote.currencyCode),
    isDefault: false // Will be updated when we fetch the currency list
  };
  
  // Log the currency data we're initializing with
  console.log("PRINT DOCUMENT: Initial currency data:", {
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    isDefault: currency.isDefault
  });
  
  try {
    // Direct API fetch for currency data to avoid any caching issues
    console.log("PRINT DOCUMENT: Fetching fresh currency data for print...");
    const response = await fetch('/api/settings/currencies', {
      method: 'GET',
      headers: {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      },
      cache: 'no-store'
    });
    
    if (response.ok) {
      const allCurrencies = await response.json();
      console.log("PRINT DOCUMENT: Fetched", allCurrencies.length, "currencies for print document:", allCurrencies);
      
      // Find the currency that matches the quote's currency code
      const quoteCurrencyCode = quote.currencyCode;
      console.log("PRINT DOCUMENT: Looking for currency code:", quoteCurrencyCode);
      
      if (quoteCurrencyCode) {
        const matchingCurrency = allCurrencies.find((c: Currency) => c.code === quoteCurrencyCode);
        
        // If found, use it
        if (matchingCurrency) {
          currency = matchingCurrency;
          console.log("PRINT DOCUMENT: Using matching currency:", matchingCurrency.code, "with symbol:", matchingCurrency.symbol);
          
          // Check if this currency is the organization default
          const defaultCurrency = allCurrencies.find((c: Currency) => c.isDefault);
          if (defaultCurrency && defaultCurrency.code === matchingCurrency.code) {
            currency.isDefault = true;
            console.log("PRINT DOCUMENT: This is the organization default currency");
          } else {
            currency.isDefault = false;
            console.log("PRINT DOCUMENT: This is NOT the organization default currency");
          }
        } else {
          console.log("PRINT DOCUMENT: Currency not found in list:", quoteCurrencyCode);
          // Use our initialized currency object with the correct symbol
          currency.isDefault = false;
        }
      } else {
        // If no currency code on quote, use the default currency from the API
        const defaultCurrency = allCurrencies.find((c: Currency) => c.isDefault);
        if (defaultCurrency) {
          currency = defaultCurrency;
          currency.isDefault = true; 
          console.log("PRINT DOCUMENT: Using organization default currency:", defaultCurrency.code, "with symbol:", defaultCurrency.symbol);
          
          // Update the name with human-readable format
          currency.name = 
            defaultCurrency.code === 'USD' ? 'US Dollar' : 
            defaultCurrency.code === 'EUR' ? 'Euro' : 
            defaultCurrency.code === 'GBP' ? 'British Pound' : 
            defaultCurrency.code === 'JPY' ? 'Japanese Yen' : 
            defaultCurrency.code === 'AUD' ? 'Australian Dollar' : 
            defaultCurrency.code === 'CAD' ? 'Canadian Dollar' : 
            defaultCurrency.name || `${defaultCurrency.code} Currency`;
          
          console.log("PRINT DOCUMENT: Updated currency name to:", currency.name);
        } else {
          console.log("PRINT DOCUMENT: No default currency found in API response, using fallback EUR");
        }
      }
    } else {
      console.error("PRINT DOCUMENT: Failed to fetch currencies, status:", response.status);
    }
  } catch (error) {
    console.error("PRINT DOCUMENT: Error fetching currency data:", error);
  }
  
  console.log("PRINT DOCUMENT: Final currency being used for formatting:", currency);
  
  // Override currency to GBP for hardcoded USD quotes (temporary fix for existing quotes)
  if (currency.code === 'USD') {
    console.log("PRINT DOCUMENT: Detected USD in an existing quote, forcing to GBP which is the current default");
    currency = {
      code: 'GBP',
      name: 'British Pound',
      symbol: '£',
      isDefault: true
    };
  }
  
  // Define decimal places based on currency
  const decimalPlaces = currency.code === 'JPY' ? 0 : 2;
  
  // Get direct symbol for HTML template - use hardcoded values for reliability
  const currencySymbol = 
    currency.code === 'EUR' ? '€' : 
    currency.code === 'GBP' ? '£' : 
    currency.code === 'USD' ? '$' : 
    currency.code === 'JPY' ? '¥' : 
    currency.code === 'AUD' ? 'A$' : 
    currency.code === 'CAD' ? 'C$' : 
    currency.symbol || '';  // fallback to stored symbol or empty string
  
  console.log("PRINT DOCUMENT: Using direct symbol for HTML template:", currencySymbol || 'none', "with", decimalPlaces, "decimal places");
  
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
  
  // Generate items table with direct symbol injection
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
        ${itemsToDisplay.length > 0 ? itemsToDisplay.map(item => {
          const unitPrice = item.unitPrice || 0;
          const quantity = item.quantity || 1;
          const lineTotal = unitPrice * quantity;
          return `
          <tr>
            <td>${item.description || 'N/A'}</td>
            <td>${item.itemType === 'part' ? 'Part' : 'Service'}</td>
            <td class="text-right">${currencySymbol}${formatNumber(unitPrice, decimalPlaces)}</td>
            <td class="text-right">${quantity}</td>
            <td class="text-right">${currencySymbol}${formatNumber(lineTotal, decimalPlaces)}</td>
          </tr>
        `;
        }).join('') : '<tr><td colspan="5" class="text-center">No items</td></tr>'}
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
          <p><strong>Currency:</strong> ${currency.name} ${!currency.isDefault ? `<span style="color: #cc0000; font-size: 0.9em;">(not organization default)</span>` : ''}</p>
        </div>
      </div>
    </div>
    
    <h3>Items</h3>
    ${itemsTable}
    
    <div class="totals">
      <table>
        <tr>
          <th>Subtotal</th>
          <td class="text-right">${currencySymbol}${formatNumber(quote.subtotal, decimalPlaces)}</td>
        </tr>
        <tr>
          <th>Tax</th>
          <td class="text-right">${currencySymbol}${formatNumber(quote.tax || quote.taxAmount || (quote.total - quote.subtotal) || 0, decimalPlaces)}</td>
        </tr>
        <tr>
          <th>Total</th>
          <td class="text-right"><strong>${currencySymbol}${formatNumber(quote.total, decimalPlaces)}</strong></td>
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
export async function createInvoiceDocument(invoice: any, customer: any, repair: any, itemsFromRepair: any[]): Promise<PrintableDocument> {
  // Format the dates
  const dateIssued = new Date(invoice.dateIssued).toLocaleDateString();
  const datePaid = invoice.datePaid
    ? new Date(invoice.datePaid).toLocaleDateString()
    : 'Not paid';
  
  // Fetch the latest currency data for accurate display
  console.log("PRINT DOCUMENT: Invoice data received with currency:", invoice.currencyCode, "and invoice data:", {
    invoiceNumber: invoice.invoiceNumber,
    dateIssued: invoice.dateIssued,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    raw: invoice // Log the full invoice object for debugging
  });
  
  // Initialize with the invoice's currency code if available
  let currency = { 
    code: invoice.currencyCode || 'GBP', // Default to GBP (will be overridden if we find the actual default)
    name: invoice.currencyCode ? 
      (invoice.currencyCode === 'USD' ? 'US Dollar' : 
       invoice.currencyCode === 'EUR' ? 'Euro' : 
       invoice.currencyCode === 'GBP' ? 'British Pound' : 
       invoice.currencyCode === 'JPY' ? 'Japanese Yen' : 
       invoice.currencyCode === 'AUD' ? 'Australian Dollar' : 
       invoice.currencyCode === 'CAD' ? 'Canadian Dollar' : 
       `${invoice.currencyCode} Currency`) : 'British Pound', 
    symbol: invoice.currencyCode === 'EUR' ? '€' : 
            invoice.currencyCode === 'GBP' ? '£' : 
            invoice.currencyCode === 'USD' ? '$' : 
            invoice.currencyCode === 'JPY' ? '¥' : 
            invoice.currencyCode === 'AUD' ? 'A$' : 
            invoice.currencyCode === 'CAD' ? 'C$' : 
            getCurrencySymbol(invoice.currencyCode),
    isDefault: false // Will be updated when we fetch the currency list
  };
  
  try {
    // Direct API fetch for currency data to avoid any caching issues
    console.log("PRINT DOCUMENT: Fetching fresh currency data for invoice print...");
    const response = await fetch('/api/settings/currencies', {
      method: 'GET',
      headers: {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': '2',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      },
      cache: 'no-store'
    });
    
    if (response.ok) {
      const allCurrencies = await response.json();
      console.log("PRINT DOCUMENT: Fetched", allCurrencies.length, "currencies for invoice document:", allCurrencies);
      
      // Find the currency that matches the invoice's currency code
      const invoiceCurrencyCode = invoice.currencyCode;
      console.log("PRINT DOCUMENT: Looking for currency code:", invoiceCurrencyCode);
      
      if (invoiceCurrencyCode) {
        const matchingCurrency = allCurrencies.find((c: Currency) => c.code === invoiceCurrencyCode);
        
        // If found, use it
        if (matchingCurrency) {
          currency = matchingCurrency;
          console.log("PRINT DOCUMENT: Using matching currency:", matchingCurrency.code, "with symbol:", matchingCurrency.symbol);
          
          // Check if this currency is the organization default
          const defaultCurrency = allCurrencies.find((c: Currency) => c.isDefault);
          if (defaultCurrency && defaultCurrency.code === matchingCurrency.code) {
            currency.isDefault = true;
            console.log("PRINT DOCUMENT: This is the organization default currency");
          } else {
            currency.isDefault = false;
            console.log("PRINT DOCUMENT: This is NOT the organization default currency");
          }
        } else {
          console.log("PRINT DOCUMENT: Currency not found in list:", invoiceCurrencyCode);
          // Use our initialized currency object with the correct symbol
          currency.isDefault = false;
        }
      } else {
        // If no currency code on invoice, use the default currency
        const defaultCurrency = allCurrencies.find((c: Currency) => c.isDefault);
        if (defaultCurrency) {
          currency = defaultCurrency;
          currency.isDefault = true;
          console.log("PRINT DOCUMENT: Using default currency:", defaultCurrency.code, "with symbol:", defaultCurrency.symbol);
        } else {
          console.log("PRINT DOCUMENT: No default currency found, using:", currency.code);
          currency.isDefault = false;
        }
      }
    } else {
      console.error("PRINT DOCUMENT: Failed to fetch currencies, status:", response.status);
    }
  } catch (error) {
    console.error("PRINT DOCUMENT: Error fetching currency data:", error);
  }
  
  console.log("PRINT DOCUMENT: Final currency being used for formatting:", currency);
  
  // Override currency to GBP for hardcoded USD invoices (temporary fix for existing invoices)
  if (currency.code === 'USD') {
    console.log("PRINT DOCUMENT: Detected USD in an existing invoice, forcing to GBP which is the current default");
    currency = {
      code: 'GBP',
      name: 'British Pound',
      symbol: '£',
      isDefault: true
    };
  }
  
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
  
  // Define decimal places based on currency
  const decimalPlaces = currency.code === 'JPY' ? 0 : 2;
  
  // Get direct symbol for HTML template
  const currencySymbol = getCurrencySymbol(currency.code);
  
  console.log("PRINT DOCUMENT: Using direct symbol for invoice HTML template:", currencySymbol, "with", decimalPlaces, "decimal places");
  
  // Generate items table with direct symbol injection
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
        ${itemsToDisplay.length > 0 ? itemsToDisplay.map(item => {
          const unitPrice = item.unitPrice || 0;
          const quantity = item.quantity || 1;
          const lineTotal = unitPrice * quantity;
          return `
          <tr>
            <td>${item.description || 'N/A'}</td>
            <td>${item.itemType === 'part' ? 'Part' : 'Service'}</td>
            <td class="text-right">${currencySymbol}${formatNumber(unitPrice, decimalPlaces)}</td>
            <td class="text-right">${quantity}</td>
            <td class="text-right">${currencySymbol}${formatNumber(lineTotal, decimalPlaces)}</td>
          </tr>
        `;
        }).join('') : '<tr><td colspan="5" class="text-center">No items</td></tr>'}
      </tbody>
    </table>
  `;

  // Get the payment status label
  let statusLabel = 'Unpaid';
  let statusColor = 'text-red-500';
  
  // Variable to hold payment info for partially paid invoices
  let paymentInfo = '';
  
  if (invoice.paymentStatus === 'paid') {
    statusLabel = 'Paid';
    statusColor = 'text-green-500';
  } else if (invoice.paymentStatus === 'partial') {
    statusLabel = 'Partially Paid';
    statusColor = 'text-yellow-500';
    
    // Add payment info for partial payments
    if (invoice.amountPaid != null) {
      const amountPaid = invoice.amountPaid || 0;
      const amountDue = invoice.total - amountPaid;
      paymentInfo = `
        <div class="payment-info" style="margin-top: 20px; padding: 10px; background-color: #fff9e6; border-radius: 5px; border: 1px solid #ffe580;">
          <h3>Payment Information</h3>
          <p><strong>Amount Paid:</strong> ${currencySymbol}${formatNumber(amountPaid, decimalPlaces)}</p>
          <p><strong>Amount Due:</strong> ${currencySymbol}${formatNumber(amountDue > 0 ? amountDue : 0, decimalPlaces)}</p>
        </div>
      `;
    }
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
          <p><strong>Currency:</strong> ${currency.name} ${!currency.isDefault ? `<span style="color: #cc0000; font-size: 0.9em;">(not organization default)</span>` : ''}</p>
        </div>
      </div>
    </div>
    
    <h3>Items</h3>
    ${itemsTable}
    
    <div class="totals">
      <table>
        <tr>
          <th>Subtotal</th>
          <td class="text-right">${currencySymbol}${formatNumber(invoice.subtotal, decimalPlaces)}</td>
        </tr>
        <tr>
          <th>Tax</th>
          <td class="text-right">${currencySymbol}${formatNumber(invoice.tax || invoice.taxAmount || (invoice.total - invoice.subtotal) || 0, decimalPlaces)}</td>
        </tr>
        <tr>
          <th>Total</th>
          <td class="text-right"><strong>${currencySymbol}${formatNumber(invoice.total, decimalPlaces)}</strong></td>
        </tr>
      </table>
    </div>
    
    ${paymentInfo}
    
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