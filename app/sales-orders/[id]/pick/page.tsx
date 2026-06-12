'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, Package, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import {
  getSalesOrderById,
  getSalesOrderItemsWithProducts,
  updateSalesOrderItem,
  getWarehouses,
  getBinLocationsByWarehouse,
  updateSalesOrder,
  createStockTransaction,
  shouldTrackBatchesForProduct,
  getBatchesForPicking,
  updateBatchUsedQuantity,
  getStockTransactionsByProduct,
} from '@/app/actions';
import type { SalesOrderItem } from '@/types';

type AllocationMethod = 'FIFO' | 'FEFO' | 'LIFO';


interface Warehouse {
  id: string;
  name: string;
}

interface BinLocation {
  id: string;
  warehouse_id: string;
  zone: string;
  aisle: string;
  shelf: string;
  bin_number: string;
  available_quantity?: number;
}

interface PickedItem {
  itemId: string;
  quantity: number;
  warehouseId: string;
  binLocationId?: string;
  track_batches?: boolean;
  batch_id?: string;
  batch_number?: string;
  expiration_date?: string;
  days_until_expiry?: number;
}

export default function PickItemsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [binLocations, setBinLocations] = useState<Record<string, BinLocation[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickedItems, setPickedItems] = useState<Record<string, PickedItem>>({});
  const [batches, setBatches] = useState<Record<string, any[]>>({});
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('FIFO');
  const [receivedDates, setReceivedDates] = useState<Record<string, string>>({});
  const [soNumber, setSoNumber] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [itemsResponse, warehousesResponse, soResponse] = await Promise.all([
        getSalesOrderItemsWithProducts(id),
        getWarehouses(),
        getSalesOrderById(id),
      ]);

      const so = Array.isArray(soResponse.data) ? soResponse.data[0] : soResponse.data;
      setSoNumber(so?.so_number || '');

      // Resolve allocation method: SO setting → product setting → FIFO
      let method: AllocationMethod = (so?.allocation_method as AllocationMethod) || null as any;
      if (!method) {
        const itemsData = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
        const productMethods = itemsData
          .map((item: any) => item.product?.allocation_method)
          .filter(Boolean) as string[];
        if (productMethods.includes('FEFO')) method = 'FEFO';
        else if (productMethods.includes('LIFO')) method = 'LIFO';
        else method = 'FIFO';
        // Persist resolved method onto the SO so it's consistent
        if (so?.id) {
          await updateSalesOrder(so.id, { allocation_method: method } as any);
        }
      }
      setAllocationMethod(method);

      if (itemsResponse.error) {
        toast.error('Failed to load SO items');
        router.back();
        return;
      }

      const itemsData = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
      setItems(itemsData);

      const warehousesData = Array.isArray(warehousesResponse.data) ? warehousesResponse.data : [];
      setWarehouses(warehousesData);

      // Load bin locations for each warehouse
      const binLocationsByWarehouse: Record<string, BinLocation[]> = {};
      for (const warehouse of warehousesData) {
        const binsResponse = await getBinLocationsByWarehouse(warehouse.id);
        if (!binsResponse.error && binsResponse.data) {
          binLocationsByWarehouse[warehouse.id] = Array.isArray(binsResponse.data) ? binsResponse.data : [];
        }
      }
      setBinLocations(binLocationsByWarehouse);

      // Initialize picked items with product's default warehouse and bin location
      const initialized: Record<string, PickedItem> = {};
      const batchesByProduct: Record<string, any[]> = {};

      // Check batch tracking for each product and load batches
      for (const item of itemsData) {
        const { shouldTrack } = await shouldTrackBatchesForProduct(item.product_id);
        
        const product = item.product;
        
        let productWarehouseId = product?.warehouse_id || warehousesData[0]?.id || '';
        let productBinId = product?.bin_location_id;
        
        // If product doesn't have a bin set, use first bin of the warehouse
        const defaultBinId = productBinId || binLocationsByWarehouse[productWarehouseId]?.[0]?.id;
        
        initialized[item.id] = {
          itemId: item.id,
          quantity: 0,
          warehouseId: productWarehouseId,
          binLocationId: defaultBinId,
          track_batches: shouldTrack,
        };

        // Load batches if product has batch tracking
        if (shouldTrack) {
          const batchesResult = await getBatchesForPicking(
            item.product_id,
            0,
            method
          );
          if (!batchesResult.error && batchesResult.data) {
            const productBatches = Array.isArray(batchesResult.data)
              ? batchesResult.data
              : [];
            batchesByProduct[item.product_id] = productBatches;
            // Auto-select first batch if available
            const firstBatch = productBatches[0];
            if (firstBatch) {
              const pickedItem = initialized[item.id];
              if (pickedItem) {
                pickedItem.batch_id = firstBatch.id;
                pickedItem.batch_number = firstBatch.batch_number;
                pickedItem.expiration_date = firstBatch.expiration_date;
                if (firstBatch.expiration_date) {
                  const expiryDate = new Date(firstBatch.expiration_date);
                  const today = new Date();
                  const daysUntilExpiry = Math.ceil(
                    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  pickedItem.days_until_expiry = daysUntilExpiry;
                }
              }
            }
          }
        }
      }
      // For non-batch products, get received date from inbound stock transactions
      const datesByProduct: Record<string, string> = {};
      for (const item of itemsData) {
        if (!item.product_id || initialized[item.id]?.track_batches) continue;
        const txResult = await getStockTransactionsByProduct(item.product_id);
        if (!txResult.error && Array.isArray(txResult.data)) {
          const inbound = txResult.data.filter((t: any) => t.transaction_type === 'inbound');
          if (inbound.length === 0) continue;
          const productMethod = (item.product as any)?.allocation_method || method;
          // LIFO = most recent inbound; FIFO = oldest inbound
          const sorted = [...inbound].sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const picked = productMethod === 'LIFO' ? sorted[sorted.length - 1] : sorted[0];
          if (picked) datesByProduct[item.product_id] = picked.created_at;
        }
      }
      setReceivedDates(datesByProduct);

      setPickedItems(initialized);
      setBatches(batchesByProduct);
    } catch (error) {
      toast.error('Error loading data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillAll = () => {
    setPickedItems((prev) => {
      const updated = { ...prev };
      for (const item of items) {
        const picked = prev[item.id];
        if (!picked) continue;
        const ordered = parseFloat(String(item.quantity_ordered));
        const alreadyPicked = parseFloat(String(item.quantity_picked)) || 0;
        const stillNeeded = Math.max(0, ordered - alreadyPicked);
        if (stillNeeded > 0) {
          updated[item.id] = { ...picked, quantity: stillNeeded };
        }
      }
      return updated;
    });
  };

  const handlePick = async () => {
    try {
      setIsSubmitting(true);

      // Validate at least one item has a quantity to pick
      const hasAnyQuantity = Object.values(pickedItems).some((item) => item.quantity > 0);
      if (!hasAnyQuantity) {
        toast.error('Please enter a quantity to pick for at least one item');
        return;
      }

      // Validate warehouse is selected
      const hasWarehouseError = Object.values(pickedItems).some(
        (item) => item.quantity > 0 && !item.warehouseId
      );
      if (hasWarehouseError) {
        toast.error('Please select a warehouse for all items');
        return;
      }

      // Validate bin location is selected
      const hasBinError = Object.values(pickedItems).some(
        (item) => item.quantity > 0 && !item.binLocationId
      );
      if (hasBinError) {
        toast.error('Please select a bin location for all items to pick');
        return;
      }

      // Update SO items with picked quantities and warehouse/bin info
      const updatePayloads = items.map((item) => {
        const picked = pickedItems[item.id];
        if (picked && picked.quantity > 0) {
          const payload = {
            quantity_picked: (parseFloat(String(item.quantity_picked)) || 0) + picked.quantity,
            warehouse_id: picked.warehouseId,
            bin_location_id: picked.binLocationId,
            picked_date: new Date().toISOString(),
          };
          console.log(`Updating SO item ${item.id}:`, payload);
          return updateSalesOrderItem(item.id, payload);
        }
        return Promise.resolve({ error: null });
      });

      const updateResults = await Promise.all(updatePayloads);

      // Check if any updates failed
      const failedUpdates = updateResults.filter((result) => result.error);
      if (failedUpdates.length > 0) {
        console.error('SO item updates failed:');
        failedUpdates.forEach((result, index) => {
          console.error(`  Error ${index + 1}:`, result.error);
        });

        const errorMessages = failedUpdates
          .map((result) => result.error?.message || 'Unknown error')
          .join(', ');

        toast.error(`Failed to save picked items: ${errorMessages}`);
        return;
      }

      const inventoryErrors: string[] = [];

      // Fetch SO for reference
      const soResponse = await getSalesOrderById(id);
      const so = Array.isArray(soResponse.data) ? soResponse.data[0] : soResponse.data;

      if (!so) {
        toast.error('Could not fetch SO information');
        return;
      }

      for (const item of items) {
        const picked = pickedItems[item.id];
        console.log(`Processing pick for item ${item.id}:`, {
          quantity: picked?.quantity,
          warehouseId: picked?.warehouseId,
          binLocationId: picked?.binLocationId,
        });

        if (picked && picked.quantity > 0) {
          try {
            // Create a 'reserved' transaction for audit trail
            // (Actual reservation was already set when the SO was confirmed)
            const transactionResult = await createStockTransaction({
              product_id: item.product_id!,
              transaction_type: 'reserved',
              quantity: picked.quantity,
              notes: `Picked for SO ${so.so_number}`,
              reference_id: so.id,
              reference_type: 'sales_order',
            });

            if (transactionResult.error) {
              throw new Error(`Stock transaction creation failed: ${transactionResult.error.message}`);
            }

            // Update batch usage if product has batch tracking
            if (picked.track_batches && picked.batch_id) {
              const batchData = batches[item.product_id!]?.find(b => b.id === picked.batch_id);
              if (batchData) {
                const newQuantityUsed = (batchData.quantity_used || 0) + picked.quantity;
                const batchUpdateResult = await updateBatchUsedQuantity(
                  picked.batch_id,
                  newQuantityUsed
                );
                if (batchUpdateResult.error) {
                  throw new Error(`Batch update failed: ${batchUpdateResult.error}`);
                }
              }
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            inventoryErrors.push(`${item.description}: ${errorMsg}`);
            console.error(`Pick transaction error for item ${item.id}:`, error);
          }
        }
      }

      if (inventoryErrors.length > 0) {
        console.warn('Inventory reservation errors:', inventoryErrors);
        toast.warning(`Items picked with warnings:\n${inventoryErrors.join('\n')}`);
      }

      // Update SO status to 'picked' after successful pick confirmation
      console.log('Fetching SO to update status...');
      const orderResponse = await getSalesOrderById(id);
      const order = Array.isArray(orderResponse.data) ? orderResponse.data[0] : orderResponse.data;

      console.log('Current SO status:', order?.status);
      if (order && (order.status === 'confirmed' || order.status === 'draft')) {
        console.log(`Updating SO status from '${order.status}' to 'picked'...`);
        const statusUpdate = await updateSalesOrder(id, { status: 'picked' });
        if (!statusUpdate.error) {
          console.log('✓ SO status updated to picked');
        } else {
          console.error('Failed to update SO status:', statusUpdate.error);
        }
      } else {
        console.log('SO status not updated - current status is:', order?.status);
      }

      toast.success('Items picked and stock reserved');
      router.push(`/sales-orders/${id}`);
    } catch (error) {
      toast.error('Error picking items');
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
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/sales-orders/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to SO
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pick Items — {soNumber}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Select items to pick from warehouse bins</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/sales-orders/${id}`}>
            <Button variant="secondary" size="sm">Cancel</Button>
          </Link>
          <Button
            onClick={handleFillAll}
            disabled={isSubmitting || items.length === 0}
            variant="secondary"
            size="sm"
            className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-900/20"
          >
            <Zap className="h-3.5 w-3.5" />
            Fill All
          </Button>
          <Button
            onClick={handlePick}
            disabled={isSubmitting || items.length === 0}
            size="sm"
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                Confirm Picking
              </>
            )}
          </Button>
        </div>
      </div>


      {/* Items Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Product</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 w-20">Ordered</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 w-20">Need</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 w-28">Qty to Pick</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-36">Warehouse</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-44">Bin Location</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-40">Batch</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-20">Method</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-28">Date Received</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 w-28">Expiry Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.length > 0 ? (
                items.map((item) => {
                  const picked = pickedItems[item.id];
                  if (!picked) return null;

                  const ordered = parseFloat(String(item.quantity_ordered));
                  const alreadyPicked = parseFloat(String(item.quantity_picked)) || 0;
                  const stillNeeded = Math.max(0, ordered - alreadyPicked);
                  const batchList = picked.track_batches ? batches[item.product_id!] : null;
                  const selectedBatch = picked.batch_id && batchList
                    ? batchList.find((b: any) => b.id === picked.batch_id)
                    : null;
                  const productMethod = (item.product as any)?.allocation_method || allocationMethod;
                  const methodColors: Record<string, string> = {
                    FIFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                    FEFO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    LIFO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                  };
                  const expiryDate = selectedBatch?.expiration_date ? new Date(selectedBatch.expiration_date) : null;
                  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / 86400000) : null;
                  const isExpiringSoonInline = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                  const isExpiredInline = daysLeft !== null && daysLeft < 0;

                  return (
                    <>
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        {/* Product */}
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900 dark:text-white leading-tight">
                            {item.product?.name || item.description}
                          </p>
                          {item.product?.sku && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">SKU: {item.product.sku}</p>
                          )}
                        </td>
                        {/* Ordered */}
                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400 font-medium">
                          {ordered.toFixed(2)}
                        </td>
                        {/* Still need */}
                        <td className="px-3 py-2 text-center">
                          <span className={stillNeeded > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-green-600'}>
                            {stillNeeded.toFixed(2)}
                          </span>
                        </td>
                        {/* Qty to Pick */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={picked.quantity}
                            onChange={(e) => {
                              const qty = Math.max(0, parseFloat(e.target.value) || 0);
                              setPickedItems((prev) => ({ ...prev, [item.id]: { ...picked, quantity: qty } }));
                            }}
                            step="0.01"
                            min="0"
                            max={stillNeeded}
                            disabled={isSubmitting}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                            placeholder="0"
                          />
                        </td>
                        {/* Warehouse */}
                        <td className="px-3 py-2">
                          <select
                            value={picked.warehouseId}
                            onChange={(e) => {
                              const warehouseId = e.target.value;
                              const firstBinId = binLocations[warehouseId]?.[0]?.id || '';
                              setPickedItems((prev) => ({ ...prev, [item.id]: { ...picked, warehouseId, binLocationId: firstBinId } }));
                            }}
                            disabled={isSubmitting}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>{fmtWarehouse(w)}</option>
                            ))}
                          </select>
                        </td>
                        {/* Bin Location */}
                        <td className="px-3 py-2">
                          <select
                            value={picked.binLocationId || ''}
                            onChange={(e) => setPickedItems((prev) => ({ ...prev, [item.id]: { ...picked, binLocationId: e.target.value } }))}
                            disabled={isSubmitting}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Select bin</option>
                            {(binLocations[picked.warehouseId] || []).map((bin) => (
                              <option key={bin.id} value={bin.id}>
                                {bin.zone}-{bin.aisle}-{bin.shelf}-{bin.bin_number}
                                {bin.available_quantity !== undefined && ` (${bin.available_quantity})`}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Batch */}
                        <td className="px-3 py-2">
                          {picked.track_batches && Array.isArray(batchList) && batchList.length > 0 ? (
                            <select
                              value={picked.batch_id || ''}
                              onChange={(e) => {
                                const batchId = e.target.value;
                                const batch = batchList.find((b) => b.id === batchId);
                                if (batch) {
                                  const expiryDate = batch.expiration_date ? new Date(batch.expiration_date) : null;
                                  const daysUntilExpiry = expiryDate
                                    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                    : undefined;
                                  setPickedItems((prev) => ({
                                    ...prev,
                                    [item.id]: { ...picked, batch_id: batchId, batch_number: batch.batch_number, expiration_date: batch.expiration_date, days_until_expiry: daysUntilExpiry },
                                  }));
                                }
                              }}
                              disabled={isSubmitting}
                              className="w-full px-2 py-1 text-xs border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="">Select batch</option>
                              {batchList.map((batch) => {
                                const exp = batch.expiration_date ? new Date(batch.expiration_date) : null;
                                const days = exp ? Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                                return (
                                  <option key={batch.id} value={batch.id}>
                                    {batch.batch_number} ({batch.quantity_available})
                                    {days !== null && ` exp:${days}d`}
                                    {days !== null && days < 0 && ' [EXP]'}
                                  </option>
                                );
                              })}
                            </select>
                          ) : picked.track_batches ? (
                            <span className="text-xs text-gray-400">No batches</span>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        {/* Method */}
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${methodColors[productMethod] ?? methodColors.FIFO}`}>
                            {productMethod}
                          </span>
                        </td>
                        {/* Date Received */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {selectedBatch ? (
                            <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                              {new Date(selectedBatch.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          ) : item.product_id && receivedDates[item.product_id] ? (
                            <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                              {new Date(receivedDates[item.product_id] as string).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        {/* Expiry Date */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {expiryDate ? (
                            <span className={`text-xs font-medium ${
                              isExpiredInline ? 'text-red-600 dark:text-red-400' :
                              isExpiringSoonInline ? 'text-amber-600 dark:text-amber-400' :
                              'text-gray-600 dark:text-gray-400'
                            }`}>
                              {expiryDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {daysLeft !== null && !isExpiredInline && (
                                <span className="ml-1 text-gray-400">({daysLeft}d)</span>
                              )}
                              {isExpiredInline && <span className="ml-1">[EXP]</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    </>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-gray-400">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No items to pick in this order
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
