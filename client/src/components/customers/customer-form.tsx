import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertCustomerSchema } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface CustomerFormProps {
  customerId?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated?: (customerId: number) => void;
}

export default function CustomerForm({ 
  customerId, 
  isOpen, 
  onClose, 
  onCustomerCreated 
}: CustomerFormProps) {
  const { toast } = useToast();
  
  // For mobile devices, create a different UI that's completely full screen
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if we're on mobile when component mounts and on window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Get existing customer if editing
  const { data: existingCustomer, isLoading } = useQuery({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId,
  });

  // Form validation schema
  const formSchema = insertCustomerSchema.extend({
    notes: z.string().optional(),
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      notes: "",
    },
  });

  // Update form with existing customer data if editing
  useEffect(() => {
    if (existingCustomer) {
      form.reset(existingCustomer);
    }
  }, [existingCustomer, form]);

  // Create or update customer mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      let response;
      if (customerId) {
        // Update existing customer
        response = await apiRequest("PUT", `/api/customers/${customerId}`, values);
      } else {
        // Create new customer
        response = await apiRequest("POST", "/api/customers", values);
      }
      // Parse the response JSON to get the actual data with the customer ID
      return await response.json();
    },
    onSuccess: (data) => {
      // Force immediate refresh of customer data to ensure UI is updated
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.refetchQueries({ queryKey: ["/api/customers"] });
      
      console.log("Customer form - received customer data:", data);
      
      toast({
        title: customerId ? "Customer updated" : "Customer created",
        description: customerId
          ? "The customer has been updated successfully"
          : "The customer has been created successfully",
      });

      // Call the callback with the new customer ID if provided
      if (!customerId && onCustomerCreated && data && data.id) {
        console.log("Customer form: New customer created with ID:", data.id);
        // Wait a moment to ensure state is updated properly
        setTimeout(() => {
          onCustomerCreated(data.id);
        }, 100);
      } else {
        onClose();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${customerId ? "update" : "create"} customer: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  // Render form content
  const renderFormContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      );
    }
    
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="john.doe@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="(555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Anytown" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="CA" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code</FormLabel>
                <FormControl>
                  <Input placeholder="12345" {...field} value={field.value || ''} />
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
                    placeholder="Additional customer information..."
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Any special information about this customer
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {!isMobile && (
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }} 
                className="py-2 px-4 h-10 touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={mutation.isPending}
                className="py-2 px-4 h-10 touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {mutation.isPending ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i> Saving...
                  </span>
                ) : customerId ? (
                  "Update Customer"
                ) : (
                  "Create Customer"
                )}
              </Button>
            </DialogFooter>
          )}
        </form>
      </Form>
    );
  };
  
  // Use mobile-specific UI for small screens
  if (isMobile && isOpen) {
    return (
      <div className="fixed inset-0 z-[1000] flex flex-col bg-background">
        <div className="w-full h-full flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-background z-10 px-4 py-3 border-b flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {customerId ? "Edit Customer" : "New Customer"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {customerId
                  ? "Update the customer information below"
                  : "Enter the customer's information to create a new record"}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="text-xl">×</span>
            </Button>
          </div>
          
          {/* Content */}
          <div className="flex-1 px-4 py-3 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {renderFormContent()}
          </div>
          
          {/* Footer */}
          <div className="sticky bottom-0 bg-background z-10 px-4 py-3 border-t flex flex-wrap justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="mr-auto py-2 px-4 h-10 touch-manipulation"
              size="sm"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              Cancel
            </Button>
            
            <Button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit(onSubmit)();
              }}
              disabled={mutation.isPending}
              size="sm"
              className="py-2 px-4 h-10 touch-manipulation font-medium"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {mutation.isPending ? (
                <span className="flex items-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i> Saving...
                </span>
              ) : customerId ? (
                "Update Customer"
              ) : (
                "Create Customer"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Desktop UI using Dialog
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-3 sm:p-6 overflow-y-auto overflow-x-hidden z-[60]">
        <DialogHeader>
          <DialogTitle>{customerId ? "Edit Customer" : "New Customer"}</DialogTitle>
          <DialogDescription>
            {customerId
              ? "Update the customer information below"
              : "Enter the customer's information to create a new record"}
          </DialogDescription>
        </DialogHeader>
        
        {renderFormContent()}
      </DialogContent>
    </Dialog>
  );
}
