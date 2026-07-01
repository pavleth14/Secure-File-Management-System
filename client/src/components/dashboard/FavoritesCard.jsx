import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatSize, formatDate, toId } from '../../utils/format';

const TABS = [
  { key: 'folders', label: 'Folders' },
  { key: 'files', label: 'Files' },
];

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

export default function FavoritesCard({
  favorites = [],
  previewLimit = null,
  onViewAll,
  embedded = false,
}) {
  const [activeTab, setActiveTab] = useState('folders');

  const folderFavorites = favorites.filter(
    (item) => item.kind === 'folder' || item.fileType === 'folder'
  );
  const fileFavorites = favorites.filter(
    (item) => item.kind === 'file' || (item.fileType !== 'folder' && item.kind !== 'folder')
  );

  const dataMap = {
    folders: folderFavorites,
    files: fileFavorites,
  };

  const items = dataMap[activeTab] || [];
  const previewItems = previewLimit ? items.slice(0, previewLimit) : items;
  const totalCount = favorites.length;
  const hasMore = previewLimit && items.length > previewLimit;

  const emptyMessage =
    activeTab === 'folders'
      ? 'No favorite folders yet'
      : 'No favorite files yet';

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
          {previewLimit && totalCount > 0 && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              View all
            </button>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {totalCount === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Star folders or files in group folders or My Files to see them here
        </p>
      ) : previewItems.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {previewItems.map((item) => (
            <li key={item.favoriteId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeTab === 'folders'
                    ? 'Group folder'
                    : `${item.fileType === 'personal' ? 'My Files' : 'Group folder'} · ${formatSize(item.size)}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(item.favoritedAt)}
                </p>
                <Link
                  to={
                    activeTab === 'folders' ? favoriteFolderLink(item) : favoriteFileLink(item)
                  }
                  className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!embedded && previewLimit && onViewAll && (hasMore || totalCount > previewLimit) && (
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
