import {
  DRIVER_TYPES,
  LEAD_DATE_PRESETS,
  LEAD_STATUSES,
} from '../../constants/recruitingConstants';

const selectClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function LeadBoardToolbar({
  searchInput,
  onSearchInputChange,
  filters,
  onFilterChange,
  pageSizes,
  sources = [],
  recruiters = [],
  showRecruiterFilter = false,
}) {
  return (
    <div className="mb-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className={`grid gap-3 ${showRecruiterFilter ? 'lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]' : 'lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]'}`}>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="Search name, phone, email, state/city, source..."
          className={`${selectClass} w-full`}
        />

        <select
          value={filters.status}
          onChange={(event) => onFilterChange('status', event.target.value)}
          className={selectClass}
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={filters.driverType}
          onChange={(event) => onFilterChange('driverType', event.target.value)}
          className={selectClass}
        >
          <option value="">All driver types</option>
          {DRIVER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={filters.source}
          onChange={(event) => onFilterChange('source', event.target.value)}
          className={selectClass}
        >
          <option value="">All sources</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>

        {showRecruiterFilter && (
          <select
            value={filters.recruiterId || ''}
            onChange={(event) => onFilterChange('recruiterId', event.target.value)}
            className={selectClass}
          >
            <option value="">All recruiters</option>
            {recruiters.map((recruiter) => (
              <option key={recruiter.id} value={recruiter.id}>
                {recruiter.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={filters.datePreset}
          onChange={(event) => onFilterChange('datePreset', event.target.value)}
          className={selectClass}
        >
          {LEAD_DATE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {filters.datePreset === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            From
            <input
              type="date"
              value={filters.customStart}
              onChange={(event) => onFilterChange('customStart', event.target.value)}
              className={`${selectClass} mt-1 w-full`}
            />
          </label>
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            To
            <input
              type="date"
              value={filters.customEnd}
              onChange={(event) => onFilterChange('customEnd', event.target.value)}
              className={`${selectClass} mt-1 w-full`}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
        <p>Use filters and search to narrow the current board.</p>
        <label className="inline-flex items-center gap-2">
          Rows per page
          <select
            value={filters.limit}
            onChange={(event) => onFilterChange('limit', Number(event.target.value))}
            className={selectClass}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
