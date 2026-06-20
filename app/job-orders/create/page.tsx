'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import {
  getProducts,
  getCustomers,
  getWarehouses,
  createJobOrder,
} from '@/app/actions';
import { useWarehouse } from '@/contexts/warehouse-context';
import type { Product, Customer, Warehouse } from '@/types';

interface BOMItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantityRequired: number;
  notes: string;
}

export default function CreateJobOrderPage() {
  const router = useRouter();
  const { selectedWarehouseId } = useWarehouse();

  // Header form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [customerId, setCustomerId] = useState('');
  const [productionLead, setProductionLead] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  // BOM items
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);

  // Reference data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bomSearch, setBomSearch] = useState('');
  const [showBomSuggestions, setShowBomSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const [prodsRes, custsRes, whsRes] = await Promise.all([
        getProducts(500),
        getCustomers(200),
        getWarehouses(),
      ]);
      if (!prodsRes.error) setProducts(prodsRes.data ?? []);
      if (!custsRes.error) setCustomers(custsRes.data ?? []);
      if (!whsRes.error) setWarehouses(whsRes.data ?? []);
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) setWarehouseId(selectedWarehouseId);
  }, [selectedWarehouseId]);

  function addProductToBOM(product: Product) {
    const already = bomItems.find(i => i.productId === product.id);
    if (already) { toast.error('Product already in BOM'); return; }
    setBomItems(prev => [...prev, {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantityRequired: 1,
      notes: '',
    }]);
    setBomSearch('');
    setShowBomSuggestions(false);
  }

  function removeBOMItem(id: string) {
    setBomItems(prev => prev.filter(i => i.id !== id));
  }

  function getMatchingProducts(search: string): Product[] {
    if (!search.trim()) return [];
    const lower = search.toLowerCase();
    return products
      .filter(p => p.sku.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower))
      .slice(0, 8);
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error('Job title is required'); return; }
    const validBOM = bomItems.filter(i => i.productId && i.quantityRequired > 0);
    if (validBOM.length === 0) { toast.error('Add at least one material to the BOM'); return; }

    setIsSubmitting(true);
    try {
      const res = await createJobOrder(
        {
          title: title.trim(),
          description: description || undefined,
          priority,
          customer_id: customerId || undefined,
          production_lead: productionLead.trim() || undefined,
          start_date: startDate || undefined,
          target_completion_date: targetDate || undefined,
          warehouse_id: warehouseId || undefined,
          notes: notes || undefined,
        },
        validBOM.map(i => ({
          product_id: i.productId,
          quantity_required: i.quantityRequired,
          notes: i.notes || undefined,
        }))
      );
      if (res.error) { toast.error('Failed to create job order: ' + res.error.message); return; }
      toast.success('Job Order created successfully');
      router.push(`/job-orders/${res.data.id}`);
    } catch {
      toast.error('Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        
          <Button href="/job-orders" variant="secondary" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Job Order</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create a production job order with Bill of Materials</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-6 space-y-6">
        {/* Job details */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Job Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Kitchen Cabinet Set — Unit 4B"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Additional details about this job…"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer (optional)</label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— No customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Production Lead</label>
              <input
                type="text"
                value={productionLead}
                onChange={e => setProductionLead(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Warehouse</label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— Select warehouse —</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{fmtWarehouse(w)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Completion</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional notes…"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Bill of Materials */}
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bill of Materials (BOM)</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Search and add materials required for this job</p>
          </div>

          {/* Global product search */}
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Search by SKU or product name to add material…"
              value={bomSearch}
              onChange={e => { setBomSearch(e.target.value); setShowBomSuggestions(e.target.value.length > 0); }}
              onFocus={() => { if (bomSearch.length > 0) setShowBomSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowBomSuggestions(false), 150)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {showBomSuggestions && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-h-56 overflow-y-auto">
                {getMatchingProducts(bomSearch).length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No products found</div>
                ) : (
                  getMatchingProducts(bomSearch).map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => addProductToBOM(p)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-900 dark:text-white"
                    >
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{p.sku}</span>
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* BOM list */}
          {bomItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-8 text-center text-sm text-gray-400">
              No materials added yet. Search above to add products.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Material / Product</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-32">Qty Required</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Notes</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {bomItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded mr-2">{item.sku}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{item.productName}</span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={item.quantityRequired}
                          onChange={e => setBomItems(prev =>
                            prev.map(i => i.id === item.id ? { ...i, quantityRequired: Number(e.target.value) } : i)
                          )}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Optional note"
                          value={item.notes}
                          onChange={e => setBomItems(prev =>
                            prev.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i)
                          )}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeBOMItem(item.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button href="/job-orders" variant="secondary">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create Job Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
