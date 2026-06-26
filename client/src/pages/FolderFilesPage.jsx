import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import FolderSidebar from '../components/FolderSidebar';
import FileTable from '../components/FileTable';
import FilePreviewModal from '../components/FilePreviewModal';
import UploadDropzone from '../components/UploadDropzone';
import { UploadCloudIcon } from '../components/icons';
import { toId } from '../utils/format';
import { useFavorites } from '../hooks/useFavorites';

const PERMS = {
  READ: 'READ',
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD',
  DELETE: 'DELETE',
};

export default function FolderFilesPage() {
  const { id: rootId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isSuperAdmin } = useAuth();
  const { enqueueFiles } = useUpload();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [rootFolder, setRootFolder] = useState(null);
  const [sidebarSubfolders, setSidebarSubfolders] = useState([]);
  const [currentSubfolders, setCurrentSubfolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSubfolder, setNewSubfolder] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [previewFile, setPreviewFile] = useState(null);

  const selectedSubfolder = searchParams.get('subfolder') || null;
  const canManageSubfolders = isSuperAdmin || isAdmin;

  const setSelectedSubfolder = (subfolderId) => {
    if (subfolderId) {
      setSearchParams({ subfolder: subfolderId });
    } else {
      setSearchParams({});
    }
  };

  const can = (action) =>
    isSuperAdmin || isAdmin || permissions.includes(action);

  const loadTree = useCallback(async () => {
    const { data } = await api.get(`/folders/${rootId}/tree`);
    setRootFolder(data.root);
    setSidebarSubfolders(data.subfolders || []);
    setPermissions(data.root.permissions || []);
  }, [rootId]);

  const loadFiles = useCallback(async () => {
    const params = {
      sortBy,
      sortDir,
      ...(selectedSubfolder ? { subfolderId: selectedSubfolder } : {}),
      ...(folderSearch.trim() ? { q: folderSearch.trim() } : {}),
    };
    const { data } = await api.get(`/files/${rootId}`, { params });
    setFiles(data.files);
    setCurrentSubfolders(data.subfolders || []);
  }, [rootId, selectedSubfolder, folderSearch, sortBy, sortDir]);

  useEffect(() => {
    loadTree().catch((err) =>
      setError(err.response?.data?.message || 'Failed to load folders')
    );
  }, [loadTree]);

  useEffect(() => {
    setLoading(true);
    loadFiles()
      .then(() => setError(''))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load files'))
      .finally(() => setLoading(false));
  }, [loadFiles]);

  const handleFiles = useCallback(
    (files) => {
      if (!files?.length) return;
      enqueueFiles(files, {
        folderId: rootId,
        subfolderId: selectedSubfolder,
        folderName: rootFolder?.name,
      });
    },
    [enqueueFiles, rootId, selectedSubfolder, rootFolder]
  );

  // Refresh the listing whenever an upload targeting this folder completes.
  useEffect(() => {
    const handleUploaded = (e) => {
      const detail = e.detail || {};
      const sameRoot = toId(detail.folderId) === toId(rootId);
      const sameSub =
        (detail.subfolderId || null) === (selectedSubfolder || null);
      if (sameRoot && sameSub) {
        loadFiles().catch(() => {});
      }
    };
    window.addEventListener('files:uploaded', handleUploaded);
    return () => window.removeEventListener('files:uploaded', handleUploaded);
  }, [rootId, selectedSubfolder, loadFiles]);

  const handleDownload = async (fileId, filename) => {
    try {
      const res = await api.get(`/files/download/${fileId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Download failed');
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Delete this file?')) return;
    try {
      await api.delete(`/files/${fileId}`);
      await loadFiles();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleCreateSubfolder = async ({ name, parentFolderId }) => {
    if (!name?.trim()) return;
  
    try {
      await api.post('/folders', {
        name: name.trim(),
        parentFolderId,
      });
  
      setNewSubfolder('');
      await loadTree();
      await loadFiles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create subfolder');
    }
  };

  const handleDeleteSubfolder = async (subfolderId, name) => {
    if (!confirm(`Delete subfolder "${name}"? It must be empty.`)) return;
    try {
      await api.delete(`/folders/${subfolderId}`);
      if (selectedSubfolder === subfolderId) setSelectedSubfolder(null);
      await loadTree();
      await loadFiles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete subfolder');
    }
  };

  const currentFolderName = selectedSubfolder
    ? sidebarSubfolders.find((s) => toId(s._id) === selectedSubfolder)?.name ||
      currentSubfolders.find((s) => toId(s._id) === selectedSubfolder)?.name ||
      'Subfolder'
    : '(root)';

  if (loading && !rootFolder) {
    return <div className="text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  const canUpload = can(PERMS.UPLOAD);

  return (
    <div className="-mx-4 my-1 flex min-h-[calc(100vh-8rem)] flex-col sm:-mx-6">
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      <div className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
        <Link to="/folders" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
          ← All folders
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{rootFolder?.name}</h1>
      </div>

      <div className="flex min-h-0 flex-1">
        <FolderSidebar
          rootFolder={rootFolder}
          subfolders={sidebarSubfolders}
          selectedSubfolderId={selectedSubfolder}
          onSelect={setSelectedSubfolder}
          canManageSubfolders={canManageSubfolders}
          newSubfolderName={newSubfolder}
          onNewSubfolderNameChange={setNewSubfolder}
          onCreateSubfolder={handleCreateSubfolder}
          onDeleteSubfolder={handleDeleteSubfolder}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{currentFolderName}</h2>
            </div>

            <input
              type="search"
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              placeholder="Search in this folder..."
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <UploadDropzone onFiles={handleFiles} disabled={!canUpload}>
            {({ openPicker }) => (
              <div className="flex-1 overflow-auto p-4 sm:p-6">
                {canUpload && (
                  <button
                    type="button"
                    onClick={openPicker}
                    className="mb-6 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-brand-500 hover:bg-brand-50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-brand-500 dark:hover:bg-brand-900/20"
                  >
                    <UploadCloudIcon className="text-3xl text-brand-600 dark:text-brand-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Drag &amp; drop files here, or{' '}
                      <span className="text-brand-600 dark:text-brand-400">browse</span>
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      You can upload multiple files at once (max 50MB each)
                    </span>
                  </button>
                )}

                {currentSubfolders.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Folders
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                              Name
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                              Open
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {currentSubfolders.map((sf) => (
                            <tr key={toId(sf._id)} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSubfolder(toId(sf._id))}
                                  className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                                >
                                  <span>📁</span>
                                  {sf.name}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSubfolder(toId(sf._id))}
                                  className="text-sm text-slate-600 hover:underline dark:text-slate-300"
                                >
                                  Open →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Files
                  </h3>
                  <FileTable
                    files={files}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSortChange={(field, dir) => {
                      setSortBy(field);
                      setSortDir(dir);
                    }}
                    canDownload={can(PERMS.DOWNLOAD)}
                    canDelete={can(PERMS.DELETE)}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    onPreview={setPreviewFile}
                    fileType="group"
                    isFavorite={isFavorite}
                    onToggleFavorite={toggleFavorite}
                    emptyMessage={
                      folderSearch.trim()
                        ? 'No files match your search'
                        : 'No files in this location'
                    }
                  />
                </div>
              </div>
            )}
          </UploadDropzone>
        </div>
      </div>
    </div>
  );
}
