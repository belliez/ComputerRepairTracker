import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Repair, Technician } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { statusConfigs, repairStatuses } from "@/types";
import RepairList from "@/components/repairs/repair-list";
import RepairStats from "@/components/repairs/repair-stats";
import RepairDetail from "@/components/repairs/repair-detail";
import IntakeForm from "@/components/repairs/intake-form";
import CustomerForm from "@/components/customers/customer-form";
import QuoteForm from "@/components/repairs/quote-form";
import InvoiceForm from "@/components/repairs/invoice-form";
import PartsForm from "@/components/inventory/parts-form";

export default function Dashboard() {
  // Modal states
  const [showRepairDetail, setShowRepairDetail] = useState(false);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showPartsForm, setShowPartsForm] = useState(false);
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  
  // Get repair data with regular refresh
  const { data: repairs, isLoading: isLoadingRepairs } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
  
  // When a form closes, make sure to refresh the data
  useEffect(() => {
    if (!showIntakeForm && !showCustomerForm && !showInvoiceForm) {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
    }
  }, [showIntakeForm, showCustomerForm, showInvoiceForm, queryClient]);

  // Handler functions
  const handleViewRepair = (repairId: number) => {
    setSelectedRepairId(repairId);
    setShowRepairDetail(true);
  };

  const handleEditRepair = (repairId: number) => {
    setSelectedRepairId(repairId);
    setShowIntakeForm(true);
  };

  const handleNewRepair = () => {
    setSelectedRepairId(null);
    setShowIntakeForm(true);
  };

  const handleNewCustomer = () => {
    setShowCustomerForm(true);
  };

  const handleCreateInvoice = () => {
    setShowInvoiceForm(true);
  };

  const handleOrderParts = () => {
    setShowPartsForm(true);
  };

  // Dashboard stats card
  const DashboardStats = () => {
    if (isLoadingRepairs) {
      return (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 justify-between">
              <div className="animate-pulse w-40 h-24 bg-gray-200 rounded"></div>
              <div className="animate-pulse w-40 h-24 bg-gray-200 rounded"></div>
              <div className="animate-pulse w-40 h-24 bg-gray-200 rounded"></div>
              <div className="animate-pulse w-40 h-24 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      );
    }

    const allRepairs = repairs || [];
    const totalRepairs = allRepairs.length;
    const activeRepairs = allRepairs.filter(r => 
      !['completed', 'cancelled'].includes(r.status)
    ).length;
    const urgentRepairs = allRepairs.filter(r => r.priorityLevel != null && r.priorityLevel <= 2).length;
    const completedRepairs = allRepairs.filter(r => r.status === 'completed').length;

    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 justify-between">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <div className="text-gray-500 text-sm mb-1">Total Repairs</div>
              <div className="text-3xl font-bold text-gray-800">{totalRepairs}</div>
              <div className="mt-2 text-sm text-gray-400">All time</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <div className="text-gray-500 text-sm mb-1">Active Repairs</div>
              <div className="text-3xl font-bold text-blue-600">{activeRepairs}</div>
              <div className="mt-2 text-sm text-gray-400">In progress</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <div className="text-gray-500 text-sm mb-1">Urgent Repairs</div>
              <div className="text-3xl font-bold text-red-500">{urgentRepairs}</div>
              <div className="mt-2 text-sm text-gray-400">High priority</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <div className="text-gray-500 text-sm mb-1">Completed</div>
              <div className="text-3xl font-bold text-green-600">{completedRepairs}</div>
              <div className="mt-2 text-sm text-gray-400">This month</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of repair operations</p>
      </div>

      {/* Dashboard Statistics */}
      <DashboardStats />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RepairList 
          onViewRepair={handleViewRepair} 
          onEditRepair={handleEditRepair} 
        />

        <RepairStats 
          onNewRepair={handleNewRepair}
          onNewCustomer={handleNewCustomer}
          onCreateInvoice={handleCreateInvoice}
          onOrderParts={handleOrderParts}
        />
      </div>

      {/* Modals */}
      {showRepairDetail && selectedRepairId && (
        <RepairDetail 
          repairId={selectedRepairId} 
          isOpen={showRepairDetail} 
          onClose={() => setShowRepairDetail(false)}
        />
      )}

      {showIntakeForm && (
        <IntakeForm 
          repairId={selectedRepairId} 
          isOpen={showIntakeForm} 
          onClose={() => {
            setShowIntakeForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
          }}
        />
      )}

      {showCustomerForm && (
        <CustomerForm 
          isOpen={showCustomerForm} 
          onClose={() => {
            setShowCustomerForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
          }}
        />
      )}

      {showInvoiceForm && (
        <InvoiceForm 
          repairId={selectedRepairId}
          isOpen={showInvoiceForm} 
          onClose={() => {
            setShowInvoiceForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/repairs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
          }}
        />
      )}

      {showPartsForm && (
        <PartsForm 
          isOpen={showPartsForm} 
          onClose={() => {
            setShowPartsForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
          }}
        />
      )}
    </>
  );
}
