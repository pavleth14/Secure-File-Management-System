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

export default function RecentFilesCard({ recentAdded = [], recentDeleted = [], recentOpened = [] }) {
  const [activeTab, setActiveTab] = useState('recentAdded');

  const dataMap = {
    recentAdded,
    recentDeleted,
    recentOpened,
  };

  const items = dataMap[activeTab] || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Recent Files
      </h3>

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

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No files in this list yet
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {items.map((item, index) => {
            const dateValue = item.createdAt || item.timestamp;
            const key = `${item.fileType || 'group'}-${item.id || item.name}-${index}`;

            return (
              <li key={key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {item.fileType === 'personal' ? 'My Files' : 'Group folder'}
                    {item.size ? ` · ${formatSize(item.size)}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(dateValue)}
                  </p>
                  {activeTab !== 'recentDeleted' && (
                    <Link
                      to={fileLink(item)}
                      className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Open
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
