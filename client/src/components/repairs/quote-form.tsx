import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertQuoteSchema, RepairItem } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  
  const { data: defaultCurrency, isLoading: isLoadingDefaultCurrency } = useQuery<Currency>({
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
    if (defaultCurrency && !selectedCurrencyCode) {
      setSelectedCurrencyCode(defaultCurrency.code);
    }
    if (defaultTaxRate && !selectedTaxRateId) {
      setSelectedTaxRateId(defaultTaxRate.id);
    }
  }, [defaultCurrency, defaultTaxRate, selectedCurrencyCode, selectedTaxRateId]);
  
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
    : defaultCurrency;
  
  // Calculate values from repair items
  const subtotal = repairItems?.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) || 0;
  const taxRate = selectedTaxRate?.rate || 0;
  
  // Normalize tax rate: if greater than 1, assume it's a percentage and convert to decimal
  const normalizedTaxRate = taxRate > 1 ? taxRate / 100 : taxRate;
  
  const taxAmount = subtotal * normalizedTaxRate;
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
      currencyCode: selectedCurrencyCode || (defaultCurrency?.code || "USD"),
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
        currencyCode: existingQuote.currencyCode || (defaultCurrency?.code || "USD"),
        taxRateId: existingQuote.taxRateId || (defaultTaxRate?.id || 1),
      });
    }
  }, [existingQuote, form, defaultCurrency, defaultTaxRate]);

  // Automatically update totals when items change
  useEffect(() => {
    if (repairItems) {
      const newSubtotal = repairItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      
      // Normalize tax rate: if greater than 1, assume it's a percentage and convert to decimal
      const normalizedTaxRate = taxRate > 1 ? taxRate / 100 : taxRate;
      
      const newTaxAmount = newSubtotal * normalizedTaxRate;
      const newTotal = newSubtotal + newTaxAmount;
      
      form.setValue("subtotal", newSubtotal);
      form.setValue("tax", newTaxAmount);
      form.setValue("total", newTotal);
    }
  }, [repairItems, form, taxRate]);

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
                            field.onChange(e.target.value)
                          }}
                          value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Date after which this quote is no longer valid
                      </FormDescription>
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
                      <FormControl>
                        <div className="h-10 px-3 py-2 border border-input bg-gray-100 text-sm rounded-md">
                          <Badge className={
                            field.value === "approved" 
                              ? "bg-green-100 text-green-800 border-green-300" 
                              : field.value === "rejected"
                                ? "bg-red-100 text-red-800 border-red-300"
                                : "bg-yellow-100 text-yellow-800 border-yellow-300"
                          }>
                            {field.value ? field.value.charAt(0).toUpperCase() + field.value.slice(1) : 'Pending'}
                          </Badge>
                        </div>
                      </FormControl>
                      <FormDescription>
                        New quotes start as "pending" until approved by the customer
                      </FormDescription>
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
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedCurrencyCode(value);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingCurrencies ? (
                            <div className="flex justify-center p-2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                            </div>
                          ) : currencies && currencies.length > 0 ? (
                            currencies.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.symbol} {currency.name} ({currency.code})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the currency for this quote
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxRateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Rate</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => {
                          const numValue = parseInt(value);
                          field.onChange(numValue);
                          setSelectedTaxRateId(numValue);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax rate" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingTaxRates ? (
                            <div className="flex justify-center p-2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                            </div>
                          ) : taxRates && taxRates.length > 0 ? (
                            taxRates.map((taxRate) => (
                              <SelectItem key={taxRate.id} value={String(taxRate.id)}>
                                {taxRate.name} ({taxRate.rate > 1 ? taxRate.rate.toFixed(2) : (taxRate.rate * 100).toFixed(2)}%)
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="1">No Tax (0%)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the appropriate tax rate
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Use the new EditableLineItems component */}
              {repairItems && (
                <EditableLineItems 
                  items={repairItems.map(item => ({
                    id: item.id,
                    description: item.description,
                    itemType: item.itemType as "part" | "service",
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    total: item.unitPrice * item.quantity
                  }))}
                  onChange={(updatedItems) => {
                    // We'll use this to update the form subtotals
                    const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                    
                    // Normalize tax rate: if greater than 1, assume it's a percentage and convert to decimal
                    const normalizedTaxRate = taxRate > 1 ? taxRate / 100 : taxRate;
                    
                    const newTaxAmount = newSubtotal * normalizedTaxRate;
                    const newTotal = newSubtotal + newTaxAmount;
                    
                    form.setValue("subtotal", newSubtotal);
                    form.setValue("tax", newTaxAmount);
                    form.setValue("total", newTotal);
                  }}
                  readOnly={false}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any notes or terms for the customer..."
                            className="h-32"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
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
                            <span className="mr-1">{selectedCurrency?.symbol || '$'}</span>
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
                        <FormLabel>Tax ({taxRate > 1 ? taxRate.toFixed(2) : (taxRate * 100).toFixed(2)}%)</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="mr-1">{selectedCurrency?.symbol || '$'}</span>
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
                            <span className="mr-1">{selectedCurrency?.symbol || '$'}</span>
                            <Input
                              {...field}
                              value={field.value ? field.value.toFixed(2) : '0.00'}
                              className="font-bold"
                              disabled
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button 
                  type="button"
                  disabled={mutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    console.log("DEBUG: Manual form submission button clicked");
                    
                    // Log the form values
                    console.log("FORM VALUES BEFORE SUBMIT:", form.getValues());
                    
                    // Check form validation
                    if (!form.formState.isValid) {
                      console.log("FORM VALIDATION ERRORS:", form.formState.errors);
                    }
                    
                    // Use try-catch to catch any errors during submission
                    try {
                      form.handleSubmit(onSubmit)();
                    } catch (error) {
                      console.error("ERROR DURING FORM SUBMIT:", error);
                    }
                  }}
                >
                  {mutation.isPending ? (
                    <span className="flex items-center">
                      <i className="fas fa-spinner fa-spin mr-2"></i> Saving...
                    </span>
                  ) : quoteId ? (
                    "Update Quote"
                  ) : (
                    "Create Quote"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
