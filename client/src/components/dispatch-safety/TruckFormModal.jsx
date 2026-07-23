import { useEffect, useState } from 'react';
import { EQUIPMENT_STATUSES } from '../../constants/dispatchConstants';
import FolderLinkField from './FolderLinkField';
import { inputClass } from './SafetyListToolbar';

const emptyForm = {
  truckNumber: '',
  type: '',
  status: 'Active',
  make: '',
  model: '',
  year: '',
  vin: '',
  plateNumber: '',
  dotInspectionExpiration: '',
  platesExpiration: '',
  notes: '',
  linkedFolderId: null,
};

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function TruckFormModal({ truck, open, onClose, onSave, canEdit, canLinkFolder }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (truck) {
      setForm({
        truckNumber: truck.truckNumber || '',
        type: truck.type || '',
        status: truck.status || 'Active',
        make: truck.make || '',
        model: truck.model || '',
        year: truck.year || '',
        vin: truck.vin || '',
        plateNumber: truck.plateNumber || '',
        dotInspectionExpiration: toDateInput(truck.dotInspectionExpiration),
        platesExpiration: toDateInput(truck.platesExpiration),
        notes: truck.notes || '',
        linkedFolderId: truck.linkedFolderId || null,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, truck]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save truck');
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !canEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {truck ? 'View / Edit Truck' : 'New Truck'}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Truck#" value={form.truckNumber} onChange={(v) => setForm({ ...form, truckNumber: v })} readOnly={readOnly} required />
          <Field label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} readOnly={readOnly} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              disabled={readOnly}
              className={inputClass}
            >
              {EQUIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <Field label="Make" value={form.make} onChange={(v) => setForm({ ...form, make: v })} readOnly={readOnly} />
          <Field label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} readOnly={readOnly} />
          <Field label="Year" value={form.year} onChange={(v) => setForm({ ...form, year: v })} readOnly={readOnly} />
          <Field label="VIN#" value={form.vin} onChange={(v) => setForm({ ...form, vin: v })} readOnly={readOnly} />
          <Field label="Plate#" value={form.plateNumber} onChange={(v) => setForm({ ...form, plateNumber: v })} readOnly={readOnly} />
          <Field label="DOT Inspection Expiration" type="date" value={form.dotInspectionExpiration} onChange={(v) => setForm({ ...form, dotInspectionExpiration: v })} readOnly={readOnly} />
          <Field label="Plates Expiration" type="date" value={form.platesExpiration} onChange={(v) => setForm({ ...form, platesExpiration: v })} readOnly={readOnly} />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes / Comments</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              readOnly={readOnly}
              rows={3}
              className={inputClass}
            />
          </div>
          {canLinkFolder && (
            <div className="sm:col-span-2">
              <FolderLinkField
                value={form.linkedFolderId}
                onChange={(linkedFolderId) => setForm({ ...form, linkedFolderId })}
                disabled={readOnly}
              />
            </div>
          )}
        </div>

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

function Field({ label, value, onChange, readOnly, type = 'text', required = false }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required={required}
        className={inputClass}
      />
    </div>
  );
}
