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
  if (item.fileType === 'personal_folder' || item.isPersonal) {
    const folderId = toId(item.fileId);
    return folderId ? `/my-files?folder=${folderId}` : '/my-files';
  }
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
    (item) =>
      item.kind === 'folder' ||
      item.fileType === 'folder' ||
      item.fileType === 'personal_folder'
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

  return (
    <div
      className={
        embedded
          ? ''
          : 'relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden'
      }
    >
      {/* Gradient Accent Bar - kao na dashboard karticama */}
      {!embedded && (
        <div className="absolute top-0 left-0 h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
      )}

      {!embedded && (
        <div className="mb-5 flex items-center justify-between pt-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Favorites
          </h3>
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

      {/* Modern Tabs */}
      <div className="mb-5 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white shadow-sm text-slate-900 dark:bg-[#2563EB] dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {totalCount === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-700">
            ⭐
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Star folders or files in group folders or My Files to see them here
          </p>
        </div>
      ) : previewItems.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No favorite {activeTab} yet
        </p>
      ) : (
        <ul className="space-y-1">
          {previewItems.map((item) => (
            <li
              key={item.favoriteId}
              className="group flex items-center justify-between gap-4 rounded-2xl px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {activeTab === 'folders' ? '📁' : '📄'}
                  </span>
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {item.name}
                  </p>
                </div>

                <p className="ml-9 text-xs text-slate-500 dark:text-slate-400">
                  {activeTab === 'folders'
                    ? item.fileType === 'personal_folder' || item.isPersonal
                      ? 'My Files folder'
                      : 'Group folder'
                    : `${item.fileType === 'personal' ? 'My Files' : 'Group folder'} • ${formatSize(item.size)}`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(item.favoritedAt)}
                </p>
                <Link
                  to={
                    activeTab === 'folders'
                      ? favoriteFolderLink(item)
                      : favoriteFileLink(item)
                  }
                  className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Open →
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
          className="mt-6 w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium text-brand-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-brand-400 dark:hover:bg-slate-700/50"
        >
          View all favorites
        </button>
      )}
    </div>
  );
}