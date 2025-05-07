import { ReactNode, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, X, Check } from "lucide-react";

interface InformationSectionProps {
  title: string;
  children: ReactNode;
  editForm?: ReactNode;
  onSave?: () => void;
  onCancel?: () => void;
  canEdit?: boolean;
}

export default function InformationSection({
  title,
  children,
  editForm,
  onSave,
  onCancel,
  canEdit = true
}: InformationSectionProps) {
  const [isEditing, setIsEditing] = useState(false);

  const startEditing = () => {
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    if (onCancel) onCancel();
  };

  const saveChanges = () => {
    if (onSave) onSave();
    setIsEditing(false);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{title}</CardTitle>
          {canEdit && !isEditing && editForm && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={startEditing}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit {title}</span>
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-destructive hover:text-destructive/90" 
                onClick={cancelEditing}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cancel</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700" 
                onClick={saveChanges}
              >
                <Check className="h-4 w-4" />
                <span className="sr-only">Save</span>
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? editForm : children}
      </CardContent>
    </Card>
  );
}