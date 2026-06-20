'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getProducts, createMaterialRequest, updateMaterialRequestStatus } from '@/app/actions';
import { getCurrentUser } from '@/lib/auth-utils';
import type { Product } from '@/types';

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantityRequested: number;
  notes: string;
}

export default function CreateMaterialRequestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>}>
      <CreateMaterialRequestForm />
    </Suspense>
  );
}

function CreateMaterialRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledProductId = searchParams.get('product_id') ?? '';
  const prefilledQty = Number(searchParams.get('qty') ?? '0');
  const jobOrderId = searchParams.get('job_order_id') ?? '';
  const jobOrderNumber = searchParams.get('jo_number') ?? '';

  const [urgencyLevel, setUrgencyLevel] = useState<string>('normal');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setIsAdmin(user?.isCompanyAdmin ?? false);
  }, []);

  useEffect(() => {
    getProducts(500).then(res => {
      if (!res.error) setProducts(res.data ?? []);
    });
  }, []);

  // Pre-fill item if product_id query param was provided
  useEffect(() => {
    if (!prefilledProductId || products.length === 0) return;
    const product = products.find(p => p.id === prefilledProductId);
    if (!product) return;
    addProduct(product, prefilledQty > 0 ? prefilledQty : 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledProductId, products]);

  // Pre-fill notes when arriving from a Job Order shortfall
  useEffect(() => {
    if (jobOrderNumber) {
      setNotes(prev => prev || `Material shortfall for Job Order ${jobOrderNumber}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobOrderNumber]);

  function addProduct(product: Product, quantity = 1) {
    if (lineItems.find(i => i.productId === product.id)) {
      toast.error('Product already added');
      return;
    }
    setLineItems(prev => [...prev, {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantityRequested: quantity,
      notes: '',
    }]);
    setSearch('');
    setShowSuggestions(false);
  }

  function removeLineItem(id: string) {
    setLineItems(prev => prev.filter(i => i.id !== id));
  }

  function getMatchingProducts(s: string): Product[] {
    if (!s.trim()) return [];
    const lower = s.toLowerCase();
    return products
      .filter(p => p.sku.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower))
      .slice(0, 8);
  }

  async function handleSubmit(approveAndCreatePO = false) {
    if (lineItems.length === 0) {
      toast.error('Add at least one product');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await createMaterialRequest(
        { urgency_level: urgencyLevel, notes: notes || undefined, job_order_id: jobOrderId || undefined },
        lineItems.map(i => ({
          product_id: i.productId,
          quantity_requested: i.quantityRequested,
          notes: i.notes || undefined,
        }))
      );
      if (res.error) {
        toast.error('Failed to create MRF: ' + res.error.message);
        return;
      }
      const mrfId = res.data.id;
      if (approveAndCreatePO) {
        await updateMaterialRequestStatus(mrfId, 'approved');
        toast.success('MRF approved. Fill in the PO details.');
        router.push(`/purchase-orders/create?mrf_id=${mrfId}`);
      } else {
        toast.success('Material Request created successfully');
        router.push(`/material-requests/${mrfId}`);
      }
    } catch {
      toast.error('Unexpected error creating MRF');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        
          <Button href="/material-requests" variant="secondary" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Material Request (MRF)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Procurement MRF — for purchasing materials from a supplier. To allocate more of an item to a Job Order&apos;s Bill of Materials, use that JO&apos;s &quot;Request MRF&quot; instead.</p>
        </div>
      </div>

      {jobOrderId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          This MRF is linked to Job Order{' '}
          <Link href={`/job-orders/${jobOrderId}`} className="font-semibold underline">
            {jobOrderNumber || jobOrderId}
          </Link>{' '}
          — created to cover a material shortfall during issuance.
        </div>
      )}

      {/* Form card */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-6 space-y-6">

        {/* Header fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Urgency Level
            </label>
            <select
              value={urgencyLevel}
              onChange={e => setUrgencyLevel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason for request, project name, etc."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Requested Materials */}
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Requested Materials</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Search and add products to request</p>
          </div>

          {/* Global product search */}
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Search by SKU or product name to add…"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(e.target.value.length > 0); }}
              onFocus={() => { if (search.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {showSuggestions && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-h-56 overflow-y-auto">
                {getMatchingProducts(search).length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No products found</div>
                ) : (
                  getMatchingProducts(search).map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => addProduct(p)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-900 dark:text-white"
                    >
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded mr-2">{p.sku}</span>
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Items table */}
          {lineItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-8 text-center text-sm text-gray-400">
              No materials added yet. Search above to add products.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Product</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-32">Qty Needed</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Notes</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lineItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded mr-2">{item.sku}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{item.productName}</span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantityRequested}
                          onChange={e => setLineItems(prev =>
                            prev.map(i => i.id === item.id ? { ...i, quantityRequested: Number(e.target.value) } : i)
                          )}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Optional note"
                          value={item.notes}
                          onChange={e => setLineItems(prev =>
                            prev.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i)
                          )}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeLineItem(item.id)} className="text-red-500 hover:text-red-700 p-1">
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

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          
            <Button href="/material-requests" variant="secondary">Cancel</Button>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? 'Processing…' : '⚡ Approve & Create PO'}
              </Button>
            )}
            <Button onClick={() => handleSubmit(false)} disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create MRF'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
