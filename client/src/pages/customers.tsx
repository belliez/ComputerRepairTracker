import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Customer } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
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
import CustomerForm from "@/components/customers/customer-form";
import { useToast } from "@/hooks/use-toast";

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const { toast } = useToast();

  // Debug initialization rendering
  console.log("CUSTOMERS PAGE DEBUG: Component rendering, before useQuery");
  
  // Standard API query for customers
  console.log("DEBUG: About to run useQuery for customers");
  
  const { data: customers, isLoading, refetch, error } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    // Since this is a direct call to the customer endpoint, we'll make a manual fetch
    // to debug what's happening
    queryFn: async () => {
      console.log("MANUAL QUERY FN: Starting manual fetch for customers");
      
      // Get auth token
      const firebaseToken = localStorage.getItem('firebase_token');
      const orgId = localStorage.getItem('currentOrganizationId') || '2';
      
      // Setup headers
      const headers: Record<string, string> = {
        'X-Debug-Client': 'RepairTrackerClient',
        'X-Organization-ID': orgId,
      };
      
      if (firebaseToken) {
        headers['Authorization'] = `Bearer ${firebaseToken}`;
      }
      
      console.log("MANUAL QUERY FN: Making fetch with headers:", headers);
      
      try {
        const res = await fetch('/api/customers', {
          credentials: "include",
          headers: headers
        });
        
        console.log("MANUAL QUERY FN: Response status:", res.status);
        const text = await res.text();
        console.log("MANUAL QUERY FN: Response text:", text);
        
        if (!res.ok) {
          throw new Error(`${res.status}: ${text || res.statusText}`);
        }
        
        // Parse JSON response
        try {
          const data = JSON.parse(text);
          console.log("MANUAL QUERY FN: Parsed customers data:", data);
          return data;
        } catch (e) {
          console.error("MANUAL QUERY FN: Error parsing JSON:", e);
          throw new Error("Failed to parse JSON response");
        }
      } catch (error) {
        console.error("MANUAL QUERY FN: Error fetching customers:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("CUSTOMERS DEBUG: Successfully loaded customers:", data?.length || 0);
      if (data?.length) {
        console.log("CUSTOMERS DEBUG: Sample customer:", data[0]);
      }
    },
    onError: (err) => {
      console.error("CUSTOMERS DEBUG: Error loading customers:", err);
    }
  });
  
  // Debug after query
  console.log("CUSTOMERS PAGE DEBUG: After useQuery. Customers data:", customers);
  console.log("CUSTOMERS PAGE DEBUG: isLoading:", isLoading);
  console.log("CUSTOMERS PAGE DEBUG: error:", error);

  const filteredCustomers = (customers || []).filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.firstName.toLowerCase().includes(searchLower) ||
      customer.lastName.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      customer.phone.toLowerCase().includes(searchLower)
    );
  });

  const handleAddCustomer = () => {
    setSelectedCustomerId(null);
    setShowCustomerForm(true);
  };

  const handleEditCustomer = (id: number) => {
    setSelectedCustomerId(id);
    setShowCustomerForm(true);
  };

  const handleDeleteCustomer = async (id: number) => {
    if (confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
      try {
        await apiRequest("DELETE", `/api/customers/${id}`);
        toast({
          title: "Customer deleted",
          description: "The customer has been successfully deleted",
        });
        refetch();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete customer",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Customers</h1>
          <p className="text-sm text-gray-500">Manage your customer database</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              console.log("DEBUG: Manually fetching customers data");
              try {
                // Make a direct fetch to /api/customers to test
                const firebaseToken = localStorage.getItem('firebase_token');
                const orgId = localStorage.getItem('currentOrganizationId');
                
                fetch('/api/customers', {
                  headers: {
                    'Authorization': `Bearer ${firebaseToken}`,
                    'X-Organization-ID': orgId || '2',
                    'X-Debug-Client': 'RepairTrackerClient'
                  }
                })
                .then(res => {
                  console.log("DEBUG: Direct fetch response status:", res.status);
                  return res.text();
                })
                .then(text => {
                  console.log("DEBUG: Direct fetch response:", text);
                  try {
                    if (text) {
                      const data = JSON.parse(text);
                      console.log("DEBUG: Parsed customers data:", data);
                    }
                  } catch (e) {
                    console.log("DEBUG: Failed to parse JSON:", e);
                  }
                })
                .catch(err => {
                  console.error("DEBUG: Direct fetch error:", err);
                });
              } catch (e) {
                console.error("DEBUG: Error in manual fetch:", e);
              }
            }}
          >
            Debug Fetch
          </Button>
          <Button
            onClick={handleAddCustomer}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <i className="fas fa-user-plus mr-1"></i> Add Customer
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <Input
              type="text"
              placeholder="Search customers by name, email, or phone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <Card>
        <CardHeader className="p-4 border-b border-gray-200">
          <CardTitle className="text-lg font-medium text-gray-800">
            {searchTerm ? `Search Results (${filteredCustomers.length})` : "All Customers"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <i className="fas fa-users text-4xl"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-700">No customers found</h3>
              <p className="text-gray-500 mt-1">
                {searchTerm ? "Try using different search terms" : "Add your first customer to get started"}
              </p>
              {!searchTerm && (
                <Button 
                  onClick={handleAddCustomer} 
                  className="mt-4"
                >
                  Add Customer
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Information</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium">{`${customer.firstName} ${customer.lastName}`}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{customer.email}</div>
                        <div className="text-sm text-gray-500">{customer.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {customer.city}{customer.state ? `, ${customer.state}` : ""}
                        </div>
                        {customer.postalCode && (
                          <div className="text-sm text-gray-500">{customer.postalCode}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleEditCustomer(customer.id)}
                          >
                            <i className="fas fa-edit"></i>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-900"
                            onClick={() => handleDeleteCustomer(customer.id)}
                          >
                            <i className="fas fa-trash-alt"></i>
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

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerForm
          customerId={selectedCustomerId}
          isOpen={showCustomerForm}
          onClose={() => {
            setShowCustomerForm(false);
            // Force refresh the customers list when the form is closed
            refetch();
          }}
        />
      )}
    </>
  );
}
