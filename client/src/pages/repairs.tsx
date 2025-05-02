import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Repair } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { RepairTab, repairStatuses, statusConfigs } from "@/types";
import RepairList from "@/components/repairs/repair-list";
import RepairDetail from "@/components/repairs/repair-detail";
import IntakeForm from "@/components/repairs/intake-form";

export default function Repairs() {
  const [activeTab, setActiveTab] = useState<RepairTab>("all");
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [showFilter, setShowFilter] = useState(false);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [showRepairDetail, setShowRepairDetail] = useState(false);
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);

  const { data: repairs, isLoading } = useQuery<Repair[]>({
    queryKey: [
      "/api/repairs",
      filterStatus ? { status: filterStatus } : null,
    ],
  });

  const handleTabChange = (tab: RepairTab) => {
    setActiveTab(tab);
    if (tab === "all") {
      setFilterStatus(undefined);
    } else {
      setFilterStatus(tab);
    }
  };

  const handleNewRepair = () => {
    setSelectedRepairId(null);
    setShowIntakeForm(true);
  };

  const handleViewRepair = (repairId: number) => {
    setSelectedRepairId(repairId);
    setShowRepairDetail(true);
  };

  const handleEditRepair = (repairId: number) => {
    setSelectedRepairId(repairId);
    setShowIntakeForm(true);
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
          <Button
            onClick={handleNewRepair}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <i className="fas fa-plus mr-1"></i> New Repair
          </Button>
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
        />
      </div>

      {/* Modals */}
      {showIntakeForm && (
        <IntakeForm 
          repairId={selectedRepairId} 
          isOpen={showIntakeForm} 
          onClose={() => setShowIntakeForm(false)}
        />
      )}

      {showRepairDetail && selectedRepairId && (
        <RepairDetail 
          repairId={selectedRepairId} 
          isOpen={showRepairDetail} 
          onClose={() => setShowRepairDetail(false)}
        />
      )}
    </>
  );
}
