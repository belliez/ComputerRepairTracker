import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getStandardHeaders, getCurrentOrgId } from "@/lib/organization-utils";
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
import { repairStatuses } from "@shared/schema";
import { ArrowLeft, Save } from "lucide-react";

// Import our reusable components
import CustomerInformation from "@/components/repairs/customer-information";
import DeviceInformation from "@/components/repairs/device-information";
import RepairInformation from "@/components/repairs/repair-information";

export default function EditRepairPage() {
  const [location, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  // Parse the repair ID from the URL
  const repairId = parseInt(location.split('/').pop() || '0');
  
  // Get existing repair data using manual fetch approach
  const { data: repair, isLoading: isLoadingRepair } = useQuery({
    queryKey: [`/api/repairs/${repairId}/details`],
    enabled: !!repairId,
    queryFn: async () => {
      console.log("EDIT REPAIR DEBUG: Fetching repair details for ID:", repairId);
      const headers: Record<string, string> = {
        "X-Debug-Client": "RepairTrackerClient",
        "X-Organization-ID": localStorage.getItem('currentOrganizationId') || "2",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };
      
      // Add auth token if available
      const token = localStorage.getItem("firebase_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      console.log("EDIT REPAIR DEBUG: Using headers:", headers);
      const response = await fetch(`/api/repairs/${repairId}/details`, { headers });
      console.log("EDIT REPAIR DEBUG: Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch repair details: ${response.status}`);
      }
      
      const text = await response.text();
      console.log("EDIT REPAIR DEBUG: Response preview:", text.substring(0, 100) + "...");
      
      try {
        const data = JSON.parse(text);
        console.log("EDIT REPAIR DEBUG: Parsed repair data:", data);
        return data;
      } catch (err) {
        console.error("EDIT REPAIR DEBUG: Failed to parse repair data:", err);
        throw new Error("Failed to parse repair data");
      }
    }
  });

  // Get data for form using manual fetch approach
  const { data: technicians } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      console.log("EDIT REPAIR DEBUG: Fetching technicians data");
      const headers: Record<string, string> = {
        "X-Debug-Client": "RepairTrackerClient",
        "X-Organization-ID": localStorage.getItem('currentOrganizationId') || "2",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };
      
      // Add auth token if available
      const token = localStorage.getItem("firebase_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch("/api/technicians", { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch technicians: ${response.status}`);
      }
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        console.log("EDIT REPAIR DEBUG: Parsed technicians data:", data);
        return data;
      } catch (err) {
        console.error("EDIT REPAIR DEBUG: Failed to parse technicians data:", err);
        throw new Error("Failed to parse technicians data");
      }
    }
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Information Section */}
            {repair.customer && (
              <CustomerInformation 
                customer={repair.customer} 
                onCustomerUpdated={() => {
                  // Refresh repair details to reflect updated customer info
                  queryClient.invalidateQueries({ 
                    queryKey: [`/api/repairs/${repairId}/details`],
                    refetchType: 'active'
                  });
                }}
              />
            )}

            {/* Device Information Section */}
            <DeviceInformation 
              device={repair.device} 
              customerId={repair.customerId}
              onDeviceUpdated={() => {
                // Refresh repair details to reflect updated device info
                queryClient.invalidateQueries({ 
                  queryKey: [`/api/repairs/${repairId}/details`],
                  refetchType: 'active'
                });
              }}
              onDeviceCreated={(deviceId) => {
                // Update the repair with the new device ID
                mutation.mutate({
                  ...form.getValues(),
                  deviceId: deviceId
                });
                
                // Refresh repair details to reflect the new device
                queryClient.invalidateQueries({ 
                  queryKey: [`/api/repairs/${repairId}/details`],
                  refetchType: 'active'
                });
                
                toast({
                  title: "Device added",
                  description: "The device has been added to this repair",
                });
              }}
            />
          </div>

          {/* Repair Information Section */}
          <RepairInformation 
            repair={repair}
            onRepairUpdated={() => {
              // Refresh repair details to reflect updated repair info
              queryClient.invalidateQueries({ 
                queryKey: [`/api/repairs/${repairId}/details`],
                refetchType: 'active'
              });
              
              // Also refresh the repair list
              queryClient.invalidateQueries({ 
                queryKey: ["/api/repairs"],
                refetchType: 'active'
              });
              
              toast({
                title: "Repair Updated",
                description: "The repair has been updated successfully",
              });
            }}
          />
          
          {/* Hidden form for submit actions */}
          <div className="hidden">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} id="editRepairForm">
                {/* Hidden but necessary for form submission */}
              </form>
            </Form>
          </div>
        </div>
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