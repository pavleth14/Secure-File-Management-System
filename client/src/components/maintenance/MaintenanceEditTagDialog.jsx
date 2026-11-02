import { useEffect, useState } from 'react';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function MaintenanceEditTagDialog({
  open,
  tagName,
  tagColor,
  tagLabel = 'tag',
  onCancel,
  onConfirm,
  submitting,
  error,
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366F1');

  useEffect(() => {
    if (!open) return;
    setName(tagName || '');
    setColor(tagColor || '#6366F1');
  }, [open, tagName, tagColor]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Edit {tagLabel}
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Updates the label on all maintenance cases using this {tagLabel}.
        </p>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            onConfirm({ name: trimmed, color });
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Name</span>
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Color</span>
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-10 w-full max-w-[4rem] rounded border dark:border-slate-600"
            />
          </label>
          <div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border px-4 py-2 text-sm dark:border-slate-600"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
