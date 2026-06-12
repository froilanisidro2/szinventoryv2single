'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Plus, X, Settings2, BarChart2, TrendingUp, PieChart as PieIcon,
  Hash, RefreshCw, GripVertical, LayoutDashboard, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSalesOrders, getCustomers, getPurchaseOrders, getSuppliers,
  getInvoices, getPayments, getProducts, getStockLevels, getProductCategories,
  getMaterialIssueSlips, getMaterialIssueSlipItemsForReport,
  getMaterialReturnSlips, getMaterialRequests,
  getJobOrders, getProductSupplierMap,
} from '@/app/actions';

// ── types ─────────────────────────────────────────────────────────────────────

type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'kpi';
type DataSource = 'sales_orders' | 'purchase_orders' | 'invoices' | 'payments' | 'products' | 'inventory';
type Metric = 'count' | 'sum_amount' | 'sum_quantity' | 'avg_amount';
type GroupBy = 'status' | 'month' | 'category' | 'customer' | 'supplier' | 'none';

interface Widget {
  id: string;
  title: string;
  chartType: ChartType;
  source: DataSource;
  metric: Metric;
  groupBy: GroupBy;
  dateFrom: string;
  dateTo: string;
  color: string;
}

interface WidgetData {
  chartData: { name: string; value: number }[];
  kpiValue: number | string;
  kpiLabel: string;
}

// ── constants ─────────────────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#f97316', '#14b8a6'];

const CHART_TYPES: { type: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'bar',  label: 'Bar',   icon: BarChart2 },
  { type: 'line', label: 'Line',  icon: TrendingUp },
  { type: 'area', label: 'Area',  icon: TrendingUp },
  { type: 'pie',  label: 'Pie',   icon: PieIcon },
  { type: 'kpi',  label: 'KPI',   icon: Hash },
];

const SOURCES: { id: DataSource; label: string }[] = [
  { id: 'sales_orders',    label: 'Sales Orders' },
  { id: 'purchase_orders', label: 'Purchase Orders' },
  { id: 'invoices',        label: 'Invoices' },
  { id: 'payments',        label: 'Payments' },
  { id: 'products',        label: 'Products' },
  { id: 'inventory',       label: 'Inventory' },
];

const METRICS: { id: Metric; label: string; sources: DataSource[] }[] = [
  { id: 'count',        label: 'Count',        sources: ['sales_orders','purchase_orders','invoices','payments','products','inventory'] },
  { id: 'sum_amount',   label: 'Total Amount', sources: ['sales_orders','purchase_orders','invoices','payments'] },
  { id: 'avg_amount',   label: 'Avg Amount',   sources: ['sales_orders','purchase_orders','invoices','payments'] },
  { id: 'sum_quantity', label: 'Total Qty',    sources: ['inventory'] },
];

const GROUP_BYS: { id: GroupBy; label: string; sources: DataSource[] }[] = [
  { id: 'status',   label: 'Status',       sources: ['sales_orders','purchase_orders','invoices'] },
  { id: 'month',    label: 'Month',        sources: ['sales_orders','purchase_orders','invoices','payments'] },
  { id: 'customer', label: 'Customer',     sources: ['sales_orders','invoices'] },
  { id: 'supplier', label: 'Supplier',     sources: ['purchase_orders'] },
  { id: 'category', label: 'Category',     sources: ['products','inventory'] },
  { id: 'none',     label: 'None (total)', sources: ['sales_orders','purchase_orders','invoices','payments','products','inventory'] },
];

const STORAGE_KEY = 'sz_analytics_widgets';

// ── preset charts (read-only, production workflow) ────────────────────────────

interface ProductionPreset {
  id: string;
  title: string;
  chartType: ChartType;
  color: string;
  footer: string;
  fetcher: () => Promise<WidgetData>;
}

function aggToCostWidgetData(agg: Record<string, number>, unitLabel: string): WidgetData {
  const entries = Object.entries(agg).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  const chartData = [...entries].sort((a, b) => b.value - a.value).slice(0, 12);
  const total = entries.reduce((s, e) => s + e.value, 0);
  return { chartData, kpiValue: fmt(total), kpiLabel: `${entries.length} ${unitLabel}` };
}

