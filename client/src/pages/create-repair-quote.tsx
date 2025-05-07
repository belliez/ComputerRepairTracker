import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

export default function CreateRepairQuote() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [validityPeriod, setValidityPeriod] = useState(7);
  
  // Parse the repair ID from the URL
  const repairId = parseInt(location.split('/')[2]);
  
  // Get repair details for context
  const { data: repair } = useQuery({
    queryKey: [`/api/repairs/${repairId}/details`],
    enabled: !!repairId,
  });

  // Get repair items
  const { data: repairItems = [] } = useQuery({
    queryKey: [`/api/repairs/${repairId}/items`],
    enabled: !!repairId,
  });

  // Get tax rates
  const { data: taxRates = [] } = useQuery({
    queryKey: ["/api/settings/tax-rates"],
  });

  // Get default tax rate
  const { data: defaultTaxRate } = useQuery({
    queryKey: ["/api/settings/tax-rates/default"],
  });

  // Calculate subtotal of all items
  const subtotal = repairItems.reduce((acc: number, item: any) => {
    return acc + (item.quantity * item.unitPrice);
  }, 0);
  
  // Form validation schema
  const formSchema = z.object({
    repairId: z.number(),
    customerNotes: z.string().optional(),
    validUntil: z.date().optional(),
    taxRateId: z.number().nullable().optional(),
    includeLabor: z.boolean().default(true),
    laborCost: z.coerce.number().min(0).optional(),
    discount: z.coerce.number().min(0).optional(),
    discountType: z.enum(["amount", "percentage"]).default("amount")
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      repairId: repairId,
      customerNotes: "",
      validUntil: new Date(Date.now() + validityPeriod * 24 * 60 * 60 * 1000),
      taxRateId: defaultTaxRate?.id || null,
      includeLabor: true,
      laborCost: 0,
      discount: 0,
      discountType: "amount"
    },
  });

  // Update validity date when period changes
  useEffect(() => {
    const newValidUntil = new Date(Date.now() + validityPeriod * 24 * 60 * 60 * 1000);
    form.setValue("validUntil", newValidUntil);
  }, [validityPeriod, form]);

  // Calculate quote totals
  const calculateTotal = () => {
    let total = subtotal;
    
    // Add labor if included
    if (form.watch("includeLabor") && form.watch("laborCost")) {
      total += parseFloat(form.watch("laborCost").toString() || "0");
    }
    
    // Apply discount
    const discount = parseFloat(form.watch("discount")?.toString() || "0");
    if (discount > 0) {
      if (form.watch("discountType") === "amount") {
        total -= discount;
      } else {
        total -= (total * (discount / 100));
      }
    }
    
    // Keep total non-negative
    total = Math.max(0, total);
    
    // Add tax if selected
    const taxRateId = form.watch("taxRateId");
    if (taxRateId) {
      const selectedTaxRate = taxRates.find((rate: any) => rate.id === taxRateId);
      if (selectedTaxRate) {
        total += total * (selectedTaxRate.rate / 100);
      }
    }
    
    return total;
  };
  
  // Get selected tax rate percentage
  const getSelectedTaxRate = () => {
    const taxRateId = form.watch("taxRateId");
    if (!taxRateId) return 0;
    
    const selectedTaxRate = taxRates.find((rate: any) => rate.id === taxRateId);
    return selectedTaxRate ? selectedTaxRate.rate : 0;
  };

  // Mutation for creating a quote
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      // Calculate the final amount
      const quoteTotal = calculateTotal();
      
      // Generate a unique quote number
      const quoteNumber = `QT-${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
      
      // Calculate values
      const laborCostValue = data.includeLabor && data.laborCost 
        ? parseFloat(data.laborCost?.toString() || "0") 
        : 0;
      const calculatedSubtotal = subtotal + laborCostValue;
      const calculatedTax = data.taxRateId 
        ? (quoteTotal - (quoteTotal / (1 + (getSelectedTaxRate() / 100)))) 
        : 0;
      
      // Create the full quote data
      const quoteData = {
        repairId: Number(repairId),
        quoteNumber: quoteNumber,
        expirationDate: data.validUntil,
        subtotal: calculatedSubtotal,
        tax: calculatedTax,
        total: quoteTotal,
        status: "pending",
        notes: data.customerNotes || "",
        taxRateId: data.taxRateId ? Number(data.taxRateId) : null
      };
      
      return apiRequest("POST", `/api/quotes`, quoteData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: "Quote Created",
        description: "The quote has been created successfully",
      });
      
      // Navigate back to repair view page
      navigate(`/repairs/${repairId}`);
    },
    onError: (error) => {
      console.error("Error creating quote:", error);
      toast({
        title: "Error",
        description: "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Check if there are items to include in the quote
    if (repairItems.length === 0 && (!values.includeLabor || !values.laborCost)) {
      toast({
        title: "No Items",
        description: "Please add at least one item or include labor cost",
        variant: "destructive",
      });
      return;
    }
    
    mutation.mutate(values);
  };
  
  // Function to handle validity period selection
  const handleValidityPeriodChange = (days: number) => {
    setValidityPeriod(days);
    const newValidUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    form.setValue("validUntil", newValidUntil);
  };

  if (!repair) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <Link to={`/repairs/${repairId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Repair
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Create Quote</h1>
        <div className="w-[100px]"></div>
      </div>
      
      {/* Repair Info */}
      <div className="bg-muted/50 p-4 rounded-md mb-6">
        <h2 className="font-semibold mb-2">Repair #{repair.ticketNumber}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-medium">{repair.customer?.firstName} {repair.customer?.lastName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Device</p>
            <p className="font-medium">
              {repair.device?.type} - {repair.device?.brand} {repair.device?.model}
            </p>
          </div>
        </div>
      </div>
      
      {/* Items Table */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">Items</h2>
        
        {repairItems.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repairItems.map((item: any) => {
                const itemTotal = item.quantity * item.unitPrice;
                
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.description}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({item.itemType === 'part' ? 'Part' : 'Service'})
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(itemTotal)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(subtotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-4 border rounded-md">
            <p className="text-muted-foreground">No items added to this repair yet.</p>
            <Link to={`/repairs/${repairId}`}>
              <Button variant="outline" size="sm" className="mt-2">
                Go back to add items
              </Button>
            </Link>
          </div>
        )}
      </div>
      
      {/* Form */}
      <div className="max-w-2xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="flex gap-2 mt-1">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className={cn(validityPeriod === 7 && "border-primary text-primary")}
                        onClick={() => handleValidityPeriodChange(7)}
                      >
                        7 days
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className={cn(validityPeriod === 14 && "border-primary text-primary")}
                        onClick={() => handleValidityPeriodChange(14)}
                      >
                        14 days
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className={cn(validityPeriod === 30 && "border-primary text-primary")}
                        onClick={() => handleValidityPeriodChange(30)}
                      >
                        30 days
                      </Button>
                    </div>
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
                      onValueChange={(value) => field.onChange(value === "null" ? null : parseInt(value))}
                      value={field.value?.toString() || "null"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a tax rate" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">No Tax</SelectItem>
                        {taxRates.map((rate: any) => (
                          <SelectItem key={rate.id} value={rate.id.toString()}>
                            {rate.name} ({rate.rate}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="includeLabor"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Include Labor</FormLabel>
                        <FormDescription>
                          Add a labor charge to this quote
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                {form.watch("includeLabor") && (
                  <FormField
                    control={form.control}
                    name="laborCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Labor Cost</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step={form.watch("discountType") === "percentage" ? "1" : "0.01"}
                            min="0"
                            max={form.watch("discountType") === "percentage" ? "100" : undefined}
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="discountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="amount">Amount ($)</SelectItem>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="customerNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes for Customer</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional information to include on the quote"
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Quote Summary */}
            <div className="bg-muted/50 p-4 rounded-md border">
              <h3 className="font-semibold mb-3">Quote Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                
                {form.watch("includeLabor") && form.watch("laborCost") > 0 && (
                  <div className="flex justify-between">
                    <span>Labor:</span>
                    <span>{formatCurrency(parseFloat(form.watch("laborCost").toString()))}</span>
                  </div>
                )}
                
                {form.watch("discount") > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount{form.watch("discountType") === "percentage" && ` (${form.watch("discount")}%)`}:</span>
                    <span>-{form.watch("discountType") === "amount" 
                      ? formatCurrency(parseFloat(form.watch("discount").toString())) 
                      : formatCurrency((subtotal + (form.watch("includeLabor") ? parseFloat(form.watch("laborCost").toString() || "0") : 0)) * (parseFloat(form.watch("discount").toString()) / 100))
                    }</span>
                  </div>
                )}
                
                {form.watch("taxRateId") && (
                  <div className="flex justify-between">
                    <span>Tax ({getSelectedTaxRate()}%):</span>
                    <span>{formatCurrency(calculateTotal() - (calculateTotal() / (1 + (getSelectedTaxRate() / 100))))}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-bold pt-2 border-t mt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 flex justify-end gap-4">
              <Link to={`/repairs/${repairId}`}>
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button 
                type="submit"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Creating..." : "Create Quote"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}