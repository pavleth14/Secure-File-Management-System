import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import PermissionBadge from '../components/PermissionBadge';
import { toId } from '../utils/format';

export default function FoldersPage() {
  const { isSuperAdmin } = useAuth();
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
    return <div className="text-slate-500">Loading folders...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Folders</h1>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {showCreate ? 'Cancel' : '+ New root folder'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-green-700">{success}</div>
      )}

      {isSuperAdmin && showCreate && (
        <form
          onSubmit={handleCreateRoot}
          className="mb-6 flex gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="folder6"
            required
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            Create
          </button>
        </form>
      )}

      {folders.length === 0 ? (
        <p className="text-slate-500">No folders available. Contact an administrator.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => {
            const folderId = toId(folder._id);
            const isEditing = editingId === folderId;

            return (
              <div
                key={folderId}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  {isEditing ? (
                    <form
                      className="flex flex-1 gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRenameRoot(folderId);
                      }}
                    >
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 rounded border px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button type="submit" className="text-sm text-brand-600">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-sm text-slate-500"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <Link
                      to={`/folders/${folderId}/files`}
                      className="flex flex-1 items-center gap-3 hover:opacity-80"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-100 text-2xl">
                        📁
                      </div>
                      <h2 className="text-lg font-semibold text-slate-900">{folder.name}</h2>
                    </Link>
                  )}
                </div>

                <div className="mb-3 flex flex-wrap gap-1">
                  {(folder.permissions || []).map((p) => (
                    <PermissionBadge key={p} permission={p} />
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/folders/${folderId}/files`}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    Open →
                  </Link>
                  {isSuperAdmin && !isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(folderId);
                          setEditName(folder.name);
                        }}
                        className="text-sm text-slate-600 hover:underline"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoot(folderId, folder.name)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
