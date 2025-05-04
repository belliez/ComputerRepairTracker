import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InventoryItem, RepairItem } from "@/types";

// Form schema for repair items
const repairItemSchema = z.object({
  description: z.string().min(2, "Description must be at least 2 characters"),
  itemType: z.enum(["part", "service"], {
    required_error: "Item type is required",
  }),
  unitPrice: z.coerce.number().min(0, "Price must be a positive number"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  isCompleted: z.boolean().default(false),
  inventoryItemId: z.number().nullable().optional(),
});

type RepairItemFormValues = z.infer<typeof repairItemSchema>;

interface RepairItemFormProps {
  repairId: number;
  isOpen: boolean;
  onClose: () => void;
  existingItem?: {
    id: number;
    description: string;
    itemType: "part" | "service";
    unitPrice: number;
    quantity: number;
    isCompleted: boolean;
    inventoryItemId: number | null;
  };
}

export default function RepairItemForm({
  repairId,
  isOpen,
  onClose,
  existingItem,
}: RepairItemFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const isEditMode = !!existingItem;

  // Load inventory items for parts selection
  const { data: inventoryItems } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  // Set up the form
  const form = useForm<RepairItemFormValues>({
    resolver: zodResolver(repairItemSchema),
    defaultValues: {
      description: existingItem?.description || "",
      itemType: existingItem?.itemType || "part",
      unitPrice: existingItem?.unitPrice || 0,
      quantity: existingItem?.quantity || 1,
      isCompleted: existingItem?.isCompleted || false,
      inventoryItemId: existingItem?.inventoryItemId || null,
    },
  });

  // Update form when inventory item is selected
  const handleInventoryItemChange = (inventoryItemId: string) => {
    if (!inventoryItemId || inventoryItemId === "null") {
      form.setValue("inventoryItemId", null);
      return;
    }

    const selectedItem = inventoryItems?.find(
      (item) => item.id === parseInt(inventoryItemId)
    );

    if (selectedItem) {
      form.setValue("description", selectedItem.name);
      form.setValue("unitPrice", selectedItem.price);
      form.setValue("inventoryItemId", selectedItem.id);
    }
  };

  // Handle form submission
  const onSubmit = async (data: RepairItemFormValues) => {
    setIsLoading(true);
    try {
      if (isEditMode && existingItem) {
        // Update existing item
        await apiRequest("PUT", `/api/repairs/${repairId}/items/${existingItem.id}`, data);
        toast({
          title: "Item updated",
          description: "The repair item has been updated successfully",
        });
      } else {
        // Create new item
        await apiRequest("POST", `/api/repairs/${repairId}/items`, data);
        toast({
          title: "Item added",
          description: "The item has been added to the repair",
        });
      }

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      
      // Close the form
      onClose();
    } catch (error) {
      console.error("Failed to save repair item:", error);
      toast({
        title: "Error",
        description: "Failed to save the repair item",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Item" : "Add Item to Repair"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the details of this repair item"
              : "Add a part or service to this repair"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="part">Part</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("itemType") === "part" && inventoryItems && (
              <FormItem>
                <FormLabel>Select from Inventory (Optional)</FormLabel>
                <Select
                  onValueChange={handleInventoryItemChange}
                  defaultValue={existingItem?.inventoryItemId?.toString() || ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select from inventory" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="null">Custom Part</SelectItem>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.name} - ${item.price.toFixed(2)} ({item.quantity} in stock)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Select an item from inventory or create a custom part
                </FormDescription>
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
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
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isCompleted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Mark as Completed</FormLabel>
                    <FormDescription>
                      Check this if the part has been installed or the service has been completed
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : isEditMode ? "Update Item" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}