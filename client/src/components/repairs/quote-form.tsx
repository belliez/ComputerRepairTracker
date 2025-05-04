import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertQuoteSchema, RepairItem } from "@shared/schema";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface QuoteFormProps {
  repairId: number;
  quoteId?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuoteForm({ repairId, quoteId, isOpen, onClose }: QuoteFormProps) {
  const { toast } = useToast();

  // Get repair items to calculate the quote
  const { data: repairItems, isLoading: isLoadingItems } = useQuery<RepairItem[]>({
    queryKey: [`/api/repairs/${repairId}/items`],
  });

  // Get existing quote if editing
  const { data: existingQuote, isLoading: isLoadingQuote } = useQuery({
    queryKey: [`/api/quotes/${quoteId}`],
    enabled: !!quoteId,
  });

  // Calculate values from repair items
  const subtotal = repairItems?.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) || 0;
  const taxRate = 0.0825; // 8.25% tax - would come from settings in a real system
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Form validation schema
  const formSchema = insertQuoteSchema.extend({
    expirationDate: z.union([
      z.string(),
      z.null()
    ]).nullish(),
    dateCreated: z.string()
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
    },
  });

  // Update form with existing quote data if editing
  useEffect(() => {
    if (existingQuote) {
      // Extract data safely
      const quoteData = existingQuote as any;
      
      // Format dates for input fields
      const dateCreated = new Date(quoteData.dateCreated).toISOString().split('T')[0];
      const expirationDate = quoteData.expirationDate 
        ? new Date(quoteData.expirationDate).toISOString().split('T')[0]
        : null;
      
      form.reset({
        repairId: quoteData.repairId,
        quoteNumber: quoteData.quoteNumber,
        dateCreated,
        expirationDate,
        subtotal: quoteData.subtotal,
        tax: quoteData.tax,
        total: quoteData.total,
        status: quoteData.status,
        notes: quoteData.notes || "",
      });
    }
  }, [existingQuote, form]);

  // Automatically update totals when items change
  useEffect(() => {
    if (repairItems) {
      const newSubtotal = repairItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const newTaxAmount = newSubtotal * taxRate;
      const newTotal = newSubtotal + newTaxAmount;
      
      form.setValue("subtotal", newSubtotal);
      form.setValue("tax", newTaxAmount);
      form.setValue("total", newTotal);
    }
  }, [repairItems, form, taxRate]);

  // Create or update quote mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Format data for server-side expectations
      const quoteData = {
        ...values,
        // Convert string dates to proper Date objects for the server
        dateCreated: new Date(values.dateCreated).toISOString(),
        expirationDate: values.expirationDate ? new Date(values.expirationDate).toISOString() : null,
      };
      
      if (quoteId) {
        // Update existing quote
        return apiRequest("PUT", `/api/quotes/${quoteId}`, quoteData);
      } else {
        // Create new quote
        return apiRequest("POST", "/api/quotes", quoteData);
      }
    },
    onSuccess: () => {
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
      toast({
        title: "Error",
        description: `Failed to ${quoteId ? "update" : "create"} quote: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  const isLoading = isLoadingItems || isLoadingQuote || mutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quoteId ? "Edit Quote" : "Create Quote"}</DialogTitle>
          <DialogDescription>
            {quoteId
              ? "Update the quote information below"
              : "Create a quote for customer approval"}
          </DialogDescription>
        </DialogHeader>

        {isLoading && !mutation.isPending ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
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
                          value={typeof field.value === 'string' ? field.value : ''}
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
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairItems?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-4">
                          No items added to this repair yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      repairItems?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              item.itemType === "part" 
                                ? "bg-blue-100 text-blue-800 border-blue-300" 
                                : "bg-purple-100 text-purple-800 border-purple-300"
                            }>
                              {item.itemType === "part" ? "Part" : "Service"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${(item.unitPrice * item.quantity).toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

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
                            <span className="mr-1">$</span>
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
                        <FormLabel>Tax ({(taxRate * 100).toFixed(2)}%)</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="mr-1">$</span>
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
                            <span className="mr-1">$</span>
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
                  type="submit"
                  disabled={mutation.isPending}
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
