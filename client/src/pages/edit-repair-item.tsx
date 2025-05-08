import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function EditRepairItem() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  
  // Parse the repair ID and item ID from the URL
  const urlParts = location.split('/');
  const repairId = parseInt(urlParts[2]);
  const itemId = parseInt(urlParts[4]);
  
  // Form validation schema
  const formSchema = z.object({
    repairId: z.number(),
    itemType: z.enum(["part", "service"]),
    description: z.string().min(1, "Description is required"),
    inventoryItemId: z.number().optional().nullable(),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.coerce.number().min(0, "Price cannot be negative"),
    status: z.enum(["pending", "ordered", "in_stock", "installed", "cancelled"]).default("pending"),
    notes: z.string().optional(),
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      repairId: repairId,
      itemType: "part",
      description: "",
      inventoryItemId: null,
      quantity: 1,
      unitPrice: 0,
      status: "pending",
      notes: "",
    },
  });

  // Get repair details for context
  const { data: repair } = useQuery({
    queryKey: [`/api/repairs/${repairId}/details`],
    enabled: !!repairId,
  });

  // Get inventory items for lookup
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["/api/inventory"],
  });
  
  // Get the specific repair item to edit
  const { data: repairItem, isLoading } = useQuery({
    queryKey: [`/api/repairs/${repairId}/items/${itemId}`],
    enabled: !!repairId && !!itemId,
  });
  
  // Update form when data is loaded
  useEffect(() => {
    if (repairItem) {
      form.reset({
        repairId: repairId,
        itemType: repairItem.itemType,
        description: repairItem.description,
        inventoryItemId: repairItem.inventoryItemId,
        quantity: repairItem.quantity,
        unitPrice: repairItem.unitPrice,
        status: repairItem.status || "pending", // Convert status
        notes: repairItem.notes || "",
      });
    }
  }, [repairItem, form, repairId]);

  // Handle inventory item selection
  const handleInventoryItemSelect = (itemId: number) => {
    if (Array.isArray(inventoryItems)) {
      const selectedItem = inventoryItems.find((item: any) => item.id === parseInt(itemId.toString()));
      if (selectedItem) {
        form.setValue("description", selectedItem.name);
        form.setValue("unitPrice", selectedItem.price);
        form.setValue("status", selectedItem.quantity > 0 ? "in_stock" : "ordered");
      }
    }
  };

  // Mutation for updating a repair item
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      // Convert status to isCompleted for API compatibility
      const isCompleted = data.status === "installed";
      
      // API expects a different format
      const apiData = {
        description: data.description,
        itemType: data.itemType,
        inventoryItemId: data.inventoryItemId,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        isCompleted,
        notes: data.notes,
      };
      
      return apiRequest("PUT", `/api/repairs/${repairId}/items/${itemId}`, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/items`] });
      
      toast({
        title: "Item Updated",
        description: "The item has been updated successfully",
      });
      
      // Navigate back to repair view page with the parts tab active
      navigate(`/repairs/view/${repairId}?tab=parts`);
    },
    onError: (error) => {
      console.error("Error updating repair item:", error);
      toast({
        title: "Error",
        description: "Failed to update item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <Link to={`/repairs/view/${repairId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Repair
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Part or Service</h1>
        <div className="w-[100px]"></div>
      </div>
      
      {/* Form */}
      <div className="max-w-2xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="itemType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Item Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col sm:flex-row gap-4"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="part" />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          Part
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="service" />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          Service
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch("itemType") === "part" && (
              <FormField
                control={form.control}
                name="inventoryItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select from Inventory (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value === "null" ? null : parseInt(value));
                        if (value && value !== "null") handleInventoryItemSelect(parseInt(value));
                      }}
                      value={field.value?.toString() || "null"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an item from inventory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">None</SelectItem>
                        {Array.isArray(inventoryItems) && inventoryItems.map((item: any) => (
                          item && item.id && (
                            <SelectItem key={item.id} value={item.id.toString()}>
                              {item.name} ({formatCurrency(item.price)}) - {item.quantity > 0 ? `${item.quantity} in stock` : 'Out of stock'}
                            </SelectItem>
                          )
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecting an inventory item will automatically fill in details below
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={form.watch("itemType") === "part" 
                        ? "Part name and details" 
                        : "Service description"
                      }
                      className="resize-none min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price *</FormLabel>
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
            </div>
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="in_stock">In Stock</SelectItem>
                      <SelectItem value="installed">Installed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
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
                      placeholder="Additional notes about this item"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="pt-4 flex justify-end gap-4">
              <Link to={`/repairs/view/${repairId}`}>
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button 
                type="submit"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}