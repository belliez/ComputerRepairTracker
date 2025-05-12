import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { RepairWithRelations } from "@/types";
import { Pencil, Plus, Trash2, Printer, Mail, CreditCard, Check, Calculator, FileText, Edit } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { printDocument, createQuoteDocument, createInvoiceDocument } from "@/lib/print-utils";
import { useCurrency } from "@/hooks/use-currency";
import CostEstimator from "./cost-estimator";
import { 
  AlertDialog,
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

// Define RepairItem interface if not already defined elsewhere
interface RepairItem {
  id: number;
  repairId: number;
  inventoryItemId: number | null;
  description: string;
  itemType: "part" | "service";
  unitPrice: number;
  quantity: number;
  isCompleted: boolean;
  inventoryItem?: {
    id: number;
    name: string;
    sku: string;
    description: string;
    unitPrice: number;
    quantityInStock: number;
  } | null;
}
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "./status-badge";
import QuoteForm from "./quote-form";
import InvoiceForm from "./invoice-form";
import IntakeForm from "./mobile-intake-form";
import RepairItemForm from "./repair-item-form";
import PaymentForm from "../payments/payment-form";

interface RepairDetailProps {
  repairId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function RepairDetail({ repairId, isOpen, onClose }: RepairDetailProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showRepairItemForm, setShowRepairItemForm] = useState(false);
  const [currentEditingItem, setCurrentEditingItem] = useState<any>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<number | undefined>(undefined);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | undefined>(undefined);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItemType, setDeleteItemType] = useState<"quote" | "invoice" | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCostEstimator, setShowCostEstimator] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: repair, isLoading: isLoadingRepair, refetch: refetchRepair } = useQuery<RepairWithRelations>({
    queryKey: [`/api/repairs/${repairId}/details`],
    staleTime: 0,
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Automatically refetch every 5 seconds when stale
    queryFn: async () => {
      console.log("REPAIR DETAIL DEBUG: Starting manual fetch for repair details");
      
      // Add organization ID header and other necessary headers
      const headers: Record<string, string> = {
        "X-Debug-Client": "RepairTrackerClient",
        "X-Organization-ID": "2", // Add organization ID header with fallback
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };
      
      // Add auth token if available 
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      console.log("REPAIR DETAIL DEBUG: Making fetch with headers:", headers);
      
      try {
        const response = await fetch(`/api/repairs/${repairId}/details`, { headers });
        console.log("REPAIR DETAIL DEBUG: Response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch repair details: ${response.status}`);
        }
        
        const text = await response.text();
        console.log("REPAIR DETAIL DEBUG: Response text:", text.substring(0, 100) + "...");
        
        const data = JSON.parse(text);
        console.log("REPAIR DETAIL DEBUG: Parsed repair data:", data);
        return data;
      } catch (err) {
        console.error("REPAIR DETAIL DEBUG: Error fetching repair details:", err);
        throw err;
      }
    }
  });

  // Fetch repair items separately for better real-time updates
  const { 
    data: repairItems, 
    isLoading: isLoadingItems,
    refetch: refetchRepairItems
  } = useQuery<RepairItem[]>({
    queryKey: [`/api/repairs/${repairId}/items`],
    enabled: !!repairId,
    staleTime: 0,
    queryFn: async () => {
      console.log("REPAIR DETAIL DEBUG: Starting manual fetch for repair items");
      
      // Add organization ID header and other necessary headers
      const headers: Record<string, string> = {
        "X-Debug-Client": "RepairTrackerClient",
        "X-Organization-ID": "2", // Add organization ID header with fallback
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };
      
      // Add auth token if available 
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      console.log("REPAIR DETAIL DEBUG: Making fetch for items with headers:", headers);
      
      try {
        const response = await fetch(`/api/repairs/${repairId}/items`, { headers });
        console.log("REPAIR DETAIL DEBUG: Items response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch repair items: ${response.status}`);
        }
        
        const text = await response.text();
        console.log("REPAIR DETAIL DEBUG: Items response text:", text.substring(0, 100) + "...");
        
        const data = JSON.parse(text);
        console.log("REPAIR DETAIL DEBUG: Parsed repair items data:", data);
        return data;
      } catch (err) {
        console.error("REPAIR DETAIL DEBUG: Error fetching repair items:", err);
        throw err;
      }
    }
  });
  
  // Debug log whenever repair items change
  useEffect(() => {
    console.log("Repair items updated:", repairItems);
  }, [repairItems]);
  
  // Initialize the current status from the repair data
  useEffect(() => {
    if (repair && repair.status) {
      setCurrentStatus(repair.status);
    }
  }, [repair]);
  
  // Safety function to check if nested properties exist
  const safeGet = (obj: any, path: string, defaultValue: any = null) => {
    try {
      const pathParts = path.split('.');
      let current = obj;
      for (const part of pathParts) {
        if (current === null || current === undefined) return defaultValue;
        current = current[part];
      }
      return current === undefined ? defaultValue : current;
    } catch (error) {
      console.error(`Error accessing path ${path}:`, error);
      return defaultValue;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      // Make sure repair exists
      if (!repair) return;
      
      // Don't update if it's already the current status
      if (currentStatus === newStatus) return;

      console.log(`Changing status from ${currentStatus} to ${newStatus}`);

      // Update the local state immediately for the UI
      setCurrentStatus(newStatus);
      
      // Convert status from button UI format to database format if needed
      let statusValue = newStatus;
      
      // Convert hyphenated status values to underscore format for database
      if (newStatus === 'in-repair') {
        statusValue = 'in_repair';
      } else if (newStatus === 'ready-for-pickup') {
        statusValue = 'ready_for_pickup';
      } else if (newStatus === 'on-hold') {
        statusValue = 'on_hold';
      } else if (newStatus === 'awaiting-approval') {
        statusValue = 'awaiting_approval';
      } else if (newStatus === 'parts-ordered') {
        statusValue = 'parts_ordered';
      }
      
      console.log(`STATUS UPDATE DEBUG: Converting status from "${newStatus}" to "${statusValue}"`);
      
      // Prepare update data
      const updateData: any = {
        status: statusValue
      };
      
      // If the status is changing to 'completed', reset the priority level to normal (3)
      if (newStatus === 'completed') {
        updateData.priorityLevel = 3;
        console.log('Resetting priority level to normal as repair is completed');
      }
      
      // Make the API request
      await apiRequest("PUT", `/api/repairs/${repairId}`, updateData);

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
      
      // Force refetch the details query to update the UI
      await queryClient.refetchQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        exact: true
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
      
      // Force refresh the data
      await queryClient.refetchQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        exact: true 
      });
      
      toast({
        title: "Error",
        description: "Failed to update repair status",
        variant: "destructive",
      });
    }
  };

  const handleCreateQuote = () => {
    console.log("DEBUG: handleCreateQuote called, setting showQuoteForm to true");
    
    // First clear any existing quote ID
    setEditingQuoteId(undefined);
    
    // Then set the form to show with a small delay to ensure state updates properly
    setTimeout(() => {
      setShowQuoteForm(true);
      console.log("DEBUG: showQuoteForm state set to true");
    }, 50);
  };

  const handleEditQuote = (quoteId: number) => {
    console.log("DEBUG: handleEditQuote called with quoteId:", quoteId);
    
    // First set the quote ID
    setEditingQuoteId(quoteId);
    
    // Then set the form to show with a small delay to ensure state updates properly
    setTimeout(() => {
      setShowQuoteForm(true);
      console.log("DEBUG: Edit quote - showQuoteForm state set to true");
    }, 50);
  };

  const handleDeleteQuote = (quoteId: number) => {
    setDeleteItemType("quote");
    setDeleteItemId(quoteId);
    setShowDeleteDialog(true);
  };
  
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
  
  const handleApproveQuote = (quoteId: number) => {
    approveQuoteMutation.mutate(quoteId);
  };
  
  const handleConvertToInvoice = (quoteId: number) => {
    // Find the quote by ID
    const quote = repair?.quotes?.find(q => q.id === quoteId);
    if (!quote) {
      toast({
        title: "Error",
        description: "Could not find quote to convert",
        variant: "destructive"
      });
      return;
    }
    
    // Set the active tab to invoice
    setActiveTab("invoice");
    
    // Show the invoice form with pre-populated data from the quote
    setEditingInvoiceId(undefined); // This is a new invoice, not editing
    
    // Store the quote ID in session storage to be used when the invoice form opens
    sessionStorage.setItem('convertFromQuoteId', quoteId.toString());
    
    setShowInvoiceForm(true);
    
    toast({
      title: "Converting to Invoice",
      description: "Create the invoice with pre-filled data from the quote"
    });
  };

  const handleCreateInvoice = () => {
    setEditingInvoiceId(undefined);
    setShowInvoiceForm(true);
  };
  
  const handleEditInvoice = (invoiceId: number) => {
    setEditingInvoiceId(invoiceId);
    setShowInvoiceForm(true);
  };

  const handleDeleteInvoice = (invoiceId: number) => {
    setDeleteItemType("invoice");
    setDeleteItemId(invoiceId);
    setShowDeleteDialog(true);
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
    onSuccess: () => {
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
  
  const handleEmailQuote = (quoteId: number) => {
    emailQuoteMutation.mutate(quoteId);
  };
  
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
    onSuccess: () => {
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
  
  const handleEmailInvoice = (invoiceId: number) => {
    emailInvoiceMutation.mutate(invoiceId);
  };
  
  const handleConfirmDelete = async () => {
    if (!deleteItemId || !deleteItemType) return;
    
    try {
      if (deleteItemType === "quote") {
        await apiRequest("DELETE", `/api/quotes/${deleteItemId}`, {});
        toast({
          title: "Quote deleted",
          description: "The quote has been deleted successfully"
        });
      } else if (deleteItemType === "invoice") {
        await apiRequest("DELETE", `/api/invoices/${deleteItemId}`, {});
        toast({
          title: "Invoice deleted",
          description: "The invoice has been deleted successfully"
        });
      }
      
      // Refresh data
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        refetchType: 'active'
      });
      
      await queryClient.refetchQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        exact: true
      });
    } catch (error) {
      console.error(`Failed to delete ${deleteItemType}:`, error);
      toast({
        title: "Error",
        description: `Failed to delete the ${deleteItemType}`,
        variant: "destructive"
      });
    } finally {
      setShowDeleteDialog(false);
      setDeleteItemId(null);
      setDeleteItemType(null);
    }
  };

  const handleEditRepair = () => {
    console.log("Editing repair:", repair);
    setShowEditForm(true);
  };
  
  const handleShowCostEstimator = () => {
    setShowCostEstimator(true);
  };
  
  const handleAddRepairItem = () => {
    setCurrentEditingItem(null);
    setShowRepairItemForm(true);
  };
  
  const handleEditRepairItem = (item: any) => {
    console.log("Editing repair item:", item);
    // Make sure we have all required properties for editing
    const itemToEdit = {
      id: item.id,
      description: item.description,
      itemType: item.itemType,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      isCompleted: item.isCompleted,
      inventoryItemId: item.inventoryItemId || null,
      // Include any other properties needed for the form
    };
    console.log("Prepared item for editing:", itemToEdit);
    setCurrentEditingItem(itemToEdit);
    setShowRepairItemForm(true);
  };
  
  const handleDeleteRepairItem = async (itemId: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    try {
      await apiRequest("DELETE", `/api/repairs/${repairId}/items/${itemId}`, {});
      
      toast({
        title: "Item deleted",
        description: "The item has been removed from the repair",
      });
      
      console.log("Deleting item, preparing to update UI...");
      
      // Update local state to remove the item immediately for optimistic UI
      if (repairItems) {
        const updatedItems = repairItems.filter(item => item.id !== itemId);
        console.log("Filtered items after delete:", updatedItems);
      }

      // Explicitly refetch repair items to update the UI
      await refetchRepairItems();
      console.log("Repair items explicitly refetched after delete");
      
      // Also invalidate and refetch the repair details
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        refetchType: 'active'
      });
      
      await queryClient.refetchQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        exact: true
      });
    } catch (error) {
      console.error("Failed to delete repair item:", error);
      toast({
        title: "Error",
        description: "Failed to delete the repair item",
        variant: "destructive",
      });
    }
  };
  
  // Payment handlers
  const handleOnlinePayment = (invoice: any) => {
    setCurrentInvoice(invoice);
    setShowPaymentForm(true);
  };
  
  const markAsPaidMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      return apiRequest("POST", `/api/invoices/${invoiceId}/pay`, {
        paymentMethod: "in_person",
        paymentDate: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast({
        title: "Payment recorded",
        description: "Invoice has been marked as paid",
      });
      
      // Refresh data
      queryClient.invalidateQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        refetchType: 'active'
      });
      
      queryClient.refetchQueries({ 
        queryKey: [`/api/repairs/${repairId}/details`],
        exact: true
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark invoice as paid",
        variant: "destructive"
      });
    }
  });
  
  const handleMarkAsPaid = (invoiceId: number) => {
    if (confirm('Are you sure you want to mark this invoice as paid?')) {
      markAsPaidMutation.mutate(invoiceId);
    }
  };

  const isLoading = isLoadingRepair || isLoadingItems;
  
  // Log loading states and repair data to help debug
  useEffect(() => {
    console.log("REPAIR DETAIL DEBUG: Loading state:", { isLoadingRepair, isLoadingItems, repairId });
    console.log("REPAIR DETAIL DEBUG: Current repair data:", repair);
  }, [isLoadingRepair, isLoadingItems, repair, repairId]);
  
  // If loading for more than 10 seconds, try to refresh the data
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.log("REPAIR DETAIL DEBUG: Loading timeout reached, forcing refresh");
        queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
        queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/items`] });
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, repairId, queryClient]);
  
  // Custom fetch function to directly fetch repair details if needed
  const fetchRepairManually = useCallback(async () => {
    try {
      console.log("REPAIR DETAIL DEBUG: Manually fetching repair details");
      const headers: Record<string, string> = {
        "X-Debug-Client": "RepairTrackerClient",
        "X-Organization-ID": "2",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };
      
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/repairs/${repairId}/details`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch repair details: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("REPAIR DETAIL DEBUG: Manual fetch succeeded:", data);
      queryClient.setQueryData([`/api/repairs/${repairId}/details`], data);
      return data;
    } catch (err) {
      console.error("REPAIR DETAIL DEBUG: Manual fetch failed:", err);
      return null;
    }
  }, [repairId, queryClient]);
  
  // If we've been loading for more than 5 seconds, try a manual fetch
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        fetchRepairManually();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, fetchRepairManually]);
  
  // Check if we're loading or if repair data is incomplete
  if (isLoading || !repair || Object.keys(repair).length === 0) {
    console.log("REPAIR DETAIL DEBUG: Showing loading screen, repair data:", repair);
    
    // Determine if this is a loading state or a not-found state
    const isLoadingState = isLoading;
    const isNotFoundState = !isLoading && (!repair || Object.keys(repair).length === 0);
    
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          {isLoadingState ? (
            // Show loading spinner if we're still loading
            <div className="flex flex-col justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
              <div className="text-center">
                <p className="text-gray-500">Loading repair details...</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    console.log("REPAIR DETAIL DEBUG: Manual refresh requested");
                    fetchRepairManually();
                    // Also refetch using react-query's mechanisms
                    refetchRepair();
                    refetchRepairItems?.();
                  }}
                >
                  Refresh Data
                </Button>
              </div>
            </div>
          ) : (
            // Show error message if repair not found or empty
            <>
              <DialogHeader>
                <DialogTitle>Error</DialogTitle>
                <DialogDescription>
                  Could not find repair details. The repair may have been deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={onClose}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // We've already handled the !repair case in the condition above

  // Allow creating quotes regardless of status (for development purposes)
  const canCreateQuote = !repair.quote || true;
  
  // Allow creating invoices regardless of status (for development purposes)
  const canCreateInvoice = !repair.invoice || true;
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-2 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <DialogTitle className="text-xl sm:text-2xl">
                  Repair #{safeGet(repair, 'ticketNumber', '')}
                </DialogTitle>
                <DialogDescription>
                  Created on {format(new Date(safeGet(repair, 'intakeDate', new Date())), "MMMM d, yyyy")}
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/repairs/edit/${repairId}`}>
                  <Button 
                    variant="default" 
                    size="sm"
                    className="flex items-center"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleShowCostEstimator}
                  className="flex items-center"
                >
                  <Calculator className="h-4 w-4 mr-1" />
                  Cost Estimator
                </Button>
                <StatusBadge status={safeGet(repair, 'status', 'intake')} className="text-sm py-1 px-3" />
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
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
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {safeGet(repair, 'customer', null) ? (
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium">Name:</span> {safeGet(repair, 'customer.firstName', '')} {safeGet(repair, 'customer.lastName', '')}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {safeGet(repair, 'customer.email', 'N/A')}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {safeGet(repair, 'customer.phone', 'N/A')}
                        </div>
                        {safeGet(repair, 'customer.address', false) && (
                          <div>
                            <span className="font-medium">Address:</span> {safeGet(repair, 'customer.address', '')}, 
                            {safeGet(repair, 'customer.city', '')}, 
                            {safeGet(repair, 'customer.state', '')} 
                            {safeGet(repair, 'customer.postalCode', '')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500">Customer information not available</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Device Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {safeGet(repair, 'deviceId') === null ? (
                      <div className="text-gray-500">No device associated with this repair</div>
                    ) : safeGet(repair, 'device', null) ? (
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium">Type:</span> {safeGet(repair, 'device.type', 'N/A')}
                        </div>
                        <div>
                          <span className="font-medium">Brand/Model:</span> {safeGet(repair, 'device.brand', '')} {safeGet(repair, 'device.model', '')}
                        </div>
                        {safeGet(repair, 'device.serialNumber', '') && (
                          <div>
                            <span className="font-medium">Serial Number:</span> {safeGet(repair, 'device.serialNumber', '')}
                          </div>
                        )}
                        {safeGet(repair, 'device.password', '') && (
                          <div>
                            <span className="font-medium">Password:</span> {safeGet(repair, 'device.password', '')}
                          </div>
                        )}
                        {safeGet(repair, 'device.condition', '') && (
                          <div>
                            <span className="font-medium">Condition:</span> {safeGet(repair, 'device.condition', '')}
                          </div>
                        )}
                        {safeGet(repair, 'device.accessories', '') && (
                          <div>
                            <span className="font-medium">Accessories:</span> {safeGet(repair, 'device.accessories', '')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500">Device information not available</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Repair Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Issue</h4>
                      <p className="text-gray-700">{safeGet(repair, 'issue', 'No issue description')}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium">Priority</h4>
                      <div className="mt-1">
                        <Badge className={
                          safeGet(repair, 'priorityLevel', 3) === 1 ? "bg-red-100 text-red-800 border-red-300" :
                          safeGet(repair, 'priorityLevel', 3) === 2 ? "bg-orange-100 text-orange-800 border-orange-300" :
                          safeGet(repair, 'priorityLevel', 3) === 3 ? "bg-gray-100 text-gray-800 border-gray-300" :
                          safeGet(repair, 'priorityLevel', 3) === 4 ? "bg-blue-100 text-blue-800 border-blue-300" :
                          "bg-green-100 text-green-800 border-green-300"
                        }>
                          {safeGet(repair, 'priorityLevel', 3) === 1 ? "Critical" :
                           safeGet(repair, 'priorityLevel', 3) === 2 ? "High" :
                           safeGet(repair, 'priorityLevel', 3) === 3 ? "Normal" :
                           safeGet(repair, 'priorityLevel', 3) === 4 ? "Low" :
                           "Lowest"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Intake Date</h4>
                      <p className="text-gray-700">
                        {format(new Date(safeGet(repair, 'intakeDate', new Date())), "MMMM d, yyyy")}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium">Estimated Completion</h4>
                      <p className="text-gray-700">
                        {safeGet(repair, 'estimatedCompletionDate', null)
                          ? format(new Date(safeGet(repair, 'estimatedCompletionDate', new Date())), "MMMM d, yyyy")
                          : "Not specified"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Assigned Technician</h4>
                      <p className="text-gray-700">
                        {safeGet(repair, 'technician', null)
                          ? `${safeGet(repair, 'technician.firstName', '')} ${safeGet(repair, 'technician.lastName', '')} (${safeGet(repair, 'technician.role', '')})`
                          : "Unassigned"}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium">Warranty</h4>
                      <p className="text-gray-700">
                        {safeGet(repair, 'isUnderWarranty', false) ? "Yes - Under Warranty" : "No - Not Under Warranty"}
                      </p>
                    </div>
                  </div>

                  {safeGet(repair, 'diagnosticNotes', '') && (
                    <div>
                      <h4 className="font-medium">Diagnostic Notes</h4>
                      <p className="text-gray-700">{safeGet(repair, 'diagnosticNotes', '')}</p>
                    </div>
                  )}

                  {safeGet(repair, 'notes', '') && (
                    <div>
                      <h4 className="font-medium">Additional Notes</h4>
                      <p className="text-gray-700">{safeGet(repair, 'notes', '')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Update Status</CardTitle>
                  <CardDescription>
                    Change the current status of this repair
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant={currentStatus === "intake" ? "default" : "outline"}
                      onClick={() => handleStatusChange("intake")}
                      className={currentStatus === "intake" ? "" : "border-yellow-300 text-yellow-700 hover:bg-yellow-50"}
                    >
                      <i className="fas fa-clipboard-list mr-1"></i> Intake
                    </Button>
                    <Button 
                      variant={currentStatus === "diagnosing" ? "default" : "outline"}
                      onClick={() => handleStatusChange("diagnosing")}
                      className={currentStatus === "diagnosing" ? "" : "border-blue-300 text-blue-700 hover:bg-blue-50"}
                    >
                      <i className="fas fa-search mr-1"></i> Diagnosing
                    </Button>
                    <Button 
                      variant={currentStatus === "awaiting_approval" ? "default" : "outline"}
                      onClick={() => handleStatusChange("awaiting_approval")}
                      className={currentStatus === "awaiting_approval" ? "" : "border-purple-300 text-purple-700 hover:bg-purple-50"}
                    >
                      <i className="fas fa-clock mr-1"></i> Awaiting Approval
                    </Button>
                    <Button 
                      variant={currentStatus === "parts_ordered" ? "default" : "outline"}
                      onClick={() => handleStatusChange("parts_ordered")}
                      className={currentStatus === "parts_ordered" ? "" : "border-blue-300 text-blue-700 hover:bg-blue-50"}
                    >
                      <i className="fas fa-box mr-1"></i> Parts Ordered
                    </Button>
                    <Button 
                      variant={currentStatus === "in_repair" ? "default" : "outline"}
                      onClick={() => handleStatusChange("in_repair")}
                      className={currentStatus === "in_repair" ? "" : "border-orange-300 text-orange-700 hover:bg-orange-50"}
                    >
                      <i className="fas fa-wrench mr-1"></i> In Repair
                    </Button>
                    <Button 
                      variant={currentStatus === "ready_for_pickup" ? "default" : "outline"}
                      onClick={() => handleStatusChange("ready_for_pickup")}
                      className={currentStatus === "ready_for_pickup" ? "" : "border-green-300 text-green-700 hover:bg-green-50"}
                    >
                      <i className="fas fa-check-circle mr-1"></i> Ready for Pickup
                    </Button>
                    <Button 
                      variant={currentStatus === "completed" ? "default" : "outline"}
                      onClick={() => handleStatusChange("completed")}
                      className={currentStatus === "completed" ? "" : "border-gray-300 text-gray-700 hover:bg-gray-50"}
                    >
                      <i className="fas fa-check mr-1"></i> Completed
                    </Button>
                    <Button 
                      variant={currentStatus === "on_hold" ? "default" : "outline"}
                      onClick={() => handleStatusChange("on_hold")}
                      className={currentStatus === "on_hold" ? "" : "border-red-300 text-red-700 hover:bg-red-50"}
                    >
                      <i className="fas fa-pause mr-1"></i> On Hold
                    </Button>
                    <Button 
                      variant={currentStatus === "cancelled" ? "default" : "outline"}
                      onClick={() => handleStatusChange("cancelled")}
                      className={currentStatus === "cancelled" ? "" : "border-red-300 text-red-700 hover:bg-red-50"}
                    >
                      <i className="fas fa-times-circle mr-1"></i> Cancelled
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Parts & Services Tab */}
            <TabsContent value="parts" className="px-0 sm:px-2">
              <Card>
                <CardHeader>
                  <CardTitle>Parts & Services</CardTitle>
                  <CardDescription>
                    Parts and services included in this repair
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {repairItems && repairItems.length > 0 ? (
                    <div className="overflow-auto">
                      {/* Mobile view (cards) */}
                      <div className="md:hidden space-y-4">
                        {repairItems.map((item) => (
                          <div key={item.id} className="border rounded-lg p-4 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{item.description}</div>
                                {item.inventoryItem && (
                                  <div className="text-xs text-gray-500">
                                    SKU: {item.inventoryItem.sku}
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className={
                                item.itemType === "part" 
                                  ? "bg-blue-100 text-blue-800 border-blue-300" 
                                  : "bg-purple-100 text-purple-800 border-purple-300"
                              }>
                                {item.itemType === "part" ? "Part" : "Service"}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">Price:</span> ${item.unitPrice.toFixed(2)}
                              </div>
                              <div>
                                <span className="text-gray-500">Quantity:</span> {item.quantity}
                              </div>
                              <div>
                                <span className="text-gray-500">Total:</span> ${(item.unitPrice * item.quantity).toFixed(2)}
                              </div>
                              <div>
                                <Badge variant="outline" className={
                                  item.isCompleted
                                    ? "bg-green-100 text-green-800 border-green-300"
                                    : "bg-yellow-100 text-yellow-800 border-yellow-300"
                                }>
                                  {item.isCompleted ? "Completed" : "Pending"}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="flex justify-end gap-2 pt-2">
                              <Button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleEditRepairItem(item);
                                }} 
                                variant="ghost" 
                                size="sm"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteRepairItem(item.id);
                                }} 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Desktop view (table) */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <TableHead className="text-right">Quantity</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {repairItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.description}
                                  {item.inventoryItem && (
                                    <div className="text-xs text-gray-500">
                                      SKU: {item.inventoryItem.sku}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={
                                    item.itemType === "part" 
                                      ? "bg-blue-100 text-blue-800 border-blue-300" 
                                      : "bg-purple-100 text-purple-800 border-purple-300"
                                  }>
                                    {item.itemType === "part" ? "Part" : "Service"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">${(item.unitPrice * item.quantity).toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={
                                    item.isCompleted
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : "bg-yellow-100 text-yellow-800 border-yellow-300"
                                  }>
                                    {item.isCompleted ? "Completed" : "Pending"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleEditRepairItem(item);
                                      }} 
                                      variant="ghost" 
                                      size="icon"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteRepairItem(item.id);
                                      }} 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <i className="fas fa-tools text-4xl"></i>
                      </div>
                      <h3 className="text-lg font-medium text-gray-700">No parts or services added yet</h3>
                      <p className="text-gray-500 mt-1">
                        Parts and services will appear here once they are added to the repair
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div>
                    {repairItems && repairItems.length > 0 && (
                      <div className="text-right font-medium">
                        Total: ${repairItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleAddRepairItem}>
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Quotes Tab */}
            <TabsContent value="quotes" className="px-0 sm:px-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Quotes</CardTitle>
                    <CardDescription>
                      Quote details for customer approval
                    </CardDescription>
                  </div>
                  {canCreateQuote && (
                    <Button onClick={handleCreateQuote} className="ml-auto">
                      <Plus className="h-4 w-4 mr-1" /> New Quote
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {repair.quotes && repair.quotes.length > 0 ? (
                    <div className="space-y-8">
                      {repair.quotes.map((quote, index) => (
                        <div key={quote.id} className="space-y-4">
                          {index > 0 && <Separator className="my-6" />}
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-xl font-medium">Quote #{quote.quoteNumber}</div>
                              <div className="text-sm text-gray-500">
                                Created on {format(new Date(quote.dateCreated), "MMMM d, yyyy")}
                              </div>
                              {quote.expirationDate && (
                                <div className="text-sm text-gray-500">
                                  Expires on {format(new Date(quote.expirationDate), "MMMM d, yyyy")}
                                </div>
                              )}
                            </div>
                            <Badge className={
                              quote.status === "approved" 
                                ? "bg-green-100 text-green-800 border-green-300" 
                                : quote.status === "rejected"
                                  ? "bg-red-100 text-red-800 border-red-300"
                                  : "bg-yellow-100 text-yellow-800 border-yellow-300"
                            }>
                              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                            </Badge>
                            {quote.status === "pending" && (
                              <Button 
                                variant="outline"
                                className="ml-2 bg-green-50 text-green-600 hover:bg-green-100"
                                onClick={() => handleApproveQuote(quote.id)}
                              >
                                <Check className="h-4 w-4 mr-1" /> Accept Quote
                              </Button>
                            )}
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-gray-500">Subtotal</div>
                              <div className="text-lg">${quote.subtotal.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-500">Tax</div>
                              <div className="text-lg">${quote.tax?.toFixed(2) || "0.00"}</div>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-medium text-gray-500">Total</div>
                            <div className="text-2xl font-bold">${quote.total.toFixed(2)}</div>
                          </div>

                          {quote.notes && (
                            <div>
                              <div className="text-sm font-medium text-gray-500">Notes</div>
                              <div className="text-gray-700">{quote.notes}</div>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button 
                              variant="outline"
                              onClick={() => handlePrintQuote(quote)}
                              disabled={emailQuoteMutation.isPending}
                            >
                              <Printer className="h-4 w-4 mr-1" /> Print Quote
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => handleEmailQuote(quote.id)}
                              disabled={emailQuoteMutation.isPending}
                            >
                              {emailQuoteMutation.isPending && quote.id === emailQuoteMutation.variables ? (
                                <span className="flex items-center">
                                  <div className="animate-spin h-4 w-4 mr-1 border-2 border-t-transparent rounded-full"></div>
                                  Sending...
                                </span>
                              ) : (
                                <>
                                  <Mail className="h-4 w-4 mr-1" /> Email to Customer
                                </>
                              )}
                            </Button>
                            <Button 
                              variant="outline" 
                              className="text-blue-500 hover:text-blue-700"
                              onClick={() => handleEditQuote(quote.id)}
                            >
                              <Pencil className="h-4 w-4 mr-1" /> Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteQuote(quote.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </Button>
                            {quote.status === "approved" && (
                              <Button 
                                variant="outline"
                                className="text-green-500 hover:text-green-700"
                                onClick={() => handleConvertToInvoice(quote.id)}
                              >
                                <FileText className="h-4 w-4 mr-1" /> Convert to Invoice
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <i className="fas fa-file-invoice-dollar text-4xl"></i>
                      </div>
                      <h3 className="text-lg font-medium text-gray-700">No quote created yet</h3>
                      <p className="text-gray-500 mt-1">
                        Create a quote to send to the customer for approval
                      </p>
                      <Button 
                        className="mt-4" 
                        onClick={(e) => {
                          console.log("DEBUG: Create Quote button clicked!");
                          e.preventDefault();
                          handleCreateQuote();
                        }}
                        disabled={!canCreateQuote}
                      >
                        <i className="fas fa-plus mr-1"></i> Create Quote
                      </Button>
                      {!canCreateQuote && (
                        <p className="text-xs text-gray-500 mt-2">
                          Quotes can only be created when repair is in diagnosing or awaiting approval status
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoice Tab */}
            <TabsContent value="invoice" className="px-0 sm:px-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>
                      Invoice and payment information
                    </CardDescription>
                  </div>
                  {canCreateInvoice && (
                    <Button onClick={handleCreateInvoice} className="ml-auto">
                      <Plus className="h-4 w-4 mr-1" /> New Invoice
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {repair.invoices && repair.invoices.length > 0 ? (
                    <div className="space-y-8">
                      {repair.invoices.map((invoice, index) => (
                        <div key={invoice.id} className="space-y-4">
                          {index > 0 && <Separator className="my-6" />}
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-xl font-medium">Invoice #{invoice.invoiceNumber}</div>
                              <div className="text-sm text-gray-500">
                                Issued on {format(new Date(invoice.dateIssued), "MMMM d, yyyy")}
                              </div>
                              {invoice.datePaid && (
                                <div className="text-sm text-gray-500">
                                  Paid on {format(new Date(invoice.datePaid), "MMMM d, yyyy")}
                                </div>
                              )}
                            </div>
                            <Badge className={
                              invoice.status === "paid" 
                                ? "bg-green-100 text-green-800 border-green-300" 
                                : invoice.status === "partial"
                                  ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                  : "bg-red-100 text-red-800 border-red-300"
                            }>
                              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </Badge>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-gray-500">Subtotal</div>
                              <div className="text-lg">${invoice.subtotal.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-500">Tax</div>
                              <div className="text-lg">${invoice.tax?.toFixed(2) || "0.00"}</div>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-medium text-gray-500">Total</div>
                            <div className="text-2xl font-bold">${invoice.total.toFixed(2)}</div>
                          </div>

                          {invoice.paymentMethod && invoice.paymentMethod !== 'none' && (
                            <div>
                              <div className="text-sm font-medium text-gray-500">Payment Method</div>
                              <div className="text-gray-700">{invoice.paymentMethod}</div>
                            </div>
                          )}

                          {invoice.notes && (
                            <div>
                              <div className="text-sm font-medium text-gray-500">Notes</div>
                              <div className="text-gray-700">{invoice.notes}</div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button 
                              variant="outline"
                              onClick={() => handlePrintInvoice(invoice)}
                              disabled={emailInvoiceMutation.isPending}
                            >
                              <Printer className="h-4 w-4 mr-1" /> Print Invoice
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => handleEmailInvoice(invoice.id)}
                              disabled={emailInvoiceMutation.isPending}
                            >
                              {emailInvoiceMutation.isPending && invoice.id === emailInvoiceMutation.variables ? (
                                <span className="flex items-center">
                                  <div className="animate-spin h-4 w-4 mr-1 border-2 border-t-transparent rounded-full"></div>
                                  Sending...
                                </span>
                              ) : (
                                <>
                                  <Mail className="h-4 w-4 mr-1" /> Email to Customer
                                </>
                              )}
                            </Button>
                            {invoice.status !== "paid" && (
                              <>
                                <Button
                                  onClick={() => handleOnlinePayment(invoice)}
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CreditCard className="h-4 w-4 mr-1" /> Pay Online
                                </Button>
                                <Button
                                  onClick={() => handleMarkAsPaid(invoice.id)}
                                >
                                  <Check className="h-4 w-4 mr-1" /> Mark as Paid
                                </Button>
                              </>
                            )}
                            <Button 
                              variant="outline" 
                              className="text-blue-500 hover:text-blue-700"
                              onClick={() => handleEditInvoice(invoice.id)}
                            >
                              <Pencil className="h-4 w-4 mr-1" /> Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteInvoice(invoice.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <i className="fas fa-file-invoice text-4xl"></i>
                      </div>
                      <h3 className="text-lg font-medium text-gray-700">No invoice created yet</h3>
                      <p className="text-gray-500 mt-1">
                        Create an invoice when the repair is ready for payment
                      </p>
                      <Button 
                        className="mt-4" 
                        onClick={handleCreateInvoice}
                        disabled={!canCreateInvoice}
                      >
                        <i className="fas fa-plus mr-1"></i> Create Invoice
                      </Button>
                      {!canCreateInvoice && (
                        <p className="text-xs text-gray-500 mt-2">
                          Invoices can only be created when repair is ready for pickup or completed
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quote Form */}
      {console.log("DEBUG: Quote form condition, showQuoteForm =", showQuoteForm)}
      {showQuoteForm && (
        <>
        {console.log("DEBUG: Rendering QuoteForm component")}
        <QuoteForm 
          repairId={repairId}
          quoteId={editingQuoteId}
          isOpen={showQuoteForm}
          onClose={() => {
            console.log("DEBUG: Quote form closing");
            setShowQuoteForm(false);
            setEditingQuoteId(undefined);
            // Refresh the repair data
            queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
            // Set the active tab to quotes
            setActiveTab("quotes");
          }}
        />
        </>
      )}

      {/* Invoice Form */}
      {showInvoiceForm && (
        <InvoiceForm 
          repairId={repairId}
          invoiceId={editingInvoiceId}
          isOpen={showInvoiceForm}
          onClose={() => {
            setShowInvoiceForm(false);
            setEditingInvoiceId(undefined);
            // Refresh the repair data
            queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
            // Set the active tab to invoice
            setActiveTab("invoice");
          }}
        />
      )}

      {/* Edit Repair Form */}
      {showEditForm && (
        <IntakeForm 
          repairId={repairId}
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false);
            // Refresh the repair data
            queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
          }}
        />
      )}

      {/* Repair Item Form */}
      {showRepairItemForm && (
        <RepairItemForm
          repairId={repairId}
          isOpen={showRepairItemForm}
          existingItem={currentEditingItem}
          onClose={() => {
            setShowRepairItemForm(false);
            setCurrentEditingItem(null);
            
            // Explicitly refetch the repair items when the form closes
            console.log("Manually refetching repair items after form close");
            refetchRepairItems();
            
            // Also refetch the repair details
            queryClient.refetchQueries({ 
              queryKey: [`/api/repairs/${repairId}/details`],
              exact: true
            });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md p-3 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteItemType}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Payment Form Dialog */}
      {showPaymentForm && currentInvoice && (
        <PaymentForm
          invoiceId={currentInvoice.id}
          total={currentInvoice.total}
          isOpen={showPaymentForm}
          onClose={() => {
            setShowPaymentForm(false);
            setCurrentInvoice(null);
            // Refresh invoice data
            queryClient.invalidateQueries({ 
              queryKey: [`/api/repairs/${repairId}/details`]
            });
          }}
        />
      )}

      {/* Cost Estimator Dialog */}
      {showCostEstimator && (
        <Dialog open={showCostEstimator} onOpenChange={setShowCostEstimator}>
          <DialogContent className="sm:w-[calc(100vw-2rem)] md:max-w-4xl w-screen max-h-[90vh] overflow-y-auto p-0 sm:p-6">
            <DialogHeader className="p-4 sm:p-0">
              <DialogTitle>Repair Cost Estimator</DialogTitle>
              <DialogDescription>
                Estimate the total repair cost with a transparent breakdown
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 sm:px-0">
              <CostEstimator 
                repairId={repairId} 
                onEstimateComplete={(estimateData) => {
                  // Here we can handle saving the estimate if needed
                  toast({
                    title: "Estimate complete",
                    description: `Total estimated cost: ${estimateData.currency} ${estimateData.total.toFixed(2)}`,
                  });
                  setShowCostEstimator(false);
                }}
              />
            </div>
            <DialogFooter className="p-4 sm:p-0 mt-4">
              <Button onClick={() => setShowCostEstimator(false)} className="w-full sm:w-auto">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
