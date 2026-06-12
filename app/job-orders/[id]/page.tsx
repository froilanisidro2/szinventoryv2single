'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Hammer, CheckCircle2, XCircle, Play, PackageOpen, RotateCcw, AlertCircle, ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getJobOrderById,
  getJobOrderBOM,
  getMaterialIssueSlips,
  getMaterialReturnSlips,
  getMaterialReturnSlipItems,
  updateJobOrderStatus,
  getCompanyUsers,
  getStockLevelsForProducts,
  getProducts,
  addJobOrderBOMItem,
  removeJobOrderBOMItem,
  updateJobOrderBOMItem,
  getJobOrderBOMRequests,
  createJobOrderBOMRequest,
  approveJobOrderBOMRequest,
  rejectJobOrderBOMRequest,
  cancelJobOrderBOMRequest,
} from '@/app/actions';
import { getCurrentUser, hasPermission } from '@/lib/auth-utils';
import type { JobOrder, JobOrderBOMItem, MaterialIssueSlip, MaterialReturnSlip } from '@/types';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const MIS_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  issued: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  acknowledged: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

const MRS_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  returned: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  restocked: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

type Tab = 'bom' | 'bomRequests' | 'issues' | 'returns';

export default function JobOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [job, setJob] = useState<JobOrder | null>(null);
  const [bom, setBom] = useState<JobOrderBOMItem[]>([]);
  const [misSlips, setMisSlips] = useState<MaterialIssueSlip[]>([]);
  const [mrsSlips, setMrsSlips] = useState<MaterialReturnSlip[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [tab, setTab] = useState<Tab>('bom');
  const [mrsItemsMap, setMrsItemsMap] = useState<Record<string, any[]>>({});
  const [canApprove, setCanApprove] = useState(false);
  const [canIssue, setCanIssue] = useState(false);
  const [canReturn, setCanReturn] = useState(false);
  const [canRequestBOM, setCanRequestBOM] = useState(false);
  // BOM change requests (Requestor -> Processor/Admin approval)
  const [bomRequests, setBomRequests] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [requestModal, setRequestModal] = useState<{ bomId?: string; productId: string; productName: string; productSku?: string; currentQty?: number } | null>(null);
  const [requestQty, setRequestQty] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isDecidingRequest, setIsDecidingRequest] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  // BOM add state
  const [bomSearch, setBomSearch] = useState('');
  const [showBomSuggestions, setShowBomSuggestions] = useState(false);
  const [isAddingBOM, setIsAddingBOM] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUserId(user?.id ?? null);
    setCanApprove(user?.isCompanyAdmin || hasPermission('jo:approve') || hasPermission('inventory:write'));
    setCanIssue(user?.isCompanyAdmin || hasPermission('jo:issue') || hasPermission('inventory:write'));
    setCanReturn(user?.isCompanyAdmin || hasPermission('jo:return') || hasPermission('inventory:write'));
    setCanRequestBOM(user?.isCompanyAdmin || hasPermission('jo:create'));
    loadData();
  }, [id]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [jobRes, bomRes, misRes, mrsRes, usersRes, prodsRes, bomReqRes] = await Promise.all([
        getJobOrderById(id),
        getJobOrderBOM(id),
        getMaterialIssueSlips(id),
        getMaterialReturnSlips(id),
        getCompanyUsers(),
        getProducts(500),
        getJobOrderBOMRequests(id),
      ]);
      setBomRequests(Array.isArray(bomReqRes.data) ? bomReqRes.data : []);
      if (!prodsRes.error && Array.isArray(prodsRes.data)) setProducts(prodsRes.data);

      if (jobRes.error || !jobRes.data) {
        toast.error('Job order not found');
        router.push('/job-orders');
        return;
      }
      setJob(jobRes.data);
      setBom(Array.isArray(bomRes.data) ? bomRes.data : []);
      setMisSlips(Array.isArray(misRes.data) ? misRes.data : []);
      const mrsArr = Array.isArray(mrsRes.data) ? mrsRes.data : [];
      setMrsSlips(mrsArr);
      // Load items for each MRS
      if (mrsArr.length > 0) {
        const itemResults = await Promise.all(mrsArr.map((m: any) => getMaterialReturnSlipItems(m.id)));
        const map: Record<string, any[]> = {};
        mrsArr.forEach((m: any, i: number) => {
          map[m.id] = Array.isArray(itemResults[i].data) ? itemResults[i].data : [];
        });
        setMrsItemsMap(map);
      }
      if (!usersRes.error) setUserMap(usersRes.data ?? {});

      const bomReqArr = Array.isArray(bomReqRes.data) ? bomReqRes.data : [];
      const pendingProductIds = Array.from(new Set(
        bomReqArr.filter((r: any) => r.status === 'pending_approval').map((r: any) => r.product_id)
      ));
      if (jobRes.data.warehouse_id && pendingProductIds.length > 0) {
        const stockRes = await getStockLevelsForProducts(pendingProductIds, jobRes.data.warehouse_id);
        const levels: any[] = Array.isArray(stockRes.data) ? stockRes.data : [];
        setStockMap(levels.reduce((acc: Record<string, number>, lvl: any) => {
          acc[lvl.product_id] = Number(lvl.quantity_available ?? 0);
          return acc;
        }, {}));
      }
    } catch {
      toast.error('Error loading job order');
    } finally {
      setIsLoading(false);
    }
  }

  function getMatchingProducts(s: string) {
    if (!s.trim()) return [];
    const lower = s.toLowerCase();
    const usedIds = new Set(bom.map((b: any) => b.product_id));
    return products
      .filter(p => !usedIds.has(p.id) && (p.sku?.toLowerCase().includes(lower) || p.name?.toLowerCase().includes(lower)))
      .slice(0, 8);
  }

  async function handleAddBOMItem(product: any) {
    setIsAddingBOM(true);
    setBomSearch('');
    setShowBomSuggestions(false);
    try {
      const res = await addJobOrderBOMItem(id, product.id, 1);
      if (res.error) { toast.error('Failed to add material'); return; }
      toast.success(`${product.name} added to BOM`);
      const bomRes = await getJobOrderBOM(id);
      setBom(Array.isArray(bomRes.data) ? bomRes.data : []);
    } catch {
      toast.error('Failed to add material');
    } finally {
      setIsAddingBOM(false);
    }
  }


  function openRequestModal(item: { bomId?: string; productId: string; productName: string; productSku?: string; currentQty?: number }) {
    setRequestModal(item);
    setRequestQty('1');
    setRequestReason('');
  }

  async function handleSubmitBOMRequest() {
    if (!requestModal) return;
    const qty = Number(requestQty);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const res = await createJobOrderBOMRequest(id, requestModal.productId, qty, {
        jobOrderBomId: requestModal.bomId,
        currentQuantity: requestModal.currentQty,
        reason: requestReason || undefined,
      });
      if (res.error) {
        toast.error('Failed to submit request: ' + res.error.message);
        return;
      }
      toast.success('BOM change request submitted for approval');
      setRequestModal(null);
      setBomSearch('');
      setShowBomSuggestions(false);
      const bomReqRes = await getJobOrderBOMRequests(id);
      setBomRequests(Array.isArray(bomReqRes.data) ? bomReqRes.data : []);
    } catch {
      toast.error('Unexpected error submitting request');
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  async function handleDecideBOMRequest(requestId: string, approve: boolean) {
    setIsDecidingRequest(requestId);
    try {
      const res = approve
        ? await approveJobOrderBOMRequest(requestId)
        : await rejectJobOrderBOMRequest(requestId);
      if (res.error) {
        toast.error(`Failed to ${approve ? 'approve' : 'reject'} request: ` + res.error.message);
        return;
      }
      toast.success(`Request ${approve ? 'approved and applied to BOM' : 'rejected'}`);
      const [bomRes, bomReqRes] = await Promise.all([getJobOrderBOM(id), getJobOrderBOMRequests(id)]);
      setBom(Array.isArray(bomRes.data) ? bomRes.data : []);
      setBomRequests(Array.isArray(bomReqRes.data) ? bomReqRes.data : []);
    } catch {
      toast.error('Unexpected error');
    } finally {
      setIsDecidingRequest(null);
    }
  }

  async function handleCancelBOMRequest(requestId: string) {
    setIsDecidingRequest(requestId);
    try {
      const res = await cancelJobOrderBOMRequest(requestId);
      if (res.error) {
        toast.error('Failed to cancel request: ' + res.error.message);
        return;
      }
      toast.success('Request cancelled');
      setBomRequests(prev => prev.filter((r: any) => r.id !== requestId));
    } catch {
      toast.error('Unexpected error');
    } finally {
      setIsDecidingRequest(null);
    }
  }

  async function handleRemoveBOMItem(bomItemId: string, productName: string) {
    try {
      await removeJobOrderBOMItem(bomItemId);
      toast.success(`${productName} removed from BOM`);
      setBom(prev => prev.filter((b: any) => b.id !== bomItemId));
    } catch {
      toast.error('Failed to remove material');
    }
  }

  async function handleStatusChange(
    status: 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled'
  ) {
    if (!job) return;
    setIsUpdating(true);
    try {
      const res = await updateJobOrderStatus(id, status);
      if (res.error) { toast.error('Failed to update status'); return; }
      setJob(prev => prev ? { ...prev, status } : prev);
      setShowCompleteConfirm(false);
      toast.success(`Job order marked as ${STATUS_LABELS[status]}`);
    } catch {
      toast.error('Error updating job order');
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>;
  }
  if (!job) return null;

  return (
    <div className="flex-1 p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/job-orders">
          <Button variant="secondary" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
        </Link>
        <Hammer className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white font-mono">{job.jo_number}</h1>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[job.status]}`}>
          {STATUS_LABELS[job.status]}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[job.priority]}`}>
          {job.priority}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">{job.title}</span>

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {canRequestBOM && !['completed', 'cancelled'].includes(job.status) && (
            <Link href={`/job-orders/${id}/bom-adjustment`}>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
                <ClipboardList className="h-4 w-4" />BOM Request
              </Button>
            </Link>
          )}
          {job.status === 'pending_approval' && canApprove && (
            <>
              <Button onClick={() => handleStatusChange('approved')} disabled={isUpdating} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-1" />Approve
              </Button>
              <Button onClick={() => handleStatusChange('cancelled')} disabled={isUpdating} variant="secondary" className="border-red-400 text-red-600 hover:bg-red-50 dark:text-red-400">
                <XCircle className="h-4 w-4 mr-1" />Reject
              </Button>
            </>
          )}
          {job.status === 'approved' && (
            <Button onClick={() => handleStatusChange('in_progress')} disabled={isUpdating} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Play className="h-4 w-4 mr-1" />Start Production
            </Button>
          )}
          {job.status === 'in_progress' && (
            <>
              {canIssue && (
                <Link href={`/job-orders/${id}/issue`}>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
                    <PackageOpen className="h-4 w-4" />Issue Materials
                  </Button>
                </Link>
              )}
              {canReturn && (
                <Link href={`/job-orders/${id}/return`}>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
                    <RotateCcw className="h-4 w-4" />Record Returns
                  </Button>
                </Link>
              )}
              <Button onClick={() => setShowCompleteConfirm(true)} disabled={isUpdating} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-1" />Complete Job
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">

        {/* ── Main: tabs ── */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
            {(['bom', 'bomRequests', 'issues', 'returns'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === t
                    ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {t === 'bom'
                  ? `Bill of Materials (${bom.length})`
                  : t === 'bomRequests'
                  ? `BOM Requests (${bomRequests.length})`
                  : t === 'issues'
                  ? `Issue Slips (${misSlips.length})`
                  : `Return Slips (${mrsSlips.length})`}
              </button>
            ))}
          </div>

        {/* BOM Requests Tab */}
        {tab === 'bomRequests' && (
          <div className="space-y-3">
            {bomRequests.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <AlertCircle className="h-5 w-5 mr-2" />
                No BOM adjustment requests yet.
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Material</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Requested</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Available</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Reason</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {bomRequests.map((r: any) => {
                      const available = stockMap[r.product_id] ?? 0;
                      const insufficientStock = r.status === 'pending_approval' && Number(r.requested_quantity) > available;
                      return (
                      <tr key={r.id}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-gray-900 dark:text-white">{r.product?.name || 'Item'}</p>
                          {r.product?.sku && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{r.product.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                          {r.job_order_bom_id ? (
                            <>
                              +{Number(r.requested_quantity).toLocaleString()}
                              <div className="text-xs text-gray-400">currently {Number(r.current_quantity ?? 0).toLocaleString()}</div>
                            </>
                          ) : (
                            <>
                              {Number(r.requested_quantity).toLocaleString()}
                              <div className="text-xs text-amber-600 dark:text-amber-400">new material</div>
                            </>
                          )}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${insufficientStock ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                          {r.status === 'pending_approval' ? (
                            <>
                              {available.toLocaleString()}
                              {insufficientStock && (
                                <div className="text-xs font-normal text-red-500">Insufficient stock</div>
                              )}
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                          {r.reason || '—'}
                          {r.status !== 'pending_approval' && r.rejection_reason && (
                            <div className="text-xs text-red-500">{r.rejection_reason}</div>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {r.status === 'pending_approval' ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                              Pending Approval
                            </span>
                          ) : (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              r.status === 'approved'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}>
                              {r.status === 'approved' ? 'Approved' : 'Rejected'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {r.status === 'pending_approval' && (
                            <div className="flex items-center justify-end gap-2">
                              {canApprove && (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={isDecidingRequest === r.id || insufficientStock}
                                    onClick={() => handleDecideBOMRequest(r.id, true)}
                                    title={insufficientStock ? 'Not enough stock on hand to approve this request' : undefined}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={isDecidingRequest === r.id}
                                    onClick={() => handleDecideBOMRequest(r.id, false)}
                                    className="border-red-400 text-red-600 hover:bg-red-50 dark:text-red-400"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {r.requested_by_user_id === currentUserId && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={isDecidingRequest === r.id}
                                  onClick={() => handleCancelBOMRequest(r.id)}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BOM Tab */}
        {tab === 'bom' && (
          <div className="space-y-3">
            {/* Add material search — only when JO is editable */}
            {job && !['completed', 'cancelled'].includes(job.status) && (canApprove || canRequestBOM) && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by SKU or name to add material…"
                  value={bomSearch}
                  onChange={e => { setBomSearch(e.target.value); setShowBomSuggestions(e.target.value.length > 0); }}
                  onFocus={() => { if (bomSearch.length > 0) setShowBomSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowBomSuggestions(false), 150)}
                  disabled={isAddingBOM}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                />
                {showBomSuggestions && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-h-56 overflow-y-auto">
                    {getMatchingProducts(bomSearch).length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No products found</div>
                    ) : (
                      getMatchingProducts(bomSearch).map((p: any) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                        >
                          <button
                            onMouseDown={() => canApprove && handleAddBOMItem(p)}
                            disabled={!canApprove}
                            className="flex-1 text-left text-sm text-gray-900 dark:text-white disabled:cursor-default"
                          >
                            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded mr-2">{p.sku}</span>
                            {p.name}
                          </button>
                          {canRequestBOM && (
                            <button
                              onMouseDown={() => openRequestModal({ productId: p.id, productName: p.name, productSku: p.sku, currentQty: 0 })}
                              className="flex-shrink-0 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              Request to add to BOM
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            {bom.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <AlertCircle className="h-5 w-5 mr-2" />
                No BOM items. Search above to add materials.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Material</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">BOM Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Issued</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Returned</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Scrapped</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Net Used</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Variance</th>
                    <th className="px-4 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {bom.map((item: any) => {
                    const netUsed = (item.quantity_issued || 0) - (item.quantity_returned || 0) - (item.quantity_scrapped || 0);
                    const variance = netUsed - (item.quantity_required || 0);
                    const varianceColor = variance > 0
                      ? 'text-red-600 dark:text-red-400'
                      : variance < 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400';
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.product?.name || item.product_name || '—'}
                          </p>
                          {(item.product?.sku || item.product_sku) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.product?.sku || item.product_sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {job && !['completed', 'cancelled'].includes(job.status) && canApprove ? (
                            <input
                              key={`${item.id}-${item.quantity_required}`}
                              type="number"
                              min={0.01}
                              step={0.01}
                              defaultValue={Number(item.quantity_required)}
                              onBlur={async (e) => {
                                const val = Number(e.target.value);
                                if (val > 0 && val !== Number(item.quantity_required)) {
                                  const res = await updateJobOrderBOMItem(item.id, val);
                                  if (res.error) { toast.error('Failed to update quantity'); e.target.value = String(item.quantity_required); }
                                  else { const bomRes = await getJobOrderBOM(id); setBom(Array.isArray(bomRes.data) ? bomRes.data : []); }
                                }
                              }}
                              className="w-20 text-right rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-transparent px-1 py-0.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-800"
                            />
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">{Number(item.quantity_required).toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">
                          {Number(item.quantity_issued || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">
                          {Number(item.quantity_returned || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-orange-600 dark:text-orange-400">
                          {Number(item.quantity_scrapped || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                          {netUsed.toLocaleString()}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${varianceColor}`}>
                          {variance === 0 ? '—' : (variance > 0 ? '+' : '') + variance.toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          {job && !['completed', 'cancelled'].includes(job.status) && item.quantity_issued === 0 && (
                            <button
                              onClick={() => handleRemoveBOMItem(item.id, item.product?.name || 'Item')}
                              className="text-red-400 hover:text-red-600 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Remove from BOM"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          </div>
        )}

        {/* Issue Slips Tab */}
        {tab === 'issues' && (
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            {misSlips.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <AlertCircle className="h-5 w-5 mr-2" />
                No issue slips yet
                {job.status === 'in_progress' && (
                  <Link href={`/job-orders/${id}/issue`} className="ml-2 text-primary-600 dark:text-primary-400 underline text-sm">
                    Issue Materials
                  </Link>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">MIS #</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Issued By</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Received By</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Issued At</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {misSlips.map(mis => (
                    <tr key={mis.id}>
                      <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">{mis.mis_number}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                        {mis.issued_by_user_id ? (userMap[mis.issued_by_user_id] || '—') : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                        {mis.received_by_user_id ? (userMap[mis.received_by_user_id] || '—') : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                        {mis.issued_at ? new Date(mis.issued_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${MIS_STATUS_COLORS[mis.status]}`}>
                          {mis.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Return Slips Tab */}
        {tab === 'returns' && (
          <div className="space-y-3">
            {mrsSlips.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 flex items-center justify-center py-10 text-gray-400">
                <AlertCircle className="h-5 w-5 mr-2" />
                No return slips yet
                {job.status === 'in_progress' && (
                  <Link href={`/job-orders/${id}/return`} className="ml-2 text-primary-600 dark:text-primary-400 underline text-sm">
                    Record Returns
                  </Link>
                )}
              </div>
            ) : (
              mrsSlips.map(mrs => {
                const slipItems: any[] = mrsItemsMap[mrs.id] || [];
                return (
                  <div key={mrs.id} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                    {/* MRS header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">{mrs.mrs_number}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${MRS_STATUS_COLORS[mrs.status]}`}>
                          {mrs.status}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {mrs.returned_at ? new Date(mrs.returned_at).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-3">
                        {mrs.returned_by_user_id && (
                          <span>Returned by: <strong className="text-gray-700 dark:text-gray-300">{userMap[mrs.returned_by_user_id] || '—'}</strong></span>
                        )}
                        {mrs.received_by_user_id && (
                          <span>Received by: <strong className="text-gray-700 dark:text-gray-300">{userMap[mrs.received_by_user_id] || '—'}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    {slipItems.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400">No items recorded for this slip.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 dark:border-gray-800">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Material</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Qty Returned</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Condition</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {slipItems.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {item.product?.name || item.product_id || '—'}
                                </p>
                                {item.product?.sku && (
                                  <p className="text-xs text-gray-500 font-mono">{item.product.sku}</p>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-green-600 dark:text-green-400">
                                {Number(item.quantity_returned).toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                  item.condition === 'good' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : item.condition === 'damaged' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                }`}>
                                  {item.condition}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                                {item.notes || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        </div>{/* end main column */}

        {/* ── Sidebar: job details ── */}
        <div className="w-60 shrink-0 sticky top-4 self-start space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Job Details</p>

            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Status</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                {STATUS_LABELS[job.status]}
              </span>
            </div>

            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Priority</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[job.priority]}`}>
                {job.priority}
              </span>
            </div>

            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Production Lead</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {job.production_lead || '—'}
              </p>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Start Date</p>
                <p className="text-sm text-gray-900 dark:text-white">{job.start_date ? new Date(job.start_date).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Target Completion</p>
                <p className="text-sm text-gray-900 dark:text-white">{job.target_completion_date ? new Date(job.target_completion_date).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Actual Completion</p>
                <p className="text-sm text-gray-900 dark:text-white">{job.actual_completion_date ? new Date(job.actual_completion_date).toLocaleDateString() : '—'}</p>
              </div>
            </div>

            {job.description && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Description</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">{job.description}</p>
              </div>
            )}

            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">BOM Items</span>
                <span className="font-semibold text-gray-900 dark:text-white">{bom.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Issue Slips</span>
                <span className="font-semibold text-gray-900 dark:text-white">{misSlips.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Return Slips</span>
                <span className="font-semibold text-gray-900 dark:text-white">{mrsSlips.length}</span>
              </div>
            </div>
          </div>
        </div>

      </div>{/* end two-column */}

      {/* Complete confirmation modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Complete Job Order?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Make sure all materials have been accounted for (issued, returned, or scrapped) before completing.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowCompleteConfirm(false)}>Cancel</Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={isUpdating}
                onClick={() => handleStatusChange('completed')}
              >
                Complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* BOM change request modal */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Request BOM Adjustment</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {requestModal.productName}{requestModal.productSku ? ` (${requestModal.productSku})` : ''}
              {requestModal.bomId
                ? ` — currently ${requestModal.currentQty?.toLocaleString()} required.`
                : ' — not yet on this BOM.'}
            </p>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional quantity needed
            </label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={requestQty}
              onChange={e => setRequestQty(e.target.value)}
              className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (optional)</label>
            <textarea
              value={requestReason}
              onChange={e => setRequestReason(e.target.value)}
              rows={2}
              placeholder="Why is this change needed?"
              className="w-full mb-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRequestModal(null)}>Cancel</Button>
              <Button
                disabled={isSubmittingRequest}
                onClick={handleSubmitBOMRequest}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSubmittingRequest ? 'Submitting…' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
