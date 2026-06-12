'use client';

import { useState } from 'react';
import { Upload, Download, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getProductBySku, createStockTransaction, updateStockLevels } from '@/app/actions';
import { useWarehouse } from '@/contexts/warehouse-context';
import { fmtWarehouse } from '@/lib/warehouse-utils';

interface BulkImportItem {
  productSKU: string;
  productName: string;
  quantity: number;
  type: 'inbound' | 'outbound';
  reference: string;
  reason: string;
  date: string;
  cost?: number;
}

interface RowResult {
  sku: string;
  status: 'success' | 'error';
  message: string;
}

export default function BulkUploadPage() {
  const { selectedWarehouseId, selectedWarehouse } = useWarehouse();
  const [uploadType, setUploadType] = useState<'inbound' | 'outbound'>('inbound');
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState<BulkImportItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrors([]);
    setResults([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').slice(1); // skip header

        const parsedItems: BulkImportItem[] = [];
        const rowErrors: string[] = [];

        rows.forEach((row, index) => {
          if (!row.trim()) return;
          const [productSKU, productName, quantityStr, reference, reason, date, costStr] = row
            .split(',')
            .map((s) => s.trim());

          if (!productSKU) { rowErrors.push(`Row ${index + 2}: Product SKU is required`); return; }
          if (!quantityStr || isNaN(parseInt(quantityStr)) || parseInt(quantityStr) <= 0) {
            rowErrors.push(`Row ${index + 2}: Valid quantity > 0 is required`); return;
          }
          if (!reference) { rowErrors.push(`Row ${index + 2}: Reference number is required`); return; }
          if (!reason)    { rowErrors.push(`Row ${index + 2}: Reason is required`); return; }
          if (!date)      { rowErrors.push(`Row ${index + 2}: Date is required`); return; }

          parsedItems.push({
            productSKU,
            productName: productName || productSKU,
            quantity: parseInt(quantityStr),
            type: uploadType,
            reference,
            reason,
            date,
            cost: costStr ? parseFloat(costStr) : undefined,
          });
        });

        setItems(parsedItems);
        setErrors(rowErrors);
      } catch {
        setErrors(['Error parsing file. Please ensure it\'s a valid CSV.']);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (items.length === 0) { setErrors(['No items to import']); return; }

    setIsImporting(true);
    setResults([]);
    const rowResults: RowResult[] = [];

    for (const item of items) {
      try {
        // 1. Look up product by SKU
        const productRes = await getProductBySku(item.productSKU);
        if (productRes.error || !productRes.data) {
          rowResults.push({ sku: item.productSKU, status: 'error', message: `SKU "${item.productSKU}" not found` });
          continue;
        }
        const product = productRes.data;
        const wh = selectedWarehouseId || undefined;

        // 2. Create stock transaction record
        await createStockTransaction({
          product_id: product.id,
          warehouse_id: wh,
          transaction_type: item.type === 'inbound' ? 'purchase' : 'sale',
          quantity: item.quantity,
          notes: `${item.reason} | Ref: ${item.reference} | Date: ${item.date}`,
          reference_type: item.type === 'inbound' ? 'bulk_inbound' : 'bulk_outbound',
        });

        // 3. Update stock level (+qty for inbound, -qty for outbound)
        const delta = item.type === 'inbound' ? item.quantity : -item.quantity;
        await updateStockLevels(product.id, delta, wh);

        rowResults.push({ sku: item.productSKU, status: 'success', message: `${item.type === 'inbound' ? '+' : '-'}${item.quantity} units` });
      } catch (err) {
        rowResults.push({ sku: item.productSKU, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    setResults(rowResults);
    setIsImporting(false);

    const successCount = rowResults.filter((r) => r.status === 'success').length;
    const failCount = rowResults.filter((r) => r.status === 'error').length;

    if (failCount === 0) {
      toast.success(`All ${successCount} items imported successfully!`);
      setTimeout(() => { setItems([]); setFileName(''); setResults([]); }, 3000);
    } else {
      toast.error(`${failCount} item(s) failed — ${successCount} succeeded`);
    }
  };

  const downloadTemplate = () => {
    const headers = uploadType === 'inbound'
      ? 'Product SKU,Product Name,Quantity,PO Number,Reason,Date,Unit Cost'
      : 'Product SKU,Product Name,Quantity,SO Number,Reason,Date';

    const example = uploadType === 'inbound'
      ? 'PROD-001,Laptop Pro 15,50,PO-2026-001,Purchase Order,2026-03-29,1299.99'
      : 'PROD-001,Laptop Pro 15,20,SO-2026-001,Customer Sale,2026-03-29';

    const blob = new Blob([`${headers}\n${example}`], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${uploadType}-template.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/inventory/movements">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Upload className="h-8 w-8 text-primary-600" />
            Bulk Import
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedWarehouse
              ? `📦 ${fmtWarehouse(selectedWarehouse)} · Import multiple stock movements from CSV`
              : 'Import multiple stock movements from CSV file'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Type Selection */}
          <div className="card p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Import Type</h3>
            <div className="space-y-2">
              {(['inbound', 'outbound'] as const).map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors"
                  style={{ borderColor: uploadType === t ? '#06b6d4' : '' }}
                >
                  <input
                    type="radio"
                    value={t}
                    checked={uploadType === t}
                    onChange={() => { setUploadType(t); setItems([]); setErrors([]); setResults([]); }}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">{t}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {t === 'inbound' ? 'Stock receipts / additions' : 'Stock shipments / deductions'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Requirements</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• CSV format only</li>
              <li>• Products must exist (matched by SKU)</li>
              <li>• Required: SKU, Qty, Reference, Reason, Date</li>
              <li>• Stock levels update automatically</li>
            </ul>
          </div>

          <Button variant="secondary" className="w-full" icon={<Download className="h-4 w-4" />} onClick={downloadTemplate}>
            Download Template
          </Button>
        </div>

        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* File Upload */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upload CSV File</h3>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
              <Upload className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">Drag and drop your CSV file here, or click to browse</p>
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="file-upload" />
              <label htmlFor="file-upload">
                <Button variant="primary" className="cursor-pointer" onClick={() => document.getElementById('file-upload')?.click()}>
                  Select File
                </Button>
              </label>
            </div>
            {fileName && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                Selected: <span className="font-semibold">{fileName}</span>
              </p>
            )}
          </div>

          {/* Parse Errors */}
          {errors.length > 0 && (
            <div className="card p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-200 mb-1">CSV Errors</p>
                  <ul className="text-sm text-red-800 dark:text-red-300 space-y-1">
                    {errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Import Results */}
          {results.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-white text-sm">Import Results</span>
                <span className="text-xs text-green-600 dark:text-green-400">
                  {results.filter(r => r.status === 'success').length} succeeded
                </span>
                {results.some(r => r.status === 'error') && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    · {results.filter(r => r.status === 'error').length} failed
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">SKU</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {results.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">{r.sku}</td>
                        <td className="px-4 py-2">
                          {r.status === 'success'
                            ? <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4" /> OK</span>
                            : <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><AlertCircle className="h-4 w-4" /> Error</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {items.length > 0 && results.length === 0 && (
            <>
              <div className="card p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-semibold">{items.length}</span> items ready · will update stock in{' '}
                  <span className="font-semibold">{fmtWarehouse(selectedWarehouse) || 'selected warehouse'}</span>
                </p>
              </div>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">SKU</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Product</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Qty</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Reference</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {items.slice(0, 10).map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{item.productSKU}</td>
                          <td className="px-4 py-3 text-gray-900 dark:text-white">{item.productName}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{item.quantity}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.reference}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {items.length > 10 && (
                  <div className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
                    +{items.length - 10} more items
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={handleImport}
                disabled={isImporting || errors.length > 0}
              >
                {isImporting ? 'Importing…' : `Import ${items.length} Items`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
