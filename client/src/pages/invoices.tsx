import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Invoice, Repair } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import InvoiceForm from "@/components/repairs/invoice-form";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);
  const [manualInvoices, setManualInvoices] = useState<Invoice[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState<Error | null>(null);
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  // Manual fetch for invoices to debug
  useEffect(() => {
    console.log("MANUAL FETCH: Starting manual fetch for invoices...");
    
    const fetchInvoices = async () => {
      try {
        setInvoiceLoading(true);
        
        console.log("MANUAL FETCH: Making direct fetch to /api/invoices");
        
        // Get auth token
        const firebaseToken = localStorage.getItem('firebase_token');
        const devMode = localStorage.getItem('dev_mode') === 'true';
        
        const headers: Record<string, string> = {
          'X-Organization-ID': localStorage.getItem('currentOrganizationId') || '2',
          'X-Debug-Client': 'RepairTrackerClient'
        };
        
        // Add Authorization header
        if (firebaseToken) {
          console.log('Adding auth token to manual fetch headers');
          headers["Authorization"] = `Bearer ${firebaseToken}`;
        } else if (devMode || import.meta.env.MODE === 'development') {
          console.log('Creating dev token for manual fetch');
          const newDevToken = 'dev-token-' + Date.now();
          localStorage.setItem('firebase_token', newDevToken);
          localStorage.setItem('dev_mode', 'true');
          headers["Authorization"] = `Bearer ${newDevToken}`;
          headers["X-Debug-Mode"] = "true";
        }
        
        console.log('Manual fetch headers:', headers);
        
        const response = await fetch('/api/invoices', {
          headers,
          credentials: 'include'
        });
        
        console.log(`MANUAL FETCH: Response status: ${response.status}`);
        const responseText = await response.text();
        console.log(`MANUAL FETCH: Raw response: ${responseText}`);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${responseText}`);
        }
        
        if (responseText) {
          const data = JSON.parse(responseText) as Invoice[];
          console.log("MANUAL FETCH: Successfully parsed invoices:", data);
          setManualInvoices(data);
        } else {
          console.log("MANUAL FETCH: Empty response, setting empty array");
          setManualInvoices([]);
        }
      } catch (err) {
        console.error("MANUAL FETCH: Error fetching invoices:", err);
        setInvoiceError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setInvoiceLoading(false);
      }
    };
    
    fetchInvoices();
  }, []);

  // For comparison, keep the React Query version
  const { data: invoices, isLoading, isError, error } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    retry: 1,
    onError: (err) => {
      console.error("REACT QUERY: Error fetching invoices:", err);
    },
    onSuccess: (data) => {
      console.log("REACT QUERY: Successfully fetched invoices:", data);
    }
  });

  const { data: repairs } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
    onSuccess: (data) => {
      console.log("Successfully fetched repairs for invoices page:", data?.length);
    }
  });

  const handleCreateInvoice = () => {
    setSelectedInvoiceId(null);
    setSelectedRepairId(null);
    setShowInvoiceForm(true);
  };

  const handleEditInvoice = (invoiceId: number, repairId: number) => {
    setSelectedInvoiceId(invoiceId);
    setSelectedRepairId(repairId);
    setShowInvoiceForm(true);
  };

  const handleMarkPaid = async (invoiceId: number) => {
    try {
      await apiRequest("POST", `/api/invoices/${invoiceId}/pay`, {
        paymentMethod: "Cash", // Default to cash
      });
      
      toast({
        title: "Invoice marked as paid",
        description: "The invoice has been successfully marked as paid",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark invoice as paid",
        variant: "destructive",
      });
    }
  };

  // Combine our data sources, prioritizing manual fetch results for debugging
  const combinedInvoices = manualInvoices.length > 0 ? manualInvoices : (invoices || []);
  
  // Get customers data
  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    onSuccess: (data) => {
      console.log("Successfully fetched customers for invoices page:", data?.length);
    }
  });
  
  // Make separate requests for repairs and customers with higher priority
  const { data: repairsData, isLoading: repairsLoading } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
    staleTime: 5000, // Reduce refetching
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      console.log("REPAIRS DIRECT FETCH: Successfully fetched repairs:", data?.length);
    }
  });

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
    staleTime: 5000, // Reduce refetching 
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      console.log("CUSTOMERS DIRECT FETCH: Successfully fetched customers:", data?.length);
    }
  });
  
  // Debug information
  console.log("INVOICES DEBUG: Repairs data:", repairsData || repairs);
  console.log("INVOICES DEBUG: Customers data:", customersData || customers);
  console.log("INVOICES DEBUG: Combined invoices:", combinedInvoices);
  
  // Use the most reliable data source
  const availableRepairs = repairsData || repairs || [];
  const availableCustomers = customersData || customers || [];
  
  // Find repair and customer info for each invoice
  const invoicesWithRepairInfo = combinedInvoices.map(invoice => {
    console.log(`INVOICES DEBUG: Processing invoice ${invoice.invoiceNumber} with repairId ${invoice.repairId}`);
    const repair = availableRepairs.find(r => r.id === invoice.repairId);
    console.log(`INVOICES DEBUG: Found repair:`, repair);
    
    const customer = repair ? availableCustomers.find(c => c.id === repair.customerId) : null;
    console.log(`INVOICES DEBUG: Found customer:`, customer);
    
    const customerName = customer ? `${customer.firstName} ${customer.lastName}` : "Unknown";
    return { ...invoice, repair, customer, customerName };
  });

  // Apply search filter
  const filteredInvoices = invoicesWithRepairInfo.filter(invoice => {
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
      String(invoice.total).includes(searchLower) ||
      (invoice.customerName && invoice.customerName.toLowerCase().includes(searchLower)) ||
      invoice.repair?.ticketNumber?.toLowerCase().includes(searchLower) || false
    );
  });

  // Calculate totals for the summary cards
  const totalInvoices = combinedInvoices.length;
  const totalPaid = combinedInvoices.filter(inv => inv.status === "paid").length;
  const totalUnpaid = combinedInvoices.filter(inv => inv.status === "unpaid").length;
  const totalRevenue = combinedInvoices.reduce((acc, inv) => acc + (inv.status === "paid" ? (inv.total || 0) : 0), 0);

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Invoices</h1>
          <p className="text-sm text-gray-500">Manage customer invoices and payments</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button
            onClick={handleCreateInvoice}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <i className="fas fa-plus mr-1"></i> Create Invoice
          </Button>
        </div>
      </div>

      {/* Invoice Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-gray-800">{totalInvoices}</div>
            <div className="text-sm text-gray-500">Total Invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-green-600">{totalPaid}</div>
            <div className="text-sm text-gray-500">Paid Invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-red-500">{totalUnpaid}</div>
            <div className="text-sm text-gray-500">Unpaid Invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(totalRevenue)}</div>
            <div className="text-sm text-gray-500">Total Revenue</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <Input
              type="text"
              placeholder="Search by invoice number, customer name, amount, or repair ticket..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card>
        <CardHeader className="p-4 border-b border-gray-200">
          <CardTitle className="text-lg font-medium text-gray-800">
            {searchTerm ? `Search Results (${filteredInvoices.length})` : "All Invoices"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <i className="fas fa-file-invoice-dollar text-4xl"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-700">No invoices found</h3>
              <p className="text-gray-500 mt-1">
                {searchTerm
                  ? "Try using different search terms"
                  : "Create your first invoice to get started"}
              </p>
              {!searchTerm && (
                <Button
                  onClick={handleCreateInvoice}
                  className="mt-4"
                >
                  Create Invoice
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Repair Ticket</TableHead>
                    <TableHead>Date Issued</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium">{invoice.invoiceNumber}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{invoice.customerName}</div>
                      </TableCell>
                      <TableCell>
                        {invoice.repair ? (
                          <div className="text-sm">{invoice.repair.ticketNumber}</div>
                        ) : (
                          <div className="text-sm text-gray-500">Unknown</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.dateIssued), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{formatCurrency(invoice.total)}</TableCell>
                      <TableCell>
                        {invoice.status === "paid" ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            Paid
                          </Badge>
                        ) : invoice.status === "partial" ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            Partial
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-300">
                            Unpaid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {invoice.status !== "paid" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-900"
                              onClick={() => handleMarkPaid(invoice.id)}
                            >
                              <i className="fas fa-check-circle"></i>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleEditInvoice(invoice.id, invoice.repairId)}
                          >
                            <i className="fas fa-eye"></i>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <i className="fas fa-print"></i>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Form Modal */}
      {showInvoiceForm && (
        <InvoiceForm
          invoiceId={selectedInvoiceId}
          repairId={selectedRepairId}
          isOpen={showInvoiceForm}
          onClose={() => setShowInvoiceForm(false)}
        />
      )}
    </>
  );
}
