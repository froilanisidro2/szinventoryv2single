'use client';

import { useState } from 'react';
import { Printer, Download, Grid, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRLabel {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  selected: boolean;
}

export default function QRBatchGeneratorPage() {
  const [labels, setLabels] = useState<QRLabel[]>([
    { id: '1', sku: 'PROD-001', name: 'Laptop Pro 15', quantity: 50, selected: true },
    { id: '2', sku: 'PROD-002', name: 'Wireless Mouse', quantity: 200, selected: true },
    { id: '3', sku: 'PROD-003', name: 'USB-C Cable', quantity: 500, selected: true },
    { id: '4', sku: 'PROD-004', name: 'Monitor 27"', quantity: 30, selected: false },
    { id: '5', sku: 'PROD-005', name: 'Keyboard RGB', quantity: 75, selected: false },
  ]);

  const [labelsPerPage, setLabelsPerPage] = useState<number>(6);
  const [qrSize, setQrSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isPrinting, setIsPrinting] = useState(false);

  const selectedLabels = labels.filter(l => l.selected);
  const totalLabels = selectedLabels.length;

  const toggleLabel = (id: string) => {
    setLabels(labels.map(l => 
      l.id === id ? { ...l, selected: !l.selected } : l
    ));
  };

  const toggleAll = () => {
    const allSelected = labels.every(l => l.selected);
    setLabels(labels.map(l => ({ ...l, selected: !allSelected })));
  };

  const handleBatchGenerate = async () => {
    if (selectedLabels.length === 0) return;

    setIsPrinting(true);
    // Simulate generation
    setTimeout(() => {
      handlePrintPreview();
      setIsPrinting(false);
    }, 1500);
  };

  const handlePrintPreview = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sizeClass = qrSize === 'small' ? '200px' : qrSize === 'medium' ? '280px' : '350px';
    const sizePx = parseInt(sizeClass);

    let html = `
      <html>
      <head>
        <title>QR Code Labels - Batch Print</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 10mm;
            background: white;
          }
          .label-grid {
            display: grid;
            grid-template-columns: repeat(${labelsPerPage === 6 ? 3 : labelsPerPage === 4 ? 2 : 1}, 1fr);
            gap: 10mm;
            margin-bottom: 20mm;
          }
          .label {
            border: 2px solid #ddd;
            padding: 10mm;
            text-align: center;
            page-break-inside: avoid;
            background: white;
            border-radius: 4px;
          }
          .qr-code {
            width: ${sizePx}px;
            height: ${sizePx}px;
            margin: 0 auto 8mm;
            background: linear-gradient(45deg, #0891b2 0%, #06b6d4 100%);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
          }
          .product-name {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 4px;
            word-break: break-word;
          }
          .sku {
            font-family: monospace;
            font-size: 9px;
            color: #666;
            margin-bottom: 4px;
          }
          .quantity {
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 4px;
            margin-top: 4px;
          }
          .timestamp {
            text-align: right;
            font-size: 8px;
            color: #999;
            margin-top: 10mm;
          }
          @media print {
            body { padding: 0; }
            .timestamp { display: none; }
          }
        </style>
      </head>
      <body>
    `;

    // Add labels
    selectedLabels.forEach((label) => {
      html += `
        <div class="label">
          <div class="qr-code">${label.sku}</div>
          <div class="product-name">${label.name}</div>
          <div class="sku">${label.sku}</div>
          <div class="quantity">Qty: ${label.quantity} units</div>
        </div>
      `;
    });

    html += `
        <div class="timestamp">
          Generated: ${new Date().toLocaleString()}<br>
          Total Labels: ${totalLabels}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    const data = selectedLabels.map((label, idx) => ({
      number: idx + 1,
      sku: label.sku,
      name: label.name,
      quantity: label.quantity,
      size: qrSize,
    }));

    const csv = [
      ['Label #', 'SKU', 'Product Name', 'Quantity', 'QR Size'],
      ...data.map(row => [row.number, row.sku, row.name, row.quantity, row.size])
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `qr-labels-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        
          <Button href="/inventory/qr-generator" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Grid className="h-8 w-8 text-primary-600" />
            Batch QR Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Generate and print multiple QR code labels at once
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Settings */}
          <div className="card p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Settings</h3>

            <div className="space-y-4">
              {/* Labels Per Page */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Labels Per Page
                </label>
                <select
                  value={labelsPerPage}
                  onChange={(e) => setLabelsPerPage(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={6}>6 Labels (3x2)</option>
                  <option value={4}>4 Labels (2x2)</option>
                  <option value={1}>1 Label</option>
                </select>
              </div>

              {/* QR Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  QR Code Size
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'small', label: 'Small (2x2")' },
                    { value: 'medium', label: 'Medium (3x3")' },
                    { value: 'large', label: 'Large (4x4")' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={opt.value}
                        checked={qrSize === opt.value}
                        onChange={(e) => setQrSize(e.target.value as any)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="card p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
            <div className="text-center">
              <p className="text-sm text-primary-600 dark:text-primary-400 mb-2">Selected Labels</p>
              <p className="text-3xl font-bold text-primary-700 dark:text-primary-300">{totalLabels}</p>
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">
                {totalLabels} of {labels.length} products
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="primary"
              className="w-full h-4 w-4"
              icon={<Printer />}
              onClick={handleBatchGenerate}
              disabled={totalLabels === 0 || isPrinting}
            >
              {isPrinting ? 'Generating...' : 'Print Labels'}
            </Button>
            <Button
              variant="secondary"
              className="w-full h-4 w-4"
              icon={<Download />}
              onClick={handleDownload}
              disabled={totalLabels === 0}
            >
              Download CSV
            </Button>
          </div>

          {/* Info */}
          <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 text-sm mb-2">Tips</h4>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <li>• Use Ctrl+P to print</li>
              <li>• Supports label sheets</li>
              <li>• Select multiple products</li>
              <li>• Choose appropriate size</li>
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Select All */}
          <div className="card p-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={labels.every(l => l.selected)}
              onChange={toggleAll}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {labels.every(l => l.selected) ? 'Deselect All' : 'Select All'}
            </span>
          </div>

          {/* Product List */}
          <div className="card overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {labels.map((label) => (
                <div
                  key={label.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={label.selected}
                      onChange={() => toggleLabel(label.id)}
                      className="w-5 h-5 cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{label.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">SKU: {label.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">{label.quantity}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">units</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-white text-center px-1">{label.sku}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {totalLabels > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Print Preview</h3>
              <div className={`grid gap-4 ${labelsPerPage === 6 ? 'grid-cols-3' : labelsPerPage === 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {selectedLabels.slice(0, labelsPerPage).map((label) => (
                  <div
                    key={label.id}
                    className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center bg-white dark:bg-gray-800"
                  >
                    <div className={`w-full h-32 bg-gradient-to-br from-primary-400 to-primary-600 rounded mb-3 flex items-center justify-center`}>
                      <span className="text-sm font-bold text-white text-center px-2">{label.sku}</span>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{label.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 my-1">{label.sku}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Qty: {label.quantity}</p>
                  </div>
                ))}
              </div>
              {totalLabels > labelsPerPage && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
                  +{totalLabels - labelsPerPage} more labels on next page(s)
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
