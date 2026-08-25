import { useEffect, useState } from 'react';
import {
  DEFAULT_LEAD_STATUS,
  DRIVER_TYPES,
  MANUAL_LEAD_SOURCE,
} from '../../constants/recruitingConstants';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  stateCity: '',
  driverType: 'Solo',
  source: MANUAL_LEAD_SOURCE,
  date: '',
};

function FieldLabel({ htmlFor, children, required = false }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
    >
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
  );
}

const inputClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function CreateLeadModal({
  open,
  onSave,
  onCancel,
  submitting = false,
  sources = [],
  error = '',
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
    }
  }, [open]);

  if (!open) return null;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()) return;

    onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      stateCity: form.stateCity.trim() || undefined,
      driverType: form.driverType || 'Solo',
      source: form.source || MANUAL_LEAD_SOURCE,
      status: DEFAULT_LEAD_STATUS,
      date: form.date || undefined,
    });
  };

  const sourceOptions = sources.length ? sources : [MANUAL_LEAD_SOURCE];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-lead-title"
    >
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2
            id="create-lead-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Add Lead
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manually add a lead to this board. Status is set to New Lead.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="create-lead-first-name" required>
                First name
              </FieldLabel>
              <input
                id="create-lead-first-name"
                type="text"
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                required
                className={inputClassName}
              />
            </div>
            <div>
              <FieldLabel htmlFor="create-lead-last-name" required>
                Last name
              </FieldLabel>
              <input
                id="create-lead-last-name"
                type="text"
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                required
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="create-lead-phone" required>
              Phone
            </FieldLabel>
            <input
              id="create-lead-phone"
              type="tel"
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              required
              className={inputClassName}
            />
          </div>

          <div>
            <FieldLabel htmlFor="create-lead-email">Email</FieldLabel>
            <input
              id="create-lead-email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <FieldLabel htmlFor="create-lead-state-city">State / City</FieldLabel>
            <input
              id="create-lead-state-city"
              type="text"
              value={form.stateCity}
              onChange={(event) => updateField('stateCity', event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="create-lead-driver-type">Driver type</FieldLabel>
              <select
                id="create-lead-driver-type"
                value={form.driverType}
                onChange={(event) => updateField('driverType', event.target.value)}
                className={inputClassName}
              >
                {DRIVER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="create-lead-source">Source</FieldLabel>
              <select
                id="create-lead-source"
                value={form.source}
                onChange={(event) => updateField('source', event.target.value)}
                className={inputClassName}
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="create-lead-status">Status</FieldLabel>
              <input
                id="create-lead-status"
                type="text"
                value={DEFAULT_LEAD_STATUS}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-slate-50 dark:bg-slate-950`}
              />
            </div>
            <div>
              <FieldLabel htmlFor="create-lead-date">Date</FieldLabel>
              <input
                id="create-lead-date"
                type="date"
                value={form.date}
                onChange={(event) => updateField('date', event.target.value)}
                className={inputClassName}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              submitting ||
              !form.firstName.trim() ||
              !form.lastName.trim() ||
              !form.phone.trim()
            }
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
