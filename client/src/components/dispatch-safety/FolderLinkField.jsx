import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { inputClass } from './SafetyListToolbar';

export default function FolderLinkField({ value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);

  const loadFolders = useCallback(async (searchTerm) => {
    setLoading(true);
    try {
      const { data } = await api.get('/dispatch/folders/linkable', {
        params: searchTerm ? { search: searchTerm } : undefined,
      });
      setFolders(data.folders || []);
    } catch {
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders('');
  }, [loadFolders]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadFolders(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query, loadFolders]);

  useEffect(() => {
    if (!value) {
      setSelectedFolder(null);
      return;
    }

    const match = folders.find((folder) => (folder.id || folder._id)?.toString() === value.toString());
    if (match) {
      setSelectedFolder(match);
    }
  }, [value, folders]);

  const options = useMemo(() => {
    if (!value || !selectedFolder) return folders;
    const selectedId = selectedFolder.id || selectedFolder._id;
    if (folders.some((folder) => (folder.id || folder._id)?.toString() === selectedId?.toString())) {
      return folders;
    }
    return [selectedFolder, ...folders];
  }, [folders, selectedFolder, value]);

  const handleChange = (event) => {
    const nextValue = event.target.value || null;
    const folder = options.find(
      (item) => (item.id || item._id)?.toString() === nextValue?.toString()
    );
    setSelectedFolder(folder || null);
    onChange(nextValue);
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Linked folder
      </label>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
        placeholder="Search folders by name or path..."
        className={`${inputClass} mb-2`}
      />
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        className={inputClass}
      >
        <option value="">No folder linked</option>
        {options.map((folder) => {
          const folderId = folder.id || folder._id;
          return (
            <option key={folderId} value={folderId}>
              {folder.relativePath || folder.name}
            </option>
          );
        })}
      </select>
      {loading && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Searching folders...</p>
      )}
      {(selectedFolder?.relativePath || selectedFolder?.name) && value && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Selected: {selectedFolder.relativePath || selectedFolder.name}
        </p>
      )}
      {value && (
        <div className="mt-2 flex flex-wrap gap-3">
          <Link
            to={`/folders/${value}/files`}
            className="text-sm text-brand-600 hover:underline dark:text-brand-400"
          >
            View files
          </Link>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setSelectedFolder(null);
                onChange(null);
              }}
              className="text-sm text-red-600 hover:underline dark:text-red-400"
            >
              Unlink folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}
