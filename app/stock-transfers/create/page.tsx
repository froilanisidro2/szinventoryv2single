'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createStockTransfer, createStockTransferItems, getWarehouses, getProducts, getBinLocationsByWarehouse, getBinStock, getStockLevelsForProducts } from '@/app/actions';
import { fmtWarehouseWithCity } from '@/lib/warehouse-utils';

interface LineItem {
  uid: string;
  productId: string;
  fromBinId: string;
  toBinId: string;
  quantityRequested: number;
  notes: string;
}

export default function CreateTransferPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [fromBins, setFromBins] = useState<any[]>([]);
  const [toBins, setToBins] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  // bin_stock map: binId → { productId → qty }
  const [binStockMap, setBinStockMap] = useState<Record<string, Record<string, number>>>({});
  // warehouse-level stock: productId → { on_hand, available }
  const [warehouseStock, setWarehouseStock] = useState<Record<string, { on_hand: number; available: number }>>({});

  const today = new Date().toISOString().split('T')[0] || '';
  const [formData, setFormData] = useState({
    transferNumber: `ST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`,
    fromWarehouseId: '',
    toWarehouseId: '',
    transferDate: today,
    notes: '',
  });

  useEffect(() => {
    const load = async () => {
      const [whRes, prodRes] = await Promise.all([getWarehouses(), getProducts()]);
      if (!whRes.error && whRes.data) setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
      if (!prodRes.error && prodRes.data) setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    };
    load();
  }, []);

  useEffect(() => {
    if (!formData.fromWarehouseId) { setFromBins([]); setWarehouseStock({}); return; }
    getBinLocationsByWarehouse(formData.fromWarehouseId).then(async (res) => {
      const bins = Array.isArray(res.data) ? res.data : [];
      setFromBins(bins);
      const stockMap: Record<string, Record<string, number>> = {};
      await Promise.all(bins.map(async (bin: any) => {
        const stockRes = await getBinStock(bin.id);
        const stockItems = Array.isArray(stockRes.data) ? stockRes.data : [];
        stockMap[bin.id] = {};
        stockItems.forEach((s: any) => { stockMap[bin.id]![s.product_id] = s.quantity; });
      }));
      setBinStockMap(stockMap);
    });
    // Load warehouse-level availability for all products in source warehouse
    if (products.length > 0) {
      const ids = products.map((p: any) => p.id);
      getStockLevelsForProducts(ids, formData.fromWarehouseId).then((res) => {
        const levels: Record<string, { on_hand: number; available: number }> = {};
        const rows = Array.isArray(res.data) ? res.data : (res as any);
        (Array.isArray(rows) ? rows : []).forEach((r: any) => {
          levels[r.product_id] = { on_hand: r.quantity_on_hand ?? 0, available: r.quantity_available ?? 0 };
        });
        setWarehouseStock(levels);
      });
    }
  }, [formData.fromWarehouseId, products]);

  useEffect(() => {
    if (!formData.toWarehouseId) { setToBins([]); return; }
    getBinLocationsByWarehouse(formData.toWarehouseId).then((res) => {
      setToBins(Array.isArray(res.data) ? res.data : []);
    });
  }, [formData.toWarehouseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addItem = () => {
    setLineItems((prev) => [...prev, {
      uid: Date.now().toString(),
      productId: '',
      fromBinId: '',
      toBinId: '',
      quantityRequested: 1,
      notes: '',
    }]);
  };

  const removeItem = (uid: string) => setLineItems((prev) => prev.filter((i) => i.uid !== uid));

  const updateItem = (uid: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) => prev.map((i) => i.uid === uid ? { ...i, [field]: value } : i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fromWarehouseId || !formData.toWarehouseId) {
      toast.error('Please select both source and destination warehouses');
      return;
    }
    if (formData.fromWarehouseId === formData.toWarehouseId) {
      toast.error('Source and destination warehouses cannot be the same');
      return;
    }
    if (lineItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    const invalidItems = lineItems.filter((i) => !i.productId || i.quantityRequested < 1);
    if (invalidItems.length > 0) {
      toast.error('All items need a product and quantity ≥ 1');
      return;
    }

    // Stock availability validation
    const overAllocated = lineItems.filter((item) => {
      if (!item.productId) return false;
      const available = warehouseStock[item.productId]?.available ?? null;
      return available !== null && item.quantityRequested > available;
    });
    if (overAllocated.length > 0) {
      const names = overAllocated.map((i) => {
        const p = products.find((p: any) => p.id === i.productId);
        const avail = warehouseStock[i.productId]?.available ?? 0;
        return `${p?.name ?? i.productId} (need ${i.quantityRequested}, have ${avail})`;
      });
      toast.error(`Insufficient stock:\n${names.join('\n')}`);
      return;
    }

    try {
      setIsLoading(true);

      const transferRes = await createStockTransfer({
        transfer_number: formData.transferNumber,
        from_warehouse_id: formData.fromWarehouseId,
        to_warehouse_id: formData.toWarehouseId,
        transfer_date: formData.transferDate,
        status: 'draft',
        notes: formData.notes,
      });

      if (transferRes.error) {
        toast.error(transferRes.error.message || 'Failed to create transfer');
        return;
      }

      const transferId = Array.isArray(transferRes.data) ? transferRes.data[0]?.id : transferRes.data?.id;
      if (!transferId) {
        toast.error('Transfer created but could not retrieve ID');
        return;
      }

      const itemPayloads = lineItems.map((item) => ({
        stock_transfer_id: transferId,
        product_id: item.productId,
        ...(item.fromBinId ? { from_bin_id: item.fromBinId } : {}),
        ...(item.toBinId   ? { to_bin_id:   item.toBinId   } : {}),
        quantity_requested: item.quantityRequested,
        quantity_received: 0,
        notes: item.notes || null,
      }));

      const itemsRes = await createStockTransferItems(itemPayloads);
      if (itemsRes.error) {
        toast.error('Transfer created but failed to save items: ' + itemsRes.error.message);
        router.push('/stock-transfers');
        return;
      }

      toast.success('Stock transfer created successfully');
      router.push('/stock-transfers');
    } catch {
      toast.error('Failed to create stock transfer');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBinLabel = (bin: any) => {
    const parts = [bin.zone, bin.aisle, bin.shelf, bin.bin_number].filter(Boolean);
    const structured = parts.join('-');
    if (bin.location_name) return structured ? `${bin.location_name} (${structured})` : bin.location_name;
    return structured || bin.id?.slice(0, 8) || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/stock-transfers" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Stock Transfers
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Stock Transfer</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Transfer inventory between warehouses and bin locations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transfer Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Transfer Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transfer #</label>
                <input
                  type="text"
                  value={formData.transferNumber}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transfer Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="transferDate"
                  value={formData.transferDate}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Warehouse <span className="text-red-500">*</span></label>
                <select
                  name="fromWarehouseId"
                  value={formData.fromWarehouseId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select source warehouse</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>{fmtWarehouseWithCity(wh)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Warehouse <span className="text-red-500">*</span></label>
                <select
                  name="toWarehouseId"
                  value={formData.toWarehouseId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select destination warehouse</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>{fmtWarehouseWithCity(wh)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white shrink-0">Products to Transfer</h2>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Filter products..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={addItem}>
                Add Product
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Click "Add Product" to add items to this transfer
              </p>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item) => (
                  <div key={item.uid} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {/* Product */}
                    <div className="col-span-12 md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Product</label>
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(item.uid, 'productId', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">Select product...</option>
                        {products
                          .filter((p: any) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(productSearch.toLowerCase()))
                          .map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                      {/* Warehouse stock hint */}
                      {item.productId && formData.fromWarehouseId && (() => {
                        const s = warehouseStock[item.productId];
                        if (!s) return null;
                        const isOver = item.quantityRequested > s.available;
                        return (
                          <p className={`text-xs mt-0.5 ${isOver ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            {isOver
                              ? `⚠ Only ${s.available} available`
                              : `Available: ${s.available}`}
                          </p>
                        );
                      })()}
                    </div>

                    {/* From Bin */}
                    <div className="col-span-12 md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        From Bin
                        <span className="ml-1 font-normal text-gray-400">(optional)</span>
                      </label>
                      {!formData.fromWarehouseId ? (
                        <p className="text-xs text-gray-400 italic py-1.5">Select source warehouse first</p>
                      ) : fromBins.length === 0 ? (
                        <p className="text-xs text-amber-500 italic py-1.5">No bins in this warehouse</p>
                      ) : (
                        <select
                          value={item.fromBinId}
                          onChange={(e) => updateItem(item.uid, 'fromBinId', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="">Any bin</option>
                          {fromBins.map((b: any) => {
                            const binEntry = binStockMap[b.id];
                            const avail = item.productId && binEntry
                              ? (binEntry[item.productId] ?? 0)
                              : null;
                            return (
                              <option key={b.id} value={b.id}>
                                {formatBinLabel(b)}{avail !== null ? ` (${avail} avail)` : ''}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    {/* To Bin */}
                    <div className="col-span-12 md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        To Bin
                        <span className="ml-1 font-normal text-gray-400">(optional)</span>
                      </label>
                      {!formData.toWarehouseId ? (
                        <p className="text-xs text-gray-400 italic py-1.5">Select destination warehouse first</p>
                      ) : toBins.length === 0 ? (
                        <p className="text-xs text-amber-500 italic py-1.5">No bins — stock will update warehouse total</p>
                      ) : (
                        <select
                          value={item.toBinId}
                          onChange={(e) => updateItem(item.uid, 'toBinId', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="">Any bin</option>
                          {toBins.map((b: any) => (
                            <option key={b.id} value={b.id}>{formatBinLabel(b)}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="col-span-8 md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Qty</label>
                      <input
                        type="number"
                        value={item.quantityRequested}
                        onChange={(e) => updateItem(item.uid, 'quantityRequested', Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right"
                      />
                    </div>

                    {/* Remove */}
                    <div className="col-span-4 md:col-span-1 flex items-end justify-end pb-0.5">
                      <button
                        type="button"
                        onClick={() => removeItem(item.uid)}
                        className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            
              <Button href="/stock-transfers" variant="secondary">Cancel</Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Transfer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
