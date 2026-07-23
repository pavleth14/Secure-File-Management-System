import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import CategoryBadge from '../components/CategoryBadge';
import { formatDate } from '../utils/format';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'read', label: 'Read' },
  { value: 'upload', label: 'Upload' },
  { value: 'download', label: 'Download' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'move', label: 'Move' },
  { value: 'permissions', label: 'Permissions' },
  { value: 'users', label: 'Users' },
  { value: 'groups', label: 'Groups' },
  { value: 'folders', label: 'Folders' },
  { value: 'auth', label: 'Auth' },
  { value: 'system', label: 'System' },
  { value: 'recruiting', label: 'Recruiting' },
  { value: 'dispatch', label: 'Dispatch & Safety' },
];

const ALL_ROLE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'USER', label: 'User' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

const ADMIN_ROLE_FILTERS = [{ value: 'all', label: 'All users' }];

const DATE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const PAGE_SIZES = [25, 50, 100];

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  USER: 'User',
};

function getDateRange(preset, customStart, customEnd) {
  if (preset === 'all') return { startDate: '', endDate: '' };
  if (preset === 'custom') return { startDate: customStart, endDate: customEnd };

  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start;

  if (preset === 'today') {
    start = end;
  } else {
    const days = parseInt(preset, 10);
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    start = d.toISOString().split('T')[0];
  }

  return { startDate: start, endDate: end };
}

function buildQueryParams(filters) {
  const { startDate, endDate } = getDateRange(
    filters.datePreset,
    filters.customStart,
    filters.customEnd
  );

  const params = {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  };

  if (filters.search) params.search = filters.search;
  if (filters.category !== 'all') params.category = filters.category;
  if (filters.role !== 'all') params.role = filters.role;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  return params;
}

function hasActiveFilters(filters) {
  if (filters.search.trim()) return true;
  if (filters.category !== 'all') return true;
  if (filters.role !== 'all') return true;

  if (filters.datePreset === 'all') return false;
  if (filters.datePreset === 'custom') {
    return Boolean(filters.customStart || filters.customEnd);
  }

  return true;
}

export default function LogsPage() {
  const { isSuperAdmin } = useAuth();
  const roleFilters = isSuperAdmin ? ALL_ROLE_FILTERS : ADMIN_ROLE_FILTERS;

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    role: 'all',
    datePreset: 'all',
    customStart: '',
    customEnd: '',
    page: 1,
    limit: 25,
    sortBy: 'timestamp',
    sortDir: 'desc',
  });

  const [searchInput, setSearchInput] = useState('');

  const filtersActive = hasActiveFilters(filters);

  const loadLogs = useCallback(async () => {
    if (!hasActiveFilters(filters)) {
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/logs', { params: buildQueryParams(filters) });
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!hasActiveFilters(filters)) {
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    loadLogs();
  }, [filters, loadLogs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const toggleSort = (field) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortDir: prev.sortBy === field && prev.sortDir === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  };

  const sortIndicator = (field) => {
    if (filters.sortBy !== field) return '';
    return filters.sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const handleExport = async (format) => {
    if (!hasActiveFilters(filters)) {
      setError('Select filters before exporting logs.');
      return;
    }

    setExporting(true);
    try {
      const params = { ...buildQueryParams(filters), format };
      const response = await api.get('/logs/export', {
        params,
        responseType: 'blob',
      });

      const ext = format === 'csv' ? 'csv' : 'xlsx';
      const mime =
        format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([response.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${Date.now()}.${ext}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const openDetails = async (log) => {
    try {
      const { data } = await api.get(`/logs/${log.id}`);
      setSelectedLog(data.log);
    } catch {
      setSelectedLog(log);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isSuperAdmin
              ? 'Security and compliance audit trail for all system actions'
              : 'Audit trail of actions performed by regular user accounts'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={exporting || !filtersActive}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            disabled={exporting || !filtersActive}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Export Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}

      {!isSuperAdmin && (
        <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          You can view actions performed by regular users only. Admin and super admin activity is
          not visible in this view.
        </div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Search</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="🔎︎   Username, file, action, details..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Category</label>
            <select
              value={filters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Role</label>
            <select
              value={filters.role}
              onChange={(e) => updateFilter('role', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            >
              {roleFilters.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Date</label>
            <select
              value={filters.datePreset}
              onChange={(e) => updateFilter('datePreset', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            >
              {DATE_PRESETS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filters.datePreset === 'custom' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Start Date</label>
              <input
                type="date"
                value={filters.customStart}
                onChange={(e) => updateFilter('customStart', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">End Date</label>
              <input
                type="date"
                value={filters.customEnd}
                onChange={(e) => updateFilter('customEnd', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <SortHeader label="Time" field="timestamp" onSort={toggleSort} indicator={sortIndicator('timestamp')} />
                <SortHeader label="User" field="username" onSort={toggleSort} indicator={sortIndicator('username')} />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Role</th>
                <SortHeader label="Category" field="category" onSort={toggleSort} indicator={sortIndicator('category')} />
                <SortHeader label="Action" field="action" onSort={toggleSort} indicator={sortIndicator('action')} />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Target Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Target Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {!filtersActive ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Select filters to view logs.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No logs found matching your filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => openDetails(log)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{log.username}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {ROLE_LABELS[log.userRole] || log.userRole || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={log.category} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{log.action}</td>
                    <td className="px-4 py-3 text-sm capitalize text-slate-600 dark:text-slate-300">
                      {log.targetType || '—'}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {log.targetName || '—'}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 px-4 py-3 dark:border-slate-700 sm:flex-row">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtersActive
              ? `${total} record${total !== 1 ? 's' : ''} · Page ${filters.page} of ${totalPages}`
              : 'Select filters to view logs.'}
          </p>
          <div className="flex items-center gap-3">
            <select
              value={filters.limit}
              onChange={(e) => updateFilter('limit', parseInt(e.target.value, 10))}
              disabled={!filtersActive}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!filtersActive || filters.page <= 1}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!filtersActive || filters.page >= totalPages}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedLog && (
        <LogDetailsDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}

function SortHeader({ label, field, onSort, indicator }) {
  return (
    <th
      className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      onClick={() => onSort(field)}
    >
      {label}
      {indicator}
    </th>
  );
}

function LogDetailsDrawer({ log, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Log Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-6">
          <DetailRow label="Timestamp" value={formatDate(log.timestamp)} />
          <DetailRow label="User" value={log.username} />
          <DetailRow label="Role" value={ROLE_LABELS[log.userRole] || log.userRole || '—'} />
          <DetailRow label="Action" value={log.action} />
          <DetailRow label="Category" value={<CategoryBadge category={log.category} />} />
          <DetailRow label="Target Type" value={log.targetType || '—'} />
          <DetailRow label="Target ID" value={log.targetId || '—'} mono />
          <DetailRow label="Target Name" value={log.targetName || '—'} />
          <DetailRow label="IP Address" value={log.ipAddress || '—'} mono />
          <DetailRow label="User Agent" value={log.userAgent || '—'} />
          <DetailRow label="Details" value={log.details || '—'} />
          {log.oldValues && (
            <DetailRow
              label="Old Values"
              value={<pre className="whitespace-pre-wrap text-xs">{JSON.stringify(log.oldValues, null, 2)}</pre>}
            />
          )}
          {log.newValues && (
            <DetailRow
              label="New Values"
              value={<pre className="whitespace-pre-wrap text-xs">{JSON.stringify(log.newValues, null, 2)}</pre>}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm text-slate-900 dark:text-slate-100 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
