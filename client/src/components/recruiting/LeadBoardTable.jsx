import { useEffect, useState } from 'react';
import { formatDate } from '../../utils/format';
import {
  canEditDriverType,
  canEditPersonalInfo,
  canEditStatus,
  isWithinPersonalInfoEditWindow,
} from '../../utils/leadPermissions';
import {
  DRIVER_TYPES,
  LEAD_STATUSES,
} from '../../constants/recruitingConstants';
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

const inputClass =
  'w-full min-w-[7rem] rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const selectClass =
  'w-full min-w-[8rem] rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

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

function EditableTextCell({ value, editable, onSave }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  if (!editable) {
    return <span>{value || '—'}</span>;
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed !== (value || '')) {
          onSave(trimmed);
        }
      }}
      className={inputClass}
    />
  );
}

export default function LeadBoardTable({
  leads,
  isRecruitingManager,
  isRecruiter = false,
  isOwnBoard = false,
  readOnly = false,
  currentUserId,
  sortBy,
  sortDir,
  onSortChange,
  onUpdateLead,
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
  useEffect(() => {
    console.log('[LEAD BOARD TABLE PROPS]', {
      isRecruitingManager,
      isRecruiter,
      isOwnBoard,
      readOnly,
      currentUserId,
      leadsCount: leads.length,
    });
  }, [
    isRecruitingManager,
    isRecruiter,
    isOwnBoard,
    readOnly,
    currentUserId,
    leads.length,
  ]);

  useEffect(() => {
    if (!leads.length) return;
    const first = leads[0];
    // Temporary date import debugging
    console.log('[DATE-DISPLAY] LeadBoardTable render', {
      date: first.date,
      createdAt: first.createdAt,
      rendered: first.date || formatDate(first.createdAt),
    });
  }, [leads]);

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
              leads.map((lead) => {
                const editWindow = isWithinPersonalInfoEditWindow(lead);
                const personalEditable = canEditPersonalInfo(lead, {
                  isRecruitingManager,
                  isRecruiter,
                  isOwnBoard,
                  readOnly,
                });
                const statusEditable = canEditStatus(lead, {
                  isRecruitingManager,
                  isRecruiter,
                  isOwnBoard,
                  readOnly,
                });
                const driverTypeEditable = canEditDriverType(lead, {
                  isRecruitingManager,
                  isRecruiter,
                  isOwnBoard,
                  readOnly,
                });

                console.log('[LEAD-EDIT-PERMISSIONS]', {
                  leadId: lead.id,
                  importedAt: lead.importedAt,
                  currentTime: new Date().toISOString(),
                  editWindow,
                  statusEditable,
                  driverTypeEditable,
                  personalEditable,
                });

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    onContextMenu={(event) => openContextMenu(event, buildMenuItems(lead))}
                  >
                    <td className="px-4 py-3 text-sm">
                      {statusEditable ? (
                        <select
                          value={lead.status}
                          onChange={(event) =>
                            onUpdateLead(lead.id, { status: event.target.value })
                          }
                          className={selectClass}
                        >
                          {LEAD_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead.status
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      {driverTypeEditable ? (
                        <select
                          value={lead.driverType}
                          onChange={(event) =>
                            onUpdateLead(lead.id, { driverType: event.target.value })
                          }
                          className={selectClass}
                        >
                          {DRIVER_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead.driverType
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm">{lead.source}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {lead.date || formatDate(lead.createdAt)}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <EditableTextCell
                        value={lead.firstName}
                        editable={personalEditable}
                        onSave={(value) => onUpdateLead(lead.id, { firstName: value })}
                      />                      
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <EditableTextCell
                        value={lead.lastName}
                        editable={personalEditable}
                        onSave={(value) => onUpdateLead(lead.id, { lastName: value })}
                      />
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <EditableTextCell
                        value={lead.phone}
                        editable={personalEditable}
                        onSave={(value) => onUpdateLead(lead.id, { phone: value })}
                      />
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <EditableTextCell
                        value={lead.stateCity}
                        editable={personalEditable}
                        onSave={(value) => onUpdateLead(lead.id, { stateCity: value })}
                      />
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <EditableTextCell
                        value={lead.email}
                        editable={personalEditable}
                        onSave={(value) => onUpdateLead(lead.id, { email: value })}
                      />
                    </td>

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
