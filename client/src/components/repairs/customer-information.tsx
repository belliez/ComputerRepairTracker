import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import InformationSection from "./information-section";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CustomerInformationProps {
  customer: any;
  onCustomerUpdated?: () => void;
  readOnly?: boolean;
}

export default function CustomerInformation({ 
  customer, 
  onCustomerUpdated,
  readOnly = false
}: CustomerInformationProps) {
  const { toast } = useToast();
  
  // Form validation schema
  const formSchema = z.object({
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
    email: z.string().email({ message: "Invalid email address" }).or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    notes: z.string().optional(),
  });

  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: customer?.firstName || "",
      lastName: customer?.lastName || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
      city: customer?.city || "",
      state: customer?.state || "",
      postalCode: customer?.postalCode || "",
      notes: customer?.notes || "",
    }
  });

  // Update form when customer data changes
  useEffect(() => {
    if (customer) {
      form.reset({
        firstName: customer.firstName || "",
        lastName: customer.lastName || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        postalCode: customer.postalCode || "",
        notes: customer.notes || "",
      });
    }
  }, [customer, form]);

  // Customer update mutation
  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return apiRequest("PUT", `/api/customers/${customer.id}`, data);
    },
    onSuccess: () => {
      // Invalidate and refetch customer data
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customer.id}`] });
      
      // Invalidate repair queries that might display customer data
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      
      toast({
        title: "Customer updated",
        description: "Customer information has been updated successfully",
      });
      
      if (onCustomerUpdated) {
        onCustomerUpdated();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update customer: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    mutation.mutate(data);
  };

  const handleSave = () => {
    form.handleSubmit(onSubmit)();
  };

  if (!customer) {
    return <div>No customer information available</div>;
  }

  // Edit form content
  const editForm = (
    <Form {...form}>
      <form className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Input {...field} />
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
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
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input {...field} />
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
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
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );

  // Display view content
  const displayContent = (
    <div className="space-y-2">
      <div>
        <span className="font-medium">Name:</span> {customer.firstName} {customer.lastName}
      </div>
      {customer.email && (
        <div>
          <span className="font-medium">Email:</span> {customer.email}
        </div>
      )}
      {customer.phone && (
        <div>
          <span className="font-medium">Phone:</span> {customer.phone}
        </div>
      )}
      {customer.address && (
        <div>
          <span className="font-medium">Address:</span> {customer.address}
          {customer.city && `, ${customer.city}`}
          {customer.state && `, ${customer.state}`}
          {customer.postalCode && ` ${customer.postalCode}`}
        </div>
      )}
      {customer.notes && (
        <div>
          <span className="font-medium">Notes:</span> {customer.notes}
        </div>
      )}
    </div>
  );

  return (
    <InformationSection
      title="Customer Information"
      editForm={readOnly ? undefined : editForm}
      onSave={handleSave}
      canEdit={!readOnly}
    >
      {displayContent}
    </InformationSection>
  );
}