import { useState, useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/use-currency";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function InvoiceDetailPage() {
  const [match, params] = useRoute("/invoice/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [isLoading, setIsLoading] = useState(true);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [repair, setRepair] = useState<any | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

  const invoiceId = params?.id ? parseInt(params.id) : null;

  useEffect(() => {
    if (!invoiceId) {
      navigate("/invoices");
      return;
    }

    const fetchInvoiceDetails = async () => {
      try {
        setIsLoading(true);
        console.log("INVOICE DETAIL: Fetching invoice detail for ID:", invoiceId);

        // Fetch invoice data
        const invoiceResponse = await apiRequest("GET", `/api/invoices/${invoiceId}`);
        if (!invoiceResponse.ok) {
          throw new Error(`Failed to fetch invoice: ${invoiceResponse.status}`);
        }
        const invoiceData = await invoiceResponse.json();
        setInvoice(invoiceData);
        console.log("INVOICE DETAIL: Invoice data:", invoiceData);

        // Parse invoice items
        if (invoiceData.itemsData) {
          try {
            const items = JSON.parse(invoiceData.itemsData);
            setInvoiceItems(items);
            console.log("INVOICE DETAIL: Parsed items:", items);
          } catch (err) {
            console.error("Failed to parse invoice items:", err);
            setInvoiceItems([]);
          }
        }

        // Fetch related repair if exists
        if (invoiceData.repairId) {
          const repairResponse = await apiRequest("GET", `/api/repairs/${invoiceData.repairId}`);
          if (repairResponse.ok) {
            const repairData = await repairResponse.json();
            setRepair(repairData);
            console.log("INVOICE DETAIL: Repair data:", repairData);
            
            // Fetch related customer if exists
            if (repairData.customerId) {
              const customerResponse = await apiRequest("GET", `/api/customers/${repairData.customerId}`);
              if (customerResponse.ok) {
                const customerData = await customerResponse.json();
                setCustomer(customerData);
                console.log("INVOICE DETAIL: Customer data:", customerData);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching invoice details:", error);
        toast({
          title: "Error",
          description: "Failed to load invoice details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [invoiceId, navigate, toast]);

  const handleBackClick = () => {
    navigate("/invoices");
  };

  const handlePrintInvoice = () => {
    // Open print dialog
    window.print();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return "bg-green-100 text-green-800 border-green-200";
      case 'unpaid':
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'cancelled':
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <h3 className="text-lg font-medium text-gray-700">Invoice not found</h3>
          <Button onClick={handleBackClick} className="mt-4">
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <Button 
            variant="outline" 
            onClick={handleBackClick}
            className="mb-4"
          >
            <i className="fas fa-arrow-left mr-2"></i> Back to Invoices
          </Button>
        </div>
        <div className="print:hidden flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrintInvoice}
          >
            <i className="fas fa-print mr-2"></i> Print
          </Button>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="bg-gray-50 border-b flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-xl">Invoice {invoice.invoiceNumber}</CardTitle>
          </div>
          <Badge className={getStatusBadgeColor(invoice.status)}>
            {invoice.status}
          </Badge>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Customer Information</h3>
              {customer ? (
                <div className="space-y-1">
                  <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                  {customer.email && <p>{customer.email}</p>}
                  {customer.phone && <p>{customer.phone}</p>}
                  {customer.address && (
                    <div>
                      <p>{customer.address}</p>
                      <p>
                        {customer.city}
                        {customer.city && customer.state && ", "}
                        {customer.state} {customer.postalCode}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">No customer information available</p>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Invoice Details</h3>
              <div className="space-y-1">
                <p><span className="font-medium">Invoice Date:</span> {format(new Date(invoice.dateIssued), "MMMM d, yyyy")}</p>
                {invoice.datePaid && <p><span className="font-medium">Date Paid:</span> {format(new Date(invoice.datePaid), "MMMM d, yyyy")}</p>}
                {invoice.paymentMethod && <p><span className="font-medium">Payment Method:</span> {invoice.paymentMethod}</p>}
                {repair && (
                  <p>
                    <span className="font-medium">Repair Ticket:</span>{" "}
                    <Link href={`/repair/${repair.id}`}>
                      <a className="text-blue-600 hover:underline">{repair.ticketNumber}</a>
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <h3 className="text-lg font-semibold mb-4">Invoice Items</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoiceItems.length > 0 ? (
                  invoiceItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      No items found for this invoice
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    Subtotal
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(invoice.subtotal)}
                  </td>
                </tr>
                {invoice.tax !== null && (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      Tax
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.tax)}
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-100">
                  <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(invoice.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {invoice.notes && (
            <>
              <Separator className="my-6" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Notes</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}