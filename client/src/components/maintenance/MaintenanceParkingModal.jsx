import { useEffect, useState } from 'react';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function emptyForm() {
  return {
    unitNumber: '',
    startDate: '',
    endDate: '',
    timeLabel: '',
    address: '',
    amount: '',
    status: 'Local Weekly',
    note: '',
  };
}

function toForm(record) {
  if (!record) return emptyForm();
  return {
    unitNumber: record.unitNumber || '',
    startDate: record.startDate ? record.startDate.slice(0, 10) : '',
    endDate: record.endDate ? record.endDate.slice(0, 10) : '',
    timeLabel: record.timeLabel || '',
    address: record.address || '',
    amount: record.amount != null && record.amount !== '' ? String(record.amount) : '',
    status: record.status || 'Local Weekly',
    note: record.note || '',
  };
}

export default function MaintenanceParkingModal({
  open,
  onClose,
  record,
  readOnly,
  canDelete,
  statuses,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(toForm(record));
    setError('');
    setSaving(false);
  }, [open, record]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        unitNumber: form.unitNumber.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        timeLabel: form.timeLabel.trim(),
        address: form.address.trim(),
        amount: form.amount === '' ? null : Number(form.amount),
        status: form.status,
        note: form.note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <form
        className="my-8 w-full max-w-2xl rounded-xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold">
            {record ? (readOnly ? 'View parking' : 'Edit parking') : 'New parking'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {record?.parkingExpiresToday && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
              Parking ends <strong>today</strong>.
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">Unit #</label>
            <input
              className={inputClass}
              required
              readOnly={readOnly}
              value={form.unitNumber}
              onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
              placeholder="Truck or trailer number"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Start date
              </label>
              <input
                type="date"
                className={inputClass}
                readOnly={readOnly}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                End date
              </label>
              <input
                type="date"
                className={inputClass}
                readOnly={readOnly}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">Time</label>
            <input
              className={inputClass}
              readOnly={readOnly}
              value={form.timeLabel}
              onChange={(e) => setForm({ ...form, timeLabel: e.target.value })}
              placeholder="e.g. 2:30 PM"
            />
            <p className="mt-1 text-xs text-slate-500">Use 12-hour format with AM or PM</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Address
            </label>
            <input
              className={inputClass}
              readOnly={readOnly}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                readOnly={readOnly}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Status
              </label>
              <select
                className={inputClass}
                disabled={readOnly}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Info / note
            </label>
            <textarea
              className={inputClass}
              rows={3}
              readOnly={readOnly}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4 dark:border-slate-700">
          {canDelete && record ? (
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => onDelete(record.id)}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
              Close
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}