'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  children: React.ReactNode;
  isLoading?: boolean;
  submitButtonText?: string;
}

export function FormModal({
  isOpen,
  onClose,
  title,
  onSubmit,
  children,
  isLoading = false,
  submitButtonText = 'Save',
}: FormModalProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit(formData);
    setFormData({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form content will be rendered by children */}
          <div className="min-h-[400px]">{children}</div>

          <div className="mt-8 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-900 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Saving...' : submitButtonText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
