'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCustomers, getProducts, createInvoice, createInvoiceItem } from '@/app/actions';
import { useWarehouse } from '@/contexts/warehouse-context';

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

const TAX_RATE = 0.12;

function formatPeso(v: number) {
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const { selectedWarehouseId } = useWarehouse();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentTerms: 'Net 30',
    notes: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [taxRate, setTaxRate] = useState(TAX_RATE);

  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      try {
        const [custRes, prodRes] = await Promise.all([getCustomers(), getProducts()]);
        if (!custRes.error && custRes.data) setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
        if (!prodRes.error && prodRes.data) setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      } catch {
        toast.error('Failed to load data');
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, []);

  const matchingProducts = search.trim()
    ? products.filter(p =>
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.name?.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : [];

  const addProduct = (prod: any) => {
    setLineItems(prev => [...prev, {
      id: Date.now().toString(),
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku || '',
      description: `${prod.sku ? prod.sku + ' - ' : ''}${prod.name}`,
      quantity: 1,
      unitPrice: parseFloat(String(prod.selling_price || prod.cost_price || 0)),
      taxRate,
    }]);
    setSearch('');
    setShowSuggestions(false);
  };

  const addEmptyLine = () => {
    setLineItems(prev => [...prev, {
      id: Date.now().toString(),
      productId: '',
      productName: '',
      sku: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate,
    }]);
  };

  const updateLine = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  const removeLine = (id: string) => {
    setLineItems(prev => prev.filter(li => li.id !== id));
  };

  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) { toast.error('Please select a customer'); return; }
    if (lineItems.length === 0) { toast.error('Add at least one line item'); return; }
    if (lineItems.some(li => li.quantity <= 0 || li.unitPrice < 0)) {
      toast.error('All line items must have valid quantity and price');
      return;
    }

    setIsLoading(true);

    // Read clientUserId from storage as fallback for issued_by_id
    let clientUserId: string | undefined;
    try {
      const raw = sessionStorage.getItem('user') ?? localStorage.getItem('user');
      if (raw) clientUserId = JSON.parse(raw)?.id;
    } catch { /* ignore */ }

    try {
      const invoiceNumber = `INV-${Date.now()}`;
      const result = await createInvoice({
        invoice_number: invoiceNumber,
        customer_id: formData.customerId,
        order_type: 'sales_order',
        issue_date: formData.invoiceDate,
        due_date: formData.dueDate,
        status: 'pending',
        subtotal,
        tax_amount: taxAmount,
        discount_amount: 0,
        total_amount: total,
        amount_paid: 0,
        payment_terms: formData.paymentTerms,
        notes: formData.notes,
        ...(selectedWarehouseId ? { warehouse_id: selectedWarehouseId } : {}),
      } as any, clientUserId);

      if (result.error) {
        toast.error(typeof result.error === 'string' ? result.error : (result.error as any)?.message || 'Failed to create invoice');
        return;
      }

      const invoice = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!invoice?.id) { toast.error('Invoice created but ID missing'); return; }

      // Save line items — do NOT pass line_total (it's a generated column)
      // tax_rate stored as percentage in DB (e.g. 12 for 12%, not 0.12)
      let failed = 0;
      for (const li of lineItems) {
        const itemRes = await createInvoiceItem({
          invoice_id: invoice.id,
          product_id: li.productId || null,
          description: li.description || li.productName,
          quantity: li.quantity,
          unit_price: li.unitPrice,
          tax_rate: Math.round(li.taxRate * 100), // convert decimal to percentage
        });
        if (itemRes.error) failed++;
      }

      if (failed > 0) {
        toast.error(`Invoice created but ${failed} line item(s) failed to save`);
      } else {
        toast.success(`Invoice ${invoiceNumber} created successfully`);
      }
      router.push('/invoices');
    } catch {
      toast.error('Error creating invoice');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/invoices">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Create Invoice</h1>
          <p className="text-gray-600 dark:text-gray-400">Create a new sales invoice</p>
        </div>
      </div>

      {loadingData && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">Loading customers and products...</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Details */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary-600" />
            Invoice Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.customerId}
                onChange={e => setFormData(f => ({ ...f, customerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Select a customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.invoiceDate}
                onChange={e => setFormData(f => ({ ...f, invoiceDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Terms</label>
              <select
                value={formData.paymentTerms}
                onChange={e => setFormData(f => ({ ...f, paymentTerms: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option>COD</option>
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
                <option>Prepaid</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <input
                type="text"
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes or payment instructions..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Line Items</h3>
            <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addEmptyLine}>
              Add Item
            </Button>
          </div>

          {/* Product Search */}
          <div className="relative bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Quick Add by SKU / Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowSuggestions(e.target.value.length > 0); }}
                onFocus={() => search && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            {showSuggestions && matchingProducts.length > 0 && (
              <div className="absolute z-10 left-3 right-3 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                {matchingProducts.map(prod => (
                  <button
                    key={prod.id}
                    type="button"
                    onMouseDown={() => addProduct(prod)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm border-b border-gray-100 dark:border-gray-600 last:border-0"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{prod.sku}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">{prod.name}</span>
                    <span className="float-right text-primary-600 dark:text-primary-400 text-xs font-semibold">
                      {formatPeso(parseFloat(String(prod.selling_price || prod.cost_price || 0)))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          {lineItems.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">No line items added yet.</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Description</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-32">Unit Price</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28">Amount</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {lineItems.map(li => (
                    <tr key={li.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={li.description}
                          onChange={e => updateLine(li.id, 'description', e.target.value)}
                          placeholder="Description..."
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={li.quantity}
                          onChange={e => updateLine(li.id, 'quantity', parseFloat(e.target.value) || 1)}
                          min="0.01"
                          step="0.01"
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={li.unitPrice}
                          onChange={e => updateLine(li.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {formatPeso(li.quantity * li.unitPrice)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(li.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatPeso(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400 items-center">
                  <span className="flex items-center gap-1">
                    Tax (%):
                    <input
                      type="number"
                      value={(taxRate * 100).toFixed(0)}
                      min="0"
                      max="100"
                      step="1"
                      onChange={e => setTaxRate((parseFloat(e.target.value) || 0) / 100)}
                      className="w-12 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white ml-1"
                    />
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatPeso(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                  <span>Total:</span>
                  <span className="text-primary-600 dark:text-primary-400">{formatPeso(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/invoices" className="flex-1">
            <Button variant="secondary" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" variant="primary" className="flex-1" disabled={isLoading || loadingData}>
            {isLoading ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
