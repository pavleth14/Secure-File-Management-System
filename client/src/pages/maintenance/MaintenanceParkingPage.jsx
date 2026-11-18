import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaintenanceParkingModal from '../../components/maintenance/MaintenanceParkingModal';
import { MAINTENANCE_PARKING_STATUSES } from '../../constants/maintenanceConstants';

export default function MaintenanceParkingPage() {
  const { canEditMaintenanceCases, canDeleteMaintenanceCases } = useAuth();
  const readOnly = !canEditMaintenanceCases;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (unitSearch.trim()) params.unit = unitSearch.trim();
      if (statusFilter.length) params.status = statusFilter.join(',');
      const { data } = await api.get('/maintenance/parking', { params });
      setRecords(data.records || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load parking records');
    } finally {
      setLoading(false);
    }
  }, [unitSearch, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadRecords, 250);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const openCreate = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const openRecord = (record) => {
    setSelected(record);
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (selected?.id) {
      await api.patch(`/maintenance/parking/${selected.id}`, payload);
    } else {
      await api.post('/maintenance/parking', payload);
    }
    await loadRecords();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this parking record?')) return;
    await api.delete(`/maintenance/parking/${id}`);
    setModalOpen(false);
    await loadRecords();
  };

  const toggleStatus = (status) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Parking</h1>
          <p className="text-sm text-slate-500">Track parking for fleet units.</p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            New parking
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <label className="block min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Unit #</span>
          <input
            type="search"
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            placeholder="Search unit…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        <fieldset className="min-w-[16rem] flex-1">
          <legend className="mb-1 text-xs font-medium uppercase text-slate-500">Status</legend>
          <div className="flex flex-wrap gap-2">
            {MAINTENANCE_PARKING_STATUSES.map((status) => (
              <label
                key={status}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-600"
              >
                <input
                  type="checkbox"
                  checked={statusFilter.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                {status}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No parking records found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50">
              <tr>
                {[
                  'Unit #',
                  'Start date',
                  'End date',
                  'Time',
                  'Address',
                  'Amount',
                  'Status',
                  'Info / note',
                ].map((label) => (
                  <th key={label} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {records.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  onClick={() => openRecord(row)}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{row.unitNumber}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.startDateLabel || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.endDateLabel || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.timeLabel || '—'}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2">{row.address || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {row.amountLabel || '—'}
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2" title={row.note}>
                    {row.note || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MaintenanceParkingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        record={selected}
        readOnly={readOnly}
        canDelete={canDeleteMaintenanceCases && Boolean(selected)}
        statuses={MAINTENANCE_PARKING_STATUSES}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}