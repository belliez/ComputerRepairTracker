import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertServiceSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Edit, Trash, Plus, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Service = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  hourlyRate: number | null;
  cost: number | null;
  isActive: boolean;
  organizationId: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
  deletedAt: string | null;
};

type Technician = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  specialties: string[] | null;
  notes: string | null;
  isActive: boolean;
  organizationId: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
  deletedAt: string | null;
};

type TechnicianRate = {
  id: number;
  technicianId: number;
  serviceId: number;
  hourlyRate: number;
  organizationId: number;
  createdAt: string;
  updatedAt: string | null;
  technicianFirstName: string;
  technicianLastName: string;
  serviceName: string;
  serviceCategory: string | null;
  serviceStandardRate: number | null;
};

export default function ServicesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("services");
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<{technicianId: number, serviceId: number} | null>(null);
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch services
  const { data: services, isLoading: isServicesLoading } = useQuery<Service[]>({
    queryKey: ['/api/services'],
    onError: (error) => {
      toast({
        title: "Error fetching services",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Fetch technicians
  const { data: technicians, isLoading: isTechniciansLoading } = useQuery<Technician[]>({
    queryKey: ['/api/technicians'],
    onError: (error) => {
      toast({
        title: "Error fetching technicians",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Fetch technician rates
  const { data: technicianRates, isLoading: isRatesLoading } = useQuery<TechnicianRate[]>({
    queryKey: ['/api/technician-rates'],
    onError: (error) => {
      toast({
        title: "Error fetching technician rates",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Get unique categories
  const categories = services 
    ? [...new Set(services.filter(s => s.category).map(s => s.category))]
    : [];

  // Define form for adding services
  const serviceForm = useForm({
    resolver: zodResolver(insertServiceSchema.extend({
      name: insertServiceSchema.shape.name,
      description: insertServiceSchema.shape.description.optional(),
      category: insertServiceSchema.shape.category.optional(),
      hourlyRate: insertServiceSchema.shape.hourlyRate.optional(),
      cost: insertServiceSchema.shape.cost.optional(),
      isActive: insertServiceSchema.shape.isActive.default(true),
    })),
    defaultValues: editingService ? {
      name: editingService.name,
      description: editingService.description || '',
      category: editingService.category || '',
      hourlyRate: editingService.hourlyRate || 0,
      cost: editingService.cost || 0,
      isActive: editingService.isActive,
    } : {
      name: '',
      description: '',
      category: '',
      hourlyRate: 0,
      cost: 0,
      isActive: true,
    },
  });

  // Define form for adding technician rates
  const rateForm = useForm({
    resolver: zodResolver(
      insertServiceSchema.pick({
        hourlyRate: true,
      }).extend({
        technicianId: insertServiceSchema.shape.id,
        serviceId: insertServiceSchema.shape.id,
      })
    ),
    defaultValues: {
      technicianId: editingRate?.technicianId || 0,
      serviceId: editingRate?.serviceId || 0,
      hourlyRate: 0,
    },
  });

  // Handle service form submission
  const onServiceSubmit = async (data: any) => {
    try {
      if (editingService) {
        // Update existing service
        const res = await apiRequest(
          "PUT", 
          `/api/services/${editingService.id}`, 
          data
        );
        
        if (res.ok) {
          toast({
            title: "Service updated",
            description: "The service has been updated successfully",
          });
          queryClient.invalidateQueries({ queryKey: ['/api/services'] });
          setIsServiceDialogOpen(false);
          setEditingService(null);
          serviceForm.reset();
        } else {
          const error = await res.json();
          throw new Error(error.message || "Failed to update service");
        }
      } else {
        // Create new service
        const res = await apiRequest(
          "POST", 
          "/api/services", 
          data
        );
        
        if (res.ok) {
          toast({
            title: "Service created",
            description: "The service has been created successfully",
          });
          queryClient.invalidateQueries({ queryKey: ['/api/services'] });
          setIsServiceDialogOpen(false);
          serviceForm.reset();
        } else {
          const error = await res.json();
          throw new Error(error.message || "Failed to create service");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle rate form submission
  const onRateSubmit = async (data: any) => {
    try {
      // Create or update technician rate
      const res = await apiRequest(
        "POST", 
        "/api/technician-rates", 
        data
      );
      
      if (res.ok) {
        toast({
          title: "Rate updated",
          description: "The technician rate has been set successfully",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/technician-rates'] });
        setIsRateDialogOpen(false);
        setEditingRate(null);
        rateForm.reset();
      } else {
        const error = await res.json();
        throw new Error(error.message || "Failed to set technician rate");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle service deletion
  const handleDeleteService = async (id: number) => {
    try {
      const res = await apiRequest("DELETE", `/api/services/${id}`);
      
      if (res.ok) {
        toast({
          title: "Service deleted",
          description: "The service has been deleted successfully",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      } else {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete service");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle rate deletion
  const handleDeleteRate = async (id: number) => {
    try {
      const res = await apiRequest("DELETE", `/api/technician-rates/${id}`);
      
      if (res.ok) {
        toast({
          title: "Rate deleted",
          description: "The technician rate has been deleted successfully",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/technician-rates'] });
      } else {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete rate");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Function to add a new service (opens dialog)
  const handleAddService = () => {
    setEditingService(null);
    serviceForm.reset({
      name: '',
      description: '',
      category: '',
      hourlyRate: 0,
      cost: 0,
      isActive: true,
    });
    setIsServiceDialogOpen(true);
  };

  // Function to edit a service (opens dialog)
  const handleEditService = (service: Service) => {
    setEditingService(service);
    serviceForm.reset({
      name: service.name,
      description: service.description || '',
      category: service.category || '',
      hourlyRate: service.hourlyRate || 0,
      cost: service.cost || 0,
      isActive: service.isActive,
    });
    setIsServiceDialogOpen(true);
  };

  // Function to add/edit a technician rate (opens dialog)
  const handleConfigureRate = (technicianId: number, serviceId: number) => {
    setEditingRate({ technicianId, serviceId });
    
    // Find existing rate if any
    const existingRate = technicianRates?.find(
      rate => rate.technicianId === technicianId && rate.serviceId === serviceId
    );
    
    rateForm.reset({
      technicianId,
      serviceId,
      hourlyRate: existingRate?.hourlyRate || 
        services?.find(s => s.id === serviceId)?.hourlyRate || 0,
    });
    
    setIsRateDialogOpen(true);
  };

  // Filter services by category
  const filteredServices = services 
    ? (selectedCategory && selectedCategory !== 'all')
      ? services.filter(service => service.category === selectedCategory)
      : services
    : [];

  // Loading state
  if (isServicesLoading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Services</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Services Management</h1>
        <Button onClick={handleAddService} className="flex items-center gap-2">
          <Plus size={16} /> Add Service
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="rates">Technician Rates</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services">
          {/* Category filter */}
          <div className="mb-6 flex gap-4">
            <Select 
              value={selectedCategory || 'all'} 
              onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category || `category-${Math.random()}`}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Services Grid */}
          {filteredServices.length === 0 ? (
            <Alert>
              <AlertTitle>No services found</AlertTitle>
              <AlertDescription>
                No services are available. Click the "Add Service" button to create your first service.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredServices.map((service) => (
                <Card key={service.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {service.name}
                          {!service.isActive && <Badge variant="outline" className="text-gray-500">Inactive</Badge>}
                        </CardTitle>
                        {service.category && (
                          <CardDescription className="mt-1">
                            Category: {service.category}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditService(service)}>
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)}>
                          <Trash size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {service.description && (
                        <p className="text-sm text-gray-600">{service.description}</p>
                      )}
                      <Separator />
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        {service.hourlyRate !== null && (
                          <div>
                            <p className="text-xs text-gray-500">Standard Rate</p>
                            <p className="font-medium flex items-center">
                              <DollarSign size={14} className="mr-1" />
                              {service.hourlyRate.toFixed(2)}/hr
                            </p>
                          </div>
                        )}
                        {service.cost !== null && (
                          <div>
                            <p className="text-xs text-gray-500">Base Cost</p>
                            <p className="font-medium flex items-center">
                              <DollarSign size={14} className="mr-1" />
                              {service.cost.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Technician Rates Tab */}
        <TabsContent value="rates">
          {isRatesLoading || isTechniciansLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {!technicians || technicians.length === 0 ? (
                <Alert>
                  <AlertTitle>No technicians found</AlertTitle>
                  <AlertDescription>
                    You need to add technicians before you can configure their service rates.
                  </AlertDescription>
                </Alert>
              ) : !services || services.length === 0 ? (
                <Alert>
                  <AlertTitle>No services found</AlertTitle>
                  <AlertDescription>
                    You need to add services before you can configure technician rates.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {technicians
                    .filter(tech => tech.isActive)
                    .map((technician) => (
                    <Card key={technician.id}>
                      <CardHeader>
                        <CardTitle>{technician.firstName} {technician.lastName}</CardTitle>
                        <CardDescription>
                          Configure service rates for this technician
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[600px]">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-4">Service</th>
                                <th className="text-left py-2 px-4">Category</th>
                                <th className="text-left py-2 px-4">Standard Rate</th>
                                <th className="text-left py-2 px-4">Technician Rate</th>
                                <th className="text-left py-2 px-4">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {services
                                .filter(service => service.isActive)
                                .map((service) => {
                                const techRate = technicianRates?.find(
                                  rate => rate.technicianId === technician.id && rate.serviceId === service.id
                                );
                                
                                return (
                                  <tr key={service.id} className="border-b hover:bg-slate-50">
                                    <td className="py-2 px-4">{service.name}</td>
                                    <td className="py-2 px-4">{service.category || '-'}</td>
                                    <td className="py-2 px-4">
                                      {service.hourlyRate !== null ? `$${service.hourlyRate.toFixed(2)}/hr` : '-'}
                                    </td>
                                    <td className="py-2 px-4">
                                      {techRate 
                                        ? <span className="font-medium">${techRate.hourlyRate.toFixed(2)}/hr</span>
                                        : <span className="text-gray-400">Not set</span>
                                      }
                                    </td>
                                    <td className="py-2 px-4">
                                      <div className="flex gap-2">
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => handleConfigureRate(technician.id, service.id)}
                                        >
                                          {techRate ? 'Edit' : 'Set Rate'}
                                        </Button>
                                        {techRate && (
                                          <Button 
                                            variant="destructive" 
                                            size="sm"
                                            onClick={() => handleDeleteRate(techRate.id)}
                                          >
                                            <Trash size={16} />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Service Form Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
            <DialogDescription>
              {editingService 
                ? 'Update the details for this service.'
                : 'Enter the details for the new service.'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...serviceForm}>
            <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
              <FormField
                control={serviceForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Screen Repair" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={serviceForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        value={field.value || ''}
                        placeholder="Describe what this service includes..." 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={serviceForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''}
                          placeholder="e.g., Hardware Repair" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={serviceForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Inactive services won't appear in repairs
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={serviceForm.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard Hourly Rate</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                          <Input
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              field.onChange(!isNaN(value) ? value : 0);
                            }}
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Default hourly rate for this service
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={serviceForm.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Cost</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                          <Input
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              field.onChange(!isNaN(value) ? value : 0);
                            }}
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Fixed cost for this service (if applicable)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsServiceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingService ? 'Update Service' : 'Create Service'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Technician Rate Form Dialog */}
      <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure Hourly Rate</DialogTitle>
            <DialogDescription>
              Set a custom hourly rate for this technician-service combination.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...rateForm}>
            <form onSubmit={rateForm.handleSubmit(onRateSubmit)} className="space-y-4">
              {editingRate && (
                <>
                  <div className="grid gap-4">
                    <div>
                      <Label>Technician</Label>
                      <div className="mt-1 font-medium">
                        {technicians?.find(t => t.id === editingRate.technicianId)?.firstName} {" "}
                        {technicians?.find(t => t.id === editingRate.technicianId)?.lastName}
                      </div>
                    </div>
                    
                    <div>
                      <Label>Service</Label>
                      <div className="mt-1 font-medium">
                        {services?.find(s => s.id === editingRate.serviceId)?.name}
                      </div>
                    </div>
                    
                    <div>
                      <Label>Standard Rate</Label>
                      <div className="mt-1 font-medium">
                        ${services?.find(s => s.id === editingRate.serviceId)?.hourlyRate?.toFixed(2) || '0.00'}/hr
                      </div>
                    </div>
                  </div>

                  <Separator />
                </>
              )}
              
              {/* Hidden fields */}
              <input type="hidden" {...rateForm.register('technicianId')} />
              <input type="hidden" {...rateForm.register('serviceId')} />
              
              <FormField
                control={rateForm.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Hourly Rate</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-8"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      This rate will override the standard service rate for this technician
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsRateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Save Rate
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}