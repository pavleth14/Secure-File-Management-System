/**
 * Extension filter dropdown — options are built from the current folder's file list.
 */
export default function ExtensionFilterSelect({
  value = 'all',
  onChange,
  options = [],
  id = 'extension-filter',
}) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">Extension</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[7rem] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="all">All Files</option>
        {options.map((ext) => (
          <option key={ext} value={ext}>
            {ext.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
