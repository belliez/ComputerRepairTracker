import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CostEstimatorProps {
  repairId?: number | null;
  onEstimateComplete?: (estimate: RepairEstimate) => void;
}

interface EstimatorItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isSelected: boolean;
  category: 'parts' | 'labor' | 'fee';
}

interface RepairEstimate {
  subtotal: number;
  tax: number;
  total: number;
  items: EstimatorItem[];
  taxRate: number;
  currency: string;
}

// Common repair services with default pricing
const commonServices: EstimatorItem[] = [
  { id: 'diag', name: 'Diagnostics', price: 45, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'screen', name: 'Screen Replacement', price: 120, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'battery', name: 'Battery Replacement', price: 65, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'keyboard', name: 'Keyboard Replacement', price: 80, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'hdd', name: 'Hard Drive Replacement', price: 60, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'ssd', name: 'SSD Installation', price: 50, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'ram', name: 'RAM Upgrade', price: 40, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'os', name: 'OS Installation', price: 55, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'virus', name: 'Virus Removal', price: 75, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'data', name: 'Data Recovery', price: 100, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'cleaning', name: 'Deep Cleaning', price: 50, quantity: 1, isSelected: false, category: 'labor' },
  { id: 'rush', name: 'Rush Fee', price: 30, quantity: 1, isSelected: false, category: 'fee' },
];

// Common parts with default pricing
const commonParts: EstimatorItem[] = [
  { id: 'screen_part', name: 'LCD Screen', price: 85, quantity: 1, isSelected: false, category: 'parts' },
  { id: 'battery_part', name: 'Battery', price: 45, quantity: 1, isSelected: false, category: 'parts' },
  { id: 'keyboard_part', name: 'Keyboard', price: 35, quantity: 1, isSelected: false, category: 'parts' },
  { id: 'hdd_part', name: 'Hard Drive (1TB)', price: 55, quantity: 1, isSelected: false, category: 'parts' },
  { id: 'ssd_part', name: 'SSD (500GB)', price: 75, quantity: 1, isSelected: false, category: 'parts' },
  { id: 'ram_part', name: 'RAM (8GB)', price: 45, quantity: 1, isSelected: false, category: 'parts' },
  { id: 'fan_part', name: 'Cooling Fan', price: 25, quantity: 1, isSelected: false, category: 'parts' },
  { id: 'power_adapter', name: 'Power Adapter', price: 35, quantity: 1, isSelected: false, category: 'parts' },
  { id: 'charger_port', name: 'Charging Port', price: 30, quantity: 1, isSelected: false, category: 'parts' },
];

