import { formatSize, formatDate } from '../utils/format';
import { isPreviewableFile } from '../utils/filePreview';

const SORTABLE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
  { key: 'date', label: 'Upload date' },
  { key: 'uploadedBy', label: 'Uploaded by' },
];

function SortableHeader({ columnKey, label, sortBy, sortDir, onSort }) {
  const active = sortBy === columnKey;
  return (
    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 ${
          active ? 'text-brand-700 dark:text-brand-400' : ''
        }`}
      >
        {label}
        {active && <span aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

export default function FileTable({
  files,
  sortBy,
  sortDir,
  onSortChange,
  canDownload,
  canDelete,
  onDownload,
  onDelete,
  onPreview,
  emptyMessage = 'No files in this location',
}) {
  const handleSort = (key) => {
    if (sortBy === key) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(key, 'asc');
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-700/50">
          <tr>
            {SORTABLE_COLUMNS.map((col) => (
              <SortableHeader
                key={col.key}
                columnKey={col.key}
                label={col.label}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
            ))}
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {files.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            files.map((file) => {
              const previewable = isPreviewableFile(file);
              return (
                <tr key={file._id} className="text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {previewable ? (
                      <button
                        type="button"
                        onClick={() => onPreview(file)}
                        className="text-left text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {file.originalName}
                      </button>
                    ) : (
                      file.originalName
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {formatSize(file.size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(file.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {file.uploadedBy?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canDownload && (
                      <button
                        type="button"
                        onClick={() => onDownload(file._id, file.originalName)}
                        className="mr-2 text-sm text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Download
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(file._id)}
                        className="text-sm text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
