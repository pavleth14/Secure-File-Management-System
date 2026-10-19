import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaintenanceTagPill from '../../components/maintenance/MaintenanceTagPill';
import MaintenanceCaseModal from '../../components/maintenance/MaintenanceCaseModal';
import MaintenanceCommentsCell from '../../components/maintenance/MaintenanceCommentsCell';
import MaintenanceBoardToolbar, {
  MAINTENANCE_BOARD_INITIAL_FILTERS,
  buildMaintenanceCaseQueryParams,
} from '../../components/maintenance/MaintenanceBoardToolbar';
import { MAINTENANCE_TAG_TYPES } from '../../constants/maintenanceConstants';
import { useContextMenu } from '../../hooks/useContextMenu';

function isDueOverdue(dueDate) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function buildPayload(form) {
  return {
    issue: form.issue,
    assigneeId: form.assigneeId || null,
    dueDate: form.dueDate || null,
    truckId: form.truckId || null,
    trailerId: form.trailerId || null,
    caseStatus: form.caseStatus,
    priority: form.priority,
    project: form.project,
    oosStatus: form.oosStatus,
    caseType: form.caseType,
    repairShop: form.repairShop,
    issueDescription: form.issueDescription,
    invoiceStatus: form.invoiceStatus,
    dateClosed: form.dateClosed || null,
    dispatchStatus: form.dispatchStatus,
    cost:
      form.cost === '' || form.cost === null || form.cost === undefined
        ? null
        : Number(form.cost),
  };
}

