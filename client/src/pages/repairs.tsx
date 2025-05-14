import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Repair } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { RepairTab, repairStatuses, statusConfigs, URGENT_PRIORITY_LEVELS, priorityLevels } from "@/types";
import { Link, useLocation } from "wouter";
import RepairList from "@/components/repairs/repair-list-fixed";
import RepairDetail from "@/components/repairs/repair-detail-fixed";
import { getStandardHeaders, getCurrentOrgId } from "@/lib/organization-utils";

export default function Repairs() {
  const [activeTab, setActiveTab] = useState<RepairTab>("all");
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterPriority, setFilterPriority] = useState<string | undefined>(undefined);
  const [filterTechnicianId, setFilterTechnicianId] = useState<number | undefined>(undefined);
  const [filterCustomerId, setFilterCustomerId] = useState<number | undefined>(undefined);
  const [showFilter, setShowFilter] = useState(false);
  // State for repair details is no longer needed as we're navigating to a dedicated page
  const [location, navigate] = useLocation();
  
  // Parse URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Handle status filter
    const statusParam = params.get('status');
    if (statusParam) {
      if (statusParam.includes(',')) {
        // Multiple statuses - set active tab to 'all' but apply filter
        setActiveTab("all");
        setFilterStatus(statusParam);
      } else {
        // Single status - set as active tab if it's a valid tab
        const validStatus = repairStatuses.includes(statusParam as any) ? statusParam as RepairTab : "all";
        setActiveTab(validStatus);
        setFilterStatus(statusParam);
      }
    }
    
    // Handle priority filter
    const priorityParam = params.get('priority');
    if (priorityParam) {
      setFilterPriority(priorityParam);
    }
    
    // Handle technician filter
    const technicianParam = params.get('technicianId');
    if (technicianParam && !isNaN(Number(technicianParam))) {
      setFilterTechnicianId(Number(technicianParam));
    }
    
    // Handle customer filter
    const customerParam = params.get('customerId');
    if (customerParam && !isNaN(Number(customerParam))) {
      setFilterCustomerId(Number(customerParam));
    }
  }, [location]);

  // Build query key with all filters
  const buildQueryKey = () => {
    const filters = {};
    
    if (filterStatus) Object.assign(filters, { status: filterStatus });
    if (filterPriority) Object.assign(filters, { priority: filterPriority });
    if (filterTechnicianId) Object.assign(filters, { technicianId: filterTechnicianId });
    if (filterCustomerId) Object.assign(filters, { customerId: filterCustomerId });
    
    return Object.keys(filters).length > 0 ? filters : null;
  };
  
  // Use manual fetching approach to ensure data is properly loaded
  const { data: repairs, isLoading, refetch, error } = useQuery<Repair[]>({
    queryKey: [
      "/api/repairs",
      buildQueryKey(),
    ],
    // Ensure fresh data is fetched every time
    staleTime: 0,
    // Use manual query function to ensure proper headers
    queryFn: async () => {
      console.log("REPAIRS PAGE DEBUG: Starting manual fetch for repairs");
      
      // Create path with query parameters
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      if (filterTechnicianId) params.append('technicianId', filterTechnicianId.toString());
      if (filterCustomerId) params.append('customerId', filterCustomerId.toString());
      const queryString = params.toString();
      const path = `/api/repairs${queryString ? `?${queryString}` : ''}`;
      
      console.log("REPAIRS PAGE DEBUG: Fetching from path:", path);
      
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
      
      console.log("REPAIRS PAGE DEBUG: Using headers:", headers);
      
      try {
        const response = await fetch(path, { headers });
        console.log("REPAIRS PAGE DEBUG: Response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch repairs: ${response.status}`);
        }
        
        const text = await response.text();
        console.log("REPAIRS PAGE DEBUG: Response preview:", text.substring(0, 100) + "...");
        
        const data = JSON.parse(text);
        console.log("REPAIRS PAGE DEBUG: Parsed repairs data:", data);
        return data;
      } catch (err) {
        console.error("REPAIRS PAGE DEBUG: Error fetching repairs:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("REPAIRS PAGE DEBUG: Successfully loaded repairs:", data?.length || 0);
    },
    onError: (err) => {
      console.error("REPAIRS PAGE DEBUG: Error loading repairs:", err);
    }
  });

  const handleTabChange = (tab: RepairTab) => {
    setActiveTab(tab);
    
    // Reset priority filter when switching tabs
    if (tab !== "urgent") {
      setFilterPriority(undefined);
    }
    
    // Set status filter based on tab
    if (tab === "all") {
      setFilterStatus(undefined);
    } else if (tab === "urgent") {
      setFilterStatus(undefined);
      setFilterPriority(URGENT_PRIORITY_LEVELS.join(','));
    } else {
      setFilterStatus(tab);
    }
  };

  const handleViewRepair = (repairId: number) => {
    // Navigate to the repair detail page
    navigate(`/repairs/${repairId}`);
  };

  const handleEditRepair = (repairId: number) => {
    navigate(`/repairs/edit/${repairId}`);
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Repairs</h1>
          <p className="text-sm text-gray-500">Manage and track all computer repair tickets</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowFilter(!showFilter)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            <i className="fas fa-filter mr-1"></i> Filter
          </Button>
          <Link to="/repairs/create">
            <Button
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              <i className="fas fa-plus mr-1"></i> New Repair
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-1">
            <a 
              href="#" 
              className={`inline-block py-2 px-4 text-sm font-medium ${
                activeTab === "all" 
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent"
              }`}
              onClick={(e) => {
                e.preventDefault();
                handleTabChange("all");
              }}
            >
              All Repairs
            </a>
          </li>
          <li className="mr-1">
            <a 
              href="#" 
              className={`inline-block py-2 px-4 text-sm font-medium ${
                activeTab === "urgent" 
                  ? "text-red-600 border-b-2 border-red-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent"
              }`}
              onClick={(e) => {
                e.preventDefault();
                handleTabChange("urgent");
              }}
            >
              <span className="flex items-center">
                <span className="mr-1 text-red-500">●</span>
                Urgent
              </span>
            </a>
          </li>
          {repairStatuses.map((status) => {
            // Skip 'cancelled' and 'completed' from tabs to match design
            if (status === 'cancelled' || status === 'completed') return null;
            
            // Rename "in_repair" to "In Progress" for display
            const label = status === 'in_repair' ? 'In Progress' : statusConfigs[status].label;
            
            return (
              <li key={status} className="mr-1">
                <a 
                  href="#" 
                  className={`inline-block py-2 px-4 text-sm font-medium ${
                    activeTab === status 
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTabChange(status);
                  }}
                >
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 gap-6">
        <RepairList 
          onViewRepair={handleViewRepair}
          onEditRepair={handleEditRepair}
          filterStatus={filterStatus}
          technicianId={filterTechnicianId}
          customerId={filterCustomerId}
          priorityLevel={filterPriority}
        />
      </div>

      {/* Repair details are now handled via the repair-detail.tsx page */}
    </>
  );
}
