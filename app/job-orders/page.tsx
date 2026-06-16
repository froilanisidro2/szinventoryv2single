'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Hammer, AlertCircle, Search, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getJobOrders } from '@/app/actions';
import type { JobOrder } from '@/types';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_OPTIONS = ['all', 'pending_approval', 'approved', 'in_progress', 'completed'] as const;

function downloadCSV(rows: JobOrder[]) {
  const headers = ['JO #', 'Title', 'Priority', 'Status', 'Production Lead', 'Start Date', 'Target Date'];
  const lines = rows.map(j => [
    j.jo_number,
    `"${(j.title ?? '').replace(/"/g, '""')}"`,
    PRIORITY_LABELS[j.priority] ?? j.priority,
    STATUS_LABELS[j.status] ?? j.status,
    j.production_lead ?? '',
    j.start_date ? new Date(j.start_date).toLocaleDateString() : '',
    j.target_completion_date ? new Date(j.target_completion_date).toLocaleDateString() : '',
  ]);
  const csv = [headers, ...lines].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function JobOrdersPage() {
  const [jobs, setJobs] = useState<JobOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const jobsRes = await getJobOrders();
      if (jobsRes.error) toast.error('Failed to load job orders');
      else setJobs(jobsRes.data ?? []);
    } catch {
      toast.error('Error loading data');
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = statusFilter === 'all' ? jobs : jobs.filter(j => j.status === statusFilter);
    if (priorityFilter) list = list.filter(j => j.priority === priorityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(j =>
        j.jo_number.toLowerCase().includes(q) ||
        (j.title ?? '').toLowerCase().includes(q) ||
        (j.production_lead ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, statusFilter, priorityFilter, search]);

  const hasActiveFilters = search || priorityFilter || statusFilter !== 'all';

  return (
    <div className="flex-1 space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Hammer className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Job Orders</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage production job orders and material usage</p>
          </div>
        </div>
        <Link href="/job-orders/create">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Job Order
          </Button>
        </Link>
      </div>

      {/* Search + Filter + CSV */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search JO #, title, or lead..."
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
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="py-2 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt} value={opt}>
              {opt === 'all' ? 'All Statuses' : STATUS_LABELS[opt]}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="py-2 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setPriorityFilter(''); setStatusFilter('all'); }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No job orders found</p>
            {hasActiveFilters && (
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">JO #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Title</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Priority</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Production Lead</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Start Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Target Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(job => (
                <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                    {job.jo_number}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs truncate">
                    {job.title}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[job.priority]}`}>
                      {job.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                      {STATUS_LABELS[job.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {job.production_lead || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {job.start_date
                      ? new Date(job.start_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {job.target_completion_date
                      ? new Date(job.target_completion_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/job-orders/${job.id}`}
                      className="text-primary-600 hover:underline dark:text-primary-400 text-xs font-medium"
                    >
                      View
                    </Link>
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
