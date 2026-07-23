import { useState } from 'react';
import { formatDate } from '../../utils/format';
import { useContextMenu } from '../../hooks/useContextMenu';
import LeadCommentsCell from './LeadCommentsCell';

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

export default function LeadBoardTable({
  leads,
  isRecruitingManager,
  readOnly = false,
  currentUserId,
  sortBy,
  sortDir,
  onSortChange,
  onViewLead,
  onAddComment,
  onEditComment,
  onAssignLead,
  onArchiveLead,
  showRecruiterColumn = false,
  showArchiveColumns = false,
  loading = false,
  emptyMessage = 'No leads on this board yet.',
}) {
  const { openContextMenu, contextMenuNode } = useContextMenu();
  const [openCommentsLeadId, setOpenCommentsLeadId] = useState(null);

  const handleSort = (key) => {
    if (sortBy === key) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(key, 'asc');
    }
  };

  const buildMenuItems = (lead) => {
    const items = [
      {
        id: 'view',
        label: 'Open/View Lead',
        onClick: () => onViewLead(lead),
      },
    ];

    if (!readOnly && onAddComment) {
      items.push({
        id: 'comment',
        label: 'Add Comment',
        onClick: () => onAddComment(lead),
      });
    }

    if (isRecruitingManager && onAssignLead) {
      items.push({
        id: 'assign',
        label: 'Assign to different recruiter',
        onClick: () => onAssignLead(lead),
      });
    }

    if (isRecruitingManager && onArchiveLead && !showArchiveColumns) {
      items.push({
        id: 'archive',
        label: 'Archive lead',
        onClick: () => onArchiveLead(lead),
      });
    }

    return items;
  };

  const extraColumns =
    (showRecruiterColumn ? 1 : 0) + (showArchiveColumns ? 2 : 0);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
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
              {showRecruiterColumn && (
                <SortableHeader
                  columnKey="recruiter"
                  label="Recruiter"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              )}
              {showArchiveColumns && (
                <>
                  <SortableHeader
                    columnKey="archivedAt"
                    label="Archived Date"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    Archived By
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Comments
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900 dark:divide-slate-700 dark:text-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + extraColumns + 1}
                  className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  Loading leads...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + extraColumns + 1}
                  className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  onContextMenu={(event) => openContextMenu(event, buildMenuItems(lead))}
                >
                  <td className="px-4 py-3 text-sm">{lead.status || '—'}</td>
                  <td className="px-4 py-3 text-sm">{lead.driverType || '—'}</td>
                  <td className="px-4 py-3 text-sm">{lead.source || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {lead.date || formatDate(lead.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">{lead.firstName || '—'}</td>
                  <td className="px-4 py-3 text-sm">{lead.lastName || '—'}</td>
                  <td className="px-4 py-3 text-sm">{lead.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm">{lead.stateCity || '—'}</td>
                  <td className="px-4 py-3 text-sm">{lead.email || '—'}</td>

                  {showRecruiterColumn && (
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {lead.assignedRecruiter?.name || '—'}
                    </td>
                  )}

                  {showArchiveColumns && (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {formatDate(lead.archivedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {lead.archivedBy?.name || '—'}
                      </td>
                    </>
                  )}

                  <LeadCommentsCell
                    lead={lead}
                    open={openCommentsLeadId === lead.id}
                    onToggle={(leadId) =>
                      setOpenCommentsLeadId((current) => (current === leadId ? null : leadId))
                    }
                    onClose={() => setOpenCommentsLeadId(null)}
                    currentUserId={currentUserId}
                    onEditComment={readOnly ? undefined : onEditComment}
                    readOnly={readOnly}
                  />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {contextMenuNode}
    </>
  );
}
