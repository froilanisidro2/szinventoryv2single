'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, Column } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { getPayments, getInvoices, getCustomers } from '@/app/actions';

interface EnrichedPayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference: string;
  notes?: string;
  created_at: string;
  invoiceNumber: string;
  customerName: string;
}

function fmt(n: number): string {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const getPaymentMethodBadge = (method: string) => {
  const colors: Record<string, string> = {
    cash: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    check: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    cheque: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    credit_card: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    bank_transfer: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    gcash: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return colors[method] || colors.other;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<EnrichedPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const [paymentsRes, invoicesRes, customersRes] = await Promise.all([
        getPayments(500),
        getInvoices(500),
        getCustomers(500),
      ]);

      const rawPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
      const invoices = Array.isArray(invoicesRes.data) ? invoicesRes.data : [];
      const customers = Array.isArray(customersRes.data) ? customersRes.data : [];

      const invoiceMap = new Map(invoices.map((inv: any) => [inv.id, inv]));
      const customerMap = new Map(customers.map((c: any) => [c.id, c.name]));

      const enriched: EnrichedPayment[] = rawPayments.map((p: any) => {
        const invoice = invoiceMap.get(p.invoice_id) as any;
        const customerName = invoice?.customer_id
          ? (customerMap.get(invoice.customer_id) ?? '—')
          : '—';
        return {
          id: p.id,
          invoice_id: p.invoice_id,
          amount: Number(p.amount) || 0,
          payment_method: p.payment_method ?? 'other',
          payment_date: p.payment_date || p.created_at,
          reference: p.reference ?? '—',
          notes: p.notes,
          created_at: p.created_at,
          invoiceNumber: invoice?.invoice_number ?? p.invoice_id ?? '—',
          customerName,
        };
      });

      setPayments(enriched);
    } catch (err) {
      console.error('Error loading payments:', err);
      toast.error('Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = methodFilter === 'all' || p.payment_method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const now = new Date();
  const thisMonthTotal = payments
    .filter((p) => {
      const d = new Date(p.payment_date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, p) => sum + p.amount, 0);
  const avgPayment = filteredPayments.length > 0 ? totalAmount / filteredPayments.length : 0;

  const uniqueMethods = [...new Set(payments.map((p) => p.payment_method))];

  const columns: Column<EnrichedPayment>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      sortable: true,
      render: (value) => (
        <span className="font-medium text-primary-600 dark:text-primary-400">{value}</span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      sortable: true,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (value) => (
        <span className="font-semibold text-gray-900 dark:text-white">{fmt(Number(value))}</span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (value) => (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getPaymentMethodBadge(value)}`}>
          {String(value).replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'payment_date',
      header: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('en-PH'),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (value) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">{value}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Payments
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track and manage payment records
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={loadPayments}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Link href="/payments/record">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Record Payment
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? '—' : filteredPayments.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {isLoading ? '—' : fmt(totalAmount)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">This Month</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? '—' : fmt(thisMonthTotal)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg. Payment</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? '—' : fmt(avgPayment)}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by invoice, customer, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Methods</option>
                  {uniqueMethods.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-flex h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Loading payments...</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredPayments}
            emptyMessage="No payments found."
          />
        )}
      </div>
    </div>
  );
}
