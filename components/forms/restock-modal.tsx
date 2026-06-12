'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPurchaseOrder } from '@/app/actions';

interface RestockItem {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  restockQuantity: number;
  estimatedArrival: string;
  supplier: string;
  cost: number;
}

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockItems: Array<{
    id: string;
    productName: string;
    quantity_available: number;
    reorder_level: number;
    reorder_quantity: number;
  }>;
}

export function RestockModal({ isOpen, onClose, lowStockItems }: RestockModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
  const [restockItems, setRestockItems] = useState<RestockItem[]>(
    lowStockItems.map((item) => ({
      id: item.id,
      productId: item.id,
      productName: item.productName,
      currentStock: item.quantity_available,
      reorderLevel: item.reorder_level,
      restockQuantity: item.reorder_quantity,
      estimatedArrival: futureDate,
      supplier: 'Tech Supplies Inc',
      cost: 100,
    }))
  );

  const handleQuantityChange = (id: string, quantity: number) => {
    setRestockItems(
      restockItems.map((item) =>
        item.id === id ? { ...item, restockQuantity: quantity } : item
      )
    );
  };

  const handleSupplierChange = (id: string, supplier: string) => {
    setRestockItems(
      restockItems.map((item) =>
        item.id === id ? { ...item, supplier } : item
      )
    );
  };

  const handleDateChange = (id: string, date: string) => {
    setRestockItems(
      restockItems.map((item) =>
        item.id === id ? { ...item, estimatedArrival: date } : item
      )
    );
  };

  const handleSubmit = async () => {
    if (restockItems.length === 0) {
      toast.error('No items to restock');
      return;
    }

    setIsLoading(true);
    try {
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';
      const totalCost = restockItems.reduce((sum, item) => sum + item.restockQuantity * item.cost, 0);
      
      const result = await createPurchaseOrder({
        company_id: defaultCompanyId,
        po_number: `RESTOCK-${new Date().getFullYear()}-${String(Math.random()).slice(2, 5)}`,
        supplier_id: 'default-supplier',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: restockItems[0]?.estimatedArrival || '',
        status: 'draft',
        subtotal: totalCost,
        tax_amount: 0,
        shipping_cost: 0,
        total_amount: totalCost,
        currency_code: 'USD',
        payment_terms: 'Net 30',
        notes: 'Automatic restock order for low stock items',
      });

      if (result.error) {
        toast.error(result.error.message || 'Failed to create restock order');
        setIsLoading(false);
        return;
      }

      toast.success('Restock order created successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to create restock order');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Restock Items</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Product</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300 w-20">Current</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300 w-24">Restock Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 w-32">Supplier</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 w-32">Est. Arrival</th>
                </tr>
              </thead>
              <tbody>
                {restockItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{item.productName}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{item.currentStock}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={item.restockQuantity}
                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-right"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.supplier}
                        onChange={(e) => handleSupplierChange(item.id, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="Tech Supplies Inc">Tech Supplies Inc</option>
                        <option value="Global Electronics">Global Electronics</option>
                        <option value="Industrial Goods Ltd">Industrial Goods Ltd</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={item.estimatedArrival}
                        onChange={(e) => handleDateChange(item.id, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Total items to restock: <span className="font-semibold">{restockItems.reduce((sum, item) => sum + item.restockQuantity, 0)}</span>
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
              Estimated cost: <span className="font-semibold">${(restockItems.reduce((sum, item) => sum + item.restockQuantity * item.cost, 0)).toFixed(2)}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Creating Order...' : 'Create Restock Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
