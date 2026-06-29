import { Link } from 'react-router-dom';
import { formatSize, formatDate } from '../../utils/format';

function favoriteLink(item) {
  if (item.fileType === 'personal') {
    return '/my-files';
  }
  if (item.folderId) {
    const folderId = item.folderId._id || item.folderId;
    const subfolderId = item.subfolderId?._id || item.subfolderId;
    return subfolderId
      ? `/folders/${folderId}/files?subfolder=${subfolderId}`
      : `/folders/${folderId}/files`;
  }
  return '/folders';
}

export default function FavoritesCard({
  favorites = [],
  previewLimit = null,
  onViewAll,
  embedded = false,
}) {
  const items = previewLimit ? favorites.slice(0, previewLimit) : favorites;
  const hasMore = previewLimit && favorites.length > previewLimit;

  return (
    <div
      className={
        embedded
          ? ''
          : 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800'
      }
    >
      {!embedded && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Favorites</h3>
          {hasMore && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              View all ({favorites.length})
            </button>
          )}
        </div>
      )}

      {favorites.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Star files in group folders or My Files to see them here
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {items.map((item) => (
            <li key={item.favoriteId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.fileType === 'personal' ? 'My Files' : 'Group folder'} ·{' '}
                  {formatSize(item.size)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(item.favoritedAt)}
                </p>
                <Link
                  to={favoriteLink(item)}
                  className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!embedded && hasMore && onViewAll && items.length > 0 && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:border-slate-600 dark:text-brand-400 dark:hover:bg-slate-700/50"
        >
          View all favorites
        </button>
      )}
    </div>
  );
}
