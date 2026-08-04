import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { LEAD_BOARD_PAGE_SIZES } from '../constants/recruitingConstants';
import { getLeadDateRange } from '../utils/leadPermissions';
import { useLeadSources, useLeadStatuses, useRecruiters } from '../hooks/useRecruitingData';
import LeadBoardToolbar from '../components/recruiting/LeadBoardToolbar';
import OldLeadsTable from '../components/recruiting/OldLeadsTable';
import ImportPreviewTable from '../components/recruiting/ImportPreviewTable';
import AssignLeadModal from '../components/recruiting/AssignLeadModal';

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

function buildQueryParams(filters) {
  const { dateFrom, dateTo } = getLeadDateRange(
    filters.datePreset,
    filters.customStart,
    filters.customEnd
  );

  const params = {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  };

  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.driverType) params.driverType = filters.driverType;
  if (filters.source) params.source = filters.source;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  return params;
}

export default function OldLeadsPage() {
  const { sourceNames } = useLeadSources();
  const { statusNames } = useLeadStatuses();
  const { recruiters } = useRecruiters();
  const fileInputRef = useRef(null);

  const [oldLeads, setOldLeads] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    driverType: '',
    source: '',
    datePreset: 'all',
    customStart: '',
    customEnd: '',
    page: 1,
    limit: 25,
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [assignIds, setAssignIds] = useState([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedImportRows, setSelectedImportRows] = useState(new Set());
  const [importSummary, setImportSummary] = useState(null);

  const loadOldLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/recruiting/old-leads', {
        params: buildQueryParams(filters),
      });
      setOldLeads(data.oldLeads || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load old leads');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadOldLeads();
  }, [loadOldLeads]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters.page, filters.limit, filters.search, filters.status, filters.driverType, filters.source]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSortChange = (sortBy, sortDir) => {
    setFilters((prev) => ({ ...prev, sortBy, sortDir, page: 1 }));
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTogglePage = (checked) => {
    const pageIds = oldLeads.filter((lead) => !lead.isAssigned).map((lead) => lead.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        pageIds.forEach((id) => next.add(id));
      } else {
        pageIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const openAssignModal = (ids) => {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return;
    setAssignIds(uniqueIds);
    setAssignModalOpen(true);
  };

  const handleAssignConfirm = async (recruiterId) => {
    setAssignSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/recruiting/old-leads/assign', {
        oldLeadIds: assignIds,
        recruiterId,
      });
      setAssignModalOpen(false);
      setAssignIds([]);
      setSelectedIds(new Set());
      if (data.failed > 0) {
        setError(
          `Assigned ${data.assigned} lead(s). ${data.failed} failed: ${data.errors?.[0]?.message || ''}`
        );
      }
      await loadOldLeads();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign old leads');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleRoundRobinAssign = async (ids) => {
    const uniqueIds = [...new Set(ids.length ? ids : [...selectedIds])];
    if (!uniqueIds.length) return;

    if (!confirm(`Round robin assign ${uniqueIds.length} old lead(s)?`)) return;

    setError('');
    try {
      const { data } = await api.post('/recruiting/old-leads/assign/round-robin', {
        oldLeadIds: uniqueIds,
      });
      setSelectedIds(new Set());
      if (data.failed > 0) {
        setError(
          `Assigned ${data.assigned} lead(s). ${data.failed} failed: ${data.errors?.[0]?.message || ''}`
        );
      }
      await loadOldLeads();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to round robin assign old leads');
    }
  };

  const handleFileSelected = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are supported.');
      return;
    }

    setUploading(true);
    setError('');
    setImportSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/recruiting/old-leads/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
      const defaults = new Set(
        (data.rows || []).filter((row) => row.defaultSelected).map((row) => row.rowNumber)
      );
      setSelectedImportRows(defaults);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to preview CSV import');
      setPreview(null);
      setSelectedImportRows(new Set());
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!preview?.previewId) return;
    setConfirming(true);
    setError('');
    try {
      const { data } = await api.post('/recruiting/old-leads/import/confirm', {
        previewId: preview.previewId,
        selectedRowNumbers: [...selectedImportRows],
      });
      setImportSummary(data.summary);
      setPreview(null);
      setSelectedImportRows(new Set());
      await loadOldLeads();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to import old leads');
    } finally {
      setConfirming(false);
    }
  };

  const selectedCount = selectedIds.size;
  const importSelectedCount = selectedImportRows.size;

  const assignDescription = useMemo(() => {
    if (assignIds.length === 1) {
      const lead = oldLeads.find((item) => item.id === assignIds[0]);
      if (lead) return `${lead.firstName} ${lead.lastName}`;
    }
    if (assignIds.length > 1) {
      return `${assignIds.length} old leads selected`;
    }
    return 'Select a recruiter for the selected old leads.';
  }, [assignIds, oldLeads]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Old Leads</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Import legacy leads and assign them to recruiters. Assigned rows remain visible but
            cannot be reassigned.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => handleFileSelected(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Choose CSV'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {importSummary && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Imported {importSummary.imported} old lead(s). Skipped {importSummary.skippedDuplicates}{' '}
          duplicates and {importSummary.invalidRows} invalid rows.
        </div>
      )}

      {preview && (
        <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Import preview
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {preview.fileName || 'CSV file'} · {preview.summary?.totalRows || 0} rows
              </p>
            </div>
            <button
              type="button"
              disabled={confirming || importSelectedCount === 0}
              onClick={handleConfirmImport}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {confirming ? 'Importing...' : `Import ${importSelectedCount} selected`}
            </button>
          </div>
          <ImportPreviewTable
            rows={preview.rows || []}
            selectedRows={selectedImportRows}
            onToggleRow={(rowNumber) => {
              setSelectedImportRows((prev) => {
                const next = new Set(prev);
                if (next.has(rowNumber)) next.delete(rowNumber);
                else next.add(rowNumber);
                return next;
              });
            }}
            onToggleAll={(checked) => {
              const selectable = (preview.rows || []).filter((row) => row.isValid);
              setSelectedImportRows(
                checked ? new Set(selectable.map((row) => row.rowNumber)) : new Set()
              );
            }}
          />
        </div>
      )}

      {selectedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-900/20">
          <span className="text-sm font-medium text-brand-900 dark:text-brand-200">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={() => openAssignModal([...selectedIds])}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Assign to recruiter
          </button>
          <button
            type="button"
            onClick={() => handleRoundRobinAssign([...selectedIds])}
            className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:text-brand-200 dark:hover:bg-brand-900/40"
          >
            Round robin assign
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-slate-600 hover:underline dark:text-slate-300"
          >
            Clear selection
          </button>
        </div>
      )}

      <LeadBoardToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        filters={filters}
        onFilterChange={updateFilter}
        pageSizes={LEAD_BOARD_PAGE_SIZES}
        sources={sourceNames}
        statuses={statusNames}
      />

      <OldLeadsTable
        oldLeads={oldLeads}
        loading={loading}
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        onSortChange={handleSortChange}
        selectedIds={selectedIds}
        onToggleRow={handleToggleRow}
        onTogglePage={handleTogglePage}
        onAssignLead={openAssignModal}
        onRoundRobinAssign={handleRoundRobinAssign}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Showing {oldLeads.length} of {totalCount} old leads
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={filters.page <= 1 || loading}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            className={`${inputClass} disabled:opacity-50`}
          >
            Previous
          </button>
          <span>
            Page {filters.page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={filters.page >= totalPages || loading}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            className={`${inputClass} disabled:opacity-50`}
          >
            Next
          </button>
        </div>
      </div>

      <AssignLeadModal
        open={assignModalOpen}
        lead={assignIds.length === 1 ? oldLeads.find((item) => item.id === assignIds[0]) : null}
        recruiters={recruiters}
        onConfirm={handleAssignConfirm}
        onCancel={() => {
          setAssignModalOpen(false);
          setAssignIds([]);
        }}
        submitting={assignSubmitting}
        title="Assign Old Lead To Recruiter"
        description={assignDescription}
        confirmLabel="Assign old lead(s)"
      />
    </div>
  );
}
