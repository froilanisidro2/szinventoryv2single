'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Download, Filter, RefreshCw, Activity } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAuditLogs } from '@/app/actions';

interface AuditLog {
  id: string;
  created_at: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  description?: string;
  details?: string;
  notes?: string;
  ip_address?: string;
  status?: string;
  changes?: Record<string, any>;
}

function getActionColor(action: string): string {
  const a = action?.toLowerCase() ?? '';
  if (a.includes('create') || a.includes('add')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (a.includes('update') || a.includes('edit') || a.includes('adjust')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (a.includes('delete') || a.includes('remove') || a.includes('cancel')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (a.includes('login') || a.includes('logout') || a.includes('auth')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
  if (a.includes('fail') || a.includes('error')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const result = await getAuditLogs(200);
      if (!result.error && Array.isArray(result.data)) {
        setLogs(result.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const now = new Date();
  const filteredLogs = logs.filter((log) => {
    const text = [
      log.user_name,
      log.user_email,
      log.action,
      log.entity_type,
      log.entity_name,
      log.description,
      log.details,
      log.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (searchTerm && !text.includes(searchTerm.toLowerCase())) return false;
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;

    if (dateFilter !== 'all') {
      const logDate = new Date(log.created_at);
      if (dateFilter === 'today') {
        if (logDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (logDate < weekAgo) return false;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (logDate < monthAgo) return false;
      }
    }

    return true;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action).filter(Boolean))].sort();

  const handleExport = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity', 'Description', 'Status'];
    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toLocaleString(),
      log.user_name ?? log.user_email ?? log.user_id ?? '—',
      log.action,
      log.entity_type ?? '—',
      log.entity_name ?? log.entity_id ?? '—',
      log.description ?? log.details ?? log.notes ?? '—',
      log.status ?? '—',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${now.toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary-600" />
              Audit Logs
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track all system activities and changes in your company
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={loadLogs}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Logs</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredLogs.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Today</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {logs.filter((l) => new Date(l.created_at).toDateString() === now.toDateString()).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Actions</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{uniqueActions.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Unique Users</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {new Set(filteredLogs.map((l) => l.user_id ?? l.user_email)).size}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white text-sm">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search user, action, entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-flex h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || actionFilter !== 'all' || dateFilter !== 'all'
                ? 'No logs match your filters.'
                : 'No audit logs recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Timestamp</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Entity</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white text-xs">
                        {log.user_name ?? log.user_email ?? '—'}
                      </p>
                      {log.user_name && log.user_email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{log.user_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getActionColor(log.action)}`}
                      >
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.entity_type && (
                        <p className="font-medium text-gray-900 dark:text-white text-xs capitalize">
                          {log.entity_type.replace(/_/g, ' ')}
                        </p>
                      )}
                      {log.entity_name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                          {log.entity_name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs">
                      <p className="truncate text-xs">
                        {log.description ?? log.details ?? log.notes ?? '—'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
