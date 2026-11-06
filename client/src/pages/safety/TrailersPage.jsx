import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ContextMenu from '../../components/ContextMenu';
import SafetyListToolbar from '../../components/dispatch-safety/SafetyListToolbar';
import TrailerFormModal from '../../components/dispatch-safety/TrailerFormModal';
import LinkedFolderCell, { buildViewFilesMenuItem } from '../../components/dispatch-safety/LinkedFolderCell';
import EquipmentImportButton from '../../components/dispatch-safety/EquipmentImportButton';

export default function TrailersPage() {
  const { canEditSafetyEntities, canDeleteSafetyEntities, canLinkFolders } = useAuth();
  const [trailers, setTrailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [status, setStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState(null);
  const [menu, setMenu] = useState(null);
  const [importResult, setImportResult] = useState(null);

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

  const handleImportTrailers = async (file) => {
    const body = new FormData();
    body.append('file', file);
    const { data } = await api.post('/dispatch/trailers/import', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setImportResult(data);
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

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <SafetyListToolbar
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            onNew={openCreate}
            newLabel="New Trailer"
            canCreate={canEditSafetyEntities}
          />
        </div>
        {canEditSafetyEntities && (
          <EquipmentImportButton label="Import trailers (CSV/Excel)" onImport={handleImportTrailers} />
        )}
      </div>

      {importResult && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-slate-800 dark:text-slate-100">
              Import finished: {importResult.created ?? 0} trailer(s) created
              {(importResult.errors?.length ?? 0) > 0
                ? `, ${importResult.errors.length} row error(s)`
                : ''}
              .
            </p>
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className="text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              Dismiss
            </button>
          </div>
          {importResult.errors?.length > 0 && (
            <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-red-700 dark:text-red-300">
              {importResult.errors.slice(0, 50).map((rowErr) => (
                <li key={`${rowErr.row}-${rowErr.message}`}>
                  Row {rowErr.row}: {rowErr.message}
                </li>
              ))}
              {importResult.errors.length > 50 && (
                <li>…and {importResult.errors.length - 50} more</li>
              )}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Required columns: Trailer# / Unit# / Unit (first column works), VIN / Vin#. Optional: Type, Status, Active, Size, Make,
            Model, Year, Plate#, DOT Inspection Expiration, Plates Expiration. VIN must be unique;
            duplicate rows in the file are skipped.
          </p>
        </div>
      )}

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
