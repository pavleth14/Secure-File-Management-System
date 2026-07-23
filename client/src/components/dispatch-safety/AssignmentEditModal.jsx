import { useEffect, useState } from 'react';
import api from '../../api/client';
import { inputClass } from './SafetyListToolbar';

export default function AssignmentEditModal({ assignment, open, onClose, onSave, canEdit }) {
  const [drivers, setDrivers] = useState([]);
  const [dispatchers, setDispatchers] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [coDriverId, setCoDriverId] = useState('');
  const [dispatcherId, setDispatcherId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedDriver = drivers.find((driver) => driver.id === driverId);
  const needsCoDriver = selectedDriver?.isTeam;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadOptions() {
      try {
        const [driversRes, dispatchersRes] = await Promise.all([
          api.get('/dispatch/boards/active-drivers'),
          api.get('/dispatch/boards/dispatchers'),
        ]);
        if (!cancelled) {
          setDrivers(driversRes.data.drivers || []);
          setDispatchers(dispatchersRes.data.dispatchers || []);
        }
      } catch {
        if (!cancelled) {
          setDrivers([]);
          setDispatchers([]);
        }
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !assignment) return;
    setError('');
    setDriverId(assignment.driverId || '');
    setCoDriverId(assignment.coDriverId || '');
    setDispatcherId(assignment.dispatcherId || '');
  }, [open, assignment]);

  if (!open || !assignment) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit) return;

    if (needsCoDriver && !coDriverId) {
      setError('Co-driver is required for Team drivers');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        driverId: driverId || null,
        coDriverId: needsCoDriver ? coDriverId || null : null,
        dispatcherId: dispatcherId || null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Assignment — {assignment.truckNumber}
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Assign driver(s) and dispatcher for this truck.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Driver</label>
            <select
              value={driverId}
              onChange={(event) => {
                setDriverId(event.target.value);
                setCoDriverId('');
              }}
              disabled={!canEdit}
              className={inputClass}
            >
              <option value="">Unassigned</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} ({driver.driverType})
                </option>
              ))}
            </select>
          </div>

          {needsCoDriver && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Co-Driver
              </label>
              <select
                value={coDriverId}
                onChange={(event) => setCoDriverId(event.target.value)}
                disabled={!canEdit}
                className={inputClass}
                required
              >
                <option value="">Select co-driver</option>
                {drivers
                  .filter((driver) => driver.id !== driverId)
                  .map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dispatcher</label>
            <select
              value={dispatcherId}
              onChange={(event) => setDispatcherId(event.target.value)}
              disabled={!canEdit}
              className={inputClass}
            >
              <option value="">Unassigned</option>
              {dispatchers.map((dispatcher) => (
                <option key={dispatcher.id} value={dispatcher.id}>
                  {dispatcher.name}
                  {dispatcher.dispatchBoardName ? ` — ${dispatcher.dispatchBoardName}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {assignment.history?.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">History</h3>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              {[...assignment.history].reverse().map((entry) => (
                <div key={entry.id} className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{entry.action.replace(/_/g, ' ')}</span>
                  {' · '}
                  {entry.driverName || '—'}
                  {entry.coDriverName ? ` / ${entry.coDriverName}` : ''}
                  {entry.dispatcherName ? ` · ${entry.dispatcherName}` : ''}
                  {' · '}
                  {entry.changedByName || 'Unknown'}
                  {' · '}
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {canEdit && (
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {canEdit ? 'Cancel' : 'Close'}
          </button>
        </div>
      </form>
    </div>
  );
}
