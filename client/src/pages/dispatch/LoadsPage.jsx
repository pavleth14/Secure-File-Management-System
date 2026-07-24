import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { LOAD_STATUS_LABELS } from '../../constants/dispatchConstants';
import ContextMenu from '../../components/ContextMenu';
import { inputClass } from '../../components/dispatch-safety/SafetyListToolbar';
import LoadFormModal from '../../components/dispatch-safety/LoadFormModal';

export default function LoadsPage() {
  const {
    canCreateOrEditLoads,
    canArchiveLoads,
    canCommentOnLoads,
  } = useAuth();
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [menu, setMenu] = useState(null);

  const loadLoads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dispatch/loads', {
        params: {
          search,
          status: status === 'all' ? undefined : status,
        },
      });
      setLoads(data.loads || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load loads');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadLoads, 250);
    return () => window.clearTimeout(timer);
  }, [loadLoads]);

  const openCreate = () => {
    setSelectedLoad(null);
    setModalOpen(true);
  };

  const openLoad = async (loadId) => {
    try {
      const { data } = await api.get(`/dispatch/loads/${loadId}`);
      setSelectedLoad(data.load);
      setModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load details');
    }
  };

  const handleSave = async (form) => {
    const payload = {
      ...form,
      invoiceAmount: Number(form.invoiceAmount),
      loadedMiles: Number(form.loadedMiles),
      emptyMiles: Number(form.emptyMiles),
    };

    if (selectedLoad) {
      await api.put(`/dispatch/loads/${selectedLoad.id}`, payload);
    } else {
      await api.post('/dispatch/loads', payload);
    }
    await loadLoads();
  };

  const handleArchive = async (load) => {
    if (!confirm(`Archive Load #${load.loadNumber}?`)) return;
    try {
      await api.delete(`/dispatch/loads/${load.id}`);
      setModalOpen(false);
      await loadLoads();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to archive load');
    }
  };

  const handleMarkActive = async (load) => {
    try {
      await api.post(`/dispatch/loads/${load.id}/mark-active`);
      await openLoad(load.id);
      await loadLoads();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark load active');
    }
  };

  const handleMarkDelivered = async (load) => {
    try {
      await api.post(`/dispatch/loads/${load.id}/mark-delivered`);
      await openLoad(load.id);
      await loadLoads();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark load delivered');
    }
  };

  const handleMarkOpen = async (load) => {
    try {
      await api.post(`/dispatch/loads/${load.id}/mark-open`);
      await openLoad(load.id);
      await loadLoads();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark load open');
    }
  };

  const canMarkStatusForLoad = (load) =>
    canCreateOrEditLoads && Boolean(load?.id) && !load.archived;

  const menuItems = useMemo(() => {
    if (!menu?.load) return [];
    const load = menu.load;
    const items = [
      {
        id: 'view',
        label: canCreateOrEditLoads ? 'View / Edit load' : 'View load',
        onClick: () => openLoad(load.id),
      },
    ];

    if (canArchiveLoads) {
      items.push({
        id: 'archive',
        label: 'Archive load',
        destructive: true,
        onClick: () => handleArchive(load),
      });
    }

    return items;
  }, [menu, canCreateOrEditLoads, canArchiveLoads]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Loads</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create and manage dispatch loads across all boards.
          </p>
        </div>
        {canCreateOrEditLoads && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New Load
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search all fields..."
          className={`${inputClass} sm:max-w-xs`}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={`${inputClass} sm:max-w-[180px]`}
        >
          <option value="all">All statuses</option>
          {Object.entries(LOAD_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {['Load#', 'Route', 'Customer', 'Truck', 'Trailer', 'Status', 'Invoice'].map((label) => (
                <th
                  key={label}
                  className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : loads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  No loads found.
                </td>
              </tr>
            ) : (
              loads.map((load) => (
                <tr
                  key={load.id}
                  className="cursor-context-menu text-slate-900 dark:text-slate-100"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, load });
                  }}
                  onDoubleClick={() => openLoad(load.id)}
                >
                  <td className="px-4 py-3 text-sm font-medium">{load.loadNumber}</td>
                  <td className="px-4 py-3 text-sm">{load.boardLabel || '—'}</td>
                  <td className="px-4 py-3 text-sm">{load.customer}</td>
                  <td className="px-4 py-3 text-sm">{load.truckNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm">{load.trailerNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {load.isActive ? 'Active' : LOAD_STATUS_LABELS[load.status] || load.status}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {Number(load.invoiceAmount).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadFormModal
        load={selectedLoad}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={handleArchive}
        onMarkActive={handleMarkActive}
        onMarkOpen={handleMarkOpen}
        onMarkDelivered={handleMarkDelivered}
        canEdit={canCreateOrEditLoads}
        canArchive={canArchiveLoads}
        canMarkStatus={canMarkStatusForLoad(selectedLoad || {})}
        canComment={canCommentOnLoads}
      />

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
