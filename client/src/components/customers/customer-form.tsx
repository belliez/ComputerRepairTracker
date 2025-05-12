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
  const { data: existingCustomer, isLoading, refetch: refetchCustomer } = useQuery({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId,
    // Ensure fresh data is fetched each time
    staleTime: 0,
    // Custom query function to manually fetch customer details
    queryFn: async () => {
      console.log("CUSTOMER EDIT DEBUG: Starting manual fetch for customer details", customerId);
      
      // Get auth token
      const firebaseToken = localStorage.getItem('firebase_token');
      const orgId = localStorage.getItem('currentOrganizationId') || '2';
      
      // Setup headers
      const headers: Record<string, string> = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': orgId,
        // Add cache-busting parameter
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      };
      
      if (firebaseToken) {
        headers['Authorization'] = `Bearer ${firebaseToken}`;
      }
      
      console.log("CUSTOMER EDIT DEBUG: Making fetch with headers:", headers);
      
      try {
        // Add timestamp to URL to prevent caching
        const timestamp = new Date().getTime();
        const res = await fetch(`/api/customers/${customerId}?_=${timestamp}`, {
          credentials: "include",
          headers: headers
        });
        
        console.log("CUSTOMER EDIT DEBUG: Response status:", res.status);
        const text = await res.text();
        console.log("CUSTOMER EDIT DEBUG: Response text:", text);
        
        if (!res.ok) {
          throw new Error(`${res.status}: ${text || res.statusText}`);
        }
        
        // Parse JSON response
        try {
          const data = JSON.parse(text);
          console.log("CUSTOMER EDIT DEBUG: Parsed customer data:", data);
          return data;
        } catch (e) {
          console.error("CUSTOMER EDIT DEBUG: Error parsing JSON:", e);
          throw new Error("Failed to parse JSON response");
        }
      } catch (error) {
        console.error("CUSTOMER EDIT DEBUG: Error fetching customer:", error);
        throw error;
      }
    }
  });
  
  // Force a refresh when the form is opened
  useEffect(() => {
    if (isOpen && customerId) {
      console.log("CUSTOMER EDIT DEBUG: Form opened, forcing refresh of customer data");
      // Force invalidate the cache for this customer
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      // Refetch the data
      refetchCustomer();
    }
  }, [isOpen, customerId, refetchCustomer]);

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
      console.log("CUSTOMER FORM DEBUG: Resetting form with existing customer data:", existingCustomer);
      // Make sure all fields have at least empty strings instead of null
      const formattedCustomer = {
        ...existingCustomer,
        address: existingCustomer.address || '',
        city: existingCustomer.city || '',
        state: existingCustomer.state || '',
        postalCode: existingCustomer.postalCode || '',
        notes: existingCustomer.notes || '',
      };
      form.reset(formattedCustomer);
    }
  }, [existingCustomer, form]);

  // Create or update customer mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      console.log("CUSTOMER FORM DEBUG: Submitting values:", values);
      
      // Get auth token
      const firebaseToken = localStorage.getItem('firebase_token');
      const orgId = localStorage.getItem('currentOrganizationId') || '2';
      
      // Setup headers
      const headers: Record<string, string> = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': orgId,
        'Content-Type': 'application/json',
      };
      
      if (firebaseToken) {
        headers['Authorization'] = `Bearer ${firebaseToken}`;
      }
      
      console.log("CUSTOMER FORM DEBUG: Making mutation with headers:", headers);
      
      let response;
      if (customerId) {
        // Update existing customer
        console.log(`CUSTOMER FORM DEBUG: Updating customer ID ${customerId}`);
        response = await fetch(`/api/customers/${customerId}`, {
          method: 'PUT',
          headers: headers,
          credentials: "include",
          body: JSON.stringify(values)
        });
      } else {
        // Create new customer
        console.log("CUSTOMER FORM DEBUG: Creating new customer");
        response = await fetch('/api/customers', {
          method: 'POST',
          headers: headers,
          credentials: "include",
          body: JSON.stringify(values)
        });
      }
      
      console.log("CUSTOMER FORM DEBUG: Response status:", response.status);
      const text = await response.text();
      console.log("CUSTOMER FORM DEBUG: Response text:", text);
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${text || response.statusText}`);
      }
      
      // Parse the response JSON to get the actual data with the customer ID
      try {
        const data = JSON.parse(text);
        console.log("CUSTOMER FORM DEBUG: Parsed response data:", data);
        return data;
      } catch (e) {
        console.error("CUSTOMER FORM DEBUG: Error parsing JSON response:", e);
        throw new Error("Failed to parse JSON response");
      }
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
