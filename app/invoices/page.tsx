'use client';

import { useEffect, useState, Fragment } from 'react';
import { Plus, Search, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, CreditCard, X, Ban, Truck, Printer } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import {
  getInvoices,
  getCustomers,
  getPaymentsByInvoice,
  recordInvoicePayment,
  updateInvoiceStatus,
  getInvoiceItems,
} from '@/app/actions';
import type { Invoice, Customer } from '@/types';
import { useWarehouse } from '@/contexts/warehouse-context';

const STATUS_COLOR: Record<string, string> = {
  draft:          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  pending:        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  sent:           'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  partially_paid: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  paid:           'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  overdue:        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled:      'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  paid:    <CheckCircle className="h-3.5 w-3.5" />,
  overdue: <AlertCircle className="h-3.5 w-3.5" />,
  pending: <Clock className="h-3.5 w-3.5" />,
  sent:    <Clock className="h-3.5 w-3.5" />,
};

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card', 'gcash', 'other'];

function formatPeso(v: number) {
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[status] ?? STATUS_COLOR.draft}`}>
      {STATUS_ICON[status]}
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

interface PaymentForm {
  amount: string;
  method: string;
  reference: string;
  notes: string;
}

export default function SalesInvoicesPage() {
  const { selectedWarehouseId, warehouses } = useWarehouse();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, any[]>>({});
  const [invoiceItems, setInvoiceItems] = useState<Record<string, any[]>>({});
  const [paymentsLoading, setPaymentsLoading] = useState<string | null>(null);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentForm>({ amount: '', method: 'cash', reference: '', notes: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [selectedWarehouseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const wh = selectedWarehouseId || undefined;
      const [invRes, custRes] = await Promise.all([getInvoices(100, 0, wh), getCustomers()]);
      if (!invRes.error && invRes.data) {
        const all = Array.isArray(invRes.data) ? invRes.data : [];
        setInvoices(all.filter((i: any) => i.order_type === 'sales_order'));
      }
      if (!custRes.error && custRes.data) setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const customerName = (id?: string) => customers.find(c => c.id === id)?.name ?? '—';

  const toggleExpand = async (invoiceId: string) => {
    if (expandedId === invoiceId) { setExpandedId(null); return; }
    setExpandedId(invoiceId);

    // Load payments and line items together if not cached
    const needsPayments = !payments[invoiceId];
    const needsItems = !invoiceItems[invoiceId];

    if (needsPayments || needsItems) {
      setPaymentsLoading(invoiceId);
      const fetches = await Promise.all([
        needsPayments ? getPaymentsByInvoice(invoiceId) : Promise.resolve(null),
        needsItems ? getInvoiceItems(invoiceId) : Promise.resolve(null),
      ]);
      if (fetches[0]) setPayments(prev => ({ ...prev, [invoiceId]: Array.isArray(fetches[0]!.data) ? fetches[0]!.data : [] }));
      if (fetches[1]) setInvoiceItems(prev => ({ ...prev, [invoiceId]: Array.isArray(fetches[1]!.data) ? fetches[1]!.data : [] }));
      setPaymentsLoading(null);
    }
  };

  const openPayForm = (invoiceId: string, balance: number) => {
    setPayingId(invoiceId);
    setForm({ amount: balance.toFixed(2), method: 'cash', reference: '', notes: '' });
  };

  const handleRecord = async (invoice: Invoice) => {
    const amount = parseFloat(form.amount);
    const total = parseFloat(String(invoice.total_amount || 0));
    const paid = parseFloat(String(invoice.amount_paid || 0));
    const balance = total - paid;

    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > balance + 0.01) { toast.error(`Amount exceeds balance of ${formatPeso(balance)}`); return; }

    // Read clientUserId from storage as fallback for recorded_by_id
    let clientUserId: string | undefined;
    try {
      const raw = sessionStorage.getItem('user') ?? localStorage.getItem('user');
      if (raw) clientUserId = JSON.parse(raw)?.id;
    } catch { /* ignore */ }

    setSubmitting(true);
    try {
      const res = await recordInvoicePayment(invoice.id, amount, form.method, form.reference, form.notes, clientUserId);
      if (res.error) { toast.error((res.error as any).message || 'Failed to record payment'); return; }
      toast.success('Payment recorded');
      setPayingId(null);
      // Refresh payment list for this invoice
      const payRes = await getPaymentsByInvoice(invoice.id);
      setPayments(prev => ({ ...prev, [invoice.id]: Array.isArray(payRes.data) ? payRes.data : [] }));
      await loadData();
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (invoice: Invoice) => {
    if (!confirm(`Cancel invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    setCancellingId(invoice.id);
    try {
      const res = await updateInvoiceStatus(invoice.id, 'cancelled');
      if (res.error) { toast.error('Failed to cancel invoice'); return; }
      toast.success(`Invoice ${invoice.invoice_number} cancelled`);
      await loadData();
      if (expandedId === invoice.id) setExpandedId(null);
    } catch {
      toast.error('Failed to cancel invoice');
    } finally {
      setCancellingId(null);
    }
  };

  const handlePrint = async (invoice: Invoice) => {
    // Ensure line items are loaded
    let items = invoiceItems[invoice.id];
    if (!items) {
      const res = await getInvoiceItems(invoice.id);
      items = Array.isArray(res.data) ? res.data : [];
      setInvoiceItems(prev => ({ ...prev, [invoice.id]: items as any[] }));
    }

    const customer = customerName(invoice.customer_id);
    const issueDate = (invoice as any).issue_date ? new Date((invoice as any).issue_date).toLocaleDateString('en-PH') : '—';
    const dueDate   = (invoice as any).due_date   ? new Date((invoice as any).due_date).toLocaleDateString('en-PH')   : '—';
    const delivDate = (invoice as any).delivery_date ? new Date((invoice as any).delivery_date).toLocaleDateString('en-PH') : '—';
    const total     = parseFloat(String(invoice.total_amount || 0));
    const paid      = parseFloat(String(invoice.amount_paid  || 0));
    const balance   = Math.max(0, total - paid);
    const fmt = (v: number) => '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const itemRows = items.map((item: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.description || item.product_name || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(parseFloat(item.unit_price || 0))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.tax_rate ? item.tax_rate + '%' : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmt(parseFloat(item.line_total || item.quantity * item.unit_price || 0))}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .brand { font-size: 22px; font-weight: 700; color: #1d4ed8; }
    .inv-title { font-size: 28px; font-weight: 800; color: #111827; text-align: right; }
    .inv-number { font-size: 14px; color: #6b7280; text-align: right; margin-top: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .meta-block label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; font-weight: 600; }
    .meta-block p { font-size: 14px; color: #111827; margin-top: 2px; font-weight: 500; }
    .dates { display: flex; gap: 32px; margin-bottom: 28px; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .dates div label { font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; }
    .dates div p { font-size: 14px; font-weight: 600; color: #111827; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #1d4ed8; color: #fff; }
    thead th { padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: .04em; }
    thead th:not(:first-child) { text-align: right; }
    thead th:nth-child(2) { text-align: center; }
    tbody tr:hover { background: #f9fafb; }
    .totals { display: flex; justify-content: flex-end; }
    .totals table { width: 280px; }
    .totals td { padding: 6px 12px; font-size: 14px; }
    .totals .total-row td { font-size: 16px; font-weight: 700; border-top: 2px solid #1d4ed8; color: #1d4ed8; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #dbeafe; color: #1d4ed8; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">SZ Inventory</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">Sales Invoice</div>
    </div>
    <div>
      <div class="inv-title">INVOICE</div>
      <div class="inv-number">${invoice.invoice_number}</div>
      <div style="margin-top:8px;"><span class="status-badge">${invoice.status?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-block">
      <label>Bill To</label>
      <p>${customer}</p>
    </div>
    <div class="meta-block" style="text-align:right;">
      <label>Payment Terms</label>
      <p>${(invoice as any).payment_terms || 'Net 30'}</p>
    </div>
  </div>

  <div class="dates">
    <div><label>Issue Date</label><p>${issueDate}</p></div>
    <div><label>Due Date</label><p>${dueDate}</p></div>
    <div><label>Delivery Date</label><p>${delivDate}</p></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Tax</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#9ca3af;">No line items</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td style="text-align:right;">${fmt(parseFloat(String((invoice as any).subtotal || 0)))}</td></tr>
      <tr><td>Tax</td><td style="text-align:right;">${fmt(parseFloat(String((invoice as any).tax_amount || 0)))}</td></tr>
      <tr><td>Discount</td><td style="text-align:right;">${fmt(parseFloat(String((invoice as any).discount_amount || 0)))}</td></tr>
      <tr class="total-row"><td>Total</td><td style="text-align:right;">${fmt(total)}</td></tr>
      <tr><td style="color:#16a34a;">Paid</td><td style="text-align:right;color:#16a34a;">${fmt(paid)}</td></tr>
      <tr><td style="color:#dc2626;font-weight:600;">Balance Due</td><td style="text-align:right;color:#dc2626;font-weight:600;">${fmt(balance)}</td></tr>
    </table>
  </div>

  ${(invoice as any).notes ? `<div style="margin-top:24px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#374151;"><strong>Notes:</strong> ${(invoice as any).notes}</div>` : ''}

  <div class="footer">Thank you for your business · Generated ${new Date().toLocaleDateString('en-PH')}</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=850,height=1100');
    if (!win) { toast.error('Pop-up blocked — allow pop-ups to print'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const filtered = invoices.filter(inv => {
    const name = customerName(inv.customer_id).toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = inv.invoice_number.toLowerCase().includes(q) || name.includes(q);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    pending: invoices.filter(i => ['pending', 'sent', 'partially_paid'].includes(i.status)).length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    totalValue: invoices.reduce((s, i) => s + parseFloat(String(i.total_amount || 0)), 0),
    collected: invoices.reduce((s, i) => s + parseFloat(String(i.amount_paid || 0)), 0),
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Sales Invoices</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedWarehouseId && warehouses.length > 0
              ? `📦 ${fmtWarehouse(warehouses.find(w => w.id === selectedWarehouseId)) || 'Selected Warehouse'} · ${filtered.length} invoices`
              : `Manage invoices and record payments (${filtered.length})`}
          </p>
        </div>
        <Link href="/invoices/create">
          <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Create Invoice</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            placeholder="Search invoice # or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'pending', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Table + Summary */}
      <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0 card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading invoices...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 w-6"></th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Invoice #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Due Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Delivery Date</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Balance</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-400">No invoices found</td>
                  </tr>
                ) : filtered.map(invoice => {
                  const total   = parseFloat(String(invoice.total_amount || 0));
                  const paid    = parseFloat(String(invoice.amount_paid  || 0));
                  const balance = Math.max(0, total - paid);
                  const canPay  = balance > 0.001 && !['cancelled', 'paid'].includes(invoice.status);
                  const canCancel = !['cancelled', 'paid'].includes(invoice.status);
                  const isExpanded = expandedId === invoice.id;
                  const isPaying   = payingId   === invoice.id;
                  const isCancelling = cancellingId === invoice.id;

                  const issueDate = (invoice as any).issue_date || (invoice as any).invoice_date;
                  const dueDate = (invoice as any).due_date;
                  const deliveryDate = (invoice as any).delivery_date;

                  return (
                    <Fragment key={invoice.id}>
                      {/* Main row */}
                      <tr
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${isExpanded ? 'bg-gray-50 dark:bg-gray-800/40' : ''}`}
                        onClick={() => toggleExpand(invoice.id)}
                      >
                        <td className="px-4 py-3 text-gray-400">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-primary-600 dark:text-primary-400">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{customerName(invoice.customer_id)}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {issueDate ? new Date(issueDate).toLocaleDateString('en-PH') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {dueDate ? new Date(dueDate).toLocaleDateString('en-PH') : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {deliveryDate ? (
                            <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-medium text-sm">
                              <Truck className="h-3.5 w-3.5" />
                              {new Date(deliveryDate).toLocaleDateString('en-PH')}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{formatPeso(total)}</td>
                        <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{formatPeso(paid)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${balance > 0.001 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                          {formatPeso(balance)}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={invoice.status} /></td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {canPay && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<CreditCard className="h-3.5 w-3.5" />}
                                onClick={() => { openPayForm(invoice.id, balance); setExpandedId(invoice.id); }}
                              >
                                Pay
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Printer className="h-3.5 w-3.5" />}
                              onClick={() => handlePrint(invoice)}
                              title="Print invoice"
                            >
                              Print
                            </Button>
                            {canCancel && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isCancelling}
                                icon={<Ban className="h-3.5 w-3.5" />}
                                onClick={() => handleCancel(invoice)}
                              >
                                {isCancelling ? '...' : 'Cancel'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr className="bg-blue-50/50 dark:bg-gray-800/60">
                          <td colSpan={11} className="px-6 py-4">
                            <div className="space-y-5">

                              {/* Record Payment Form */}
                              {isPaying && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-primary-200 dark:border-primary-800 p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                      <CreditCard className="h-4 w-4 text-primary-600" />
                                      Record Payment — {invoice.invoice_number}
                                    </h4>
                                    <button onClick={() => setPayingId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Amount (₱) <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={form.amount}
                                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Method</label>
                                      <select
                                        value={form.method}
                                        onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                      >
                                        {PAYMENT_METHODS.map(m => (
                                          <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Reference #</label>
                                      <input
                                        type="text"
                                        value={form.reference}
                                        onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                                        placeholder="Ref / check #..."
                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                                      <input
                                        type="text"
                                        value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Optional notes..."
                                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-3 flex items-center gap-2">
                                    <Button variant="primary" size="sm" disabled={submitting} onClick={() => handleRecord(invoice)}>
                                      {submitting ? 'Saving...' : 'Save Payment'}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setPayingId(null)}>Cancel</Button>
                                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                                      Balance: <strong className="text-red-600 dark:text-red-400">{formatPeso(balance)}</strong>
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Invoice Meta */}
                              <div className="flex flex-wrap gap-4 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Invoice Date</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {issueDate ? new Date(issueDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {dueDate ? new Date(dueDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Delivery Date</p>
                                  <p className={`font-medium flex items-center gap-1 ${deliveryDate ? 'text-green-700 dark:text-green-400' : 'text-gray-400'}`}>
                                    <Truck className="h-3.5 w-3.5" />
                                    {deliveryDate
                                      ? new Date(deliveryDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                                      : 'Not recorded'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Payment Terms</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{(invoice as any).payment_terms || 'N/A'}</p>
                                </div>
                              </div>

                              {/* Invoice Line Items */}
                              <div>
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Line Items</p>
                                {paymentsLoading === invoice.id ? (
                                  <p className="text-xs text-gray-400">Loading...</p>
                                ) : (invoiceItems[invoice.id] ?? []).length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No line items found.</p>
                                ) : (
                                  <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                                    <table className="w-full text-xs">
                                      <thead className="bg-gray-100 dark:bg-gray-700">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Description</th>
                                          <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Qty</th>
                                          <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Unit Price</th>
                                          <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Line Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {(invoiceItems[invoice.id] ?? []).map((item: any) => (
                                          <tr key={item.id} className="hover:bg-white dark:hover:bg-gray-800">
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.description || '—'}</td>
                                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{item.quantity}</td>
                                            <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                              {formatPeso(parseFloat(String(item.unit_price || 0)))}
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">
                                              {formatPeso(parseFloat(String(item.line_total || item.quantity * item.unit_price || 0)))}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* Payment History */}
                              <div>
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Payment History</p>
                                {paymentsLoading === invoice.id ? (
                                  <p className="text-xs text-gray-400">Loading...</p>
                                ) : (payments[invoice.id] ?? []).length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No payments recorded yet.</p>
                                ) : (
                                  <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                                    <table className="w-full text-xs">
                                      <thead className="bg-gray-100 dark:bg-gray-700">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Method</th>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Reference</th>
                                          <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">Amount</th>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Notes</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {(payments[invoice.id] ?? []).map((p: any) => (
                                          <tr key={p.id} className="hover:bg-white dark:hover:bg-gray-800">
                                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                                              {new Date(p.payment_date || p.created_at).toLocaleDateString('en-PH')}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                {(p.payment_method || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.transaction_reference || '—'}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-green-600 dark:text-green-400">
                                              {formatPeso(parseFloat(String(p.amount || 0)))}
                                            </td>
                                            <td className="px-3 py-2 text-gray-400">{p.notes || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
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
          </div>
        )}
      </div>

        {/* Summary */}
        <div className="w-52 shrink-0 card p-4 sticky top-4 self-start">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.total}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Paid</span>
              <span className="text-sm font-semibold text-green-600">{stats.paid}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Pending</span>
              <span className="text-sm font-semibold text-yellow-600">{stats.pending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Overdue</span>
              <span className="text-sm font-semibold text-red-600">{stats.overdue}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total Billed</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{formatPeso(stats.totalValue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Collected</p>
              <p className="text-sm font-bold text-green-600">{formatPeso(stats.collected)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
