'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, AlertTriangle, CheckCircle,
  Search, Filter, RefreshCw, Download, TrendingUp,
  Clock, XCircle, Building2, ChevronUp, ChevronDown,
  CreditCard, ChevronDown as ChevronDownIcon, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllInvoicesForAdmin,
  adminMarkInvoicePaid,
  adminUpdateInvoiceStatus,
  generateAllSubscriptionInvoices,
  markOverdueInvoices,
} from '@/app/actions';
import { getSuperAdminSession } from '@/lib/auth-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingInvoice {
  id: string;
  invoice_number: string;
  company_id: string;
  company_name: string;
  company_email: string;
  customer_name: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  invoice_date: string;
  due_date: string;
  days_overdue: number;
  created_at: string;
}

type SortKey = 'due_date' | 'company_name' | 'total_amount' | 'outstanding' | 'days_overdue' | 'status';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  paid:           { label: 'Paid',           cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',   icon: <CheckCircle className="h-3 w-3" /> },
  partially_paid: { label: 'Partial',         cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',      icon: <Clock className="h-3 w-3" /> },
  pending:        { label: 'Pending',         cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: <Clock className="h-3 w-3" /> },
  sent:           { label: 'Sent',            cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: <FileText className="h-3 w-3" /> },
  overdue:        { label: 'Overdue',         cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',          icon: <XCircle className="h-3 w-3" /> },
  draft:          { label: 'Draft',           cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',         icon: <FileText className="h-3 w-3" /> },
  cancelled:      { label: 'Cancelled',       cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',         icon: <XCircle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronUp className="h-3 w-3 text-gray-400 opacity-40" />;
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-primary-500" />
    : <ChevronDown className="h-3 w-3 text-primary-500" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminBillingPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('due_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isMounted, setIsMounted] = useState(false);

  // Cron actions
  const [isRunningBilling, setIsRunningBilling] = useState(false);
  const [isRunningOverdue, setIsRunningOverdue] = useState(false);
  const [lastCronResult, setLastCronResult] = useState<string | null>(null);

  // Mark as Paid modal
  const [payModal, setPayModal] = useState<BillingInvoice | null>(null);
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payNotes, setPayNotes] = useState('');
  const [isMarking, setIsMarking] = useState(false);

  // Status change
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (!getSuperAdminSession()?.isSuperAdmin) { router.push('/superadmin/login'); return; }
    load();
  }, [isMounted, router]);

  const load = async () => {
    try {
      setIsLoading(true);
      const res = await getAllInvoicesForAdmin(1000);
      if (res.error) { toast.error('Failed to load invoices'); return; }
      setInvoices(res.data ?? []);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    invoices.forEach((i) => { if (i.company_id) seen.set(i.company_id, i.company_name); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [invoices]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    let list = invoices;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.invoice_number?.toLowerCase().includes(q) ||
          i.company_name?.toLowerCase().includes(q) ||
          i.customer_name?.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter);
    if (companyFilter !== 'all') list = list.filter((i) => i.company_id === companyFilter);

    if (dateFilter === 'overdue') {
      list = list.filter((i) => i.status === 'overdue' || (i.days_overdue > 0 && i.status !== 'paid'));
    } else if (dateFilter === 'due_7') {
      list = list.filter((i) => {
        if (!i.due_date || i.status === 'paid') return false;
        const dd = new Date(i.due_date);
        const diff = Math.floor((dd.getTime() - today.getTime()) / 86400000);
        return diff >= 0 && diff <= 7;
      });
    } else if (dateFilter === 'due_30') {
      list = list.filter((i) => {
        if (!i.due_date || i.status === 'paid') return false;
        const dd = new Date(i.due_date);
        const diff = Math.floor((dd.getTime() - today.getTime()) / 86400000);
        return diff >= 0 && diff <= 30;
      });
    }

    return [...list].sort((a, b) => {
      let va: any = a[sortKey as keyof BillingInvoice];
      let vb: any = b[sortKey as keyof BillingInvoice];
      if (sortKey === 'due_date' || sortKey === 'company_name' || sortKey === 'status') {
        va = String(va ?? '');
        vb = String(vb ?? '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [invoices, search, statusFilter, companyFilter, dateFilter, sortKey, sortDir]);

  // ── KPI totals ────────────────────────────────────────────────────────────

  const kpi = useMemo(() => {
    const totalInvoiced = filtered.reduce((s, i) => s + i.total_amount, 0);
    const totalCollected = filtered.reduce((s, i) => s + i.paid_amount, 0);
    const totalOutstanding = filtered.reduce((s, i) => s + i.outstanding, 0);
    const overdueCount = filtered.filter(
      (i) => i.status === 'overdue' || (i.days_overdue > 0 && i.status !== 'paid'),
    ).length;
    const overdueAmount = filtered
      .filter((i) => i.status === 'overdue' || (i.days_overdue > 0 && i.status !== 'paid'))
      .reduce((s, i) => s + i.outstanding, 0);
    return { totalInvoiced, totalCollected, totalOutstanding, overdueCount, overdueAmount };
  }, [filtered]);

  // ── Cron triggers ────────────────────────────────────────────────────────

  const handleRunBilling = async () => {
    setIsRunningBilling(true);
    setLastCronResult(null);
    try {
      const summary = await generateAllSubscriptionInvoices();
      const msg = `✓ Billing run: ${summary.created} new invoice${summary.created !== 1 ? 's' : ''} created, ${summary.already_billed} already billed, ${summary.skipped} skipped${summary.errors > 0 ? `, ${summary.errors} errors` : ''}`;
      setLastCronResult(msg);
      toast.success(`${summary.created} subscription invoice${summary.created !== 1 ? 's' : ''} generated`);
      if (summary.created > 0) load(); // reload to show new invoices
    } catch {
      toast.error('Failed to run billing');
    } finally {
      setIsRunningBilling(false);
    }
  };

  const handleRunOverdue = async () => {
    setIsRunningOverdue(true);
    setLastCronResult(null);
    try {
      const result = await markOverdueInvoices();
      const msg = result.error
        ? `✗ Overdue marking failed: ${result.error}`
        : `✓ ${result.updated} invoice${result.updated !== 1 ? 's' : ''} marked as overdue`;
      setLastCronResult(msg);
      if (result.updated > 0) {
        toast.success(`${result.updated} invoices marked overdue`);
        load();
      } else {
        toast.info('No overdue invoices to update');
      }
    } catch {
      toast.error('Failed to mark overdue invoices');
    } finally {
      setIsRunningOverdue(false);
    }
  };

  // ── Mark as Paid ──────────────────────────────────────────────────────────

  const handleMarkPaid = async () => {
    if (!payModal) return;
    setIsMarking(true);
    try {
      const res = await adminMarkInvoicePaid(payModal.id, payMethod, payNotes || undefined);
      if (!res.ok) { toast.error(res.error ?? 'Failed to mark as paid'); return; }
      toast.success(`${payModal.invoice_number} marked as paid`);
      setPayModal(null);
      setPayNotes('');
      setPayMethod('bank_transfer');
      // Update local state immediately so UI reflects change without full reload
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === payModal.id
            ? { ...inv, status: 'paid', paid_amount: inv.total_amount, outstanding: 0, days_overdue: 0 }
            : inv
        )
      );
    } catch {
      toast.error('Unexpected error');
    } finally {
      setIsMarking(false);
    }
  };

  // ── Change Status ─────────────────────────────────────────────────────────

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    setIsUpdatingStatus(true);
    setStatusDropdown(null);
    try {
      const res = await adminUpdateInvoiceStatus(invoiceId, newStatus);
      if (!res.ok) { toast.error(res.error ?? 'Failed to update status'); return; }
      toast.success(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
      setInvoices((prev) =>
        prev.map((inv) => inv.id === invoiceId ? { ...inv, status: newStatus } : inv)
      );
    } catch {
      toast.error('Unexpected error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ── Sorting ───────────────────────────────────────────────────────────────

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const headers = ['Invoice #', 'Company', 'Customer', 'Status', 'Total', 'Paid', 'Outstanding', 'Due Date', 'Days Overdue'];
    const rows = filtered.map((i) => [
      i.invoice_number,
      i.company_name,
      i.customer_name,
      i.status,
      i.total_amount.toFixed(2),
      i.paid_amount.toFixed(2),
      i.outstanding.toFixed(2),
      i.due_date ? new Date(i.due_date).toLocaleDateString('en-PH') : '—',
      i.days_overdue > 0 ? String(i.days_overdue) : '—',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isMounted) return null;

  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap select-none cursor-pointer hover:text-gray-900 dark:hover:text-white';

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary-600" />
            Billing & Invoices
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            All invoices across every company — track dues and payments in one view
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Automation Controls ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Automated Billing Jobs
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Runs automatically daily via <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">/api/cron/billing</code> and <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">/api/cron/overdue</code>. Use buttons to run manually.
            </p>
            {lastCronResult && (
              <p className={`text-xs mt-1 font-medium ${lastCronResult.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {lastCronResult}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleRunBilling}
              disabled={isRunningBilling || isRunningOverdue}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <FileText className={`h-3.5 w-3.5 ${isRunningBilling ? 'animate-spin' : ''}`} />
              {isRunningBilling ? 'Generating…' : 'Generate Invoices Now'}
            </button>
            <button
              onClick={handleRunOverdue}
              disabled={isRunningBilling || isRunningOverdue}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${isRunningOverdue ? 'animate-spin' : ''}`} />
              {isRunningOverdue ? 'Running…' : 'Mark Overdue Now'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Invoiced',    value: fmt(kpi.totalInvoiced),    icon: FileText,      bg: 'bg-blue-100 dark:bg-blue-900/30',   ic: 'text-blue-600 dark:text-blue-400' },
          { label: 'Collected',         value: fmt(kpi.totalCollected),   icon: CheckCircle,   bg: 'bg-green-100 dark:bg-green-900/30', ic: 'text-green-600 dark:text-green-400' },
          { label: 'Outstanding',       value: fmt(kpi.totalOutstanding), icon: TrendingUp,    bg: 'bg-yellow-100 dark:bg-yellow-900/30', ic: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Overdue Amount',    value: fmt(kpi.overdueAmount),    icon: AlertTriangle, bg: 'bg-red-100 dark:bg-red-900/30',    ic: 'text-red-600 dark:text-red-400' },
          { label: 'Overdue Invoices',  value: kpi.overdueCount,          icon: XCircle,       bg: 'bg-red-100 dark:bg-red-900/30',    ic: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, icon: Icon, bg, ic }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
              <div className={`h-7 w-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${ic}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} of {invoices.length} invoices</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Invoice #, company, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Company */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Companies</option>
            {companies.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="draft">Draft</option>
          </select>

          {/* Due date range */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Dates</option>
            <option value="overdue">Already Overdue</option>
            <option value="due_7">Due in 7 Days</option>
            <option value="due_30">Due in 30 Days</option>
          </select>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="inline-flex h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading invoices…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No invoices match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className={thClass} onClick={() => handleSort('company_name')}>
                    <div className="flex items-center gap-1">Company <SortIcon active={sortKey === 'company_name'} dir={sortDir} /></div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Customer</th>
                  <th className={thClass} onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <SortIcon active={sortKey === 'status'} dir={sortDir} /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('total_amount')}>
                    <div className="flex items-center gap-1 justify-end">Total <SortIcon active={sortKey === 'total_amount'} dir={sortDir} /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('outstanding')}>
                    <div className="flex items-center gap-1 justify-end">Outstanding <SortIcon active={sortKey === 'outstanding'} dir={sortDir} /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('due_date')}>
                    <div className="flex items-center gap-1">Due Date <SortIcon active={sortKey === 'due_date'} dir={sortDir} /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort('days_overdue')}>
                    <div className="flex items-center gap-1">Overdue <SortIcon active={sortKey === 'days_overdue'} dir={sortDir} /></div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((inv) => {
                  const isOverdue = inv.days_overdue > 0 && inv.status !== 'paid';
                  const isDueSoon = !isOverdue && inv.due_date && (() => {
                    const dd = new Date(inv.due_date);
                    const diff = Math.floor((dd.getTime() - today.getTime()) / 86400000);
                    return diff >= 0 && diff <= 7;
                  })() && inv.status !== 'paid';

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                        isOverdue
                          ? 'bg-red-50/40 dark:bg-red-900/10'
                          : isDueSoon
                          ? 'bg-yellow-50/40 dark:bg-yellow-900/10'
                          : ''
                      }`}
                    >
                      {/* Company */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-xs truncate max-w-[140px]">{inv.company_name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[140px]">{inv.company_email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Invoice # */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">
                            {inv.invoice_number}
                          </span>
                          {inv.invoice_number?.startsWith('SUB-') && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 leading-none">
                              SUB
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700 dark:text-gray-300 max-w-[120px] block truncate">{inv.customer_name}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{fmt(inv.total_amount)}</span>
                        {inv.paid_amount > 0 && inv.paid_amount < inv.total_amount && (
                          <p className="text-xs text-green-600 dark:text-green-400">+{fmt(inv.paid_amount)} paid</p>
                        )}
                      </td>

                      {/* Outstanding */}
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-bold ${inv.outstanding > 0 ? (isOverdue ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400') : 'text-green-600 dark:text-green-400'}`}>
                          {inv.outstanding > 0 ? fmt(inv.outstanding) : '✓ Paid'}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3">
                        {inv.due_date ? (
                          <div>
                            <p className={`text-xs font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : isDueSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {new Date(inv.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Days Overdue */}
                      <td className="px-4 py-3">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            {inv.days_overdue}d
                          </span>
                        ) : isDueSoon ? (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                            Due soon
                          </span>
                        ) : inv.status === 'paid' ? (
                          <span className="text-xs text-green-500">—</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Mark as Paid — only for unpaid invoices */}
                          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <button
                              onClick={() => { setPayModal(inv); setPayNotes(''); setPayMethod('bank_transfer'); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors whitespace-nowrap"
                            >
                              <CreditCard className="h-3 w-3" />
                              Mark Paid
                            </button>
                          )}

                          {/* Status change dropdown */}
                          <div className="relative">
                            <button
                              onClick={() => setStatusDropdown(statusDropdown === inv.id ? null : inv.id)}
                              disabled={isUpdatingStatus}
                              className="inline-flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors"
                              title="Change status"
                            >
                              <ChevronDownIcon className="h-3.5 w-3.5" />
                            </button>
                            {statusDropdown === inv.id && (
                              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                                <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                                  Change Status
                                </p>
                                {['paid', 'pending', 'sent', 'partially_paid', 'overdue', 'cancelled'].map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => handleStatusChange(inv.id, s)}
                                    disabled={inv.status === s}
                                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                      inv.status === s
                                        ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-gray-700/50'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    <StatusBadge status={s} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</span>
            <span>
              Total outstanding: <strong className="text-gray-900 dark:text-white">{fmt(kpi.totalOutstanding)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* ── Click-away to close status dropdown ───────────────────────────── */}
      {statusDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setStatusDropdown(null)} />
      )}

      {/* ── Mark as Paid Modal ────────────────────────────────────────────── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Mark as Paid</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{payModal.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => setPayModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Invoice summary */}
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Company</span>
                  <span className="font-medium text-gray-900 dark:text-white">{payModal.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Customer</span>
                  <span className="font-medium text-gray-900 dark:text-white">{payModal.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Amount</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{fmt(payModal.total_amount)}</span>
                </div>
                {payModal.paid_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Already Paid</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">{fmt(payModal.paid_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Outstanding</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{fmt(payModal.outstanding)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="gcash">GCash</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Payment received via bank transfer ref# 12345"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                This will set the invoice to <strong>Paid</strong> and record a full payment of <strong>{fmt(payModal.outstanding)}</strong>.
              </p>
            </div>

            {/* Modal actions */}
            <div className="flex gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setPayModal(null)}
                disabled={isMarking}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={isMarking}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isMarking ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
