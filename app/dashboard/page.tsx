'use client';

import { useState, useEffect } from 'react';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import Link from 'next/link';
import {
  Package, FileText, AlertCircle, Clock, ShoppingCart,
  ArrowRight, CheckCircle, XCircle, Hammer,
  BarChart3, Warehouse,
} from 'lucide-react';
import {
  getProducts,
  getInvoices,
  getLowStockProducts,
  getPurchaseOrders,
  getSalesOrders,
  getStockLevels,
  getMaterialRequests,
} from '@/app/actions';
import { useWarehouse } from '@/contexts/warehouse-context';

function fmt(n: number): string {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(dateStr: string | Date | undefined): string {
  if (!dateStr) return '—';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (days > 1) return `${days}d ago`;
  if (days === 1) return 'yesterday';
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  partially_paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  sent: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  partially_received: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  in_progress: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function StatCard({ title, value, sub, icon, accent, href }: {
  title: string; value: string; sub: string;
  icon: React.ReactNode; accent: string; href?: string;
}) {
  const inner = (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>
        </div>
        <div className={`rounded-lg p-2.5 flex-shrink-0 ml-3 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
  return href
    ? <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link>
    : inner;
}

export default function DashboardPage() {
  const { selectedWarehouseId, selectedWarehouse } = useWarehouse();
  const wh = selectedWarehouseId || undefined;

  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [mrfs, setMrfs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [prodsRes, invoicesRes, lowStockRes, posRes, sosRes, slRes, mrfRes] = await Promise.all([
          getProducts(1000, 0, wh),
          getInvoices(50, 0, wh),
          getLowStockProducts(),
          getPurchaseOrders(50, 0, wh),
          getSalesOrders(50, 0, wh),
          getStockLevels(500, 0, wh),
          getMaterialRequests(),
        ]);
        setProducts(Array.isArray(prodsRes.data) ? prodsRes.data : []);
        setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
        setLowStock(Array.isArray(lowStockRes.data) ? lowStockRes.data : []);
        setPurchaseOrders(Array.isArray(posRes.data) ? posRes.data : []);
        setSalesOrders(Array.isArray(sosRes.data) ? sosRes.data : []);
        setStockLevels(Array.isArray(slRes.data) ? slRes.data : []);
        setMrfs(Array.isArray(mrfRes.data) ? mrfRes.data : []);
      } catch {
        // silently fail — dashboard is non-critical
      } finally {
        setIsLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  // ── Derived metrics ──

  const productMap = new Map(products.map(p => [p.id, p]));

  // Total stock value from stock_levels × product cost_price
  const totalStockValue = stockLevels.reduce((sum, sl) => {
    const cost = productMap.get(sl.product_id)?.cost_price || 0;
    return sum + (Number(sl.quantity_on_hand || 0) * Number(cost));
  }, 0);

  // All invoices (PO + SO) — recent 5
  const recentInvoices = invoices.slice(0, 5);

  const overdueInvoices = invoices.filter(i => i.status === 'overdue');

  // Total invoiced value (paid + partially_paid)
  const totalPaid = invoices
    .filter(i => ['paid', 'partially_paid'].includes(i.status))
    .reduce((s, i) => s + Number(i.total_amount || 0), 0);

  // PO stats
  const pendingPOs = purchaseOrders.filter(po => ['draft', 'sent', 'confirmed', 'partially_received'].includes(po.status));
  const receivedPOs = purchaseOrders.filter(po => po.status === 'received');
  const totalPOValue = purchaseOrders.reduce((s, po) => s + Number(po.total_amount || 0), 0);

  // SO stats
  const pendingSOs = salesOrders.filter(so => ['draft', 'confirmed', 'partially_shipped'].includes(so.status));

  // MRF stats
  const pendingMRFs = mrfs.filter(m => ['draft', 'pending_approval'].includes(m.status));
  const approvedMRFs = mrfs.filter(m => m.status === 'approved');

  // Recent POs (last 5)
  const recentPOs = purchaseOrders.slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
          <p className="mt-3 text-gray-500 dark:text-gray-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {selectedWarehouse ? `📦 ${fmtWarehouse(selectedWarehouse)} · Warehouse overview` : "Business overview"}
        </p>
      </div>

      {/* Alerts */}
      <div className="flex flex-col gap-2">
        {lowStock.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-900/20 px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <p className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">
              <strong>{lowStock.length}</strong> product{lowStock.length !== 1 ? 's' : ''} below reorder level
            </p>
            <Link href="/inventory" className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 hover:underline flex-shrink-0">View →</Link>
          </div>
        )}
        {overdueInvoices.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 px-4 py-3 flex items-center gap-3">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="flex-1 text-sm text-red-800 dark:text-red-200">
              <strong>{overdueInvoices.length}</strong> invoice{overdueInvoices.length !== 1 ? 's' : ''} overdue
            </p>
            <Link href="/invoices" className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline flex-shrink-0">View →</Link>
          </div>
        )}
        {approvedMRFs.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20 px-4 py-3 flex items-center gap-3">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <p className="flex-1 text-sm text-blue-800 dark:text-blue-200">
              <strong>{approvedMRFs.length}</strong> approved MRF{approvedMRFs.length !== 1 ? 's' : ''} awaiting PO creation
            </p>
            <Link href="/material-requests" className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline flex-shrink-0">View →</Link>
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={products.length.toLocaleString()}
          sub={`${products.filter(p => p.status === 'active').length} active`}
          icon={<Package className="h-5 w-5" />}
          accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          href="/products"
        />
        <StatCard
          title="Stock Value"
          value={fmt(totalStockValue)}
          sub={`${stockLevels.length} SKU${stockLevels.length !== 1 ? 's' : ''} tracked`}
          icon={<Warehouse className="h-5 w-5" />}
          accent="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          href="/inventory"
        />
        <StatCard
          title="Purchase Orders"
          value={purchaseOrders.length.toLocaleString()}
          sub={`${pendingPOs.length} pending · ${receivedPOs.length} received`}
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          href="/purchase-orders"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStock.length.toLocaleString()}
          sub={lowStock.length > 0 ? 'Needs restocking' : 'All levels OK'}
          icon={<AlertCircle className="h-5 w-5" />}
          accent={lowStock.length > 0 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}
          href="/inventory"
        />
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Recent Purchase Orders */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Purchase Orders</h2>
            <Link href="/purchase-orders" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentPOs.length === 0 ? (
            <div className="py-8 text-center">
              <ShoppingCart className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No purchase orders yet.</p>
              <Link href="/purchase-orders/create" className="mt-2 inline-block text-xs text-primary-600 dark:text-primary-400 hover:underline">Create your first PO</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentPOs.map(po => (
                <Link key={po.id} href={`/purchase-orders/${po.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-1 px-1 rounded transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white font-mono">{po.po_number}</p>
                    <p className="text-xs text-gray-400">{timeAgo(po.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <Badge status={po.status} />
                    <span className="font-semibold text-sm text-gray-900 dark:text-white hidden sm:block">
                      {fmt(Number(po.total_amount || 0))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Quick actions + summaries */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/purchase-orders/create" className="btn-primary w-full text-sm text-center block">
                New Purchase Order
              </Link>
              <Link href="/material-requests/create" className="btn-secondary w-full text-sm text-center block">
                Raise MRF
              </Link>
              <Link href="/job-orders/create" className="btn-secondary w-full text-sm text-center block">
                Create Job Order
              </Link>
              <Link href="/reports-analytics" className="btn-secondary w-full text-sm text-center block">
                View Analytics
              </Link>
            </div>
          </div>

          {/* PO + SO + MRF summary */}
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Activity Summary</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5" />PO Pending</span>
                <span className={`font-bold ${pendingPOs.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{pendingPOs.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" />PO Received</span>
                <span className="font-bold text-green-600">{receivedPOs.length}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Sales Orders</span>
                  <span className={`font-bold ${pendingSOs.length > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>{salesOrders.length}</span>
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Hammer className="h-3.5 w-3.5" />MRF Pending</span>
                  <span className={`font-bold ${pendingMRFs.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{pendingMRFs.length}</span>
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total PO Value</span>
                  <span className="font-bold text-gray-900 dark:text-white text-xs">{fmt(totalPOValue)}</span>
                </div>
                {totalPaid > 0 && (
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-gray-500 dark:text-gray-400">Invoices Paid</span>
                    <span className="font-bold text-green-600 text-xs">{fmt(totalPaid)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices + Low Stock row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent Invoices — all types */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Invoices</h2>
            <Link href="/invoices" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No invoices yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-gray-900 dark:text-white">{inv.invoice_number}</p>
                    <p className="text-xs text-gray-400">
                      {inv.order_type === 'purchase_order' ? 'PO Invoice' : inv.order_type === 'sales_order' ? 'SO Invoice' : 'Invoice'} · {timeAgo(inv.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <Badge status={inv.status} />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white hidden sm:block">
                      {fmt(Number(inv.total_amount || 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Products */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Low Stock</h2>
            <Link href="/inventory" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              All stock levels are healthy
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {(lowStock as any[]).slice(0, 6).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">
                      {Number(item.quantity_on_hand ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">/ {Number(item.reorder_level ?? 0).toLocaleString()} min</p>
                  </div>
                </div>
              ))}
              {lowStock.length > 6 && (
                <p className="pt-2 text-xs text-center text-gray-400">+{lowStock.length - 6} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Analytics teaser */}
      <div className="card p-5 bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-100 dark:bg-primary-900/30 p-2">
              <BarChart3 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="font-semibold text-primary-900 dark:text-primary-200">Business Analytics</p>
              <p className="text-sm text-primary-700 dark:text-primary-400">Revenue trends, inventory value, PO analysis and more.</p>
            </div>
          </div>
          <Link href="/reports-analytics" className="btn-primary flex-shrink-0 text-sm">View Analytics</Link>
        </div>
      </div>
    </div>
  );
}
