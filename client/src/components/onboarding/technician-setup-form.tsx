import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus, UserPlus } from 'lucide-react';

type Technician = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  specialty?: string;
};

interface TechnicianSetupFormProps {
  data: Technician[];
  onChange: (data: Technician[]) => void;
}

export function TechnicianSetupForm({ data, onChange }: TechnicianSetupFormProps) {
  const handleTechnicianChange = (index: number, field: keyof Technician, value: string) => {
    const updatedTechnicians = [...data];
    updatedTechnicians[index] = { ...updatedTechnicians[index], [field]: value };
    onChange(updatedTechnicians);
  };

  const addTechnician = () => {
    onChange([
      ...data,
      {
        firstName: '',
        lastName: '',
        email: '',
        role: 'Technician',
      },
    ]);
  };

  const removeTechnician = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-4">
        {data.map((technician, index) => (
          <Card key={index} className="border-border">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <UserPlus className="mr-2 h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">
                    {technician.firstName || technician.lastName
                      ? `${technician.firstName} ${technician.lastName}`
                      : `Technician ${index + 1}`}
                  </h3>
                </div>
                {data.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeTechnician(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor={`firstName-${index}`} className="font-medium">First Name *</Label>
                  <Input
                    id={`firstName-${index}`}
                    value={technician.firstName}
                    onChange={(e) => handleTechnicianChange(index, 'firstName', e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`lastName-${index}`} className="font-medium">Last Name *</Label>
                  <Input
                    id={`lastName-${index}`}
                    value={technician.lastName}
                    onChange={(e) => handleTechnicianChange(index, 'lastName', e.target.value)}
                    placeholder="Smith"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor={`email-${index}`} className="font-medium">Email *</Label>
                  <Input
                    id={`email-${index}`}
                    type="email"
                    value={technician.email}
                    onChange={(e) => handleTechnicianChange(index, 'email', e.target.value)}
                    placeholder="john.smith@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`phone-${index}`} className="font-medium">Phone</Label>
                  <Input
                    id={`phone-${index}`}
                    value={technician.phone || ''}
                    onChange={(e) => handleTechnicianChange(index, 'phone', e.target.value)}
                    placeholder="(123) 456-7890"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`role-${index}`} className="font-medium">Role *</Label>
                  <Input
                    id={`role-${index}`}
                    value={technician.role}
                    onChange={(e) => handleTechnicianChange(index, 'role', e.target.value)}
                    placeholder="Technician, Manager, etc."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`specialty-${index}`} className="font-medium">Specialty</Label>
                  <Input
                    id={`specialty-${index}`}
                    value={technician.specialty || ''}
                    onChange={(e) => handleTechnicianChange(index, 'specialty', e.target.value)}
                    placeholder="Laptops, Phones, etc."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button 
        type="button" 
        variant="outline" 
        onClick={addTechnician} 
        className="flex items-center gap-2 w-full"
      >
        <Plus className="h-4 w-4" />
        Add Another Technician
      </Button>

      <p className="text-sm text-muted-foreground mt-2">
        * Required fields
      </p>
    </div>
  );
}