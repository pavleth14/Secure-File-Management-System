import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/client';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const wheelSelectClass =
  'max-h-36 min-h-[9rem] w-full overflow-y-auto rounded-lg border border-slate-300 bg-white px-1 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const MERIDIEMS = ['AM', 'PM'];

function parseTimeLabel(label) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(label || '').trim());
  if (!match) {
    return { hour: '', minute: '00', meridiem: 'AM' };
  }
  return {
    hour: String(Number(match[1])),
    minute: String(Number(match[2])).padStart(2, '0'),
    meridiem: match[3].toUpperCase(),
  };
}

function buildTimeLabel(hour, minute, meridiem) {
  if (!hour || minute === '' || !meridiem) return '';
  return `${Number(hour)}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function emptyForm() {
  return {
    unitNumber: '',
    startDate: '',
    endDate: '',
    timeHour: '',
    timeMinute: '00',
    timeMeridiem: 'AM',
    address: '',
    amount: '',
    status: 'Local Weekly',
    note: '',
  };
}

function toForm(record) {
  if (!record) return emptyForm();
  const { hour, minute, meridiem } = parseTimeLabel(record.timeLabel);
  return {
    unitNumber: record.unitNumber || '',
    startDate: record.startDate ? record.startDate.slice(0, 10) : '',
    endDate: record.endDate ? record.endDate.slice(0, 10) : '',
    timeHour: hour,
    timeMinute: minute,
    timeMeridiem: meridiem,
    address: record.address || '',
    amount: record.amount != null && record.amount !== '' ? String(record.amount) : '',
    status: record.status || 'Local Weekly',
    note: record.note || '',
  };
}

function unitStartsWith(unitNumber, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return false;
  return String(unitNumber || '').toLowerCase().startsWith(q);
}

function ParkingUnitSearch({ value, onChange, readOnly }) {
  const [query, setQuery] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const searchUnits = useCallback(async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const [truckRes, trailerRes] = await Promise.all([
        api.get('/dispatch/trucks', { params: { search: trimmed } }),
        api.get('/dispatch/trailers', { params: { search: trimmed } }),
      ]);
      const trucks = (truckRes.data.trucks || [])
        .filter((t) => unitStartsWith(t.truckNumber, trimmed))
        .map((t) => ({
          id: `truck-${t.id}`,
          number: t.truckNumber,
          kind: 'Truck',
        }));
      const trailers = (trailerRes.data.trailers || [])
        .filter((t) => unitStartsWith(t.trailerNumber, trimmed))
        .map((t) => ({
          id: `trailer-${t.id}`,
          number: t.trailerNumber,
          kind: 'Trailer',
        }));
      const merged = [...trucks, ...trailers]
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
        .slice(0, 24);
      setOptions(merged);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => searchUnits(query), 200);
    return () => window.clearTimeout(timer);
  }, [query, searchUnits]);

  if (readOnly) {
    return <p className="text-sm">{value || '—'}</p>;
  }

  return (
    <div className="relative">
      <input
        className={inputClass}
        required
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
        }}
        onBlur={() => {
          window.setTimeout(() => setOptions([]), 150);
        }}
        placeholder="Truck or trailer number"
        autoComplete="off"
      />
      {loading && query.trim() && (
        <p className="mt-1 text-xs text-slate-500">Searching…</p>
      )}
      {options.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(opt.number);
                  onChange(opt.number);
                  setOptions([]);
                }}
              >
                <span className="font-medium">{opt.number}</span>
                <span className="text-xs text-slate-500">{opt.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ParkingTimePicker({ hour, minute, meridiem, onChange, readOnly }) {
  const timeLabel = useMemo(
    () => buildTimeLabel(hour, minute, meridiem),
    [hour, minute, meridiem]
  );

  if (readOnly) {
    return <p className="text-sm">{timeLabel || '—'}</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <span className="mb-1 block text-center text-[10px] font-medium uppercase text-slate-500">
            Hour
          </span>
          <select
            className={wheelSelectClass}
            size={6}
            value={hour}
            onChange={(e) => onChange({ hour: e.target.value, minute, meridiem })}
          >
            <option value="">—</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-center text-[10px] font-medium uppercase text-slate-500">
            Minute
          </span>
          <select
            className={wheelSelectClass}
            size={6}
            value={minute}
            onChange={(e) => onChange({ hour, minute: e.target.value, meridiem })}
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-center text-[10px] font-medium uppercase text-slate-500">
            AM / PM
          </span>
          <select
            className={wheelSelectClass}
            size={2}
            value={meridiem}
            onChange={(e) => onChange({ hour, minute, meridiem: e.target.value })}
          >
            {MERIDIEMS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      {timeLabel && (
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">{timeLabel}</p>
      )}
    </div>
  );
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
    const timeLabel = buildTimeLabel(form.timeHour, form.timeMinute, form.timeMeridiem);
    try {
      await onSave({
        unitNumber: form.unitNumber.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        timeLabel,
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
            <ParkingUnitSearch
              value={form.unitNumber}
              readOnly={readOnly}
              onChange={(unitNumber) => setForm((prev) => ({ ...prev, unitNumber }))}
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
            <ParkingTimePicker
              readOnly={readOnly}
              hour={form.timeHour}
              minute={form.timeMinute}
              meridiem={form.timeMeridiem}
              onChange={({ hour, minute, meridiem }) =>
                setForm((prev) => ({
                  ...prev,
                  timeHour: hour,
                  timeMinute: minute,
                  timeMeridiem: meridiem,
                }))
              }
            />
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