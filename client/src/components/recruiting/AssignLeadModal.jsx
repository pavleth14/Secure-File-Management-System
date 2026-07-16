import { useEffect, useState } from 'react';

export default function AssignLeadModal({
  open,
  lead,
  recruiters,
  onConfirm,
  onCancel,
  submitting = false,
}) {
  const [recruiterId, setRecruiterId] = useState('');

  useEffect(() => {
    if (open) {
      setRecruiterId('');
    }
  }, [open, lead?.id]);

  if (!open || !lead) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!recruiterId) return;
    onConfirm(recruiterId);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-lead-title"
    >
      <form
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2
            id="assign-lead-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Assign Lead To Recruiter
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {lead.firstName} {lead.lastName}
          </p>
        </div>

        <div className="px-5 py-4">
          <label htmlFor="assign-recruiter" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Recruiter
          </label>
          <select
            id="assign-recruiter"
            value={recruiterId}
            onChange={(event) => setRecruiterId(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Select recruiter</option>
            {recruiters.map((recruiter) => (
              <option key={recruiter.id} value={recruiter.id}>
                {recruiter.name}
              </option>
            ))}
          </select>
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
            disabled={submitting || !recruiterId}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Assigning...' : 'Confirm assignment'}
          </button>
        </div>
      </form>
    </div>
  );
}
