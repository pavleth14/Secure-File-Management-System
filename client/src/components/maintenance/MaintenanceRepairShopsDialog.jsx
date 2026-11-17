import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import RepairShopLink from './RepairShopLink';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function MaintenanceRepairShopsDialog({ open, onClose, canEdit, onChanged }) {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadShops = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/maintenance/repair-shops', {
        params: { includeInactive: true },
      });
      setShops(data.shops || []);
      const nextDrafts = {};
      for (const shop of data.shops || []) {
        nextDrafts[shop.id] = shop.mapsUrl || '';
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load repair shops');
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadShops();
  }, [open, loadShops]);

  if (!open) return null;

  const handleCreate = async (event) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || !canEdit) return;
    setError('');
    try {
      await api.post('/maintenance/repair-shops', { name });
      setNewName('');
      await loadShops();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add shop');
    }
  };

  const saveMapsUrl = async (shop) => {
    if (!canEdit) return;
    setSavingId(shop.id);
    setError('');
    try {
      await api.patch(`/maintenance/repair-shops/${shop.id}`, {
        mapsUrl: drafts[shop.id] || '',
      });
      await loadShops();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save Maps link');
    } finally {
      setSavingId(null);
    }
  };

  const regenerateLink = async (shop) => {
    if (!canEdit) return;
    setSavingId(shop.id);
    setError('');
    try {
      const { data } = await api.patch(`/maintenance/repair-shops/${shop.id}`, {
        regenerateMapsUrl: true,
      });
      setDrafts((prev) => ({ ...prev, [shop.id]: data.shop.mapsUrl || '' }));
      await loadShops();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to regenerate link');
    } finally {
      setSavingId(null);
    }
  };

  const deactivateShop = async (shop) => {
    if (!canEdit) return;
    if (!confirm(`Remove "${shop.name}" from the active list? Existing cases keep this shop.`)) {
      return;
    }
    setError('');
    try {
      await api.delete(`/maintenance/repair-shops/${shop.id}`);
      await loadShops();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove shop');
    }
  };

  const reactivateShop = async (shop) => {
    if (!canEdit) return;
    try {
      await api.patch(`/maintenance/repair-shops/${shop.id}`, { isActive: true });
      await loadShops();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reactivate shop');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Repair shops</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Maps links are created automatically (United States). Edit a link if search is wrong.
              Maint. View cannot change shops.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
          >
            Close
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
        )}

        {canEdit && (
          <form onSubmit={handleCreate} className="mb-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                New shop name
              </label>
              <input
                className={inputClass}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. TRAILERMAX Tires & Trailer Repair"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Add (auto Maps link)
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {shops.length === 0 ? (
              <li className="py-4 text-sm text-slate-500">No shops yet. Add one or type a name on a case.</li>
            ) : (
              shops.map((shop) => (
                <li key={shop.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {shop.name}
                        {!shop.isActive && (
                          <span className="ml-2 text-xs font-normal text-amber-600">Inactive</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm">
                        <RepairShopLink shop={shop.name} mapsUrl={shop.mapsLink} />
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        {shop.isActive ? (
                          <button
                            type="button"
                            onClick={() => deactivateShop(shop)}
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            Remove from list
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => reactivateShop(shop)}
                            className="text-xs text-brand-600 hover:underline"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {canEdit && shop.isActive && (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="min-w-0 flex-1 text-xs text-slate-500">
                        Maps link (editable)
                        <input
                          className={`${inputClass} mt-1`}
                          value={drafts[shop.id] ?? ''}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [shop.id]: e.target.value }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={savingId === shop.id}
                        onClick={() => saveMapsUrl(shop)}
                        className="rounded border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-600"
                      >
                        Save link
                      </button>
                      <button
                        type="button"
                        disabled={savingId === shop.id}
                        onClick={() => regenerateLink(shop)}
                        className="rounded border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-600"
                      >
                        Regenerate (auto)
                      </button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}