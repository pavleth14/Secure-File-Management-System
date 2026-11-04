import {
  MAINTENANCE_BOARD_INITIAL_FILTERS,
  buildMaintenanceCaseQueryParams,
} from './maintenanceBoardFilters';

export { MAINTENANCE_BOARD_INITIAL_FILTERS, buildMaintenanceCaseQueryParams };

const compactInputClass =
  'min-w-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const compactBtnClass =
  'rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700';

export default function MaintenanceBoardToolbar({
  filters,
  onFilterChange,
  onClearFilters,
  totalCount = 0,
  loading = false,
  showNewCase = false,
  onNewCase,
  onExportCostReport,
}) {
  const set = (key, value) => onFilterChange(key, value);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
      <button type="button" onClick={onClearFilters} className={compactBtnClass}>
        Clear filters
      </button>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {loading ? 'Loading…' : `${totalCount} case${totalCount === 1 ? '' : 's'}`}
      </span>
      <span className="hidden text-[11px] text-slate-400 lg:inline">Filter via ▾ on columns</span>

      <span className="hidden h-3 w-px bg-slate-200 dark:bg-slate-600 sm:inline" aria-hidden />

      <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
        <span className="shrink-0">Report</span>
        <select
          value={filters.reportPeriod}
          onChange={(event) => set('reportPeriod', event.target.value)}
          className={compactInputClass}
        >
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
        </select>
      </label>
      <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
        <span className="shrink-0">Anchor</span>
        <input
          type="date"
          value={filters.reportReferenceDate}
          onChange={(event) => set('reportReferenceDate', event.target.value)}
          className={compactInputClass}
          title="Week / month / quarter containing this date (Chicago). Empty = today."
        />
      </label>
      <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={Boolean(filters.reportWithCostOnly)}
          onChange={(event) => set('reportWithCostOnly', event.target.checked)}
          className="rounded border-slate-300 text-emerald-600 dark:border-slate-600"
        />
        With cost only
      </label>
      {onExportCostReport && (
        <button
          type="button"
          onClick={onExportCostReport}
          className="rounded border border-emerald-600/70 bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
        >
          Cost CSV
        </button>
      )}

      {showNewCase && (
        <button
          type="button"
          onClick={onNewCase}
          className="ml-auto rounded bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          New case
        </button>
      )}
    </div>
  );
}
