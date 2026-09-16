import { useEffect, useState } from 'react';
import { formatLeadDisplayDate } from '../../utils/leadDateFormat';

function initialDateValue(lead) {
  const display = formatLeadDisplayDate(lead?.date, lead?.createdAt);
  return display === '—' ? '' : display;
}

export default function EditLeadDateModal({
  open,
  lead,
  onConfirm,
  onCancel,
  submitting = false,
}) {
  const [date, setDate] = useState('');

  useEffect(() => {
    if (open && lead) {
      setDate(initialDateValue(lead));
    }
  }, [open, lead?.id, lead?.date, lead?.createdAt]);

  if (!open || !lead) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!date) return;
    onConfirm(date);
  };

  const subtitle = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Lead';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-lead-date-title"
    >
      <form
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2
            id="edit-lead-date-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Edit lead date
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            This is the arrival date shown on the board. It is saved in the database.
          </p>
        </div>

        <div className="px-5 py-4">
          <label
            htmlFor="edit-lead-date-input"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Date
          </label>
          <input
            id="edit-lead-date-input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
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
            disabled={submitting || !date}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save date'}
          </button>
        </div>
      </form>
    </div>
  );
}
