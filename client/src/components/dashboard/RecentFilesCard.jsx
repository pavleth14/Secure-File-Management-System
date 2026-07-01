import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatSize, formatDate } from '../../utils/format';

const TABS = [
  { key: 'recentAdded', label: 'Recently Added' },
  { key: 'recentDeleted', label: 'Recently Deleted' },
  { key: 'recentOpened', label: 'Recently Opened' },
];

function fileLink(item) {
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

export default function RecentFilesCard({
  recentAdded = [],
  recentDeleted = [],
  recentOpened = [],
  previewLimit = null,
  onViewAll,
  embedded = false,
}) {
  const [activeTab, setActiveTab] = useState('recentAdded');

  const dataMap = {
    recentAdded,
    recentDeleted,
    recentOpened,
  };

  const items = dataMap[activeTab] || [];
  const previewItems = previewLimit ? items.slice(0, previewLimit) : items;
  const totalCount = recentAdded.length + recentDeleted.length + recentOpened.length;
  const hasMore = previewLimit && items.length > previewLimit;

  return (
    <div
      className={
        embedded
          ? ''
          : 'relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden'
      }
    >
      {/* Gradient Accent Bar */}
      {!embedded && (
        <div className="absolute top-0 left-0 h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
      )}

      {!embedded && (
        <div className="mb-5 flex items-center justify-between pt-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Recent Files
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
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white shadow-sm text-slate-900 dark:bg-[#2563EB] dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {previewItems.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-700">
            {activeTab === 'recentAdded' && '📥'}
            {activeTab === 'recentDeleted' && '🗑️'}
            {activeTab === 'recentOpened' && '👀'}
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            No files in this list yet
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {previewItems.map((item, index) => {
            const dateValue = item.createdAt || item.timestamp;
            const key = `${item.fileType || 'group'}-${item.id || item.name}-${index}`;

            return (
              <li
                key={key}
                className="group flex items-center justify-between gap-4 rounded-2xl px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {item.fileType === 'personal' ? '📄' : '📁'}
                    </span>
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                    </p>
                  </div>

                  <p className="ml-9 text-xs text-slate-500 dark:text-slate-400">
                    {item.fileType === 'personal' ? 'My Files' : 'Group folder'}
                    {item.size ? ` • ${formatSize(item.size)}` : ''}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(dateValue)}
                  </p>
                  {activeTab !== 'recentDeleted' && (
                    <Link
                      to={fileLink(item)}
                      className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Open →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!embedded && previewLimit && onViewAll && (hasMore || totalCount > previewLimit) && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-6 w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium text-brand-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-brand-400 dark:hover:bg-slate-700/50"
        >
          View all recent files
        </button>
      )}
    </div>
  );
}