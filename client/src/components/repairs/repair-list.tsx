import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Repair, Customer, Device } from "@shared/schema";
import StatusBadge from "./status-badge";
import { Button } from "@/components/ui/button";
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
}

export default function RepairList({
  onViewRepair,
  onEditRepair,
  filterStatus,
  technicianId,
  customerId,
}: RepairListProps) {
  const [timeFilter, setTimeFilter] = useState("7");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const queryClient = useQueryClient();

  // Get customer data for displaying names
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Get device data for displaying details
  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  // Build query params for better caching and proper server-side filtering
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    if (filterStatus) params.append('status', filterStatus);
    if (technicianId) params.append('technicianId', technicianId.toString());
    if (customerId) params.append('customerId', customerId.toString());
    
    const paramString = params.toString();
    return paramString ? `?${paramString}` : '';
  };

  const queryPath = `/api/repairs${buildQueryParams()}`;
  
  const { data: repairs, isLoading } = useQuery<Repair[]>({
    queryKey: [queryPath],
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

  // Filter repairs by time selected
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
    
    // Make sure data is fresh
    queryClient.invalidateQueries({ queryKey: [queryPath] });
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
                  onClick={() => onViewRepair && onViewRepair(repair.id)}
                >
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{repair.ticketNumber}</span>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {customers?.find(c => c.id === repair.customerId)
                          ? `${customers.find(c => c.id === repair.customerId)?.firstName} ${customers.find(c => c.id === repair.customerId)?.lastName}`
                          : `Customer #${repair.customerId}`
                        }
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {repair.deviceId && devices?.find(d => d.id === repair.deviceId) 
                        ? `${devices.find(d => d.id === repair.deviceId)?.brand} ${devices.find(d => d.id === repair.deviceId)?.model}`
                        : repair.deviceId ? `Device #${repair.deviceId}` : "No Device"
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      {repair.issue}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={repair.status} />
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {repair.estimatedCompletionDate
                      ? format(new Date(repair.estimatedCompletionDate), "MMM d, yyyy")
                      : "No date set"}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:text-blue-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditRepair && onEditRepair(repair.id);
                        }}
                      >
                        <i className="fas fa-edit"></i>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-600 hover:text-gray-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewRepair && onViewRepair(repair.id);
                        }}
                      >
                        <i className="fas fa-eye"></i>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, filteredRepairs.length)}
                </span>{" "}
                of <span className="font-medium">{filteredRepairs.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Previous</span>
                  <i className="fas fa-chevron-left h-5 w-5"></i>
                </Button>
                
                {Array.from({ length: totalPages }).map((_, index) => (
                  <Button
                    key={index}
                    variant={currentPage === index + 1 ? "default" : "outline"}
                    onClick={() => handlePageChange(index + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                      currentPage === index + 1
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {index + 1}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Next</span>
                  <i className="fas fa-chevron-right h-5 w-5"></i>
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
