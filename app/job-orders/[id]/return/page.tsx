'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getJobOrderById,
  getJobOrderBOM,
  getMaterialIssueSlips,
  getBinLocationsByWarehouse,
  createMaterialReturnSlip,
  restockReturnedMaterials,
} from '@/app/actions';

interface ReturnRow {
  bomId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantityIssued: number;
  quantityReturned: number;
  quantityScrapped: number;
  quantityToReturn: number;
  condition: 'good' | 'damaged' | 'scrap';
  binLocationId: string;
  notes: string;
}

export default function ReturnMaterialsPage() {
  const params = useParams();
  const router = useRouter();
  const joId = params.id as string;

  const [jobTitle, setJobTitle] = useState('');
  const [joNumber, setJoNumber] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [latestMisId, setLatestMisId] = useState<string | undefined>();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [joId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [jobRes, bomRes, misRes] = await Promise.all([
        getJobOrderById(joId),
        getJobOrderBOM(joId),
        getMaterialIssueSlips(joId),
      ]);
      if (jobRes.error || !jobRes.data) {
        toast.error('Job order not found');
        router.push('/job-orders');
        return;
      }
      const job = jobRes.data;
      setJobTitle(job.title);
      setJoNumber(job.jo_number);
      setWarehouseId(job.warehouse_id || '');

      if (job.warehouse_id) {
        const binsRes = await getBinLocationsByWarehouse(job.warehouse_id);
        setBins(Array.isArray(binsRes.data) ? binsRes.data : []);
      }

      const misSlips: any[] = Array.isArray(misRes.data) ? misRes.data : [];
      const acknowledged = misSlips.filter(m => m.status === 'acknowledged' || m.status === 'issued');
      if (acknowledged.length > 0) {
        // Use the most recent acknowledged MIS
        setLatestMisId(acknowledged[0].id);
      }

      const bomItems: any[] = Array.isArray(bomRes.data) ? bomRes.data : [];
      // Only show items that have been issued
      setRows(
        bomItems
          .filter(item => Number(item.quantity_issued || 0) > 0)
          .map(item => {
            const issued = Number(item.quantity_issued || 0);
            const returned = Number(item.quantity_returned || 0);
            const scrapped = Number(item.quantity_scrapped || 0);
            return {
              bomId: item.id,
              productId: item.product_id || '',
              productName: item.product?.name || item.product_name || item.product_id || '—',
              productSku: item.product?.sku || item.product_sku || '',
              quantityIssued: issued,
              quantityReturned: returned,
              quantityScrapped: scrapped,
              quantityToReturn: 0,
              condition: 'good' as const,
              binLocationId: item.product?.bin_location_id || '',
              notes: '',
            };
          })
      );
    } catch {
      toast.error('Error loading data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReturn() {
    const itemsToReturn = rows.filter(r => r.productId && r.quantityToReturn > 0);
    if (itemsToReturn.length === 0) {
      toast.error('Enter quantities to return for at least one material');
      return;
    }
    for (const r of itemsToReturn) {
      const maxReturnable = r.quantityIssued - r.quantityReturned - r.quantityScrapped;
      if (r.quantityToReturn > maxReturnable) {
        toast.error(`Cannot return more than remaining (${r.productName}: ${maxReturnable} remaining)`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Create MRS
      const createRes = await createMaterialReturnSlip(
        joId,
        latestMisId,
        warehouseId || undefined,
        itemsToReturn.map(r => ({
          product_id: r.productId,
          job_order_bom_id: r.bomId,
          quantity_returned: r.quantityToReturn,
          condition: r.condition,
          bin_location_id: r.binLocationId || undefined,
          notes: r.notes || undefined,
        }))
      );
      if (createRes.error) {
        toast.error('Failed to create MRS: ' + createRes.error.message);
        return;
      }

      // Immediately restock (storekeeper submitting = both actions in one step)
      const restockRes = await restockReturnedMaterials(createRes.data.id);
      if (restockRes.error) {
        toast.error('MRS created but restock failed: ' + restockRes.error.message);
        return;
      }

      toast.success('Materials returned and restocked successfully');
      router.push(`/job-orders/${joId}`);
    } catch {
      toast.error('Unexpected error recording return');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>;
  }

  return (
    <div className="flex-1 space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button href={`/job-orders/${joId}`} variant="secondary" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to JO
          </Button>
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Return Materials</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {joNumber} — {jobTitle}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20 p-4 text-sm text-orange-700 dark:text-orange-300">
        Good and damaged materials will be restocked immediately. Scrap items are written off — they will not be returned to inventory.
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 flex items-center justify-center py-16 text-gray-400">
          No materials have been issued for this job yet. Issue materials first before recording returns.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Return Quantities</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Only enter quantities for items being returned. Leave at 0 to skip.</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Material</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Issued</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Returned</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Remaining</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400 w-28">Return Qty</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-36">Condition</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Return to Bin</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map(row => {
                  const remaining = row.quantityIssued - row.quantityReturned - row.quantityScrapped;
                  const isFullyReturned = remaining <= 0;
                  return (
                  <tr key={row.bomId} className={isFullyReturned ? 'opacity-50' : ''}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-900 dark:text-white">{row.productName}</p>
                      {row.productSku && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{row.productSku}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400 font-medium">
                      {row.quantityIssued.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-orange-500 dark:text-orange-400">
                      {(row.quantityReturned + row.quantityScrapped).toLocaleString()}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${isFullyReturned ? 'text-gray-400' : 'text-green-600 dark:text-green-400'}`}>
                      {remaining <= 0 ? '—' : remaining.toLocaleString()}
                      {isFullyReturned && <div className="text-xs font-normal text-gray-400">fully returned</div>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        step={0.01}
                        disabled={isFullyReturned}
                        value={row.quantityToReturn}
                        onChange={e => {
                          const val = Math.min(Number(e.target.value), remaining);
                          setRows(prev =>
                            prev.map(r => r.bomId === row.bomId ? { ...r, quantityToReturn: val } : r)
                          );
                        }}
                        className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.condition}
                        onChange={e => setRows(prev =>
                          prev.map(r => r.bomId === row.bomId ? { ...r, condition: e.target.value as any } : r)
                        )}
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="good">Good — restock</option>
                        <option value="damaged">Damaged — restock</option>
                        <option value="scrap">Scrap — write off</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {bins.length > 0 ? (
                        <select
                          value={row.binLocationId}
                          onChange={e => setRows(prev =>
                            prev.map(r => r.bomId === row.bomId ? { ...r, binLocationId: e.target.value } : r)
                          )}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">— Any —</option>
                          {bins.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.location_name || `${b.zone}-${b.aisle}-${b.shelf}-${b.bin_number}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">No bins</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="Optional"
                        value={row.notes}
                        onChange={e => setRows(prev =>
                          prev.map(r => r.bomId === row.bomId ? { ...r, notes: e.target.value } : r)
                        )}
                        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <Button href={`/job-orders/${joId}`} variant="secondary">Cancel</Button>
            <Button
              onClick={handleReturn}
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {isSubmitting ? 'Submitting…' : 'Submit Return'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
