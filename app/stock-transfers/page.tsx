'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ArrowRightLeft, MapPin, Calendar, CheckCircle, XCircle, Download } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { toast } from 'sonner';
import { getStockTransfersWithDetails, completeStockTransfer, cancelStockTransfer, getStockTransferItems } from '@/app/actions';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  in_transit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  in_transit: 'In Transit',
  received: 'Received',
  cancelled: 'Cancelled',
};

export default function StockTransfersPage(): React.ReactElement {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => { loadTransfers(); }, []);

  const loadTransfers = async () => {
    setIsLoading(true);
    try {
      const res = await getStockTransfersWithDetails();
      const list: any[] = Array.isArray(res.data) ? res.data : [];
      setTransfers(list);
      // Load item counts for each transfer in parallel
      const counts: Record<string, number> = {};
      await Promise.all(list.map(async (t) => {
        const itemsRes = await getStockTransferItems(t.id);
        counts[t.id] = Array.isArray(itemsRes.data) ? itemsRes.data.length : 0;
      }));
      setItemCounts(counts);
    } catch {
      toast.error('Failed to load transfers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (id: string, transferNumber: string) => {
    if (!confirm(`Complete transfer ${transferNumber}? This will move stock between bins.`)) return;
    setActionLoading(id);
    try {
      const res = await completeStockTransfer(id);
      const err = res.error as any;
      if (err) {
        const msg = typeof err === 'string' ? err : err?.message || 'Unknown error';
        if (msg.startsWith('Completed with warnings')) {
          toast.warning(msg);
          await loadTransfers();
        } else {
          toast.error(msg);
        }
      } else {
        toast.success(`${transferNumber} completed — stock moved successfully`);
        await loadTransfers();
      }
    } catch {
      toast.error('Failed to complete transfer');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string, transferNumber: string) => {
    if (!confirm(`Cancel transfer ${transferNumber}?`)) return;
    setActionLoading(id);
    try {
      const res = await cancelStockTransfer(id);
      if (res.error) {
        toast.error(res.error.message);
      } else {
        toast.success(`${transferNumber} cancelled`);
        await loadTransfers();
      }
    } catch {
      toast.error('Failed to cancel transfer');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = transfers.filter((t) =>
    t.transfer_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.from_warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.to_warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const downloadCSV = () => {
    const headers = ['Transfer #', 'From Warehouse', 'To Warehouse', 'Transfer Date', 'Received Date', 'Status', 'Notes'];
    const rows = filtered.map(t => [
      t.transfer_number,
      t.from_warehouse_name || '',
      t.to_warehouse_name || '',
      t.transfer_date ? new Date(t.transfer_date).toLocaleDateString('en-PH') : '',
      t.received_date ? new Date(t.received_date).toLocaleDateString('en-PH') : '',
      statusLabel[t.status] || t.status,
      t.notes || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-transfers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Stock Transfers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Transfer inventory between warehouse locations ({transfers.length})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={downloadCSV}>CSV</Button>
          <Link href="/stock-transfers/create">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Create Transfer</Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by transfer number or warehouse..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Table + Summary */}
      <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0 card overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading transfers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Transfer #</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Route</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginated.map((transfer) => {
                  const isActing = actionLoading === transfer.id;
                  const canComplete = transfer.status === 'draft' || transfer.status === 'in_transit';
                  const canCancel = transfer.status === 'draft' || transfer.status === 'in_transit';
                  return (
                    <tr key={transfer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {transfer.transfer_number}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white">{transfer.from_warehouse_name}</span>
                          <ArrowRightLeft className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white">{transfer.to_warehouse_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {itemCounts[transfer.id] !== undefined && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                              {itemCounts[transfer.id]} item{itemCounts[transfer.id] !== 1 ? 's' : ''}
                            </span>
                          )}
                          {transfer.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{transfer.notes}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                          <Calendar className="h-4 w-4" />
                          {transfer.transfer_date
                            ? new Date(transfer.transfer_date).toLocaleDateString('en-PH')
                            : '—'}
                        </div>
                        {transfer.received_date && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                            Received: {new Date(transfer.received_date).toLocaleDateString('en-PH')}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[transfer.status] || statusColors.draft}`}>
                          {statusLabel[transfer.status] || transfer.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {canComplete && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isActing}
                              onClick={() => handleComplete(transfer.id, transfer.transfer_number)}
                              icon={<CheckCircle className="h-3.5 w-3.5" />}
                            >
                              {isActing ? 'Processing...' : 'Complete'}
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isActing}
                              onClick={() => handleCancel(transfer.id, transfer.transfer_number)}
                              icon={<XCircle className="h-3.5 w-3.5" />}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <ArrowRightLeft className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No stock transfers found</p>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
          />
        )}
      </div>

        {/* Summary */}
        <div className="w-52 shrink-0 card p-4 sticky top-4 self-start">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{transfers.length}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Draft</span>
              <span className="text-sm font-semibold text-gray-500">{transfers.filter((t) => t.status === 'draft').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">In Transit</span>
              <span className="text-sm font-semibold text-blue-600">{transfers.filter((t) => t.status === 'in_transit').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Received</span>
              <span className="text-sm font-semibold text-green-600">{transfers.filter((t) => t.status === 'received').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cancelled</span>
              <span className="text-sm font-semibold text-red-500">{transfers.filter((t) => t.status === 'cancelled').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
