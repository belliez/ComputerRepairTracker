import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertInvoiceSchema, RepairItem, Quote } from "@shared/schema";
import { CurrencySymbol } from "@/components/currency-symbol";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface InvoiceFormProps {
  repairId: number;
  quoteId?: number;
  invoiceId?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function InvoiceForm({
  repairId,
  quoteId,
  invoiceId,
  isOpen,
  onClose,
}: InvoiceFormProps) {
  const { toast } = useToast();

  // Fetch the repair items
  const { data: repairItems, isLoading: isLoadingItems } = useQuery<RepairItem[]>({
    queryKey: [`/api/repairs/${repairId}/items`],
    enabled: !!repairId,
  });

  // If we have a quoteId, fetch the quote to use its values
  const { data: approvedQuote, isLoading: isLoadingQuote } = useQuery<Quote>({
    queryKey: [`/api/quotes/${quoteId}`],
    enabled: !!quoteId,
  });

  // If we're editing an existing invoice
  const { data: existingInvoice, isLoading: isLoadingInvoice } = useQuery<Invoice>({
    queryKey: [`/api/invoices/${invoiceId}`],
    enabled: !!invoiceId,
  });

  // Define interfaces for our data structures
  interface Currency {
    code: string;
    name: string;
    symbol: string;
    isDefault: boolean;
  }

  interface TaxRate {
    id: number;
    name: string;
    rate: number;
    isDefault: boolean;
  }

  interface Organization {
    id: number;
    name: string;
    settings?: {
      email?: string;
      phone?: string;
      address?: string;
      enableTax?: boolean;
    };
  }

  interface Invoice {
    id: number;
    repairId: number;
    quoteId: number | null;
    invoiceNumber: string;
    dateCreated: string;
    dueDate: string | null;
    subtotal: number;
    tax: number;
    total: number;
    status: string;
    notes: string | null;
    currencyCode: string;
    taxRateId: number;
    paymentDate: string | null;
    paymentMethod: string | null;
  }

  // Get currencies and tax rates
  const { data: currencies, isLoading: isLoadingCurrencies } = useQuery<Currency[]>({
    queryKey: ['/api/settings/currencies'],
  });
  
  const { data: defaultCurrency, isLoading: isLoadingDefaultCurrency } = useQuery<Currency>({
    queryKey: ['/api/settings/currencies/default'],
  });
  
  const { data: taxRates, isLoading: isLoadingTaxRates } = useQuery<TaxRate[]>({
    queryKey: ['/api/settings/tax-rates'],
  });
  
  const { data: defaultTaxRate, isLoading: isLoadingDefaultTaxRate } = useQuery<TaxRate>({
    queryKey: ['/api/settings/tax-rates/default'],
  });
  
  // Get organization data to check if tax is enabled
  const { data: organization, isLoading: isLoadingOrganization } = useQuery<Organization>({
    queryKey: ['/api/organizations'],
    select: (data) => Array.isArray(data) ? data[0] : data,
  });
  
  // State for selected currency and tax rate
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>("");
  const [selectedTaxRateId, setSelectedTaxRateId] = useState<number | null>(null);

  // Debug logging for currency and tax rate data
  useEffect(() => {
    console.log("INVOICE FORM DEBUG: Default currency data:", defaultCurrency);
    console.log("INVOICE FORM DEBUG: Selected currency code:", selectedCurrencyCode);
    console.log("INVOICE FORM DEBUG: All currencies:", currencies);
    console.log("INVOICE FORM DEBUG: Selected currency object:", 
      currencies?.find(c => c.code === selectedCurrencyCode)
    );
  }, [defaultCurrency, currencies, selectedCurrencyCode]);
  
  // Debug tax rate data
  useEffect(() => {
    console.log("INVOICE FORM DEBUG: Default tax rate:", defaultTaxRate);
    console.log("INVOICE FORM DEBUG: Selected tax rate ID:", selectedTaxRateId);
    console.log("INVOICE FORM DEBUG: All tax rates:", taxRates);
    console.log("INVOICE FORM DEBUG: Selected tax rate object:", 
      taxRates?.find(r => r.id === selectedTaxRateId)
    );
  }, [defaultTaxRate, taxRates, selectedTaxRateId]);
  
  // Set defaults when data loads
  useEffect(() => {
    if (defaultCurrency && !selectedCurrencyCode) {
      console.log("INVOICE FORM DEBUG: Setting default currency code to", defaultCurrency.code, "with symbol", defaultCurrency.symbol);
      setSelectedCurrencyCode(defaultCurrency.code);
    }
    if (defaultTaxRate && !selectedTaxRateId) {
      console.log("INVOICE FORM DEBUG: Setting default tax rate ID to", defaultTaxRate.id, "with rate", defaultTaxRate.rate);
      setSelectedTaxRateId(defaultTaxRate.id);
    }
  }, [defaultCurrency, defaultTaxRate, selectedCurrencyCode, selectedTaxRateId]);

  // Get the selected currency
  const selectedCurrency = selectedCurrencyCode
    ? currencies?.find(currency => currency.code === selectedCurrencyCode)
    : defaultCurrency;
  
  // Get the selected tax rate
  const selectedTaxRate = selectedTaxRateId 
    ? taxRates?.find(rate => rate.id === selectedTaxRateId)
    : defaultTaxRate;
    
  // Debug logs for currency and tax rate data
  useEffect(() => {
    console.log("INVOICE FORM DEBUG: Default currency data:", defaultCurrency);
    console.log("INVOICE FORM DEBUG: Selected currency code:", selectedCurrencyCode);
    console.log("INVOICE FORM DEBUG: All currencies:", currencies);
    console.log("INVOICE FORM DEBUG: Selected currency object:", selectedCurrency);
  }, [defaultCurrency, selectedCurrencyCode, currencies, selectedCurrency]);

  // When editing, load the existing invoice's settings
  useEffect(() => {
    if (existingInvoice) {
      if (existingInvoice.currencyCode) {
        setSelectedCurrencyCode(existingInvoice.currencyCode);
      }
      if (existingInvoice.taxRateId) {
        setSelectedTaxRateId(existingInvoice.taxRateId);
      }
    }
  }, [existingInvoice]);

  // Calculate values from items or approved quote
  const subtotal = approvedQuote?.subtotal || repairItems?.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) || 0;
  const taxRate = selectedTaxRate?.rate || 0;
  
  // Normalize tax rate: if greater than 1, assume it's a percentage and convert to decimal
  const normalizedTaxRate = taxRate > 1 ? taxRate / 100 : taxRate;
  
  // Check if tax is enabled for the organization
  const isTaxEnabled = organization?.settings?.enableTax !== false;
  console.log("Invoice Form - Tax enabled for organization:", isTaxEnabled, organization?.settings);
  
  // Only calculate tax if it's enabled for the organization
  const taxAmount = isTaxEnabled 
    ? approvedQuote?.tax || (subtotal * normalizedTaxRate) 
    : 0;
  const total = approvedQuote?.total || subtotal + taxAmount;

  // Form validation schema
  const formSchema = z.object({
    repairId: z.number(),
    quoteId: z.number().nullable().optional(),
    invoiceNumber: z.string(),
    dateCreated: z.string(),
    dueDate: z.string().nullable().optional(),
    subtotal: z.number(),
    tax: z.number(),
    total: z.number(),
    status: z.string(),
    notes: z.string().nullable().optional(),
    currencyCode: z.string(),
    taxRateId: z.number(),
    paymentDate: z.string().nullable().optional(),
    paymentMethod: z.string().nullable().optional(),
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      repairId,
      quoteId: quoteId || null,
      invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`, // Placeholder
      dateCreated: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
      subtotal,
      tax: taxAmount,
      total,
      status: "unpaid",
      notes: "",
      currencyCode: selectedCurrencyCode || (defaultCurrency?.code || "GBP"),
      taxRateId: selectedTaxRateId || (defaultTaxRate?.id || 25), // Using ID 25 which exists in the DB
      paymentDate: null,
      paymentMethod: null,
    },
  });

  // Update form with existing invoice data if editing
  useEffect(() => {
    if (existingInvoice) {
      // Format dates for input fields
      const dateCreated = new Date(existingInvoice.dateCreated).toISOString().split('T')[0];
      const dueDate = existingInvoice.dueDate 
        ? new Date(existingInvoice.dueDate).toISOString().split('T')[0]
        : null;
      const paymentDate = existingInvoice.paymentDate
        ? new Date(existingInvoice.paymentDate).toISOString().split('T')[0]
        : null;
      
      form.reset({
        repairId: existingInvoice.repairId,
        quoteId: existingInvoice.quoteId,
        invoiceNumber: existingInvoice.invoiceNumber,
        dateCreated,
        dueDate,
        subtotal: existingInvoice.subtotal,
        tax: existingInvoice.tax,
        total: existingInvoice.total,
        status: existingInvoice.status,
        notes: existingInvoice.notes || "",
        currencyCode: existingInvoice.currencyCode || (defaultCurrency?.code || "GBP"),
        taxRateId: existingInvoice.taxRateId || (defaultTaxRate?.id || 25), // Using ID 25 which exists in the DB
        paymentDate,
        paymentMethod: existingInvoice.paymentMethod,
      });
    }
  }, [existingInvoice, form, defaultCurrency, defaultTaxRate]);

  // Mutation for creating or updating invoice
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      try {
        const endpoint = invoiceId ? `/api/invoices/${invoiceId}` : "/api/invoices";
        const method = invoiceId ? "PUT" : "POST";
        
        console.log(`DEBUG: Making ${method} request to ${endpoint} with data:`, values);
        console.log("INVOICE FORM DEBUG: Available tax rates:", taxRates);
        console.log("INVOICE FORM DEBUG: Selected tax rate ID:", values.taxRateId);
        
        const response = await apiRequest(method, endpoint, values);
        
        if (!response.ok) {
          console.error(`DEBUG: API error: ${response.status}`);
          const errorText = await response.text();
          console.error(`DEBUG: Error response:`, errorText);
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error(`DEBUG: Error in mutation:`, error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: invoiceId ? "Invoice updated" : "Invoice created",
        description: invoiceId
          ? "The invoice has been updated successfully"
          : "The invoice has been created successfully",
      });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${invoiceId ? "update" : "create"} invoice: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    try {
      console.log("INVOICE FORM DEBUG: Form values before submission:", values);
      
      // Ensure taxRateId is valid by checking available tax rates
      if (!taxRates?.some(rate => rate.id === values.taxRateId)) {
        console.log("INVOICE FORM DEBUG: Tax rate ID is invalid, using first available tax rate");
        if (taxRates && taxRates.length > 0) {
          values.taxRateId = taxRates[0].id;
          console.log("INVOICE FORM DEBUG: Updated tax rate ID to", values.taxRateId);
        }
      }
      
      // Ensure dates are in ISO string format
      const formattedValues = {
        ...values,
        dateCreated: values.dateCreated ? new Date(values.dateCreated).toISOString() : new Date().toISOString(),
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
        paymentDate: values.paymentDate ? new Date(values.paymentDate).toISOString() : null,
      };
      
      console.log("INVOICE FORM DEBUG: Final formatted values:", formattedValues);
      mutation.mutate(formattedValues);
    } catch (error) {
      console.error("DEBUG: Error in onSubmit function:", error);
    }
  };

  const isLoading = isLoadingItems || isLoadingQuote || isLoadingInvoice || mutation.isPending;

  const isUnpaidInvoice = existingInvoice?.status === "unpaid";
  const isPaidInvoice = existingInvoice?.status === "paid";
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoiceId ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
          <DialogDescription>
            {invoiceId
              ? "Update the invoice information below"
              : "Create an invoice for the repair"}
          </DialogDescription>
        </DialogHeader>

        {isLoading && !mutation.isPending ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            <span className="ml-3">Loading data...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateCreated"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Created</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value?.split('T')[0] || ''} 
                          disabled={!!approvedQuote}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value?.split('T')[0] || ''} 
                          disabled={!!approvedQuote || isPaidInvoice}
                          onChange={(e) => {
                            field.onChange(e.target.value || null);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                        disabled={isPaidInvoice}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unpaid">
                            <div className="flex items-center">
                              <Badge variant="outline" className="mr-2 bg-red-50 text-red-700 border-red-200">Unpaid</Badge>
                              <span>Unpaid</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="paid">
                            <div className="flex items-center">
                              <Badge variant="outline" className="mr-2 bg-green-50 text-green-700 border-green-200">Paid</Badge>
                              <span>Paid</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="cancelled">
                            <div className="flex items-center">
                              <Badge variant="outline" className="mr-2 bg-gray-50 text-gray-700 border-gray-200">Cancelled</Badge>
                              <span>Cancelled</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isUnpaidInvoice && (
                  <>
                    <FormField
                      control={form.control}
                      name="paymentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value?.split('T')[0] || ''} 
                              onChange={(e) => {
                                field.onChange(e.target.value || null);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value || ''}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                              <SelectItem value="check">Check</SelectItem>
                              <SelectItem value="paypal">PayPal</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="currencyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedCurrencyCode(value);
                        }}
                        defaultValue={field.value}
                        value={field.value}
                        disabled={!!approvedQuote || isPaidInvoice}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies?.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              <div className="flex items-center">
                                <span className="mr-2">{currency.symbol}</span>
                                <span>{currency.name} ({currency.code})</span>
                                {currency.isDefault && (
                                  <Badge className="ml-2" variant="outline">Default</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxRateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex">
                        <span>Tax Rate</span>
                        {!isTaxEnabled && (
                          <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">Tax Disabled</Badge>
                        )}
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const numberValue = Number(value);
                          field.onChange(numberValue);
                          setSelectedTaxRateId(numberValue);
                        }}
                        defaultValue={field.value?.toString()}
                        value={field.value?.toString()}
                        disabled={!!approvedQuote || isPaidInvoice || !isTaxEnabled}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax rate" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taxRates?.map((rate) => (
                            <SelectItem key={rate.id} value={rate.id.toString()}>
                              <div className="flex items-center">
                                <span>{rate.name} ({rate.rate}%)</span>
                                {rate.isDefault && (
                                  <Badge className="ml-2" variant="outline">Default</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {isTaxEnabled 
                          ? "Select the appropriate tax rate for this invoice" 
                          : "Tax is disabled in organization settings"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="subtotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtotal</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <CurrencySymbol currencyCode={selectedCurrencyCode} />
                          <Input
                            {...field}
                            value={selectedCurrencyCode === 'JPY' ? field.value.toFixed(0) : field.value.toFixed(2)}
                            disabled={!!approvedQuote}
                            type="number"
                            step={selectedCurrencyCode === 'JPY' ? "1" : "0.01"}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              field.onChange(value);
                              
                              // Recalculate tax and total
                              const newTax = isTaxEnabled ? value * normalizedTaxRate : 0;
                              const newTotal = value + newTax;
                              
                              form.setValue("tax", newTax);
                              form.setValue("total", newTotal);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <CurrencySymbol currencyCode={selectedCurrencyCode} />
                          <Input
                            {...field}
                            value={selectedCurrencyCode === 'JPY' ? field.value.toFixed(0) : field.value.toFixed(2)}
                            disabled={true} // Tax is always calculated
                            type="number"
                            step={selectedCurrencyCode === 'JPY' ? "1" : "0.01"}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <CurrencySymbol currencyCode={selectedCurrencyCode} />
                          <Input
                            {...field}
                            value={selectedCurrencyCode === 'JPY' ? field.value.toFixed(0) : field.value.toFixed(2)}
                            disabled={true} // Total is always calculated
                            type="number"
                            step={selectedCurrencyCode === 'JPY' ? "1" : "0.01"}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any special notes or payment terms for this invoice?"
                          className="min-h-[100px]"
                          {...field}
                          value={field.value || ''}
                          disabled={isPaidInvoice}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  )}
                  {invoiceId ? "Update Invoice" : "Create Invoice"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}