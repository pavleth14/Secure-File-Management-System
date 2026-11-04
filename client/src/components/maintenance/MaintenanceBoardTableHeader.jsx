import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MAINTENANCE_OOS_STATUSES,
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_DEFAULT_PROJECTS,
} from '../../constants/maintenanceConstants';

const inputClass =
  'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const popoverLabelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';

function FilterPopover({ open, anchorRef, onClose, children }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: Math.max(rect.width, 220),
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  if (!open || !position) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[100] cursor-default bg-transparent"
        aria-label="Close filter"
        onClick={onClose}
      />
      <div
        className="fixed z-[101] max-h-[min(24rem,70vh)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800"
        style={{
          top: position.top,
          left: position.left,
          minWidth: position.minWidth,
          maxWidth: 'min(20rem, calc(100vw - 1rem))',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

function PopoverMultiSelect({ options, values, onChange }) {
  const toggle = (option) => {
    if (values.includes(option)) {
      onChange(values.filter((value) => value !== option));
    } else {
      onChange([...values, option]);
    }
  };

  if (options.length === 0) {
    return <p className="text-xs text-slate-500">No options</p>;
  }

  return (
    <div className="max-h-52 space-y-0.5 overflow-y-auto">
      {options.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60"
        >
          <input
            type="checkbox"
            className="rounded border-slate-300 dark:border-slate-600"
            checked={values.includes(option)}
            onChange={() => toggle(option)}
          />
          <span className="truncate">{option}</span>
        </label>
      ))}
    </div>
  );
}

function ColumnFilterHeader({ id, label, active, open, onToggle, children }) {
  const anchorRef = useRef(null);

  return (
    <th className="whitespace-nowrap px-3 py-2 text-left align-bottom font-normal">
      <div className="flex items-center gap-0.5">
        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => onToggle()}
          className={`rounded p-0.5 text-[10px] leading-none transition-colors hover:bg-slate-200/80 dark:hover:bg-slate-700 ${
            active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'
          }`}
          aria-expanded={open}
          aria-label={`Filter ${label}`}
        >
          ▾
        </button>
      </div>
      <FilterPopover open={open} anchorRef={anchorRef} onClose={() => onToggle(false)}>
        {children}
      </FilterPopover>
    </th>
  );
}

function PlainHeader({ label }) {
  return (
    <th className="whitespace-nowrap px-3 py-3 text-left text-xs uppercase tracking-wide text-slate-500">
      {label}
    </th>
  );
}