export default function MaintenanceBoardPage() {
  const { canEditMaintenanceCases, canDeleteMaintenanceCases } = useAuth();
  const readOnly = !canEditMaintenanceCases;

  const [cases, setCases] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(MAINTENANCE_BOARD_INITIAL_FILTERS);
  const [assignees, setAssignees] = useState([]);
  const [tagOptions, setTagOptions] = useState({});
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [openCommentsCaseId, setOpenCommentsCaseId] = useState(null);
  const { openContextMenu, contextMenuNode } = useContextMenu();

  const COLUMN_COUNT = 16;

  const loadFilterOptions = useCallback(async () => {
    try {
      const tagTypes = Object.entries(MAINTENANCE_TAG_TYPES);
      const [assigneeRes, ...tagResponses] = await Promise.all([
        api.get('/maintenance/assignees'),
        ...tagTypes.map(([, type]) => api.get(`/maintenance/tags/${type}`)),
      ]);
      setAssignees(assigneeRes.data.assignees || []);
      const nextTagOptions = {};
      tagTypes.forEach(([key], index) => {
        const names = (tagResponses[index].data.tags || []).map((tag) => tag.name).filter(Boolean);
        nextTagOptions[key] = names;
      });
      setTagOptions(nextTagOptions);
    } catch {
      setAssignees([]);
      setTagOptions({});
    }
  }, []);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/maintenance/cases', {
        params: buildMaintenanceCaseQueryParams(filters),
      });
      setCases(data.cases || []);
      setTotalCount(data.total ?? (data.cases || []).length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadCases, 250);
    return () => window.clearTimeout(timer);
  }, [loadCases]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(MAINTENANCE_BOARD_INITIAL_FILTERS);
  };

  const handleExportCostReport = async () => {
    try {
      const params = {
        ...buildMaintenanceCaseQueryParams(filters),
        period: filters.reportPeriod || 'month',
        referenceDate: filters.reportReferenceDate || undefined,
        withCostOnly: filters.reportWithCostOnly ? 'true' : undefined,
      };
      const { data, headers } = await api.get('/maintenance/reports/cost-export', {
        params,
        responseType: 'blob',
      });
      const disposition = headers['content-disposition'] || '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] || 'maintenance-cost-report.csv';
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download report');
    }
  };

  const openCreate = () => {
    setSelectedCase(null);
    setModalOpen(true);
  };

  const openEdit = async (row) => {
    const { data } = await api.get(`/maintenance/cases/${row.id}`);
    setSelectedCase(data.case);
    setModalOpen(true);
  };

  const handleSave = async (form) => {
    const payload = buildPayload(form);
    if (!payload.truckId && !payload.trailerId) {
      throw Object.assign(new Error('Truck or trailer is required'), {
        response: { data: { message: 'Truck or trailer is required' } },
      });
    }
    if (selectedCase?.id) {
      await api.patch(`/maintenance/cases/${selectedCase.id}`, payload);
    } else {
      await api.post('/maintenance/cases', payload);
    }
    await loadCases();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this maintenance case?')) return;
    await api.delete(`/maintenance/cases/${id}`);
    setModalOpen(false);
    await loadCases();
  };

  const handleComment = async (id, text) => {
    const { data } = await api.post(`/maintenance/cases/${id}/comments`, { text });
    setSelectedCase(data.case);
    await loadCases();
  };

  const handleBoardComment = async (caseId, text) => {
    const { data } = await api.post(`/maintenance/cases/${caseId}/comments`, { text });
    await loadCases();
    return data.case;
  };

  const buildMenuItems = (row) => [
    {
      id: 'view',
      label: 'Open/View',
      onClick: () => openEdit(row),
    },
  ];

  const handleUpload = async (id, file) => {
    const body = new FormData();
    body.append('file', file);
    const { data } = await api.post(`/maintenance/cases/${id}/attachments`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setSelectedCase(data.case);
    await loadCases();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          TBF — Maintenance Case Tracker
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Centralized maintenance case tracking for trucks and trailers.
        </p>
      </div>

      <MaintenanceBoardToolbar
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        assignees={assignees}
        tagOptions={tagOptions}
        totalCount={totalCount}
        loading={loading}
        showNewCase={!readOnly}
        onNewCase={openCreate}
        onExportCostReport={handleExportCostReport}
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50">
            <tr>
              <th className="px-3 py-3 text-left">Case / Issue</th>
              <th className="px-3 py-3 text-left">Assignee</th>
              <th className="px-3 py-3 text-left">Due</th>
              <th className="px-3 py-3 text-left">Truck / Trailer</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Priority</th>
              <th className="px-3 py-3 text-left">Project</th>
              <th className="px-3 py-3 text-left">OOS</th>
              <th className="px-3 py-3 text-left">Type</th>
              <th className="px-3 py-3 text-left">Shop</th>
              <th className="px-3 py-3 text-left">Cost</th>
              <th className="px-3 py-3 text-left">Date closed</th>
              <th className="px-3 py-3 text-left">Invoice status</th>
              <th className="px-3 py-3 text-left">Dispatch status</th>
              <th className="px-3 py-3 text-left">Last update</th>
              <th className="px-3 py-3 text-left">Edited</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : cases.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-slate-500">
                  No maintenance cases yet.
                </td>
              </tr>
            ) : (
              cases.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onContextMenu={(event) => openContextMenu(event, buildMenuItems(row))}
                >
                  <td className="max-w-[12rem] px-3 py-2 font-medium">{row.issue}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {row.assigneeName || '—'}
                    {row.assigneeExtension ? ` x${row.assigneeExtension}` : ''}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 ${
                      isDueOverdue(row.dueDate) ? 'font-semibold text-red-600' : ''
                    }`}
                  >
                    {row.dueDateLabel || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      {row.truckNumber && (
                        <Link
                          to={`/safety/trucks?search=${encodeURIComponent(row.truckNumber)}`}
                          className="text-brand-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.truckNumber}
                        </Link>
                      )}
                      {row.trailerNumber && (
                        <Link
                          to={`/safety/trailers?search=${encodeURIComponent(row.trailerNumber)}`}
                          className="text-brand-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.trailerNumber}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <MaintenanceTagPill label={row.caseStatus} color={row.caseStatusColor} />
                  </td>
                  <td className="px-3 py-2">{row.priority}</td>
                  <td className="px-3 py-2">
                    <MaintenanceTagPill label={row.project} color={row.projectColor} />
                  </td>
                  <td className="px-3 py-2">{row.oosStatus}</td>
                  <td className="px-3 py-2">
                    <MaintenanceTagPill label={row.caseType} color={row.caseTypeColor} />
                  </td>
                  <td className="max-w-[8rem] truncate px-3 py-2">{row.repairShop || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {row.costLabel || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{row.dateClosedLabel || '—'}</td>
                  <td className="px-3 py-2">
                    {row.invoiceStatus ? (
                      <MaintenanceTagPill
                        label={row.invoiceStatus}
                        color={row.invoiceStatusColor}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.dispatchStatus ? (
                      <MaintenanceTagPill
                        label={row.dispatchStatus}
                        color={row.dispatchStatusColor}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <MaintenanceCommentsCell
                    maintenanceCase={row}
                    open={openCommentsCaseId === row.id}
                    onToggle={(caseId) =>
                      setOpenCommentsCaseId((current) => (current === caseId ? null : caseId))
                    }
                    onClose={() => setOpenCommentsCaseId(null)}
                    onSubmitComment={
                      readOnly ? undefined : (text) => handleBoardComment(row.id, text)
                    }
                    readOnly={readOnly}
                  />
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                    {row.lastEditedAtLabel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {contextMenuNode}

      <MaintenanceCaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        caseData={selectedCase}
        readOnly={readOnly}
        canDelete={canDeleteMaintenanceCases}
        onSave={handleSave}
        onDelete={handleDelete}
        onComment={handleComment}
        onUpload={handleUpload}
      />
    </div>
  );
}
