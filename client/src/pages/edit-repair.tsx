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
import { X, ArrowLeft, Save } from "lucide-react";

export default function EditRepairPage() {
  const [location, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  // Parse the repair ID from the URL
  const repairId = parseInt(location.split('/').pop() || '0');
  
  // Get existing repair data
  const { data: repair, isLoading: isLoadingRepair } = useQuery({
    queryKey: [`/api/repairs/${repairId}/details`],
    enabled: !!repairId,
  });

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
    ticketNumber: z.string().optional(),
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
      ticketNumber: undefined,
    },
  });

  // Initialize form with repair data
  useEffect(() => {
    if (repair) {
      console.log("Loading repair data:", repair);
      
      try {
        // Set customer ID
        if (typeof repair.customerId === 'number') {
          setSelectedCustomerId(repair.customerId);
        }
        
        // Reset form with repair data
        form.reset({
          customerId: typeof repair.customerId === 'number' ? repair.customerId : 0,
          deviceId: typeof repair.deviceId === 'number' ? repair.deviceId : 0,
          status: repair.status || "intake",
          technicianId: repair.technicianId,
          issue: repair.issue || "",
          notes: repair.notes || "",
          priorityLevel: typeof repair.priorityLevel === 'number' ? repair.priorityLevel : 3,
          isUnderWarranty: Boolean(repair.isUnderWarranty),
          estimatedCompletionDate: repair.estimatedCompletionDate 
            ? new Date(repair.estimatedCompletionDate).toISOString().split('T')[0]
            : "",
          ticketNumber: repair.ticketNumber,
        });
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error setting form values:", err);
        toast({
          title: "Error Loading Data",
          description: "There was an error loading the repair data.",
          variant: "destructive"
        });
      }
    }
  }, [repair, form]);

  // Update device ID in form when selected customer changes
  useEffect(() => {
    if (selectedCustomerId) {
      form.setValue("customerId", selectedCustomerId);
    }
  }, [selectedCustomerId, form]);

  // Mutation for updating repair
  const mutation = useMutation({
    mutationFn: (data: any) => {
      console.log("Updating repair #" + repairId + " with:", data);
      return apiRequest("PUT", `/api/repairs/${repairId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: "Repair Updated",
        description: "The repair has been updated successfully.",
      });
      
      // Navigate back to repairs page
      navigate("/repairs");
    },
    onError: (error) => {
      console.error("Mutation Error:", error);
      toast({
        title: "Error",
        description: "Failed to update repair. Please try again.",
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
      customerId: Number(selectedCustomerId),
      deviceId: values.deviceId ? Number(values.deviceId) : null,
      estimatedCompletionDate: values.estimatedCompletionDate && values.estimatedCompletionDate.trim() !== "" 
        ? values.estimatedCompletionDate
        : null
    };
    
    mutation.mutate(apiData);
  };

  if (isLoadingRepair || isLoading) {
    return (
      <div className="flex flex-col h-screen p-4">
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <Link to="/repairs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Loading...</h1>
          <div className="w-[72px]"></div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!repair) {
    return (
      <div className="flex flex-col h-screen p-4">
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <Link to="/repairs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Error</h1>
          <div className="w-[72px]"></div>
        </div>
        
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-red-500">Failed to load repair. The repair may have been deleted.</p>
          <Button onClick={() => navigate("/repairs")}>Return to Repairs</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <Link to="/repairs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Edit Repair</h1>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => form.handleSubmit(handleSubmit)()}
          disabled={mutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
      
      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h2 className="font-semibold mb-2">Customer Information</h2>
                {repair.customer && (
                  <div className="text-sm">
                    <p><span className="font-medium">Name:</span> {repair.customer.firstName} {repair.customer.lastName}</p>
                    <p><span className="font-medium">Email:</span> {repair.customer.email || "N/A"}</p>
                    <p><span className="font-medium">Phone:</span> {repair.customer.phone || "N/A"}</p>
                  </div>
                )}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <h2 className="font-semibold mb-2">Device Information</h2>
                {repair.device ? (
                  <div className="text-sm">
                    <p><span className="font-medium">Type:</span> {repair.device.type}</p>
                    <p><span className="font-medium">Make/Model:</span> {repair.device.brand} {repair.device.model}</p>
                    {repair.device.serialNumber && (
                      <p><span className="font-medium">Serial Number:</span> {repair.device.serialNumber}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">No device associated with this repair</p>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
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
                      value={field.value}
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
                        className="flex space-x-2"
                      >
                        {[1, 2, 3, 4, 5].map((level) => (
                          <FormItem key={level} className="flex items-center space-x-1">
                            <FormControl>
                              <RadioGroupItem value={level.toString()} id={`priority-${level}`} />
                            </FormControl>
                            <FormLabel htmlFor={`priority-${level}`} className="cursor-pointer">
                              {level}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      1 = Lowest, 5 = Highest
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
          </form>
        </Form>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t bg-gray-50">
        <Button 
          className="w-full"
          onClick={() => form.handleSubmit(handleSubmit)()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}