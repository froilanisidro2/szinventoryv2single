'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RejectionDispositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productId: string, dispositionType: string, quantity: number, notes: string) => Promise<void>;
  product?: {
    id: string;
    product_id: string;
    productName: string;
    quantity_rejected: number;
  };
}

export function RejectionDispositionModal({
  isOpen,
  onClose,
  onSubmit,
  product,
}: RejectionDispositionModalProps) {
  const [dispositionType, setDispositionType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) {
      toast.error('No product selected');
      return;
    }

    if (!dispositionType) {
      toast.error('Please select a disposition type');
      return;
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0 || qty > product.quantity_rejected) {
      toast.error(`Please enter a valid quantity (1-${product.quantity_rejected})`);
      return;
    }

    if (!notes.trim()) {
      toast.error('Please provide notes for this disposition');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(product.product_id, dispositionType, qty, notes);
      setDispositionType('');
      setQuantity('');
      setNotes('');
      onClose();
      toast.success(`${qty} units marked for ${dispositionType}`);
    } catch (error) {
      toast.error('Failed to process disposition');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !product) return null;

  const dispositionOptions = [
    {
      value: 'return_to_supplier',
      label: '🔄 Return to Supplier',
      description: 'Items will be returned and credited',
      color: 'blue',
    },
    {
      value: 'rework',
      label: '♻️ Rework/Repair',
      description: 'Items will be repaired and restocked',
      color: 'yellow',
    },
    {
      value: 'scrap',
      label: '🗑️ Scrap/Waste',
      description: 'Items are written off as loss',
      color: 'red',
    },
    {
      value: 'restock',
      label: '📦 Restock',
      description: 'Inspection error - return to usable stock',
      color: 'green',
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20',
    yellow: 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20',
    red: 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20',
    green: 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20',
  };

  const selectedOption = dispositionOptions.find(opt => opt.value === dispositionType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Process Rejected Items
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Info */}
          <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Product</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {product.productName}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Rejected: {product.quantity_rejected} units
            </p>
          </div>

          {/* Disposition Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Disposition Type *
            </label>
            <div className="space-y-2">
              {dispositionOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    dispositionType === option.value
                      ? `${colorClasses[option.color]} border-2`
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="disposition"
                    value={option.value}
                    checked={dispositionType === option.value}
                    onChange={(e) => setDispositionType(e.target.value)}
                    className="mt-1"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 dark:text-white">{option.label}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity to Process
            </label>
            <input
              type="number"
              min="1"
              max={product.quantity_rejected}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Max: {product.quantity_rejected} units
            </p>
          </div>

          {/* Notes TextArea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Disposition Notes *
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={selectedOption ? `e.g., ${
                selectedOption.value === 'return_to_supplier' ? 'RMA sent to supplier ABC' :
                selectedOption.value === 'rework' ? 'Sent to warehouse repair station' :
                selectedOption.value === 'scrap' ? 'Damaged beyond repair - note in waste log' :
                'Inspection error - items verified as good'
              }` : 'Enter notes...'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              required
            />
          </div>

          {/* Confirmation Message */}
          {selectedOption && (
            <div className={`rounded-lg p-3 text-sm ${colorClasses[selectedOption.color]}`}>
              {selectedOption.value === 'return_to_supplier' && (
                <p>💼 Supplier credit process will be initiated. Items removed from inventory.</p>
              )}
              {selectedOption.value === 'rework' && (
                <p>🔧 Items moved to rework queue. Track progress in operations.</p>
              )}
              {selectedOption.value === 'scrap' && (
                <p>⚠️ Items will be permanently removed and recorded as loss.</p>
              )}
              {selectedOption.value === 'restock' && (
                <p>✅ Items returned to usable inventory and available for sale.</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !dispositionType}
              className="flex-1"
            >
              {isSubmitting ? 'Processing...' : 'Confirm Disposition'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
