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
  filterPriority?: string;
  searchQuery?: string;
  searchTechnician?: number;
  showButtons?: boolean;
  showDetailButton?: boolean;
  simpleView?: boolean;
  limitRows?: number;
  showSearch?: boolean;
  standalone?: boolean;
  onRefreshNeeded?: () => void;
}

export default function RepairList({
  onViewRepair,
  onEditRepair,
  filterStatus,
  filterPriority,
  searchQuery = '',
  searchTechnician,
  showButtons = true,
  showDetailButton = true,
  simpleView = false,
  limitRows,
  showSearch = true,
  standalone = false,
  onRefreshNeeded,
}: RepairListProps) {
  const [location, setLocation] = useLocation();
  const [internalSearch, setInternalSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customers for name resolution
  useEffect(() => {
    console.log('REPAIR LIST DEBUG: Fetching customers data');
    
    const fetchCustomers = async () => {
      try {
        const headers: any = {
          ...getStandardHeaders(),
          'X-Debug-Client': 'RepairTrackerClient',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        };
      
        const token = localStorage.getItem("authToken");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
    
        const response = await fetch('/api/customers', { headers });
        console.log('REPAIR LIST DEBUG: Customers response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('REPAIR LIST DEBUG: Parsed customers data:', data);
          setCustomers(data);
        }
      } catch (error) {
        console.error('Error fetching customer data:', error);
      }
    };
    
    fetchCustomers();
  }, []);
  
  // Fetch devices for detail resolution
  useEffect(() => {
    console.log('REPAIR LIST DEBUG: Fetching devices data');
    
    const fetchDevices = async () => {
      try {
        const headers: any = {
          ...getStandardHeaders(),
          'X-Debug-Client': 'RepairTrackerClient',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        };
      
        const token = localStorage.getItem("authToken");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
    
        const response = await fetch('/api/devices', { headers });
        console.log('REPAIR LIST DEBUG: Devices response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('REPAIR LIST DEBUG: Parsed devices data:', data);
          setDevices(data);
        }
      } catch (error) {
        console.error('Error fetching device data:', error);
      }
    };
    
    fetchDevices();
  }, []);

  // Manually fetch repairs instead of using react-query to have more control over loading states
  const fetchRepairs = async () => {
    console.log('REPAIR LIST DEBUG: Starting manual fetch for repairs');
    setIsLoading(true);
    
    try {
      let path = '/api/repairs';
      
      const params = new URLSearchParams();
      if (filterStatus) {
        params.append('status', filterStatus);
      }
      if (filterPriority) {
        params.append('priority', filterPriority);
      }
      if (searchTechnician) {
        params.append('technicianId', searchTechnician.toString());
      }
      
      const queryString = params.toString();
      if (queryString) {
        path += `?${queryString}`;
      }
      
      console.log('REPAIR LIST DEBUG: Making fetch with headers:', getStandardHeaders());
      
      const response = await fetch(path, { 
        headers: {
          ...getStandardHeaders(),
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log('REPAIR LIST DEBUG: Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('REPAIR LIST DEBUG: Parsed repairs data:', data);
        setRepairs(data);
      } else {
        console.error('Failed to fetch repairs:', response.status);
        toast({
          title: "Error fetching repairs",
          description: `Server returned: ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching repairs:', error);
      toast({
        title: "Error fetching repairs",
        description: "Check your connection and try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initial fetch and refresh on filter changes
  useEffect(() => {
    fetchRepairs();
  }, [filterStatus, filterPriority, searchTechnician]);
  
  // Handle repair deletion
  const handleDeleteRepair = async (repairId: number) => {
    if (!window.confirm("Are you sure you want to delete this repair? This action cannot be undone.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/repairs/${repairId}`, {
        method: 'DELETE',
        headers: {
          ...getStandardHeaders(),
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        toast({
          title: "Repair deleted",
          description: "The repair has been successfully deleted",
        });
        
        // Refresh repairs
        fetchRepairs();
        
        // Notify parent if needed
        if (onRefreshNeeded) {
          onRefreshNeeded();
        }
      } else {
        toast({
          title: "Error deleting repair",
          description: "The repair could not be deleted. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting repair:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    if (isToday(date)) {
      return `Today, ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    } else if (date > subDays(new Date(), 7)) {
      return format(date, 'EEE, MMM d');
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };
  
  // Get customer name from ID
  const getCustomerName = (customerId: number) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer';
  };
  
  // Get device info from ID
  const getDeviceInfo = (deviceId: number | null) => {
    if (!deviceId) return 'No device';
    const device = devices.find(d => d.id === deviceId);
    return device ? `${device.brand} ${device.model}` : 'Unknown Device';
  };
  
  // Filter and search repairs
  const filteredRepairs = repairs
    .filter(repair => {
      // Skip deleted items
      if (repair.deleted) return false;
      
      // Apply status filter if set
      if (filterStatus && repair.status !== filterStatus) return false;
      
      // Apply priority filter if set
      if (filterPriority && repair.priorityLevel?.toString() !== filterPriority) return false;
      
      // Apply technician filter if set
      if (searchTechnician && repair.technicianId !== searchTechnician) return false;
      
      // Apply search query (checks ticket number, customer name, device info)
      const searchTermLower = (searchQuery || internalSearch).toLowerCase();
      if (searchTermLower) {
        const customerName = getCustomerName(repair.customerId).toLowerCase();
        const deviceInfo = getDeviceInfo(repair.deviceId).toLowerCase();
        const ticketNumber = repair.ticketNumber.toLowerCase();
        
        return customerName.includes(searchTermLower) || 
               deviceInfo.includes(searchTermLower) || 
               ticketNumber.includes(searchTermLower) ||
               (repair.notes && repair.notes.toLowerCase().includes(searchTermLower));
      }
      
      return true;
    })
    // Sort by intake date, newest first
    .sort((a, b) => new Date(b.intakeDate || 0).getTime() - new Date(a.intakeDate || 0).getTime())
    // Apply limit if set
    .slice(0, limitRows || repairs.length);
    
  // Handle "View Repair" button click
  const handleViewClick = (repairId: number) => {
    if (onViewRepair) {
      onViewRepair(repairId);
    } else {
      setLocation(`/repairs/${repairId}`);
    }
  };
  
  // Handle "Edit Repair" button click
  const handleEditClick = (repairId: number) => {
    if (onEditRepair) {
      onEditRepair(repairId);
    } else {
      setLocation(`/repairs/edit/${repairId}`);
    }
  };
  
  // Determine if repairs are loading
  const loading = isLoading || !repairs;

  return (
    <div className={`w-full ${standalone ? 'p-4' : ''}`}>
      {standalone && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Repairs</h2>
          <Button onClick={() => setLocation('/repairs/new')}>
            New Repair
          </Button>
        </div>
      )}
      
      {showSearch && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search repairs..."
            className="w-full p-2 border rounded"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
          />
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading repairs...</p>
        </div>
      ) : filteredRepairs.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <p className="text-lg text-gray-600 mb-2">No repairs found</p>
          <p className="text-gray-500">
            {filterStatus || filterPriority || searchQuery || internalSearch 
              ? "Try adjusting your filters or search terms"
              : "Create your first repair ticket to get started"}
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto ${simpleView ? '' : 'border rounded-lg'}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Intake Date</TableHead>
                {!simpleView && <TableHead>Completed</TableHead>}
                {showButtons && <TableHead className="w-28">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRepairs.map((repair) => (
                <TableRow
                  key={repair.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => showDetailButton ? handleViewClick(repair.id) : null}
                >
                  <TableCell className="font-medium">{repair.ticketNumber}</TableCell>
                  <TableCell>{getCustomerName(repair.customerId)}</TableCell>
                  <TableCell>{getDeviceInfo(repair.deviceId)}</TableCell>
                  <TableCell>
                    <StatusBadge status={repair.status} />
                  </TableCell>
                  <TableCell>{formatDate(repair.intakeDate as unknown as string)}</TableCell>
                  {!simpleView && (
                    <TableCell>{formatDate(repair.actualCompletionDate as unknown as string)}</TableCell>
                  )}
                  {showButtons && (
                    <TableCell className="space-x-2">
                      {showDetailButton && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewClick(repair.id);
                          }}
                        >
                          View
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(repair.id);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRepair(repair.id);
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}