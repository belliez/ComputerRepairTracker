import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import RepairDetail from "@/components/repairs/repair-detail-fixed";

export default function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const repairId = parseInt(id || '0', 10);
  
  // Redirect to repairs page if no valid ID
  useEffect(() => {
    if (!repairId) {
      navigate("/repairs");
    }
  }, [repairId, navigate]);
  
  if (!repairId) return null;
  
  return (
    <div>
      <div className="mb-6 flex items-center">
        <Button 
          variant="ghost" 
          className="mr-2" 
          onClick={() => navigate("/repairs")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Repairs
        </Button>
        <h1 className="text-2xl font-semibold text-gray-800">Repair Details</h1>
      </div>
      
      <RepairDetail 
        repairId={repairId} 
        isOpen={true} 
        onClose={() => navigate("/repairs")}
        isStandalonePage={true}
      />
    </div>
  );
}