'use client';

import { useState, useEffect } from 'react';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import Link from 'next/link';
import {
  Package, FileText, AlertCircle, Clock, ShoppingCart,
  ArrowRight, CheckCircle, Hammer,
  Warehouse, Plus, PackageCheck, Layers, Send, ClipboardCheck,
} from 'lucide-react';
import {
  getProducts,
  getLowStockProducts,
  getPurchaseOrders,
  getJobOrders,
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

const PO_STATUS_COLORS: Record<string, string> = {
  received: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  partially_received: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  sent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const JO_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

function Badge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorMap[status] ?? 'bg-gray-100 text-gray-600'}`}>
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
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [jobOrders, setJobOrders] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [mrfs, setMrfs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [prodsRes, lowStockRes, posRes, josRes, slRes, mrfRes] = await Promise.all([
          getProducts(1000, 0, wh),
          getLowStockProducts(),
          getPurchaseOrders(50, 0, wh),
          getJobOrders(),
          getStockLevels(500, 0, wh),
          getMaterialRequests(),
        ]);
        setProducts(Array.isArray(prodsRes.data) ? prodsRes.data : []);
        setLowStock(Array.isArray(lowStockRes.data) ? lowStockRes.data : []);
        setPurchaseOrders(Array.isArray(posRes.data) ? posRes.data : []);
        setJobOrders(Array.isArray(josRes.data) ? josRes.data : []);
        setStockLevels(Array.isArray(slRes.data) ? slRes.data : []);
        setMrfs(Array.isArray(mrfRes.data) ? mrfRes.data : []);
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  const productMap = new Map(products.map(p => [p.id, p]));

  const totalStockValue = stockLevels.reduce((sum, sl) => {
    const cost = productMap.get(sl.product_id)?.cost_price || 0;
    return sum + (Number(sl.quantity_on_hand || 0) * Number(cost));
  }, 0);

  const pendingPOs = purchaseOrders.filter(po => ['draft', 'sent', 'confirmed', 'partially_received'].includes(po.status));
  const receivedPOs = purchaseOrders.filter(po => po.status === 'received');

  const activeJOs = jobOrders.filter(j => ['approved', 'in_progress'].includes(j.status));
  const completedJOs = jobOrders.filter(j => j.status === 'completed');

  const approvedMRFs = mrfs.filter(m => m.status === 'approved');
  const pendingMRFs = mrfs.filter(m => ['draft', 'pending_approval'].includes(m.status));

  // Action board metrics
  const pendingPoMrfs = mrfs.filter(m => m.type === 'procurement' && m.status === 'pending_approval');
  const pendingJoMrfs = mrfs.filter(m => m.type === 'jo_mrf' && ['draft', 'pending_approval'].includes(m.status));
  const pendingApprovals = jobOrders.filter(j => j.status === 'pending_approval');
  const forReceived = purchaseOrders.filter(po => ['sent', 'confirmed', 'partially_received'].includes(po.status));
  const forIssuance = jobOrders.filter(j => j.status === 'approved');

  const recentPOs = purchaseOrders.slice(0, 5);
  const recentJOs = jobOrders.slice(0, 5);

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
          {selectedWarehouse ? `${fmtWarehouse(selectedWarehouse)} · Warehouse overview` : 'Business overview'}
        </p>
      </div>

      {/* Alerts */}
      {(lowStock.length > 0 || approvedMRFs.length > 0) && (
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
      )}

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
          title="Job Orders"
          value={jobOrders.length.toLocaleString()}
          sub={`${activeJOs.length} active · ${completedJOs.length} completed`}
          icon={<Hammer className="h-5 w-5" />}
          accent="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          href="/job-orders"
        />
      </div>

      {/* Action Board */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Link href="/material-requests?type=procurement&status=pending_approval" className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow border-l-4 border-purple-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending PO MRF</span>
            <Layers className="h-4 w-4 text-purple-400" />
          </div>
          <p className={`text-3xl font-bold ${pendingPoMrfs.length > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-300 dark:text-gray-600'}`}>
            {pendingPoMrfs.length}
          </p>
          <p className="text-xs text-gray-400">Awaiting approval</p>
        </Link>

        <Link href="/material-requests?type=jo_mrf" className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow border-l-4 border-amber-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">JO MRF</span>
            <Hammer className="h-4 w-4 text-amber-400" />
          </div>
          <p className={`text-3xl font-bold ${pendingJoMrfs.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}>
            {pendingJoMrfs.length}
          </p>
          <p className="text-xs text-gray-400">Pending action</p>
        </Link>

        <Link href="/job-orders?status=pending_approval" className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow border-l-4 border-yellow-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending Approvals</span>
            <ClipboardCheck className="h-4 w-4 text-yellow-400" />
          </div>
          <p className={`text-3xl font-bold ${pendingApprovals.length > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}>
            {pendingApprovals.length}
          </p>
          <p className="text-xs text-gray-400">Job orders</p>
        </Link>

        <Link href="/purchase-orders?status=pending_receipt" className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow border-l-4 border-blue-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">For Receiving</span>
            <PackageCheck className="h-4 w-4 text-blue-400" />
          </div>
          <p className={`text-3xl font-bold ${forReceived.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`}>
            {forReceived.length}
          </p>
          <p className="text-xs text-gray-400">Purchase orders</p>
        </Link>

        <Link href="/job-orders?status=approved" className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow border-l-4 border-teal-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">For Issuance</span>
            <Send className="h-4 w-4 text-teal-400" />
          </div>
          <p className={`text-3xl font-bold ${forIssuance.length > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-gray-300 dark:text-gray-600'}`}>
            {forIssuance.length}
          </p>
          <p className="text-xs text-gray-400">Approved JOs</p>
        </Link>
      </div>

      {/* Main content: Recent POs + Recent JOs */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent Purchase Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Purchase Orders</h2>
            <div className="flex items-center gap-3">
              <Link href="/purchase-orders/create" className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline">
                <Plus className="h-3 w-3" /> New
              </Link>
              <Link href="/purchase-orders" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
          {recentPOs.length === 0 ? (
            <div className="py-8 text-center">
              <ShoppingCart className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No purchase orders yet.</p>
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
                    <Badge status={po.status} colorMap={PO_STATUS_COLORS} />
                    <span className="font-semibold text-sm text-gray-900 dark:text-white hidden sm:block">
                      {fmt(Number(po.total_amount || 0))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Job Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Job Orders</h2>
            <div className="flex items-center gap-3">
              <Link href="/job-orders/create" className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline">
                <Plus className="h-3 w-3" /> New
              </Link>
              <Link href="/job-orders" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
          {recentJOs.length === 0 ? (
            <div className="py-8 text-center">
              <Hammer className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No job orders yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentJOs.map(jo => (
                <Link key={jo.id} href={`/job-orders/${jo.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-1 px-1 rounded transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white font-mono">{jo.jo_number}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[160px]">{jo.title || '—'} · {timeAgo(jo.created_at)}</p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <Badge status={jo.status} colorMap={JO_STATUS_COLORS} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Low Stock + Quick Actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Low Stock */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Low Stock</h2>
            <Link href="/inventory" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
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

        {/* Quick Actions + MRF summary */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/purchase-orders/create" className="btn-primary w-full text-sm text-center block">
                New Purchase Order
              </Link>
              <Link href="/job-orders/create" className="btn-secondary w-full text-sm text-center block">
                Create Job Order
              </Link>
              <Link href="/material-requests/create" className="btn-secondary w-full text-sm text-center block">
                Raise MRF
              </Link>
            </div>
          </div>

          {/* MRF status summary */}
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" /> MRF Status
            </h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Pending approval</span>
                <span className={`font-bold ${pendingMRFs.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{pendingMRFs.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Approved (awaiting PO)</span>
                <span className={`font-bold ${approvedMRFs.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{approvedMRFs.length}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5 flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Total MRFs</span>
                <span className="font-bold text-gray-700 dark:text-gray-300">{mrfs.length}</span>
              </div>
            </div>
            <Link href="/material-requests" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View all MRFs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
