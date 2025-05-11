import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/components/auth/auth-provider';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CompanyInfoForm } from './company-info-form';
import { TaxSettingsForm } from './tax-settings-form';
import { CurrencySettingsForm } from './currency-settings-form';
import { TechnicianSetupForm } from './technician-setup-form';

export type OnboardingData = {
  completed: boolean;
  organizationName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  taxRates: {
    countryCode: string;
    regionCode?: string;
    name: string;
    rate: number;
  }[];
  currency: {
    code: string;
    name: string;
    symbol: string;
  };
  technicians: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: string;
    specialty?: string;
  }[];
};

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const { toast } = useToast();
  const { currentOrganization, refreshCurrentOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState('company');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    completed: false,
    organizationName: currentOrganization?.name || '',
    taxRates: [
      {
        countryCode: 'US',
        regionCode: '',
        name: 'Sales Tax',
        rate: 0,
      },
    ],
    currency: {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
    },
    technicians: [
      {
        firstName: '',
        lastName: '',
        email: '',
        role: 'Technician',
      },
    ],
  });

  const canProceed = {
    company: onboardingData.organizationName.trim().length > 0,
    tax: onboardingData.taxRates.length > 0 && onboardingData.taxRates[0].name.trim().length > 0,
    currency: onboardingData.currency.code.trim().length > 0,
    technicians: onboardingData.technicians.some(
      tech => tech.firstName.trim().length > 0 && tech.lastName.trim().length > 0 && tech.email.trim().length > 0
    ),
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Update organization info
      await apiRequest('PUT', `/api/organizations/${currentOrganization?.id}`, {
        name: onboardingData.organizationName,
        settings: {
          onboardingCompleted: true,
          companyEmail: onboardingData.companyEmail,
          companyPhone: onboardingData.companyPhone,
          companyAddress: onboardingData.companyAddress,
        },
      });

      // Save tax settings
      for (const taxRate of onboardingData.taxRates) {
        await apiRequest('POST', '/api/settings/tax-rates', {
          ...taxRate,
          isDefault: true,
        });
      }

      // Save currency settings
      await apiRequest('POST', '/api/settings/currencies', {
        ...onboardingData.currency,
        isDefault: true,
      });

      // Save technicians
      for (const technician of onboardingData.technicians) {
        if (technician.firstName && technician.lastName && technician.email) {
          await apiRequest('POST', '/api/technicians', technician);
        }
      }

      // Refresh organization data
      await refreshCurrentOrganization();

      toast({
        title: 'Onboarding completed',
        description: 'Your repair shop has been successfully set up.',
      });

      onClose();
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete onboarding. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      // Just mark onboarding as completed
      await apiRequest('PUT', `/api/organizations/${currentOrganization?.id}`, {
        settings: {
          onboardingCompleted: true,
        },
      });
      
      // Refresh organization data
      await refreshCurrentOrganization();
      
      toast({
        title: 'Onboarding skipped',
        description: 'You can set up your shop details later in Settings.',
      });
      
      onClose();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      toast({
        title: 'Error',
        description: 'Failed to skip onboarding. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextTab = () => {
    if (activeTab === 'company') setActiveTab('tax');
    else if (activeTab === 'tax') setActiveTab('currency');
    else if (activeTab === 'currency') setActiveTab('technicians');
  };

  const prevTab = () => {
    if (activeTab === 'technicians') setActiveTab('currency');
    else if (activeTab === 'currency') setActiveTab('tax');
    else if (activeTab === 'tax') setActiveTab('company');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Welcome to RepairTrack Pro</DialogTitle>
          <DialogDescription>
            Let's set up your repair shop. You can always change these settings later.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
            <TabsTrigger value="currency">Currency</TabsTrigger>
            <TabsTrigger value="technicians">Technicians</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanyInfoForm 
              data={onboardingData} 
              onChange={(data) => setOnboardingData({...onboardingData, ...data})} 
            />
          </TabsContent>

          <TabsContent value="tax">
            <TaxSettingsForm 
              data={onboardingData.taxRates} 
              onChange={(taxRates) => setOnboardingData({...onboardingData, taxRates})} 
            />
          </TabsContent>

          <TabsContent value="currency">
            <CurrencySettingsForm 
              data={onboardingData.currency} 
              onChange={(currency) => setOnboardingData({...onboardingData, currency})} 
            />
          </TabsContent>

          <TabsContent value="technicians">
            <TechnicianSetupForm 
              data={onboardingData.technicians} 
              onChange={(technicians) => setOnboardingData({...onboardingData, technicians})} 
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {activeTab === 'company' ? (
              <Button variant="outline" onClick={handleSkip} disabled={isSubmitting}>
                Skip for now
              </Button>
            ) : (
              <Button variant="outline" onClick={prevTab} disabled={isSubmitting}>
                Back
              </Button>
            )}
          </div>
          <div>
            {activeTab === 'technicians' ? (
              <Button onClick={handleSave} disabled={isSubmitting || !canProceed[activeTab]}>
                {isSubmitting ? 'Saving...' : 'Complete Setup'}
              </Button>
            ) : (
              <Button onClick={nextTab} disabled={!canProceed[activeTab]}>
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}