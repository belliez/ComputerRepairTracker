import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Repair, Customer, Device } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { getStandardHeaders, getCurrentOrgId } from "@/lib/organization-utils";
import StatusBadge from "./status-badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, isToday, isYesterday, subDays } from "date-fns";

interface RepairListProps {
  onViewRepair?: (repairId: number) => void;
  onEditRepair?: (repairId: number) => void;
  filterStatus?: string;
  technicianId?: number;
  customerId?: number;
  priorityLevel?: string;
}

export default function RepairList({
  onViewRepair,
  onEditRepair,
  filterStatus,
  technicianId,
  customerId,
  priorityLevel,
}: RepairListProps) {
  const [timeFilter, setTimeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  // Get customer data for displaying names with manual fetch
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    staleTime: 0,
    queryFn: async () => {
      console.log("REPAIR LIST DEBUG: Fetching customers data");
      const headers: Record<string, string> = {
        "X-Debug-Client": "RepairTrackerClient",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };
      
      // Get organization ID from localStorage for proper multi-tenancy
      const orgId = localStorage.getItem('currentOrganizationId');
      if (orgId) {
        console.log(`REPAIR LIST DEBUG: Using organization ID ${orgId} for customers fetch`);
        headers["X-Organization-ID"] = orgId;
      } else {
        console.warn("REPAIR LIST DEBUG: No organization ID found in localStorage for customers fetch");
      }
      
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch("/api/customers", { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch customers: ${response.status}`);
      }
      
      const text = await response.text();
      console.log("REPAIR LIST DEBUG: Customers response:", text.substring(0, 100) + "...");
      
      const data = JSON.parse(text);
      console.log("REPAIR LIST DEBUG: Parsed customers data:", data);
      return data;
    }
  });

  // Get device data for displaying details with manual fetch
  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    staleTime: 0,
    queryFn: async () => {
      console.log("REPAIR LIST DEBUG: Fetching devices data");
      const headers: Record<string, string> = {
        "X-Debug-Client": "RepairTrackerClient",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };
      
      // Get organization ID from localStorage for proper multi-tenancy
      const orgId = localStorage.getItem('currentOrganizationId');
      if (orgId) {
        console.log(`REPAIR LIST DEBUG: Using organization ID ${orgId} for devices fetch`);
        headers["X-Organization-ID"] = orgId;
      } else {
        console.warn("REPAIR LIST DEBUG: No organization ID found in localStorage for devices fetch");
      }
      
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch("/api/devices", { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.status}`);
      }
      
      const text = await response.text();
      console.log("REPAIR LIST DEBUG: Devices response:", text.substring(0, 100) + "...");
      
      const data = JSON.parse(text);
      console.log("REPAIR LIST DEBUG: Parsed devices data:", data);
      return data;
    }
  });

  // Build query params for better caching and proper server-side filtering
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    if (filterStatus) params.append('status', filterStatus);
    if (technicianId) params.append('technicianId', technicianId.toString());
    if (customerId) params.append('customerId', customerId.toString());
    if (priorityLevel) params.append('priority', priorityLevel);
    
    const paramString = params.toString();
    return paramString ? `?${paramString}` : '';
  };

  const queryPath = `/api/repairs${buildQueryParams()}`;
  console.log("REPAIRS DEBUG: Fetching repairs with path:", queryPath);
  
  const { data: repairs, isLoading, error, refetch } = useQuery<Repair[]>({
    queryKey: [queryPath],
    // Ensure fresh data is fetched every time
    staleTime: 0,
    // Use manual query function to ensure proper headers
    queryFn: async () => {
      console.log("REPAIR LIST DEBUG: Starting manual fetch for repairs");
      
      // Add organization ID header and other necessary headers
      const headers: Record<string, string> = {
        "X-Debug-Client": "RepairTrackerClient",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };
      
      // Get organization ID from localStorage for proper multi-tenancy
      const orgId = localStorage.getItem('currentOrganizationId');
      if (orgId) {
        console.log(`REPAIR LIST DEBUG: Using organization ID ${orgId} for repairs fetch`);
        headers["X-Organization-ID"] = orgId;
      } else {
        console.warn("REPAIR LIST DEBUG: No organization ID found in localStorage for repairs fetch");
      }
      
      // Add auth token if available 
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      console.log("REPAIR LIST DEBUG: Making fetch with headers:", headers);
      
      try {
        const response = await fetch(queryPath, { headers });
        console.log("REPAIR LIST DEBUG: Response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch repairs: ${response.status}`);
        }
        
        const text = await response.text();
        console.log("REPAIR LIST DEBUG: Response text preview:", text.substring(0, 100) + "...");
        
        const data = JSON.parse(text);
        console.log("REPAIR LIST DEBUG: Parsed repairs data:", data);
        return data;
      } catch (err) {
        console.error("REPAIR LIST DEBUG: Error fetching repairs:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("REPAIR LIST DEBUG: Successfully loaded repairs:", data?.length || 0);
      if (data?.length) {
        console.log("REPAIR LIST DEBUG: Sample repair:", data[0]);
      }
    },
    onError: (err) => {
      console.error("REPAIR LIST DEBUG: Error loading repairs:", err);
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Repairs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter repairs by time selected and priority if needed
  const getFilteredRepairs = () => {
    if (!repairs) return [];
    
    // Create a copy of repairs to sort and filter
    let filtered = [...repairs];
    
    // Filter by date
    switch (timeFilter) {
      case 'today':
        filtered = filtered.filter(repair => 
          isToday(new Date(repair.intakeDate))
        );
        break;
      case 'yesterday':
        filtered = filtered.filter(repair => 
          isYesterday(new Date(repair.intakeDate))
        );
        break;
      case '7':
        filtered = filtered.filter(repair => 
          new Date(repair.intakeDate) >= subDays(new Date(), 7)
        );
        break;
      case '30':
        filtered = filtered.filter(repair => 
          new Date(repair.intakeDate) >= subDays(new Date(), 30)
        );
        break;
      // 'all' - no filtering needed
    }
    
    // Filter by priority level if not already filtered server-side
    // This is a client-side fallback if server filter wasn't applied
    if (priorityLevel && priorityLevel !== 'all' && 
        !buildQueryParams().includes('priority')) {
      filtered = filtered.filter(repair => 
        repair.priorityLevel === parseInt(priorityLevel, 10)
      );
    }
    
    // Sort by intake date, newest first
    filtered.sort((a, b) => 
      new Date(b.intakeDate).getTime() - new Date(a.intakeDate).getTime()
    );
    
    return filtered;
  };

  const filteredRepairs = getFilteredRepairs();
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredRepairs.length / pageSize);
  const paginatedRepairs = filteredRepairs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value);
    setCurrentPage(1); // Reset to first page when filter changes
    
    // Only invalidate queries if we're not just time-filtering already loaded data
    if (value === 'all') {
      // For "all time" view, we might need fresher data
      queryClient.invalidateQueries({ queryKey: [queryPath] });
    }
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="p-4 border-b border-gray-200 flex flex-row justify-between items-center">
        <CardTitle className="text-lg font-medium text-gray-800">Recent Repairs</CardTitle>
        <div className="flex items-center space-x-2">
          <Select
            value={timeFilter}
            onValueChange={handleTimeFilterChange}
          >
            <SelectTrigger className="text-sm border-gray-300 rounded-md w-[150px]">
              <SelectValue placeholder="Filter by time" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {paginatedRepairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                  No repairs found
                </TableCell>
              </TableRow>
            ) : (
              paginatedRepairs.map((repair) => (
                <TableRow
                  key={repair.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/repairs/view/${repair.id}`)}
                >
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{repair.ticketNumber}</span>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {(() => {
                          // Find the customer
                          const customer = customers?.find(c => c.id === repair.customerId);
                          if (customer) {
                            return `${customer.firstName} ${customer.lastName}`;
                          } else {
                            // Force a specific query for this customer data
                            const fetchCustomer = async () => {
                              try {
                                console.log(`REPAIR LIST DEBUG: Fetching specific customer #${repair.customerId}`);
                                const headers = {
                                  "X-Debug-Client": "RepairTrackerClient",
                                  "Pragma": "no-cache",
                                  "Cache-Control": "no-cache"
                                };
                                
                                // Get organization ID from localStorage for proper multi-tenancy
                                const orgId = localStorage.getItem('currentOrganizationId');
                                if (orgId) {
                                  console.log(`REPAIR LIST DEBUG: Using organization ID ${orgId} for customer ${repair.customerId} fetch`);
                                  headers["X-Organization-ID"] = orgId;
                                } else {
                                  console.warn(`REPAIR LIST DEBUG: No organization ID found in localStorage for customer ${repair.customerId} fetch`);
                                }
                                
                                const token = localStorage.getItem("authToken");
                                if (token) {
                                  headers["Authorization"] = `Bearer ${token}`;
                                }
                                
                                const response = await fetch(`/api/customers/${repair.customerId}`, { headers });
                                if (response.ok) {
                                  const customerData = await response.json();
                                  console.log(`REPAIR LIST DEBUG: Specific customer data fetched:`, customerData);
                                  // Update the cache with this customer
                                  const existingCustomers = queryClient.getQueryData<any[]>(["/api/customers"]) || [];
                                  queryClient.setQueryData(["/api/customers"], 
                                    existingCustomers.filter(c => c.id !== customerData.id).concat([customerData])
                                  );
                                }
                              } catch (err) {
                                console.error(`REPAIR LIST DEBUG: Error fetching customer #${repair.customerId}:`, err);
                              }
                            };
                            
                            // Trigger fetch but don't wait for it
                            fetchCustomer();
                            
                            return `Loading customer #${repair.customerId}...`;
                          }
                        })()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {(() => {
                        if (!repair.deviceId) return "No Device";
                        
                        // Find the device
                        const device = devices?.find(d => d.id === repair.deviceId);
                        if (device) {
                          return `${device.brand} ${device.model}`;
                        } else {
                          // Force a specific query for this device data
                          const fetchDevice = async () => {
                            try {
                              console.log(`REPAIR LIST DEBUG: Fetching specific device #${repair.deviceId}`);
                              const headers = {
                                "X-Debug-Client": "RepairTrackerClient",
                                "Pragma": "no-cache",
                                "Cache-Control": "no-cache"
                              };
                              
                              // Get organization ID from localStorage for proper multi-tenancy
                              const orgId = localStorage.getItem('currentOrganizationId');
                              if (orgId) {
                                console.log(`REPAIR LIST DEBUG: Using organization ID ${orgId} for device ${repair.deviceId} fetch`);
                                headers["X-Organization-ID"] = orgId;
                              } else {
                                console.warn(`REPAIR LIST DEBUG: No organization ID found in localStorage for device ${repair.deviceId} fetch`);
                              }
                              
                              const token = localStorage.getItem("authToken");
                              if (token) {
                                headers["Authorization"] = `Bearer ${token}`;
                              }
                              
                              const response = await fetch(`/api/devices/${repair.deviceId}`, { headers });
                              if (response.ok) {
                                const deviceData = await response.json();
                                console.log(`REPAIR LIST DEBUG: Specific device data fetched:`, deviceData);
                                // Update the cache with this device
                                const existingDevices = queryClient.getQueryData<any[]>(["/api/devices"]) || [];
                                queryClient.setQueryData(["/api/devices"], 
                                  existingDevices.filter(d => d.id !== deviceData.id).concat([deviceData])
                                );
                              }
                            } catch (err) {
                              console.error(`REPAIR LIST DEBUG: Error fetching device #${repair.deviceId}:`, err);
                            }
                          };
                          
                          // Trigger fetch but don't wait for it
                          fetchDevice();
                          
                          return `Loading device #${repair.deviceId}...`;
                        }
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={repair.status} />
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-500">
                      {repair.estimatedCompletionDate ? 
                        format(new Date(repair.estimatedCompletionDate), 'MMM dd, yyyy') 
                        : 'Not set'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewRepair) onViewRepair(repair.id);
                        else navigate(`/repairs/view/${repair.id}`);
                      }}
                    >
                      View
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditRepair) onEditRepair(repair.id);
                        else navigate(`/repairs/edit/${repair.id}`);
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center p-4 border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{" "}
            <span className="font-medium">
              {Math.min(currentPage * pageSize, filteredRepairs.length)}
            </span>{" "}
            of <span className="font-medium">{filteredRepairs.length}</span> results
          </div>
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i + 1}
                variant={currentPage === i + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}