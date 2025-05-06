import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Customer, Device, Technician, insertRepairSchema, repairStatuses } from "@shared/schema";
import { X } from "lucide-react";
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
        deviceId: selectedDeviceId ? Number(selectedDeviceId) : null,
        issue: values.issue || "",
        status: values.status || "intake",
        priorityLevel: Number(values.priorityLevel || 3),
        technicianId: values.technicianId ? Number(values.technicianId) : null,
        notes: values.notes || "",
        isUnderWarranty: Boolean(values.isUnderWarranty),
        ticketNumber, // Only used for new repairs
        // Include estimated completion date if provided
        estimatedCompletionDate: values.estimatedCompletionDate && values.estimatedCompletionDate.trim() !== "" 
          ? values.estimatedCompletionDate
          : null
      };
      
      // Validate critical fields
      if (!apiData.customerId) {
        form.setError("customerId", {
          type: "manual",
          message: "Customer is required",
        });
        
        toast({
          title: "Missing information",
          description: "Please make sure all required fields are filled out.",
          variant: "destructive"
        });
        return;
      }
      
      // If no device is selected, set deviceId to null explicitly
      if (!apiData.deviceId || apiData.deviceId === 0) {
        apiData.deviceId = null;
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

  // Render clickable step indicators
  const renderStepIndicator = () => {
    return (
      <div className="mb-4 sm:mb-6 w-full overflow-x-auto pb-2">
        <div className="flex items-center w-full" style={{ minWidth: "270px" }}>
          <div className="flex-1">
            <div 
              className="flex items-center justify-start cursor-pointer" 
              onClick={() => {
                // Only allow stepping back to customer from device step or when editing
                if (currentStep === "device" || repairId) {
                  setCurrentStep("customer");
                }
              }}
            >
              <div className={`rounded-full h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center ${
                currentStep === "customer" ? "bg-blue-500" : 
                "bg-blue-500"
              }`}>
                <i className="fas fa-user text-white text-xs sm:text-sm"></i>
              </div>
              <div className="ml-2 sm:ml-4">
                <p className={`text-xs sm:text-sm font-medium ${
                  currentStep === "customer" ? "text-gray-900" : 
                  "text-gray-900"
                }`}>Customer</p>
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-200 h-1 flex-1 max-w-[40px]">
            <div className={`bg-blue-500 h-1 ${
              currentStep === "customer" ? "w-0" : "w-full"
            }`}></div>
          </div>
          <div className="flex-1">
            <div 
              className={`flex items-center justify-center cursor-pointer ${
                // Only enable if we have a customer selected or when editing 
                selectedCustomerId || repairId ? "" : "opacity-50 pointer-events-none"
              }`}
              onClick={() => {
                // Only allow clicking if customer is selected or when editing
                if (selectedCustomerId || repairId) {
                  setCurrentStep("device");
                }
              }}
            >
              <div className={`rounded-full h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center ${
                currentStep === "device" ? "bg-blue-500" : 
                currentStep === "service" ? "bg-blue-500" : "bg-gray-200"
              }`}>
                <i className={`fas fa-laptop ${
                  currentStep === "device" || currentStep === "service" 
                    ? "text-white" 
                    : "text-gray-500"
                } text-xs sm:text-sm`}></i>
              </div>
              <div className="ml-2 sm:ml-4">
                <p className={`text-xs sm:text-sm font-medium ${
                  currentStep === "device" ? "text-gray-900" : "text-gray-500"
                }`}>Device</p>
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-200 h-1 flex-1 max-w-[40px]">
            <div className={`bg-blue-500 h-1 ${
              currentStep === "service" ? "w-full" : "w-0"
            }`}></div>
          </div>
          <div className="flex-1">
            <div 
              className={`flex items-center justify-end cursor-pointer ${
                // Only enable if we have a customer selected or when editing
                selectedCustomerId || repairId ? "" : "opacity-50 pointer-events-none"
              }`}
              onClick={() => {
                // Only allow clicking if a customer is selected or when editing
                if (selectedCustomerId || repairId) {
                  setCurrentStep("service");
                }
              }}
            >
              <div className={`rounded-full h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center ${
                currentStep === "service" ? "bg-blue-500" : "bg-gray-200"
              }`}>
                <i className={`fas fa-wrench ${
                  currentStep === "service" ? "text-white" : "text-gray-500"
                } text-xs sm:text-sm`}></i>
              </div>
              <div className="ml-2 sm:ml-4">
                <p className={`text-xs sm:text-sm font-medium ${
                  currentStep === "service" ? "text-gray-900" : "text-gray-500"
                }`}>Service</p>
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
          <p className="mt-1 text-xs sm:text-sm text-gray-500">Find an existing customer or create a new one.</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400 text-xs sm:text-sm"></i>
            </div>
            <Input
              type="text"
              placeholder="Search by name, email, or phone"
              className="pl-10 text-xs sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-500">or</span>
            <Button onClick={handleNewCustomer} size="sm" className="text-xs sm:text-sm py-1 h-8 sm:h-9">
              <i className="fas fa-plus mr-1 sm:mr-2"></i> New Customer
            </Button>
          </div>
          
          <div className="max-h-56 sm:max-h-60 overflow-y-auto border rounded-md">
            {filteredCustomers?.length === 0 ? (
              <div className="p-2 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">
                No customers found. Try a different search term or create a new customer.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredCustomers?.map(customer => (
                  <li 
                    key={customer.id} 
                    className={`p-2 sm:p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedCustomerId === customer.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleCustomerSelected(customer.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <div>
                        <div className="font-medium text-sm sm:text-base">{`${customer.firstName} ${customer.lastName}`}</div>
                        <div className="text-xs sm:text-sm text-gray-500">{customer.email}</div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-0">{customer.phone}</div>
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
          <p className="mt-1 text-xs sm:text-sm text-gray-500">Select an existing device, add a new one, or skip if no device is involved.</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {devices?.length === 0 ? (
            <div className="text-center py-2 sm:py-4">
              <p className="text-gray-500 text-xs sm:text-sm">No devices found for this customer.</p>
            </div>
          ) : (
            <div className="max-h-56 sm:max-h-60 overflow-y-auto border rounded-md">
              <ul className="divide-y divide-gray-200">
                {devices?.map(device => (
                  <li 
                    key={device.id} 
                    className={`p-2 sm:p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedDeviceId === device.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleDeviceSelected(device.id)}
                  >
                    <div className="font-medium text-sm sm:text-base">{device.brand} {device.model}</div>
                    <div className="text-xs sm:text-sm text-gray-500">{device.type}</div>
                    {device.serialNumber && (
                      <div className="text-xs text-gray-500">S/N: {device.serialNumber}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <Button 
              onClick={handleNewDevice}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm py-1 h-8 sm:h-9"
            >
              <i className="fas fa-plus mr-1 sm:mr-2"></i> Add New Device
            </Button>
            
            <Button 
              onClick={handleSkipDevice}
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm py-1 h-8 sm:h-9"
            >
              Skip (No Device)
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
            <p className="mt-1 text-xs sm:text-sm text-gray-500">Provide information about the repair service needed.</p>
          </div>
          
          <FormField
            control={form.control}
            name="issue"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Issue Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe the problem in detail..." 
                    {...field} 
                    value={field.value || ""}
                    className="text-sm resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Assign Technician</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "0" ? null : parseInt(value))}
                    value={field.value?.toString() || "0"}
                  >
                    <FormControl>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a technician" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Unassigned</SelectItem>
                      {technicians?.map(tech => (
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
              name="priorityLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Priority Level</FormLabel>
                  <div className="flex flex-wrap gap-1 sm:gap-2">
                    <RadioGroup 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()} 
                      className="flex flex-wrap space-x-0 gap-1 sm:gap-2"
                    >
                      {[1, 2, 3, 4, 5].map(level => (
                        <div key={level} className="flex items-center">
                          <RadioGroupItem 
                            value={level.toString()}
                            id={`priority-${level}`}
                            className="sr-only"
                          />
                          <FormLabel
                            htmlFor={`priority-${level}`}
                            className={`
                              text-xs sm:text-sm px-2 py-1 rounded-md cursor-pointer 
                              hover:bg-gray-100 dark:hover:bg-gray-700
                              ${parseInt(field.value?.toString() || "3") === level 
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-50" 
                                : "bg-gray-50 dark:bg-gray-900"
                              }
                            `}
                          >
                            {level === 1 && "Lowest"}
                            {level === 2 && "Low"}
                            {level === 3 && "Normal"}
                            {level === 4 && "High"}
                            {level === 5 && "Urgent"}
                          </FormLabel>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional notes..."
                      {...field}
                      value={field.value || ""}
                      className="text-sm resize-none h-24"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-4">
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
                      <FormLabel className="text-sm">Under Warranty</FormLabel>
                      <FormDescription className="text-xs">
                        Check if this repair is covered by warranty
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="estimatedCompletionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Estimated Completion</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value || ""}
                        className="text-sm"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      When do you expect to complete this repair?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </form>
      </Form>
    );
  };

  // Effect to handle keyboard appearing on mobile
  useEffect(() => {
    // Only run this effect if the dialog is open
    if (!isOpen) return;
    
    // Function to handle viewport changes (like when keyboard appears)
    const handleResize = () => {
      // Get the dialog content element
      const dialogContent = document.querySelector('[role="dialog"]');
      if (dialogContent) {
        // Adjust the scroll position if an input is focused
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement || 
            activeElement instanceof HTMLTextAreaElement) {
          // Scroll the active element into view with some padding
          setTimeout(() => {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
    };
    
    // Function to handle input focus
    const handleFocus = (e: FocusEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || 
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement) {
        // Scroll the focused element into view
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);
    document.addEventListener('focus', handleFocus, true);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('focus', handleFocus, true);
    };
  }, [isOpen, currentStep]);
  
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
  
  // Force mobile mode for this fix
  const forceMobile = true;

  if (forceMobile || isMobile) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 z-[1000] flex flex-col bg-background">
            <div className="w-full h-full flex flex-col">
              {/* Header */}
              <div className="sticky top-0 bg-background z-10 px-4 py-3 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {repairId ? "Edit Repair" : "Create New Repair"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {repairId 
                      ? "Edit the repair information below" 
                      : "Enter the information below to create a new repair ticket"
                    }
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <span className="text-xl">×</span>
                </Button>
              </div>
              
              {/* Content */}
              <div className="flex-1 px-4 py-3 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {renderStepIndicator()}
                
                {currentStep === "customer" && renderCustomerStep()}
                {currentStep === "device" && renderDeviceStep()}
                {currentStep === "service" && renderServiceStep()}
              </div>
              
              {/* Footer */}
              <div className="sticky bottom-0 bg-background z-10 px-4 py-3 border-t flex flex-wrap justify-end gap-2">
                {currentStep !== "customer" && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handlePrevStep}
                    className="mr-auto"
                    size="sm"
                  >
                    Back
                  </Button>
                )}
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  size="sm"
                >
                  Cancel
                </Button>
                
                {currentStep === "service" ? (
                  <Button 
                    type="button"
                    size="sm"
                    onClick={() => {
                      // Get form values directly
                      const formValues = form.getValues();
                      console.log("Form values:", formValues);
                      
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

                      // Create submission data differently based on whether we're creating or updating
                      let apiData;
                      
                      if (repairId) {
                        // When updating, only send the fields that are editable
                        apiData = {
                          status: formValues.status,
                          priorityLevel: Number(formValues.priorityLevel || 3),
                          technicianId: formValues.technicianId ? Number(formValues.technicianId) : null,
                          issue: formValues.issue || "",
                          notes: formValues.notes || "",
                          isUnderWarranty: Boolean(formValues.isUnderWarranty),
                          // We can safely update customer and device IDs too
                          customerId: Number(selectedCustomerId),
                          deviceId: selectedDeviceId ? Number(selectedDeviceId) : null,
                          // Include estimated completion date if provided
                          estimatedCompletionDate: formValues.estimatedCompletionDate && formValues.estimatedCompletionDate.trim() !== "" 
                            ? formValues.estimatedCompletionDate
                            : null
                        };
                      } else {
                        // For new repairs, include all the required fields
                        apiData = {
                          customerId: Number(selectedCustomerId),
                          deviceId: selectedDeviceId ? Number(selectedDeviceId) : null,
                          issue: formValues.issue || "",
                          status: "intake", // Always "intake" for new repairs
                          priorityLevel: Number(formValues.priorityLevel || 3),
                          technicianId: formValues.technicianId ? Number(formValues.technicianId) : null,
                          notes: formValues.notes || "",
                          isUnderWarranty: Boolean(formValues.isUnderWarranty),
                          ticketNumber // New repairs get a ticket number
                        };
                      }
                      
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
                    size="sm"
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        
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
  
  // For desktop, keep using the Dialog
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl p-6">
          <DialogHeader>
            <DialogTitle>
              {repairId ? "Edit Repair" : "Create New Repair"}
            </DialogTitle>
            <DialogDescription>
              {repairId 
                ? "Edit the repair information below" 
                : "Enter the information below to create a new repair ticket"
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2 sm:py-4 space-y-4 sm:space-y-6">
            {renderStepIndicator()}
            
            {currentStep === "customer" && renderCustomerStep()}
            {currentStep === "device" && renderDeviceStep()}
            {currentStep === "service" && renderServiceStep()}
          </div>
          
          <DialogFooter className="flex flex-wrap justify-end gap-2 pt-2 mt-4">
            {currentStep !== "customer" && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handlePrevStep}
                className="mr-auto text-xs sm:text-sm h-8 sm:h-9"
                size="sm"
              >
                Back
              </Button>
            )}
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="text-xs sm:text-sm h-8 sm:h-9"
              size="sm"
            >
              Cancel
            </Button>
            
            {currentStep === "service" ? (
              <Button 
                type="button"
                className="text-xs sm:text-sm h-8 sm:h-9"
                size="sm"
                onClick={() => {
                  // Get form values directly
                  const formValues = form.getValues();
                  console.log("Form values:", formValues);
                  
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

                  // Create submission data differently based on whether we're creating or updating
                  let apiData;
                  
                  if (repairId) {
                    // When updating, only send the fields that are editable
                    apiData = {
                      status: formValues.status,
                      priorityLevel: Number(formValues.priorityLevel || 3),
                      technicianId: formValues.technicianId ? Number(formValues.technicianId) : null,
                      issue: formValues.issue || "",
                      notes: formValues.notes || "",
                      isUnderWarranty: Boolean(formValues.isUnderWarranty),
                      // We can safely update customer and device IDs too
                      customerId: Number(selectedCustomerId),
                      deviceId: selectedDeviceId ? Number(selectedDeviceId) : null,
                      // Include estimated completion date if provided
                      estimatedCompletionDate: formValues.estimatedCompletionDate && formValues.estimatedCompletionDate.trim() !== "" 
                        ? formValues.estimatedCompletionDate
                        : null
                    };
                  } else {
                    // For new repairs, include all the required fields
                    apiData = {
                      customerId: Number(selectedCustomerId),
                      deviceId: selectedDeviceId ? Number(selectedDeviceId) : null,
                      issue: formValues.issue || "",
                      status: "intake", // Always "intake" for new repairs
                      priorityLevel: Number(formValues.priorityLevel || 3),
                      technicianId: formValues.technicianId ? Number(formValues.technicianId) : null,
                      notes: formValues.notes || "",
                      isUnderWarranty: Boolean(formValues.isUnderWarranty),
                      ticketNumber // New repairs get a ticket number
                    };
                  }
                  
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
                className="text-xs sm:text-sm h-8 sm:h-9"
                size="sm"
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