import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ContextMenu from '../../components/ContextMenu';
import SafetyListToolbar from '../../components/dispatch-safety/SafetyListToolbar';
import TrailerFormModal from '../../components/dispatch-safety/TrailerFormModal';
import LinkedFolderCell, { buildViewFilesMenuItem } from '../../components/dispatch-safety/LinkedFolderCell';

export default function TrailersPage() {
  const { canEditSafetyEntities, canDeleteSafetyEntities, canLinkFolders } = useAuth();
  const [trailers, setTrailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState(null);
  const [menu, setMenu] = useState(null);

  const loadTrailers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dispatch/trailers', {
        params: { search, status: status === 'all' ? undefined : status },
      });
      setTrailers(data.trailers || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trailers');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadTrailers, 250);
    return () => window.clearTimeout(timer);
  }, [loadTrailers]);

  const openCreate = () => {
    setSelectedTrailer(null);
    setModalOpen(true);
  };

  const openEdit = (trailer) => {
    setSelectedTrailer(trailer);
    setModalOpen(true);
  };

  const handleSave = async (form) => {
    if (selectedTrailer) {
      await api.put(`/dispatch/trailers/${selectedTrailer.id}`, form);
    } else {
      await api.post('/dispatch/trailers', form);
    }
    await loadTrailers();
  };

  const handleDelete = async (trailer) => {
    if (!confirm(`Delete trailer ${trailer.trailerNumber}?`)) return;
    try {
      await api.delete(`/dispatch/trailers/${trailer.id}`);
      await loadTrailers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete trailer');
    }
  };

  const menuItems = useMemo(() => {
    if (!menu?.trailer) return [];
    const trailer = menu.trailer;
    const items = [
      {
        id: 'view',
        label: 'View / Edit trailer',
        onClick: () => openEdit(trailer),
      },
    ];

    const viewFilesItem = buildViewFilesMenuItem(trailer);
    if (viewFilesItem) items.push(viewFilesItem);

    if (canDeleteSafetyEntities) {
      items.push({
        id: 'delete',
        label: 'Delete trailer',
        destructive: true,
        onClick: () => handleDelete(trailer),
      });
    }

    return items;
  }, [menu, canDeleteSafetyEntities]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Trailers</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage fleet trailers, statuses, and folder links.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <SafetyListToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        onNew={openCreate}
        newLabel="New Trailer"
        canCreate={canEditSafetyEntities}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {['Trailer#', 'Type', 'Status', 'Size', 'Make', 'Model', 'Plate#', 'Folder'].map((label) => (
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
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : trailers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  No trailers found.
                </td>
              </tr>
            ) : (
              trailers.map((trailer) => (
                <tr
                  key={trailer.id}
                  className="cursor-context-menu text-slate-900 dark:text-slate-100"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, trailer });
                  }}
                >
                  <td className="px-4 py-3 text-sm font-medium">{trailer.trailerNumber}</td>
                  <td className="px-4 py-3 text-sm">{trailer.type || '—'}</td>
                  <td className="px-4 py-3 text-sm">{trailer.status}</td>
                  <td className="px-4 py-3 text-sm">{trailer.size || '—'}</td>
                  <td className="px-4 py-3 text-sm">{trailer.make || '—'}</td>
                  <td className="px-4 py-3 text-sm">{trailer.model || '—'}</td>
                  <td className="px-4 py-3 text-sm">{trailer.plateNumber || '—'}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-sm">
                    <LinkedFolderCell
                      linkedFolderId={trailer.linkedFolderId}
                      linkedFolderPath={trailer.linkedFolderPath}
                      linkedFolderName={trailer.linkedFolderName}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TrailerFormModal
        trailer={selectedTrailer}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        canEdit={canEditSafetyEntities}
        canLinkFolder={canLinkFolders}
      />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
