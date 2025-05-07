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

// Schema for invoice creation
const invoiceSchema = z.object({
  repairId: z.number(),
  invoiceNumber: z.string(),
  notes: z.string().optional(),
  dueDate: z.date().optional(),
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

export default function CreateRepairInvoice() {
  const [location, navigate] = useLocation();
  const [, params] = useRoute<{ repairId: string }>("/repairs/:repairId/invoices/create");
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  
  // Parse the repair ID from the URL
  const repairId = parseInt(params?.repairId || '0');
  
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
    queryKey: ['/api/settings/currencies/default'],
    onSuccess: (data) => {
      if (data && data.code) {
        setSelectedCurrencyCode(data.code);
        form.setValue('currencyCode', data.code);
      }
    }
  });
  
  // Get available tax rates
  const {
    data: taxRates = [],
    isLoading: isLoadingTaxRates
  } = useQuery({
    queryKey: ['/api/settings/tax-rates'],
  });
  
  // Get default tax rate
  const {
    data: defaultTaxRate,
    isLoading: isLoadingDefaultTaxRate
  } = useQuery({
    queryKey: ['/api/settings/tax-rates/default'],
    onSuccess: (data) => {
      if (data && data.id) {
        setSelectedTaxRateId(data.id);
        form.setValue('taxRateId', data.id);
      }
    }
  });
  
  // Generate an invoice number
  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().substring(2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const randomDigits = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    
    return `INV-${year}${month}${day}${randomDigits}`;
  };
  
  // Set up form with react-hook-form
  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      repairId: repairId,
      invoiceNumber: generateInvoiceNumber(),
      notes: "",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),  // Default: 30 days from now
      currencyCode: defaultCurrency?.code || 'USD',
      taxRateId: defaultTaxRate?.id,
      items: repairItems && repairItems.length > 0 ? 
        // Map repair items to invoice items
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
          const newTaxAmount = newSubtotal * (selectedTaxRate.rate / 100);
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
  
  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof invoiceSchema>) => {
      return apiRequest("POST", "/api/invoices", {
        ...data,
        // Add calculated totals
        subtotal,
        taxAmount,
        totalAmount: total,
      });
    },
    onSuccess: () => {
      // Invalidate query caches
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: "Invoice created",
        description: "The invoice has been created successfully",
      });
      
      // Navigate back to the repair details page with the invoices tab selected
      navigate(`/repairs/${repairId}?tab=invoice`);
    },
    onError: (error: any) => {
      console.error("Failed to create invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (values: z.infer<typeof invoiceSchema>) => {
    createInvoiceMutation.mutate(values);
  };
  
  // Add a new empty item to the invoice
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
        <h1 className="text-2xl font-bold">Create Invoice</h1>
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
              <CardTitle>Invoice Information</CardTitle>
              <CardDescription>Basic information about this invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Auto-generated" {...field} />
                      </FormControl>
                      <FormDescription>
                        A unique identifier for this invoice
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
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
                        The date by which payment is due
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            currencies.map((currency: any) => (
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
                        Select the currency for this invoice
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
                        value={field.value?.toString() || ''}
                        onValueChange={(value) => {
                          const numericValue = parseInt(value);
                          field.onChange(numericValue);
                          setSelectedTaxRateId(numericValue);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax rate" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Tax</SelectItem>
                          {isLoadingTaxRates ? (
                            <div className="flex justify-center p-2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                            </div>
                          ) : taxRates && taxRates.length > 0 ? (
                            taxRates.map((taxRate: any) => (
                              <SelectItem key={taxRate.id} value={taxRate.id.toString()}>
                                {taxRate.name} ({taxRate.rate}%)
                              </SelectItem>
                            ))
                          ) : null}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Apply a tax rate to this invoice
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any notes or payment instructions for this invoice"
                        className="resize-none min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional notes or payment instructions for this invoice
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
                  <CardDescription>Add the parts and services for this invoice</CardDescription>
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
            <Button type="submit" disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}