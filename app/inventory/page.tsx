'use client';

import { useState, useEffect } from 'react';
import { Search, Zap, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DataTable, Column } from '@/components/ui/data-table';
import { RejectionDispositionModal } from '@/components/forms/rejection-disposition-modal';
import { toast } from 'sonner';
import type { Inventory } from '@/types';
import { getStockLevels, getProducts, processRejectionDisposition, getIssuedTotals, getProductMRFRequests, getProductMISItems, getProductPOReceipts, getOldestUnconsumedStockDate, getSuppliers } from '@/app/actions';
import { useWarehouse } from '@/contexts/warehouse-context';
import { fmtWarehouse, fmtSupplier } from '@/lib/warehouse-utils';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<(Inventory & { productName: string; cost_price: number; selling_price: number; quantity_rejected: number; quantity_issued: number })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false);
  const [selectedProductForDisposition, setSelectedProductForDisposition] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [poReceipts, setPoReceipts] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [_mrfItems, setMrfItems] = useState<any[]>([]);
  const [misItems, setMisItems] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [oldestStock, setOldestStock] = useState<{ data: string | null; isBatch: boolean; batchNumber?: string; allocationMethod?: string } | null>(null);
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 5;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  const { warehouses, selectedWarehouseId } = useWarehouse();

  useEffect(() => {
    loadInventory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  const loadInventory = async () => {
    try {
      setIsLoading(true);
      const wh = selectedWarehouseId || undefined;
      const [stockResponse, productsResponse, issuedRes, suppliersRes] = await Promise.all([
        getStockLevels(100, 0, wh),
        getProducts(100, 0, wh),
        getIssuedTotals(),
        getSuppliers(500),
      ]);
      if (!suppliersRes.error && Array.isArray(suppliersRes.data)) setSuppliers(suppliersRes.data);

      const issuedByProduct = issuedRes.data;

      // Build a map of all products for quick lookup
      const productMap: Record<string, any> = {};
      const allProducts: any[] = Array.isArray(productsResponse.data) ? productsResponse.data : [];
      allProducts.forEach((product: any) => {
        productMap[product.id] = product;
      });

      // Build inventory from stock_levels rows
      const stockLevels: any[] = Array.isArray(stockResponse.data) ? stockResponse.data : [];
      const stockedProductIds = new Set(stockLevels.map((s: any) => s.product_id));

      const inventoryFromStock = stockLevels.map((stock: any) => {
        const product = productMap[stock.product_id] || {};
        return {
          id: stock.id,
          company_id: stock.company_id,
          product_id: stock.product_id,
          warehouse_id: stock.warehouse_id,
          quantity_on_hand: stock.quantity_on_hand || 0,
          quantity_allocated: stock.quantity_allocated || 0,
          quantity_available: stock.quantity_available || 0,
          quantity_rejected: stock.quantity_rejected || 0,
          quantity_issued: issuedByProduct?.[stock.product_id] || 0,
          reorder_level: product.reorder_level || 50,
          reorder_quantity: product.reorder_quantity || 100,
          cost_price: product.cost_price || 0,
          selling_price: product.selling_price || 0,
          last_stock_date: stock.updated_at ? new Date(stock.updated_at) : new Date(),
          productName: product.name || 'Unknown Product',
          supplier_id: product.supplier_id || null,
          createdAt: new Date(stock.created_at),
          updatedAt: new Date(stock.updated_at),
        };
      });

      // Add products that have NO stock_levels row yet (show with 0 qty)
      const inventoryFromProducts = allProducts
        .filter((product: any) => !stockedProductIds.has(product.id))
        .map((product: any) => ({
          id: `virtual-${product.id}`,
          company_id: product.company_id,
          product_id: product.id,
          warehouse_id: product.warehouse_id || wh || '',
          quantity_on_hand: 0,
          quantity_allocated: 0,
          quantity_available: 0,
          quantity_rejected: 0,
          quantity_issued: issuedByProduct?.[product.id] || 0,
          reorder_level: product.reorder_level || 50,
          reorder_quantity: product.reorder_quantity || 100,
          cost_price: product.cost_price || 0,
          selling_price: product.selling_price || 0,
          last_stock_date: new Date(product.updated_at || product.created_at),
          productName: product.name || 'Unknown Product',
          supplier_id: product.supplier_id || null,
          createdAt: new Date(product.created_at),
          updatedAt: new Date(product.updated_at || product.created_at),
        }));

      setInventory([...inventoryFromStock, ...inventoryFromProducts]);
    } catch (error) {
      toast.error('Failed to load inventory');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDispositionModal = (item: any) => {
    if (item.quantity_rejected === 0) {
      toast.error('This product has no rejected items to process');
      return;
    }
    setSelectedProductForDisposition(item);
    setIsDispositionModalOpen(true);
  };

  const handleProcessDisposition = async (
    productId: string,
    dispositionType: string,
    quantity: number,
    notes: string
  ) => {
    try {
      const response = await processRejectionDisposition(productId, dispositionType, quantity, notes);
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to process disposition');
      }

      // Reload inventory to reflect changes
      await loadInventory();
    } catch (error) {
      console.error('Error processing disposition:', error);
      throw error;
    }
  };

  const handleDownloadInventory = () => {
    try {
      const dataToExport = filteredInventory;

      if (dataToExport.length === 0) {
        toast.error('No items to export');
        return;
      }

      // Prepare CSV data
      const headers = ['Product Name', 'Supplier', 'On Hand', 'Reserved', 'Available', 'Rejected', 'Issued', 'Reorder Level', 'Status', 'Cost (₱)', 'Value (₱)', 'Last Updated'];

      const rows = (dataToExport as any[]).map((item) => [
        item.productName,
        supplierMap[item.supplier_id] || '—',
        item.quantity_on_hand,
        item.quantity_allocated,
        item.quantity_available,
        item.quantity_rejected,
        item.quantity_issued,
        item.reorder_level,
        item.quantity_available === 0 ? 'OUT OF STOCK' : item.quantity_available <= item.reorder_level ? 'LOW STOCK' : 'IN STOCK',
        (item.cost_price || 0).toFixed(2),
        (item.quantity_on_hand * (item.cost_price || 0)).toFixed(2),
        new Date(item.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
      ]);

      // Create CSV content
      let csvContent = headers.map((h) => `"${h}"`).join(',') + '\n';
      csvContent += rows.map((row) =>
        row.map((cell) => `"${cell}"`).join(',')
      ).join('\n');

      // Add summary at the end
      const totalValue = dataToExport.reduce((sum, item) => sum + (item.quantity_on_hand * (item.cost_price || 0)), 0);
      const totalRejected = dataToExport.reduce((sum, item) => sum + item.quantity_rejected, 0);
      
      csvContent += '\n\n';
      csvContent += `"INVENTORY SUMMARY",""` + '\n';
      csvContent += `"Total Items","${dataToExport.length}"` + '\n';
      csvContent += `"Total Stock Value (₱)","${totalValue.toFixed(2)}"` + '\n';
      csvContent += `"Total Rejected Units","${totalRejected}"` + '\n';
      csvContent += `"Export Date","${new Date().toLocaleDateString('en-PH')}"` + '\n';

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `inventory-export-${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Downloaded ${dataToExport.length} items`);
    } catch (error) {
      console.error('Error downloading inventory:', error);
      toast.error('Failed to download inventory');
    }
  };

  const supplierMap: Record<string, string> = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

  const filteredInventory = inventory.filter((item: any) => {
    if (searchTerm && !item.productName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (supplierFilter && item.supplier_id !== supplierFilter) return false;
    if (dateFrom && item.updatedAt < new Date(dateFrom)) return false;
    if (dateTo && item.updatedAt > new Date(dateTo + 'T23:59:59.999')) return false;
    if (filterType === 'low-stock') return item.quantity_available > 0 && item.quantity_available <= item.reorder_level;
    if (filterType === 'out-of-stock') return item.quantity_available === 0;
    if (filterType === 'in-stock') return item.quantity_available > item.reorder_level;
    return true;
  });

  const lowStockItems = inventory.filter((item) => item.quantity_available <= item.reorder_level);
  const rejectedItems = inventory.filter((item) => item.quantity_rejected > 0);
  const outOfStockItems = inventory.filter((item) => item.quantity_available === 0);


  // Calculate total stock value in pesos using actual cost price
  const totalStockValue = inventory.reduce((sum, item) => {
    return sum + (item.quantity_on_hand * item.cost_price);
  }, 0);

  // Calculate rejected value
  const totalRejectedValue = inventory.reduce((sum, item) => {
    return sum + (item.quantity_rejected * item.cost_price);
  }, 0);

  // Format peso currency
  const formatPeso = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const warehouseMap: Record<string, string> = {};
  warehouses.forEach((wh) => { warehouseMap[wh.id] = wh.name; });

  const columns: Column<any>[] = [
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
    },
    {
      key: 'warehouse_id',
      header: 'Warehouse',
      render: (value) => value
        ? <span className="text-sm text-gray-700 dark:text-gray-300">{warehouseMap[value] || value.slice(0, 8)}</span>
        : <span className="text-xs text-gray-400">—</span>,
    },
    {
      key: 'quantity_on_hand',
      header: 'On Hand',
      sortable: true,
      render: (value) => (
        <div className="font-semibold">{value}</div>
      ),
    },
    {
      key: 'quantity_allocated',
      header: 'Reserved',
      render: (value) => (
        <span
          title="Quantity held/reserved for confirmed Sales Orders that haven't shipped yet. Released automatically when the SO is fulfilled or cancelled."
          className={value > 0 ? 'bg-blue-100 px-2 py-1 rounded text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 cursor-help' : 'text-gray-400 cursor-help'}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'quantity_rejected',
      header: 'Rejected',
      sortable: true,
      render: (value) => (
        <span
          title="Units rejected during Goods Receipt (GRN). Use the Disposition button to return to supplier, scrap, or rework these items."
          className={value > 0 ? 'bg-orange-100 px-2 py-1 rounded text-sm font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 cursor-help' : 'cursor-help'}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'quantity_issued',
      header: 'Issued',
      sortable: true,
      render: (value) => (
        <span className={value > 0 ? 'font-semibold text-purple-700 dark:text-purple-400' : 'text-gray-400'}>
          {value}
        </span>
      ),
    },
    {
      key: 'reorder_level',
      header: 'Reorder Level',
      render: (value) => (
        <span className="bg-gray-100 px-2 py-1 rounded text-sm dark:bg-gray-700">{value}</span>
      ),
    },
    {
      key: 'quantity_available',
      header: 'Status',
      render: (value, row) => {
        if (value === 0) {
          return (
            <div className="flex flex-col gap-1">
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold dark:bg-red-900/30 dark:text-red-300">OUT OF STOCK</span>
              <a href={`/material-requests/create?product_id=${row.product_id}`} className="text-xs text-red-600 dark:text-red-400 hover:underline">+ MRF</a>
            </div>
          );
        } else if (value <= row.reorder_level) {
          return (
            <div className="flex flex-col gap-1">
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold dark:bg-orange-900/30 dark:text-orange-300">RESTOCK NEEDED</span>
              <a href={`/material-requests/create?product_id=${row.product_id}`} className="text-xs text-orange-600 dark:text-orange-400 hover:underline">+ MRF</a>
            </div>
          );
        } else {
          return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold dark:bg-green-900/30 dark:text-green-300">IN STOCK</span>;
        }
      },
    },
    {
      key: 'last_stock_date',
      header: 'Last Updated',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          {row.quantity_rejected > 0 && (
            <button
              onClick={() => handleOpenDispositionModal(row)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
              title="Process rejected items"
            >
              <Zap className="h-4 w-4" />
              Disposition
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Inventory</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {selectedWarehouseId && warehouses.length > 0
              ? `📦 ${fmtWarehouse(warehouses.find(w => w.id === selectedWarehouseId)) || 'Selected Warehouse'} · Stock levels`
              : 'Monitor stock levels and manage inventory'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadInventory} disabled={isLoading} className="gap-2">
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleDownloadInventory} className="gap-2">
            CSV
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">

        {/* ── Main: search + filters + table ── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Search + Supplier dropdown */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm min-w-[150px]"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{fmtSupplier(s)}</option>)}
            </select>
            {(supplierFilter) && (
              <button onClick={() => setSupplierFilter('')} className="text-xs text-gray-400 hover:text-red-500 px-2 py-2">Clear</button>
            )}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">Updated:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-gray-400 hover:text-red-500 px-2 py-2">Clear</button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'all', label: 'All', count: inventory.length },
              { key: 'in-stock', label: 'In Stock', count: inventory.filter(i => i.quantity_available > i.reorder_level).length },
              { key: 'low-stock', label: 'Low Stock', count: lowStockItems.length },
              { key: 'out-of-stock', label: 'Out of Stock', count: outOfStockItems.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === key
                    ? key === 'low-stock' ? 'bg-yellow-500 text-white'
                      : key === 'out-of-stock' ? 'bg-red-600 text-white'
                      : key === 'in-stock' ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label} <span className="ml-1 opacity-75">({count})</span>
              </button>
            ))}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="card p-8 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin">
                  <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
                </div>
                <p className="mt-3 text-gray-600 dark:text-gray-400">Loading inventory...</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <DataTable
                columns={columns}
                data={filteredInventory}
                emptyMessage="No inventory items found."
                onRowClick={async (row) => {
              if (selectedItem?.id === row.id) {
                setSelectedItem(null);
                setPoReceipts([]);
                setMrfItems([]);
                setMisItems([]);
                setOldestStock(null);
                return;
              }
              setSelectedItem(row);
              setPoReceipts([]);
              setMrfItems([]);
              setMisItems([]);
              setOldestStock(null);
              setTxPage(1);
              setTxDateFrom('');
              setTxDateTo('');
              setTransactionsLoading(true);
              setRequestsLoading(true);
              try {
                const [poRes, mrfRes, misRes, oldestRes] = await Promise.all([
                  getProductPOReceipts(row.product_id),
                  getProductMRFRequests(row.product_id),
                  getProductMISItems(row.product_id),
                  getOldestUnconsumedStockDate(row.product_id, row.quantity_on_hand),
                ]);
                setPoReceipts(Array.isArray(poRes.data) ? poRes.data : []);
                setMrfItems(Array.isArray(mrfRes.data) ? mrfRes.data : []);
                setMisItems(Array.isArray(misRes.data) ? misRes.data : []);
                setOldestStock(oldestRes);
              } catch {
                setPoReceipts([]);
                setMrfItems([]);
                setMisItems([]);
              } finally {
                setTransactionsLoading(false);
                setRequestsLoading(false);
              }
            }}
          />
        </div>
      )}

      {/* Item Breakdown Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => { setSelectedItem(null); setPoReceipts([]); setMrfItems([]); setMisItems([]); setOldestStock(null); setTxPage(1); }}
        title={selectedItem?.productName}
        size="3xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Allocation method banner */}
          {!transactionsLoading && oldestStock && (
            <div className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm ${
              oldestStock.data
                ? 'bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700'
                : 'bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700'
            }`}>
              <span className="font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                {oldestStock.isBatch ? (oldestStock.allocationMethod ?? 'FIFO') : 'Pool'}
              </span>
              {oldestStock.data ? (() => {
                const method = oldestStock.allocationMethod ?? 'FIFO';
                const dateLabel = new Date(oldestStock.data).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
                const methodText =
                  method === 'LIFO' ? `Most recently received batch — received on` :
                  method === 'FEFO' ? `Soonest-to-expire batch — expires` :
                  `Oldest unconsumed batch — received on`;
                return (
                  <span className="text-amber-800 dark:text-amber-300">
                    {methodText}{' '}<strong>{dateLabel}</strong>
                    {oldestStock.isBatch && oldestStock.batchNumber && (
                      <span className="ml-1 font-mono text-xs bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
                        {oldestStock.batchNumber}
                      </span>
                    )}
                    {' '}— next to be issued
                  </span>
                );
              })() : (
                <span className="text-gray-500 dark:text-gray-400">
                  {oldestStock.isBatch ? 'No stock remaining in any batch' : 'No unconsumed stock on hand'}
                </span>
              )}
            </div>
          )}

          {/* Unified movement table */}
          {(transactionsLoading || requestsLoading) ? (
            <div className="text-center py-6 text-sm text-gray-500">Loading...</div>
          ) : (() => {
            // Only show actual stock movements: Received (PO) and Issued (MIS)
            const rows: any[] = [];

            poReceipts.forEach(item => {
              rows.push({
                _date: item.purchase_order?.order_date || item.created_at,
                type: 'in',
                label: 'Received',
                qty: item.quantity_received,
                po: item.purchase_order?.po_number || '—',
                mrf: item.purchase_order?.material_request?.mrf_number || '—',
                mis: '—',
              });
            });

            misItems.forEach(item => {
              rows.push({
                _date: item.material_issue_slip?.created_at || item.created_at,
                type: 'out',
                label: 'Issued',
                qty: item.quantity_issued,
                po: '—',
                mrf: '—',
                mis: item.material_issue_slip?.mis_number || '—',
              });
            });

            rows.sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());

            if (rows.length === 0) {
              return <div className="text-center py-6 text-sm text-gray-400">No transactions found for this product.</div>;
            }

            const filteredRows = rows.filter((row) => {
              const d = new Date(row._date);
              if (txDateFrom && d < new Date(txDateFrom)) return false;
              if (txDateTo && d > new Date(txDateTo + 'T23:59:59.999')) return false;
              return true;
            });

            const totalPages = Math.max(1, Math.ceil(filteredRows.length / TX_PAGE_SIZE));
            const page = Math.min(txPage, totalPages);
            const startIndex = (page - 1) * TX_PAGE_SIZE;
            const pagedRows = filteredRows.slice(startIndex, startIndex + TX_PAGE_SIZE);

            return (
              <div className="space-y-2">
              <div className="flex items-center gap-1.5 justify-end">
                <label className="text-xs text-gray-500 dark:text-gray-400">Date:</label>
                <input
                  type="date"
                  value={txDateFrom}
                  onChange={(e) => { setTxDateFrom(e.target.value); setTxPage(1); }}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={txDateTo}
                  onChange={(e) => { setTxDateTo(e.target.value); setTxPage(1); }}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                />
                {(txDateFrom || txDateTo) && (
                  <button onClick={() => { setTxDateFrom(''); setTxDateTo(''); setTxPage(1); }} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                )}
              </div>

              {filteredRows.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400">No transactions in selected date range.</div>
              ) : (
              <>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">PO #</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">MRF #</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">MIS #</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {pagedRows.map((row, i) => {
                      const badgeColor = row.type === 'in'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
                      const qtyColor = row.type === 'in'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-orange-600 dark:text-orange-400';
                      return (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                            {new Date(row._date).toLocaleDateString('en-PH', { year: '2-digit', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${badgeColor}`}>
                              {row.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {row.po !== '—'
                              ? <span className="font-mono text-gray-900 dark:text-white">{row.po}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {row.mrf !== '—'
                              ? <span className="font-mono text-blue-600 dark:text-blue-400">{row.mrf}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {row.mis !== '—'
                              ? <span className="font-mono text-purple-600 dark:text-purple-400">{row.mis}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className={`px-3 py-2 text-right font-bold ${qtyColor}`}>
                            {row.type === 'in' ? '+' : '-'}{row.qty}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {startIndex + 1}-{Math.min(startIndex + TX_PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTxPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Prev
                    </button>
                    <span className="px-2 py-1 text-gray-600 dark:text-gray-400">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setTxPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              </>
              )}
              </div>
            );
          })()}
        </div>
      </Modal>

        </div>{/* end main column */}

        {/* ── Sidebar: summary in one container ── */}
        <div className="w-56 shrink-0 sticky top-4 self-start">
          <div className="card p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Summary</p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Total SKUs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventory.length}</p>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">Stock Value</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatPeso(totalStockValue)}</p>
                <p className="text-xs text-gray-400">In Pesos (PHP)</p>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">In Stock</span>
                  <span className="text-sm font-bold text-green-600">{inventory.length - lowStockItems.length - outOfStockItems.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Low Stock</span>
                  <span className="text-sm font-bold text-yellow-600">{lowStockItems.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Out of Stock</span>
                  <span className="text-sm font-bold text-red-600">{outOfStockItems.length}</span>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Reserved</span>
                    <span className="text-sm font-bold text-blue-600">
                      {inventory.reduce((s, i) => s + (i.quantity_allocated || 0), 0)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Held for pending SOs</p>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Rejected</span>
                    <span className="text-sm font-bold text-orange-600">
                      {rejectedItems.reduce((sum, i) => sum + i.quantity_rejected, 0)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{formatPeso(totalRejectedValue)} value · needs disposition</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>{/* end two-column flex */}

      {/* Rejection Disposition Modal */}
      <RejectionDispositionModal
        isOpen={isDispositionModalOpen}
        onClose={() => {
          setIsDispositionModalOpen(false);
          setSelectedProductForDisposition(null);
        }}
        onSubmit={handleProcessDisposition}
        product={selectedProductForDisposition}
      />
    </div>
  );
}
