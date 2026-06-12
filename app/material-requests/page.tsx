'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, ClipboardList, AlertCircle, Search, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getMaterialRequests, getCompanyUsers, updateMaterialRequestStatus } from '@/app/actions';
import type { MaterialRequest } from '@/types';

const URGENCY_LABELS: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_TABS = ['all', 'draft', 'pending_approval', 'approved', 'rejected', 'cancelled'] as const;

function downloadCSV(rows: MaterialRequest[], userMap: Record<string, string>) {
  const headers = ['MRF #', 'Date', 'Requestor', 'Urgency', 'Status', 'Notes'];
  const lines = rows.map(m => [
    m.mrf_number,
    new Date(m.created_at).toLocaleDateString(),
    m.requestor_user_id ? (userMap[m.requestor_user_id] || '') : '',
    URGENCY_LABELS[m.urgency_level] ?? m.urgency_level,
    STATUS_LABELS[m.status] ?? m.status,
    (m.notes ?? '').replace(/,/g, ' '),
  ]);
  const csv = [headers, ...lines].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `material-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MaterialRequestsPage() {
  const [mrfs, setMrfs] = useState<MaterialRequest[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [mrfsRes, usersRes] = await Promise.all([
        getMaterialRequests(),
        getCompanyUsers(),
      ]);
      if (mrfsRes.error) {
        toast.error('Failed to load material requests');
      } else {
        setMrfs(mrfsRes.data ?? []);
      }
      if (!usersRes.error) setUserMap(usersRes.data ?? {});
    } catch {
      toast.error('Error loading data');
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = activeTab === 'all' ? mrfs : mrfs.filter(m => m.status === activeTab);
    if (urgencyFilter) list = list.filter(m => m.urgency_level === urgencyFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.mrf_number.toLowerCase().includes(q) ||
        (m.requestor_user_id && (userMap[m.requestor_user_id] || '').toLowerCase().includes(q))
      );
    }
    return list;
  }, [mrfs, activeTab, urgencyFilter, search, userMap]);

  const hasActiveFilters = search || urgencyFilter;

  async function handleCancel(id: string) {
    if (!confirm('Cancel this material request?')) return;
    setCancellingId(id);
    try {
      const res = await updateMaterialRequestStatus(id, 'cancelled');
      if (res.error) {
        toast.error('Failed to cancel material request');
      } else {
        toast.success('Material request cancelled');
        setMrfs(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled' } : m));
      }
    } catch {
      toast.error('Error cancelling material request');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="flex-1 space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Material Requests</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Raise and track Material Request Forms (MRF)</p>
          </div>
        </div>
        <Link href="/material-requests/create">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab === 'all' ? 'All' : STATUS_LABELS[tab]}
            {tab !== 'all' && (
              <span className="ml-1 text-xs text-gray-400">
                ({mrfs.filter(m => m.status === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Filter + CSV */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search MRF # or requestor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={urgencyFilter}
          onChange={e => setUrgencyFilter(e.target.value)}
          className="py-2 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Urgencies</option>
          {Object.entries(URGENCY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setUrgencyFilter(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCSV(filtered, userMap)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No material requests found</p>
            <p className="text-sm mt-1">
              {hasActiveFilters ? 'Try adjusting your search or filters' : 'Create a new MRF to get started'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">MRF #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Requestor</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Urgency</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(mrf => (
                <tr key={mrf.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                    {mrf.mrf_number}
                    {mrf.job_order && (
                      <div className="text-xs font-sans font-normal text-amber-600 dark:text-amber-400">
                        from {mrf.job_order.jo_number}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {new Date(mrf.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {mrf.requestor_user_id ? (userMap[mrf.requestor_user_id] || '—') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_COLORS[mrf.urgency_level]}`}>
                      {URGENCY_LABELS[mrf.urgency_level]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[mrf.status]}`}>
                      {STATUS_LABELS[mrf.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/material-requests/${mrf.id}`}
                        className="text-primary-600 hover:underline dark:text-primary-400 text-xs font-medium"
                      >
                        View
                      </Link>
                      {(mrf.status === 'draft' || mrf.status === 'pending_approval') && (
                        <button
                          onClick={() => handleCancel(mrf.id)}
                          disabled={cancellingId === mrf.id}
                          className="text-red-600 hover:underline dark:text-red-400 text-xs font-medium disabled:opacity-50"
                        >
                          {cancellingId === mrf.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
