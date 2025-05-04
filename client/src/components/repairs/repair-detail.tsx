import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { RepairWithRelations } from "@/types";

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
import IntakeForm from "./intake-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2, Edit } from "lucide-react";
import RepairItemForm from "./repair-item-form";

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
  const { toast } = useToast();

  const { data: repair, isLoading: isLoadingRepair } = useQuery<RepairWithRelations>({
    queryKey: [`/api/repairs/${repairId}/details`],
  });

  // Fetch repair items separately for better real-time updates
  const { 
    data: repairItems, 
    isLoading: isLoadingItems,
    refetch: refetchRepairItems
  } = useQuery<RepairItem[]>({
    queryKey: [`/api/repairs/${repairId}/items`],
    enabled: !!repairId,
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
    setShowQuoteForm(true);
  };

  const handleCreateInvoice = () => {
    setShowInvoiceForm(true);
  };

  const handleEditRepair = () => {
    setShowEditForm(true);
  };
  
  const handleAddRepairItem = () => {
    setCurrentEditingItem(null);
    setShowRepairItemForm(true);
  };
  
  const handleEditRepairItem = (item: any) => {
    setCurrentEditingItem(item);
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

  const isLoading = isLoadingRepair || isLoadingItems;
  
  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!repair) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Could not find repair details. The repair may have been deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const canCreateQuote = !repair.quote && ['diagnosing', 'awaiting_approval'].includes(repair.status);
  const canCreateInvoice = !repair.invoice && ['ready_for_pickup', 'completed'].includes(repair.status);
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="text-2xl">
                  Repair #{repair.ticketNumber}
                </DialogTitle>
                <DialogDescription>
                  Created on {format(new Date(repair.intakeDate), "MMMM d, yyyy")}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleEditRepair}
                  className="flex items-center"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <StatusBadge status={repair.status} className="text-sm py-1 px-3" />
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="details">Repair Details</TabsTrigger>
              <TabsTrigger value="parts">Parts & Services</TabsTrigger>
              <TabsTrigger value="quotes">Quote</TabsTrigger>
              <TabsTrigger value="invoice">Invoice</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {repair.customer ? (
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium">Name:</span> {repair.customer.firstName} {repair.customer.lastName}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {repair.customer.email}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {repair.customer.phone}
                        </div>
                        {repair.customer.address && (
                          <div>
                            <span className="font-medium">Address:</span> {repair.customer.address}, {repair.customer.city}, {repair.customer.state} {repair.customer.postalCode}
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
                    {repair.device ? (
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium">Type:</span> {repair.device.type}
                        </div>
                        <div>
                          <span className="font-medium">Brand/Model:</span> {repair.device.brand} {repair.device.model}
                        </div>
                        {repair.device.serialNumber && (
                          <div>
                            <span className="font-medium">Serial Number:</span> {repair.device.serialNumber}
                          </div>
                        )}
                        {repair.device.condition && (
                          <div>
                            <span className="font-medium">Condition:</span> {repair.device.condition}
                          </div>
                        )}
                        {repair.device.accessories && (
                          <div>
                            <span className="font-medium">Accessories:</span> {repair.device.accessories}
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
                      <p className="text-gray-700">{repair.issue}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium">Priority</h4>
                      <p>
                        <Badge className={
                          repair.priorityLevel === 1 ? "bg-red-100 text-red-800 border-red-300" :
                          repair.priorityLevel === 2 ? "bg-orange-100 text-orange-800 border-orange-300" :
                          repair.priorityLevel === 3 ? "bg-gray-100 text-gray-800 border-gray-300" :
                          repair.priorityLevel === 4 ? "bg-blue-100 text-blue-800 border-blue-300" :
                          "bg-green-100 text-green-800 border-green-300"
                        }>
                          {repair.priorityLevel === 1 ? "Critical" :
                           repair.priorityLevel === 2 ? "High" :
                           repair.priorityLevel === 3 ? "Normal" :
                           repair.priorityLevel === 4 ? "Low" :
                           "Lowest"}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Intake Date</h4>
                      <p className="text-gray-700">{format(new Date(repair.intakeDate), "MMMM d, yyyy")}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium">Estimated Completion</h4>
                      <p className="text-gray-700">
                        {repair.estimatedCompletionDate 
                          ? format(new Date(repair.estimatedCompletionDate), "MMMM d, yyyy")
                          : "Not specified"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Assigned Technician</h4>
                      <p className="text-gray-700">
                        {repair.technician 
                          ? `${repair.technician.firstName} ${repair.technician.lastName} (${repair.technician.role})`
                          : "Unassigned"}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium">Warranty</h4>
                      <p className="text-gray-700">
                        {repair.isUnderWarranty ? "Yes - Under Warranty" : "No - Not Under Warranty"}
                      </p>
                    </div>
                  </div>

                  {repair.diagnosticNotes && (
                    <div>
                      <h4 className="font-medium">Diagnostic Notes</h4>
                      <p className="text-gray-700">{repair.diagnosticNotes}</p>
                    </div>
                  )}

                  {repair.notes && (
                    <div>
                      <h4 className="font-medium">Additional Notes</h4>
                      <p className="text-gray-700">{repair.notes}</p>
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
            <TabsContent value="parts">
              <Card>
                <CardHeader>
                  <CardTitle>Parts & Services</CardTitle>
                  <CardDescription>
                    Parts and services included in this repair
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {repairItems && repairItems.length > 0 ? (
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
                                  onClick={() => handleEditRepairItem(item)} 
                                  variant="ghost" 
                                  size="icon"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  onClick={() => handleDeleteRepairItem(item.id)} 
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
            <TabsContent value="quotes">
              <Card>
                <CardHeader>
                  <CardTitle>Quote</CardTitle>
                  <CardDescription>
                    Quote details for customer approval
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {repair.quote ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xl font-medium">Quote #{repair.quote.quoteNumber}</div>
                          <div className="text-sm text-gray-500">
                            Created on {format(new Date(repair.quote.dateCreated), "MMMM d, yyyy")}
                          </div>
                          {repair.quote.expirationDate && (
                            <div className="text-sm text-gray-500">
                              Expires on {format(new Date(repair.quote.expirationDate), "MMMM d, yyyy")}
                            </div>
                          )}
                        </div>
                        <Badge className={
                          repair.quote.status === "approved" 
                            ? "bg-green-100 text-green-800 border-green-300" 
                            : repair.quote.status === "rejected"
                              ? "bg-red-100 text-red-800 border-red-300"
                              : "bg-yellow-100 text-yellow-800 border-yellow-300"
                        }>
                          {repair.quote.status.charAt(0).toUpperCase() + repair.quote.status.slice(1)}
                        </Badge>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-gray-500">Subtotal</div>
                          <div className="text-lg">${repair.quote.subtotal.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">Tax</div>
                          <div className="text-lg">${repair.quote.tax?.toFixed(2) || "0.00"}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-500">Total</div>
                        <div className="text-2xl font-bold">${repair.quote.total.toFixed(2)}</div>
                      </div>

                      {repair.quote.notes && (
                        <div>
                          <div className="text-sm font-medium text-gray-500">Notes</div>
                          <div className="text-gray-700">{repair.quote.notes}</div>
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <Button variant="outline">
                          <i className="fas fa-print mr-1"></i> Print Quote
                        </Button>
                        <Button variant="outline">
                          <i className="fas fa-envelope mr-1"></i> Email to Customer
                        </Button>
                      </div>
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
                        onClick={handleCreateQuote}
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
            <TabsContent value="invoice">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice</CardTitle>
                  <CardDescription>
                    Invoice and payment information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {repair.invoice ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xl font-medium">Invoice #{repair.invoice.invoiceNumber}</div>
                          <div className="text-sm text-gray-500">
                            Issued on {format(new Date(repair.invoice.dateIssued), "MMMM d, yyyy")}
                          </div>
                          {repair.invoice.datePaid && (
                            <div className="text-sm text-gray-500">
                              Paid on {format(new Date(repair.invoice.datePaid), "MMMM d, yyyy")}
                            </div>
                          )}
                        </div>
                        <Badge className={
                          repair.invoice.status === "paid" 
                            ? "bg-green-100 text-green-800 border-green-300" 
                            : repair.invoice.status === "partial"
                              ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                              : "bg-red-100 text-red-800 border-red-300"
                        }>
                          {repair.invoice.status.charAt(0).toUpperCase() + repair.invoice.status.slice(1)}
                        </Badge>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-gray-500">Subtotal</div>
                          <div className="text-lg">${repair.invoice.subtotal.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-500">Tax</div>
                          <div className="text-lg">${repair.invoice.tax?.toFixed(2) || "0.00"}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-500">Total</div>
                        <div className="text-2xl font-bold">${repair.invoice.total.toFixed(2)}</div>
                      </div>

                      {repair.invoice.paymentMethod && (
                        <div>
                          <div className="text-sm font-medium text-gray-500">Payment Method</div>
                          <div className="text-gray-700">{repair.invoice.paymentMethod}</div>
                        </div>
                      )}

                      {repair.invoice.notes && (
                        <div>
                          <div className="text-sm font-medium text-gray-500">Notes</div>
                          <div className="text-gray-700">{repair.invoice.notes}</div>
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <Button variant="outline">
                          <i className="fas fa-print mr-1"></i> Print Invoice
                        </Button>
                        <Button variant="outline">
                          <i className="fas fa-envelope mr-1"></i> Email to Customer
                        </Button>
                        {repair.invoice.status !== "paid" && (
                          <Button>
                            <i className="fas fa-check-circle mr-1"></i> Mark as Paid
                          </Button>
                        )}
                      </div>
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
      {showQuoteForm && (
        <QuoteForm 
          repairId={repairId}
          isOpen={showQuoteForm}
          onClose={() => setShowQuoteForm(false)}
        />
      )}

      {/* Invoice Form */}
      {showInvoiceForm && (
        <InvoiceForm 
          repairId={repairId}
          isOpen={showInvoiceForm}
          onClose={() => setShowInvoiceForm(false)}
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
    </>
  );
}
