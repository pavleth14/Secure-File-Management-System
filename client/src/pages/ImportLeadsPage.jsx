import { useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRecruiters } from '../hooks/useRecruitingData';
import ImportPreviewTable from '../components/recruiting/ImportPreviewTable';

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function ImportLeadsPage() {
  const { isRecruitingManager, isSuperAdmin } = useAuth();
  const { recruiters } = useRecruiters();
  const canUseSpecificUserImport = isRecruitingManager || isSuperAdmin;

  const fileInputRef = useRef(null);
  const specificFileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [importSummary, setImportSummary] = useState(null);
  const [specificRecruiterId, setSpecificRecruiterId] = useState('');
  const [exportRecruiterId, setExportRecruiterId] = useState('all');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const selectedCount = selectedRows.size;

  const previewStats = useMemo(() => {
    if (!preview) return null;
    return preview.summary;
  }, [preview]);

  const handleFileSelected = async (file, { assignedRecruiterId } = {}) => {
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
    if (assignedRecruiterId) {
      formData.append('assignedRecruiterId', assignedRecruiterId);
    }

    try {
      const { data } = await api.post('/recruiting/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreview(data);
      const defaults = new Set(
        (data.rows || []).filter((row) => row.defaultSelected).map((row) => row.rowNumber)
      );
      setSelectedRows(defaults);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to preview CSV import');
      setPreview(null);
      setSelectedRows(new Set());
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (specificFileInputRef.current) {
        specificFileInputRef.current.value = '';
      }
    }
  };

  const handleToggleRow = (rowNumber) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  const handleToggleAll = (checked) => {
    if (!preview) return;
    if (!checked) {
      setSelectedRows(new Set());
      return;
    }
    setSelectedRows(
      new Set(
        preview.rows.filter((row) => row.isValid).map((row) => row.rowNumber)
      )
    );
  };

  const handleConfirmImport = async () => {
    if (!preview || selectedCount === 0) return;

    setConfirming(true);
    setError('');

    try {
      const { data } = await api.post('/recruiting/import/confirm', {
        previewId: preview.previewId,
        selectedRowNumbers: Array.from(selectedRows),
      });

      setImportSummary(data.summary);
      setPreview(null);
      setSelectedRows(new Set());
      setSpecificRecruiterId('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm import');
    } finally {
      setConfirming(false);
    }
  };

  const resetImport = () => {
    setPreview(null);
    setSelectedRows(new Set());
    setImportSummary(null);
    setSpecificRecruiterId('');
    setError('');
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    setExportMessage('');

    try {
      const response = await api.get('/recruiting/leads/export', {
        params: {
          format: exportFormat,
          recruiterId: exportRecruiterId,
        },
        responseType: 'blob',
      });

      const ext = exportFormat === 'csv' ? 'csv' : 'xlsx';
      const mime =
        exportFormat === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([response.data], { type: mime });
      const disposition = response.headers['content-disposition'];
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const downloadName =
        filenameMatch?.[1] ||
        `leads-export-${exportRecruiterId === 'all' ? 'all-recruiters' : exportRecruiterId}-${Date.now()}.${ext}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      link.click();
      window.URL.revokeObjectURL(url);

      const recruiterLabel =
        exportRecruiterId === 'all'
          ? 'all recruiters'
          : recruiters.find((recruiter) => recruiter.id === exportRecruiterId)?.name ||
            'selected recruiter';
      setExportMessage(`Export downloaded for ${recruiterLabel}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export leads');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Import / Export Leads
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload a CSV to import leads, or download active board leads as a backup.
          </p>
        </div>
        {(preview || importSummary) && (
          <button
            type="button"
            onClick={resetImport}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Start new import
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {importSummary && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-900/40 dark:bg-green-900/20">
          <h2 className="text-lg font-semibold text-green-900 dark:text-green-200">Import complete</h2>
          <ul className="mt-3 space-y-1 text-sm text-green-800 dark:text-green-300">
            <li>Imported: {importSummary.imported} leads</li>
            <li>Skipped duplicates: {importSummary.skippedDuplicates} leads</li>
            <li>Invalid rows: {importSummary.invalidRows} leads</li>
          </ul>
        </div>
      )}

      {!preview && !importSummary && (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
              Upload CSV file
            </p>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              Expected columns: Status, Type of Driver, Source, Date, First Name, Last Name, Phone,
              State / City, Email (optional — placeholder assigned if empty), Comments, Comment 2, … Comment 10
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleFileSelected(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {uploading ? 'Processing CSV...' : 'Choose CSV file'}
            </button>
          </div>

          {canUseSpecificUserImport && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-600 dark:bg-slate-800">
              <p className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                Choose CSV file for specific user
              </p>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                Import all leads from the CSV to a selected recruiter board.
              </p>
              <div className="mx-auto flex max-w-md flex-col gap-3">
                <select
                  value={specificRecruiterId}
                  onChange={(event) => setSpecificRecruiterId(event.target.value)}
                  className={inputClass}
                  disabled={uploading}
                >
                  <option value="">Select recruiter</option>
                  {recruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.name}
                    </option>
                  ))}
                </select>
                <input
                  ref={specificFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) =>
                    handleFileSelected(event.target.files?.[0], {
                      assignedRecruiterId: specificRecruiterId,
                    })
                  }
                />
                <button
                  type="button"
                  disabled={uploading || !specificRecruiterId}
                  onClick={() => specificFileInputRef.current?.click()}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? 'Processing CSV...' : 'Choose CSV file for specific user'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Preview: {preview.fileName || 'CSV upload'}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {previewStats?.totalRows || 0} rows · {previewStats?.validRows || 0} valid ·{' '}
                  {previewStats?.duplicateRows || 0} duplicates · {previewStats?.invalidRows || 0}{' '}
                  invalid
                </p>
                {preview.assignedRecruiter && (
                  <p className="mt-1 text-sm text-brand-700 dark:text-brand-400">
                    Assigning all imported leads to: {preview.assignedRecruiter.name}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={confirming || selectedCount === 0}
                  onClick={handleConfirmImport}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirming ? 'Importing...' : `Confirm Import (${selectedCount})`}
                </button>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  Replace file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className={inputClass}
                    disabled={uploading || confirming}
                    onChange={(event) =>
                      handleFileSelected(event.target.files?.[0], {
                        assignedRecruiterId: preview.assignedRecruiter?.id,
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </div>

          <ImportPreviewTable
            rows={preview.rows}
            selectedRows={selectedRows}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
          />

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {preview.assignedRecruiter
              ? `Duplicates are deselected by default. Invalid rows cannot be imported. Leads will be assigned to ${preview.assignedRecruiter.name} after confirmation.`
              : 'Duplicates are deselected by default. Invalid rows cannot be imported. Leads will be assigned using round robin by driver type after confirmation.'}
          </p>
        </div>
      )}

      {canUseSpecificUserImport && (
        <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Export active leads
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Download a backup of active (non-archived) board leads as CSV or Excel. Choose all
              recruiters or one board.
            </p>
          </div>

          {exportMessage && (
            <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
              {exportMessage}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm text-slate-600 dark:text-slate-400">
              Recruiter scope
              <select
                value={exportRecruiterId}
                onChange={(event) => setExportRecruiterId(event.target.value)}
                className={`${inputClass} mt-1 w-full`}
                disabled={exporting}
              >
                <option value="all">All recruiters</option>
                {recruiters.map((recruiter) => (
                  <option key={recruiter.id} value={recruiter.id}>
                    {recruiter.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-600 dark:text-slate-400">
              Format
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value)}
                className={`${inputClass} mt-1 w-full`}
                disabled={exporting}
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? 'Preparing export...' : 'Download export'}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Columns match CSV import format (Status, driver type, source, contact fields, up to 10
            comments) plus assigned recruiter and lead ID.
          </p>
        </section>
      )}
    </div>
  );
}
