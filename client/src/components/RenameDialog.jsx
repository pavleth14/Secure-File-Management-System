import { useEffect, useState } from 'react';

export default function RenameDialog({
  open,
  currentName = '',
  title = 'Rename',
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dialog-title"
    >
      <form
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2
            id="rename-dialog-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {title}
          </h2>
        </div>
        <div className="px-5 py-4">
          <label htmlFor="rename-input" className="sr-only">
            New name
          </label>
          <input
            id="rename-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  );
}
