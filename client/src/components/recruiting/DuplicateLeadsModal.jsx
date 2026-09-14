import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { formatDate } from '../../utils/format';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent attempt' },
  { value: 'most', label: 'Most applications (highest count)' },
  { value: 'least', label: 'Fewest applications (lowest count)' },
];

function formatIngestionSource(value) {
  const labels = {
    manual: 'Manual',
    sheets: 'Google Sheets',
    csv_import: 'CSV import',
    old_lead: 'Old lead',
  };
  return labels[value] || value || '—';
}

export default function DuplicateLeadsModal({ open, onClose }) {
  const [duplicateLeads, setDuplicateLeads] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    sortOccurrences: 'recent',
  });

  const loadDuplicateLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/recruiting/duplicate-leads', {
        params: {
          page: filters.page,
          limit: filters.limit,
          sortOccurrences: filters.sortOccurrences,
        },
      });
      setDuplicateLeads(data.duplicateLeads || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load duplicate leads');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!open) return;
    loadDuplicateLeads();
  }, [open, loadDuplicateLeads]);

  useEffect(() => {
    if (!open) {
      setFilters({
        page: 1,
        limit: 50,
        sortOccurrences: 'recent',
      });
      setError('');
    }
  }, [open]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const response = await api.get('/recruiting/duplicate-leads/export', {
        params: { sortOccurrences: filters.sortOccurrences },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'duplicate-leads.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download CSV');
    } finally {
      setDownloading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-leads-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2
              id="duplicate-leads-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Duplicate Leads
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Rejected duplicate submissions are stored here and do not appear on the board.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm text-slate-600 dark:text-slate-400">
              Sort by
              <select
                value={filters.sortOccurrences}
                onChange={(event) => updateFilter('sortOccurrences', event.target.value)}
                className="mt-1 block w-full min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || loading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading ? 'Downloading...' : 'Download CSV'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading duplicate leads...</p>
          ) : duplicateLeads.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No duplicate leads found.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/40">
                <tr>
                  {[
                    'Times Applied',
                    'First Name',
                    'Last Name',
                    'Phone',
                    'Email',
                    'Source',
                    'Reason',
                    'Received',
                    'Matched Lead',
                  ].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {duplicateLeads.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
                      {row.submissionCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">{row.firstName}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">{row.lastName}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">{row.phone}</td>
                    <td className="px-3 py-2 text-sm">{row.email}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">
                      {formatIngestionSource(row.ingestionSource)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm capitalize">
                      {row.duplicateReason}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">
                      {formatDate(row.receivedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">
                      {row.matchedLead
                        ? `${row.matchedLead.firstName || ''} ${row.matchedLead.lastName || ''}`.trim()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {totalCount} duplicate attempt{totalCount !== 1 ? 's' : ''} · Page {filters.page} of{' '}
            {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={filters.page <= 1 || loading}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages || loading}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
