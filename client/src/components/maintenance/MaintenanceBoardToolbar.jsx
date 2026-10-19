import { useEffect, useRef, useState } from 'react';
import {
  MAINTENANCE_OOS_STATUSES,
  MAINTENANCE_PRIORITIES,
} from '../../constants/maintenanceConstants';

const inputClass =
  'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const labelClass = 'mb-0.5 block truncate text-xs font-medium text-slate-600 dark:text-slate-400';

function FilterField({ label, children, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function FilterMultiSelect({ label, options, values, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const toggle = (option) => {
    if (values.includes(option)) {
      onChange(values.filter((value) => value !== option));
    } else {
      onChange([...values, option]);
    }
  };

  const summary =
    values.length === 0
      ? 'All'
      : values.length <= 2
        ? values.join(', ')
        : `${values.length} selected`;

  return (
    <FilterField label={label}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`${inputClass} flex items-center justify-between gap-1 text-left`}
          aria-expanded={open}
        >
          <span className="truncate">{summary}</span>
          <span className="shrink-0 text-slate-400" aria-hidden>
            ▾
          </span>
        </button>
        {open && (
          <div className="absolute z-30 mt-1 max-h-52 w-full min-w-[11rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-slate-500">No options</p>
            ) : (
              options.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60"
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600"
                    checked={values.includes(option)}
                    onChange={() => toggle(option)}
                  />
                  <span className="truncate">{option}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </FilterField>
  );
}

/** API values; backend matches caseStatus case-insensitively (e.g. OPEN vs Open). */
export const MAINTENANCE_BOARD_STATUS_FILTER = {
  all: '',
  open: 'OPEN',
  closed: 'CLOSED',
};

export const MAINTENANCE_BOARD_INITIAL_FILTERS = {
  issue: '',
  assigneeId: '',
  dueFrom: '',
  dueTo: '',
  equipment: '',
  statusFilter: 'open',
  priorities: [],
  projects: [],
  oosStatuses: [],
  caseTypes: [],
  repairShop: '',
  dateClosedFrom: '',
  dateClosedTo: '',
  invoiceStatuses: [],
  dispatchStatuses: [],
  lastEditedFrom: '',
  lastEditedTo: '',
  costMin: '',
  costMax: '',
  hasCost: '',
  reportPeriod: 'month',
  reportReferenceDate: '',
  reportWithCostOnly: false,
};

export function buildMaintenanceCaseQueryParams(filters, { limit = 100 } = {}) {
  const params = { limit };
  if (filters.issue.trim()) params.issue = filters.issue.trim();
  if (filters.assigneeId) params.assigneeId = filters.assigneeId;
  if (filters.dueFrom) params.dueFrom = filters.dueFrom;
  if (filters.dueTo) params.dueTo = filters.dueTo;
  if (filters.equipment.trim()) params.equipment = filters.equipment.trim();
  if (filters.repairShop.trim()) params.repairShop = filters.repairShop.trim();
  if (filters.dateClosedFrom) params.dateClosedFrom = filters.dateClosedFrom;
  if (filters.dateClosedTo) params.dateClosedTo = filters.dateClosedTo;
  if (filters.lastEditedFrom) params.lastEditedFrom = filters.lastEditedFrom;
  if (filters.lastEditedTo) params.lastEditedTo = filters.lastEditedTo;
  const statusValue = MAINTENANCE_BOARD_STATUS_FILTER[filters.statusFilter];
  if (statusValue) params.caseStatus = statusValue;
  if (filters.priorities.length) params.priority = filters.priorities.join(',');
  if (filters.projects.length) params.project = filters.projects.join(',');
  if (filters.oosStatuses.length) params.oosStatus = filters.oosStatuses.join(',');
  if (filters.caseTypes.length) params.caseType = filters.caseTypes.join(',');
  if (filters.invoiceStatuses.length) params.invoiceStatus = filters.invoiceStatuses.join(',');
  if (filters.dispatchStatuses.length) params.dispatchStatus = filters.dispatchStatuses.join(',');
  if (filters.costMin !== '') params.costMin = filters.costMin;
  if (filters.costMax !== '') params.costMax = filters.costMax;
  if (filters.hasCost) params.hasCost = filters.hasCost;
  return params;
}

export default function MaintenanceBoardToolbar({
  filters,
  onFilterChange,
  onClearFilters,
  assignees = [],
  tagOptions = {},
  totalCount = 0,
  loading = false,
  showNewCase = false,
  onNewCase,
  onExportCostReport,
}) {
  const set = (key, value) => onFilterChange(key, value);

  const projectOptions = tagOptions.project || [];
  const caseTypeOptions = tagOptions.caseType || [];
  const invoiceOptions = tagOptions.invoiceStatus || [];
  const dispatchOptions = tagOptions.dispatchStatus || [];

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
        <FilterField label="Case / Issue" className="2xl:col-span-1">
          <input
            type="search"
            value={filters.issue}
            onChange={(event) => set('issue', event.target.value)}
            placeholder="Issue text…"
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Assignee">
          <select
            value={filters.assigneeId}
            onChange={(event) => set('assigneeId', event.target.value)}
            className={inputClass}
          >
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Truck / Trailer">
          <input
            type="search"
            value={filters.equipment}
            onChange={(event) => set('equipment', event.target.value)}
            placeholder="Unit number…"
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Shop">
          <input
            type="search"
            value={filters.repairShop}
            onChange={(event) => set('repairShop', event.target.value)}
            placeholder="Repair shop…"
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Due from">
          <input
            type="date"
            value={filters.dueFrom}
            onChange={(event) => set('dueFrom', event.target.value)}
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Due to">
          <input
            type="date"
            value={filters.dueTo}
            onChange={(event) => set('dueTo', event.target.value)}
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Date closed from">
          <input
            type="date"
            value={filters.dateClosedFrom}
            onChange={(event) => set('dateClosedFrom', event.target.value)}
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Date closed to">
          <input
            type="date"
            value={filters.dateClosedTo}
            onChange={(event) => set('dateClosedTo', event.target.value)}
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Status">
          <select
            value={filters.statusFilter}
            onChange={(event) => set('statusFilter', event.target.value)}
            className={inputClass}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </FilterField>

        <FilterMultiSelect
          label="Priority"
          options={MAINTENANCE_PRIORITIES}
          values={filters.priorities}
          onChange={(value) => set('priorities', value)}
        />

        <FilterMultiSelect
          label="Project"
          options={projectOptions}
          values={filters.projects}
          onChange={(value) => set('projects', value)}
        />

        <FilterMultiSelect
          label="OOS"
          options={MAINTENANCE_OOS_STATUSES}
          values={filters.oosStatuses}
          onChange={(value) => set('oosStatuses', value)}
        />

        <FilterMultiSelect
          label="Type"
          options={caseTypeOptions}
          values={filters.caseTypes}
          onChange={(value) => set('caseTypes', value)}
        />

        <FilterMultiSelect
          label="Invoice status"
          options={invoiceOptions}
          values={filters.invoiceStatuses}
          onChange={(value) => set('invoiceStatuses', value)}
        />

        <FilterMultiSelect
          label="Dispatch status"
          options={dispatchOptions}
          values={filters.dispatchStatuses}
          onChange={(value) => set('dispatchStatuses', value)}
        />

        <FilterField label="Last update from">
          <input
            type="date"
            value={filters.lastEditedFrom}
            onChange={(event) => set('lastEditedFrom', event.target.value)}
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Last update to">
          <input
            type="date"
            value={filters.lastEditedTo}
            onChange={(event) => set('lastEditedTo', event.target.value)}
            className={inputClass}
          />
        </FilterField>

        <FilterField label="Cost min (USD)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={filters.costMin}
            onChange={(event) => set('costMin', event.target.value)}
            className={inputClass}
            placeholder="Min"
          />
        </FilterField>

        <FilterField label="Cost max (USD)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={filters.costMax}
            onChange={(event) => set('costMax', event.target.value)}
            className={inputClass}
            placeholder="Max"
          />
        </FilterField>

        <FilterField label="Has cost">
          <select
            value={filters.hasCost}
            onChange={(event) => set('hasCost', event.target.value)}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="yes">With cost</option>
            <option value="no">Without cost</option>
          </select>
        </FilterField>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/25">
        <FilterField label="Cost report period" className="min-w-[8rem]">
          <select
            value={filters.reportPeriod}
            onChange={(event) => set('reportPeriod', event.target.value)}
            className={inputClass}
          >
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
          </select>
        </FilterField>
        <FilterField label="Report anchor date">
          <input
            type="date"
            value={filters.reportReferenceDate}
            onChange={(event) => set('reportReferenceDate', event.target.value)}
            className={inputClass}
            title="Week / month / quarter containing this date (Chicago). Empty = today."
          />
        </FilterField>
        <label className="flex items-center gap-2 pb-2 text-sm text-emerald-900/90 dark:text-emerald-100/90">
          <input
            type="checkbox"
            checked={Boolean(filters.reportWithCostOnly)}
            onChange={(event) => set('reportWithCostOnly', event.target.checked)}
            className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500/30 dark:border-emerald-700"
          />
          Only rows with cost
        </label>
        {onExportCostReport && (
          <button
            type="button"
            onClick={onExportCostReport}
            className="ml-auto rounded-lg border border-emerald-600/70 bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:border-emerald-700 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-emerald-500/80 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            Download cost report (CSV)
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Clear filters
          </button>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Loading…' : `${totalCount} case${totalCount === 1 ? '' : 's'}`}
          </p>
        </div>
        {showNewCase && (
          <button
            type="button"
            onClick={onNewCase}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New case
          </button>
        )}
      </div>
    </div>
  );
}
