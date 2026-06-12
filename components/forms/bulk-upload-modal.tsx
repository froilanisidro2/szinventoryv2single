'use client';

import { useState, useRef } from 'react';
import { Upload, X, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (products: Array<Record<string, unknown>>) => Promise<void>;
  isLoading?: boolean;
  /** Pre-fill the template with the currently selected warehouse/bin */
  defaultWarehouseId?: string;
  defaultBinLocationId?: string;
  /** Human-readable name shown in the example row (name or UUID both accepted on upload) */
  defaultWarehouseName?: string;
  defaultSupplierName?: string;
}

export function BulkUploadModal({
  isOpen,
  onClose,
  onUpload,
  isLoading = false,
  defaultWarehouseId = '',
  defaultBinLocationId = '',
  defaultWarehouseName = '',
  defaultSupplierName = '',
}: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Array<Record<string, unknown>>>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter((line) => line.trim());
        if (lines.length === 0) {
          toast.error('CSV file is empty');
          return;
        }

        const headerLine = lines[0];
        if (!headerLine) {
          toast.error('CSV file is empty');
          return;
        }

        const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());

        const data: Array<Record<string, unknown>> = [];
        const parseErrors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;

          const values = line.split(',').map((v) => v.trim());
          const row: Record<string, unknown> = {};

          headers.forEach((header, index) => {
            const value = values[index];

            // Type conversion for specific fields
            if (header === 'selling_price' || header === 'cost_price' || header === 'tax_rate' || header === 'purchase_price') {
              row[header] = value ? parseFloat(value) : 0;
            } else if (header === 'reorder_level' || header === 'reorder_quantity') {
              row[header] = value ? parseInt(value, 10) : 0;
            } else {
              row[header] = value || '';
            }
          });

          // Validation — only name and sku are truly required
          if (!row.name) {
            parseErrors.push(`Row ${i + 1}: Product name is required`);
            continue;
          }
          if (!row.sku) {
            parseErrors.push(`Row ${i + 1}: SKU is required`);
            continue;
          }

          data.push(row);
        }

        if (parseErrors.length > 0) {
          setErrors(parseErrors);
          setParsedData([]);
          toast.error(`Failed to parse CSV: ${parseErrors.length} errors`);
        } else {
          setParsedData(data);
          setErrors([]);
          toast.success(`Successfully parsed ${data.length} products`);
        }
      } catch (error) {
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast.error('No valid products to upload');
      return;
    }

    try {
      setIsProcessing(true);
      await onUpload(parsedData);
      // Note: onUpload (handleBulkUpload in the parent) shows its own success/error toasts
      // and calls setIsBulkUploadOpen(false) when all succeed.
      // We only close here if the parent didn't (partial failure case keeps modal open).
    } catch (error) {
      toast.error('Failed to upload products');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    onClose();
  };

  const downloadTemplate = () => {
    const headers = [
      // Basic
      'name',
      'sku',
      'description',
      'category_id',
      'unit_of_measure',
      'selling_price',
      'cost_price',
      'reorder_level',
      'warehouse_name',
      'bin_location_id',
      'track_batches',
      'allocation_method',
      // Duration
      'lead_time_days',
      'shelf_life_days',
      'warranty_months',
      // Attributes
      'weight',
      'dimension',
      'color',
      'size',
      'brand',
      // Classification
      'product_type',
      // Handling
      'shipping_instruction',
      // Supplier
      'supplier_name',
    ];

    const exampleRow = [
      'Example Product',   // name
      'PROD-001',          // sku
      'A sample product',  // description
      '',                  // category_id (leave blank for default, or paste UUID)
      'pieces',            // unit_of_measure
      '99.99',             // selling_price
      '50.00',             // cost_price
      '10',                // reorder_level
      defaultWarehouseName || defaultWarehouseId, // warehouse_id — name or UUID
      defaultBinLocationId, // bin_location_id (UUID only, or leave blank)
      'false',             // track_batches (true/false)
      'FIFO',              // allocation_method (FIFO, FEFO, or LIFO)
      '',                  // lead_time_days (number of days, optional)
      '',                  // shelf_life_days (number of days, optional)
      '',                  // warranty_months (number of months, optional)
      '',                  // weight (e.g. 1.5kg, optional)
      '',                  // dimension (e.g. 10x20x5cm, optional)
      '',                  // color (optional)
      '',                  // size (optional)
      '',                  // brand name (optional)
      '',                  // product_type name (optional)
      '',                  // shipping_instruction name (optional)
      defaultSupplierName, // supplier_id — name or UUID (optional)
    ];

    const template = [headers.join(','), exampleRow.join(',')].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="z-50 w-full max-w-2xl rounded-lg bg-white p-6 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Import Products</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Template Download */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/20">
          <p className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-200">
            Download the CSV template — it includes all fields from the Add Product form (Basic, Duration, Attributes, Classification, Handling tabs).
          </p>
          <p className="mb-2 text-xs text-blue-700 dark:text-blue-300">
            Required: <strong>name</strong>, <strong>sku</strong>, <strong>selling_price</strong>. Use the <strong>warehouse name</strong> (e.g. "Main") and <strong>supplier name</strong> (e.g. "Supplier 1") directly. <strong>bin_location_id</strong> accepts a location name or UUID, or leave blank.
          </p>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <Download className="h-4 w-4" />
            Download CSV Template
          </button>
        </div>

        {/* File Upload */}
        {!file && (
          <div
            className="mb-6 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const droppedFile = e.dataTransfer.files[0];
              if (droppedFile) {
                if (droppedFile.name.endsWith('.csv')) {
                  setFile(droppedFile);
                  parseCSV(droppedFile);
                } else {
                  toast.error('Please upload a CSV file');
                }
              }
            }}
          >
            <Upload className="mx-auto mb-3 h-12 w-12 text-gray-400" />
            <p className="mb-2 font-medium text-gray-700 dark:text-gray-300">
              Drag and drop your CSV file here
            </p>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700"
            >
              <Upload className="h-4 w-4" />
              Select CSV File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* File Selected */}
        {file && (
          <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setParsedData([]);
                  setErrors([]);
                }}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Parsed Data Preview */}
        {parsedData.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="font-medium text-gray-900 dark:text-white">
                {parsedData.length} products ready to import
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      SKU
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Selling Price
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {parsedData.slice(0, 5).map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-2">{product.name as React.ReactNode}</td>
                      <td className="px-4 py-2">{product.sku as React.ReactNode}</td>
                      <td className="px-4 py-2 text-right">₱{product.selling_price as React.ReactNode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 5 && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                ... and {parsedData.length - 5} more products
              </p>
            )}
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/20">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="font-medium text-red-900 dark:text-red-200">
                {errors.length} error{errors.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-red-800 dark:text-red-300">
              {errors.slice(0, 5).map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
            {errors.length > 5 && (
              <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                ... and {errors.length - 5} more errors
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={parsedData.length === 0 || isProcessing || isLoading}
            className="flex-1"
          >
            {isProcessing || isLoading ? 'Importing...' : `Import ${parsedData.length} Products`}
          </Button>
        </div>
      </div>
    </div>
  );
}
