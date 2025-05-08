import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertDeviceSchema } from "@shared/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface DeviceFormProps {
  customerId: number;
  deviceId?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onDeviceCreated?: (deviceId: number) => void;
}

export default function DeviceForm({ 
  customerId,
  deviceId, 
  isOpen, 
  onClose, 
  onDeviceCreated 
}: DeviceFormProps) {
  const { toast } = useToast();
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>("Laptop");
  
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

  // Get existing device if editing
  const { data: existingDevice, isLoading } = useQuery({
    queryKey: [`/api/devices/${deviceId}`],
    enabled: !!deviceId,
  });

  // Form validation schema
  const formSchema = insertDeviceSchema.extend({
    condition: z.string().optional().nullable(),
    accessories: z.string().optional().nullable(),
    password: z.string().optional().nullable(),
    serialNumber: z.string().optional().nullable(),
  });

  // Device type options
  const deviceTypes = [
    "Laptop",
    "Desktop",
    "Tablet",
    "Phone",
    "Server",
    "Printer",
    "Monitor",
    "Other"
  ];

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: customerId,
      type: "Laptop", // Set a default device type
      brand: "",
      model: "",
      serialNumber: "",
      password: "",
      condition: "",
      accessories: "",
    },
  });

  // Update form with existing device data if editing
  useEffect(() => {
    if (existingDevice) {
      form.reset(existingDevice);
      // Also update the selectedDeviceType state if editing an existing device
      if (existingDevice && typeof existingDevice === 'object' && 'type' in existingDevice) {
        setSelectedDeviceType(existingDevice.type as string);
      }
    } else {
      form.setValue("customerId", customerId);
    }
  }, [existingDevice, form, customerId]);

  // Create or update device mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      let response;
      if (deviceId) {
        // Update existing device
        response = await apiRequest("PUT", `/api/devices/${deviceId}`, values);
      } else {
        // Create new device
        response = await apiRequest("POST", "/api/devices", values);
      }
      // Parse the response JSON to get the actual data with the device ID
      return await response.json();
    },
    onSuccess: (data) => {
      // Force immediate refresh of device data
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.refetchQueries({ queryKey: ["/api/devices"] });
      
      console.log("Device form - received device data:", data);
      
      toast({
        title: deviceId ? "Device updated" : "Device created",
        description: deviceId
          ? "The device has been updated successfully"
          : "The device has been created successfully",
      });

      // Call the callback with the new device ID if provided
      if (!deviceId && onDeviceCreated && data && data.id) {
        console.log("Device form: New device created with ID:", data.id);
        // Wait a moment for data to process before calling callback
        setTimeout(() => {
          onDeviceCreated(data.id);
        }, 100);
      } else {
        onClose();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${deviceId ? "update" : "create"} device: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  // Render form content
  const renderDeviceTypeSelector = () => (
    <div>
      <FormLabel className="block mb-2">Device Type</FormLabel>
      
      {/* Quick Select Icons for Device Types */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {deviceTypes.map((type) => {
          // Get icon for device type
          let icon;
          switch(type) {
            case "Laptop": icon = "laptop"; break;
            case "Desktop": icon = "desktop"; break;
            case "Tablet": icon = "tablet-alt"; break;
            case "Phone": icon = "mobile-alt"; break;
            case "Server": icon = "server"; break;
            case "Printer": icon = "print"; break;
            case "Monitor": icon = "tv"; break;
            case "Other": icon = "hdd"; break;
          }
          
          // Check if this type is active
          const isActive = selectedDeviceType === type;
          
          return (
            <button 
              key={type}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedDeviceType(type);
                form.setValue("type", type);
                console.log("Selected device type:", type);
              }}
              className={`p-3 rounded-md flex flex-col items-center justify-center text-xs border cursor-pointer touch-manipulation ${
                isActive
                  ? "bg-blue-100 border-blue-500 text-blue-700 font-semibold"
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100 active:bg-gray-100"
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <i className={`fas fa-${icon} text-xl mb-2 ${isActive ? 'text-blue-600' : 'text-gray-600'}`}></i>
              {type}
            </button>
          );
        })}
      </div>
      
      {/* Hidden field to maintain form state */}
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem className="hidden">
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
  
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
        <form 
          onSubmit={form.handleSubmit(onSubmit)} 
          className="space-y-4"
        >
          {renderDeviceTypeSelector()}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Apple, Dell, HP..." 
                      {...field} 
                      className="touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="MacBook Pro, XPS 15..." 
                      {...field} 
                      className="touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="serialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Serial Number</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Device serial number" 
                    {...field} 
                    value={(field.value || '').toUpperCase()}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    className="touch-manipulation"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Device password if applicable" 
                    {...field} 
                    value={field.value || ''} 
                    className="touch-manipulation"
                  />
                </FormControl>
                <FormDescription>
                  The password used to access the device if applicable
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="condition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Condition</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe the physical condition of the device"
                    {...field}
                    value={field.value || ''}
                    className="touch-manipulation"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accessories"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Accessories</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="List any accessories included with the device"
                    {...field}
                    value={field.value || ''}
                    className="touch-manipulation"
                  />
                </FormControl>
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
                ) : deviceId ? (
                  "Update Device"
                ) : (
                  "Create Device"
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
                {deviceId ? "Edit Device" : "New Device"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {deviceId
                  ? "Update the device information below"
                  : "Enter the device information to create a new record"}
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
              <X className="h-5 w-5" />
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
              ) : deviceId ? (
                "Update Device"
              ) : (
                "Create Device"
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
          <DialogTitle>{deviceId ? "Edit Device" : "New Device"}</DialogTitle>
          <DialogDescription>
            {deviceId
              ? "Update the device information below"
              : "Enter the device information to create a new record"}
          </DialogDescription>
        </DialogHeader>
        
        {renderFormContent()}
      </DialogContent>
    </Dialog>
  );
}