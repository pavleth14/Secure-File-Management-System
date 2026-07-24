import { useEffect, useState } from 'react';
import api from '../../api/client';
import { inputClass } from './SafetyListToolbar';
import { emptyLoadForm, StopFields, Field } from './LoadStopFields';
import LoadCommentsSection from './LoadCommentsSection';

export default function LoadFormModal({
  load,
  open,
  onClose,
  onSave,
  onArchive,
  onMarkActive,
  onMarkOpen,
  onMarkDelivered,
  canEdit,
  canArchive,
  canMarkStatus,
  canComment,
}) {
  const [form, setForm] = useState(emptyLoadForm());
  const [options, setOptions] = useState({ trucks: [], trailers: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadOptions() {
      try {
        const { data } = await api.get('/dispatch/loads/options');
        if (!cancelled) setOptions(data);
      } catch {
        if (!cancelled) setOptions({ trucks: [], trailers: [] });
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError('');

    if (load) {
      setForm({
        customer: load.customer || '',
        contact: load.contact || '',
        customerLoadNumber: load.customerLoadNumber || '',
        invoiceAmount: String(load.invoiceAmount ?? ''),
        pickups: load.pickups?.length
          ? load.pickups.map((stop) => ({
              date: stop.date || '',
              time: stop.time || '',
              address: stop.address || '',
              city: stop.city || '',
              state: stop.state || '',
            }))
          : emptyLoadForm().pickups,
        deliveries: load.deliveries?.length
          ? load.deliveries.map((stop) => ({
              date: stop.date || '',
              time: stop.time || '',
              address: stop.address || '',
              city: stop.city || '',
              state: stop.state || '',
            }))
          : emptyLoadForm().deliveries,
        truckId: load.truckId || '',
        trailerId: load.trailerId || '',
        driverId: load.driverId || '',
        coDriverId: load.coDriverId || '',
        loadedMiles: String(load.loadedMiles ?? ''),
        emptyMiles: String(load.emptyMiles ?? ''),
      });
      setComments(load.comments || []);
    } else {
      setForm(emptyLoadForm());
      setComments([]);
    }
  }, [open, load]);

  const selectedTruck = options.trucks.find((truck) => truck.id === form.truckId);
  const assignment = selectedTruck?.assignment;
  const showCoDriver = Boolean(form.coDriverId || assignment?.coDriverId || assignment?.driverType === 'Team');

  useEffect(() => {
    if (!open || !form.truckId || !assignment) return;
    setForm((current) => ({
      ...current,
      driverId: assignment.driverId || current.driverId,
      coDriverId: assignment.coDriverId || current.coDriverId,
    }));
  }, [form.truckId, assignment, open]);

  if (!open) return null;

  const readOnly = !canEdit || load?.archived;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        driverId: form.driverId || assignment?.driverId || '',
        coDriverId: form.coDriverId || assignment?.coDriverId || null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save load');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {load ? `Load #${load.loadNumber}` : 'New Load'}
            </h2>
            {load?.boardLabel && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{load.boardLabel}</p>
            )}
          </div>
          {load && canMarkStatus && !load.archived && (
            <div className="flex flex-wrap gap-2">
              {load.status === 'delivered' ? (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkActive?.(load)}
                    className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/20"
                  >
                    Mark Active
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkOpen?.(load)}
                    className="rounded-lg border border-yellow-300 px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/20"
                  >
                    Mark Open
                  </button>
                </>
              ) : load.isActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkOpen?.(load)}
                    className="rounded-lg border border-yellow-300 px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/20"
                  >
                    Mark Open
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkDelivered?.(load)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Mark Delivered
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkActive?.(load)}
                    className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/20"
                  >
                    Mark Active
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkDelivered?.(load)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Mark Delivered
                  </button>
                </>
              )}
              {canArchive && (
                <button
                  type="button"
                  onClick={() => onArchive?.(load)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  Archive
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer" value={form.customer} onChange={(v) => setForm({ ...form, customer: v })} readOnly={readOnly} required />
          <Field label="Contact" value={form.contact} onChange={(v) => setForm({ ...form, contact: v })} readOnly={readOnly} required />
          <Field label="Customer Load#" value={form.customerLoadNumber} onChange={(v) => setForm({ ...form, customerLoadNumber: v })} readOnly={readOnly} required />
          <Field label="Invoice Amount (USD)" type="number" min="0" step="0.01" value={form.invoiceAmount} onChange={(v) => setForm({ ...form, invoiceAmount: v })} readOnly={readOnly} required />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Pick ups</h3>
            <StopFields
              stops={form.pickups}
              label="Pick up"
              readOnly={readOnly}
              onChange={(pickups) => setForm({ ...form, pickups })}
            />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Deliveries</h3>
            <StopFields
              stops={form.deliveries}
              label="Delivery"
              readOnly={readOnly}
              onChange={(deliveries) => setForm({ ...form, deliveries })}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Truck#</label>
            <select
              value={form.truckId}
              onChange={(event) => setForm({ ...form, truckId: event.target.value })}
              disabled={readOnly}
              required
              className={inputClass}
            >
              <option value="">Select truck</option>
              {options.trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.truckNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Trailer#</label>
            <select
              value={form.trailerId}
              onChange={(event) => setForm({ ...form, trailerId: event.target.value })}
              disabled={readOnly}
              required
              className={inputClass}
            >
              <option value="">Select trailer</option>
              {options.trailers.map((trailer) => (
                <option key={trailer.id} value={trailer.id}>
                  {trailer.trailerNumber}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Driver(s)"
            value={
              assignment?.coDriverName
                ? `${assignment.driverName || ''} / ${assignment.coDriverName}`
                : assignment?.driverName || load?.driverLabel || '—'
            }
            onChange={() => {}}
            readOnly
          />
          {showCoDriver && assignment?.coDriverName && (
            <Field label="Co-Driver" value={assignment.coDriverName} onChange={() => {}} readOnly />
          )}
          <Field label="Loaded Miles" type="number" min="0" step="0.1" value={form.loadedMiles} onChange={(v) => setForm({ ...form, loadedMiles: v })} readOnly={readOnly} required />
          <Field label="Empty Miles" type="number" min="0" step="0.1" value={form.emptyMiles} onChange={(v) => setForm({ ...form, emptyMiles: v })} readOnly={readOnly} required />
        </div>

        {load?.assignmentHistory?.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Assignment history</h3>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              {[...load.assignmentHistory].reverse().map((entry) => (
                <div key={entry.id} className="text-xs text-slate-600 dark:text-slate-300">
                  {entry.truckNumber || '—'} · {entry.trailerNumber || '—'} · {entry.driverName || '—'}
                  {entry.coDriverName ? ` / ${entry.coDriverName}` : ''} · {entry.changedByName || 'Unknown'} ·{' '}
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        {load && canComment && (
          <LoadCommentsSection
            loadId={load.id}
            comments={comments}
            onCommentsChange={setComments}
          />
        )}

        <div className="mt-6 flex gap-2">
          {canEdit && !load?.archived && (
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
            {canEdit && !load?.archived ? 'Cancel' : 'Close'}
          </button>
        </div>
      </form>
    </div>
  );
}
