import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertInvoiceSchema, RepairItem, Quote } from "@shared/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface InvoiceFormProps {
  repairId?: number | null;
  invoiceId?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function InvoiceForm({ repairId, invoiceId, isOpen, onClose }: InvoiceFormProps) {
  const { toast } = useToast();

  // Get existing invoice if editing
  const { data: existingInvoice, isLoading: isLoadingInvoice } = useQuery({
    queryKey: [`/api/invoices/${invoiceId}`],
    enabled: !!invoiceId,
  });

  // Get repair items if creating a new invoice
  const { data: repairItems, isLoading: isLoadingItems } = useQuery<RepairItem[]>({
    queryKey: [`/api/repairs/${repairId}/items`],
    enabled: !!repairId && !invoiceId,
  });

  // Get quotes for this repair to use data from approved quote
  const { data: quotes, isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: [`/api/quotes`, { repairId }],
    enabled: !!repairId && !invoiceId,
  });

  // Get the latest approved quote if available
  const approvedQuote = quotes?.find(q => q.status === "approved");

  // Calculate values - either from items or from approved quote
  let subtotal = 0;
  let taxAmount = 0;
  let total = 0;

  if (approvedQuote) {
    subtotal = approvedQuote.subtotal;
    taxAmount = approvedQuote.tax || 0;
    total = approvedQuote.total;
  } else if (repairItems) {
    subtotal = repairItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const taxRate = 0.0825; // 8.25% tax - would come from settings in a real system
    taxAmount = subtotal * taxRate;
    total = subtotal + taxAmount;
  }

  // Form validation schema
  const formSchema = insertInvoiceSchema.extend({
    repairId: z.number(),
    invoiceNumber: z.string(),
    dateIssued: z.string(),
    subtotal: z.number(),
    tax: z.number().optional(),
    total: z.number(),
    status: z.string(),
    paymentMethod: z.string().optional(),
    notes: z.string().optional(),
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      repairId: repairId || 0,
      invoiceNumber: `INV-${Math.floor(5000 + Math.random() * 5000)}`, // Placeholder
      dateIssued: new Date().toISOString().split('T')[0],
      subtotal,
      tax: taxAmount,
      total,
      status: "unpaid",
      paymentMethod: undefined,
      notes: approvedQuote?.notes || "",
    },
  });

  // Update form with existing invoice data if editing
  useEffect(() => {
    if (existingInvoice) {
      const { id, datePaid, ...invoiceData } = existingInvoice;
      
      // Format dates for input fields
      const dateIssued = new Date(invoiceData.dateIssued).toISOString().split('T')[0];
      
      form.reset({
        ...invoiceData,
        dateIssued,
      });
    }
  }, [existingInvoice, form]);

  // Update form when data changes
  useEffect(() => {
    if (!existingInvoice) {
      if (approvedQuote) {
        form.setValue("subtotal", approvedQuote.subtotal);
        form.setValue("tax", approvedQuote.tax || 0);
        form.setValue("total", approvedQuote.total);
        form.setValue("notes", approvedQuote.notes || "");
      } else if (repairItems) {
        form.setValue("subtotal", subtotal);
        form.setValue("tax", taxAmount);
        form.setValue("total", total);
      }
    }
  }, [approvedQuote, repairItems, subtotal, taxAmount, total, existingInvoice, form]);

  // Create or update invoice mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Format data
      const invoiceData = {
        ...values,
        dateIssued: new Date(values.dateIssued).toISOString(),
      };
      
      if (invoiceId) {
        // Update existing invoice
        return apiRequest("PUT", `/api/invoices/${invoiceId}`, invoiceData);
      } else {
        // Create new invoice
        return apiRequest("POST", "/api/invoices", invoiceData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (repairId) {
        queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      }
      
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
    mutation.mutate(values);
  };

  const isLoading = isLoadingItems || isLoadingInvoice || isLoadingQuotes || mutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoiceId ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
          <DialogDescription>
            {invoiceId
              ? "Update the invoice information below"
              : "Create an invoice for this repair"}
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
                  name="dateIssued"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Issued</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
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
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="partial">Partial Payment</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
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
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Not Paid Yet</SelectItem>
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                          <SelectItem value="Debit Card">Debit Card</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Check">Check</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="PayPal">PayPal</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {repairItems && repairItems.length > 0 && (
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
                      {repairItems.map((item) => (
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
                            placeholder="Add any notes for the invoice..."
                            className="h-32"
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Include payment terms or any other relevant information
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
                            <span className="mr-1">$</span>
                            <Input
                              {...field}
                              value={field.value.toFixed(2)}
                              disabled={!!approvedQuote}
                              type="number"
                              step="0.01"
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                field.onChange(value);
                                // Update total when subtotal changes
                                const currentTax = form.getValues("tax") || 0;
                                form.setValue("total", value + currentTax);
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
                            <span className="mr-1">$</span>
                            <Input
                              {...field}
                              value={(field.value || 0).toFixed(2)}
                              type="number"
                              step="0.01"
                              disabled={!!approvedQuote}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                field.onChange(value);
                                // Update total when tax changes
                                const currentSubtotal = form.getValues("subtotal");
                                form.setValue("total", currentSubtotal + value);
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
                    name="total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="mr-1">$</span>
                            <Input
                              {...field}
                              value={field.value.toFixed(2)}
                              className="font-bold"
                              type="number"
                              step="0.01"
                              disabled={!!approvedQuote}
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
                  ) : invoiceId ? (
                    "Update Invoice"
                  ) : (
                    "Create Invoice"
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
