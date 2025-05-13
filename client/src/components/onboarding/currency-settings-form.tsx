import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency } from '@/hooks/use-currency';

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
  
  // Format currency for preview display
  const formatCurrencyPreview = (amount: number, currencyCode: string, symbol: string) => {
    // Choose locale based on the currency code
    let locale: string;
    switch(currencyCode) {
      case 'GBP':
        locale = 'en-GB';
        break;
      case 'JPY':
        locale = 'ja-JP';
        break;
      case 'EUR':
        locale = 'de-DE';
        break;
      default:
        locale = 'en-US';
    }
    
    // Set decimal digit options based on currency
    const minimumFractionDigits = currencyCode === 'JPY' ? 0 : 2;
    const maximumFractionDigits = currencyCode === 'JPY' ? 0 : 2;
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits,
        maximumFractionDigits
      }).format(amount);
    } catch (error) {
      // Fallback if there's an issue with the currency code
      return `${symbol}${amount.toFixed(minimumFractionDigits)} ${currencyCode}`;
    }
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
            Price: {formatCurrencyPreview(100, data.code, data.symbol)}
          </p>
        </div>
      </div>
    </div>
  );
}