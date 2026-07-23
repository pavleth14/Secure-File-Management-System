import { useEffect, useState } from 'react';
import { DRIVER_TYPES, EQUIPMENT_STATUSES } from '../../constants/dispatchConstants';
import FolderLinkField from './FolderLinkField';
import { inputClass } from './SafetyListToolbar';

const emptyForm = {
  name: '',
  driverType: 'Solo',
  isOwnerOperator: false,
  dateOfBirth: '',
  ssn: '',
  phone: '',
  email: '',
  hiredDate: '',
  status: 'Active',
  cdlNumber: '',
  cdlState: '',
  cdlExpiration: '',
  linkedFolderId: null,
};

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function DriverFormModal({ driver, open, onClose, onSave, canEdit, canLinkFolder }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (driver) {
      setForm({
        name: driver.name || '',
        driverType: driver.driverType || 'Solo',
        isOwnerOperator: Boolean(driver.isOwnerOperator),
        dateOfBirth: toDateInput(driver.dateOfBirth),
        ssn: driver.ssn || '',
        phone: driver.phone || '',
        email: driver.email || '',
        hiredDate: toDateInput(driver.hiredDate),
        status: driver.status || 'Active',
        cdlNumber: driver.cdlNumber || '',
        cdlState: driver.cdlState || '',
        cdlExpiration: toDateInput(driver.cdlExpiration),
        linkedFolderId: driver.linkedFolderId || null,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, driver]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save driver');
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
          {driver ? 'View / Edit Driver' : 'New Driver'}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} readOnly={readOnly} required />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Type of Driver</label>
            <select
              value={form.driverType}
              onChange={(event) => setForm({ ...form, driverType: event.target.value })}
              disabled={readOnly}
              className={inputClass}
            >
              {DRIVER_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isOwnerOperator}
              onChange={(event) => setForm({ ...form, isOwnerOperator: event.target.checked })}
              disabled={readOnly}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Owner Operator
          </label>
          <Field label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} readOnly={readOnly} />
          <Field label="SSN#" value={form.ssn} onChange={(v) => setForm({ ...form, ssn: v })} readOnly={readOnly} />
          <Field label="Phone#" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} readOnly={readOnly} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} readOnly={readOnly} />
          <Field label="Hired Date" type="date" value={form.hiredDate} onChange={(v) => setForm({ ...form, hiredDate: v })} readOnly={readOnly} />
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
          <Field label="CDL#" value={form.cdlNumber} onChange={(v) => setForm({ ...form, cdlNumber: v })} readOnly={readOnly} />
          <Field label="CDL State" value={form.cdlState} onChange={(v) => setForm({ ...form, cdlState: v })} readOnly={readOnly} />
          <Field label="CDL Expiration Date" type="date" value={form.cdlExpiration} onChange={(v) => setForm({ ...form, cdlExpiration: v })} readOnly={readOnly} />
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
