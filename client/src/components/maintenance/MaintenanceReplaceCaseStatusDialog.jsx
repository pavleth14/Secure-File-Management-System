import { useEffect, useMemo, useState } from 'react';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function MaintenanceReplaceCaseStatusDialog({
  open,
  statusName,
  caseCount,
  replacementOptions,
  tagLabel = 'status',
  onCancel,
  onConfirm,
  submitting,
  error,
}) {
  const [mode, setMode] = useState('replace');
  const [replacementName, setReplacementName] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366F1');

  const options = useMemo(
    () =>
      (replacementOptions || []).filter(
        (name) => name.toLowerCase() !== String(statusName || '').toLowerCase()
      ),
    [replacementOptions, statusName]
  );

  useEffect(() => {
    if (!open) return;
    setMode('replace');
    setReplacementName(options[0] || '');
    setNewName('');
    setNewColor('#6366F1');
  }, [open, statusName, options]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mode === 'replace') {
      if (!replacementName) return;
      onConfirm({ replacementName });
      return;
    }
    const name = newName.trim();
    if (!name) return;
    onConfirm({ newReplacement: { name, color: newColor } });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Delete {tagLabel}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium">{statusName}</span> is used on{' '}
          <span className="font-medium">{caseCount}</span> case
          {caseCount === 1 ? '' : 's'}. Choose a replacement before deleting.
        </p>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <fieldset className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="replace-mode"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />
              Replace with existing {tagLabel}
            </label>
            {mode === 'replace' && (
              <select
                className={inputClass}
                value={replacementName}
                onChange={(event) => setReplacementName(event.target.value)}
                required
              >
                {options.length === 0 ? (
                  <option value="">No other statuses available</option>
                ) : (
                  options.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                )}
              </select>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="replace-mode"
                checked={mode === 'create'}
                onChange={() => setMode('create')}
              />
              Create new {tagLabel}
            </label>
            {mode === 'create' && (
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${inputClass} min-w-[10rem] flex-1`}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="New status name"
                  required
                />
                <input
                  type="color"
                  value={newColor}
                  onChange={(event) => setNewColor(event.target.value)}
                  className="h-10 w-12 shrink-0 rounded border dark:border-slate-600"
                  title="Status color"
                />
              </div>
            )}
          </fieldset>

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
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={
                submitting ||
                (mode === 'replace' && !replacementName) ||
                (mode === 'create' && !newName.trim())
              }
            >
              {submitting ? 'Deleting…' : `Delete ${tagLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
