import { Link } from 'react-router-dom';
import { formatSize, formatDate, toId } from '../../utils/format';

function favoriteFileLink(item) {
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

function favoriteFolderLink(item) {
  const folderId = toId(item.fileId);
  if (item.isRoot) {
    return `/folders/${folderId}/files`;
  }
  const rootId = toId(item.rootFolderId);
  return `/folders/${rootId}/files?subfolder=${folderId}`;
}

function FavoriteList({ items, emptyMessage, renderMeta, linkFor }) {
  if (items.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
      {items.map((item) => (
        <li key={item.favoriteId} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {item.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{renderMeta(item)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(item.favoritedAt)}
            </p>
            <Link
              to={linkFor(item)}
              className="text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              Open
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function FavoritesCard({
  favorites = [],
  previewLimit = null,
  onViewAll,
  embedded = false,
}) {
  const folderFavorites = favorites.filter(
    (item) => item.kind === 'folder' || item.fileType === 'folder'
  );
  const fileFavorites = favorites.filter(
    (item) => item.kind === 'file' || (item.fileType !== 'folder' && item.kind !== 'folder')
  );

  const folderItems = previewLimit
    ? folderFavorites.slice(0, previewLimit)
    : folderFavorites;
  const fileItems = previewLimit ? fileFavorites.slice(0, previewLimit) : fileFavorites;

  const totalCount = favorites.length;
  const hasMore =
    previewLimit &&
    (folderFavorites.length > previewLimit || fileFavorites.length > previewLimit);

  return (
    <div
      className={
        embedded
          ? 'space-y-6'
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
              View all ({totalCount})
            </button>
          )}
        </div>
      )}

      {totalCount === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Star folders or files in group folders or My Files to see them here
        </p>
      ) : (
        <>
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Favorite Folders
            </h4>
            <FavoriteList
              items={folderItems}
              emptyMessage="No favorite folders yet"
              linkFor={favoriteFolderLink}
              renderMeta={() => 'Group folder'}
            />
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Favorite Files
            </h4>
            <FavoriteList
              items={fileItems}
              emptyMessage="No favorite files yet"
              linkFor={favoriteFileLink}
              renderMeta={(item) =>
                `${item.fileType === 'personal' ? 'My Files' : 'Group folder'} · ${formatSize(item.size)}`
              }
            />
          </section>
        </>
      )}

      {!embedded && hasMore && onViewAll && totalCount > 0 && (
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