export default function CostEstimator({ repairId, onEstimateComplete }: CostEstimatorProps) {
  const [items, setItems] = useState<EstimatorItem[]>([
    ...commonServices,
    ...commonParts
  ]);
  type ItemCategory = 'parts' | 'labor' | 'fee';
  const [customItem, setCustomItem] = useState<{ name: string; price: string; quantity: string; category: ItemCategory }>({ 
    name: "", 
    price: "", 
    quantity: "1", 
    category: "parts" 
  });
  const [taxRate, setTaxRate] = useState(0.1); // Default 10% tax
  const [currency, setCurrency] = useState("USD");
  const { toast } = useToast();

  // Define types for tax rates and currencies
  interface TaxRate {
    id: number;
    name: string;
    rate: number;
  }

  interface Currency {
    id: number;
    code: string;
    name: string;
    symbol: string;
  }

  // Fetch tax rates from settings
  const { data: taxRates } = useQuery<TaxRate[]>({
    queryKey: ["/api/settings/tax-rates"],
  });

  // Fetch currencies from settings
  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["/api/settings/currencies"],
  });

  // Fetch default tax rate
  const { data: defaultTaxRate } = useQuery<TaxRate>({
    queryKey: ["/api/settings/tax-rates/default"],
  });

  // Fetch default currency
  const { data: defaultCurrency } = useQuery<Currency>({
    queryKey: ["/api/settings/currencies/default"],
  });

  // Set default tax rate and currency when data is loaded
  useEffect(() => {
    if (defaultTaxRate) {
      setTaxRate(defaultTaxRate.rate / 100);
    }
  }, [defaultTaxRate]);

  useEffect(() => {
    if (defaultCurrency) {
      setCurrency(defaultCurrency.code);
    }
  }, [defaultCurrency]);

  // Format price with currency symbol
  const formatPrice = (price: number): string => {
    const currencyObj = currencies?.find(c => c.code === currency);
    if (currencyObj) {
      return `${currencyObj.symbol}${price.toFixed(2)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  // Toggle item selection
  const toggleItem = (id: string) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, isSelected: !item.isSelected } 
        : item
    ));
  };

  // Update item quantity
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) quantity = 1;
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, quantity } 
        : item
    ));
  };

  // Add custom item
  const addCustomItem = () => {
    if (!customItem.name || !customItem.price) {
      toast({
        title: "Missing information",
        description: "Please provide both a name and price for the custom item",
        variant: "destructive"
      });
      return;
    }

    const price = parseFloat(customItem.price);
    const quantity = parseInt(customItem.quantity) || 1;
    
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid price greater than zero",
        variant: "destructive"
      });
      return;
    }

    // Create a new ID based on timestamp and random number
    const newId = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    setItems([
      ...items,
      {
        id: newId,
        name: customItem.name,
        price,
        quantity,
        isSelected: true,
        category: customItem.category as 'parts' | 'labor' | 'fee'
      }
    ]);
    
    // Reset custom item form
    setCustomItem({ name: "", price: "", quantity: "1", category: "parts" });
  };

  // Remove custom item
  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Calculate totals
  const selectedItems = items.filter(item => item.isSelected);
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Generate estimate
  const generateEstimate = () => {
    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to generate an estimate",
        variant: "destructive"
      });
      return;
    }

    const estimate: RepairEstimate = {
      subtotal,
      tax: taxAmount,
      total,
      items: selectedItems,
      taxRate,
      currency
    };

    if (onEstimateComplete) {
      onEstimateComplete(estimate);
    }

    toast({
      title: "Estimate Generated",
      description: `Total estimate: ${formatPrice(total)}`,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Repair Cost Estimator</CardTitle>
        <CardDescription>Select items to include in the estimate</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tax Rate & Currency Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate</Label>
            <Select 
              value={taxRate.toString()} 
              onValueChange={(value) => setTaxRate(parseFloat(value))}
            >
              <SelectTrigger id="tax-rate">
                <SelectValue placeholder="Select Tax Rate" />
              </SelectTrigger>
              <SelectContent>
                {taxRates?.map(rate => (
                  <SelectItem key={rate.id} value={(rate.rate / 100).toString()}>
                    {rate.name} ({rate.rate}%)
                  </SelectItem>
                ))}
                <SelectItem value="0">No Tax (0%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select 
              value={currency} 
              onValueChange={(value) => setCurrency(value)}
            >
              <SelectTrigger id="currency">
                <SelectValue placeholder="Select Currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map(curr => (
                  <SelectItem key={curr.id} value={curr.code}>
                    {curr.name} ({curr.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Labor and Services */}
        <div>
          <h3 className="font-medium text-sm mb-2">Labor & Services</h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto p-2 border rounded-md">
            {items
              .filter(item => item.category === 'labor')
              .map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={item.id} 
                      checked={item.isSelected} 
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <Label 
                      htmlFor={item.id} 
                      className="cursor-pointer"
                    >
                      {item.name}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                      disabled={!item.isSelected}
                      className="w-16 text-right h-8"
                    />
                    <span className="w-20 text-right">
                      {formatPrice(item.price)}
                    </span>
                    {!commonServices.some(s => s.id === item.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(item.id)}
                      >
                        <i className="fas fa-times text-red-500"></i>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Parts */}
        <div>
          <h3 className="font-medium text-sm mb-2">Parts</h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto p-2 border rounded-md">
            {items
              .filter(item => item.category === 'parts')
              .map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={item.id} 
                      checked={item.isSelected} 
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <Label 
                      htmlFor={item.id} 
                      className="cursor-pointer"
                    >
                      {item.name}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                      disabled={!item.isSelected}
                      className="w-16 text-right h-8"
                    />
                    <span className="w-20 text-right">
                      {formatPrice(item.price)}
                    </span>
                    {!commonParts.some(p => p.id === item.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(item.id)}
                      >
                        <i className="fas fa-times text-red-500"></i>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Fees */}
        <div>
          <h3 className="font-medium text-sm mb-2">Additional Fees</h3>
          <div className="space-y-2 p-2 border rounded-md">
            {items
              .filter(item => item.category === 'fee')
              .map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={item.id} 
                      checked={item.isSelected} 
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <Label 
                      htmlFor={item.id} 
                      className="cursor-pointer"
                    >
                      {item.name}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                      disabled={!item.isSelected}
                      className="w-16 text-right h-8"
                    />
                    <span className="w-20 text-right">
                      {formatPrice(item.price)}
                    </span>
                    {!commonServices.some(s => s.id === item.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(item.id)}
                      >
                        <i className="fas fa-times text-red-500"></i>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Custom Item Input */}
        <div className="border p-3 rounded-md">
          <h3 className="font-medium text-sm mb-2">Add Custom Item</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label htmlFor="custom-name">Item Name</Label>
              <Input
                id="custom-name"
                placeholder="Item name"
                value={customItem.name}
                onChange={(e) => setCustomItem({...customItem, name: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-price">Price</Label>
              <Input
                id="custom-price"
                placeholder="Price"
                type="number"
                min="0.01"
                step="0.01"
                value={customItem.price}
                onChange={(e) => setCustomItem({...customItem, price: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-quantity">Quantity</Label>
              <Input
                id="custom-quantity"
                placeholder="Quantity"
                type="number"
                min="1"
                value={customItem.quantity}
                onChange={(e) => setCustomItem({...customItem, quantity: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-category">Category</Label>
              <Select 
                value={customItem.category} 
                onValueChange={(value: 'parts' | 'labor' | 'fee') => 
                  setCustomItem({...customItem, category: value})
                }
              >
                <SelectTrigger id="custom-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parts">Part</SelectItem>
                  <SelectItem value="labor">Labor</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            className="w-full mt-2" 
            size="sm"
            onClick={addCustomItem}
          >
            <i className="fas fa-plus mr-1"></i> Add Item
          </Button>
        </div>

        {/* Cost Breakdown */}
        <div className="border p-4 rounded-md bg-gray-50">
          <h3 className="font-medium mb-2">Cost Breakdown</h3>
          
          {selectedItems.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 text-sm">
                <span className="font-medium">Item</span>
                <span className="text-right font-medium">Quantity</span>
                <span className="text-right font-medium">Price</span>
              </div>
              
              {selectedItems.map(item => (
                <div key={item.id} className="grid grid-cols-3 text-sm py-1 border-b">
                  <span>{item.name}</span>
                  <span className="text-right">{item.quantity}</span>
                  <span className="text-right">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
              
              <div className="grid grid-cols-2 text-sm pt-2">
                <span>Subtotal:</span>
                <span className="text-right">{formatPrice(subtotal)}</span>
              </div>
              
              <div className="grid grid-cols-2 text-sm">
                <span>Tax ({(taxRate * 100).toFixed(1)}%):</span>
                <span className="text-right">{formatPrice(taxAmount)}</span>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 font-bold">
                <span>Total:</span>
                <span className="text-right">{formatPrice(total)}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-2">
              Select items to see the cost breakdown
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={generateEstimate} className="w-full">
          Generate Estimate
        </Button>
      </CardFooter>
    </Card>
  );
}