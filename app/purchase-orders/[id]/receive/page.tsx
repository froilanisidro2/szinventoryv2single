'use client';

import { Fragment, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import {
  getPurchaseOrderById,
  getPurchaseOrderItemsWithProducts,
  getPurchaseOrderItems,
  updatePurchaseOrderItem,
  getWarehouses,
  getBinLocationsByWarehouse,
  updatePurchaseOrder,
  createStockTransaction,
  updateBinStock,
  autoCreateInvoiceFromPurchaseOrder,
  autoCreateGRNFromPurchaseOrder,
  shouldTrackBatchesForProduct,
  generateBatchNumber,
  receiveGoodsWithRejection,
} from '@/app/actions';
import type { PurchaseOrderItem } from '@/types';

interface WarehouseItem {
  id: string;
  name: string;
}

interface BinLocation {
  id: string;
  warehouse_id: string;
  location_name?: string;
  zone: string;
  aisle: string;
  shelf: string;
  bin_number: string;
  available_quantity?: number;
}

interface GroupedItem {
  productId: string;
  productName: string;
  sku: string;
  product: any;
  itemIds: string[];
  quantityOrdered: number;
  quantityReceived: number;
}

interface ReceivedItem {
  productId: string;
  quantity: number;
  quantityAccepted: number;
  quantityRejected: number;
  warehouseId: string;
  binLocationId?: string;
  defaultWarehouseId?: string;
  defaultBinLocationId?: string;
  rejectionReason?: string;
  qcNotes?: string;
  track_batches?: boolean;
  batch_number?: string;
  mfg_date?: string;
  expiration_date?: string;
}

export default function ReceiveGoodsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [rawItems, setRawItems] = useState<PurchaseOrderItem[]>([]);
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [binLocations, setBinLocations] = useState<Record<string, BinLocation[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receivedItems, setReceivedItems] = useState<Record<string, ReceivedItem>>({});

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [itemsResponse, warehousesResponse] = await Promise.all([
        getPurchaseOrderItemsWithProducts(id),
        getWarehouses(),
      ]);

      if (itemsResponse.error) {
        toast.error('Failed to load PO items');
        router.back();
        return;
      }

      const itemsData: PurchaseOrderItem[] = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
      setRawItems(itemsData);

      const warehousesData: WarehouseItem[] = Array.isArray(warehousesResponse.data) ? warehousesResponse.data : [];
      setWarehouses(warehousesData);

      const binLocationsByWarehouse: Record<string, BinLocation[]> = {};
      for (const warehouse of warehousesData) {
        const binsResponse = await getBinLocationsByWarehouse(warehouse.id);
        if (!binsResponse.error && binsResponse.data) {
          binLocationsByWarehouse[warehouse.id] = Array.isArray(binsResponse.data) ? binsResponse.data : [];
        }
      }
      setBinLocations(binLocationsByWarehouse);

      // Group by product_id → 1 row per SKU
      const groupMap: Record<string, GroupedItem> = {};
      for (const item of itemsData) {
        const pid = item.product_id!;
        if (!groupMap[pid]) {
          groupMap[pid] = {
            productId: pid,
            productName: item.product?.name || item.description || pid,
            sku: item.product?.sku || '',
            product: item.product,
            itemIds: [],
            quantityOrdered: 0,
            quantityReceived: 0,
          };
        }
        groupMap[pid].itemIds.push(item.id);
        groupMap[pid].quantityOrdered += parseFloat(String(item.quantity_ordered)) || 0;
        groupMap[pid].quantityReceived += parseFloat(String(item.quantity_received)) || 0;
      }
      const groups = Object.values(groupMap);
      setGroupedItems(groups);

      // Determine the next batch number sequence (BAT-yymmdd-0001) once, then increment locally per item
      let batchPrefix = '';
      let nextBatchSeq = 1;
      const batchResult = await generateBatchNumber();
      if (!batchResult.error && batchResult.data) {
        const match = batchResult.data.match(/^(.*-)(\d{4})$/);
        if (match) {
          batchPrefix = match[1]!;
          nextBatchSeq = parseInt(match[2]!, 10);
        }
      }

      // Initialize receivedItems keyed by productId
      const initialized: Record<string, ReceivedItem> = {};
      for (const group of groups) {
        const product = group.product;
        const productWarehouseId = product?.warehouse_id || warehousesData[0]?.id || '';
        const productBinId = product?.bin_location_id;
        const defaultBinId = productBinId || binLocationsByWarehouse[productWarehouseId]?.[0]?.id;

        const { shouldTrack } = await shouldTrackBatchesForProduct(group.productId);
        const stillNeeded = Math.max(0, group.quantityOrdered - group.quantityReceived);

        const autoBatch = shouldTrack && batchPrefix
          ? `${batchPrefix}${String(nextBatchSeq++).padStart(4, '0')}`
          : '';

        initialized[group.productId] = {
          productId: group.productId,
          quantity: stillNeeded,
          quantityAccepted: stillNeeded,
          quantityRejected: 0,
          warehouseId: productWarehouseId,
          binLocationId: defaultBinId,
          defaultWarehouseId: productWarehouseId,
          defaultBinLocationId: defaultBinId,
          track_batches: shouldTrack,
          batch_number: autoBatch,
          mfg_date: '',
          expiration_date: '',
        };
      }
      setReceivedItems(initialized);
    } catch (error) {
      console.error('[RECEIVE] Error loading data:', error);
      toast.error('Error loading data');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const setItem = (productId: string, patch: Partial<ReceivedItem>) =>
    setReceivedItems((prev) => ({ ...prev, [productId]: { ...prev[productId]!, ...patch } }));

  const handleReceive = async () => {
    try {
      setIsSubmitting(true);

      const hasItems = Object.values(receivedItems).some((r) => r.quantity > 0);
      if (!hasItems) { toast.error('Please enter quantities for at least one item'); return; }

      const hasQtyMismatch = Object.values(receivedItems).some((r) => {
        if (r.quantity === 0) return false;
        return Math.abs((r.quantityAccepted || 0) + (r.quantityRejected || 0) - r.quantity) > 0.001;
      });
      if (hasQtyMismatch) { toast.error('For each item: Accepted + Rejected must equal Total Received'); return; }

      if (Object.values(receivedItems).some((r) => r.quantity > 0 && !r.warehouseId)) {
        toast.error('Please select a warehouse for all items to receive'); return;
      }
      if (Object.values(receivedItems).some((r) => r.quantity > 0 && !r.binLocationId)) {
        toast.error('Please select a bin location for all items to receive'); return;
      }
      if (Object.values(receivedItems).some((r) => r.quantityRejected > 0 && !r.rejectionReason)) {
        toast.error('Please provide a rejection reason for rejected items'); return;
      }

      // Distribute received qty proportionally across underlying PO item rows
      for (const group of groupedItems) {
        const received = receivedItems[group.productId];
        if (!received || received.quantity <= 0) continue;

        let remaining = received.quantity;
        let remAccepted = received.quantityAccepted || 0;
        let remRejected = received.quantityRejected || 0;

        for (const itemId of group.itemIds) {
          if (remaining <= 0) break;
          const rawItem = rawItems.find((i) => i.id === itemId);
          if (!rawItem) continue;
          const canReceive = Math.max(0, (parseFloat(String(rawItem.quantity_ordered)) || 0) - (parseFloat(String(rawItem.quantity_received)) || 0));
          if (canReceive <= 0) continue;

          const toReceive = Math.min(remaining, canReceive);
          const ratio = toReceive / received.quantity;
          const toAccept = Math.round(remAccepted * ratio * 100) / 100;
          const toReject = Math.round(remRejected * ratio * 100) / 100;

          await updatePurchaseOrderItem(itemId, {
            quantity_received: (parseFloat(String(rawItem.quantity_received)) || 0) + toReceive,
            quantity_accepted: (parseFloat(String(rawItem.quantity_accepted)) || 0) + toAccept,
            quantity_rejected: (parseFloat(String(rawItem.quantity_rejected)) || 0) + toReject,
            warehouse_id: received.warehouseId,
            bin_location_id: received.binLocationId,
            rejection_reason: received.rejectionReason || null,
            qc_notes: received.qcNotes || null,
            ...(received.track_batches && received.batch_number ? {
              batch_number: received.batch_number,
              mfg_date: received.mfg_date || null,
              expiration_date: received.expiration_date || null,
            } : {}),
          });

          remaining -= toReceive;
          remAccepted -= toAccept;
          remRejected -= toReject;
        }
      }

      const poResponse = await getPurchaseOrderById(id);
      const po = Array.isArray(poResponse.data) ? poResponse.data[0] : poResponse.data;
      if (!po) { toast.error('Could not fetch PO information'); return; }

      const inventoryUpdateErrors: string[] = [];

      for (const group of groupedItems) {
        const received = receivedItems[group.productId];
        if (!received || (received.quantityAccepted <= 0 && received.quantityRejected <= 0)) continue;
        try {
          const goodsResult = await receiveGoodsWithRejection(
            group.productId,
            received.quantityAccepted || 0,
            received.quantityRejected || 0,
            received.track_batches ? {
              batch_number: received.batch_number || `AUTO-${Date.now()}`,
              mfg_date: received.mfg_date,
              expiration_date: received.expiration_date,
              warehouse_id: received.warehouseId,
              notes: received.qcNotes,
            } : undefined,
            received.rejectionReason || undefined,
            received.warehouseId,
          );
          if (goodsResult.error) throw new Error(`Goods receiving failed: ${goodsResult.error}`);

          if (received.quantityAccepted > 0) {
            await createStockTransaction({
              product_id: group.productId,
              transaction_type: 'inbound',
              quantity: received.quantityAccepted,
              notes: `Received from PO ${po.po_number}${received.track_batches ? ` [Batch: ${received.batch_number}]` : ''}${received.qcNotes ? ` — ${received.qcNotes}` : ''}`,
              reference_id: po.id,
              reference_type: 'purchase_order',
              warehouse_id: received.warehouseId,
            });
          }

          if (received.quantityAccepted > 0 && received.binLocationId) {
            await updateBinStock(received.binLocationId, group.productId, received.quantityAccepted);
          }
        } catch (error) {
          inventoryUpdateErrors.push(`${group.productName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (inventoryUpdateErrors.length > 0) {
        toast.warning(`Items received with warnings:\n${inventoryUpdateErrors.join('\n')}`);
      }

      const itemsAfterReceive = await getPurchaseOrderItems(id);
      const itemsData: any[] = Array.isArray(itemsAfterReceive.data) ? itemsAfterReceive.data : [];
      const allReceived = itemsData.every(
        (item) => parseFloat(String(item.quantity_received)) >= parseFloat(String(item.quantity_ordered))
      );

      if (allReceived) {
        const orderResponse = await getPurchaseOrderById(id);
        const order = Array.isArray(orderResponse.data) ? orderResponse.data[0] : orderResponse.data;
        if (order?.status !== 'received') {
          await updatePurchaseOrder(id, { status: 'received' });
          const [invoiceResult, grnResult] = await Promise.all([
            autoCreateInvoiceFromPurchaseOrder(id),
            autoCreateGRNFromPurchaseOrder(id, receivedItems),
          ]);
          if (!invoiceResult.error && !grnResult.error) {
            toast.success('All items received! Invoice and GRN created and PO marked as received');
          } else {
            toast.warning('All items received, but invoice/GRN creation had issues.');
          }
        }
      } else {
        const orderResponse = await getPurchaseOrderById(id);
        const order = Array.isArray(orderResponse.data) ? orderResponse.data[0] : orderResponse.data;
        if (order && (order.status === 'draft' || order.status === 'sent')) {
          await updatePurchaseOrder(id, { status: 'partially_received' });
        }
      }

      toast.success('Goods received and inventory updated');
      router.push(`/purchase-orders/${id}`);
    } catch (error) {
      toast.error('Error receiving goods');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const hasWarehouses = warehouses.length > 0;
  const hasAnyBins = Object.values(binLocations).some((bins) => bins.length > 0);
  const hasBatchItems = Object.values(receivedItems).some((r) => r.track_batches);
  const totalCols = hasBatchItems ? 10 : 7;

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/purchase-orders/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to PO
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Receive Goods</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Record received items and add them to inventory</p>
        </div>
      </div>

      {!hasWarehouses && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />No Warehouses Configured
          </h3>
          <p className="text-sm text-red-800 dark:text-red-300 mt-2">
            You must configure at least one warehouse before receiving goods.{' '}
            <Link href="/settings/warehouses" className="font-semibold underline">Go to Warehouse Settings</Link>
          </p>
        </div>
      )}

      {hasWarehouses && !hasAnyBins && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />No Bin Locations Configured
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-2">
            You must configure bin locations for your warehouses before receiving goods.{' '}
            <Link href="/settings/bin-locations" className="font-semibold underline">Go to Bin Location Settings</Link>
          </p>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 flex items-center gap-3 text-sm text-blue-800 dark:text-blue-300">
        <Warehouse className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span><strong>Putaway:</strong> Each item defaults to its product&apos;s configured warehouse/bin. Change the dropdowns to override per-item if needed.</span>
      </div>

      <div className="card divide-y divide-gray-200 dark:divide-gray-700">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Items to Receive &amp; Putaway
          </h2>
        </div>

        <div className="overflow-x-auto">
          {!hasWarehouses || !hasAnyBins ? (
            <div className="text-center py-12 p-6">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {!hasWarehouses ? 'Configure warehouses to receive goods' : 'Configure bin locations to receive goods'}
              </p>
              <Link href={!hasWarehouses ? '/settings/warehouses' : '/settings/bin-locations'}>
                <Button size="sm" variant="primary">Go to Settings</Button>
              </Link>
            </div>
          ) : groupedItems.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-left text-xs border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 min-w-[200px]">Product</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center">Ordered</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center">Total Rcvd</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center">Accepted ✓</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center">Rejected ✗</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 min-w-[160px]">Warehouse</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 min-w-[140px]">Bin Location</th>
                  {hasBatchItems && <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Batch #</th>}
                  {hasBatchItems && <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Mfg Date</th>}
                  {hasBatchItems && <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Expiry Date</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {groupedItems.map((group) => {
                  const received = receivedItems[group.productId];
                  if (!received) return null;

                  return (
                    <Fragment key={group.productId}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-2 min-w-[200px] max-w-[280px]">
                          <p className="font-medium text-gray-900 dark:text-white whitespace-normal">{group.productName}</p>
                          {group.sku && <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">SKU: {group.sku}</p>}
                        </td>

                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{group.quantityOrdered.toFixed(2)}</td>

                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={received.quantity}
                            onChange={(e) => {
                              const qty = Math.max(0, parseFloat(e.target.value) || 0);
                              setItem(group.productId, { quantity: qty, quantityAccepted: Math.max(0, qty - (received.quantityRejected || 0)) });
                            }}
                            step="0.01" min="0"
                            disabled={isSubmitting}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={received.quantityAccepted}
                            onChange={(e) => {
                              const qty = Math.max(0, Math.min(received.quantity, parseFloat(e.target.value) || 0));
                              setItem(group.productId, { quantityAccepted: qty, quantityRejected: Math.max(0, received.quantity - qty) });
                            }}
                            step="0.01" min="0"
                            disabled={isSubmitting || received.quantity === 0}
                            className="w-20 px-2 py-1 border border-green-300 dark:border-green-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={received.quantityRejected}
                            onChange={(e) => {
                              const qty = Math.max(0, Math.min(received.quantity, parseFloat(e.target.value) || 0));
                              setItem(group.productId, { quantityAccepted: Math.max(0, received.quantity - qty), quantityRejected: qty });
                            }}
                            step="0.01" min="0"
                            disabled={isSubmitting || received.quantity === 0}
                            className="w-20 px-2 py-1 border border-red-300 dark:border-red-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[160px]">
                          <select
                            value={received.warehouseId}
                            onChange={(e) => {
                              const newWh = e.target.value;
                              setItem(group.productId, { warehouseId: newWh, binLocationId: binLocations[newWh]?.[0]?.id });
                            }}
                            disabled={isSubmitting}
                            className="w-full min-w-[150px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          >
                            <option value="">Select</option>
                            {warehouses.map((w) => <option key={w.id} value={w.id}>{fmtWarehouse(w)}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 min-w-[140px]">
                          <select
                            value={received.binLocationId || ''}
                            onChange={(e) => setItem(group.productId, { binLocationId: e.target.value })}
                            disabled={isSubmitting || !received.warehouseId}
                            className="w-full min-w-[130px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                          >
                            <option value="">Select bin</option>
                            {(received.warehouseId ? binLocations[received.warehouseId] || [] : []).map((bin) => (
                              <option key={bin.id} value={bin.id}>
                                {bin.location_name || `${bin.zone}-${bin.aisle}-${bin.shelf}-${bin.bin_number}`}
                                {bin.available_quantity !== undefined && ` (${bin.available_quantity})`}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Batch columns — only rendered when hasBatchItems */}
                        {hasBatchItems && (
                          <td className="px-3 py-2">
                            {received.track_batches ? (
                              <input
                                type="text"
                                value={received.batch_number || ''}
                                onChange={(e) => setItem(group.productId, { batch_number: e.target.value })}
                                disabled={isSubmitting}
                                placeholder="BAT-YYMMDD-0001"
                                className="w-36 px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                            ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                        )}
                        {hasBatchItems && (
                          <td className="px-3 py-2">
                            {received.track_batches ? (
                              <input
                                type="date"
                                value={received.mfg_date || ''}
                                onChange={(e) => setItem(group.productId, { mfg_date: e.target.value })}
                                disabled={isSubmitting}
                                className="px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                            ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                        )}
                        {hasBatchItems && (
                          <td className="px-3 py-2">
                            {received.track_batches ? (
                              <input
                                type="date"
                                value={received.expiration_date || ''}
                                onChange={(e) => setItem(group.productId, { expiration_date: e.target.value })}
                                disabled={isSubmitting}
                                className="px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                            ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                        )}
                      </tr>

                      {/* Rejection sub-row — only shown when there are rejected items */}
                      {received.quantityRejected > 0 && (
                        <tr className="bg-red-50 dark:bg-red-900/10">
                          <td colSpan={totalCols} className="px-3 py-2">
                            <div className="flex gap-4 items-end">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-red-700 dark:text-red-400 mb-1">Rejection Reason *</label>
                                <select
                                  value={received.rejectionReason || ''}
                                  onChange={(e) => setItem(group.productId, { rejectionReason: e.target.value })}
                                  className="w-full px-2 py-1 border border-red-300 dark:border-red-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                >
                                  <option value="">Select reason</option>
                                  <option value="damaged_in_transit">Damaged in Transit</option>
                                  <option value="defective">Defective/Non-Functional</option>
                                  <option value="wrong_item">Wrong Item</option>
                                  <option value="qty_mismatch">Quantity Mismatch</option>
                                  <option value="expired">Expired/Expired Date</option>
                                  <option value="quality_issue">Quality Issue</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-red-700 dark:text-red-400 mb-1">QC Notes</label>
                                <input
                                  type="text"
                                  value={received.qcNotes || ''}
                                  onChange={(e) => setItem(group.productId, { qcNotes: e.target.value })}
                                  disabled={isSubmitting}
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  placeholder="Details about defect or damage..."
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 p-6">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No items to receive</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <Link href={`/purchase-orders/${id}`}>
          <Button variant="secondary">Cancel</Button>
        </Link>
        <Button
          variant="primary"
          onClick={handleReceive}
          disabled={isSubmitting || groupedItems.length === 0 || !hasWarehouses || !hasAnyBins}
          className="gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Receive & Add to Inventory
        </Button>
      </div>
    </div>
  );
}
