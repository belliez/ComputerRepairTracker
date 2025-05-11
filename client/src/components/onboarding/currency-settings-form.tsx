import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Currency = {
  code: string;
  name: string;
  symbol: string;
};

interface CurrencySettingsFormProps {
  data: Currency;
  onChange: (data: Currency) => void;
}

// Common currencies
const currencyOptions = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
];

export function CurrencySettingsForm({ data, onChange }: CurrencySettingsFormProps) {
  const handleCurrencySelect = (code: string) => {
    const selectedCurrency = currencyOptions.find((c) => c.code === code);
    if (selectedCurrency) {
      onChange(selectedCurrency);
    }
  };

  const handleCustomChange = (field: keyof Currency, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="currencySelect" className="font-medium">
          Select Your Currency
        </Label>
        <Select
          value={data.code}
          onValueChange={handleCurrencySelect}
        >
          <SelectTrigger id="currencySelect">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((currency) => (
              <SelectItem key={currency.code} value={currency.code}>
                {currency.symbol} - {currency.name} ({currency.code})
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom Currency</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.code === 'custom' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="currencyCode" className="font-medium">
              Currency Code
            </Label>
            <Input
              id="currencyCode"
              value={data.code}
              onChange={(e) => handleCustomChange('code', e.target.value)}
              placeholder="USD, EUR, GBP"
              maxLength={3}
            />
            <p className="text-xs text-muted-foreground">
              Standard 3-letter ISO currency code
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currencyName" className="font-medium">
              Currency Name
            </Label>
            <Input
              id="currencyName"
              value={data.name}
              onChange={(e) => handleCustomChange('name', e.target.value)}
              placeholder="US Dollar, Euro"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currencySymbol" className="font-medium">
              Currency Symbol
            </Label>
            <Input
              id="currencySymbol"
              value={data.symbol}
              onChange={(e) => handleCustomChange('symbol', e.target.value)}
              placeholder="$, €, £"
              maxLength={3}
            />
          </div>
        </>
      )}

      <div className="pt-4">
        <div className="bg-muted p-4 rounded-md">
          <p className="font-medium mb-2">Preview:</p>
          <p>
            Price: {data.symbol}100.00 {data.code}
          </p>
        </div>
      </div>
    </div>
  );
}