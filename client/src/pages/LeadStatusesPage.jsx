import { useState } from 'react';
import api from '../api/client';
import { useLeadStatuses } from '../hooks/useRecruitingData';

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function ActivityChoice({ value, onChange, name }) {
  return (
    <div className="flex flex-wrap gap-4">
      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="radio"
          name={name}
          checked={value === true}
          onChange={() => onChange(true)}
          className="border-slate-300 dark:border-slate-600"
        />
        Active
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="radio"
          name={name}
          checked={value === false}
          onChange={() => onChange(false)}
          className="border-slate-300 dark:border-slate-600"
        />
        Non-active
      </label>
    </div>
  );
}

export default function LeadStatusesPage() {
  const { statuses, loading, error, reloadStatuses } = useLeadStatuses();
  const [newStatus, setNewStatus] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAddStatus = async (event) => {
    event.preventDefault();
    const trimmed = newStatus.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setActionError('');
    setSuccess('');

    try {
      await api.post('/recruiting/statuses', { name: trimmed, isActive: newIsActive });
      setNewStatus('');
      setNewIsActive(true);
      setSuccess(`Added status "${trimmed}".`);
      await reloadStatuses();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to add status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStatus = async (status) => {
    if (!confirm(`Delete lead status "${status.name}"?`)) return;

    setDeletingId(status.id);
    setActionError('');
    setSuccess('');

    try {
      await api.delete(`/recruiting/statuses/${status.id}`);
      setSuccess(`Deleted status "${status.name}".`);
      await reloadStatuses();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to delete status');
    } finally {
      setDeletingId('');
    }
  };

  const handleUpdateActivity = async (status, isActive) => {
    if (status.isActive === isActive) return;

    setUpdatingId(status.id);
    setActionError('');
    setSuccess('');

    try {
      await api.patch(`/recruiting/statuses/${status.id}`, { isActive });
      setSuccess(`Updated "${status.name}" to ${isActive ? 'Active' : 'Non-active'}.`);
      await reloadStatuses();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lead Statuses</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage lead statuses and whether they appear in Active or Non-active board views.
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
        onSubmit={handleAddStatus}
        className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Add New Status
        </h2>
        <div className="space-y-4">
          <input
            type="text"
            value={newStatus}
            onChange={(event) => setNewStatus(event.target.value)}
            placeholder="Status name"
            className={`${inputClass} w-full`}
            required
          />
          <ActivityChoice
            name="new-status-activity"
            value={newIsActive}
            onChange={setNewIsActive}
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add status'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Board category
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  Loading statuses...
                </td>
              </tr>
            ) : statuses.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  No statuses found.
                </td>
              </tr>
            ) : (
              statuses.map((status) => (
                <tr key={status.id}>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    {status.name}
                    {status.isDefault && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        System
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ActivityChoice
                      name={`status-activity-${status.id}`}
                      value={status.isActive}
                      onChange={(isActive) => handleUpdateActivity(status, isActive)}
                    />
                    {updatingId === status.id && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saving...</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!status.isDefault && (
                      <button
                        type="button"
                        disabled={deletingId === status.id}
                        onClick={() => handleDeleteStatus(status)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                      >
                        {deletingId === status.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
