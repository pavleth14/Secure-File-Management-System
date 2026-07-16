import { useState } from 'react';
import api from '../api/client';
import { useLeadSources } from '../hooks/useRecruitingData';

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function LeadSourcesPage() {
  const { sources, loading, error, reloadSources } = useLeadSources();
  const [newSource, setNewSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAddSource = async (event) => {
    event.preventDefault();
    const trimmed = newSource.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setActionError('');
    setSuccess('');

    try {
      await api.post('/recruiting/sources', { name: trimmed });
      setNewSource('');
      setSuccess(`Added source "${trimmed}".`);
      await reloadSources();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to add source');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lead Sources</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage lead sources available for import, boards, and lead creation.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {actionError}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          {success}
        </div>
      )}

      <form
        onSubmit={handleAddSource}
        className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Add New Source</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newSource}
            onChange={(event) => setNewSource(event.target.value)}
            placeholder="Source name"
            className={`${inputClass} flex-1`}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add source'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Loading sources...</td>
              </tr>
            ) : sources.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No sources found.</td>
              </tr>
            ) : (
              sources.map((source) => (
                <tr key={source}>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{source}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
