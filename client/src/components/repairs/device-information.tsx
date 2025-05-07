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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { insertDeviceSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import DeviceForm from "../devices/device-form"; 

interface DeviceInformationProps {
  device: any;
  customerId: number;
  onDeviceUpdated?: () => void;
  onDeviceCreated?: (deviceId: number) => void;
  readOnly?: boolean;
}

export default function DeviceInformation({ 
  device, 
  customerId,
  onDeviceUpdated,
  onDeviceCreated,
  readOnly = false
}: DeviceInformationProps) {
  const { toast } = useToast();
  const [showAddDevice, setShowAddDevice] = useState(false);
  
  // Form validation schema
  const formSchema = insertDeviceSchema.extend({
    condition: z.string().optional().nullable(),
    accessories: z.string().optional().nullable(),
    password: z.string().optional().nullable(),
    serialNumber: z.string().optional().nullable(),
  });

  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: customerId,
      type: device?.type || "Laptop",
      brand: device?.brand || "",
      model: device?.model || "",
      serialNumber: device?.serialNumber || "",
      password: device?.password || "",
      condition: device?.condition || "",
      accessories: device?.accessories || "",
    }
  });

  // Update form when device data changes
  useEffect(() => {
    if (device) {
      form.reset({
        customerId: customerId,
        type: device.type || "Laptop",
        brand: device.brand || "",
        model: device.model || "",
        serialNumber: device.serialNumber || "",
        password: device.password || "",
        condition: device.condition || "",
        accessories: device.accessories || "",
      });
    } else {
      form.setValue("customerId", customerId);
    }
  }, [device, form, customerId]);

  // Device update mutation
  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (device && device.id) {
        return apiRequest("PUT", `/api/devices/${device.id}`, data);
      } else {
        return apiRequest("POST", "/api/devices", data);
      }
    },
    onSuccess: async (response) => {
      // Get the device ID from the response
      const responseData = await response.json();
      const deviceId = responseData?.id || device?.id;
      
      // Invalidate and refetch device data
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      if (deviceId) {
        queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}`] });
      }
      
      // Invalidate repair queries that might display device data
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
      
      toast({
        title: device?.id ? "Device updated" : "Device created",
        description: device?.id 
          ? "Device information has been updated successfully" 
          : "New device has been created successfully",
      });
      
      if (device?.id && onDeviceUpdated) {
        onDeviceUpdated();
      } else if (deviceId && onDeviceCreated) {
        onDeviceCreated(deviceId);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${device?.id ? "update" : "create"} device: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // Convert serial number to uppercase
    if (data.serialNumber) {
      data.serialNumber = data.serialNumber.toUpperCase();
    }
    mutation.mutate(data);
  };

  const handleSave = () => {
    form.handleSubmit(onSubmit)();
  };

  const handleDeviceCreated = (deviceId: number) => {
    setShowAddDevice(false);
    if (onDeviceCreated) {
      onDeviceCreated(deviceId);
    }
  };

  // Edit form content
  const editForm = (
    <Form {...form}>
      <form className="space-y-3">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Device Type</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-3">
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
      </form>
    </Form>
  );

  // Display content when there is a device
  const displayContent = device ? (
    <div className="space-y-2">
      <div>
        <span className="font-medium">Type:</span> {device.type || 'N/A'}
      </div>
      <div>
        <span className="font-medium">Brand/Model:</span> {device.brand || ''} {device.model || ''}
      </div>
      {device.serialNumber && (
        <div>
          <span className="font-medium">Serial Number:</span> {device.serialNumber}
        </div>
      )}
      {device.password && (
        <div>
          <span className="font-medium">Password:</span> {device.password}
        </div>
      )}
      {device.condition && (
        <div>
          <span className="font-medium">Condition:</span> {device.condition}
        </div>
      )}
      {device.accessories && (
        <div>
          <span className="font-medium">Accessories:</span> {device.accessories}
        </div>
      )}
    </div>
  ) : (
    <div className="space-y-3">
      <p className="text-gray-500">No device associated with this repair</p>
      {!readOnly && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowAddDevice(true)}
          className="flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Device
        </Button>
      )}
    </div>
  );

  return (
    <>
      <InformationSection
        title="Device Information"
        editForm={device && !readOnly ? editForm : undefined}
        onSave={handleSave}
        canEdit={!readOnly && !!device}
      >
        {displayContent}
      </InformationSection>

      {showAddDevice && (
        <DeviceForm
          customerId={customerId}
          isOpen={showAddDevice}
          onClose={() => setShowAddDevice(false)}
          onDeviceCreated={handleDeviceCreated}
        />
      )}
    </>
  );
}