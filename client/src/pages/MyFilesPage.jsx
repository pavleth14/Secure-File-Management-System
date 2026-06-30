import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import FileTable from '../components/FileTable';
import FileExplorerBreadcrumb from '../components/FileExplorerBreadcrumb';
import FilePreviewModal from '../components/FilePreviewModal';
import UploadDropzone from '../components/UploadDropzone';
import { UploadCloudIcon } from '../components/icons';
import { useFavorites } from '../hooks/useFavorites';
import { useUpload } from '../context/UploadContext';

export default function MyFilesPage() {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { enqueueFiles } = useUpload();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [previewFile, setPreviewFile] = useState(null);

  const loadFiles = useCallback(async () => {
    const { data } = await api.get('/my-files', { params: { sortBy, sortDir } });
    setFiles(data.files || []);
  }, [sortBy, sortDir]);

  useEffect(() => {
    setLoading(true);
    loadFiles()
      .then(() => setError(''))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load files'))
      .finally(() => setLoading(false));
  }, [loadFiles]);

  useEffect(() => {
    const handleUploaded = (e) => {
      if (e.detail?.uploadTarget === 'personal') {
        loadFiles().catch(() => {});
      }
    };

    window.addEventListener('files:uploaded', handleUploaded);
    return () => window.removeEventListener('files:uploaded', handleUploaded);
  }, [loadFiles]);

  const handleFiles = useCallback(
    (fileList) => {
      if (!fileList?.length) return;
      enqueueFiles(fileList, {
        uploadTarget: 'personal',
        folderName: 'My Files',
      });
    },
    [enqueueFiles]
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
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) {
    return <div className="text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <div className="-mx-4 my-1 flex min-h-[calc(100vh-8rem)] flex-col sm:-mx-6">
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          previewPath={`/my-files/preview/${previewFile._id}`}
          onClose={() => setPreviewFile(null)}
        />
      )}

      <UploadDropzone
        onFiles={handleFiles}
        onValidationError={(messages) => setError(messages.join(' '))}
      >
        {({ openPicker }) => (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
                <FileExplorerBreadcrumb
                  segments={[{ id: null, label: 'My Files' }]}
                  onNavigate={() => {}}
                  onBack={() => navigate(-1)}
                />

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Your private storage space. Files here are visible only to you.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
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
                <FileTable
                  embedded
                  files={files}
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
                  emptyMessage="No files in My Files yet"
                />
              </div>
            </div>
          </div>
        )}
      </UploadDropzone>
    </div>
  );
}
