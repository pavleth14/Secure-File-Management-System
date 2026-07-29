import { useState } from 'react';
import { formatDate } from '../../utils/format';
import { useContextMenu } from '../../hooks/useContextMenu';
import OldLeadAssignmentCell from './OldLeadAssignmentCell';

const COLUMNS = [
  { key: 'status', label: 'Status' },
  { key: 'driverType', label: 'Type of Driver' },
  { key: 'source', label: 'Source' },
  { key: 'date', label: 'Date' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'stateCity', label: 'State / City' },
  { key: 'email', label: 'Email' },
];

function SortableHeader({ columnKey, label, sortBy, sortDir, onSort }) {
  const active = sortBy === columnKey;
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 ${
          active ? 'text-brand-700 dark:text-brand-400' : ''
        }`}
      >
        {label}
        {active && <span aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

export default function OldLeadsTable({
  oldLeads,
  loading,
  sortBy,
  sortDir,
  onSortChange,
  selectedIds,
  onToggleRow,
  onTogglePage,
  onAssignLead,
  onRoundRobinAssign,
}) {
  const { openContextMenu, contextMenuNode } = useContextMenu();
  const [openAssignmentId, setOpenAssignmentId] = useState(null);

  const selectableLeads = oldLeads.filter((lead) => !lead.isAssigned);
  const allPageSelected =
    selectableLeads.length > 0 && selectableLeads.every((lead) => selectedIds.has(lead.id));

  const handleSort = (key) => {
    if (sortBy === key) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(key, 'asc');
    }
  };

  const buildMenuItems = (oldLead) => {
    if (oldLead.isAssigned) return [];
    const items = [];

    if (onAssignLead) {
      items.push({
        id: 'assign',
        label: 'Assign to recruiter',
        onClick: () => onAssignLead([oldLead.id]),
      });
    }

    if (onRoundRobinAssign) {
      items.push({
        id: 'round-robin',
        label: 'Round robin assign',
        onClick: () => onRoundRobinAssign([oldLead.id]),
      });
    }

    return items;
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={(event) => onTogglePage(event.target.checked)}
                  aria-label="Select all unassigned rows on this page"
                  className="rounded border-slate-300 dark:border-slate-600"
                />
              </th>
              {COLUMNS.map((column) => (
                <SortableHeader
                  key={column.key}
                  columnKey={column.key}
                  label={column.label}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Assignment
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900 dark:divide-slate-700 dark:text-slate-100">
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading old leads...
                </td>
              </tr>
            ) : oldLeads.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-sm text-slate-500">
                  No old leads found. Import a CSV to get started.
                </td>
              </tr>
            ) : (
              oldLeads.map((oldLead) => {
                const menuItems = buildMenuItems(oldLead);
                return (
                  <tr
                    key={oldLead.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                      oldLead.isAssigned ? 'opacity-80' : ''
                    }`}
                    onContextMenu={(event) => {
                      if (!menuItems.length) return;
                      event.preventDefault();
                      openContextMenu(event, menuItems);
                    }}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(oldLead.id)}
                        disabled={oldLead.isAssigned}
                        onChange={() => onToggleRow(oldLead.id)}
                        aria-label={`Select ${oldLead.firstName} ${oldLead.lastName}`}
                        className="rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">{oldLead.status || '—'}</td>
                    <td className="px-4 py-3 text-sm">{oldLead.driverType || '—'}</td>
                    <td className="px-4 py-3 text-sm">{oldLead.source || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {oldLead.date || formatDate(oldLead.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">{oldLead.firstName || '—'}</td>
                    <td className="px-4 py-3 text-sm">{oldLead.lastName || '—'}</td>
                    <td className="px-4 py-3 text-sm">{oldLead.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm">{oldLead.stateCity || '—'}</td>
                    <td className="px-4 py-3 text-sm">{oldLead.email || '—'}</td>
                    <OldLeadAssignmentCell
                      oldLead={oldLead}
                      open={openAssignmentId === oldLead.id}
                      onToggle={(id) =>
                        setOpenAssignmentId((current) => (current === id ? null : id))
                      }
                      onClose={() => setOpenAssignmentId(null)}
                    />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {contextMenuNode}
    </>
  );
}
