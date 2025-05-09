import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader, PlusCircle, Trash2, X, RefreshCw, RotateCw } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Schemas for form validation
const currencySchema = z.object({
  code: z.string().length(3, { message: "Currency code must be exactly 3 characters (e.g., USD)" }),
  name: z.string().min(2, { message: "Currency name is required" }),
  symbol: z.string().min(1, { message: "Currency symbol is required" }),
  isDefault: z.boolean().optional(),
});

const taxRateSchema = z.object({
  countryCode: z.string().length(2, { message: "Country code must be exactly 2 characters (e.g., US)" }),
  regionCode: z.string().optional(),
  name: z.string().min(2, { message: "Tax rate name is required" }),
  rate: z.number().min(0).max(1, { message: "Rate must be between 0 and 1 (e.g., 0.07 for 7%)" }),
  isDefault: z.boolean().optional(),
});

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('currencies');
  const [showCurrencyDialog, setShowCurrencyDialog] = useState(false);
  const [showTaxRateDialog, setShowTaxRateDialog] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<any>(null);
  const [editingTaxRate, setEditingTaxRate] = useState<any>(null);
  const [deletingCurrencyCode, setDeletingCurrencyCode] = useState<string | null>(null);
  const [deletingTaxRateId, setDeletingTaxRateId] = useState<number | null>(null);
  const [showDeleteAllDataConfirm, setShowDeleteAllDataConfirm] = useState(false);
  const [activeTrashTab, setActiveTrashTab] = useState('customers');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Define types for our queries
  interface Currency {
    code: string;
    name: string;
    symbol: string;
    isDefault: boolean;
  }
  
  interface TaxRate {
    id: number;
    countryCode: string;
    regionCode: string | null;
    name: string;
    rate: number;
    isDefault: boolean;
  }
  
  // Define interfaces for deleted records
  interface Customer {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    notes: string | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Device {
    id: number;
    customerId: number;
    type: string;
    brand: string;
    model: string;
    serialNumber: string | null;
    password: string | null;
    condition: string | null;
    accessories: string | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Repair {
    id: number;
    ticketNumber: string;
    customerId: number;
    deviceId: number | null;
    technicianId: number | null;
    status: string;
    issue: string;
    notes: string | null;
    intakeDate: string;
    estimatedCompletionDate: string | null;
    actualCompletionDate: string | null;
    priorityLevel: number | null;
    isUnderWarranty: boolean | null;
    diagnosticNotes: string | null;
    customerApproval: boolean | null;
    totalCost: number | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Technician {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
    specialty: string | null;
    isActive: boolean | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface InventoryItem {
    id: number;
    name: string;
    description: string | null;
    category: string;
    sku: string | null;
    price: number;
    cost: number | null;
    quantity: number | null;
    location: string | null;
    supplier: string | null;
    minLevel: number | null;
    isActive: boolean | null;
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Quote {
    id: number;
    repairId: number;
    quoteNumber: string;
    subtotal: number;
    tax: number | null;
    total: number;
    status: string | null;
    customerNotes: string | null;
    internalNotes: string | null;
    validUntil: string | null;
    termsAndConditions: string | null;
    itemsData: string | null; 
    deleted: boolean;
    deletedAt: string | null;
  }
  
  interface Invoice {
    id: number;
    repairId: number;
    invoiceNumber: string;
    subtotal: number;
    tax: number | null;
    total: number;
    status: string | null;
    customerNotes: string | null;
    internalNotes: string | null;
    dueDate: string | null;
    itemsData: string | null;
    deleted: boolean;
    deletedAt: string | null;
  }

  // Queries
  const {
    data: currencies = [],
    isLoading: isLoadingCurrencies,
  } = useQuery<Currency[]>({
    queryKey: ['/api/settings/currencies'],
  });
  
  const {
    data: taxRates = [],
    isLoading: isLoadingTaxRates,
  } = useQuery<TaxRate[]>({
    queryKey: ['/api/settings/tax-rates'],
  });
  
  // Trash management queries
  const {
    data: deletedCustomers = [],
    isLoading: isLoadingDeletedCustomers,
  } = useQuery<Customer[]>({
    queryKey: ['/api/trash/customers'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'customers',
  });
  
  const {
    data: deletedDevices = [],
    isLoading: isLoadingDeletedDevices,
  } = useQuery<Device[]>({
    queryKey: ['/api/trash/devices'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'devices',
  });
  
  const {
    data: deletedRepairs = [],
    isLoading: isLoadingDeletedRepairs,
  } = useQuery<Repair[]>({
    queryKey: ['/api/trash/repairs'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'repairs',
  });
  
  const {
    data: deletedTechnicians = [],
    isLoading: isLoadingDeletedTechnicians,
  } = useQuery<Technician[]>({
    queryKey: ['/api/trash/technicians'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'technicians',
  });
  
  const {
    data: deletedInventoryItems = [],
    isLoading: isLoadingDeletedInventoryItems,
  } = useQuery<InventoryItem[]>({
    queryKey: ['/api/trash/inventory'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'inventory',
  });
  
  const {
    data: deletedQuotes = [],
    isLoading: isLoadingDeletedQuotes,
  } = useQuery<Quote[]>({
    queryKey: ['/api/trash/quotes'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'quotes',
  });
  
  const {
    data: deletedInvoices = [],
    isLoading: isLoadingDeletedInvoices,
  } = useQuery<Invoice[]>({
    queryKey: ['/api/trash/invoices'],
    enabled: activeTab === 'data-management' && activeTrashTab === 'invoices',
  });
  
  // Currency form
  const currencyForm = useForm<z.infer<typeof currencySchema>>({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      code: '',
      name: '',
      symbol: '',
      isDefault: false,
    }
  });
  
  // Tax rate form
  const taxRateForm = useForm<z.infer<typeof taxRateSchema>>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: {
      countryCode: '',
      regionCode: '',
      name: '',
      rate: 0,
      isDefault: false,
    }
  });
  
  // Mutations
  const createCurrencyMutation = useMutation({
    mutationFn: (data: z.infer<typeof currencySchema>) => 
      apiRequest('POST', '/api/settings/currencies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies'] });
      setShowCurrencyDialog(false);
      currencyForm.reset();
      toast({
        title: "Currency added",
        description: "The currency has been successfully added",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding currency",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const updateCurrencyMutation = useMutation({
    mutationFn: (data: z.infer<typeof currencySchema>) => 
      apiRequest('PUT', `/api/settings/currencies/${data.code}`, {
        name: data.name,
        symbol: data.symbol,
        isDefault: data.isDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies'] });
      setShowCurrencyDialog(false);
      setEditingCurrency(null);
      currencyForm.reset();
      toast({
        title: "Currency updated",
        description: "The currency has been successfully updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating currency",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const deleteCurrencyMutation = useMutation({
    mutationFn: (code: string) => 
      apiRequest('DELETE', `/api/settings/currencies/${code}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/currencies'] });
      setDeletingCurrencyCode(null);
      toast({
        title: "Currency deleted",
        description: "The currency has been successfully deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting currency",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const createTaxRateMutation = useMutation({
    mutationFn: (data: z.infer<typeof taxRateSchema>) => 
      apiRequest('POST', '/api/settings/tax-rates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/tax-rates'] });
      setShowTaxRateDialog(false);
      taxRateForm.reset();
      toast({
        title: "Tax rate added",
        description: "The tax rate has been successfully added",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding tax rate",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const updateTaxRateMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest('PUT', `/api/settings/tax-rates/${data.id}`, {
        countryCode: data.countryCode,
        regionCode: data.regionCode,
        name: data.name,
        rate: data.rate,
        isDefault: data.isDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/tax-rates'] });
      setShowTaxRateDialog(false);
      setEditingTaxRate(null);
      taxRateForm.reset();
      toast({
        title: "Tax rate updated",
        description: "The tax rate has been successfully updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating tax rate",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const deleteTaxRateMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('DELETE', `/api/settings/tax-rates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/tax-rates'] });
      setDeletingTaxRateId(null);
      toast({
        title: "Tax rate deleted",
        description: "The tax rate has been successfully deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting tax rate",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  // Restore mutations for deleted records
  const restoreCustomerMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/customers/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Customer restored",
        description: `${data.firstName} ${data.lastName} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring customer",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreDeviceMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/devices/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: "Device restored",
        description: `${data.brand} ${data.model} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring device",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreRepairMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/repairs/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/repairs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      toast({
        title: "Repair restored",
        description: `Repair ticket ${data.ticketNumber} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring repair",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreTechnicianMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/technicians/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/technicians'] });
      queryClient.invalidateQueries({ queryKey: ['/api/technicians'] });
      toast({
        title: "Technician restored",
        description: `${data.firstName} ${data.lastName} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring technician",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreInventoryItemMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/inventory/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      toast({
        title: "Inventory item restored",
        description: `${data.name} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring inventory item",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreQuoteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/quotes/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      toast({
        title: "Quote restored",
        description: `Quote ${data.quoteNumber} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring quote",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  const restoreInvoiceMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/trash/invoices/${id}/restore`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Invoice restored",
        description: `Invoice ${data.invoiceNumber} has been successfully restored`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error restoring invoice",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });
  
  // Event handlers
  const handleAddCurrency = (data: z.infer<typeof currencySchema>) => {
    if (editingCurrency) {
      updateCurrencyMutation.mutate(data);
    } else {
      createCurrencyMutation.mutate(data);
    }
  };
  
  const handleAddTaxRate = (data: z.infer<typeof taxRateSchema>) => {
    if (editingTaxRate) {
      updateTaxRateMutation.mutate({
        ...data,
        id: editingTaxRate.id,
      });
    } else {
      createTaxRateMutation.mutate(data);
    }
  };
  
  const handleEditCurrency = (currency: any) => {
    setEditingCurrency(currency);
    currencyForm.reset({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isDefault: currency.isDefault,
    });
    setShowCurrencyDialog(true);
  };
  
  const handleEditTaxRate = (taxRate: any) => {
    setEditingTaxRate(taxRate);
    taxRateForm.reset({
      countryCode: taxRate.countryCode,
      regionCode: taxRate.regionCode || '',
      name: taxRate.name,
      rate: taxRate.rate,
      isDefault: taxRate.isDefault,
    });
    setShowTaxRateDialog(true);
  };
  
  const handleDeleteCurrency = (code: string) => {
    setDeletingCurrencyCode(code);
  };
  
  const handleDeleteTaxRate = (id: number) => {
    setDeletingTaxRateId(id);
  };
  
  const handleCloseCurrencyDialog = () => {
    setShowCurrencyDialog(false);
    setEditingCurrency(null);
    currencyForm.reset();
  };
  
  const handleCloseTaxRateDialog = () => {
    setShowTaxRateDialog(false);
    setEditingTaxRate(null);
    taxRateForm.reset();
  };
  
  // Restore handlers for deleted records
  const handleRestoreCustomer = (id: number) => {
    restoreCustomerMutation.mutate(id);
  };
  
  const handleRestoreDevice = (id: number) => {
    restoreDeviceMutation.mutate(id);
  };
  
  const handleRestoreRepair = (id: number) => {
    restoreRepairMutation.mutate(id);
  };
  
  const handleRestoreTechnician = (id: number) => {
    restoreTechnicianMutation.mutate(id);
  };
  
  const handleRestoreInventoryItem = (id: number) => {
    restoreInventoryItemMutation.mutate(id);
  };
  
  const handleRestoreQuote = (id: number) => {
    restoreQuoteMutation.mutate(id);
  };
  
  const handleRestoreInvoice = (id: number) => {
    restoreInvoiceMutation.mutate(id);
  };
  
  return (
    <div className="container mx-auto pt-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Configure application settings</p>
      </div>
      
      <Tabs defaultValue="currencies" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="tax-rates">Tax Rates</TabsTrigger>
          <TabsTrigger value="data-management">Data Management</TabsTrigger>
        </TabsList>
        
        {/* Currencies Tab */}
        <TabsContent value="currencies">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Currencies</CardTitle>
                <CardDescription>
                  Manage currencies for quotes and invoices
                </CardDescription>
              </div>
              <Dialog open={showCurrencyDialog} onOpenChange={setShowCurrencyDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingCurrency(null);
                    currencyForm.reset({
                      code: '',
                      name: '',
                      symbol: '',
                      isDefault: false,
                    });
                  }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Currency
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCurrency ? 'Edit Currency' : 'Add Currency'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCurrency
                        ? 'Update the currency details below'
                        : 'Enter currency details to add a new currency'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...currencyForm}>
                    <form onSubmit={currencyForm.handleSubmit(handleAddCurrency)} className="space-y-4">
                      <FormField
                        control={currencyForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency Code (3 letters)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="USD"
                                maxLength={3}
                                disabled={!!editingCurrency}
                              />
                            </FormControl>
                            <FormDescription>
                              ISO currency code (e.g., USD, EUR, GBP)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={currencyForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="US Dollar" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={currencyForm.control}
                        name="symbol"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Symbol</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="$" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={currencyForm.control}
                        name="isDefault"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Set as Default</FormLabel>
                              <FormDescription>
                                Make this the default currency system-wide
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
                      
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleCloseCurrencyDialog}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={
                            createCurrencyMutation.isPending || 
                            updateCurrencyMutation.isPending
                          }
                        >
                          {(createCurrencyMutation.isPending || updateCurrencyMutation.isPending) && (
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {editingCurrency ? 'Update' : 'Add'} Currency
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingCurrencies ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : currencies && currencies.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((currency: any) => (
                      <TableRow key={currency.code}>
                        <TableCell className="font-medium">{currency.code}</TableCell>
                        <TableCell>{currency.name}</TableCell>
                        <TableCell>{currency.symbol}</TableCell>
                        <TableCell>
                          {currency.isDefault && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Default
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCurrency(currency)}
                            >
                              Edit
                            </Button>
                            <AlertDialog 
                              open={deletingCurrencyCode === currency.code}
                              onOpenChange={(open) => {
                                if (!open) setDeletingCurrencyCode(null);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteCurrency(currency.code)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Currency</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this currency? This action cannot be undone.
                                    <br /><br />
                                    <strong>Note:</strong> You cannot delete a currency that is in use by quotes or invoices.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteCurrencyMutation.mutate(currency.code)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    {deleteCurrencyMutation.isPending && (
                                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No currencies found. Add one to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tax Rates Tab */}
        <TabsContent value="tax-rates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tax Rates</CardTitle>
                <CardDescription>
                  Manage tax rates for different regions
                </CardDescription>
              </div>
              <Dialog open={showTaxRateDialog} onOpenChange={setShowTaxRateDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTaxRate(null);
                    taxRateForm.reset({
                      countryCode: '',
                      regionCode: '',
                      name: '',
                      rate: 0,
                      isDefault: false,
                    });
                  }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Tax Rate
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTaxRate ? 'Edit Tax Rate' : 'Add Tax Rate'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTaxRate
                        ? 'Update the tax rate details below'
                        : 'Enter tax rate details to add a new tax rate'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...taxRateForm}>
                    <form onSubmit={taxRateForm.handleSubmit(handleAddTaxRate)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={taxRateForm.control}
                          name="countryCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country Code</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="US" maxLength={2} />
                              </FormControl>
                              <FormDescription>
                                ISO country code (e.g., US, GB)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={taxRateForm.control}
                          name="regionCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Region Code (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="CA" />
                              </FormControl>
                              <FormDescription>
                                State/province code
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={taxRateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Rate Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Sales Tax" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={taxRateForm.control}
                        name="rate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate (Decimal)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                placeholder="0.07"
                              />
                            </FormControl>
                            <FormDescription>
                              Enter as decimal (e.g., 0.07 for 7%)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={taxRateForm.control}
                        name="isDefault"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Set as Default</FormLabel>
                              <FormDescription>
                                Make this the default tax rate system-wide
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
                      
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleCloseTaxRateDialog}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={
                            createTaxRateMutation.isPending || 
                            updateTaxRateMutation.isPending
                          }
                        >
                          {(createTaxRateMutation.isPending || updateTaxRateMutation.isPending) && (
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {editingTaxRate ? 'Update' : 'Add'} Tax Rate
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingTaxRates ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : taxRates && taxRates.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxRates.map((taxRate: any) => (
                      <TableRow key={taxRate.id}>
                        <TableCell>{taxRate.countryCode}</TableCell>
                        <TableCell>{taxRate.regionCode || '-'}</TableCell>
                        <TableCell>{taxRate.name}</TableCell>
                        <TableCell>{(taxRate.rate * 100).toFixed(2)}%</TableCell>
                        <TableCell>
                          {taxRate.isDefault && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Default
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTaxRate(taxRate)}
                            >
                              Edit
                            </Button>
                            <AlertDialog 
                              open={deletingTaxRateId === taxRate.id}
                              onOpenChange={(open) => {
                                if (!open) setDeletingTaxRateId(null);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteTaxRate(taxRate.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Tax Rate</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this tax rate? This action cannot be undone.
                                    <br /><br />
                                    <strong>Note:</strong> You cannot delete a tax rate that is in use by quotes or invoices.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteTaxRateMutation.mutate(taxRate.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    {deleteTaxRateMutation.isPending && (
                                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No tax rates found. Add one to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Data Management Tab */}
        <TabsContent value="data-management">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Delete data from your system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-medium text-red-600 mb-2">
                  Delete All Data
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  This will permanently delete all customers, repairs, inventory items, quotes, and invoices from your system.
                  This action cannot be undone. Default tax rates and currencies will be preserved.
                </p>
                <AlertDialog open={showDeleteAllDataConfirm} onOpenChange={setShowDeleteAllDataConfirm}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          This action will permanently delete <strong>ALL</strong> of the following data:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Customers</li>
                          <li>Devices</li>
                          <li>Technicians</li>
                          <li>Repairs & all repair items</li>
                          <li>Quotes</li>
                          <li>Invoices</li>
                          <li>Inventory</li>
                        </ul>
                        <p className="text-red-600 font-semibold mt-2">
                          This action cannot be undone. This will permanently delete all your data.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => {
                          const deleteAllData = async () => {
                            try {
                              await apiRequest('DELETE', '/api/settings/delete-all-data');
                              toast({
                                title: "Success",
                                description: "All data has been deleted successfully",
                              });
                              
                              // Invalidate all queries to refresh the UI
                              queryClient.invalidateQueries();
                            } catch (error: any) {
                              console.error('Error deleting all data:', error);
                              toast({
                                title: "Error",
                                description: error.message || "Failed to delete all data",
                                variant: "destructive",
                              });
                            }
                          };
                          
                          deleteAllData();
                        }}
                      >
                        I understand, delete everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;