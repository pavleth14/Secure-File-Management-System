import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { LOAD_STATUS_LABELS } from '../../constants/dispatchConstants';
import ContextMenu from '../../components/ContextMenu';
import { inputClass } from '../../components/dispatch-safety/SafetyListToolbar';
import LoadFormModal from '../../components/dispatch-safety/LoadFormModal';

export default function ArchiveLoadsPage() {
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [menu, setMenu] = useState(null);

  const loadLoads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dispatch/loads/archived', { params: { search } });
      setLoads(data.loads || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load archived loads');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(loadLoads, 250);
    return () => window.clearTimeout(timer);
  }, [loadLoads]);

  const openLoad = async (loadId) => {
    try {
      const { data } = await api.get(`/dispatch/loads/${loadId}`);
      setSelectedLoad(data.load);
      setModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load details');
    }
  };

  const menuItems = useMemo(() => {
    if (!menu?.load) return [];
    return [
      {
        id: 'view',
        label: 'View load',
        onClick: () => openLoad(menu.load.id),
      },
    ];
  }, [menu]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Archived Loads</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          View archived loads. Archived loads cannot be restored.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search archived loads..."
          className={`${inputClass} sm:max-w-xs`}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {['Load#', 'Route', 'Customer', 'Archived', 'Status'].map((label) => (
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
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : loads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No archived loads found.
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
                  <td className="px-4 py-3 text-sm">
                    {load.archivedAt ? new Date(load.archivedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {LOAD_STATUS_LABELS[load.status] || load.status}
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
        onSave={async () => {}}
        canEdit={false}
        canArchive={false}
        canMarkStatus={false}
        canComment={false}
      />

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
