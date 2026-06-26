import { useEffect, useState } from 'react';
import api from '../api/client';

export default function FilePreviewModal({ file, onClose, previewPath }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isPdf =
    file?.mimeType === 'application/pdf' || /\.pdf$/i.test(file?.originalName || '');

  useEffect(() => {
    if (!file) return undefined;

    let objectUrl;
    setLoading(true);
    setError('');

    api
      .get(previewPath || `/files/preview/${file._id}`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = window.URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => setError('Could not load preview'))
      .finally(() => setLoading(false));

    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [file, previewPath]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3 className="truncate pr-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {file.originalName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
        <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-auto p-4">
          {loading && <p className="text-slate-500 dark:text-slate-400">Loading preview...</p>}
          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
          {!loading && !error && url && (
            <>
              {isPdf ? (
                <iframe
                  src={url}
                  title={file.originalName}
                  className="h-[70vh] w-full rounded border border-slate-200"
                />
              ) : (
                <img
                  src={url}
                  alt={file.originalName}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
