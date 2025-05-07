import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Customer, Device, Technician, repairStatuses } from "@shared/schema";
import { ArrowLeft, Save } from "lucide-react";
import { generateTicketNumber } from "@/lib/utils";

export default function CreateRepairPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // Get data for form
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  
  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices", selectedCustomerId ? { customerId: selectedCustomerId } : null],
    enabled: !!selectedCustomerId,
  });

  // Form validation schema
  const formSchema = z.object({
    customerId: z.number().positive("Customer is required"),
    deviceId: z.union([z.number().positive("Device is required"), z.literal(0)]),
    technicianId: z.number().nullable(),
    status: z.enum(repairStatuses as unknown as [string, ...string[]]).default("intake"),
    issue: z.string().min(1, "Issue description is required"),
    notes: z.string().optional().nullable(),
    priorityLevel: z.number().min(1).max(5).default(3),
    isUnderWarranty: z.boolean().default(false),
    estimatedCompletionDate: z.string().optional().nullable(),
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: 0,
      deviceId: 0,
      status: "intake" as const,
      issue: "",
      notes: "",
      priorityLevel: 3,
      isUnderWarranty: false,
      technicianId: null,
      estimatedCompletionDate: "",
    },
  });

  // Update device ID in form when selected customer changes
  useEffect(() => {
    if (selectedCustomerId) {
      form.setValue("customerId", selectedCustomerId);
    }
  }, [selectedCustomerId, form]);

  // Mutation for creating repair
  const mutation = useMutation({
    mutationFn: (data: any) => {
      console.log("Creating new repair with:", data);
      return apiRequest("POST", "/api/repairs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      
      toast({
        title: "Repair Created",
        description: "The new repair ticket has been created successfully.",
      });
      
      // Navigate back to repairs page
      navigate("/repairs");
    },
    onError: (error) => {
      console.error("Mutation Error:", error);
      toast({
        title: "Error",
        description: "Failed to create repair. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    // Create submission data
    const apiData = {
      status: values.status,
      priorityLevel: Number(values.priorityLevel || 3),
      technicianId: values.technicianId ? Number(values.technicianId) : null,
      issue: values.issue || "",
      notes: values.notes || "",
      isUnderWarranty: Boolean(values.isUnderWarranty),
      customerId: Number(values.customerId),
      deviceId: values.deviceId ? Number(values.deviceId) : null,
      estimatedCompletionDate: values.estimatedCompletionDate && values.estimatedCompletionDate.trim() !== "" 
        ? values.estimatedCompletionDate
        : null,
      ticketNumber: generateTicketNumber(),
    };
    
    mutation.mutate(apiData);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <Link to="/repairs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Repairs
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Create New Repair</h1>
        <Button 
          variant="default" 
          size="sm"
          onClick={() => form.handleSubmit(handleSubmit)()}
          disabled={mutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Customer Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Customer Information</h2>
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(parseInt(value));
                        setSelectedCustomerId(parseInt(value));
                      }}
                      defaultValue={field.value?.toString() || "0"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0" disabled>Select customer</SelectItem>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.firstName} {customer.lastName} - {customer.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Existing customer or add a <Link to="/customers" className="text-blue-600 hover:underline">new customer</Link>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString() || "0"}
                      disabled={!selectedCustomerId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedCustomerId ? "Select customer first" : "Select device"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">No device (walk-in diagnosis)</SelectItem>
                        {devices?.map((device) => (
                          <SelectItem key={device.id} value={device.id.toString()}>
                            {device.brand} {device.model} ({device.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select an existing device or add it after creating the repair
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Repair Details Section */}
            <div className="space-y-4 pt-4 border-t">
              <h2 className="text-lg font-semibold">Repair Details</h2>
              
              <FormField
                control={form.control}
                name="issue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the issue with the device"
                        className="min-h-[80px]" 
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
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {repairStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priorityLevel"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Priority Level</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-1">
                          <FormControl>
                            <RadioGroupItem value="1" id="priority-1" />
                          </FormControl>
                          <FormLabel htmlFor="priority-1" className="cursor-pointer">
                            Critical
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-1">
                          <FormControl>
                            <RadioGroupItem value="2" id="priority-2" />
                          </FormControl>
                          <FormLabel htmlFor="priority-2" className="cursor-pointer">
                            High
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-1">
                          <FormControl>
                            <RadioGroupItem value="3" id="priority-3" />
                          </FormControl>
                          <FormLabel htmlFor="priority-3" className="cursor-pointer">
                            Normal
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-1">
                          <FormControl>
                            <RadioGroupItem value="4" id="priority-4" />
                          </FormControl>
                          <FormLabel htmlFor="priority-4" className="cursor-pointer">
                            Low
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-1">
                          <FormControl>
                            <RadioGroupItem value="5" id="priority-5" />
                          </FormControl>
                          <FormLabel htmlFor="priority-5" className="cursor-pointer">
                            Lowest
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isUnderWarranty"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Device Under Warranty
                        </FormLabel>
                        <FormDescription>
                          Check if the device is still under manufacturer's warranty
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="technicianId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Technician</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "null" ? null : parseInt(value))}
                        defaultValue={field.value?.toString() || "null"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="null">Not Assigned</SelectItem>
                          {technicians?.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id.toString()}>
                              {tech.firstName} {tech.lastName}
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
                name="estimatedCompletionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Completion Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
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
                        placeholder="Any additional notes about the repair"
                        className="min-h-[80px]" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Footer */}
            <div className="pt-6 border-t">
              <div className="flex justify-end gap-4">
                <Link to="/repairs">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Creating..." : "Create Repair"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}