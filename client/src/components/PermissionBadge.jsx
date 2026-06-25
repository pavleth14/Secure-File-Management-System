const COLORS = {
  READ: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  UPLOAD: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  DOWNLOAD: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  EDIT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  MOVE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
};

export default function PermissionBadge({ permission }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${COLORS[permission] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}
    >
      {permission}
    </span>
  );
}
