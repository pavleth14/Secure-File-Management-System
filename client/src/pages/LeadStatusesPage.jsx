import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useLeadStatuses } from '../hooks/useRecruitingData';
import { DEFAULT_STATUS_COLOR } from '../utils/leadStatusColors';
import LeadStatusIndicator from '../components/recruiting/LeadStatusIndicator';

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function ActivityChoice({ value, onChange, name, disabled = false }) {
  return (
    <div className="flex flex-wrap gap-4">
      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="radio"
          name={name}
          checked={value === true}
          onChange={() => onChange(true)}
          disabled={disabled}
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
          disabled={disabled}
          className="border-slate-300 dark:border-slate-600"
        />
        Non-active
      </label>
    </div>
  );
}

function ColorPicker({ value, onChange, disabled = false, id, fallbackColor = DEFAULT_STATUS_COLOR }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallbackColor}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        disabled={disabled}
        className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
        aria-label="Status color"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => {
          const next = event.target.value.trim();
          if (/^#[0-9A-Fa-f]{0,6}$/.test(next)) {
            onChange(next.toUpperCase());
          }
        }}
        onBlur={() => {
          if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
            onChange(fallbackColor);
          }
        }}
        disabled={disabled}
        className={`${inputClass} w-28 font-mono uppercase`}
        maxLength={7}
        spellCheck={false}
      />
    </div>
  );
}

function StatusColorField({ status, disabled, onSave, onDraftChange }) {
  const [color, setColor] = useState(status.color);
  const isDirty = color !== status.color;
  const isValid = /^#[0-9A-Fa-f]{6}$/.test(color);

  useEffect(() => {
    setColor(status.color);
  }, [status.color]);

  useEffect(() => {
    onDraftChange(status.id, isDirty && isValid ? color : null);
  }, [status.id, color, isDirty, isValid, onDraftChange]);

  const handleSave = () => {
    if (isValid && isDirty) {
      onSave(status, color);
    }
  };

  const handleCancel = () => {
    setColor(status.color);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ColorPicker
        id={`status-color-${status.id}`}
        value={color}
        onChange={setColor}
        fallbackColor={status.color}
        disabled={disabled}
      />
      {isDirty && (
        <>
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || !isValid}
            className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={disabled}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

export default function LeadStatusesPage() {
  const { statuses, loading, error, reloadStatuses } = useLeadStatuses();
  const [newStatus, setNewStatus] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newColor, setNewColor] = useState(DEFAULT_STATUS_COLOR);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [colorUpdatingId, setColorUpdatingId] = useState('');
  const [draftColors, setDraftColors] = useState({});
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAddStatus = async (event) => {
    event.preventDefault();
    const trimmed = newStatus.trim();
    if (!trimmed) return;

    if (!/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      setActionError('Please choose a valid color.');
      return;
    }

    setSubmitting(true);
    setActionError('');
    setSuccess('');

    try {
      await api.post('/recruiting/statuses', {
        name: trimmed,
        isActive: newIsActive,
        color: newColor,
      });
      setNewStatus('');
      setNewIsActive(true);
      setNewColor(DEFAULT_STATUS_COLOR);
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

  const handleUpdateColor = async (status, color) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color) || color === status.color) return;

    setColorUpdatingId(status.id);
    setActionError('');
    setSuccess('');

    try {
      await api.patch(`/recruiting/statuses/${status.id}`, { color });
      setSuccess(`Updated color for "${status.name}".`);
      await reloadStatuses();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update status color');
    } finally {
      setColorUpdatingId('');
    }
  };

  const handleDraftColorChange = useCallback((statusId, color) => {
    setDraftColors((prev) => {
      if (color === null) {
        if (!(statusId in prev)) return prev;
        const next = { ...prev };
        delete next[statusId];
        return next;
      }
      if (prev[statusId] === color) return prev;
      return { ...prev, [statusId]: color };
    });
  }, []);

  const previewColorMap = useMemo(() => {
    const map = Object.fromEntries(statuses.map((status) => [status.name, status.color]));
    for (const status of statuses) {
      const draft = draftColors[status.id];
      if (draft) {
        map[status.name] = draft;
      }
    }
    return map;
  }, [statuses, draftColors]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lead Statuses</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage lead statuses, board category, and color indicators shown on recruiter boards.
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
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Color</p>
            <ColorPicker
              id="new-status-color"
              value={newColor}
              onChange={setNewColor}
            />
          </div>
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
                Color
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
                <td colSpan={4} className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  Loading statuses...
                </td>
              </tr>
            ) : statuses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  No statuses found.
                </td>
              </tr>
            ) : (
              statuses.map((status) => (
                <tr key={status.id}>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    <div className="inline-flex flex-wrap items-center gap-2">
                      <LeadStatusIndicator
                        statusName={status.name}
                        statusColorMap={previewColorMap}
                      />
                      {status.isDefault && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          System
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusColorField
                      status={status}
                      disabled={colorUpdatingId === status.id}
                      onSave={handleUpdateColor}
                      onDraftChange={handleDraftColorChange}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ActivityChoice
                      name={`status-activity-${status.id}`}
                      value={status.isActive}
                      onChange={(isActive) => handleUpdateActivity(status, isActive)}
                      disabled={updatingId === status.id}
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
