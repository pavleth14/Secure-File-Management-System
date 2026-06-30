import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { formatDate, formatSize, toId } from '../utils/format';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/search', { params: { q: query.trim() } });
        setResults(data.files);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const openFile = (file) => {
    const rootId = toId(file.folderId);
    const subId = file.subfolderId ? toId(file.subfolderId) : null;
    const path = subId
      ? `/folders/${rootId}/files?subfolder=${subId}`
      : `/folders/${rootId}/files`;
    navigate(path);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className="relative w-full ">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
        placeholder="Search all files..."
        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
      />
      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {loading ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No files found</p>
          ) : (
            results.map((file) => (
              <button
                key={file._id}
                type="button"
                onClick={() => openFile(file)}
                className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
              >
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {file.originalName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {file.pathLabel || file.rootFolderName} · {formatSize(file.size)} ·{' '}
                  {formatDate(file.createdAt)}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
