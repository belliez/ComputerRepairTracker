import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';

type TaxRate = {
  countryCode: string;
  regionCode?: string;
  name: string;
  rate: number;
};

interface TaxSettingsFormProps {
  data: TaxRate[];
  onChange: (data: TaxRate[]) => void;
}

const countryOptions = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
];

export function TaxSettingsForm({ data, onChange }: TaxSettingsFormProps) {
  const handleTaxRateChange = (index: number, field: keyof TaxRate, value: string | number) => {
    const updatedRates = [...data];
    updatedRates[index] = { 
      ...updatedRates[index], 
      [field]: field === 'rate' ? Number(value) : value 
    };
    onChange(updatedRates);
  };

  const addTaxRate = () => {
    onChange([
      ...data,
      {
        countryCode: 'US',
        regionCode: '',
        name: '',
        rate: 0,
      },
    ]);
  };

  const removeTaxRate = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-4">
        {data.map((taxRate, index) => (
          <Card key={index} className="border-border">
            <CardContent className="pt-4">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor={`taxName-${index}`} className="font-medium">Tax Name *</Label>
                  <Input
                    id={`taxName-${index}`}
                    value={taxRate.name}
                    onChange={(e) => handleTaxRateChange(index, 'name', e.target.value)}
                    placeholder="Sales Tax, VAT, GST"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`taxRate-${index}`} className="font-medium">Rate % *</Label>
                  <Input
                    id={`taxRate-${index}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate.rate}
                    onChange={(e) => handleTaxRateChange(index, 'rate', e.target.value)}
                    placeholder="7.5"
                    required
                  />
                </div>
                <div className="flex items-end justify-end">
                  {data.length > 1 && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="mt-auto"
                      onClick={() => removeTaxRate(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`countryCode-${index}`} className="font-medium">Country</Label>
                  <Select
                    value={taxRate.countryCode}
                    onValueChange={(value) => handleTaxRateChange(index, 'countryCode', value)}
                  >
                    <SelectTrigger id={`countryCode-${index}`}>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countryOptions.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`regionCode-${index}`} className="font-medium">Region/State</Label>
                  <Input
                    id={`regionCode-${index}`}
                    value={taxRate.regionCode || ''}
                    onChange={(e) => handleTaxRateChange(index, 'regionCode', e.target.value)}
                    placeholder="CA, NY, TX"
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
        onClick={addTaxRate} 
        className="flex items-center gap-2 w-full"
      >
        <Plus className="h-4 w-4" />
        Add Another Tax Rate
      </Button>

      <p className="text-sm text-muted-foreground mt-2">
        * Set rate to 0 if you don't charge tax
      </p>
    </div>
  );
}