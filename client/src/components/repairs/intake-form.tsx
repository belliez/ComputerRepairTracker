import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Customer, Device, Technician, insertRepairSchema, repairStatuses } from "@shared/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import CustomerForm from "@/components/customers/customer-form";
import DeviceForm from "@/components/devices/device-form";

// Form steps
type FormStep = "customer" | "device" | "service";

interface IntakeFormProps {
  repairId?: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function IntakeForm({ repairId, isOpen, onClose }: IntakeFormProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>("customer");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [showNewDeviceForm, setShowNewDeviceForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Get existing repair if we're editing
  const { data: repair, isLoading: isLoadingRepair } = useQuery({
    queryKey: ["/api/repairs", repairId],
    enabled: !!repairId,
  });

  // Get data for form
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices", selectedCustomerId ? { customerId: selectedCustomerId } : null],
    enabled: !!selectedCustomerId,
  });

  // Form validation schema - closely aligns with the server schema
  const formSchema = z.object({
    customerId: z.number().positive("Customer is required"),
    deviceId: z.number().positive("Device is required"),
    technicianId: z.number().nullable(),
    status: z.enum(repairStatuses as unknown as [string, ...string[]]).default("intake"),
    issue: z.string().min(1, "Issue description is required"),
    notes: z.string().optional().nullable(),
    priorityLevel: z.number().min(1).max(5).default(3),
    isUnderWarranty: z.boolean().default(false),
    estimatedCompletionDate: z.string().optional().nullable(),
    ticketNumber: z.string().optional(), // Will be generated for new repairs
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: 0,
      deviceId: 0,
      status: "intake",
      issue: "",
      notes: "",
      priorityLevel: 3,
      isUnderWarranty: false,
      technicianId: undefined,
      estimatedCompletionDate: "", // Added back with empty string default
    },
  });

  // Update form with repair data if editing
  useEffect(() => {
    if (repair) {
      setSelectedCustomerId(repair.customerId);
      setSelectedDeviceId(repair.deviceId);
      
      form.reset({
        customerId: repair.customerId,
        deviceId: repair.deviceId,
        status: repair.status,
        technicianId: repair.technicianId,
        issue: repair.issue,
        notes: repair.notes || "",
        priorityLevel: repair.priorityLevel,
        isUnderWarranty: repair.isUnderWarranty,
        estimatedCompletionDate: repair.estimatedCompletionDate 
          ? new Date(repair.estimatedCompletionDate).toISOString().split('T')[0]
          : undefined,
      });

      // Move to device step if customer is already set
      if (repair.customerId) {
        setCurrentStep("device");
      }
    }
  }, [repair, form]);

  // Update device ID in form when selected
  useEffect(() => {
    if (selectedDeviceId) {
      form.setValue("deviceId", selectedDeviceId);
    }
  }, [selectedDeviceId, form]);

  // Update customer ID in form when selected
  useEffect(() => {
    if (selectedCustomerId) {
      form.setValue("customerId", selectedCustomerId);
    }
  }, [selectedCustomerId, form]);

  // Create or update repair mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (repairId) {
        // Update existing repair
        return apiRequest("PUT", `/api/repairs/${repairId}`, values);
      } else {
        // Create new repair
        return apiRequest("POST", "/api/repairs", values);
      }
    },
    onSuccess: () => {
      // Invalidate all queries that start with '/api/repairs'
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      
      // Also invalidate any filtered repair queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey.length > 0 && 
                 queryKey[0] === "/api/repairs";
        }
      });
      
      toast({
        title: repairId ? "Repair updated" : "Repair created",
        description: repairId 
          ? "The repair has been updated successfully" 
          : "The repair has been created successfully",
      });
      onClose();
    },
    onError: (error) => {
      console.error("Mutation Error:", error);
      toast({
        title: "Error",
        description: `Failed to ${repairId ? "update" : "create"} repair. Check the browser console for details.`,
        variant: "destructive",
      });
    },
  });

  const filteredCustomers = customers?.filter(customer => {
    if (!searchTerm) return true;
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    return (
      fullName.includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleNewCustomer = () => {
    setShowNewCustomerForm(true);
  };

  const handleCustomerCreated = (customerId: number) => {
    setShowNewCustomerForm(false);
    setSelectedCustomerId(customerId);
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    setCurrentStep("device");
  };

  const handleCustomerSelected = (customerId: number) => {
    setSelectedCustomerId(customerId);
    setCurrentStep("device");
  };

  const handleDeviceSelected = (deviceId: number) => {
    setSelectedDeviceId(deviceId);
    setCurrentStep("service");
  };

  const handleNewDevice = () => {
    setShowNewDeviceForm(true);
  };

  const handleDeviceCreated = (deviceId: number) => {
    setShowNewDeviceForm(false);
    setSelectedDeviceId(deviceId);
    queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    setCurrentStep("service");
  };

  const handlePrevStep = () => {
    if (currentStep === "device") {
      setCurrentStep("customer");
    } else if (currentStep === "service") {
      setCurrentStep("device");
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("Form submission values:", values);
    
    try {
      // Generate a ticket number for new repairs
      const currentDate = new Date();
      const year = currentDate.getFullYear().toString().slice(-2);
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const ticketNumber = `RT-${year}${month}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      // Create submission data with required customer and device
      const apiData = {
        ...values,
        customerId: Number(selectedCustomerId),
        deviceId: Number(selectedDeviceId),
        issue: values.issue || "",
        status: values.status || "intake",
        priorityLevel: Number(values.priorityLevel || 3),
        technicianId: values.technicianId ? Number(values.technicianId) : null,
        notes: values.notes || "",
        isUnderWarranty: Boolean(values.isUnderWarranty),
        // Format the date properly if it exists
        estimatedCompletionDate: values.estimatedCompletionDate && values.estimatedCompletionDate.trim() !== "" 
          ? new Date(values.estimatedCompletionDate).toISOString()
          : null
      };
      
      // For new repairs, add ticket number
      if (!repairId) {
        apiData.ticketNumber = ticketNumber;
      }
      
      // Validate required fields manually
      if (!apiData.customerId || !apiData.deviceId || !apiData.issue.trim()) {
        console.error("Missing required fields", { 
          customerId: apiData.customerId, 
          deviceId: apiData.deviceId, 
          issue: apiData.issue 
        });
        
        toast({
          title: "Missing information",
          description: "Please make sure all required fields are filled out.",
          variant: "destructive"
        });
        return;
      }
      
      console.log("Submitting repair data:", apiData);
      mutation.mutate(apiData, {
        onError: (error: any) => {
          console.error("Error creating repair:", error);
          toast({
            title: "Failed to create repair",
            description: error?.message || "An unknown error occurred",
            variant: "destructive"
          });
        }
      });
    } catch (error) {
      console.error("Error in form submission:", error);
      toast({
        title: "Error",
        description: "An error occurred while submitting the form. Please try again.",
        variant: "destructive"
      });
    }
  };

  const renderStepIndicator = () => {
    return (
      <div className="mb-8">
        <div className="flex items-center">
          <div className="flex-1">
            <div className="flex items-center justify-start">
              <div className={`rounded-full h-8 w-8 flex items-center justify-center ${
                currentStep === "customer" ? "bg-blue-500" : "bg-blue-500"
              }`}>
                <i className="fas fa-user text-white"></i>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${
                  currentStep === "customer" ? "text-gray-900" : "text-gray-900"
                }`}>Customer Info</p>
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-200 h-1 flex-1">
            <div className={`bg-blue-500 h-1 ${
              currentStep === "customer" ? "w-0" : "w-full"
            }`}></div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-center">
              <div className={`rounded-full h-8 w-8 flex items-center justify-center ${
                currentStep === "device" ? "bg-blue-500" : 
                currentStep === "service" ? "bg-blue-500" : "bg-gray-200"
              }`}>
                <i className={`fas fa-laptop ${
                  currentStep === "device" || currentStep === "service" ? "text-white" : "text-gray-500"
                }`}></i>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${
                  currentStep === "device" ? "text-gray-900" : 
                  currentStep === "service" ? "text-gray-900" : "text-gray-500"
                }`}>Device Info</p>
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-200 h-1 flex-1">
            <div className={`bg-blue-500 h-1 ${
              currentStep === "service" ? "w-full" : "w-0"
            }`}></div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-end">
              <div className={`rounded-full h-8 w-8 flex items-center justify-center ${
                currentStep === "service" ? "bg-blue-500" : "bg-gray-200"
              }`}>
                <i className={`fas fa-wrench ${
                  currentStep === "service" ? "text-white" : "text-gray-500"
                }`}></i>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${
                  currentStep === "service" ? "text-gray-900" : "text-gray-500"
                }`}>Service Details</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerStep = () => {
    return (
      <>
        <div>
          <h3 className="text-lg font-medium text-gray-900">Customer Information</h3>
          <p className="mt-1 text-sm text-gray-500">Find an existing customer or create a new one.</p>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <Input
              type="text"
              placeholder="Search by name, email, or phone"
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">or</span>
            <Button onClick={handleNewCustomer}>
              <i className="fas fa-plus mr-2"></i> New Customer
            </Button>
          </div>
          
          <div className="max-h-60 overflow-y-auto border rounded-md">
            {filteredCustomers?.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No customers found. Try a different search term or create a new customer.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredCustomers?.map(customer => (
                  <li 
                    key={customer.id} 
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedCustomerId === customer.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleCustomerSelected(customer.id)}
                  >
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium">{`${customer.firstName} ${customer.lastName}`}</div>
                        <div className="text-sm text-gray-500">{customer.email}</div>
                      </div>
                      <div className="text-sm text-gray-500">{customer.phone}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderDeviceStep = () => {
    return (
      <>
        <div>
          <h3 className="text-lg font-medium text-gray-900">Device Information</h3>
          <p className="mt-1 text-sm text-gray-500">Select an existing device or add a new one.</p>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {devices?.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500">No devices found for this customer.</p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <ul className="divide-y divide-gray-200">
                {devices?.map(device => (
                  <li 
                    key={device.id} 
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedDeviceId === device.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleDeviceSelected(device.id)}
                  >
                    <div className="font-medium">{device.brand} {device.model}</div>
                    <div className="text-sm text-gray-500">{device.type}</div>
                    {device.serialNumber && (
                      <div className="text-xs text-gray-500">S/N: {device.serialNumber}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex justify-center">
            <Button onClick={handleNewDevice} variant="outline">
              <i className="fas fa-plus mr-2"></i> Add New Device
            </Button>
          </div>
        </div>
      </>
    );
  };

  const renderServiceStep = () => {
    return (
      <Form {...form}>
        <form id="repair-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Service Details</h3>
            <p className="mt-1 text-sm text-gray-500">Provide information about the repair service needed.</p>
          </div>
          
          <FormField
            control={form.control}
            name="issue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe the problem in detail..." 
                    {...field} 
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign Technician</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "0" ? null : parseInt(value))}
                    value={field.value?.toString() || "0"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a technician" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Unassigned</SelectItem>
                      {technicians?.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id.toString()}>
                          {tech.firstName} {tech.lastName} - {tech.role}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value)}
                    defaultValue="intake"
                    value={field.value || "intake"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {repairStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
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
            name="priorityLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority Level</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value ? field.value.toString() : "2"}
                    className="flex space-x-2"
                  >
                    <FormItem className="flex items-center space-x-1">
                      <FormControl>
                        <RadioGroupItem value="1" />
                      </FormControl>
                      <FormLabel className="text-red-500 font-medium">Critical</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-1">
                      <FormControl>
                        <RadioGroupItem value="2" />
                      </FormControl>
                      <FormLabel className="text-orange-500 font-medium">High</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-1">
                      <FormControl>
                        <RadioGroupItem value="3" />
                      </FormControl>
                      <FormLabel className="text-gray-500 font-medium">Normal</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-1">
                      <FormControl>
                        <RadioGroupItem value="4" />
                      </FormControl>
                      <FormLabel className="text-blue-500 font-medium">Low</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-1">
                      <FormControl>
                        <RadioGroupItem value="5" />
                      </FormControl>
                      <FormLabel className="text-green-500 font-medium">Lowest</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="estimatedCompletionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Completion Date</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    When do you expect the repair to be completed?
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
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Under Warranty</FormLabel>
                    <FormDescription>
                      Check if this repair is covered by warranty
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Add any additional information or special instructions..." 
                    {...field} 
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{repairId ? "Edit Repair" : "New Repair Intake"}</DialogTitle>
            <DialogDescription>
              {repairId 
                ? "Edit the repair information below" 
                : "Enter the information below to create a new repair ticket"
              }
            </DialogDescription>
          </DialogHeader>
          
          {renderStepIndicator()}
          
          <div className="py-4 space-y-6">
            {currentStep === "customer" && renderCustomerStep()}
            {currentStep === "device" && renderDeviceStep()}
            {currentStep === "service" && renderServiceStep()}
          </div>
          
          <DialogFooter>
            {currentStep !== "customer" && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handlePrevStep}
                className="mr-auto"
              >
                Back
              </Button>
            )}
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
            >
              Cancel
            </Button>
            
            {currentStep === "service" ? (
              <Button 
                type="button"
                onClick={() => {
                  // Get form values directly
                  const formValues = form.getValues();
                  console.log("Form values:", formValues);
                  
                  // Generate a ticket number if this is a new repair
                  const currentDate = new Date();
                  const year = currentDate.getFullYear().toString().slice(-2);
                  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                  const ticketNumber = `RT-${year}${month}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
                  
                  // Validate device selection
                  if (!selectedDeviceId) {
                    toast({
                      title: "Device Required",
                      description: "Please select a device for this repair",
                      variant: "destructive"
                    });
                    // Go back to device selection step
                    setCurrentStep("device");
                    return;
                  }
                  
                  // Validate that issue is not empty
                  if (!formValues.issue || formValues.issue.trim() === "") {
                    toast({
                      title: "Issue Description Required",
                      description: "Please provide a description of the issue",
                      variant: "destructive"
                    });
                    return;
                  }

                  // Create submission data with required customer and device
                  const apiData = {
                    ...formValues,
                    customerId: Number(selectedCustomerId),
                    deviceId: Number(selectedDeviceId),
                    issue: formValues.issue || "",
                    // Ensure status is always "intake" for new repairs or whatever is selected for existing ones
                    status: repairId ? (formValues.status || "intake") : "intake",
                    priorityLevel: Number(formValues.priorityLevel || 3),
                    technicianId: formValues.technicianId ? Number(formValues.technicianId) : null,
                    notes: formValues.notes || "",
                    isUnderWarranty: Boolean(formValues.isUnderWarranty),
                    // Process the estimated completion date
                    estimatedCompletionDate: formValues.estimatedCompletionDate && formValues.estimatedCompletionDate.trim() !== "" 
                      ? new Date(formValues.estimatedCompletionDate).toISOString()
                      : null,
                    // For new repairs, always provide a ticket number
                    // For existing repairs, don't include ticketNumber to avoid schema validation errors
                    ...(repairId ? {} : { ticketNumber })
                  };
                  
                  console.log("Submitting repair data:", apiData);
                  mutation.mutate(apiData, {
                    onError: (error: any) => {
                      console.error("Error creating repair:", error);
                      // Display a more detailed error message
                      toast({
                        title: "Failed to create repair",
                        description: error?.message || "An unknown error occurred",
                        variant: "destructive"
                      });
                    }
                  });
                }}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i> Saving...
                  </span>
                ) : repairId ? (
                  "Update Repair"
                ) : (
                  "Create Repair"
                )}
              </Button>
            ) : (
              <Button 
                type="button" 
                onClick={() => currentStep === "customer" && selectedCustomerId ? setCurrentStep("device") : setCurrentStep("service")} 
                disabled={currentStep === "customer" && !selectedCustomerId}
              >
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {showNewCustomerForm && (
        <CustomerForm 
          isOpen={showNewCustomerForm}
          onClose={() => setShowNewCustomerForm(false)}
          onCustomerCreated={handleCustomerCreated}
        />
      )}

      {showNewDeviceForm && selectedCustomerId && (
        <DeviceForm
          customerId={selectedCustomerId}
          isOpen={showNewDeviceForm}
          onClose={() => setShowNewDeviceForm(false)}
          onDeviceCreated={handleDeviceCreated}
        />
      )}
    </>
  );
}