function aggToCountWidgetData(agg: Record<string, number>, recordCount: number): WidgetData {
  const chartData = Object.entries(agg).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 12);
  return { chartData, kpiValue: recordCount, kpiLabel: `${recordCount} record${recordCount !== 1 ? 's' : ''}` };
}

async function fetchMaterialCostPerJO(): Promise<WidgetData> {
  const [itemsRes, joRes] = await Promise.all([getMaterialIssueSlipItemsForReport(), getJobOrders()]);
  const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
  const joMap: Record<string, any> = {};
  (Array.isArray(joRes.data) ? joRes.data : []).forEach((j: any) => { joMap[j.id] = j; });

  const agg: Record<string, number> = {};
  for (const i of items) {
    const mis = i.material_issue_slip || {};
    const joId = mis.job_order_id;
    if (!joId) continue;
    const p = i.product || {};
    const cost = Number(i.quantity_issued || 0) * Number(p.cost_price || 0);
    const key = joMap[joId]?.jo_number || 'Unknown';
    agg[key] = (agg[key] || 0) + cost;
  }
  return aggToCostWidgetData(agg, 'job orders');
}

async function fetchConsumptionBySupplier(): Promise<WidgetData> {
  const [itemsRes, suppMapRes, suppRes] = await Promise.all([
    getMaterialIssueSlipItemsForReport(), getProductSupplierMap(), getSuppliers(500),
  ]);
  const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
  const prodSupplier: Record<string, string> = (suppMapRes.data as any) || {};
  const suppMap: Record<string, string> = {};
  if (Array.isArray(suppRes.data)) suppRes.data.forEach((s: any) => { suppMap[s.id] = s.name; });

  const agg: Record<string, number> = {};
  for (const i of items) {
    const p = i.product || {};
    const supplierId: string | undefined = prodSupplier[i.product_id];
    const name = (supplierId && suppMap[supplierId]) || 'Unassigned';
    const cost = Number(i.quantity_issued || 0) * Number(p.cost_price || 0);
    agg[name] = (agg[name] || 0) + cost;
  }
  return aggToCostWidgetData(agg, 'suppliers');
}

async function fetchSupplierConsumptionByMonth(): Promise<WidgetData> {
  const itemsRes = await getMaterialIssueSlipItemsForReport();
  const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];

  const agg: Record<string, { label: string; value: number }> = {};
  for (const i of items) {
    const mis = i.material_issue_slip || {};
    const p = i.product || {};
    const dateStr = mis.issued_at || mis.created_at;
    const d = dateStr ? new Date(dateStr) : null;
    if (!d || isNaN(d.getTime())) continue;
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    const cost = Number(i.quantity_issued || 0) * Number(p.cost_price || 0);
    if (!agg[sortKey]) agg[sortKey] = { label, value: 0 };
    agg[sortKey].value += cost;
  }
  const chartData = Object.keys(agg).sort().map(k => ({ name: agg[k]!.label, value: Math.round(agg[k]!.value * 100) / 100 }));
  const total = chartData.reduce((s, r) => s + r.value, 0);
  return { chartData, kpiValue: fmt(total), kpiLabel: `${chartData.length} month${chartData.length !== 1 ? 's' : ''}` };
}

async function fetchMISByStatus(): Promise<WidgetData> {
  const res = await getMaterialIssueSlips();
  const rows = Array.isArray(res.data) ? res.data : [];
  const agg: Record<string, number> = {};
  for (const r of rows) {
    const key = (r.status || 'unknown').replace(/_/g, ' ');
    agg[key] = (agg[key] || 0) + 1;
  }
  return aggToCountWidgetData(agg, rows.length);
}

async function fetchMRSByStatus(): Promise<WidgetData> {
  const res = await getMaterialReturnSlips();
  const rows = Array.isArray(res.data) ? res.data : [];
  const agg: Record<string, number> = {};
  for (const r of rows) {
    const key = (r.status || 'unknown').replace(/_/g, ' ');
    agg[key] = (agg[key] || 0) + 1;
  }
  return aggToCountWidgetData(agg, rows.length);
}

