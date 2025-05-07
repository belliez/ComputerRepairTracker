import { useEffect } from "react";
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

        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a device type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deviceTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="Apple, Dell, HP..." {...field} />
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
                        <Input placeholder="MacBook Pro, XPS 15..." {...field} />
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={mutation.isPending}
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
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}