import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertQuoteSchema, RepairItem } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencySymbol } from "@/components/currency-symbol";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Helper function to format date to YYYY-MM-DD for input type="date"
function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}
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
import { useCurrency } from "@/hooks/use-currency";
import EditableLineItems from "./editable-line-items";

interface QuoteFormProps {
  repairId: number;
  quoteId?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuoteForm({ repairId, quoteId, isOpen, onClose }: QuoteFormProps) {
  console.log("DEBUG: QuoteForm rendered with props:", { repairId, quoteId, isOpen });
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  // Get repair items to calculate the quote - always fetch for both new and edit
  const { data: repairItems, isLoading: isLoadingItems } = useQuery<RepairItem[]>({
    queryKey: [`/api/repairs/${repairId}/items`],
    enabled: !!repairId,
  });

  // Get existing quote if editing
  const { data: existingQuote, isLoading: isLoadingQuote } = useQuery<Quote>({
    queryKey: [`/api/quotes/${quoteId}`],
    enabled: !!quoteId,
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
  
  interface Quote {
    id: number;
    repairId: number;
    quoteNumber: string;
    dateCreated: string;
    expirationDate: string | null;
    subtotal: number;
    tax: number;
    total: number;
    status: string;
    notes: string | null;
    currencyCode: string;
    taxRateId: number;
  }
  
  // Get currencies and tax rates
  const { data: currencies, isLoading: isLoadingCurrencies } = useQuery<Currency[]>({
    queryKey: ['/api/public-settings/currencies'],
  });
  
  const { data: defaultCurrencyData, isLoading: isLoadingDefaultCurrency } = useQuery<Currency>({
    queryKey: ['/api/public-settings/currencies/default'],
  });
  
  const { data: taxRates, isLoading: isLoadingTaxRates } = useQuery<TaxRate[]>({
    queryKey: ['/api/public-settings/tax-rates'],
  });
  
  const { data: defaultTaxRate, isLoading: isLoadingDefaultTaxRate } = useQuery<TaxRate>({
    queryKey: ['/api/public-settings/tax-rates/default'],
  });
  
  // Get organization data to check if tax is enabled
  const { data: organization, isLoading: isLoadingOrganization } = useQuery<Organization>({
    queryKey: ['/api/organizations'],
    select: (data) => Array.isArray(data) ? data[0] : data,
  });
  
  // State for selected currency and tax rate
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>("");
  const [selectedTaxRateId, setSelectedTaxRateId] = useState<number | null>(null);
  
  // Set defaults when data loads
  useEffect(() => {
    if (defaultCurrencyData && !selectedCurrencyCode) {
      console.log("QUOTE FORM DEBUG: Setting default currency code to", defaultCurrencyData.code, "with symbol", defaultCurrencyData.symbol);
      setSelectedCurrencyCode(defaultCurrencyData.code);
    }
    if (defaultTaxRate && !selectedTaxRateId) {
      console.log("QUOTE FORM DEBUG: Setting default tax rate ID to", defaultTaxRate.id, "with rate", defaultTaxRate.rate);
      setSelectedTaxRateId(defaultTaxRate.id);
    }
  }, [defaultCurrencyData, defaultTaxRate, selectedCurrencyCode, selectedTaxRateId]);
  
  // When editing, load the existing quote's settings
  useEffect(() => {
    if (existingQuote) {
      if (existingQuote.currencyCode) {
        setSelectedCurrencyCode(existingQuote.currencyCode);
      }
      if (existingQuote.taxRateId) {
        setSelectedTaxRateId(existingQuote.taxRateId);
      }
    }
  }, [existingQuote]);
  
  // Get the selected tax rate
  const selectedTaxRate = selectedTaxRateId 
    ? taxRates?.find(rate => rate.id === selectedTaxRateId)
    : defaultTaxRate;
    
  // Get the selected currency
  const selectedCurrency = selectedCurrencyCode
    ? currencies?.find(currency => currency.code === selectedCurrencyCode)
    : defaultCurrencyData;
    
  // Debug logs for currency and tax rate data
  useEffect(() => {
    console.log("QUOTE FORM DEBUG: Default currency data:", defaultCurrencyData);
    console.log("QUOTE FORM DEBUG: Selected currency code:", selectedCurrencyCode);
    console.log("QUOTE FORM DEBUG: All currencies:", currencies);
    console.log("QUOTE FORM DEBUG: Selected currency object:", selectedCurrency);
  }, [defaultCurrencyData, selectedCurrencyCode, currencies, selectedCurrency]);
  
  // Calculate values from repair items
  const subtotal = repairItems?.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) || 0;
  const taxRate = selectedTaxRate?.rate || 0;
  
  // Normalize tax rate: if greater than 1, assume it's a percentage and convert to decimal
  const normalizedTaxRate = taxRate > 1 ? taxRate / 100 : taxRate;
  
  // Check if tax is enabled for the organization
  const isTaxEnabled = organization?.settings?.enableTax !== false;
  console.log("Quote Form - Tax enabled for organization:", isTaxEnabled, organization?.settings);
  
  // Only calculate tax if it's enabled for the organization
  const taxAmount = isTaxEnabled ? subtotal * normalizedTaxRate : 0;
  const total = subtotal + taxAmount;

  // Form validation schema - client side only
  const formSchema = z.object({
    repairId: z.number(),
    quoteNumber: z.string(),
    dateCreated: z.string(),
    expirationDate: z.string().nullable().optional(),
    subtotal: z.number(),
    tax: z.number(),
    total: z.number(),
    status: z.string(),
    notes: z.string().nullable().optional(),
    currencyCode: z.string(),
    taxRateId: z.number()
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      repairId,
      quoteNumber: `QT-${Math.floor(1000 + Math.random() * 9000)}`, // Placeholder
      dateCreated: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
      subtotal,
      tax: taxAmount,
      total,
      status: "pending",
      notes: "",
      currencyCode: selectedCurrencyCode || (defaultCurrencyData?.code || "USD"),
      taxRateId: selectedTaxRateId || (defaultTaxRate?.id || 1),
    },
  });

  // Update form with existing quote data if editing
  useEffect(() => {
    if (existingQuote) {
      // Format dates for input fields
      const dateCreated = new Date(existingQuote.dateCreated).toISOString().split('T')[0];
      const expirationDate = existingQuote.expirationDate 
        ? new Date(existingQuote.expirationDate).toISOString().split('T')[0]
        : null;
      
      form.reset({
        repairId: existingQuote.repairId,
        quoteNumber: existingQuote.quoteNumber,
        dateCreated,
        expirationDate,
        subtotal: existingQuote.subtotal,
        tax: existingQuote.tax,
        total: existingQuote.total,
        status: existingQuote.status,
        notes: existingQuote.notes || "",
        currencyCode: existingQuote.currencyCode || (defaultCurrencyData?.code || "USD"),
        taxRateId: existingQuote.taxRateId || (defaultTaxRate?.id || 1),
      });
    }
  }, [existingQuote, form, defaultCurrencyData, defaultTaxRate]);

  // Automatically update totals when items change
  useEffect(() => {
    if (repairItems) {
      const newSubtotal = repairItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      
      // Normalize tax rate: if greater than 1, assume it's a percentage and convert to decimal
      const normalizedTaxRate = taxRate > 1 ? taxRate / 100 : taxRate;
      
      // Only calculate tax if it's enabled for the organization
      const newTaxAmount = isTaxEnabled ? newSubtotal * normalizedTaxRate : 0;
      const newTotal = newSubtotal + newTaxAmount;
      
      form.setValue("subtotal", newSubtotal);
      form.setValue("tax", newTaxAmount);
      form.setValue("total", newTotal);
    }
  }, [repairItems, form, taxRate, isTaxEnabled]);

  // Create or update quote mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      console.log(`DEBUG: Mutation executing ${quoteId ? 'update' : 'create'} operation`);
      
      // With the schema updated to use z.coerce.date(), we can simplify this
      // Just pass the values as-is - the server-side zod schema will handle the conversion
      try {
        const endpoint = quoteId ? `/api/quotes/${quoteId}` : "/api/quotes";
        const method = quoteId ? "PUT" : "POST";
        
        console.log(`DEBUG: Making ${method} request to ${endpoint} with data:`, values);
        
        const response = await apiRequest(method, endpoint, values);
        
        console.log(`DEBUG: API Response status:`, response.status);
        if (!response.ok) {
          console.error(`DEBUG: API error: ${response.status}`);
          const errorText = await response.text();
          console.error(`DEBUG: Error response:`, errorText);
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log(`DEBUG: API response text:`, responseText);
        
        if (responseText) {
          try {
            return JSON.parse(responseText);
          } catch (e) {
            console.log(`DEBUG: Response is not JSON, returning text`);
            return responseText;
          }
        }
        
        return { success: true };
      } catch (error) {
        console.error(`DEBUG: Error in mutation:`, error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log(`DEBUG: Mutation succeeded with result:`, data);
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: quoteId ? "Quote updated" : "Quote created",
        description: quoteId
          ? "The quote has been updated successfully"
          : "The quote has been created successfully",
      });
      
      onClose();
    },
    onError: (error) => {
      console.error(`DEBUG: Mutation failed with error:`, error);
      
      toast({
        title: "Error",
        description: `Failed to ${quoteId ? "update" : "create"} quote: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("DEBUG: Form onSubmit triggered with values:", values);
    
    try {
      // Ensure dates are in ISO string format
      const formattedValues = {
        ...values,
        dateCreated: values.dateCreated ? new Date(values.dateCreated).toISOString() : new Date().toISOString(),
        expirationDate: values.expirationDate ? new Date(values.expirationDate).toISOString() : null,
      };
      
      console.log("DEBUG: Formatted values for submission:", formattedValues);
      mutation.mutate(formattedValues);
    } catch (error) {
      console.error("DEBUG: Error in onSubmit function:", error);
    }
  };

  const isLoading = isLoadingItems || isLoadingQuote || mutation.isPending;
  
  console.log("DEBUG: QuoteForm isLoading states:", { 
    isLoading, 
    isLoadingItems, 
    isLoadingQuote, 
    mutationIsPending: mutation.isPending,
    showForm: !(isLoading && !mutation.isPending)
  });

  console.log("DEBUG: QuoteForm about to render dialog, isOpen =", isOpen);
    
  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        console.log("DEBUG: Dialog onOpenChange called with open =", open);
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>{quoteId ? "Edit Quote" : "Create Quote"}</DialogTitle>
          <DialogDescription>
            {quoteId
              ? "Update the quote information below"
              : "Create a quote for customer approval"}
          </DialogDescription>
        </DialogHeader>

        {isLoadingItems || isLoadingQuote ? (
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
                  name="quoteNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quote Number</FormLabel>
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
                          value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                          disabled
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          onChange={(e) => {
                            // Just set the string value directly, the schema will handle conversion
                            field.onChange(e.target.value || null);
                          }}
                          value={field.value || ''}
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
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">
                            <div className="flex items-center">
                              <Badge variant="outline" className="mr-2 bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>
                              <span>Pending</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="approved">
                            <div className="flex items-center">
                              <Badge variant="outline" className="mr-2 bg-green-50 text-green-700 border-green-200">Approved</Badge>
                              <span>Approved</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="rejected">
                            <div className="flex items-center">
                              <Badge variant="outline" className="mr-2 bg-red-50 text-red-700 border-red-200">Rejected</Badge>
                              <span>Rejected</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="expired">
                            <div className="flex items-center">
                              <Badge variant="outline" className="mr-2 bg-gray-50 text-gray-700 border-gray-200">Expired</Badge>
                              <span>Expired</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                        disabled={!isTaxEnabled}
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
                          ? "Select the appropriate tax rate for this quote" 
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
                              value={field.value ? field.value.toFixed(2) : '0.00'}
                              disabled
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
                            value={field.value ? field.value.toFixed(2) : '0.00'}
                            disabled
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
                            value={field.value ? field.value.toFixed(2) : '0.00'}
                            disabled
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
                          placeholder="Any special notes, terms or conditions for this quote?"
                          className="min-h-[100px]"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    console.log("DEBUG: Cancel button clicked");
                    onClose();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  )}
                  {quoteId ? "Update Quote" : "Create Quote"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}