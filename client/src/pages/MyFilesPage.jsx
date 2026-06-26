import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import FileTable from '../components/FileTable';
import FilePreviewModal from '../components/FilePreviewModal';
import UploadDropzone from '../components/UploadDropzone';
import { UploadCloudIcon } from '../components/icons';
import { useFavorites } from '../hooks/useFavorites';
import { MAX_FILE_SIZE } from '../context/UploadContext';

export default function MyFilesPage() {
  const { isFavorite, toggleFavorite } = useFavorites();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

  const uploadFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;

    setUploading(true);
    setError('');

    for (const file of list) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the 50MB upload limit`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        await api.post('/my-files/upload', formData);
      } catch (err) {
        setError(err.response?.data?.message || `Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    await loadFiles();
  };

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

      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Files</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your private storage space. Files here are visible only to you.
        </p>
      </div>

      <UploadDropzone onFiles={uploadFiles} disabled={uploading}>
        {({ openPicker }) => (
          <div className="flex-1 overflow-auto p-4 sm:p-6">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={openPicker}
              disabled={uploading}
              className="mb-6 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-brand-500 dark:hover:bg-brand-900/20"
            >
              <UploadCloudIcon className="text-3xl text-brand-600 dark:text-brand-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {uploading ? 'Uploading...' : 'Drag & drop files here, or browse'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Private to you · max 50MB per file · 50GB total for My Files
              </span>
            </button>

            <FileTable
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
        )}
      </UploadDropzone>
    </div>
  );
}
