import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaintenanceTagPill from '../../components/maintenance/MaintenanceTagPill';
import MaintenanceCaseModal from '../../components/maintenance/MaintenanceCaseModal';

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
  };
}

export default function MaintenanceBoardPage() {
  const { canEditMaintenanceCases, canDeleteMaintenanceCases } = useAuth();
  const readOnly = !canEditMaintenanceCases;

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/maintenance/cases', {
        params: { search: search.trim() || undefined, limit: 100 },
      });
      setCases(data.cases || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(loadCases, 250);
    return () => window.clearTimeout(timer);
  }, [loadCases]);

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
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          TBF — Maintenance Case Tracker
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Centralized maintenance case tracking for trucks and trailers.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search cases…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[14rem] flex-1 rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        {!readOnly && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            New case
          </button>
        )}
      </div>

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
              <th className="px-3 py-3 text-left">Last update</th>
              <th className="px-3 py-3 text-left">Edited</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : cases.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                  No maintenance cases yet.
                </td>
              </tr>
            ) : (
              cases.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onClick={() => openEdit(row)}
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
                  <td className="max-w-[14rem] truncate px-3 py-2 text-slate-600">
                    {row.latestCommentPreview || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                    {row.lastEditedAtLabel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
