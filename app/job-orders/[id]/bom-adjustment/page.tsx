'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getJobOrderById,
  getJobOrderBOM,
  getProducts,
  createJobOrderBOMRequest,
} from '@/app/actions';
import type { Product } from '@/types';

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  bomItemId?: string;
  currentQty: number;
  additionalQty: number;
  reason: string;
}

export default function RequestMaterialsPage() {
  const params = useParams();
  const router = useRouter();
  const joId = params.id as string;

  const [joNumber, setJoNumber] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bom, setBom] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [joId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [jobRes, bomRes, productsRes] = await Promise.all([
        getJobOrderById(joId),
        getJobOrderBOM(joId),
        getProducts(500),
      ]);
      if (jobRes.error || !jobRes.data) {
        toast.error('Job order not found');
        router.push('/job-orders');
        return;
      }
      setJoNumber(jobRes.data.jo_number);
      setJobTitle(jobRes.data.title);
      setBom(Array.isArray(bomRes.data) ? bomRes.data : []);
      if (!productsRes.error) setProducts(productsRes.data ?? []);
    } catch {
      toast.error('Error loading data');
    } finally {
      setIsLoading(false);
    }
  }

  function addProduct(product: Product) {
    if (lineItems.find(i => i.productId === product.id)) {
      toast.error('Product already added');
      return;
    }
    const bomItem = bom.find((b: any) => b.product_id === product.id);
    setLineItems(prev => [...prev, {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      bomItemId: bomItem?.id,
      currentQty: Number(bomItem?.quantity_required || 0),
      additionalQty: 1,
      reason: '',
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

  async function handleSubmit() {
    if (lineItems.length === 0) {
      toast.error('Add at least one material');
      return;
    }
    const invalid = lineItems.find(i => !i.additionalQty || i.additionalQty <= 0);
    if (invalid) {
      toast.error(`Enter a valid quantity for ${invalid.productName}`);
      return;
    }
    setIsSubmitting(true);
    try {
      let created = 0;
      for (const item of lineItems) {
        const res = await createJobOrderBOMRequest(joId, item.productId, item.additionalQty, {
          jobOrderBomId: item.bomItemId,
          currentQuantity: item.currentQty,
          reason: item.reason || undefined,
        });
        if (res.error) {
          toast.error(`Failed to request ${item.productName}: ` + res.error.message);
          continue;
        }
        created++;
      }
      if (created > 0) {
        toast.success(`${created} MRF${created > 1 ? 's' : ''} submitted for approval`);
        router.push(`/job-orders/${joId}`);
      }
    } catch {
      toast.error('Unexpected error submitting requests');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>;
  }

  return (
    <div className="flex-1 space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/job-orders/${joId}`}>
          <Button variant="secondary" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to JO
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">New MRF Request</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {joNumber} — {jobTitle}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-300">
        This MRF requests more of an item to be allocated to <strong>this Job Order&apos;s Bill of Materials</strong> for production use — it does not place a purchase order with a supplier (that's what a Procurement MRF is for).
        Submitting here does not change the BOM immediately — each item becomes a pending MRF that a Processor/Admin must approve before it's added.
      </div>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-6 space-y-6">
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Items to Adjust</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Search and add products — existing BOM items show their current required quantity</p>
          </div>

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
                  getMatchingProducts(search).map(p => {
                    const bomItem = bom.find((b: any) => b.product_id === p.id);
                    return (
                      <button
                        key={p.id}
                        onMouseDown={() => addProduct(p)}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-900 dark:text-white"
                      >
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded mr-2">{p.sku}</span>
                        {p.name}
                        {bomItem && (
                          <span className="ml-2 text-xs text-gray-400">
                            (currently {Number(bomItem.quantity_required).toLocaleString()} on BOM)
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

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
                    <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400 w-28">Current BOM</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-32">Additional Qty</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Reason</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lineItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded mr-2">{item.sku}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{item.productName}</span>
                        {!item.bomItemId && (
                          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(new material)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                        {item.bomItemId ? item.currentQty.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={item.additionalQty}
                          onChange={e => setLineItems(prev =>
                            prev.map(i => i.id === item.id ? { ...i, additionalQty: Number(e.target.value) } : i)
                          )}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Optional note"
                          value={item.reason}
                          onChange={e => setLineItems(prev =>
                            prev.map(i => i.id === item.id ? { ...i, reason: e.target.value } : i)
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

        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <Link href={`/job-orders/${joId}`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
            {isSubmitting ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </div>
      </div>
    </div>
  );
}
