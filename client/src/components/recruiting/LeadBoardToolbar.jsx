import {
  DRIVER_TYPES,
  LEAD_DATE_PRESETS,
  LEAD_STATUSES,
} from '../../constants/recruitingConstants';

const selectClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const labelClass = 'mb-1 block text-sm text-slate-600 dark:text-slate-400';

function getGridClass(showRecruiterFilter, showHiredDateFilter) {
  let filterCount = 4;
  if (showRecruiterFilter) filterCount += 1;
  if (showHiredDateFilter) filterCount += 1;
  return `grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(${filterCount},minmax(0,1fr))]`;
}

function FilterField({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export default function LeadBoardToolbar({
  searchInput,
  onSearchInputChange,
  filters,
  onFilterChange,
  pageSizes,
  sources = [],
  statuses = LEAD_STATUSES,
  recruiters = [],
  showRecruiterFilter = false,
  showHiredDateFilter = false,
}) {
  return (
    <div className="mb-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className={getGridClass(showRecruiterFilter, showHiredDateFilter)}>
        <FilterField label="Filter by search">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Search name, phone, email, state/city, source..."
            className={`${selectClass} w-full`}
          />
        </FilterField>

        <FilterField label="Filter by status">
          <select
            value={filters.status}
            onChange={(event) => onFilterChange('status', event.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Filter by driver type">
          <select
            value={filters.driverType}
            onChange={(event) => onFilterChange('driverType', event.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="">All driver types</option>
            {DRIVER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Filter by source">
          <select
            value={filters.source}
            onChange={(event) => onFilterChange('source', event.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </FilterField>

        {showRecruiterFilter && (
          <FilterField label="Filter by recruiter">
            <select
              value={filters.recruiterId || ''}
              onChange={(event) => onFilterChange('recruiterId', event.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="">All recruiters</option>
              {recruiters.map((recruiter) => (
                <option key={recruiter.id} value={recruiter.id}>
                  {recruiter.name}
                </option>
              ))}
            </select>
          </FilterField>
        )}

        {showHiredDateFilter && (
          <FilterField label="Filter by hired date">
            <select
              value={filters.hiredDatePreset || 'all'}
              onChange={(event) => onFilterChange('hiredDatePreset', event.target.value)}
              className={`${selectClass} w-full`}
            >
              {LEAD_DATE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </FilterField>
        )}

        <FilterField label="Filter by lead date">
          <select
            value={filters.datePreset}
            onChange={(event) => onFilterChange('datePreset', event.target.value)}
            className={`${selectClass} w-full`}
          >
            {LEAD_DATE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </FilterField>
      </div>

      {filters.datePreset === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            Lead date from
            <input
              type="date"
              value={filters.customStart}
              onChange={(event) => onFilterChange('customStart', event.target.value)}
              className={`${selectClass} mt-1 w-full`}
            />
          </label>
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            Lead date to
            <input
              type="date"
              value={filters.customEnd}
              onChange={(event) => onFilterChange('customEnd', event.target.value)}
              className={`${selectClass} mt-1 w-full`}
            />
          </label>
        </div>
      )}

      {showHiredDateFilter && filters.hiredDatePreset === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            Hired date from
            <input
              type="date"
              value={filters.customHiredStart || ''}
              onChange={(event) => onFilterChange('customHiredStart', event.target.value)}
              className={`${selectClass} mt-1 w-full`}
            />
          </label>
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            Hired date to
            <input
              type="date"
              value={filters.customHiredEnd || ''}
              onChange={(event) => onFilterChange('customHiredEnd', event.target.value)}
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