async function fetchMRFByStatus(): Promise<WidgetData> {
  const res = await getMaterialRequests();
  const rows = Array.isArray(res.data) ? res.data : [];
  const agg: Record<string, number> = {};
  for (const r of rows) {
    const key = (r.status || 'unknown').replace(/_/g, ' ');
    agg[key] = (agg[key] || 0) + 1;
  }
  return aggToCountWidgetData(agg, rows.length);
}

const PRODUCTION_PRESETS: ProductionPreset[] = [
  { id: 'p1', title: 'Material Cost per JO',                        chartType: 'bar',  color: '#14b8a6', footer: 'Material Issue Slips · Cost by Job Order',  fetcher: fetchMaterialCostPerJO },
  { id: 'p2', title: 'Material Consumption & Cost per JO by Supplier', chartType: 'pie', color: '#a855f7', footer: 'Material Issue Slips · Cost by Supplier', fetcher: fetchConsumptionBySupplier },
  { id: 'p3', title: 'Supplier Consumption by Month',               chartType: 'area', color: '#f43f5e', footer: 'Material Issue Slips · Cost by Month',     fetcher: fetchSupplierConsumptionByMonth },
  { id: 'p4', title: 'Material Issue Slips (MIS)',                  chartType: 'bar',  color: '#6366f1', footer: 'Issue Slips · Count by Status',            fetcher: fetchMISByStatus },
  { id: 'p5', title: 'Returned Items (MRS)',                        chartType: 'bar',  color: '#f59e0b', footer: 'Return Slips · Count by Status',           fetcher: fetchMRSByStatus },
  { id: 'p6', title: 'Material Requests (MRF)',                     chartType: 'pie',  color: '#22c55e', footer: 'Material Requests · Count by Status',      fetcher: fetchMRFByStatus },
];

// ── default custom widgets ────────────────────────────────────────────────────

const DEFAULT_WIDGETS: Widget[] = [
  { id: 'c1', title: 'Sales Orders by Month', chartType: 'bar',  source: 'sales_orders', metric: 'sum_amount', groupBy: 'month',  dateFrom: '', dateTo: '', color: '#6366f1' },
  { id: 'c2', title: 'Top Customers',         chartType: 'bar',  source: 'invoices',     metric: 'sum_amount', groupBy: 'customer', dateFrom: '', dateTo: '', color: '#22c55e' },
];

// ── data fetcher ──────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) { return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function inRange(dateStr: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to + 'T23:59:59')) return false;
  return true;
}

