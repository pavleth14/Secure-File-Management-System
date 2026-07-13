import { formatSize, formatDate, toId } from '../utils/format';
import { isPreviewableFile } from '../utils/filePreview';
import { getFileExtension } from '../utils/uploadTypes';
import { StarIcon } from './icons';
import { useContextMenu } from '../hooks/useContextMenu';
import {
  buildFileContextMenuItems,
  buildFolderContextMenuItems,
} from '../utils/explorerContextMenu';

const SORTABLE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'extension', label: 'Extension' },
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
  folders = [],
  onOpenFolder,
  onDeleteFolder,
  canDeleteFolder = false,
  sortBy,
  sortDir,
  onSortChange,
  canDownload,
  canDelete,
  onDownload,
  onDelete,
  onPreview,
  emptyMessage = 'No files in this location',
  fileType = 'group',
  folderFavoriteType = 'folder',
  isFavorite,
  onToggleFavorite,
  embedded = false,
  showContextMenu = false,
  canRead = true,
  canRename = false,
  onRenameFolder,
  onRenameFile,
  onOpenFile,
}) {
  const { openContextMenu, contextMenuNode } = useContextMenu();
  // #region agent log
  if (files.length > 0) {
    fetch('http://127.0.0.1:7879/ingest/afe47dc1-7518-4b22-8821-40057cec5169',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a0e42e'},body:JSON.stringify({sessionId:'a0e42e',location:'FileTable.jsx:64',message:'FileTable render - isPreviewableFile check',data:{isDefined:typeof isPreviewableFile==='function',fileCount:files.length,samplePreviewable:typeof isPreviewableFile==='function'?isPreviewableFile(files[0]):null},timestamp:Date.now(),hypothesisId:'H1',runId:'post-fix'})}).catch(()=>{});
  }
  // #endregion
  const handleSort = (key) => {
    if (sortBy === key) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(key, 'asc');
    }
  };

  const colSpan = (onToggleFavorite ? 1 : 0) + SORTABLE_COLUMNS.length + 1;
  const isEmpty = folders.length === 0 && files.length === 0;

  const wrapperClass = embedded
    ? 'min-w-0'
    : 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <div className={wrapperClass}>
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-700/50">
          <tr>
            {onToggleFavorite && (
              <th className="w-10 px-2 py-3 text-center text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                ★
              </th>
            )}
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
          {folders.map((folder) => {
            const folderId = toId(folder._id);
            const folderFavorited = isFavorite?.(folderFavoriteType, folderId);
            const folderCanDelete =
              folder.canDelete !== undefined ? folder.canDelete : canDeleteFolder;
            return (
              <tr
                key={`folder-${folderId}`}
                className="text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                onContextMenu={
                  showContextMenu
                    ? (event) =>
                        openContextMenu(
                          event,
                          buildFolderContextMenuItems({
                            folder,
                            folderId,
                            folderCanDelete,
                            canRead,
                            canRename,
                            onOpenFolder,
                            onRenameFolder,
                            onDeleteFolder,
                          })
                        )
                    : undefined
                }
              >
                {onToggleFavorite && (
                  <td className="px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(folderFavoriteType, folderId)}
                      className={`rounded p-1 transition-colors ${
                        folderFavorited
                          ? 'text-amber-500 hover:text-amber-600'
                          : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
                      }`}
                      aria-label={
                        folderFavorited ? 'Remove folder from favorites' : 'Add folder to favorites'
                      }
                    >
                      <StarIcon filled={folderFavorited} className="text-base" />
                    </button>
                  </td>
                )}
                <td className="px-4 py-3 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => onOpenFolder?.(folderId)}
                    className="inline-flex items-center gap-2 text-left text-brand-600 hover:underline dark:text-brand-400"
                  >
                    <span aria-hidden>📁</span>
                    {folder.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">—</td>
                <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">—</td>
                <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">—</td>
                <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">—</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {folderCanDelete ? (
                    <button
                      type="button"
                      onClick={() => onDeleteFolder?.(folderId, folder.name)}
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  ) : folder.deletionBlockedReason ? (
                    <span
                      className="cursor-help text-sm text-slate-400 dark:text-slate-500"
                      title={folder.deletionBlockedReason}
                    >
                      Delete
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {isEmpty ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            files.map((file) => {
              const previewable = isPreviewableFile(file);
              const favorited = isFavorite?.(fileType, file._id);
              return (
                <tr
                  key={file._id}
                  className="text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                  onContextMenu={
                    showContextMenu
                      ? (event) =>
                          openContextMenu(
                            event,
                            buildFileContextMenuItems({
                              file,
                              canRead,
                              canRename,
                              canDownload,
                              canDelete,
                              onOpenFile,
                              onPreview,
                              onRenameFile,
                              onDownload,
                              onDelete,
                            })
                          )
                      : undefined
                  }
                >
                  {onToggleFavorite && (
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(fileType, file._id)}
                        className={`rounded p-1 transition-colors ${
                          favorited
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
                        }`}
                        aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <StarIcon filled={favorited} className="text-base" />
                      </button>
                    </td>
                  )}
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
                  <td className="px-4 py-3 text-sm uppercase text-slate-500 dark:text-slate-400">
                    {getFileExtension(file.originalName || file.name) || '—'}
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
      {contextMenuNode}
    </div>
  );
}
