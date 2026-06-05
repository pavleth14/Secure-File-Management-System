import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FolderSidebar from '../components/FolderSidebar';
import FileTable from '../components/FileTable';
import FilePreviewModal from '../components/FilePreviewModal';
import { toId } from '../utils/format';

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
  const fileInputRef = useRef(null);

  const [rootFolder, setRootFolder] = useState(null);
  const [sidebarSubfolders, setSidebarSubfolders] = useState([]);
  const [currentSubfolders, setCurrentSubfolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
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
    console.log(data.subfolders);
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

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('folderId', rootId);
    if (selectedSubfolder) {
      formData.append('subfolderId', selectedSubfolder);
    }
    formData.append('file', file);

    setUploading(true);
    try {
      await api.post('/files/upload', formData);
      await loadFiles();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="-mx-4 my-1 flex min-h-[calc(100vh-8rem)] flex-col sm:-mx-6">
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
        <Link to="/folders" className="text-sm text-brand-600 hover:underline">
          ← All folders
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{rootFolder?.name}</h1>
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
          <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800">{currentFolderName}</h2>
              <div className="flex flex-wrap gap-2">
                {can(PERMS.UPLOAD) && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className={`cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 ${
                        uploading ? 'opacity-50' : ''
                      }`}
                    >
                      {uploading ? 'Uploading...' : 'Upload file'}
                    </label>
                  </>
                )}
              </div>
            </div>

            <input
              type="search"
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              placeholder="Search in this folder..."
              className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex-1 overflow-auto p-4 sm:p-6">
            {currentSubfolders.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Folders
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                          Name
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                          Open
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {currentSubfolders.map((sf) => (
                        <tr key={toId(sf._id)} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedSubfolder(toId(sf._id))}
                              className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline"
                            >
                              <span>📁</span>
                              {sf.name}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSubfolder(toId(sf._id))}
                              className="text-sm text-slate-600 hover:underline"
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
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
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
                emptyMessage={
                  folderSearch.trim()
                    ? 'No files match your search'
                    : 'No files in this location'
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
