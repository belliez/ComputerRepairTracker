import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { getStandardHeaders, getCurrentOrgId } from "@/lib/organization-utils";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

// Define RepairItem interface if not already defined elsewhere
interface RepairItem {
  id: number;
  repairId: number;
  itemType: 'part' | 'service' | 'accessory';
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number | null;
  tax?: number | null;
  total: number;
}

interface RepairDetailProps {
  repairId: number;
  isOpen: boolean;
  onClose: () => void;
  onRepairDeleted?: () => void;
  showButtons?: boolean;
  onStatusChange?: () => void;
  isStandalonePage?: boolean;
}

// Status options for dropdown
const statusOptions = [
  { value: 'intake', label: 'Intake' },
  { value: 'diagnosing', label: 'Diagnosing' },
  { value: 'awaiting_approval', label: 'Awaiting Customer Approval' },
  { value: 'parts_ordered', label: 'Parts Ordered' },
  { value: 'in_repair', label: 'In Repair' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function RepairDetail({ 
  repairId, 
  isOpen,
  onClose,
  onRepairDeleted,
  showButtons = true,
  onStatusChange,
  isStandalonePage = false
}: RepairDetailProps) {
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [showCostEstimator, setShowCostEstimator] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { formatCurrency } = useCurrency();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Function to manually fetch repair details to handle loading state better
  const fetchRepairData = async (): Promise<RepairWithRelations> => {
    try {
      console.log("REPAIR DETAIL DEBUG: Starting manual fetch for repair details");
      
      // Use standardized headers with organization context
      const headers = getStandardHeaders();
      
      // Add auth token if available 
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      // Make API request
      const response = await fetch(`/api/repairs/${repairId}`, {
        method: "GET",
        headers
      });
      
      // Check response
      if (!response.ok) {
        throw new Error(`Error fetching repair: ${response.status}`);
      }
      
      // Parse and return data
      return await response.json();
    } catch (error) {
      console.error("Error fetching repair details:", error);
      throw error;
    }
  };

  // Query for repair details
  const { 
    data: repair,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/repairs', repairId],
    queryFn: fetchRepairData,
    refetchOnWindowFocus: false,
    enabled: !!repairId
  });

  // Function to fetch items for a repair
  const fetchRepairItems = async (): Promise<RepairItem[]> => {
    try {
      console.log("REPAIR DETAIL DEBUG: Starting manual fetch for repair items");
      
      // Use standardized headers with organization context
      const headers = getStandardHeaders();
      
      // Add auth token if available 
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      // Make API request
      const response = await fetch(`/api/repairs/${repairId}/items`, {
        method: "GET",
        headers
      });
      
      // Check response
      if (!response.ok) {
        throw new Error(`Error fetching repair items: ${response.status}`);
      }
      
      // Parse and return data
      return await response.json();
    } catch (error) {
      console.error("Error fetching repair items:", error);
      return []; // Return empty array on error
    }
  };

  // Query for repair items
  const { 
    data: repairItems = [],
    isLoading: isLoadingItems,
    refetch: refetchItems
  } = useQuery({
    queryKey: ['/api/repairs', repairId, 'items'],
    queryFn: fetchRepairItems,
    enabled: !!repairId
  });

  // Function to handle status change
  const handleStatusChange = async () => {
    if (!newStatus || !repair) return;
    
    try {
      // Use standardized headers with organization context
      const headers = getStandardHeaders();
      
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/repairs/${repairId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        throw new Error(`Error updating status: ${response.status}`);
      }
      
      toast({
        title: "Status Updated",
        description: `Repair status has been updated to ${statusOptions.find(opt => opt.value === newStatus)?.label || newStatus}.`,
      });
      
      setEditStatus(false);
      refetch();
      
      // Call the callback if provided
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error) {
      console.error("Error updating repair status:", error);
      toast({
        title: "Error",
        description: `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  // Function to delete repair
  const deleteRepair = async () => {
    if (!repair) return;
    
    try {
      setIsDeleting(true);
      
      // Use standardized headers with organization context
      const headers = getStandardHeaders();
      
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/repairs/${repairId}`, {
        method: "DELETE",
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting repair: ${response.status}`);
      }
      
      toast({
        title: "Repair Deleted",
        description: `Repair #${repair.ticketNumber} has been successfully deleted.`,
      });
      
      // Invalidate repairs query to refresh list
      queryClient.invalidateQueries({ queryKey: ['/api/repairs'] });
      
      // Call callback if provided
      if (onRepairDeleted) {
        onRepairDeleted();
      } else {
        // Navigate back to repairs list if no callback
        navigate("/repairs");
      }
    } catch (error) {
      console.error("Error deleting repair:", error);
      toast({
        title: "Error",
        description: `Failed to delete repair: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Function to create and download quote
  const handleCreateQuote = async () => {
    if (!repair) return;
    
    try {
      setIsLoadingQuote(true);
      
      const quoteData = await createQuoteDocument(repair, repairItems);
      
      toast({
        title: "Quote Created",
        description: "Quote document has been generated successfully.",
      });
      
      // Refresh data after creating quote
      refetch();
      refetchItems();
    } catch (error) {
      console.error("Error creating quote:", error);
      toast({
        title: "Error",
        description: `Failed to create quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Function to create and download invoice
  const handleCreateInvoice = async () => {
    if (!repair) return;
    
    try {
      setIsLoadingInvoice(true);
      
      const invoiceData = await createInvoiceDocument(repair, repairItems);
      
      toast({
        title: "Invoice Created",
        description: "Invoice document has been generated successfully.",
      });
      
      // Refresh data after creating invoice
      refetch();
      refetchItems();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error",
        description: `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !repair) {
    return (
      <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-md">
        <h3 className="font-semibold text-destructive">Error Loading Repair</h3>
        <p className="text-sm text-destructive/80">
          {error instanceof Error ? error.message : "Could not load repair details."}
        </p>
      </div>
    );
  }

  // Select appropriate badge color based on status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'intake':
        return 'bg-blue-100 text-blue-800';
      case 'diagnosing':
        return 'bg-purple-100 text-purple-800';
      case 'awaiting_approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'parts_ordered':
        return 'bg-indigo-100 text-indigo-800';
      case 'in_repair':
        return 'bg-orange-100 text-orange-800';
      case 'ready_for_pickup':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-teal-100 text-teal-800';
      case 'on_hold':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch (error) {
      console.error("Date formatting error:", error);
      return dateStr;
    }
  };

  // Calculate totals
  const subtotal = repairItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  
  // Get tax rate if available
  const taxRate = repair.taxRate || 0;
  
  // Calculate tax amount
  const taxAmount = subtotal * (taxRate / 100);
  
  // Calculate final total
  const total = subtotal + taxAmount;

  // Content for the repair details
  const repairContent = (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">
            Repair #{repair.ticketNumber}
          </h2>
          <div className="flex items-center mt-1 space-x-3">
            {!editStatus ? (
              <>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(repair.status)}`}>
                  {statusOptions.find(opt => opt.value === repair.status)?.label || repair.status}
                </span>
                <button 
                  onClick={() => {
                    setNewStatus(repair.status);
                    setEditStatus(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center"
                >
                  <Pencil size={12} className="mr-1" />
                  Change
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <select 
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="text-xs border rounded p-1"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={handleStatusChange}
                  className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90"
                >
                  Save
                </button>
                <button 
                  onClick={() => setEditStatus(false)}
                  className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        
        {showButtons && (
          <div className="flex space-x-2">
            <button
              onClick={() => navigate(`/repairs/${repair.id}/edit`)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <Edit size={14} className="mr-1" />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <Trash2 size={14} className="mr-1" />
              Delete
            </button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Information */}
        <div className="bg-card p-4 rounded-lg border shadow-sm">
          <h3 className="font-semibold mb-2 flex items-center">
            Customer Information
          </h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> {repair.customerName}</p>
            <p><span className="font-medium">Email:</span> {repair.customerEmail}</p>
            <p><span className="font-medium">Phone:</span> {repair.customerPhone}</p>
          </div>
        </div>
        
        {/* Device Information */}
        <div className="bg-card p-4 rounded-lg border shadow-sm">
          <h3 className="font-semibold mb-2">Device Information</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Device:</span> {repair.deviceType}</p>
            <p><span className="font-medium">Brand/Model:</span> {repair.deviceBrand} {repair.deviceModel}</p>
            <p><span className="font-medium">Serial #:</span> {repair.deviceSerialNumber || 'N/A'}</p>
          </div>
        </div>
        
        {/* Repair Details */}
        <div className="bg-card p-4 rounded-lg border shadow-sm">
          <h3 className="font-semibold mb-2">Repair Details</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Intake Date:</span> {formatDate(repair.intakeDate)}</p>
            <p><span className="font-medium">Est. Completion:</span> {formatDate(repair.estimatedCompletionDate)}</p>
            <p>
              <span className="font-medium">Technician:</span> {repair.technicianName || 'Not assigned'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Issue and Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card p-4 rounded-lg border shadow-sm">
          <h3 className="font-semibold mb-2">Issue Description</h3>
          <p className="text-sm whitespace-pre-wrap">{repair.issue || 'No issue description provided'}</p>
        </div>
        
        <div className="bg-card p-4 rounded-lg border shadow-sm">
          <h3 className="font-semibold mb-2">Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{repair.notes || 'No additional notes'}</p>
        </div>
      </div>
      
      {/* Diagnostic Notes */}
      {repair.diagnosticNotes && (
        <div className="bg-card p-4 rounded-lg border shadow-sm">
          <h3 className="font-semibold mb-2">Diagnostic Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{repair.diagnosticNotes}</p>
        </div>
      )}
      
      {/* Parts and Services */}
      <div className="bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Parts & Services</h3>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowCostEstimator(true)}
              className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded text-xs flex items-center"
            >
              <Calculator size={14} className="mr-1" />
              Add Items
            </button>
          </div>
        </div>
        
        {isLoadingItems ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : repairItems.length > 0 ? (
          <div className="border rounded overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {repairItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{item.quantity}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
                
                {/* Subtotal Row */}
                <tr className="bg-muted/20">
                  <td colSpan={3} className="px-3 py-2 text-sm text-right font-medium">Subtotal:</td>
                  <td className="px-3 py-2 text-sm text-right">{formatCurrency(subtotal)}</td>
                </tr>
                
                {/* Tax Row */}
                <tr className="bg-muted/20">
                  <td colSpan={3} className="px-3 py-2 text-sm text-right font-medium">
                    Tax ({taxRate}%):
                  </td>
                  <td className="px-3 py-2 text-sm text-right">{formatCurrency(taxAmount)}</td>
                </tr>
                
                {/* Total Row */}
                <tr className="bg-muted/30">
                  <td colSpan={3} className="px-3 py-2 text-right font-bold">Total:</td>
                  <td className="px-3 py-2 text-right font-bold">{formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p>No parts or services added yet.</p>
            <p className="text-sm mt-1">Click "Add Items" to add parts and services.</p>
          </div>
        )}
      </div>
      
      {/* Actions Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCreateQuote}
          disabled={isLoadingQuote}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingQuote ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
          ) : (
            <FileText size={16} className="mr-2" />
          )}
          Create Quote
        </button>
        
        <button
          onClick={handleCreateInvoice}
          disabled={isLoadingInvoice}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingInvoice ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
          ) : (
            <FileText size={16} className="mr-2" />
          )}
          Create Invoice
        </button>
        
        <button
          onClick={() => printDocument(repair, repairItems)}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded flex items-center"
        >
          <Printer size={16} className="mr-2" />
          Print Repair Form
        </button>
        
        <button
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded flex items-center"
        >
          <Mail size={16} className="mr-2" />
          Email Customer
        </button>
        
        {repair.status === 'ready_for_pickup' && (
          <button
            className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded flex items-center"
          >
            <CreditCard size={16} className="mr-2" />
            Take Payment
          </button>
        )}
      </div>
      
      {/* Cost Estimator Dialog */}
      {showCostEstimator && (
        <CostEstimator
          repairId={repairId}
          existingItems={repairItems}
          onClose={() => setShowCostEstimator(false)}
          onItemsUpdated={() => {
            refetchItems();
            refetch();
          }}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete repair #{repair.ticketNumber}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRepair}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Repair"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
  
  // Return either a dialog or standalone page based on isStandalonePage
  if (isStandalonePage) {
    return repairContent;
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Repair Details</DialogTitle>
          <DialogDescription>
            View and manage repair information
          </DialogDescription>
        </DialogHeader>
        {repairContent}
      </DialogContent>
    </Dialog>
  );
}