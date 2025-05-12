import { useState, useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { safeGet } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Schema for quote creation
const quoteSchema = z.object({
  repairId: z.number(),
  quoteNumber: z.string(),
  notes: z.string().optional(),
  validUntil: z.date().optional(),
  currencyCode: z.string().min(1, "Please select a currency"),
  taxRateId: z.number().optional(),
  items: z.array(
    z.object({
      description: z.string().min(1, "Description is required"),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      unitPrice: z.number().min(0, "Price cannot be negative"),
    })
  ),
});

export default function CreateRepairQuote() {
  const [location, navigate] = useLocation();
  const [matchCreate, paramsCreate] = useRoute<{ repairId: string }>("/repairs/:repairId/quotes/create");
  const [matchEdit, paramsEdit] = useRoute<{ repairId: string, quoteId: string }>("/repairs/:repairId/quotes/:quoteId/edit");
  
  // Determine if we're editing or creating
  const isEditing = !!matchEdit;
  const params = isEditing ? paramsEdit : paramsCreate;
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  
  // Parse the repair ID and quote ID from the URL
  const repairId = parseInt(params?.repairId || '0');
  const quoteId = isEditing ? parseInt(params?.quoteId || '0') : undefined;
  
  // State to store total calculations
  const [subtotal, setSubtotal] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>('USD');
  const [selectedTaxRateId, setSelectedTaxRateId] = useState<number | undefined>(undefined);
  
  // Get existing repair data
  const { 
    data: repair = {},
    isLoading: isLoadingRepair 
  } = useQuery({
    queryKey: [`/api/repairs/${repairId}/details`],
    enabled: !!repairId,
  });
  
  // Get repair items
  const { 
    data: repairItems = [],
    isLoading: isLoadingItems 
  } = useQuery({
    queryKey: [`/api/repairs/${repairId}/items`],
    enabled: !!repairId,
  });
  
  // Get existing quote if in edit mode
  const {
    data: existingQuote,
    isLoading: isLoadingQuote
  } = useQuery({
    queryKey: [`/api/quotes/${quoteId}`],
    enabled: !!quoteId,
  });
  
  // Get available currencies
  const {
    data: currencies = [],
    isLoading: isLoadingCurrencies
  } = useQuery({
    queryKey: ['/api/settings/currencies'],
  });
  
  // Get default currency
  const {
    data: defaultCurrency,
    isLoading: isLoadingDefaultCurrency
  } = useQuery({
    queryKey: ['/api/settings/currencies/default']
  });
  
  // Get available tax rates
  const {
    data: taxRates = [],
    isLoading: isLoadingTaxRates
  } = useQuery({
    queryKey: ['/api/settings/tax-rates']
  });
  
  // Get default tax rate
  const {
    data: defaultTaxRate,
    isLoading: isLoadingDefaultTaxRate
  } = useQuery({
    queryKey: ['/api/settings/tax-rates/default']
  });
  
  // Generate a quote number
  const generateQuoteNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().substring(2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    // Use timestamp components instead of random numbers to ensure uniqueness
    return `QT-${year}${month}${day}-${hours}${minutes}${seconds}`;
  };
  
  // Set up form with react-hook-form
  const form = useForm<z.infer<typeof quoteSchema>>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      repairId: repairId,
      quoteNumber: generateQuoteNumber(),
      notes: "",
      validUntil: new Date(new Date().setDate(new Date().getDate() + 30)),  // Default: 30 days from now
      currencyCode: defaultCurrency?.code || 'USD',
      taxRateId: defaultTaxRate?.id,
      items: repairItems && repairItems.length > 0 ? 
        // Map repair items to quote items
        repairItems.map((item: any) => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })) : 
        // Default empty item if no repair items
        [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });
  
  // Hook into form values to support the field array for line items
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  // Watch for changes to calculate totals
  const formValues = form.watch();
  
  // Calculate totals when form values change
  useEffect(() => {
    if (formValues.items) {
      // Calculate subtotal
      const newSubtotal = formValues.items.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
        0
      );
      setSubtotal(newSubtotal);
      
      // Calculate tax if a tax rate is selected
      if (selectedTaxRateId && taxRates && taxRates.length > 0) {
        const selectedTaxRate = taxRates.find((rate: any) => rate.id === selectedTaxRateId);
        if (selectedTaxRate) {
          // Normalize tax rate: if greater than 1, assume it's a percentage and convert to decimal
          const normalizedRate = selectedTaxRate.rate > 1 
            ? selectedTaxRate.rate / 100 
            : selectedTaxRate.rate;
            
          const newTaxAmount = newSubtotal * normalizedRate;
          setTaxAmount(newTaxAmount);
          setTotal(newSubtotal + newTaxAmount);
        } else {
          setTaxAmount(0);
          setTotal(newSubtotal);
        }
      } else {
        setTaxAmount(0);
        setTotal(newSubtotal);
      }
    }
  }, [formValues, selectedTaxRateId, taxRates]);
  
  // Initialize with repair items if available
  useEffect(() => {
    if (repairItems && repairItems.length > 0 && form) {
      // Only initialize if the form is empty or only has one empty item
      const currentItems = form.getValues('items');
      
      if (!currentItems || currentItems.length === 0 || 
          (currentItems.length === 1 && 
           !currentItems[0].description && 
           currentItems[0].quantity === 1 && 
           currentItems[0].unitPrice === 0)) {
        
        form.setValue('items', repairItems.map((item: any) => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })));
      }
    }
  }, [repairItems, form, form.setValue]);
  
  // Set default currency and tax rate when they load
  useEffect(() => {
    if (defaultCurrency && defaultCurrency.code) {
      setSelectedCurrencyCode(defaultCurrency.code);
      form.setValue('currencyCode', defaultCurrency.code);
    }
    
    if (defaultTaxRate && defaultTaxRate.id) {
      setSelectedTaxRateId(defaultTaxRate.id);
      form.setValue('taxRateId', defaultTaxRate.id);
    }
  }, [defaultCurrency, defaultTaxRate, form.setValue, form]);
  
  // Load existing quote data when editing
  useEffect(() => {
    if (existingQuote && isEditing) {
      console.log("Loading existing quote:", existingQuote);
      
      // Set the initial values from the existing quote
      if (existingQuote.currencyCode) {
        setSelectedCurrencyCode(existingQuote.currencyCode);
      }
      
      if (existingQuote.taxRateId) {
        setSelectedTaxRateId(existingQuote.taxRateId);
      }
      
      // Try to get items data from itemsData field first (new format)
      let quoteItems = [];
      
      if (existingQuote.itemsData) {
        console.log("Found itemsData:", existingQuote.itemsData);
        try {
          quoteItems = JSON.parse(existingQuote.itemsData);
          console.log("Parsed items from itemsData:", quoteItems);
        } catch (error) {
          console.error("Failed to parse quote itemsData:", error);
        }
      } 
      // Fallback to old format with itemIds
      else if (existingQuote.itemIds) {
        console.log("Using legacy itemIds:", existingQuote.itemIds);
        let quoteItemIds: number[] = [];
        try {
          quoteItemIds = JSON.parse(existingQuote.itemIds);
          console.log("Parsed itemIds:", quoteItemIds);
          
          // Filter repair items to only include those associated with this quote
          if (quoteItemIds.length > 0) {
            quoteItems = repairItems?.filter((item: any) => 
              quoteItemIds.includes(item.id)
            ) || [];
            console.log("Found items by IDs:", quoteItems);
          }
        } catch (error) {
          console.error("Failed to parse quote itemIds:", error);
        }
      }
      
      // If no items were loaded from either method, fall back to all repair items
      if (quoteItems.length === 0) {
        quoteItems = repairItems || [];
      }
      
      // Ensure items have the expected structure regardless of source
      const formattedItems = quoteItems.map((item: any) => ({
        id: item.id, // Preserve ID if it exists
        description: item.description || '',
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
      }));
      
      // Prepare form values
      const formValues = {
        repairId: repairId,
        quoteNumber: existingQuote.quoteNumber || '',
        notes: existingQuote.notes || '',
        validUntil: existingQuote.expirationDate ? new Date(existingQuote.expirationDate) : undefined,
        currencyCode: existingQuote.currencyCode || 'USD',
        taxRateId: existingQuote.taxRateId,
        items: formattedItems
      };
      
      // Reset the form with the quote data
      form.reset(formValues);
      
      // Set calculated values
      setSubtotal(existingQuote.subtotal || 0);
      setTaxAmount(existingQuote.tax || 0);
      setTotal(existingQuote.total || 0);
    }
  }, [existingQuote, isEditing, repairId, repairItems, form]);
  
  // Create quote mutation
  const createQuoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quoteSchema>) => {
      // Store the actual items rather than just IDs
      console.log("MUTATION DEBUG: createQuoteMutation triggered");
      console.log("MUTATION DEBUG: Quote data received:", data);
      
      const itemsToStore = form.getValues("items") || [];
      
      // Log the size of the data being sent
      const itemsJson = JSON.stringify(itemsToStore);
      console.log(`MUTATION DEBUG: Items data size: ${itemsJson.length} characters, ${itemsToStore.length} items`);
      
      // Convert validUntil to the expected expirationDate format on the server
      const validUntil = data.validUntil ? new Date(data.validUntil).toISOString() : null;
      
      // Create the payload with all the required fields for the server
      const payload = {
        repairId: data.repairId,
        quoteNumber: data.quoteNumber,
        notes: data.notes || "",
        dateCreated: new Date().toISOString(), // Use current date for creation
        expirationDate: validUntil, // Use the converted validUntil date
        subtotal,
        tax: taxAmount, 
        total,
        status: "draft", // Default status
        currencyCode: data.currencyCode,
        taxRateId: data.taxRateId || (taxRates && taxRates.length > 0 ? taxRates[0].id : null),
        // Store the complete items data
        itemsData: itemsJson,
      };
      
      console.log("MUTATION DEBUG: Final payload being sent:", payload);
      
      try {
        const response = await apiRequest("POST", "/api/quotes", payload);
        console.log("MUTATION DEBUG: API response status:", response.status);
        const responseBody = await response.json();
        console.log("MUTATION DEBUG: API response body:", responseBody);
        return responseBody;
      } catch (error) {
        console.error("MUTATION DEBUG: API call failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("Quote created successfully, updating UI...");
      // Invalidate query caches
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: "Quote created",
        description: "The quote has been created successfully",
      });
      
      // Navigate back to the repair details page with the quotes tab selected
      navigate(`/repairs/${repairId}?tab=quotes`);
    },
    onError: (error: any) => {
      console.error("Failed to create quote:", error);
      // More detailed error information
      let errorMessage = "Failed to create quote. Please try again.";
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.response) {
        try {
          const responseData = error.response.data;
          if (responseData && responseData.message) {
            errorMessage = responseData.message;
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });
  
  // Update quote mutation
  const updateQuoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quoteSchema>) => {
      // Store the actual items rather than just IDs
      const itemsToStore = form.getValues("items") || [];
      
      return apiRequest("PUT", `/api/quotes/${quoteId}`, {
        ...data,
        // Add calculated totals
        subtotal,
        taxAmount,
        total, // Using "total" instead of "totalAmount" to match backend
        // Store the complete items data in JSON format
        itemsData: JSON.stringify(itemsToStore),
      });
    },
    onSuccess: () => {
      // Invalidate query caches
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
      
      toast({
        title: "Quote updated",
        description: "The quote has been updated successfully",
      });
      
      // Navigate back to the repair details page with the quotes tab selected
      navigate(`/repairs/${repairId}?tab=quotes`);
    },
    onError: (error: any) => {
      console.error("Failed to update quote:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update quote. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (values: z.infer<typeof quoteSchema>) => {
    if (isEditing && quoteId) {
      updateQuoteMutation.mutate(values);
    } else {
      createQuoteMutation.mutate(values);
    }
  };
  
  // Add a new empty item to the quote
  const handleAddItem = () => {
    append({ description: "", quantity: 1, unitPrice: 0 });
  };
  
  if (isLoadingRepair) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Loading...</h1>
          <div className="w-[100px]"></div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <Link to={`/repairs/${repairId}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Repair
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{isEditing ? "Edit Quote" : "Create Quote"}</h1>
        <div className="w-[100px]"></div>
      </div>
      
      {repair && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Repair Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <p><span className="font-medium">Ticket:</span> {repair.ticketNumber}</p>
                <p className="mt-1">
                  <span className="font-medium">Status:</span> {repair.status ? repair.status.charAt(0).toUpperCase() + repair.status.slice(1) : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <p>{repair.customer?.firstName} {repair.customer?.lastName}</p>
                <p className="mt-1">{repair.customer?.email}</p>
                <p className="mt-1">{repair.customer?.phone}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Device</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <p><span className="font-medium">{repair.device?.type}:</span> {repair.device?.brand} {repair.device?.model}</p>
                <p className="mt-1"><span className="font-medium">Serial:</span> {repair.device?.serialNumber}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Quote Information</CardTitle>
              <CardDescription>Basic information about this quote</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quoteNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quote Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Auto-generated" {...field} />
                      </FormControl>
                      <FormDescription>
                        A unique identifier for this quote
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Valid Until</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date() || date > new Date("2099-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        The date until which this quote is valid
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Hidden fields to maintain form data but not show in UI */}
              <input 
                type="hidden" 
                name="currencyCode" 
                value={selectedCurrencyCode}
                {...form.register("currencyCode")}
              />
              <input 
                type="hidden"
                name="taxRateId"
                value={selectedTaxRateId}
                {...form.register("taxRateId")}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any notes or terms for this quote"
                        className="resize-none min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional notes, terms and conditions for this quote
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Add the parts and services for this quote</CardDescription>
                </div>
                <Button 
                  type="button" 
                  onClick={handleAddItem} 
                  variant="outline"
                  className="h-8 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Item</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    // Calculate item total
                    const quantity = form.watch(`items.${index}.quantity`) || 0;
                    const unitPrice = form.watch(`items.${index}.unitPrice`) || 0;
                    const itemTotal = quantity * unitPrice;
                    
                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.description`}
                            render={({ field }) => (
                              <FormItem className="mb-0">
                                <FormControl>
                                  <Input placeholder="Item description" {...field} className="border-0 p-0 shadow-none focus-visible:ring-0" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem className="mb-0">
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="0.00"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    className="border-0 p-0 text-right shadow-none focus-visible:ring-0"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem className="mb-0">
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="1"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    className="border-0 p-0 text-right shadow-none focus-visible:ring-0"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(itemTotal)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex-col border-t px-6 pt-6">
              <div className="ml-auto flex w-full max-w-md flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </CardFooter>
          </Card>
          
          <div className="flex justify-end gap-4">
            <Link to={`/repairs/${repairId}`}>
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button 
              type="button" 
              disabled={isEditing ? updateQuoteMutation.isPending : createQuoteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                console.log("CREATE QUOTE BUTTON CLICKED");
                
                // Direct method: manually submit form data
                try {
                  // Get the current form values
                  const formValues = form.getValues();
                  console.log("Form values collected:", formValues);
                  
                  // Directly call the mutation with form values
                  if (isEditing && quoteId) {
                    console.log("Calling updateQuoteMutation directly");
                    updateQuoteMutation.mutate(formValues);
                  } else {
                    console.log("Calling createQuoteMutation directly");
                    createQuoteMutation.mutate(formValues);
                  }
                } catch (error) {
                  console.error("ERROR DURING MANUAL SUBMIT:", error);
                }
              }}
            >
              {isEditing 
                ? (updateQuoteMutation.isPending ? "Updating..." : "Update Quote") 
                : (createQuoteMutation.isPending ? "Creating..." : "Create Quote")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}