import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/repairs/status-badge";
import { RepairWithRelations } from "@/types";
import { repairStatuses } from "@shared/schema";
import { ArrowLeft, Pencil, Printer, Mail, CreditCard, Plus, Trash2 } from "lucide-react";
import { safeGet } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { printDocument, createQuoteDocument, createInvoiceDocument } from "@/lib/print-utils";
// Import our new components
import CustomerInformation from "@/components/repairs/customer-information";
import DeviceInformation from "@/components/repairs/device-information";
import RepairInformation from "@/components/repairs/repair-information";

export default function ViewRepair() {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  
  // Quote approval mutation
  const approveQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      return apiRequest("PUT", `/api/quotes/${quoteId}`, {
        status: "approved"
      });
    },
    onSuccess: async () => {
      toast({
        title: "Quote approved",
        description: "The quote has been approved successfully",
      });
      
      // Refresh data
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        refetchType: 'active'
      });
      
      await queryClient.refetchQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        exact: true
      });
    },
    onError: (error) => {
      console.error("Failed to approve quote:", error);
      toast({
        title: "Error",
        description: "Failed to approve the quote. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Get the tab from the URL query parameters if available
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(tabParam || "details");
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItemType, setDeleteItemType] = useState<'quote' | 'invoice' | 'repairItem' | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  
  // Parse the repair ID from the URL
  const repairId = parseInt(location.split('/').pop() || '0');
  
  // Get existing repair data
  const { 
    data: repair, 
    isLoading: isLoadingRepair,
    refetch: refetchRepair 
  } = useQuery<RepairWithRelations>({
    queryKey: [`/api/repairs/${repairId}/details`],
    enabled: !!repairId,
    staleTime: 0, // Consider data always stale to ensure fresh data
  });

  // Fetch repair items separately for better real-time updates
  const { 
    data: repairItems = [], 
    isLoading: isLoadingItems,
    refetch: refetchItems
  } = useQuery<any[]>({
    queryKey: [`/api/repairs/${repairId}/items`],
    enabled: !!repairId,
    staleTime: 0, // Consider data always stale to ensure fresh data
  });
  
  // Force refresh data when tab changes, especially for quotes/invoices tabs
  useEffect(() => {
    if (activeTab === 'quotes' || activeTab === 'invoice') {
      refetchRepair();
    }
  }, [activeTab, refetchRepair]);

  // Initialize the current status from the repair data
  useEffect(() => {
    if (repair && repair.status) {
      setCurrentStatus(repair.status);
    }
  }, [repair]);
  
  // Clean up the URL parameter after the tab is set
  useEffect(() => {
    if (tabParam) {
      // Update the URL to remove the tab parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', url.toString());
    }
  }, [tabParam]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      // Make sure repair exists
      if (!repair) return;
      
      // Don't update if it's already the current status
      if (currentStatus === newStatus) return;

      console.log(`Changing status from ${currentStatus} to ${newStatus}`);

      // Update the local state immediately for the UI
      setCurrentStatus(newStatus);
      
      // Make the API request
      await apiRequest("PUT", `/api/repairs/${repairId}`, {
        status: newStatus
      });

      // Invalidate and immediately refetch the queries to ensure UI updates
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/repairs"],
        refetchType: 'active' 
      });
      
      // Also invalidate the details query
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        refetchType: 'active'
      });
      
      toast({
        title: "Status updated",
        description: "The repair status has been updated successfully",
      });
    } catch (error) {
      console.error("Failed to update repair status:", error);
      
      // If the API call fails, revert the local state to the previous value
      if (repair && repair.status) {
        setCurrentStatus(repair.status);
      }
      
      toast({
        title: "Error",
        description: "Failed to update repair status",
        variant: "destructive",
      });
    }
  };

  // Print quote handler
  const handlePrintQuote = (quote: any) => {
    if (!repair || !repair.customer) return;
    
    try {
      const quoteDocument = createQuoteDocument(
        quote, 
        repair.customer, 
        repair, 
        repairItems || []
      );
      
      printDocument(quoteDocument);
      
      toast({
        title: "Print initiated",
        description: "Quote print preview has been opened"
      });
    } catch (error) {
      console.error("Error printing quote:", error);
      toast({
        title: "Print error",
        description: "Failed to generate print preview",
        variant: "destructive"
      });
    }
  };
  
  // Email quote handler
  const emailQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      return apiRequest("POST", `/api/quotes/${quoteId}/email`, {});
    },
    onSuccess: async () => {
      // Invalidate all related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      await queryClient.refetchQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: "Email sent",
        description: "Quote was successfully emailed to the customer",
      });
    },
    onError: (error: any) => {
      // Check if this is a configuration error
      if (error.response?.status === 400 && error.response?.data?.message?.includes("SENDGRID_API_KEY")) {
        toast({
          title: "Email configuration required",
          description: "SendGrid API key is not configured. Please set up email settings.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email error",
          description: "Failed to send quote email. Please try again.",
          variant: "destructive"
        });
      }
    }
  });
  
  // Print invoice handler
  const handlePrintInvoice = (invoice: any) => {
    if (!repair || !repair.customer) return;
    
    try {
      const invoiceDocument = createInvoiceDocument(
        invoice, 
        repair.customer, 
        repair, 
        repairItems || []
      );
      
      printDocument(invoiceDocument);
      
      toast({
        title: "Print initiated",
        description: "Invoice print preview has been opened"
      });
    } catch (error) {
      console.error("Error printing invoice:", error);
      toast({
        title: "Print error",
        description: "Failed to generate print preview",
        variant: "destructive"
      });
    }
  };
  
  // Email invoice handler
  const emailInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      return apiRequest("POST", `/api/invoices/${invoiceId}/email`, {});
    },
    onSuccess: async () => {
      // Invalidate all related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      await queryClient.refetchQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: "Email sent",
        description: "Invoice was successfully emailed to the customer",
      });
    },
    onError: (error: any) => {
      // Check if this is a configuration error
      if (error.response?.status === 400 && error.response?.data?.message?.includes("SENDGRID_API_KEY")) {
        toast({
          title: "Email configuration required",
          description: "SendGrid API key is not configured. Please set up email settings.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email error",
          description: "Failed to send invoice email. Please try again.",
          variant: "destructive"
        });
      }
    }
  });
  
  // Quote delete mutation
  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      return apiRequest("DELETE", `/api/quotes/${quoteId}`, {});
    },
    onSuccess: async () => {
      // Invalidate all related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      await queryClient.refetchQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: "Quote deleted",
        description: "Quote was successfully deleted",
      });
      
      // Reset delete state
      setShowDeleteConfirm(false);
      setDeleteItemType(null);
      setDeleteItemId(null);
    },
    onError: (error) => {
      console.error('Failed to delete quote:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote. Please try again.",
        variant: "destructive"
      });
      
      // Reset delete state
      setShowDeleteConfirm(false);
      setDeleteItemType(null);
      setDeleteItemId(null);
    }
  });
  
  // Invoice delete mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      return apiRequest("DELETE", `/api/invoices/${invoiceId}`, {});
    },
    onSuccess: async () => {
      // Invalidate all related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      await queryClient.refetchQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
      
      toast({
        title: "Invoice deleted",
        description: "Invoice was successfully deleted",
      });
      
      // Reset delete state
      setShowDeleteConfirm(false);
      setDeleteItemType(null);
      setDeleteItemId(null);
    },
    onError: (error) => {
      console.error('Failed to delete invoice:', error);
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive"
      });
      
      // Reset delete state
      setShowDeleteConfirm(false);
      setDeleteItemType(null);
      setDeleteItemId(null);
    }
  });
  
  // Repair Item delete mutation
  const deleteRepairItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("DELETE", `/api/repairs/${repairId}/items/${itemId}`, {});
    },
    onSuccess: async () => {
      // Invalidate the repair items query and refetch
      await queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/items`] });
      await queryClient.refetchQueries({ queryKey: [`/api/repairs/${repairId}/items`] });
      
      toast({
        title: "Item deleted",
        description: "Item was successfully removed from the repair",
      });
      
      // Reset delete state
      setShowDeleteConfirm(false);
      setDeleteItemType(null);
      setDeleteItemId(null);
    },
    onError: (error) => {
      console.error('Failed to delete repair item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item. Please try again.",
        variant: "destructive"
      });
      
      // Reset delete state
      setShowDeleteConfirm(false);
      setDeleteItemType(null);
      setDeleteItemId(null);
    }
  });
  
  const handleDeleteConfirm = () => {
    if (deleteItemType === 'quote' && deleteItemId) {
      deleteQuoteMutation.mutate(deleteItemId);
    } else if (deleteItemType === 'invoice' && deleteItemId) {
      deleteInvoiceMutation.mutate(deleteItemId);
    } else if (deleteItemType === 'repairItem' && deleteItemId) {
      deleteRepairItemMutation.mutate(deleteItemId);
    }
  };
  
  const handleApproveQuote = (quoteId: number) => {
    approveQuoteMutation.mutate(quoteId);
  };

  const handleEmailQuote = (quoteId: number) => {
    emailQuoteMutation.mutate(quoteId);
  };
  
  const handleEmailInvoice = (invoiceId: number) => {
    emailInvoiceMutation.mutate(invoiceId);
  };

  if (isLoadingRepair) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <Link to="/repairs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Repairs
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Loading...</h1>
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
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <Link to="/repairs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Repairs
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Error</h1>
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
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <Link to="/repairs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Repairs
          </Button>
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Repair #{repair.ticketNumber}</h1>
          <p className="text-sm text-gray-500">
            Created on {format(new Date(safeGet(repair, 'intakeDate', new Date())), "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/repairs/edit/${repairId}`}>
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </Link>
          <StatusBadge status={safeGet(repair, 'status', 'intake')} className="text-sm py-1 px-3" />
        </div>
      </div>
      
      {/* Tabs Navigation */}
      <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <div className="overflow-x-auto pb-2 -mx-2">
          <TabsList className="mb-4 w-auto inline-flex px-2">
            <TabsTrigger value="details" className="text-xs sm:text-sm">Details</TabsTrigger>
            <TabsTrigger value="parts" className="text-xs sm:text-sm">Parts & Services</TabsTrigger>
            <TabsTrigger value="quotes" className="text-xs sm:text-sm">Quote</TabsTrigger>
            <TabsTrigger value="invoice" className="text-xs sm:text-sm">Invoice</TabsTrigger>
          </TabsList>
        </div>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6 px-0 sm:px-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {safeGet(repair, 'customer', null) ? (
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
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No customer information available</p>
                </CardContent>
              </Card>
            )}
            
            {safeGet(repair, 'device', null) ? (
              <DeviceInformation 
                device={repair.device} 
                onDeviceUpdated={() => {
                  // Refresh repair details to reflect updated device info
                  queryClient.invalidateQueries({ 
                    queryKey: [`/api/repairs/${repairId}/details`],
                    refetchType: 'active'
                  });
                }}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Device Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No device information available</p>
                </CardContent>
              </Card>
            )}
          </div>

          <RepairInformation repair={repair} />
          
          <Card>
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
              <CardDescription>Change the current status of the repair</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {repairStatuses.map((status) => (
                  <Button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    variant={currentStatus === status ? "default" : "outline"}
                    size="sm"
                    className={currentStatus === status ? "" : "border-gray-300 text-gray-700 hover:bg-gray-50"}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parts and Services Tab */}
        <TabsContent value="parts" className="space-y-6 px-0 sm:px-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">Parts and Services</CardTitle>
              <Link to={`/repairs/${repairId}/items/add`}>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Item</span>
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {!isLoadingItems && repairItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairItems.map((item: any) => {
                      const itemTotal = parseFloat(item.unitPrice) * parseFloat(item.quantity);
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.itemType === 'part' ? 'Part' : 'Service'}
                          </TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(parseFloat(item.unitPrice))}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(itemTotal)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={item.isCompleted ? "default" : "outline"}>
                              {item.isCompleted ? "Complete" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link to={`/repairs/${repairId}/items/${item.id}/edit`}>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Allow navigation but prevent bubbling
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => {
                                  e.preventDefault(); // Prevent navigation
                                  setDeleteItemType('repairItem');
                                  setDeleteItemId(item.id);
                                  setShowDeleteConfirm(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No parts or services have been added yet.</p>
                  <Link to={`/repairs/${repairId}/items/add`}>
                    <Button variant="outline" className="mt-2">Add First Item</Button>
                  </Link>
                </div>
              )}
            </CardContent>
            {repairItems.length > 0 && (
              <CardFooter className="flex justify-between border-t p-4">
                <div></div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Items Total</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(
                      repairItems.reduce((sum: number, item: any) => 
                        sum + (parseFloat(item.unitPrice) * parseFloat(item.quantity)), 0)
                    )}
                  </p>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* Quotes Tab */}
        <TabsContent value="quotes" className="space-y-6 px-0 sm:px-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">Quotes</CardTitle>
              <Link to={`/repairs/${repairId}/quotes/create`}>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Quote</span>
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {(repair.quotes || []).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(repair.quotes || []).map((quote: any) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                        <TableCell>
                          {quote.createdAt ? format(new Date(quote.createdAt), "MMM d, yyyy") : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {quote.validUntil ? format(new Date(quote.validUntil), "MMM d, yyyy") : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {typeof quote.total === 'number' ? formatCurrency(quote.total) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={quote.status === 'approved' ? "default" : 
                                        quote.status === 'rejected' ? "destructive" : 
                                        "outline"}>
                            {quote.status === 'approved' 
                              ? 'Approved' 
                              : quote.status === 'rejected' 
                                ? 'Rejected' 
                                : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {/* Accept Quote Button */}
                            {quote.status !== 'approved' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={(e) => {
                                  e.preventDefault();  // Prevent navigation
                                  handleApproveQuote(quote.id);
                                }}
                                disabled={approveQuoteMutation.isPending}
                              >
                                Accept
                              </Button>
                            )}
                            
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.preventDefault();  // Prevent navigation
                                handlePrintQuote(quote);
                              }}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.preventDefault();  // Prevent navigation
                                handleEmailQuote(quote.id);
                              }}
                              disabled={emailQuoteMutation.isPending}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Link to={`/repairs/${repairId}/quotes/${quote.id}/edit`}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();  // Allow navigation but prevent bubbling
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.preventDefault(); // Prevent navigation
                                setDeleteItemType('quote');
                                setDeleteItemId(quote.id);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No quotes have been created yet.</p>
                  <Link to={`/repairs/${repairId}/quotes/create`}>
                    <Button variant="outline" className="mt-2">Create First Quote</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice Tab */}
        <TabsContent value="invoice" className="space-y-6 px-0 sm:px-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">Invoices</CardTitle>
              <Link to={`/repairs/${repairId}/invoices/create`}>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Invoice</span>
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {(repair.invoices || []).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(repair.invoices || []).map((invoice: any) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          {invoice.createdAt ? format(new Date(invoice.createdAt), "MMM d, yyyy") : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {typeof invoice.total === 'number' ? formatCurrency(invoice.total) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={invoice.status === 'paid' ? "default" : 
                                        invoice.status === 'cancelled' ? "destructive" : 
                                        "outline"}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.preventDefault();  // Prevent navigation
                                handlePrintInvoice(invoice);
                              }}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.preventDefault();  // Prevent navigation
                                handleEmailInvoice(invoice.id);
                              }}
                              disabled={emailInvoiceMutation.isPending}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            {invoice.status !== 'paid' && (
                              <Link to={`/repairs/${repairId}/invoices/${invoice.id}/pay`}>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Allow navigation but prevent bubbling
                                  }}
                                >
                                  <CreditCard className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            <Link to={`/repairs/${repairId}/invoices/${invoice.id}/edit`}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation(); // Allow navigation but prevent bubbling
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.preventDefault(); // Prevent navigation
                                setDeleteItemType('invoice');
                                setDeleteItemId(invoice.id);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No invoices have been created yet.</p>
                  <Link to={`/repairs/${repairId}/invoices/create`}>
                    <Button variant="outline" className="mt-2">Create First Invoice</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteItemType}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteItemType(null);
              setDeleteItemId(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}