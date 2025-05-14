import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { InventoryItem } from "@shared/schema";
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
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PartsForm from "@/components/inventory/parts-form";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";

// Direct fetch function
const fetchInventory = async (): Promise<InventoryItem[]> => {
  const orgId = localStorage.getItem("currentOrganizationId") || "2";
  console.log("INVENTORY FETCH: Using organization ID:", orgId);
  
  try {
    const response = await fetch("/api/inventory", {
      headers: {
        "X-Organization-ID": orgId,
        "X-Debug-Client": "RepairTrackerClient"
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    console.log("INVENTORY FETCH: Successfully fetched inventory items:", data);
    return data;
  } catch (error) {
    console.error("INVENTORY FETCH: Error fetching inventory items:", error);
    throw error;
  }
};

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showPartsForm, setShowPartsForm] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  
  // Use custom query function to avoid authentication issues
  const { data: inventoryItems, isLoading, refetch, error } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: fetchInventory,
    refetchOnWindowFocus: true,
    staleTime: 0
  });
  
  // Add debugging logs
  console.log("INVENTORY CLIENT DEBUG: inventoryItems:", inventoryItems);
  console.log("INVENTORY CLIENT DEBUG: isLoading:", isLoading);
  console.log("INVENTORY CLIENT DEBUG: error:", error);

  const handleAddPart = () => {
    setSelectedItemId(null);
    setShowPartsForm(true);
  };

  const handleEditPart = (id: number) => {
    setSelectedItemId(id);
    setShowPartsForm(true);
  };

  const handleDeletePart = async (id: number) => {
    if (confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
      try {
        await apiRequest("DELETE", `/api/inventory/${id}`);
        toast({
          title: "Item deleted",
          description: "The inventory item has been successfully deleted",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete inventory item",
          variant: "destructive",
        });
      }
    }
  };

  // Extract unique categories for the filter
  const categories = inventoryItems
    ? [...new Set(inventoryItems.map(item => item.category))]
    : [];

  // Apply filters
  const filteredItems = (inventoryItems || []).filter(item => {
    const matchesSearch = searchTerm.toLowerCase() === "" ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Inventory summary
  const totalItems = inventoryItems?.length || 0;
  const totalValueCost = inventoryItems?.reduce((acc, item) => acc + (item.cost || 0) * item.quantity, 0) || 0;
  const totalValueRetail = inventoryItems?.reduce((acc, item) => acc + item.price * item.quantity, 0) || 0;
  const lowStockItems = inventoryItems?.filter(item => item.quantity <= item.minLevel).length || 0;

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Inventory</h1>
          <p className="text-sm text-gray-500">Manage parts and supplies</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="icon"
            title="Refresh inventory"
          >
            <i className="fas fa-sync-alt"></i>
          </Button>
          <Button
            onClick={handleAddPart}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <i className="fas fa-plus mr-1"></i> Add Part
          </Button>
        </div>
      </div>

      {/* Inventory Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-gray-800">{totalItems}</div>
            <div className="text-sm text-gray-500">Total Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(totalValueRetail)}</div>
            <div className="text-sm text-gray-500">Retail Value</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-green-600">{formatCurrency(totalValueCost)}</div>
            <div className="text-sm text-gray-500">Cost Value</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-red-500">{lowStockItems}</div>
            <div className="text-sm text-gray-500">Low Stock Items</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400"></i>
              </div>
              <Input
                type="text"
                placeholder="Search inventory..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select
                value={categoryFilter || "all_categories"}
                onValueChange={(value) => setCategoryFilter(value === "all_categories" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_categories">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory List */}
      <Card>
        <CardHeader className="p-4 border-b border-gray-200">
          <CardTitle className="text-lg font-medium text-gray-800">
            Inventory Items
          </CardTitle>
          <CardDescription>
            {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"} found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <i className="fas fa-box-open text-4xl"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-700">No inventory items found</h3>
              <p className="text-gray-500 mt-1">
                {searchTerm || categoryFilter
                  ? "Try adjusting your search or filter criteria"
                  : "Add your first item to the inventory"}
              </p>
              {!searchTerm && !categoryFilter && (
                <Button
                  onClick={handleAddPart}
                  className="mt-4"
                >
                  Add Part
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.description}</div>
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{formatCurrency(item.price)}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        {item.quantity <= 0 ? (
                          <Badge variant="destructive">Out of Stock</Badge>
                        ) : item.quantity <= item.minLevel ? (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                            In Stock
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => handleEditPart(item.id)}
                          >
                            <i className="fas fa-edit"></i>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-900"
                            onClick={() => handleDeletePart(item.id)}
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

      {/* Parts Form Modal */}
      {showPartsForm && (
        <PartsForm
          itemId={selectedItemId}
          isOpen={showPartsForm}
          onClose={() => setShowPartsForm(false)}
        />
      )}
    </>
  );
}
