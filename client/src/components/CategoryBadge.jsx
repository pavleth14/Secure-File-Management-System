const COLORS = {
  read: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  upload: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  download: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  edit: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  move: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  permissions: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  users: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  groups: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  folders: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  auth: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  system: 'bg-slate-700 text-slate-100 dark:bg-slate-600 dark:text-slate-100',
  recruiting: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  dispatch: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300',
};

const LABELS = {
  read: 'Read',
  upload: 'Upload',
  download: 'Download',
  edit: 'Edit',
  delete: 'Delete',
  move: 'Move',
  permissions: 'Permissions',
  users: 'Users',
  groups: 'Groups',
  folders: 'Folders',
  auth: 'Auth',
  system: 'System',
  recruiting: 'Recruiting',
  dispatch: 'Dispatch & Safety',
};

export default function CategoryBadge({ category }) {
  const key = category?.toLowerCase();
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${COLORS[key] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}
    >
      {LABELS[key] || category}
    </span>
  );
}
