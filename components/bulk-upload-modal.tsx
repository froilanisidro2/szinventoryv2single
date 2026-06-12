'use client';

import { useState } from 'react';
import { Upload, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'warehouses' | 'categories' | 'suppliers' | 'customers' | 'bin_locations' | 'products';
  onUpload: (data: any[]) => Promise<void>;
  template?: Record<string, any>;
  /** Pre-fill template with the currently selected warehouse/bin */
  defaultWarehouseId?: string;
  defaultBinLocationId?: string;
}

export function BulkUploadModal({
  isOpen,
  onClose,
  entityType,
  onUpload,
  template,
  defaultWarehouseId = '',
  defaultBinLocationId = '',
}: BulkUploadModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const templates = {
    warehouses: {
      name: 'Tech Warehouse 1',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      postal_code: '10001',
      phone: '+1-555-0100',
      manager_name: 'John Smith',
      notes: 'Main distribution center',
      status: 'active',
    },
    categories: {
      name: 'Electronics',
      description: 'Electronic equipment and components',
      status: 'active',
    },
    suppliers: {
      supplier_code: 'SUP-001',
      name: 'ABC Supplies Inc',
      email: 'contact@abcsupplies.com',
      phone: '+1-555-0200',
      address: '456 B Ave',
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      postal_code: '90001',
      contact_person: 'Jane Doe',
      payment_terms: '30',
      status: 'active',
    },
    customers: {
      customer_code: 'CUST-001',
      name: 'Acme Corporation',
      email: 'info@acme.com',
      phone: '+1-555-0300',
      billing_address: '789 C Ave',
      billing_city: 'Chicago',
      billing_state: 'IL',
      billing_country: 'USA',
      billing_postal_code: '60601',
      contact_person: 'Bob Johnson',
      business_category: 'retail',
      payment_terms: 'Net 30',
      status: 'active',
    },
    bin_locations: {
      warehouse_id: defaultWarehouseId,  // required — UUID of the target warehouse
      zone: 'A',
      aisle: '1',
      shelf: '1',
      bin_number: '01',
      capacity: '100',
      status: 'available',
      description: 'Example bin location',
    },
    products: {
      name: 'Example Product',
      sku: 'PROD-001',
      description: 'A sample product',
      category_id: '',
      unit_of_measure: 'pieces',
      selling_price: '99.99',
      cost_price: '50.00',
      reorder_level: '10',
      warehouse_id: defaultWarehouseId,      // auto-filled from selected warehouse
      bin_location_id: defaultBinLocationId, // auto-filled from selected warehouse's first bin
      track_batches: 'false',
      allocation_method: 'FIFO',
      lead_time_days: '',
      shelf_life_days: '',
      warranty_months: '',
      weight: '',
      dimension: '',
      color: '',
      size: '',
      brand: '',
      product_type: '',
      shipping_instruction: '',
    },
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const text = await file.text();
      const lines = text.trim().split('\n');

      if (lines.length < 2) {
        toast.error('CSV file must contain header and at least one data row');
        return;
      }

      // Parse CSV
      const headers = (lines[0] || '').split(',').map((h) => h.trim());
      const data: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = (lines[i] || '').split(',').map((v) => v.trim());
        const row: Record<string, any> = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        data.push(row);
      }

      setPreviewData(data);
      toast.success(`Loaded ${data.length} records from CSV`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to read CSV file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = template || templates[entityType];
    const headers = Object.keys(templateData);
    const csv = [
      headers.join(','),
      Object.values(templateData).join(','),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}-template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (previewData.length === 0) {
      toast.error('No data to upload');
      return;
    }

    try {
      setIsLoading(true);
      await onUpload(previewData);
      toast.success(`Successfully uploaded ${previewData.length} ${entityType}`);
      setPreviewData([]);
      onClose();
    } catch (error) {
      console.error('Error uploading data:', error);
      toast.error('Failed to upload data');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Bulk Upload {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {previewData.length === 0 ? (
            <>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <label className="cursor-pointer">
                  <span className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
                    Click to upload
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isLoading}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">or drag and drop a CSV file</p>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleDownloadTemplate} icon={<Download className="h-4 w-4" />}>
                  Download Template
                </Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Format Requirements:</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li>• File format must be CSV (Comma Separated Values)</li>
                  <li>• First row must contain column headers</li>
                  <li>• Download the template for required columns</li>
                  <li>• Status must be either 'active' or 'inactive'</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>{previewData.length} records ready to upload</strong>
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800">
                      {Object.keys(previewData[0] || {}).map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-medium text-gray-900 dark:text-white">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 3).map((row, idx) => (
                      <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                        {Object.values(row).map((val, vidx) => (
                          <td key={vidx} className="px-3 py-2 text-gray-600 dark:text-gray-400">
                            {String(val).substring(0, 30)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 p-3">
                    ... and {previewData.length - 3} more rows
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          {previewData.length > 0 && (
            <Button variant="primary" onClick={handleUpload} disabled={isLoading}>
              {isLoading ? 'Uploading...' : 'Upload'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
