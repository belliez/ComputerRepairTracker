import { useQuery } from "@tanstack/react-query";
import { Repair, Technician } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { repairStatuses, statusConfigs } from "@/types";
import { useState } from "react";
import { useLocation } from "wouter";

interface RepairStatsProps {
  onNewRepair: () => void;
  onNewCustomer: () => void;
  onCreateInvoice: () => void;
  onOrderParts: () => void;
}

export default function RepairStats({ 
  onNewRepair, 
  onNewCustomer, 
  onCreateInvoice, 
  onOrderParts 
}: RepairStatsProps) {
  const { data: repairs, isLoading: isLoadingRepairs } = useQuery<Repair[]>({
    queryKey: ["/api/repairs"],
  });

  const { data: technicians, isLoading: isLoadingTechnicians } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });

  const [showAllTechs, setShowAllTechs] = useState(false);
  const [location, navigate] = useLocation();

  if (isLoadingRepairs || isLoadingTechnicians) {
    return (
      <div className="col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse flex flex-col space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allRepairs = repairs || [];
  const allTechnicians = technicians || [];

  // Count repairs by status
  const statusCounts: Record<string, number> = {};
  
  repairStatuses.forEach(status => {
    statusCounts[status] = allRepairs.filter(repair => repair.status === status).length;
  });

  // Calculate total for percentages
  const totalRepairs = allRepairs.length;

  // Calculate technician workloads
  const techWorkloads = allTechnicians.map(tech => {
    const techRepairs = allRepairs.filter(repair => repair.technicianId === tech.id);
    const urgentRepairs = techRepairs.filter(repair => repair.priorityLevel != null && repair.priorityLevel <= 2);
    
    return {
      ...tech,
      repairCount: techRepairs.length,
      urgentCount: urgentRepairs.length
    };
  }).sort((a, b) => b.repairCount - a.repairCount);

  // Limit the number of technicians shown by default
  const displayedTechnicians = showAllTechs ? techWorkloads : techWorkloads.slice(0, 3);

  return (
    <div className="col-span-1 space-y-6">
      {/* Status Summary Widget */}
      <Card>
        <CardHeader className="p-4 border-b border-gray-200">
          <CardTitle className="text-lg font-medium text-gray-800">Repair Status Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {repairStatuses.map(status => {
            const count = statusCounts[status] || 0;
            const percentage = totalRepairs ? Math.round((count / totalRepairs) * 100) : 0;
            const { color } = statusConfigs[status];
            
            const progressColors = {
              yellow: "bg-yellow-500",
              blue: "bg-blue-500",
              green: "bg-green-500", 
              purple: "bg-purple-500",
              orange: "bg-orange-500",
              red: "bg-red-500",
              gray: "bg-gray-500"
            };
            
            return (
              <div 
                key={status} 
                className="cursor-pointer hover:bg-gray-50 px-2 py-1 -mx-2 rounded transition-colors"
                onClick={() => navigate(`/repairs?status=${status}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${progressColors[color]} mr-2`}></div>
                    <span className="text-sm text-gray-700">{statusConfigs[status].label}</span>
                  </div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2 bg-gray-200"
                  indicatorClassName={progressColors[color]}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
      
      {/* Technician Assignment Widget */}
      <Card>
        <CardHeader className="p-4 border-b border-gray-200">
          <CardTitle className="text-lg font-medium text-gray-800">Technician Workload</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ul className="divide-y divide-gray-200">
            {displayedTechnicians.map(tech => {
              // Generate initials from name
              const initials = `${tech.firstName.charAt(0)}${tech.lastName.charAt(0)}`;
              
              // Randomly assign a color for demo purposes
              const colorClasses = [
                "bg-blue-100 text-blue-600",
                "bg-green-100 text-green-600",
                "bg-purple-100 text-purple-600",
                "bg-yellow-100 text-yellow-600",
                "bg-red-100 text-red-600",
              ];
              
              const colorIndex = tech.id % colorClasses.length;
              const avatarColorClass = colorClasses[colorIndex];
              
              return (
                <li 
                  key={tech.id} 
                  className="py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 px-2 -mx-2 rounded transition-colors"
                  onClick={() => navigate(`/repairs?technicianId=${tech.id}`)}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full ${avatarColorClass} flex items-center justify-center mr-3`}>
                      <span className="font-semibold text-sm">{initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{`${tech.firstName} ${tech.lastName}`}</p>
                      <p className="text-xs text-gray-500">{tech.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{tech.repairCount} repairs</div>
                    {tech.urgentCount > 0 && (
                      <div className="text-xs text-blue-600">{tech.urgentCount} urgent</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          
          {techWorkloads.length > 3 && (
            <div className="mt-4">
              <Button 
                variant="link" 
                className="text-sm text-blue-600 hover:text-blue-800 font-medium p-0"
                onClick={() => setShowAllTechs(!showAllTechs)}
              >
                {showAllTechs ? "Show less" : "View all technicians"} →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Quick Action Buttons */}
      <Card>
        <CardHeader className="p-4 border-b border-gray-200">
          <CardTitle className="text-lg font-medium text-gray-800">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline"
              className="flex flex-col items-center justify-center p-4 h-auto bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onNewRepair}
            >
              <i className="fas fa-plus-circle text-blue-500 text-2xl mb-2"></i>
              <span className="text-sm text-gray-700">New Repair</span>
            </Button>
            
            <Button 
              variant="outline"
              className="flex flex-col items-center justify-center p-4 h-auto bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onNewCustomer}
            >
              <i className="fas fa-user-plus text-green-500 text-2xl mb-2"></i>
              <span className="text-sm text-gray-700">New Customer</span>
            </Button>
            
            <Button 
              variant="outline"
              className="flex flex-col items-center justify-center p-4 h-auto bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onCreateInvoice}
            >
              <i className="fas fa-file-invoice-dollar text-purple-500 text-2xl mb-2"></i>
              <span className="text-sm text-gray-700">Create Invoice</span>
            </Button>
            
            <Button 
              variant="outline"
              className="flex flex-col items-center justify-center p-4 h-auto bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onOrderParts}
            >
              <i className="fas fa-box text-orange-500 text-2xl mb-2"></i>
              <span className="text-sm text-gray-700">Order Parts</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
