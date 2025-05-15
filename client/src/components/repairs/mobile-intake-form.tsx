import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Customer, Device, Technician, insertRepairSchema, repairStatuses } from "@shared/schema";
import { X } from "lucide-react";
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

export default function MobileIntakeForm({ repairId, isOpen, onClose }: IntakeFormProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>("customer");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [showNewDeviceForm, setShowNewDeviceForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Get existing repair if we're editing
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

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices", selectedCustomerId ? { customerId: selectedCustomerId } : null],
    enabled: !!selectedCustomerId,
  });

  // Form validation schema - closely aligns with the server schema
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
    ticketNumber: z.string().optional(), // Will be generated for new repairs
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
      estimatedCompletionDate: "", // Empty string default
      ticketNumber: undefined,
    },
  });

  // Update form with repair data if editing
  useEffect(() => {
    if (repair) {
      console.log("Editing repair:", repair);
      
      try {
        // Set customer ID
        if (typeof repair.customerId === 'number') {
          setSelectedCustomerId(repair.customerId);
        }
        
        // Set device ID if present
        if (typeof repair.deviceId === 'number') {
          setSelectedDeviceId(repair.deviceId);
        }
        
        // When editing, set all values from the existing repair
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
        
        console.log("Form reset with data:", form.getValues());

        // When editing an existing repair, skip straight to the service details step
        setCurrentStep("service");
      } catch (err) {
        console.error("Error setting form values:", err);
        toast({
          title: "Error Loading Data",
          description: "There was an error loading the repair data. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [repair, form]);

  // Update device ID in form when selected
  useEffect(() => {
    if (selectedDeviceId) {
      form.setValue("deviceId", selectedDeviceId);
    } else {
      form.setValue("deviceId", 0);
    }
  }, [selectedDeviceId, form]);

  // Update customer ID in form when selected
  useEffect(() => {
    if (selectedCustomerId) {
      form.setValue("customerId", selectedCustomerId);
    }
  }, [selectedCustomerId, form]);

  // Mutation for creating or updating repairs
  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (repairId) {
        console.log("Updating repair #" + repairId + " with:", data);
        return apiRequest("PUT", `/api/repairs/${repairId}`, data);
      } else {
        console.log("Creating new repair with:", data);
        return apiRequest("POST", "/api/repairs", data);
      }
    },
    onSuccess: (data) => {
      // Invalidate repairs query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      
      toast({
        title: repairId ? "Repair Updated" : "Repair Created",
        description: repairId ? "The repair has been updated successfully." : "New repair ticket created successfully!",
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
    if (selectedCustomerId) {
      setShowNewDeviceForm(true);
    } else {
      toast({
        title: "Customer required",
        description: "Please select a customer first",
        variant: "destructive"
      });
    }
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

  const handleSkipDevice = () => {
    setSelectedDeviceId(null);
    setCurrentStep("service");
  };

  // Render clickable step indicators
  const renderStepIndicator = () => {
    return (
      <div className="flex items-center justify-center mb-4 space-x-2">
        <button
          className={`px-3 py-1 text-sm rounded-md ${
            currentStep === 'customer'
              ? 'bg-primary text-primary-foreground'
              : selectedCustomerId
              ? 'bg-gray-200 text-gray-700'
              : 'bg-gray-100 text-gray-400'
          }`}
          onClick={() => selectedCustomerId && setCurrentStep('customer')}
          disabled={!selectedCustomerId}
        >
          Customer
        </button>
        <div className="w-5 h-0.5 bg-gray-200" />
        <button
          className={`px-3 py-1 text-sm rounded-md ${
            currentStep === 'device'
              ? 'bg-primary text-primary-foreground'
              : selectedCustomerId
              ? 'bg-gray-200 text-gray-700'
              : 'bg-gray-100 text-gray-400'
          }`}
          onClick={() => selectedCustomerId && setCurrentStep('device')}
          disabled={!selectedCustomerId}
        >
          Device
        </button>
        <div className="w-5 h-0.5 bg-gray-200" />
        <button
          className={`px-3 py-1 text-sm rounded-md ${
            currentStep === 'service'
              ? 'bg-primary text-primary-foreground'
              : selectedCustomerId
              ? 'bg-gray-200 text-gray-700'
              : 'bg-gray-100 text-gray-400'
          }`}
          onClick={() => selectedCustomerId && setCurrentStep('service')}
          disabled={!selectedCustomerId}
        >
          Service
        </button>
      </div>
    );
  };

  // Render the customer selection step
  const renderCustomerStep = () => {
    return (
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500">🔍</span>
          </div>
          <Input
            type="text"
            placeholder="Search customers..."
            className="pl-10 pr-4 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="max-h-[40vh] overflow-y-auto border border-gray-200 rounded-md">
          {filteredCustomers?.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No customers found</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredCustomers?.map((customer) => (
                <button
                  key={customer.id}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center ${
                    selectedCustomerId === customer.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleCustomerSelected(customer.id)}
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {customer.firstName} {customer.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{customer.email}</div>
                    <div className="text-sm text-gray-500">{customer.phone}</div>
                  </div>
                  {selectedCustomerId === customer.id && (
                    <div className="text-primary">✓</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <Button type="button" onClick={handleNewCustomer}>
            Add New Customer
          </Button>
        </div>
      </div>
    );
  };

  // Render the device selection step
  const renderDeviceStep = () => {
    const customerDevices = devices || [];
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Select Device</h3>
          <Button type="button" variant="outline" size="sm" onClick={handleSkipDevice}>
            Skip (No Device)
          </Button>
        </div>
        
        <div className="max-h-[40vh] overflow-y-auto border border-gray-200 rounded-md">
          {customerDevices.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No devices found for this customer</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {customerDevices.map((device) => (
                <button
                  key={device.id}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center ${
                    selectedDeviceId === device.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleDeviceSelected(device.id)}
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {device.brand} {device.model}
                    </div>
                    <div className="text-sm text-gray-500">{device.type}</div>
                    <div className="text-sm text-gray-500">S/N: {device.serialNumber}</div>
                  </div>
                  {selectedDeviceId === device.id && (
                    <div className="text-primary">✓</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <Button type="button" onClick={handleNewDevice}>
            Add New Device
          </Button>
        </div>
      </div>
    );
  };

  // Render the service details step
  const renderServiceStep = () => {
    return (
      <div className="space-y-4">
        <Form {...form}>
          <div className="space-y-3">
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
                    onValueChange={value => {
                      console.log("Changing status from", field.value, "to", value);
                      field.onChange(value);
                    }}
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
                      <SelectItem value="null">Unassigned</SelectItem>
                      {technicians?.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id.toString()}>
                          {tech.firstName} {tech.lastName}
                          {tech.role ? ` - ${tech.role}` : ''}
                          {tech.specialty ? ` (${tech.specialty})` : ''}
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
        </Form>
      </div>
    );
  };

  // Simple submit handler function
  const handleFormSubmit = () => {
    const formValues = form.getValues();
    
    // Generate a ticket number if this is a new repair
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().slice(-2);
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const ticketNumber = `RT-${year}${month}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // Validate that issue is not empty
    if (!formValues.issue || formValues.issue.trim() === "") {
      toast({
        title: "Issue Description Required",
        description: "Please provide a description of the issue",
        variant: "destructive"
      });
      return;
    }

    // Create submission data
    const apiData = repairId 
      ? {
          // When updating
          status: formValues.status,
          priorityLevel: Number(formValues.priorityLevel || 3),
          technicianId: formValues.technicianId ? Number(formValues.technicianId) : null,
          issue: formValues.issue || "",
          notes: formValues.notes || "",
          isUnderWarranty: Boolean(formValues.isUnderWarranty),
          customerId: Number(selectedCustomerId),
          deviceId: selectedDeviceId ? Number(selectedDeviceId) : null,
          estimatedCompletionDate: formValues.estimatedCompletionDate && formValues.estimatedCompletionDate.trim() !== "" 
            ? formValues.estimatedCompletionDate
            : null
        }
      : {
          // When creating new
          customerId: Number(selectedCustomerId),
          deviceId: selectedDeviceId ? Number(selectedDeviceId) : null,
          issue: formValues.issue || "",
          status: "intake", // Always "intake" for new repairs
          priorityLevel: Number(formValues.priorityLevel || 3),
          technicianId: formValues.technicianId ? Number(formValues.technicianId) : null,
          notes: formValues.notes || "",
          isUnderWarranty: Boolean(formValues.isUnderWarranty),
          ticketNumber, // New repairs get a ticket number
          estimatedCompletionDate: formValues.estimatedCompletionDate && formValues.estimatedCompletionDate.trim() !== "" 
            ? formValues.estimatedCompletionDate
            : null
        };
    
    console.log("Submitting repair data:", apiData);
    mutation.mutate(apiData);
  };
  
  if (!isOpen) return null;
  
  // Mobile-optimized UI
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
        <div 
          className="fixed inset-0 z-50 flex flex-col bg-white" 
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the modal
        >
          {/* Header - Fixed */}
          <div className="border-b border-gray-200 p-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {repairId ? "Edit Repair" : "Create New Repair"}
            </h2>
            <button 
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            {renderStepIndicator()}
            <div className="mt-4">
              {currentStep === "customer" && renderCustomerStep()}
              {currentStep === "device" && renderDeviceStep()}
              {currentStep === "service" && renderServiceStep()}
            </div>
          </div>
          
          {/* Footer - Fixed */}
          <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-between">
            {currentStep !== "customer" ? (
              <Button 
                variant="outline" 
                onClick={handlePrevStep}
              >
                Back
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
            )}
            
            {currentStep === "service" ? (
              <Button 
                onClick={handleFormSubmit}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Saving..." : (repairId ? "Update" : "Create")}
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  if (currentStep === "customer" && selectedCustomerId) {
                    setCurrentStep("device");
                  } else if (currentStep === "device") {
                    setCurrentStep("service");
                  }
                }}
                disabled={currentStep === "customer" && !selectedCustomerId}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
      
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