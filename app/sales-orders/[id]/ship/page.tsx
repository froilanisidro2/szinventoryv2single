'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, Truck, Package } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getSalesOrderById,
  getSalesOrderItems,
  updateSalesOrderItem,
  getWarehouses,
  getBinLocationsByWarehouse,
  updateSalesOrder,
  updateStockLevelAtomic,
  createStockTransaction,
  updateBinStock,
  getCustomers,
} from '@/app/actions';
import type { SalesOrderItem, SalesOrder } from '@/types';

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

interface ShippedItem {
  itemId: string;
  quantityShipped: number;
  quantityDamagedShipping: number;
  warehouseId: string;
  binLocationId?: string;
  damageReason?: string;
  shipmentNotes?: string;
}

interface ShipmentDetails {
  driverName: string;
  driverContact: string;
  deliveryLocation: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export default function ShipGoodsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [binLocations, setBinLocations] = useState<Record<string, BinLocation[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippedItems, setShippedItems] = useState<Record<string, ShippedItem>>({});
  const [actualDeliveryDate, setActualDeliveryDate] = useState(new Date().toISOString().slice(0, 16));
  const [shipmentDetails, setShipmentDetails] = useState<ShipmentDetails>({
    driverName: '',
    driverContact: '',
    deliveryLocation: '',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [soResponse, itemsResponse, warehousesResponse, customersResponse] = await Promise.all([
        getSalesOrderById(id),
        getSalesOrderItems(id),
        getWarehouses(),
        getCustomers(),
      ]);

      // Get SO data
      if (soResponse.error) {
        toast.error('Failed to load sales order');
        router.back();
        return;
      }

      const soData = Array.isArray(soResponse.data) ? soResponse.data[0] : soResponse.data;
      setSalesOrder(soData);

      // Get customer data
      if (customersResponse.data && Array.isArray(customersResponse.data)) {
        const customerData = customersResponse.data.find(
          (c: any) => c.id === soData?.customer_id
        );
        if (customerData) {
          setCustomer(customerData);
        }
      }

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

      // Initialize shipped items using warehouse & bin location from picking phase
      const initialized: Record<string, ShippedItem> = {};
      itemsData.forEach((item: any) => {
        initialized[item.id] = {
          itemId: item.id,
          quantityShipped: 0,
          quantityDamagedShipping: 0,
          warehouseId: item.warehouse_id || warehousesData[0]?.id || '',
          binLocationId: item.bin_location_id,
        };
      });
      setShippedItems(initialized);
    } catch (error) {
      toast.error('Error loading data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShip = async () => {
    try {
      setIsSubmitting(true);

      // Validate at least one item has a delivery quantity
      const hasAnyShipped = Object.values(shippedItems).some(
        (item) => item.quantityShipped > 0 || item.quantityDamagedShipping > 0
      );
      if (!hasAnyShipped) {
        toast.error('Please enter a quantity for at least one item');
        return;
      }

      // Validate damage reason is provided if items are damaged during shipment
      const hasDamageWithoutReason = Object.values(shippedItems).some(
        (item) => item.quantityDamagedShipping > 0 && !item.damageReason
      );
      if (hasDamageWithoutReason) {
        toast.error('Please provide a damage reason for items damaged during shipment');
        return;
      }

      // Update SO items with shipped quantities and warehouse/bin info
      const updatePayloads = items.map((item) => {
        const shipped = shippedItems[item.id];
        if (shipped && (shipped.quantityShipped > 0 || shipped.quantityDamagedShipping > 0)) {
          const payload = {
            quantity_shipped: (parseFloat(String(item.quantity_shipped)) || 0) + shipped.quantityShipped,
            quantity_damaged: (parseFloat(String(item.quantity_damaged)) || 0) + shipped.quantityDamagedShipping,
            warehouse_id: shipped.warehouseId,
            bin_location_id: shipped.binLocationId,
            damage_reason: shipped.damageReason || null,
            shipment_notes: shipped.shipmentNotes || null,
            actual_delivery_date: actualDeliveryDate || new Date().toISOString(),
            driver_name: shipmentDetails.driverName || null,
            driver_contact: shipmentDetails.driverContact || null,
            delivery_location: shipmentDetails.deliveryLocation || null,
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

        toast.error(`Failed to save shipped items: ${errorMessages}`);
        return;
      }

      const inventoryUpdateErrors: string[] = [];

      // Fetch SO once for all items
      const soResponse = await getSalesOrderById(id);
      const so = Array.isArray(soResponse.data) ? soResponse.data[0] : soResponse.data;

      if (!so) {
        toast.error('Could not fetch SO information');
        return;
      }

      for (const item of items) {
        const shipped = shippedItems[item.id];

        // Total quantity leaving the warehouse = successfully shipped + damaged in transit
        const totalOutbound = (shipped?.quantityShipped || 0) + (shipped?.quantityDamagedShipping || 0);

        if (shipped && totalOutbound > 0) {
          try {
            // Atomically deduct on_hand AND release reservation in one write
            // Pass the warehouse so we deduct from the correct warehouse stock level
            const stockLevelResult = await updateStockLevelAtomic(
              item.product_id!,
              -totalOutbound,         // on_hand delta
              -totalOutbound,         // reserved delta
              shipped.warehouseId     // which warehouse stock to deduct from
            );

            if (stockLevelResult.error) {
              throw new Error(`Stock level update failed: ${stockLevelResult.error.message}`);
            }

            // Create outbound stock transaction for audit trail
            const transactionResult = await createStockTransaction({
              product_id: item.product_id!,
              transaction_type: 'outbound',
              quantity: totalOutbound,
              notes: `Shipped via SO ${so.so_number}${shipped.shipmentNotes ? ` — ${shipped.shipmentNotes}` : ''}`,
              reference_id: so.id,
              reference_type: 'sales_order',
              warehouse_id: shipped.warehouseId || undefined,
            });

            if (transactionResult.error) {
              console.error('Stock transaction error:', transactionResult.error);
              throw new Error(`Stock transaction creation failed: ${JSON.stringify(transactionResult.error)}`);
            }

            // Deduct from bin stock
            if (shipped.binLocationId) {
              const binStockResult = await updateBinStock(
                shipped.binLocationId,
                item.product_id!,
                -totalOutbound
              );

              if (binStockResult.error) {
                throw new Error(`Bin stock update failed: ${binStockResult.error.message}`);
              }
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            inventoryUpdateErrors.push(`${item.description}: ${errorMsg}`);
            console.error(`Inventory update error for item ${item.id}:`, error);
          }
        }
      }

      if (inventoryUpdateErrors.length > 0) {
        console.warn('Inventory update errors:', inventoryUpdateErrors);
        toast.warning(`Items shipped with warnings:\n${inventoryUpdateErrors.join('\n')}`);
      }

      // Check if all items are now fully shipped and update SO status if needed
      const itemsAfterShip = await getSalesOrderItems(id);
      const itemsData = Array.isArray(itemsAfterShip.data) ? itemsAfterShip.data : [];

      console.log('Items after ship:', itemsData.length, itemsData);

      const allShipped = itemsData.every(
        (item: any) => parseFloat(String(item.quantity_shipped)) >= parseFloat(String(item.quantity_ordered))
      );

      console.log('All items shipped?', allShipped);

      if (allShipped) {
        const orderResponse = await getSalesOrderById(id);
        const order = Array.isArray(orderResponse.data) ? orderResponse.data[0] : orderResponse.data;

        if (order?.status !== 'delivered' && order?.status !== 'shipped') {
          await updateSalesOrder(id, { status: 'shipped' });
          toast.success('All items shipped! Awaiting customer delivery confirmation.');
        }
      } else {
        const orderResponse = await getSalesOrderById(id);
        const order = Array.isArray(orderResponse.data) ? orderResponse.data[0] : orderResponse.data;

        if (order && (order.status === 'picked' || order.status === 'partially_shipped')) {
          await updateSalesOrder(id, { status: 'partially_shipped' });
        }
      }

      toast.success('Goods shipped and inventory deducted');
      router.push(`/sales-orders/${id}`);
    } catch (error) {
      toast.error('Error shipping goods');
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
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/sales-orders/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to SO
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ship Goods</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Record shipped items and deduct from inventory</p>
        </div>
      </div>

      {/* Sales Order Details & Dispatch Info */}
      {salesOrder && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sales Order Details */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <Package className="h-4 w-4" />
              Sales Order Details
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">SO Number</p>
                <p className="font-semibold text-gray-900 dark:text-white">{salesOrder.so_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                  salesOrder.status === 'picked' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                  salesOrder.status === 'partially_shipped' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {salesOrder.status.replace('_', ' ')}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Order Date</p>
                <p className="font-semibold text-gray-900 dark:text-white">{new Date(salesOrder.order_date).toLocaleDateString()}</p>
              </div>
              {customer && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{customer.name}</p>
                  {customer.email && <p className="text-xs text-gray-500">{customer.email}</p>}
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Amount</p>
                <p className="font-semibold text-primary-600">₱{parseFloat(String(salesOrder.total_amount)).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Payment Terms</p>
                <p className="font-semibold text-gray-900 dark:text-white">{salesOrder.payment_terms || 'N/A'}</p>
              </div>
              {(salesOrder as any).expected_delivery_date && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expected Delivery</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {new Date((salesOrder as any).expected_delivery_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dispatch Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <Truck className="h-4 w-4" />
              Dispatch Info
            </h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Ready</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{items.length}</p>
              </div>
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Units</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {items.reduce((sum, item) => sum + parseFloat(String(item.quantity_ordered)), 0).toFixed(0)}
                </p>
              </div>
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Shipped</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {items.reduce((sum, item) => sum + parseFloat(String(item.quantity_shipped || 0)), 0).toFixed(0)}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Remaining: <span className="font-semibold text-gray-900 dark:text-white">
                {items.reduce((sum, item) => {
                  const ordered = parseFloat(String(item.quantity_ordered));
                  const shipped = parseFloat(String(item.quantity_shipped || 0));
                  return sum + Math.max(0, ordered - shipped);
                }, 0).toFixed(0)} units
              </span>
            </p>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Actual Delivery Date</p>
                <input
                  type="datetime-local"
                  value={actualDeliveryDate}
                  onChange={(e) => setActualDeliveryDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Delivery Details</p>
              <input
                type="text"
                value={shipmentDetails.driverName}
                onChange={(e) => setShipmentDetails(prev => ({ ...prev, driverName: e.target.value }))}
                disabled={isSubmitting}
                placeholder="Driver Name"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="tel"
                value={shipmentDetails.driverContact}
                onChange={(e) => setShipmentDetails(prev => ({ ...prev, driverContact: e.target.value }))}
                disabled={isSubmitting}
                placeholder="Driver Contact"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={shipmentDetails.deliveryLocation}
                onChange={(e) => setShipmentDetails(prev => ({ ...prev, deliveryLocation: e.target.value }))}
                disabled={isSubmitting}
                placeholder="Delivery Location"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Items to Ship */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Truck className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Items to Ship</h2>
        </div>

        {items.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Product</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-600 dark:text-gray-300 w-16">Ordered</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-600 dark:text-gray-300 w-16">Need</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 dark:text-green-400 w-24">Delivery Qty ✓</th>
                <th className="px-2 py-2 text-center font-semibold text-red-600 dark:text-red-400 w-20">Damaged ✗</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Warehouse</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Bin</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 w-48">Notes / Damage Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item) => {
                const shipped = shippedItems[item.id];
                if (!shipped) return null;

                const ordered = parseFloat(String(item.quantity_ordered));
                const alreadyShipped = parseFloat(String(item.quantity_shipped)) || 0;
                const stillNeeded = Math.max(0, ordered - alreadyShipped);
                const bin = binLocations[shipped.warehouseId]?.find(b => b.id === shipped.binLocationId);
                const warehouseName = warehouses.find(w => w.id === shipped.warehouseId)?.name || '—';
                const binLabel = bin ? `${bin.zone}-${bin.aisle}-${bin.shelf}-${bin.bin_number}` : '—';

                return (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    {/* Product */}
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900 dark:text-white leading-tight">
                        {item.product?.sku ? <span className="text-gray-500">{item.product.sku} · </span> : ''}
                        {item.product?.name || item.description}
                      </p>
                    </td>
                    {/* Ordered */}
                    <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300 font-medium">{ordered.toFixed(0)}</td>
                    {/* Still need */}
                    <td className="px-2 py-2 text-center">
                      <span className={stillNeeded > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600'}>
                        {stillNeeded.toFixed(0)}
                      </span>
                    </td>
                    {/* Qty Delivered */}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={shipped.quantityShipped}
                        onChange={(e) => setShippedItems(prev => ({ ...prev, [item.id]: { ...shipped, quantityShipped: Math.max(0, parseFloat(e.target.value) || 0) } }))}
                        step="1" min="0" max={stillNeeded}
                        disabled={isSubmitting}
                        className="w-full px-1.5 py-1 text-xs border border-green-400 dark:border-green-700 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                      />
                    </td>
                    {/* Qty damaged */}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={shipped.quantityDamagedShipping}
                        onChange={(e) => setShippedItems(prev => ({ ...prev, [item.id]: { ...shipped, quantityDamagedShipping: Math.max(0, parseFloat(e.target.value) || 0) } }))}
                        step="1" min="0"
                        disabled={isSubmitting}
                        className="w-full px-1.5 py-1 text-xs border border-red-400 dark:border-red-700 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                      />
                    </td>
                    {/* Warehouse */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className="inline-block bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-xs font-medium">{warehouseName}</span>
                    </td>
                    {/* Bin */}
                    <td className="px-2 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">{binLabel}</td>
                    {/* Notes + damage reason */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={shipped.shipmentNotes || ''}
                        onChange={(e) => setShippedItems(prev => ({ ...prev, [item.id]: { ...shipped, shipmentNotes: e.target.value } }))}
                        disabled={isSubmitting}
                        placeholder="Shipment notes..."
                        className="w-full px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-1"
                      />
                      {shipped.quantityDamagedShipping > 0 && (
                        <input
                          type="text"
                          value={shipped.damageReason || ''}
                          onChange={(e) => setShippedItems(prev => ({ ...prev, [item.id]: { ...shipped, damageReason: e.target.value } }))}
                          disabled={isSubmitting}
                          placeholder="Damage reason (required)..."
                          className="w-full px-1.5 py-1 text-xs border border-red-400 dark:border-red-700 rounded bg-white dark:bg-gray-700 text-red-700 dark:text-red-300"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-10">
            <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">No items to ship in this order</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <Link href={`/sales-orders/${id}`}>
          <Button variant="secondary">Cancel</Button>
        </Link>
        <Button
          onClick={handleShip}
          disabled={isSubmitting || items.length === 0}
          className="gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Ship Items
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
