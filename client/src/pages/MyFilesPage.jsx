import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import FolderSidebar from '../components/FolderSidebar';
import FileTable from '../components/FileTable';
import FileExplorerBreadcrumb from '../components/FileExplorerBreadcrumb';
import FilePreviewModal from '../components/FilePreviewModal';
import UploadDropzone from '../components/UploadDropzone';
import { UploadCloudIcon } from '../components/icons';
import { useFavorites } from '../hooks/useFavorites';
import { useUpload } from '../context/UploadContext';
import { useExtensionFilter } from '../hooks/useExtensionFilter';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  useResizableSidebar,
  MY_FILES_SIDEBAR_STORAGE_KEY,
} from '../hooks/useResizableSidebar';
import { filterFilesBySearch } from '../utils/extensionFilter';
import { buildSubfolderPath, getParentSubfolderId } from '../utils/folderPath';
import ExtensionFilterSelect from '../components/ExtensionFilterSelect';
import SidebarResizeHandle from '../components/SidebarResizeHandle';

export default function MyFilesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { enqueueFiles } = useUpload();
  const { width: sidebarWidth, isResizing, startResize } = useResizableSidebar(
    MY_FILES_SIDEBAR_STORAGE_KEY
  );

  const [rootFolder, setRootFolder] = useState(null);
  const [sidebarSubfolders, setSidebarSubfolders] = useState([]);
  const [currentSubfolders, setCurrentSubfolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSubfolder, setNewSubfolder] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [previewFile, setPreviewFile] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 250);

  const selectedSubfolder = searchParams.get('folder') || null;
  const extensionFilterResetKey = `my-files-${selectedSubfolder || 'root'}`;

  const {
    extensionFilter,
    setExtensionFilter,
    extensionOptions,
    filteredFiles: extensionFilteredFiles,
  } = useExtensionFilter(files, extensionFilterResetKey);

  const displayedFiles = useMemo(
    () => filterFilesBySearch(extensionFilteredFiles, debouncedSearch),
    [extensionFilteredFiles, debouncedSearch]
  );

  const setSelectedSubfolder = (subfolderId) => {
    if (subfolderId) {
      setSearchParams({ folder: subfolderId });
    } else {
      setSearchParams({});
    }
  };

  const loadTree = useCallback(async () => {
    const { data } = await api.get('/my-files/tree');
    setRootFolder(data.root);
    setSidebarSubfolders(data.subfolders || []);
  }, []);

  const loadFiles = useCallback(async () => {
    const params = {
      sortBy,
      sortDir,
      ...(selectedSubfolder ? { personalFolderId: selectedSubfolder } : {}),
    };
    const { data } = await api.get('/my-files', { params });
    setFiles(data.files || []);
    setCurrentSubfolders(data.subfolders || []);
  }, [selectedSubfolder, sortBy, sortDir]);

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

  useEffect(() => {
    const handleUploaded = (e) => {
      const detail = e.detail || {};
      if (detail.uploadTarget !== 'personal') return;

      const sameFolder =
        (detail.personalFolderId || null) === (selectedSubfolder || null);
      if (sameFolder) {
        loadFiles().catch(() => {});
        loadTree().catch(() => {});
      }
    };

    window.addEventListener('files:uploaded', handleUploaded);
    return () => window.removeEventListener('files:uploaded', handleUploaded);
  }, [selectedSubfolder, loadFiles, loadTree]);

  const breadcrumbSegments = useMemo(() => {
    const rootLabel = rootFolder?.name || 'My Files';
    const rootSegment = { id: null, label: rootLabel };
    const subPath = buildSubfolderPath(
      sidebarSubfolders,
      selectedSubfolder,
      rootFolder?._id
    ).map((segment) => ({ id: segment.id, label: segment.name }));

    return [rootSegment, ...subPath];
  }, [rootFolder, sidebarSubfolders, selectedSubfolder]);

  const handleBack = () => {
    if (!selectedSubfolder) {
      window.history.back();
      return;
    }

    const parentId = getParentSubfolderId(
      sidebarSubfolders,
      selectedSubfolder,
      rootFolder?._id
    );
    setSelectedSubfolder(parentId);
  };

  const handleBreadcrumbNavigate = (segmentId) => {
    setSelectedSubfolder(segmentId);
  };

  const handleFiles = useCallback(
    (fileList) => {
      if (!fileList?.length) return;
      enqueueFiles(fileList, {
        uploadTarget: 'personal',
        personalFolderId: selectedSubfolder,
        folderName: 'My Files',
      });
    },
    [enqueueFiles, selectedSubfolder]
  );

  const handleDownload = async (fileId, filename) => {
    try {
      const res = await api.get(`/my-files/download/${fileId}`, {
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
    if (!confirm('Delete this file from My Files?')) return;
    try {
      await api.delete(`/my-files/${fileId}`);
      await loadFiles();
      await loadTree();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleCreateSubfolder = async ({ name, parentFolderId }) => {
    if (!name?.trim()) return;

    try {
      await api.post('/my-files/folders', {
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
      await api.delete(`/my-files/folders/${subfolderId}`);
      if (selectedSubfolder === subfolderId) setSelectedSubfolder(null);
      await loadTree();
      await loadFiles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete subfolder');
    }
  };

  if (loading && !rootFolder) {
    return <div className="text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  const emptyMessage = debouncedSearch
    ? 'No files match your search'
    : extensionFilter !== 'all'
      ? `No ${extensionFilter.toUpperCase()} files here`
      : currentSubfolders.length > 0
        ? 'No files in this folder'
        : 'No files in My Files yet';

  return (
    <div className="-mx-4 my-1 flex min-h-[calc(100vh-8rem)] flex-col sm:-mx-6">
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          previewPath={`/my-files/preview/${previewFile._id}`}
          onClose={() => setPreviewFile(null)}
        />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <FolderSidebar
          width={sidebarWidth}
          rootFolder={rootFolder}
          subfolders={sidebarSubfolders}
          selectedSubfolderId={selectedSubfolder}
          onSelect={setSelectedSubfolder}
          canManageSubfolders
          newSubfolderName={newSubfolder}
          onNewSubfolderNameChange={setNewSubfolder}
          onCreateSubfolder={handleCreateSubfolder}
          onDeleteSubfolder={handleDeleteSubfolder}
          virtualRoot
          sidebarTitle="My Files"
          showFolderFavorites={false}
        />

        <SidebarResizeHandle onMouseDown={startResize} isResizing={isResizing} />

        <div className="flex mx-auto mr-80 w-full max-w-7xl flex-1 flex-col space-y-8 overflow-hidden bg-slate-50 dark:bg-slate-950">
          <UploadDropzone
            onFiles={handleFiles}
            onValidationError={(messages) => setError(messages.join(' '))}
          >
            {({ openPicker }) => (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
                    <FileExplorerBreadcrumb
                      segments={breadcrumbSegments}
                      onNavigate={handleBreadcrumbNavigate}
                      onBack={handleBack}
                    />

                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Your private storage space. Files here are visible only to you.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="🔎︎  Search files..."
                        className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 sm:max-w-xs"
                      />

                      <ExtensionFilterSelect
                        value={extensionFilter}
                        onChange={setExtensionFilter}
                        options={extensionOptions}
                        id="my-files-extension-filter"
                      />

                      <button
                        type="button"
                        onClick={openPicker}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                      >
                        <UploadCloudIcon />
                        Upload
                      </button>

                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        Max 50MB per file · 50GB total
                      </span>
                    </div>

                    {error && (
                      <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        {error}
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto">
                    {loading ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Loading…
                      </p>
                    ) : (
                      <FileTable
                        embedded
                        folders={currentSubfolders}
                        files={displayedFiles}
                        onOpenFolder={setSelectedSubfolder}
                        onDeleteFolder={handleDeleteSubfolder}
                        canDeleteFolder
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSortChange={(field, dir) => {
                          setSortBy(field);
                          setSortDir(dir);
                        }}
                        canDownload
                        canDelete
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        onPreview={setPreviewFile}
                        fileType="personal"
                        isFavorite={isFavorite}
                        onToggleFavorite={toggleFavorite}
                        emptyMessage={emptyMessage}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </UploadDropzone>
        </div>
      </div>
    </div>
  );
}