export default function MaintenanceBoardTableHeader({
  filters,
  onFilterChange,
  assignees = [],
  tagOptions = {},
}) {
  const [openFilterId, setOpenFilterId] = useState(null);
  const set = (key, value) => onFilterChange(key, value);

  const toggleFilter = (id) => {
    setOpenFilterId((current) => (current === id ? null : id));
  };

  const closeFilter = () => setOpenFilterId(null);

  const projectOptions = [
    ...new Set([...MAINTENANCE_DEFAULT_PROJECTS, ...(tagOptions.project || [])]),
  ].sort((a, b) => a.localeCompare(b));
  const caseStatusOptions = [...(tagOptions.caseStatus || [])].sort((a, b) =>
    a.localeCompare(b)
  );
  const caseTypeOptions = tagOptions.caseType || [];
  const invoiceOptions = tagOptions.invoiceStatus || [];
  const dispatchOptions = tagOptions.dispatchStatus || [];

  const statusValues = Array.isArray(filters.statusFilters) ? filters.statusFilters : [];

  const filterHeader = (id, label, active, content) => (
    <ColumnFilterHeader
      key={id}
      id={id}
      label={label}
      active={active}
      open={openFilterId === id}
      onToggle={(next) => {
        if (next === false) closeFilter();
        else toggleFilter(id);
      }}
    >
      {content}
    </ColumnFilterHeader>
  );

  return (
    <thead className="bg-slate-50 dark:bg-slate-900/50">
      <tr className="divide-y divide-slate-200 dark:divide-slate-700">
        {filterHeader(
          'issue',
          'Case / Issue',
          Boolean(filters.issue.trim()) || Boolean(filters.dateOpened),
          <>
            <label className="block">
              <span className={popoverLabelClass}>Issue text</span>
              <input
                type="search"
                value={filters.issue}
                onChange={(event) => set('issue', event.target.value)}
                placeholder="Search issue…"
                className={inputClass}
                autoFocus
              />
            </label>
            <label className="mt-2 block">
              <span className={popoverLabelClass}>Date opened</span>
              <input
                type="date"
                value={filters.dateOpened}
                onChange={(event) => set('dateOpened', event.target.value)}
                className={inputClass}
              />
            </label>
          </>
        )}

        {filterHeader(
          'assignee',
          'Assignee',
          Boolean(filters.assigneeId),
          <label className="block">
            <span className={popoverLabelClass}>Assignee</span>
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
          </label>
        )}

        {filterHeader(
          'due',
          'Due',
          Boolean(filters.dueDate),
          <label className="block">
            <span className={popoverLabelClass}>Due date</span>
            <input
              type="date"
              value={filters.dueDate}
              onChange={(event) => set('dueDate', event.target.value)}
              className={inputClass}
            />
          </label>
        )}

        {filterHeader(
          'equipment',
          'Truck / Trailer',
          Boolean(filters.equipment.trim()),
          <label className="block">
            <span className={popoverLabelClass}>Unit number</span>
            <input
              type="search"
              value={filters.equipment}
              onChange={(event) => set('equipment', event.target.value)}
              placeholder="Truck or trailer…"
              className={inputClass}
            />
          </label>
        )}

        {filterHeader(
          'status',
          'Status',
          statusValues.length > 0,
          <>
            <span className={popoverLabelClass}>Status (empty = all)</span>
            <PopoverMultiSelect
              options={caseStatusOptions}
              values={statusValues}
              onChange={(value) => set('statusFilters', value)}
            />
          </>
        )}

        {filterHeader(
          'priority',
          'Priority',
          filters.priorities.length > 0,
          <>
            <span className={popoverLabelClass}>Priority</span>
            <PopoverMultiSelect
              options={MAINTENANCE_PRIORITIES}
              values={filters.priorities}
              onChange={(value) => set('priorities', value)}
            />
          </>
        )}

        {filterHeader(
          'project',
          'Project',
          filters.projects.length > 0,
          <>
            <span className={popoverLabelClass}>Project</span>
            <PopoverMultiSelect
              options={projectOptions}
              values={filters.projects}
              onChange={(value) => set('projects', value)}
            />
          </>
        )}

        {filterHeader(
          'oos',
          'OOS',
          filters.oosStatuses.length > 0,
          <>
            <span className={popoverLabelClass}>OOS</span>
            <PopoverMultiSelect
              options={MAINTENANCE_OOS_STATUSES}
              values={filters.oosStatuses}
              onChange={(value) => set('oosStatuses', value)}
            />
          </>
        )}

        {filterHeader(
          'type',
          'Type',
          filters.caseTypes.length > 0,
          <>
            <span className={popoverLabelClass}>Case type</span>
            <PopoverMultiSelect
              options={caseTypeOptions}
              values={filters.caseTypes}
              onChange={(value) => set('caseTypes', value)}
            />
          </>
        )}

        {filterHeader(
          'shop',
          'Shop',
          Boolean(filters.repairShop.trim()),
          <label className="block">
            <span className={popoverLabelClass}>Repair shop</span>
            <input
              type="search"
              value={filters.repairShop}
              onChange={(event) => set('repairShop', event.target.value)}
              placeholder="Shop name…"
              className={inputClass}
            />
          </label>
        )}

        {filterHeader(
          'cost',
          'Cost',
          filters.hasCost === 'yes' || filters.hasCost === 'no',
          <label className="block">
            <span className={popoverLabelClass}>Cost filter</span>
            <select
              value={filters.hasCost || ''}
              onChange={(event) => set('hasCost', event.target.value)}
              className={inputClass}
            >
              <option value="">All cases</option>
              <option value="yes">With cost only</option>
              <option value="no">Without cost</option>
            </select>
          </label>
        )}

        {filterHeader(
          'dateClosed',
          'Date closed',
          Boolean(filters.dateClosed),
          <label className="block">
            <span className={popoverLabelClass}>Closed on</span>
            <input
              type="date"
              value={filters.dateClosed}
              onChange={(event) => set('dateClosed', event.target.value)}
              className={inputClass}
            />
          </label>
        )}

        {filterHeader(
          'invoice',
          'Invoice status',
          filters.invoiceStatuses.length > 0,
          <>
            <span className={popoverLabelClass}>Invoice status</span>
            <PopoverMultiSelect
              options={invoiceOptions}
              values={filters.invoiceStatuses}
              onChange={(value) => set('invoiceStatuses', value)}
            />
          </>
        )}

        {filterHeader(
          'dispatch',
          'Dispatch status',
          filters.dispatchStatuses.length > 0,
          <>
            <span className={popoverLabelClass}>Dispatch status</span>
            <PopoverMultiSelect
              options={dispatchOptions}
              values={filters.dispatchStatuses}
              onChange={(value) => set('dispatchStatuses', value)}
            />
          </>
        )}

        <PlainHeader label="Last update" />
        <PlainHeader label="Edited" />
      </tr>
    </thead>
  );
}
