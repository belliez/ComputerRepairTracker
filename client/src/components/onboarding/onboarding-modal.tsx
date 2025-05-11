import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

// Company information form
function CompanyInfoForm({ onComplete }: { onComplete: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const { toast } = useToast();
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: 'Company name required',
        description: 'Please enter your company name to continue',
        variant: 'destructive',
      });
      return;
    }
    
    onComplete(formData);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Company Name *</Label>
          <Input 
            id="name" 
            name="name" 
            placeholder="Your company name" 
            value={formData.name} 
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Business Email</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            placeholder="contact@yourcompany.com" 
            value={formData.email} 
            onChange={handleChange}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input 
            id="phone" 
            name="phone" 
            placeholder="Your business phone" 
            value={formData.phone} 
            onChange={handleChange}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="address">Business Address</Label>
          <Input 
            id="address" 
            name="address" 
            placeholder="Your business address" 
            value={formData.address} 
            onChange={handleChange}
          />
        </div>
      </div>
      
      <Button type="submit" className="w-full">
        Save Company Information
      </Button>
    </form>
  );
}

// Tax settings form
function TaxSettingsForm({ onComplete }: { onComplete: (taxRates: any) => void }) {
  const [taxRates, setTaxRates] = useState([
    { name: 'Sales Tax', rate: 7.5, isDefault: true }
  ]);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');
  const { toast } = useToast();
  
  const handleAddTax = () => {
    if (!newTaxName || !newTaxRate) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both a name and rate for the tax',
        variant: 'destructive',
      });
      return;
    }
    
    const rate = parseFloat(newTaxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast({
        title: 'Invalid Tax Rate',
        description: 'Please enter a valid tax rate between 0 and 100',
        variant: 'destructive',
      });
      return;
    }
    
    setTaxRates([...taxRates, {
      name: newTaxName,
      rate: rate,
      isDefault: false
    }]);
    
    setNewTaxName('');
    setNewTaxRate('');
  };
  
  const setAsDefault = (index: number) => {
    setTaxRates(taxRates.map((tax, i) => ({
      ...tax,
      isDefault: i === index
    })));
  };
  
  const removeTax = (index: number) => {
    // Don't allow removing if it's the only tax rate
    if (taxRates.length <= 1) {
      toast({
        title: 'Cannot Remove',
        description: 'You must have at least one tax rate',
        variant: 'destructive',
      });
      return;
    }
    
    // If removing the default tax, make another one default
    const isRemovingDefault = taxRates[index].isDefault;
    
    const newTaxRates = taxRates.filter((_, i) => i !== index);
    
    if (isRemovingDefault && newTaxRates.length > 0) {
      newTaxRates[0].isDefault = true;
    }
    
    setTaxRates(newTaxRates);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that we have at least one tax rate
    if (taxRates.length === 0) {
      setTaxRates([{ name: 'Sales Tax', rate: 7.5, isDefault: true }]);
    }
    
    // Ensure we have a default tax rate
    const hasDefault = taxRates.some(tax => tax.isDefault);
    if (!hasDefault && taxRates.length > 0) {
      const updatedTaxRates = [...taxRates];
      updatedTaxRates[0].isDefault = true;
      setTaxRates(updatedTaxRates);
      onComplete(updatedTaxRates);
    } else {
      onComplete(taxRates);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="font-medium mb-2">Current Tax Rates</div>
          <Separator className="my-2" />
          
          {taxRates.map((tax, index) => (
            <div key={index} className="flex justify-between items-center py-2 border-b last:border-0 border-gray-100">
              <div>
                <span className="font-medium">{tax.name}</span>
                {tax.isDefault && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="mr-2">{tax.rate}%</span>
                {!tax.isDefault && (
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={() => setAsDefault(index)}
                  >
                    Make Default
                  </Button>
                )}
                <Button 
                  type="button" 
                  size="sm" 
                  variant="destructive"
                  onClick={() => removeTax(index)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </Card>
        
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-6">
            <Label htmlFor="newTaxName">Tax Name</Label>
            <Input
              id="newTaxName"
              value={newTaxName}
              onChange={(e) => setNewTaxName(e.target.value)}
              placeholder="e.g. VAT, GST"
            />
          </div>
          
          <div className="col-span-4">
            <Label htmlFor="newTaxRate">Rate (%)</Label>
            <Input
              id="newTaxRate"
              value={newTaxRate}
              onChange={(e) => setNewTaxRate(e.target.value)}
              placeholder="e.g. 10"
              type="number"
              step="0.01"
            />
          </div>
          
          <div className="col-span-2 flex items-end">
            <Button 
              type="button" 
              onClick={handleAddTax} 
              disabled={!newTaxName || !newTaxRate}
              className="w-full"
            >
              Add
            </Button>
          </div>
        </div>
      </div>
      
      <Button type="submit" className="w-full">
        Save Tax Settings
      </Button>
    </form>
  );
}

// Currency settings form
function CurrencySettingsForm({ onComplete }: { onComplete: (currency: any) => void }) {
  const [currency, setCurrency] = useState({
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    isDefault: true
  });
  
  const popularCurrencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  ];
  
  const handleCurrencySelect = (curr: any) => {
    setCurrency({
      ...curr,
      isDefault: true
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(currency);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="font-medium mb-2">Selected Currency</div>
          <Separator className="my-2" />
          <div className="flex justify-between items-center py-2">
            <div>
              <span className="font-medium">{currency.name} ({currency.code})</span>
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
            </div>
            <span>{currency.symbol}</span>
          </div>
        </Card>
        
        <div className="space-y-2">
          <Label>Select Currency</Label>
          <div className="grid grid-cols-2 gap-2">
            {popularCurrencies.map((curr) => (
              <Button
                key={curr.code}
                type="button"
                variant={currency.code === curr.code ? "default" : "outline"}
                className="justify-start"
                onClick={() => handleCurrencySelect(curr)}
              >
                <span className="mr-2">{curr.symbol}</span>
                <span>{curr.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <Button type="submit" className="w-full">
        Save Currency Settings
      </Button>
    </form>
  );
}

// Technician setup form
function TechnicianSetupForm({ onComplete }: { onComplete: (technicians: any) => void }) {
  const [technicians, setTechnicians] = useState([
    { name: '', email: '', phone: '', role: '', isActive: true }
  ]);
  
  const handleChange = (index: number, field: string, value: string) => {
    const updatedTechnicians = [...technicians];
    updatedTechnicians[index] = {
      ...updatedTechnicians[index],
      [field]: value
    };
    setTechnicians(updatedTechnicians);
  };
  
  const handleAddTechnician = () => {
    setTechnicians([
      ...technicians,
      { name: '', email: '', phone: '', role: '', isActive: true }
    ]);
  };
  
  const handleRemoveTechnician = (index: number) => {
    if (technicians.length === 1) return;
    const updatedTechnicians = technicians.filter((_, i) => i !== index);
    setTechnicians(updatedTechnicians);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty technicians
    const validTechnicians = technicians.filter(tech => tech.name.trim() !== '');
    
    if (validTechnicians.length === 0) {
      setTechnicians([{ name: '', email: '', phone: '', role: '', isActive: true }]);
      return;
    }
    
    onComplete(validTechnicians);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {technicians.map((technician, index) => (
          <Card key={index} className="p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">Technician #{index + 1}</div>
              {technicians.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveTechnician(index)}
                >
                  Remove
                </Button>
              )}
            </div>
            <Separator className="my-2" />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`name-${index}`}>Name</Label>
                <Input
                  id={`name-${index}`}
                  value={technician.name}
                  onChange={(e) => handleChange(index, 'name', e.target.value)}
                  placeholder="Technician name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`role-${index}`}>Role</Label>
                <Input
                  id={`role-${index}`}
                  value={technician.role}
                  onChange={(e) => handleChange(index, 'role', e.target.value)}
                  placeholder="e.g. Senior Technician"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`email-${index}`}>Email</Label>
                <Input
                  id={`email-${index}`}
                  type="email"
                  value={technician.email}
                  onChange={(e) => handleChange(index, 'email', e.target.value)}
                  placeholder="Tech email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`phone-${index}`}>Phone</Label>
                <Input
                  id={`phone-${index}`}
                  value={technician.phone}
                  onChange={(e) => handleChange(index, 'phone', e.target.value)}
                  placeholder="Tech phone"
                />
              </div>
            </div>
          </Card>
        ))}
        
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleAddTechnician}
        >
          Add Another Technician
        </Button>
      </div>
      
      <Button type="submit" className="w-full">
        Save Technicians
      </Button>
    </form>
  );
}

export function OnboardingModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activeStep, setActiveStep] = useState('company');
  const [progress, setProgress] = useState(25);
  const { currentOrganization, refreshCurrentOrganization } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [completed, setCompleted] = useState({
    company: false,
    tax: false,
    currency: false,
    technicians: false
  });
  
  // Save organization settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/settings/organization', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      refreshCurrentOrganization();
    },
    onError: (error: any) => {
      console.error('Failed to save settings:', error);
      
      // Get the detailed error information if available
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      
      toast({
        title: 'Error Saving Settings',
        description: `${errorMessage}`,
        variant: 'destructive',
      });
    }
  });
  
  const handleCompanyInfoComplete = (data) => {
    saveSettingsMutation.mutate({
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      type: 'company'
    });
    
    setCompleted(prev => ({ ...prev, company: true }));
    setActiveStep('tax');
    setProgress(50);
    
    toast({
      title: 'Company information saved',
      description: 'Your company information has been saved successfully',
    });
  };
  
  const handleTaxSettingsComplete = (taxRates) => {
    console.log('Saving tax settings:', taxRates);
    
    // Validate tax rates before saving
    if (!taxRates || !Array.isArray(taxRates) || taxRates.length === 0) {
      toast({
        title: 'Warning',
        description: 'No tax rates to save. Adding a default tax rate.',
        variant: 'default',
      });
      
      // Add a default tax rate if none is provided
      taxRates = [{
        name: 'Sales Tax',
        rate: 7.5,
        isDefault: true
      }];
    }
    
    saveSettingsMutation.mutate({
      taxRates,
      type: 'tax'
    });
    
    setCompleted(prev => ({ ...prev, tax: true }));
    setActiveStep('currency');
    setProgress(75);
    
    toast({
      title: 'Tax settings saved',
      description: 'Your tax settings have been saved successfully',
    });
  };
  
  const handleCurrencySettingsComplete = (currency) => {
    saveSettingsMutation.mutate({
      currency,
      type: 'currency'
    });
    
    setCompleted(prev => ({ ...prev, currency: true }));
    setActiveStep('technicians');
    setProgress(90);
    
    toast({
      title: 'Currency settings saved',
      description: 'Your currency settings have been saved successfully',
    });
  };
  
  const handleTechnicianSetupComplete = (technicians) => {
    saveSettingsMutation.mutate({
      technicians,
      type: 'technicians'
    });
    
    setCompleted(prev => ({ ...prev, technicians: true }));
    setProgress(100);
    
    // Mark onboarding as complete
    saveSettingsMutation.mutate({
      onboardingCompleted: true,
      type: 'onboarding'
    });
    
    toast({
      title: 'Setup complete!',
      description: 'Your repair shop is now ready to go',
    });
    
    // Close the modal
    setTimeout(() => {
      onClose();
    }, 1000);
  };
  
  const stepComponents = {
    company: <CompanyInfoForm onComplete={handleCompanyInfoComplete} />,
    tax: <TaxSettingsForm onComplete={handleTaxSettingsComplete} />,
    currency: <CurrencySettingsForm onComplete={handleCurrencySettingsComplete} />,
    technicians: <TechnicianSetupForm onComplete={handleTechnicianSetupComplete} />
  };
  
  const handleStepClick = (step: string) => {
    if (completed[step]) {
      setActiveStep(step);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Welcome to RepairTracker Pro</DialogTitle>
          <DialogDescription>
            Let's set up your repair shop. Complete these steps to get started.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <Progress value={progress} className="mb-6" />
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            {['company', 'tax', 'currency', 'technicians'].map((step) => (
              <Button 
                key={step}
                variant={activeStep === step ? "default" : completed[step] ? "outline" : "secondary"}
                className="flex items-center justify-center"
                onClick={() => handleStepClick(step)}
                disabled={!completed[step] && activeStep !== step}
              >
                {completed[step] && <Check className="mr-2 h-4 w-4" />}
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </Button>
            ))}
          </div>
          
          <div className="mt-4">
            {stepComponents[activeStep]}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}