async function fetchWidgetData(widget: Widget, warehouseId?: string): Promise<WidgetData> {
  const { source, metric, groupBy, dateFrom, dateTo } = widget;
  const wh = warehouseId;

  let rows: any[] = [];
  let nameMap: Record<string, string> = {};
  let catMap: Record<string, string> = {};

  if (source === 'sales_orders') {
    const [soRes, custRes] = await Promise.all([getSalesOrders(1000, 0, wh), getCustomers(500)]);
    rows = (Array.isArray(soRes.data) ? soRes.data : [])
      .filter((r: any) => inRange(r.order_date || r.created_at, dateFrom, dateTo));
    if (Array.isArray(custRes.data)) custRes.data.forEach((c: any) => { nameMap[c.id] = c.name; });
  } else if (source === 'purchase_orders') {
    const [poRes, suppRes] = await Promise.all([getPurchaseOrders(1000, 0, wh), getSuppliers(500)]);
    rows = (Array.isArray(poRes.data) ? poRes.data : [])
      .filter((r: any) => inRange(r.order_date || r.created_at, dateFrom, dateTo));
    if (Array.isArray(suppRes.data)) suppRes.data.forEach((s: any) => { nameMap[s.id] = s.name; });
  } else if (source === 'invoices') {
    const [invRes, custRes] = await Promise.all([getInvoices(1000, 0, wh), getCustomers(500)]);
    const all = Array.isArray(invRes.data) ? invRes.data : [];
    rows = all
      .filter((i: any) => i.order_type === 'sales_order' || (!i.order_type && !i.supplier_id))
      .filter((i: any) => inRange(i.issue_date || i.invoice_date || i.created_at, dateFrom, dateTo));
    if (Array.isArray(custRes.data)) custRes.data.forEach((c: any) => { nameMap[c.id] = c.name; });
  } else if (source === 'payments') {
    const res = await getPayments(2000); // payments are company-wide
    rows = (Array.isArray(res.data) ? res.data : [])
      .filter((r: any) => inRange(r.payment_date || r.created_at, dateFrom, dateTo));
  } else if (source === 'products') {
    const [pRes, cRes] = await Promise.all([getProducts(1000, 0, wh), getProductCategories(100)]);
    rows = Array.isArray(pRes.data) ? pRes.data : [];
    if (Array.isArray(cRes.data)) cRes.data.forEach((c: any) => { catMap[c.id] = c.name; });
  } else if (source === 'inventory') {
    const [sRes, pRes, cRes] = await Promise.all([getStockLevels(1000, 0, wh), getProducts(1000, 0, wh), getProductCategories(100)]);
    const prodMap: Record<string, any> = {};
    if (Array.isArray(pRes.data)) pRes.data.forEach((p: any) => { prodMap[p.id] = p; });
    if (Array.isArray(cRes.data)) cRes.data.forEach((c: any) => { catMap[c.id] = c.name; });
    rows = (Array.isArray(sRes.data) ? sRes.data : []).map((s: any) => ({
      ...s,
      _product: prodMap[s.product_id] || {},
    }));
  }

  const getValue = (row: any): number => {
    if (metric === 'count') return 1;
    if (metric === 'sum_amount' || metric === 'avg_amount') return Number(row.total_amount || row.amount || 0);
    if (metric === 'sum_quantity') return Number(row.quantity_on_hand || row.quantity || 0);
    return 1;
  };

  const getGroupKey = (row: any): string => {
    if (groupBy === 'none') return 'Total';
    if (groupBy === 'status') return (row.status || 'unknown').replace(/_/g, ' ');
    if (groupBy === 'month') {
      const d = new Date(row.order_date || row.issue_date || row.invoice_date || row.payment_date || row.created_at);
      return isNaN(d.getTime()) ? '?' : `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    }
    if (groupBy === 'customer') return nameMap[row.customer_id] || 'Unknown';
    if (groupBy === 'supplier') return nameMap[row.supplier_id] || 'Unknown';
    if (groupBy === 'category') {
      if (source === 'inventory') return catMap[row._product?.category_id] || 'Uncategorized';
      return catMap[row.category_id] || 'Uncategorized';
    }
    return 'Other';
  };

  const agg: Record<string, number[]> = {};
  for (const row of rows) {
    const key = getGroupKey(row);
    if (!agg[key]) agg[key] = [];
    agg[key].push(getValue(row));
  }

  const chartData = Object.entries(agg).map(([name, vals]) => {
    const sum = vals.reduce((s, v) => s + v, 0);
    const value = metric === 'avg_amount' ? (vals.length > 0 ? sum / vals.length : 0) : sum;
    return { name, value: Math.round(value * 100) / 100 };
  }).sort((a, b) => b.value - a.value).slice(0, 12);

  const total = rows.reduce((s, r) => s + getValue(r), 0);
  const kpiValue = metric === 'avg_amount'
    ? (rows.length > 0 ? fmt(total / rows.length) : '—')
    : metric === 'count' ? rows.length : fmt(total);
  const kpiLabel = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;

  return { chartData, kpiValue, kpiLabel };
}

// ── chart renderer ────────────────────────────────────────────────────────────

function WidgetChart({ data, chartType, color }: { data: { name: string; value: number }[]; chartType: ChartType; color: string }) {
  if (data.length === 0) return <p className="text-xs text-gray-400 text-center py-8">No data for this period</p>;

  const tickFmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);

  if (chartType === 'bar') return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} width={40} />
        <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Value']} />
        <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  if (chartType === 'line') return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} width={40} />
        <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Value']} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );

  if (chartType === 'area') return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} width={40} />
        <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Value']} />
        <Area type="monotone" dataKey="value" stroke={color} fill={`url(#grad-${color.replace('#','')})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );

  if (chartType === 'pie') return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Value']} />
      </PieChart>
    </ResponsiveContainer>
  );

  return null;
}

// ── widget card (shared by preset + custom) ───────────────────────────────────

function WidgetCard({
  widget,
  editable,
  onRemove,
  onEdit,
  warehouseId,
}: {
  widget: Widget;
  editable: boolean;
  onRemove?: (id: string) => void;
  onEdit?: (widget: Widget) => void;
  warehouseId?: string;
}) {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await fetchWidgetData(widget, warehouseId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [widget, warehouseId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card p-4 space-y-3 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {editable && <GripVertical className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0" />}
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{widget.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={load} title="Refresh" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {editable && onEdit && (
            <button onClick={() => onEdit(widget)} title="Edit" className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
          {editable && onRemove && (
            <button onClick={() => onRemove(widget.id)} title="Remove" className="p-1 text-gray-400 hover:text-red-500">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
        {error && !loading && (
          <p className="text-xs text-red-500 text-center py-8">Failed to load data</p>
        )}
        {!loading && !error && data && (
          widget.chartType === 'kpi' ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1">
              <p className="text-4xl font-bold" style={{ color: widget.color }}>{data.kpiValue}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{data.kpiLabel}</p>
            </div>
          ) : (
            <WidgetChart data={data.chartData} chartType={widget.chartType} color={widget.color} />
          )
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2">
        <span>{SOURCES.find(s => s.id === widget.source)?.label}</span>
        <span>·</span>
        <span>{METRICS.find(m => m.id === widget.metric)?.label}</span>
        {widget.groupBy !== 'none' && <><span>·</span><span>by {widget.groupBy}</span></>}
      </div>
    </div>
  );
}

// ── widget editor modal ───────────────────────────────────────────────────────

const DEFAULT_WIDGET: Omit<Widget, 'id'> = {
  title: '',
  chartType: 'bar',
  source: 'sales_orders',
  metric: 'count',
  groupBy: 'status',
  dateFrom: '',
  dateTo: '',
  color: COLORS[0],
};

function WidgetEditor({
  initial,
  onSave,
  onClose,
}: {
  initial?: Widget;
  onSave: (w: Omit<Widget, 'id'>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Widget, 'id'>>(initial ? { ...initial } : { ...DEFAULT_WIDGET });
  const set = (field: keyof Omit<Widget, 'id'>, val: any) => setForm(prev => ({ ...prev, [field]: val }));
  const availableMetrics = METRICS.filter(m => m.sources.includes(form.source));
  const availableGroupBys = GROUP_BYS.filter(g => g.sources.includes(form.source));

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Enter a widget title'); return; }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">{initial ? 'Edit Widget' : 'Add Widget'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Widget Title</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Sales by Status"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Chart Type</label>
            <div className="flex gap-2 flex-wrap">
              {CHART_TYPES.map(({ type, label, icon: Icon }) => (
                <button key={type} onClick={() => set('chartType', type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    form.chartType === type
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data Source</label>
            <select value={form.source} onChange={e => {
              const src = e.target.value as DataSource;
              const newMetrics = METRICS.filter(m => m.sources.includes(src));
              const newGroups = GROUP_BYS.filter(g => g.sources.includes(src));
              set('source', src);
              if (!newMetrics.find(m => m.id === form.metric)) set('metric', newMetrics[0]?.id || 'count');
              if (!newGroups.find(g => g.id === form.groupBy)) set('groupBy', newGroups[0]?.id || 'none');
            }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Metric</label>
              <select value={form.metric} onChange={e => set('metric', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                {availableMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Group By</label>
              <select value={form.groupBy} onChange={e => set('groupBy', e.target.value as GroupBy)}
                disabled={form.chartType === 'kpi'}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50">
                {availableGroupBys.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date From</label>
              <input type="date" value={form.dateFrom} onChange={e => set('dateFrom', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date To</label>
              <input type="date" value={form.dateTo} onChange={e => set('dateTo', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
            {initial ? 'Update Widget' : 'Add Widget'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── preset widget card (production presets) ──────────────────────────────────

function PresetWidgetCard({ title, chartType, color, footer, fetchData }: {
  title: string;
  chartType: ChartType;
  color: string;
  footer: string;
  fetchData: () => Promise<WidgetData>;
}) {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await fetchData());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card p-4 space-y-3 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{title}</p>
        <button onClick={load} title="Refresh" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
        {error && !loading && (
          <p className="text-xs text-red-500 text-center py-8">Failed to load data</p>
        )}
        {!loading && !error && data && (
          chartType === 'kpi' ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1">
              <p className="text-4xl font-bold" style={{ color }}>{data.kpiValue}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{data.kpiLabel}</p>
            </div>
          ) : (
            <WidgetChart data={data.chartData} chartType={chartType} color={color} />
          )
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2">
        <span>{footer}</span>
      </div>
    </div>
  );
}

// ── preset analytics tab ──────────────────────────────────────────────────────

function PresetAnalytics() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Pre-built charts for production material cost and consumption, updated live from your data.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PRODUCTION_PRESETS.map(p => (
          <PresetWidgetCard key={p.id} title={p.title} chartType={p.chartType} color={p.color} footer={p.footer} fetchData={p.fetcher} />
        ))}
      </div>
    </div>
  );
}

// ── custom analytics tab ──────────────────────────────────────────────────────

function CustomAnalytics({ warehouseId }: { warehouseId?: string }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      setWidgets(Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WIDGETS);
    } catch {
      setWidgets(DEFAULT_WIDGETS);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets)); } catch {}
  }, [widgets, loaded]);

  const handleSave = (data: Omit<Widget, 'id'>) => {
    if (editingWidget) {
      setWidgets(prev => prev.map(w => w.id === editingWidget.id ? { ...data, id: editingWidget.id } : w));
    } else {
      setWidgets(prev => [...prev, { ...data, id: Date.now().toString() }]);
    }
    setEditorOpen(false);
    setEditingWidget(undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Build your own dashboard. Widgets are saved in your browser.
        </p>
        <button
          onClick={() => { setEditingWidget(undefined); setEditorOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Widget
        </button>
      </div>

      {loaded && widgets.length === 0 && (
        <div className="card p-12 text-center space-y-3">
          <BarChart2 className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="font-medium text-gray-600 dark:text-gray-400">No widgets yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Click "Add Widget" to create your first chart or KPI card.</p>
          <button
            onClick={() => { setEditingWidget(undefined); setEditorOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          >
            <Plus className="h-4 w-4" />Add Widget
          </button>
        </div>
      )}

      {widgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {widgets.map(w => (
            <WidgetCard
              key={w.id}
              widget={w}
              editable={true}
              onRemove={(id) => setWidgets(prev => prev.filter(w => w.id !== id))}
              onEdit={(widget) => { setEditingWidget(widget); setEditorOpen(true); }}
              warehouseId={warehouseId ?? undefined}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <WidgetEditor
          initial={editingWidget}
          onSave={handleSave}
          onClose={() => { setEditorOpen(false); setEditingWidget(undefined); }}
        />
      )}
    </div>
  );
}

// ── main export ───────────────────────────────────────────────────────────────

export function AnalyticsBuilder({ warehouseId }: { warehouseId?: string }) {
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');

  return (
    <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6 mt-2">
      {/* Header + tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Visual charts and custom dashboards</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('preset')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'preset'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Preset Analytics
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'custom'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Wrench className="h-4 w-4" />
          Custom Builder
        </button>
      </div>

      {activeTab === 'preset' && <PresetAnalytics />}
      {activeTab === 'custom' && <CustomAnalytics warehouseId={warehouseId} />}
    </div>
  );
}
