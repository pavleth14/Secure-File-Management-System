import { useEffect, useState, useCallback, useMemo } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';

import api from '../api/client';

import { useAuth } from '../context/AuthContext';

import { useUpload } from '../context/UploadContext';

import FolderSidebar from '../components/FolderSidebar';

import FileTable from '../components/FileTable';

import FileExplorerBreadcrumb from '../components/FileExplorerBreadcrumb';

import FilePreviewModal from '../components/FilePreviewModal';

import UploadDropzone from '../components/UploadDropzone';

import { UploadCloudIcon } from '../components/icons';

import { toId } from '../utils/format';

import { buildSubfolderPath, getParentSubfolderId } from '../utils/folderPath';

import { useFavorites } from '../hooks/useFavorites';

import { useExtensionFilter } from '../hooks/useExtensionFilter';

import ExtensionFilterSelect from '../components/ExtensionFilterSelect';

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

  const extensionFilterResetKey = `${rootId}-${selectedSubfolder || 'root'}`;

  const {
    extensionFilter,
    setExtensionFilter,
    extensionOptions,
    filteredFiles,
  } = useExtensionFilter(files, extensionFilterResetKey);



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

      .catch((err) =>

        setError(err.response?.data?.message || 'Failed to load files')

      )

      .finally(() => setLoading(false));

  }, [loadFiles]);



  const breadcrumbSegments = useMemo(() => {

    const rootLabel = rootFolder?.name || 'Root';

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

        folderId: rootId,

        subfolderId: selectedSubfolder,

        folderName: rootFolder?.name,

      });

    },

    [enqueueFiles, rootId, selectedSubfolder, rootFolder]

  );



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



  if (loading && !rootFolder) {

    return <div className="text-slate-500 dark:text-slate-400">Loading...</div>;

  }



  const canUpload = can(PERMS.UPLOAD);

  const emptyMessage = extensionFilter !== 'all'
    ? `No ${extensionFilter.toUpperCase()} files in this location`
    : folderSearch.trim()

    ? 'No files match your search'

    : currentSubfolders.length > 0

      ? 'No files in this folder'

      : 'This folder is empty';



  return (

    <div className="-mx-4 my-1 flex min-h-[calc(100vh-8rem)] flex-col sm:-mx-6">

      {previewFile && (

        <FilePreviewModal

          file={previewFile}

          onClose={() => setPreviewFile(null)}

        />

      )}



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

          isFavorite={isFavorite}

          onToggleFavorite={toggleFavorite}

        />



        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

          <UploadDropzone

            onFiles={handleFiles}

            onValidationError={(messages) => setError(messages.join(' '))}

            disabled={!canUpload}

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



                    <div className="mt-3 flex flex-wrap items-center gap-3">

                      <input

                        type="search"

                        value={folderSearch}

                        onChange={(e) => setFolderSearch(e.target.value)}

                        placeholder="Search files in this folder…"

                        className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"

                      />



                      <ExtensionFilterSelect

                        value={extensionFilter}

                        onChange={setExtensionFilter}

                        options={extensionOptions}

                        id="folder-files-extension-filter"

                      />



                      {canUpload && (

                        <button

                          type="button"

                          onClick={openPicker}

                          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"

                        >

                          <UploadCloudIcon />

                          Upload

                        </button>

                      )}

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

                        files={filteredFiles}

                        onOpenFolder={setSelectedSubfolder}

                        onDeleteFolder={handleDeleteSubfolder}

                        canDeleteFolder={canManageSubfolders}

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


