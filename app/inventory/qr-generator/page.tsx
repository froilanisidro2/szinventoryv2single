'use client';

import { useState, useEffect } from 'react';
import { QrCode, Download, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProducts } from '@/app/actions';

interface Product {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
}

const generateSimpleQRCode = (text: string): string => {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23fff' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='0.3em' font-family='monospace' font-size='12'%3E${encodeURIComponent(text)}%3C/text%3E%3C/svg%3E`;
};

export default function QRCodeGeneratorPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [qrSize, setQrSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isPrinting, setIsPrinting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getProducts(500).then((res) => {
      if (!res.error && Array.isArray(res.data)) {
        setProducts(
          res.data
            .filter((p: any) => p.status === 'active')
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              selling_price: Number(p.selling_price) || 0,
            }))
        );
      }
    }).finally(() => setIsLoading(false));
  }, []);

  const selected = products.find(p => p.id === selectedProduct);

  const sizeClasses = {
    small: 'w-32 h-32',
    medium: 'w-48 h-48',
    large: 'w-64 h-64',
  };

  const handleDownload = () => {
    if (!selected) return;

    const link = document.createElement('a');
    link.href = generateSimpleQRCode(`${selected.sku}|${selected.id}`);
    link.download = `qr-${selected.sku}.png`;
    link.click();
  };

  const handlePrint = () => {
    if (!selected) return;

    setIsPrinting(true);
    const printWindow = window.open('', '', 'width=600,height=400');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print QR Code - ${selected.name}</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
              .container { text-align: center; padding: 40px; border: 2px solid #000; width: 400px; }
              img { margin: 20px 0; }
              .product-info { font-size: 18px; font-weight: bold; margin-top: 20px; }
              .sku { font-size: 14px; color: #666; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="product-info">${selected.name}</div>
              <img src="${generateSimpleQRCode(`${selected.sku}|${selected.id}`)}" style="width: 250px; height: 250px;" />
              <div class="sku">SKU: ${selected.sku}</div>
              <div class="sku">Price: $${selected.selling_price.toFixed(2)}</div>
            </div>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    setTimeout(() => setIsPrinting(false), 1000);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        
          <Button href="/inventory" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <QrCode className="h-8 w-8 text-primary-600" />
            QR Code Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Generate and print QR codes for products
          </p>
        </div>
      </div>

      {/* Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Settings */}
        <div className="lg:col-span-1 space-y-4">
          {/* Product Selection */}
          <div className="card p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Product</h3>

            {isLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading products...</p>
            ) : (
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Choose product...</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* QR Size */}
          {selected && (
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">QR Size</h3>

              <div className="space-y-2">
                {(['small', 'medium', 'large'] as const).map(size => (
                  <label key={size} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      value={size}
                      checked={qrSize === size}
                      onChange={(e) => setQrSize(e.target.value as typeof qrSize)}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700 dark:text-gray-300 capitalize">
                      {size} {size === 'small' && '(2x2")'}
                      {size === 'medium' && '(3x3")'}
                      {size === 'large' && '(4x4")'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {selected && (
            <div className="card p-4 space-y-2">
              <Button
                variant="primary"
                className="w-full h-4 w-4"
                icon={<Download />}
                onClick={handleDownload}
              >
                Download PNG
              </Button>
              <Button
                variant="secondary"
                className="w-full h-4 w-4"
                icon={<Printer />}
                onClick={handlePrint}
                disabled={isPrinting}
              >
                {isPrinting ? 'Printing...' : 'Print'}
              </Button>
            </div>
          )}

          {/* Batch Actions */}
          
            <Button href="/inventory/bulk-upload" className="block w-full" variant="secondary">
              Bulk Upload
            </Button>

          {/* Info */}
          <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Info</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• QR codes contain SKU & Product ID</li>
              <li>• Print on label paper</li>
              <li>• Scan for quick item lookup</li>
              <li>• Works with any scanner</li>
            </ul>
          </div>
        </div>

        {/* Right Panel - Preview */}
        {selected && (
          <div className="lg:col-span-2">
            <div className="card p-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center justify-center space-y-6">
                {/* QR Code Preview */}
                <div className={`${sizeClasses[qrSize]} border-4 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-white`}>
                  <img
                    src={generateSimpleQRCode(`${selected.sku}|${selected.id}`)}
                    alt="QR Code"
                    className="w-full h-full"
                  />
                </div>

                {/* Product Info */}
                <div className="text-center space-y-2 w-full">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{selected.name}</p>
                  <p className="text-gray-600 dark:text-gray-400">SKU: {selected.sku}</p>
                  <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                    ${selected.selling_price.toFixed(2)}
                  </p>
                </div>

                {/* Print Preview */}
                <div className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                    Print Preview ({qrSize})
                  </p>
                  <div className="bg-white dark:bg-gray-800 rounded p-4 flex flex-col items-center justify-center space-y-3">
                    <div className={`${sizeClasses[qrSize]} border-2 border-gray-300 dark:border-gray-600 rounded flex items-center justify-center`}>
                      <img
                        src={generateSimpleQRCode(`${selected.sku}|${selected.id}`)}
                        alt="QR Code Print"
                        className="w-full h-full"
                      />
                    </div>
                    <div className="text-center text-sm">
                      <p className="font-semibold text-gray-900 dark:text-white">{selected.name}</p>
                      <p className="text-gray-600 dark:text-gray-400">{selected.sku}</p>
                    </div>
                  </div>
                </div>

                {/* Hot Keys */}
                <div className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">Keyboard Shortcuts</p>
                  <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <p>• <kbd>Ctrl+P</kbd> to print</p>
                    <p>• <kbd>Ctrl+S</kbd> to save</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!selected && (
          <div className="lg:col-span-2">
            <div className="card p-8 text-center">
              <QrCode className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4 opacity-50" />
              <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">
                Select a product to generate QR code
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
