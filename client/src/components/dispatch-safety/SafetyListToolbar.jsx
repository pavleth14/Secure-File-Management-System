const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function SafetyListToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  onNew,
  newLabel,
  canCreate,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search all fields..."
          className={`${inputClass} sm:max-w-xs`}
        />
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className={`${inputClass} sm:max-w-[180px]`}
        >
          <option value="all">All statuses</option>
          <option value="Active">Active</option>
          <option value="Not Active">Not Active</option>
          <option value="Terminated">Terminated</option>
        </select>
      </div>
      {canCreate && onNew && (
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {newLabel}
        </button>
      )}
    </div>
  );
}

export { inputClass };
