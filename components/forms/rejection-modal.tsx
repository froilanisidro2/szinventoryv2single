'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productId: string, quantity: number, reason: string) => Promise<void>;
  product?: {
    id: string;
    productName: string;
    quantity_on_hand: number;
  };
}

export function RejectionModal({
  isOpen,
  onClose,
  onSubmit,
  product,
}: RejectionModalProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product) {
      toast.error('No product selected');
      return;
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(product.id, qty, reason);
      setQuantity('');
      setReason('');
      onClose();
      toast.success(`${qty} units marked as rejected`);
    } catch (error) {
      toast.error('Failed to mark items as rejected');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Mark Items as Rejected
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
              Current On Hand: {product.quantity_on_hand} units
            </p>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity to Reject
            </label>
            <input
              type="number"
              min="1"
              max={product.quantity_on_hand}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Max: {product.quantity_on_hand} units available on hand
            </p>
          </div>

          {/* Reason Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rejection Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Damaged during transport, Failed QC inspection, Incorrect item received, Expired stock..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              required
            />
          </div>

          {/* Warning */}
          <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              ⚠️ This will move the items to the "Rejected" queue and remove them from "On Hand".
              Items must be processed through QC before final disposition.
            </p>
          </div>

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
              disabled={isSubmitting}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? 'Processing...' : 'Mark as Rejected'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
