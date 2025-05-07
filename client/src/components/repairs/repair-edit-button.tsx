import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import MobileIntakeForm from './mobile-intake-form';
import { useQueryClient } from '@tanstack/react-query';

interface RepairEditButtonProps {
  repairId: number;
}

export default function RepairEditButton({ repairId }: RepairEditButtonProps) {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleClose = () => {
    setIsEditing(false);
    // Refresh the repair data
    queryClient.invalidateQueries({ queryKey: [`/api/repairs/${repairId}/details`] });
  };
  
  return (
    <>
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleEdit}
        className="flex items-center gap-1"
      >
        <Edit className="h-4 w-4" />
        <span>Edit</span>
      </Button>
      
      {isEditing && (
        <MobileIntakeForm
          repairId={repairId}
          isOpen={isEditing}
          onClose={handleClose}
        />
      )}
    </>
  );
}