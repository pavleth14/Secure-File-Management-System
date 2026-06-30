import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import PermissionBadge from '../components/PermissionBadge';
import FileExplorerBreadcrumb from '../components/FileExplorerBreadcrumb';
import { StarIcon } from '../components/icons';
import { useFavorites } from '../hooks/useFavorites';
import { toId } from '../utils/format';

export default function FoldersPage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/folders')
      .then((res) => {
        setFolders(res.data.folders);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load folders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateRoot = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post('/folders', { name: newName.trim() });
      setNewName('');
      setShowCreate(false);
      setSuccess('Root folder created.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create folder');
    }
  };

  const handleRenameRoot = async (folderId) => {
    if (!editName.trim()) return;
    try {
      await api.put(`/folders/${folderId}`, { name: editName.trim() });
      setEditingId(null);
      setSuccess('Folder renamed.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to rename folder');
    }
  };

  const handleDeleteRoot = async (folderId, name) => {
    if (!confirm(`Delete root folder "${name}"? It must be empty.`)) return;
    try {
      await api.delete(`/folders/${folderId}`);
      setSuccess('Root folder deleted.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete folder');
    }
  };

  if (loading) {
    return <div className="text-slate-500 dark:text-slate-400">Loading folders...</div>;
  }

  return (
    <div className="-mx-4 my-1 flex min-h-[calc(100vh-8rem)] flex-col sm:-mx-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
            <FileExplorerBreadcrumb
              segments={[{ id: null, label: 'Folders' }]}
              onNavigate={() => {}}
              onBack={() => navigate(-1)}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Open a folder to browse files and subfolders.
              </p>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreate(!showCreate)}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  {showCreate ? 'Cancel' : '+ New root folder'}
                </button>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
                {success}
              </div>
            )}

            {isSuperAdmin && showCreate && (
              <form
                onSubmit={handleCreateRoot}
                className="mt-3 flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New folder name"
                  required
                  className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white"
                >
                  Create
                </button>
              </form>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="w-10 px-2 py-3 text-center text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    ★
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    Permissions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {folders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      No folders available. Contact an administrator.
                    </td>
                  </tr>
                ) : (
                  folders.map((folder) => {
                    const folderId = toId(folder._id);
                    const isEditing = editingId === folderId;
                    const favorited = isFavorite('folder', folderId);

                    return (
                      <tr
                        key={folderId}
                        className="text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                      >
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleFavorite('folder', folderId)}
                            className={`rounded p-1 transition-colors ${
                              favorited
                                ? 'text-amber-500 hover:text-amber-600'
                                : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
                            }`}
                            aria-label={
                              favorited ? 'Remove folder from favorites' : 'Add folder to favorites'
                            }
                          >
                            <StarIcon filled={favorited} className="text-base" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {isEditing ? (
                            <form
                              className="flex flex-wrap items-center gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleRenameRoot(folderId);
                              }}
                            >
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="rounded border px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                autoFocus
                              />
                              <button type="submit" className="text-sm text-brand-600 dark:text-brand-400">
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-sm text-slate-500 dark:text-slate-400"
                              >
                                Cancel
                              </button>
                            </form>
                          ) : (
                            <Link
                              to={`/folders/${folderId}/files`}
                              className="inline-flex items-center gap-2 text-brand-600 hover:underline dark:text-brand-400"
                            >
                              <span aria-hidden>📁</span>
                              {folder.name}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(folder.permissions || []).map((p) => (
                              <PermissionBadge key={p} permission={p} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Link
                            to={`/folders/${folderId}/files`}
                            className="mr-3 text-sm text-brand-600 hover:underline dark:text-brand-400"
                          >
                            Open
                          </Link>
                          {isSuperAdmin && !isEditing && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(folderId);
                                  setEditName(folder.name);
                                }}
                                className="mr-3 text-sm text-slate-600 hover:underline dark:text-slate-300"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRoot(folderId, folder.name)}
                                className="text-sm text-red-600 hover:underline dark:text-red-400"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
