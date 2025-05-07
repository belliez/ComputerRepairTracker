import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertInventoryItemSchema } from "@shared/schema";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface PartsFormProps {
  itemId?: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PartsForm({ itemId, isOpen, onClose }: PartsFormProps) {
  const { toast } = useToast();

  // Get existing item if editing
  const { data: existingItem, isLoading } = useQuery({
    queryKey: [`/api/inventory/${itemId}`],
    enabled: !!itemId,
  });

  // Common categories for computer repair shop inventory
  const categories = [
    "CPU",
    "Memory",
    "Storage",
    "Display",
    "Battery",
    "Power Supply",
    "Keyboard",
    "Mouse",
    "Cable",
    "Adapter",
    "Fan",
    "Motherboard",
    "Graphics Card",
    "Network Card",
    "Case",
    "Cooling",
    "Software",
    "Accessory",
    "Other",
  ];

  // Form validation schema
  const formSchema = insertInventoryItemSchema.extend({
    price: z.number().min(0, "Price must be a positive number"),
    cost: z.number().min(0, "Cost must be a positive number").optional(),
    quantity: z.number().int().min(0, "Quantity must be a positive integer"),
    minLevel: z.number().int().min(0, "Minimum level must be a positive integer"),
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "Other",
      sku: "",
      price: 0,
      cost: 0,
      quantity: 0,
      location: "",
      supplier: "",
      minLevel: 1,
      isActive: true,
    },
  });

  // Update form with existing item data if editing
  useEffect(() => {
    if (existingItem) {
      form.reset(existingItem);
    }
  }, [existingItem, form]);

  // Create or update item mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (itemId) {
        // Update existing item
        return apiRequest("PUT", `/api/inventory/${itemId}`, values);
      } else {
        // Create new item
        return apiRequest("POST", "/api/inventory", values);
      }
    },
    onSuccess: () => {
      // Invalidate all inventory queries to ensure all components get fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      
      // Force refetch to ensure the latest data
      queryClient.refetchQueries({ queryKey: ["/api/inventory"] });
      
      toast({
        title: itemId ? "Item updated" : "Item created",
        description: itemId
          ? "The inventory item has been updated successfully"
          : "The inventory item has been created successfully",
      });
      
      // Small delay before closing to ensure data is refreshed
      setTimeout(() => {
        onClose();
      }, 100);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${itemId ? "update" : "create"} inventory item: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>{itemId ? "Edit Inventory Item" : "Add New Inventory Item"}</DialogTitle>
          <DialogDescription>
            {itemId
              ? "Update the inventory item information below"
              : "Enter details to add a new part or item to inventory"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="SSD 1TB" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Samsung 970 EVO NVMe SSD 1TB"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU / Part Number</FormLabel>
                      <FormControl>
                        <Input placeholder="SSD-1TB-NVME" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>
                        Unique identifier for this item
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <FormControl>
                        <Input placeholder="Tech Supplies Inc" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retail Price</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <span className="mr-1">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Price charged to customers
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                          <span className="mr-1">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Your cost to purchase
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Current inventory count
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storage Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Shelf A1" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>
                        Where this item is stored
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Stock Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Alert when inventory falls below this level
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Deactivate to hide this item from inventory listings
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

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
                  ) : itemId ? (
                    "Update Item"
                  ) : (
                    "Add Item"
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
