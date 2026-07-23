import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { inputClass } from './SafetyListToolbar';

export default function FolderLinkField({ value, onChange, disabled }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadFolders() {
      try {
        const { data } = await api.get('/folders');
        if (!cancelled) {
          setFolders(data.folders || []);
        }
      } catch {
        if (!cancelled) setFolders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFolders();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Linked folder
      </label>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled || loading}
        className={inputClass}
      >
        <option value="">No folder linked</option>
        {folders.map((folder) => (
          <option key={folder.id || folder._id} value={folder.id || folder._id}>
            {folder.relativePath || folder.name}
          </option>
        ))}
      </select>
      {value && (
        <Link
          to={`/folders/${value}/files`}
          className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          View files
        </Link>
      )}
    </div>
  );
}
