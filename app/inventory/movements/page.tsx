'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  Activity,
  TrendingDown,
  Package,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Plus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { getAllStockTransactions, getProducts, getCompanyUsers, createStockTransaction, updateStockLevelAtomic } from '@/app/actions';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import { useWarehouse } from '@/contexts/warehouse-context';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  product_id: string;
  transaction_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
}

const PAGE_SIZE = 50;

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; sign: string; qtyColor: string }> = {
  inbound:    { label: 'Inbound',    color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',      icon: <ArrowDownCircle className="h-3.5 w-3.5" />, sign: '+', qtyColor: 'text-green-600 dark:text-green-400' },
  in:         { label: 'Inbound',    color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',      icon: <ArrowDownCircle className="h-3.5 w-3.5" />, sign: '+', qtyColor: 'text-green-600 dark:text-green-400' },
  outbound:   { label: 'Outbound',   color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',              icon: <ArrowUpCircle className="h-3.5 w-3.5" />,   sign: '-', qtyColor: 'text-red-600 dark:text-red-400' },
  out:        { label: 'Outbound',   color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',              icon: <ArrowUpCircle className="h-3.5 w-3.5" />,   sign: '-', qtyColor: 'text-red-600 dark:text-red-400' },
  reserved:   { label: 'Reserved',   color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',  icon: <Package className="h-3.5 w-3.5" />,        sign: '~', qtyColor: 'text-yellow-600 dark:text-yellow-400' },
  adjusted:   { label: 'Adjusted',   color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',         icon: <Activity className="h-3.5 w-3.5" />,        sign: '±', qtyColor: 'text-blue-600 dark:text-blue-400' },
  adjustment: { label: 'Adjusted',   color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',         icon: <Activity className="h-3.5 w-3.5" />,        sign: '±', qtyColor: 'text-blue-600 dark:text-blue-400' },
  rejected:   { label: 'Rejected',   color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', icon: <TrendingDown className="h-3.5 w-3.5" />,    sign: '-', qtyColor: 'text-orange-600 dark:text-orange-400' },
  damaged:    { label: 'Damaged',    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',            icon: <TrendingDown className="h-3.5 w-3.5" />,    sign: '-', qtyColor: 'text-gray-500 dark:text-gray-400' },
  return:     { label: 'Return',     color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', icon: <ArrowDownCircle className="h-3.5 w-3.5" />, sign: '+', qtyColor: 'text-purple-600 dark:text-purple-400' },
  return_to_supplier: { label: 'Return', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', icon: <ArrowUpCircle className="h-3.5 w-3.5" />, sign: '-', qtyColor: 'text-purple-600 dark:text-purple-400' },
  opening_balance:   { label: 'Opening Balance', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', icon: <ArrowDownCircle className="h-3.5 w-3.5" />, sign: '+', qtyColor: 'text-emerald-600 dark:text-emerald-400' },
};

const SOURCE_CONFIG: Record<string, { label: string; color: string; href?: (id: string) => string }> = {
  purchase_order: { label: 'PO', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300', href: (id) => `/purchase-orders/${id}` },
  sales_order:    { label: 'SO', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', href: (id) => `/sales-orders/${id}` },
  stock_transfer: { label: 'Transfer', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300', href: () => `/stock-transfers` },
  material_issue_slip: { label: 'MIS', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  material_return_slip: { label: 'MRS', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
};

type TypeFilter = 'all' | 'inbound' | 'outbound' | 'reserved' | 'adjusted' | 'rejected';

const TYPE_ALIASES: Record<string, string> = { in: 'inbound', out: 'outbound', adjustment: 'adjusted', return: 'inbound', return_to_supplier: 'outbound', opening_balance: 'inbound' };
const normalizeType = (t: string) => TYPE_ALIASES[t] ?? t;

// Date helpers
function toDateStr(d: Date) { return d.toISOString().split('T')[0]; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfWeek(d: Date) { const c = new Date(d); c.setDate(d.getDate() - d.getDay()); return c; }

const PRESETS = [
  { label: 'Today',       getRange: () => { const t = new Date(); return [toDateStr(t), toDateStr(t)]; } },
  { label: 'This Week',   getRange: () => { const t = new Date(); return [toDateStr(startOfWeek(t)), toDateStr(t)]; } },
  { label: 'This Month',  getRange: () => { const t = new Date(); return [toDateStr(startOfMonth(t)), toDateStr(t)]; } },
  { label: 'Last Month',  getRange: () => {
      const t = new Date(); const first = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const last  = new Date(t.getFullYear(), t.getMonth(), 0);
      return [toDateStr(first), toDateStr(last)];
  }},
  { label: 'All Time',    getRange: () => ['', ''] },
] as const;

const ADJUSTMENT_REASONS = [
  'Physical Count Correction',
  'Damaged / Spoiled',
  'Write-off',
  'Found Stock',
  'Sample / Demo',
  'Data Entry Error',
  'Other',
];

export default function StockMovementsPage() {
  const { selectedWarehouseId, warehouses } = useWarehouse();
  const [allTx, setAllTx]         = useState<Transaction[]>([]);
  const [products, setProducts]   = useState<Record<string, Product>>({});
  const [users, setUsers]         = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [activePreset, setActivePreset] = useState('This Month');
  const [page, setPage] = useState(1);

  // Stock Adjustment modal
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjForm, setAdjForm] = useState({
    product_id: '',
    warehouse_id: '',
    direction: 'add' as 'add' | 'remove',
    quantity: '' as number | '',
    reason: ADJUSTMENT_REASONS[0],
    notes: '',
  });
  const [productSearch, setProductSearch] = useState('');

  const productList = useMemo(
    () => Object.values(products).filter(p =>
      !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 50),
    [products, productSearch]
  );

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjForm.product_id || !adjForm.quantity || Number(adjForm.quantity) <= 0) {
      toast.error('Select a product and enter a valid quantity');
      return;
    }
    setAdjSubmitting(true);
    try {
      const delta = adjForm.direction === 'add' ? Number(adjForm.quantity) : -Number(adjForm.quantity);
      const warehouseId = adjForm.warehouse_id || selectedWarehouseId || undefined;
      const notes = `[${adjForm.reason}]${adjForm.notes ? ' ' + adjForm.notes : ''}`;

      const txRes = await createStockTransaction({
        product_id: adjForm.product_id,
        transaction_type: 'adjustment',
        quantity: delta,
        notes,
        reference_type: 'manual_adjustment',
        warehouse_id: warehouseId,
      });
      if (txRes.error) throw new Error(txRes.error.message);

      await updateStockLevelAtomic(adjForm.product_id, delta, 0, warehouseId);

      toast.success(`Stock adjusted: ${delta > 0 ? '+' : ''}${delta} units`);
      setShowAdjModal(false);
      setAdjForm({ product_id: '', warehouse_id: '', direction: 'add', quantity: '', reason: ADJUSTMENT_REASONS[0], notes: '' });
      setProductSearch('');
      fetchTransactions(dateFrom, dateTo, selectedWarehouseId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save adjustment');
    } finally {
      setAdjSubmitting(false);
    }
  };

  // Default to current month
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(toDateStr(startOfMonth(today)));
  const [dateTo,   setDateTo]   = useState(toDateStr(today));

  const fetchTransactions = useCallback(async (from: string | undefined, to: string | undefined, warehouseId?: string) => {
    setIsLoading(true);
    setPage(1);
    try {
      const wh = warehouseId && warehouseId !== 'all' ? warehouseId : undefined;
      const res = await getAllStockTransactions({
        dateFrom: from || undefined,
        dateTo:   to   || undefined,
        warehouseId: wh,
        limit: 1000,
      });
      setAllTx(Array.isArray(res.data) ? res.data : []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load products + users once
  useEffect(() => {
    getProducts(500, 0).then(res => {
      if (res.error) { console.error('Failed to load products', res.error); return; }
      const map: Record<string, Product> = {};
      if (Array.isArray(res.data)) res.data.forEach((p: any) => { map[p.id] = { id: p.id, name: p.name, sku: p.sku }; });
      setProducts(map);
    });
    getCompanyUsers().then(res => { if (!res.error) setUsers(res.data); });
  }, []);

  // Reload when date range or warehouse changes
  useEffect(() => { fetchTransactions(dateFrom, dateTo, selectedWarehouseId); }, [dateFrom, dateTo, selectedWarehouseId, fetchTransactions]);

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const [from, to] = preset.getRange();
    setActivePreset(preset.label);
    setDateFrom(from);
    setDateTo(to);
  };

  const filtered = useMemo(() => {
    return allTx.filter(tx => {
      if (typeFilter !== 'all' && normalizeType(tx.transaction_type) !== typeFilter) return false;
      if (search) {
        const prod = products[tx.product_id];
        const q = search.toLowerCase();
        if (
          !prod?.name.toLowerCase().includes(q) &&
          !prod?.sku?.toLowerCase().includes(q) &&
          !(tx.notes || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [allTx, typeFilter, search, products]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [typeFilter, search]);

  // Stats always reflect the full date-range period (unaffected by type/source/search filters)
  // so the summary cards show period totals, not just what's visible in the table.
  const stats = useMemo(() => ({
    inbound:  allTx.filter(t => normalizeType(t.transaction_type) === 'inbound').reduce((s, t) => s + Math.abs(t.quantity), 0),
    outbound: allTx.filter(t => normalizeType(t.transaction_type) === 'outbound').reduce((s, t) => s + Math.abs(t.quantity), 0),
    reserved: allTx.filter(t => t.transaction_type === 'reserved').reduce((s, t) => s + Math.abs(t.quantity), 0),
  }), [allTx]);

  const downloadCSV = () => {
    const headers = ['Date', 'Time', 'Product', 'SKU', 'Type', 'Qty', 'Source', 'Reference ID', 'Processed By', 'Notes'];
    const rows = filtered.map(tx => {
      const product = products[tx.product_id];
      const typeCfg = TYPE_CONFIG[tx.transaction_type];
      const srcCfg = tx.reference_type ? SOURCE_CONFIG[tx.reference_type] : null;
      const d = new Date(tx.created_at);
      return [
        d.toLocaleDateString('en-PH'),
        d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        product?.name || tx.product_id,
        product?.sku || '',
        typeCfg?.label || tx.transaction_type,
        tx.transaction_type === 'adjusted'
          ? (tx.quantity >= 0 ? `+${tx.quantity}` : `${tx.quantity}`)
          : `${typeCfg?.sign || ''}${Math.abs(tx.quantity)}`,
        srcCfg?.label || tx.reference_type || '',
        tx.reference_id || '',
        (tx.created_by ? users[tx.created_by] : '') || 'System',
        tx.notes || '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-movements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TYPE_TABS: { key: TypeFilter; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'inbound',  label: 'Inbound' },
    { key: 'outbound', label: 'Outbound' },
    { key: 'reserved', label: 'Reserved' },
    { key: 'adjusted', label: 'Adjusted' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary-600" />
            Stock Movements
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selectedWarehouseId && warehouses.length > 0
              ? `📦 ${fmtWarehouse(warehouses.find(w => w.id === selectedWarehouseId)) || 'Selected Warehouse'} · Full transaction ledger`
              : 'Full ledger of all inventory transactions'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdjModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            New Adjustment
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={() => fetchTransactions(dateFrom, dateTo, selectedWarehouseId)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search — leftmost */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, SKU, notes…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Period dropdown with visible chevron */}
          <div className="relative">
            <select
              value={activePreset}
              onChange={(e) => {
                const preset = PRESETS.find(p => p.label === e.target.value);
                if (preset) applyPreset(preset);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              {PRESETS.map(p => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
              {!activePreset && <option value="">Custom</option>}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
          </div>

          {/* Custom date range */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setActivePreset(''); }}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setActivePreset(''); }}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* Type dropdown */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              {TYPE_TABS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Table + Summary */}
      <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0 card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== allTx.length && ` (filtered from ${allTx.length})`}
          </span>
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-gray-500">Loading transactions…</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Product</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 w-24">Type</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300 w-16">Qty</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-300 w-16">Source</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Reference</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Processed By</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginated.length > 0 ? paginated.map(tx => {
                    const product = products[tx.product_id];
                    const typeCfg = TYPE_CONFIG[tx.transaction_type] ?? { label: tx.transaction_type, color: 'bg-gray-100 text-gray-700', icon: null, sign: '', qtyColor: 'text-gray-600' };
                    const srcCfg  = tx.reference_type ? SOURCE_CONFIG[tx.reference_type] : null;
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' })}
                          <span className="block text-gray-400 dark:text-gray-500">
                            {new Date(tx.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900 dark:text-white">{product?.name ?? '—'}</p>
                          {product?.sku && <p className="text-gray-400 dark:text-gray-500">SKU: {product.sku}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${typeCfg.color}`}>
                            {typeCfg.icon}{typeCfg.label}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold tabular-nums ${typeCfg.qtyColor}`}>
                          {tx.transaction_type === 'adjusted'
                            ? (tx.quantity >= 0 ? `+${tx.quantity}` : `${tx.quantity}`)
                            : `${typeCfg.sign}${Math.abs(tx.quantity)}`}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {srcCfg ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${srcCfg.color}`}>
                              {srcCfg.label}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {tx.reference_id && srcCfg?.href ? (
                            <Link
                              href={srcCfg.href(tx.reference_id)}
                              className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline font-medium"
                            >
                              {tx.reference_id.slice(0, 8)}…
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-gray-400">{tx.reference_id ? tx.reference_id.slice(0, 12) + '…' : '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {(() => {
                            const name = tx.created_by ? users[tx.created_by] : null;
                            return name ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center">
                                  {name[0]!.toUpperCase()}
                                </span>
                                <span className="text-gray-700 dark:text-gray-300">{name}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">System</span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {tx.notes || '—'}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                        No transactions found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">«</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.min(Math.max(page - 2, 1) + i, totalPages);
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-2.5 py-1 rounded border text-xs ${p === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

        {/* Summary */}
        <div className="w-52 shrink-0 card p-4 sticky top-4 self-start">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Summary</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{filtered.length} records</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Inbound</span>
              <span className="text-sm font-bold text-green-600">+{stats.inbound}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Outbound</span>
              <span className="text-sm font-bold text-red-600">-{stats.outbound}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Reserved</span>
              <span className="text-sm font-bold text-yellow-600">~{stats.reserved}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Net</span>
              <span className={`text-sm font-bold ${stats.inbound - stats.outbound >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {stats.inbound - stats.outbound >= 0 ? '+' : ''}{stats.inbound - stats.outbound}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Stock Adjustment</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manually correct inventory quantities</p>
              </div>
              <button onClick={() => setShowAdjModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="p-5 space-y-4">
              {/* Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product *</label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setAdjForm(f => ({ ...f, product_id: '' })); }}
                  placeholder="Search by name or SKU…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                {productSearch && !adjForm.product_id && productList.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                    {productList.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setAdjForm(f => ({ ...f, product_id: p.id })); setProductSearch(p.name + (p.sku ? ` (${p.sku})` : '')); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.sku && <span className="ml-1.5 text-xs text-gray-400">SKU: {p.sku}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Warehouse</label>
                <select
                  value={adjForm.warehouse_id}
                  onChange={(e) => setAdjForm(f => ({ ...f, warehouse_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All / Default</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{fmtWarehouse(w)}</option>
                  ))}
                </select>
              </div>

              {/* Direction + Quantity */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjustment</label>
                  <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setAdjForm(f => ({ ...f, direction: 'add' }))}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        adjForm.direction === 'add'
                          ? 'bg-green-600 text-white shadow'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjForm(f => ({ ...f, direction: 'remove' }))}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        adjForm.direction === 'remove'
                          ? 'bg-red-600 text-white shadow'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      − Remove
                    </button>
                  </div>
                </div>
                <div className="w-28">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={adjForm.quantity}
                    onChange={(e) => setAdjForm(f => ({ ...f, quantity: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                    placeholder="0"
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center font-bold"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason *</label>
                <select
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                >
                  {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={adjForm.notes}
                  onChange={(e) => setAdjForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Additional details…"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                />
              </div>

              {/* Preview */}
              {adjForm.product_id && adjForm.quantity && (
                <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  adjForm.direction === 'add'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                }`}>
                  {adjForm.direction === 'add' ? '+' : '−'}{adjForm.quantity} units · {adjForm.reason}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjSubmitting || !adjForm.product_id}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg"
                >
                  {adjSubmitting ? 'Saving…' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
