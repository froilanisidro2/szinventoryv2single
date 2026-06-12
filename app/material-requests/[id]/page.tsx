'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, AlertCircle, CheckCircle2, XCircle, ShoppingCart, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getMaterialRequestById,
  getMaterialRequestItems,
  updateMaterialRequestStatus,
  getCompanyUsers,
  getSuppliers,
  getPurchaseOrdersByMrfId,
  getProductSupplierMap,
} from '@/app/actions';
import { getCurrentUser, hasPermission } from '@/lib/auth-utils';
import type { MaterialRequest, MaterialRequestItem } from '@/types';

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

const PAGE_SIZE = 5;

interface SupplierGroup {
  supplierId: string | null;
  supplierName: string;
  items: any[];
}

export default function MaterialRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [mrf, setMrf] = useState<MaterialRequest | null>(null);
  const [items, setItems] = useState<MaterialRequestItem[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [supplierMap, setSupplierMap] = useState<Record<string, string>>({});
  const [productSupplierMap, setProductSupplierMap] = useState<Record<string, string>>({});
  const [posBySupplierId, setPosBySupplierId] = useState<Record<string, { id: string; po_number: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [canApprove, setCanApprove] = useState(false);
  // page per supplier group key
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  useEffect(() => {
    const user = getCurrentUser();
    setCanApprove(user?.isCompanyAdmin || hasPermission('mrf:approve') || hasPermission('inventory:write'));
    loadData();
  }, [id]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [mrfRes, itemsRes, usersRes, suppliersRes, posRes, productSupplierRes] = await Promise.all([
        getMaterialRequestById(id),
        getMaterialRequestItems(id),
        getCompanyUsers(),
        getSuppliers(),
        getPurchaseOrdersByMrfId(id),
        getProductSupplierMap(),
      ]);

      if (mrfRes.error || !mrfRes.data) {
        toast.error('Material request not found');
        router.push('/material-requests');
        return;
      }
      setMrf(mrfRes.data);
      setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
      if (!usersRes.error) setUserMap(usersRes.data ?? {});
      if (!suppliersRes.error && Array.isArray(suppliersRes.data)) {
        const map: Record<string, string> = {};
        suppliersRes.data.forEach((s: any) => { map[s.id] = s.name; });
        setSupplierMap(map);
      }
      if (!posRes.error && Array.isArray(posRes.data)) {
        const map: Record<string, { id: string; po_number: string }> = {};
        posRes.data.forEach((po: any) => {
          if (po.supplier_id) map[po.supplier_id] = { id: po.id, po_number: po.po_number };
        });
        setPosBySupplierId(map);
      }
      if (!productSupplierRes.error) setProductSupplierMap(productSupplierRes.data ?? {});
    } catch {
      toast.error('Error loading data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(status: 'pending_approval' | 'approved' | 'rejected') {
    if (!mrf) return;
    if (status === 'rejected' && !rejectionReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    setIsUpdating(true);
    try {
      const res = await updateMaterialRequestStatus(id, status, {
        rejection_reason: status === 'rejected' ? rejectionReason : undefined,
      });
      if (res.error) { toast.error('Failed to update status'); return; }
      setMrf(prev => prev ? { ...prev, status } : prev);
      setShowRejectModal(false);
      setRejectionReason('');
      toast.success(`MRF marked as ${STATUS_LABELS[status]}`);
    } catch {
      toast.error('Error updating status');
    } finally {
      setIsUpdating(false);
    }
  }

  function handleCreatePO(group: SupplierGroup) {
    if (!group.supplierId) {
      toast.error('Cannot create PO — assign a supplier to these products first.');
      return;
    }
    router.push(`/purchase-orders/create?mrf_id=${id}&supplier_id=${group.supplierId}`);
  }

  // Group items by supplier
  const supplierGroups: SupplierGroup[] = [];
  const seen: Record<string, number> = {};
  for (const item of items as any[]) {
    const supplierId = item.product?.supplier_id ?? (item.product?.id && productSupplierMap[item.product.id]) ?? null;
    const supplierName = supplierId ? (supplierMap[supplierId] || 'Unknown Supplier') : 'No Supplier';
    const key = supplierId ?? '__none__';
    if (seen[key] === undefined) {
      seen[key] = supplierGroups.length;
      supplierGroups.push({ supplierId, supplierName, items: [] });
    }
    supplierGroups[seen[key]]!.items.push(item);
  }

  const getGroupPage = (key: string) => groupPages[key] ?? 1;
  const setGroupPage = (key: string, p: number) => setGroupPages(prev => ({ ...prev, [key]: p }));

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>;
  }

  if (!mrf) return null;

  const totalItems = items.length;
  const totalValue = (items as any[]).reduce((s, i) => {
    const p = Number(i.product?.purchase_price || i.product?.cost_price || 0);
    return s + Number(i.quantity_requested) * p;
  }, 0);

  return (
    <div className="flex-1 p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top bar: back + MRF title */}
      <div className="flex items-center gap-3">
        <Link href="/material-requests">
          <Button variant="secondary" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <ClipboardList className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white font-mono">{mrf.mrf_number}</h1>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[mrf.status]}`}>
          {STATUS_LABELS[mrf.status]}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${URGENCY_COLORS[mrf.urgency_level]}`}>
          {mrf.urgency_level.charAt(0).toUpperCase() + mrf.urgency_level.slice(1)} Urgency
        </span>
        {mrf.job_order && (
          <Link
            href={`/job-orders/${mrf.job_order.id}`}
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:underline"
          >
            Shortfall from {mrf.job_order.jo_number}
          </Link>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">

        {/* ── Main content: supplier groups ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 flex items-center justify-center py-10 text-gray-400">
              <AlertCircle className="h-5 w-5 mr-2" />
              No items
            </div>
          ) : (
            supplierGroups.map((group) => {
              const key = group.supplierId ?? '__none__';
              const existingPO = group.supplierId ? posBySupplierId[group.supplierId] : undefined;
              const page = getGroupPage(key);
              const totalPages = Math.max(1, Math.ceil(group.items.length / PAGE_SIZE));
              const pageItems = group.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

              return (
                <div key={key} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                  {/* Supplier header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{group.supplierName}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
                    </div>
                    {mrf.status === 'approved' && (
                      existingPO ? (
                        <Link href={`/purchase-orders/${existingPO.id}`}>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300 dark:border-green-700">
                            <ShoppingCart className="h-3.5 w-3.5" />
                            PO Created: {existingPO.po_number}
                          </span>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!group.supplierId}
                          onClick={() => handleCreatePO(group)}
                          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          title={!group.supplierId ? 'Assign a supplier to these products first' : `Create PO for ${group.supplierName}`}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Create PO
                        </Button>
                      )
                    )}
                  </div>

                  {/* Items table */}
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 dark:border-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Product</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Qty Requested</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Unit Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">PO #</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {pageItems.map((item: any, idx: number) => {
                        const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
                        const unitPrice = Number(item.product?.purchase_price || item.product?.cost_price || 0);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 text-xs">{globalIdx}</td>
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-gray-900 dark:text-white">{item.product?.name || item.product_name || '—'}</p>
                              {(item.product?.sku || item.product_sku) && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.product?.sku || item.product_sku}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">
                              {Number(item.quantity_requested).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">
                              {unitPrice > 0 ? `₱${unitPrice.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              {existingPO ? (
                                <Link href={`/purchase-orders/${existingPO.id}`} className="text-xs font-mono text-blue-600 hover:underline dark:text-blue-400">
                                  {existingPO.po_number}
                                </Link>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{item.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 text-right font-medium">Subtotal</td>
                        <td className="px-4 py-2 text-right text-xs font-semibold text-gray-900 dark:text-white">
                          {group.items.reduce((s: number, i: any) => s + Number(i.quantity_requested), 0).toLocaleString()} units
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-semibold text-gray-900 dark:text-white">
                          {(() => {
                            const total = group.items.reduce((s: number, i: any) => {
                              const p = Number(i.product?.purchase_price || i.product?.cost_price || 0);
                              return s + Number(i.quantity_requested) * p;
                            }, 0);
                            return total > 0 ? `₱${total.toFixed(2)}` : '—';
                          })()}
                        </td>
                        <td /><td />
                      </tr>
                    </tfoot>
                  </table>

                  {/* Per-group pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 text-xs text-gray-500 dark:text-gray-400">
                      <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, group.items.length)} of {group.items.length}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setGroupPage(key, Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2">Page {page} of {totalPages}</span>
                        <button
                          onClick={() => setGroupPage(key, Math.min(totalPages, page + 1))}
                          disabled={page === totalPages}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {!group.supplierId && mrf.status === 'approved' && (
                    <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-100 dark:border-yellow-800 text-xs text-yellow-700 dark:text-yellow-400">
                      ⚠ These products have no supplier assigned. Edit each product to set a supplier before creating a PO.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Sidebar: details + actions ── */}
        <div className="w-64 shrink-0 space-y-3 sticky top-4 self-start">

          {/* Details card */}
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Details</p>

            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Created by</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {mrf.requestor_user_id ? (userMap[mrf.requestor_user_id] || 'Unknown') : 'Unknown'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(mrf.created_at).toLocaleString()}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Status</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[mrf.status]}`}>
                {STATUS_LABELS[mrf.status]}
              </span>
            </div>

            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Urgency</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${URGENCY_COLORS[mrf.urgency_level]}`}>
                {mrf.urgency_level.charAt(0).toUpperCase() + mrf.urgency_level.slice(1)}
              </span>
            </div>

            {mrf.status === 'approved' && (mrf as any).approved_at && (
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Approved by</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {(mrf as any).approved_by_user_id ? (userMap[(mrf as any).approved_by_user_id] || 'Unknown') : '—'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date((mrf as any).approved_at).toLocaleString()}</p>
              </div>
            )}

            {mrf.status === 'rejected' && (mrf as any).rejection_reason && (
              <div className="rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Rejection Reason</p>
                <p className="text-xs text-red-700 dark:text-red-300">{(mrf as any).rejection_reason}</p>
              </div>
            )}

            {(mrf as any).notes && (
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Notes</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">{(mrf as any).notes}</p>
              </div>
            )}

            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 dark:text-gray-500">Total items</span>
                <span className="font-semibold text-gray-900 dark:text-white">{totalItems}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 dark:text-gray-500">Est. value</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {totalValue > 0 ? `₱${totalValue.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 dark:text-gray-500">Suppliers</span>
                <span className="font-semibold text-gray-900 dark:text-white">{supplierGroups.length}</span>
              </div>
            </div>
          </div>

          {/* Action buttons card */}
          {mrf.status === 'pending_approval' && canApprove && (
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Actions</p>
              {mrf.status === 'pending_approval' && canApprove && (
                <>
                  <Button
                    onClick={() => handleStatusChange('approved')}
                    disabled={isUpdating}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => setShowRejectModal(true)}
                    disabled={isUpdating}
                    variant="secondary"
                    className="w-full border-red-400 text-red-600 hover:bg-red-50 dark:text-red-400"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Reject MRF</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Provide a reason so the requestor understands what needs to change.
            </p>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Rejection reason…"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!rejectionReason.trim() || isUpdating}
                onClick={() => handleStatusChange('rejected')}
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
