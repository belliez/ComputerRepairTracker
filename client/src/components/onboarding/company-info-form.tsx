import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OnboardingData } from './onboarding-modal';

interface CompanyInfoFormProps {
  data: OnboardingData;
  onChange: (data: Partial<OnboardingData>) => void;
}

export function CompanyInfoForm({ data, onChange }: CompanyInfoFormProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="organizationName" className="font-medium">Company Name *</Label>
        <Input
          id="organizationName"
          value={data.organizationName}
          onChange={(e) => onChange({ organizationName: e.target.value })}
          placeholder="Your Repair Shop Name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyEmail" className="font-medium">Business Email</Label>
        <Input
          id="companyEmail"
          type="email"
          value={data.companyEmail || ''}
          onChange={(e) => onChange({ companyEmail: e.target.value })}
          placeholder="contact@yourrepairshop.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyPhone" className="font-medium">Business Phone</Label>
        <Input
          id="companyPhone"
          value={data.companyPhone || ''}
          onChange={(e) => onChange({ companyPhone: e.target.value })}
          placeholder="(123) 456-7890"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyAddress" className="font-medium">Business Address</Label>
        <Textarea
          id="companyAddress"
          value={data.companyAddress || ''}
          onChange={(e) => onChange({ companyAddress: e.target.value })}
          placeholder="123 Repair St, Techville, TX 12345"
          rows={3}
        />
      </div>
    </div>
  );
}