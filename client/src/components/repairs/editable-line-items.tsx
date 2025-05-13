import { useState } from "react";
import { Plus, Trash2, Edit } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/hooks/use-currency";

interface LineItem {
  id?: number;
  description: string;
  itemType: "part" | "service";
  unitPrice: number;
  quantity: number;
  total?: number;
}

interface EditableLineItemsProps {
  items: LineItem[];
  onChange: (updatedItems: LineItem[]) => void;
  readOnly?: boolean;
  showEditControls?: boolean;
}

export default function EditableLineItems({
  items,
  onChange,
  readOnly = false,
  showEditControls = true
}: EditableLineItemsProps) {
  const { formatCurrency } = useCurrency();
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [newItem, setNewItem] = useState<LineItem>({
    description: "",
    itemType: "part",
    unitPrice: 0,
    quantity: 1
  });

  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
  };

  const handleDeleteItem = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    onChange(updatedItems);
  };

  const handleSaveItem = () => {
    if (editingItemIndex !== null) {
      setEditingItemIndex(null);
    }
  };

  const handleAddItem = () => {
    if (!newItem.description || newItem.unitPrice <= 0 || newItem.quantity <= 0) {
      return; // Basic validation
    }
    
    const itemWithTotal = {
      ...newItem,
      total: newItem.unitPrice * newItem.quantity
    };
    
    onChange([...items, itemWithTotal]);
    
    // Reset the new item form
    setNewItem({
      description: "",
      itemType: "part",
      unitPrice: 0,
      quantity: 1
    });
  };

  const handleUpdateItem = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...items];
    
    // Update the specified field
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    // Recalculate total if price or quantity changes
    if (field === 'unitPrice' || field === 'quantity') {
      updatedItems[index].total = 
        updatedItems[index].unitPrice * updatedItems[index].quantity;
    }
    
    onChange(updatedItems);
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {showEditControls && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showEditControls ? 6 : 5} className="text-center text-gray-500 py-4">
                  No items added yet
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {editingItemIndex === index ? (
                      <Input 
                        value={item.description} 
                        onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                      />
                    ) : (
                      item.description
                    )}
                  </TableCell>
                  <TableCell>
                    {editingItemIndex === index ? (
                      <Select 
                        value={item.itemType} 
                        onValueChange={(value) => handleUpdateItem(index, 'itemType', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="part">Part</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={
                        item.itemType === "part" 
                          ? "bg-blue-100 text-blue-800 border-blue-300" 
                          : "bg-purple-100 text-purple-800 border-purple-300"
                      }>
                        {item.itemType === "part" ? "Part" : "Service"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingItemIndex === index ? (
                      <Input 
                        type="number" 
                        value={item.unitPrice} 
                        min={0}
                        step={0.01}
                        onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-20 ml-auto"
                      />
                    ) : (
                      formatCurrency(item.unitPrice)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingItemIndex === index ? (
                      <Input 
                        type="number" 
                        value={item.quantity} 
                        min={1}
                        onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 ml-auto"
                      />
                    ) : (
                      item.quantity
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency((item.unitPrice || 0) * (item.quantity || 0))}
                  </TableCell>
                  {showEditControls && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {editingItemIndex === index ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleSaveItem}
                          >
                            Save
                          </Button>
                        ) : (
                          <>
                            {!readOnly && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleEditItem(index)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteItem(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
            
            {!readOnly && showEditControls && (
              <TableRow>
                <TableCell>
                  <Input 
                    placeholder="Description" 
                    value={newItem.description}
                    onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                  />
                </TableCell>
                <TableCell>
                  <Select 
                    value={newItem.itemType}
                    onValueChange={(value) => setNewItem({...newItem, itemType: value as "part" | "service"})}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="part">Part</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Input 
                    type="number"
                    placeholder="Price" 
                    value={newItem.unitPrice || ""}
                    min={0}
                    step={0.01}
                    onChange={(e) => setNewItem({...newItem, unitPrice: parseFloat(e.target.value) || 0})}
                    className="w-20 ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input 
                    type="number"
                    placeholder="Qty" 
                    value={newItem.quantity || ""}
                    min={1}
                    onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                    className="w-20 ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency((newItem.unitPrice || 0) * (newItem.quantity || 0))}
                </TableCell>
                <TableCell className="text-right">
                  <Button onClick={handleAddItem} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}