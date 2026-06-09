const COLORS = {
  read: 'bg-blue-100 text-blue-800',
  upload: 'bg-green-100 text-green-800',
  download: 'bg-purple-100 text-purple-800',
  edit: 'bg-orange-100 text-orange-800',
  delete: 'bg-red-100 text-red-800',
  move: 'bg-yellow-100 text-yellow-800',
  permissions: 'bg-indigo-100 text-indigo-800',
  users: 'bg-cyan-100 text-cyan-800',
  groups: 'bg-teal-100 text-teal-800',
  folders: 'bg-emerald-100 text-emerald-800',
  auth: 'bg-gray-100 text-gray-800',
  system: 'bg-slate-700 text-slate-100',
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
};

export default function CategoryBadge({ category }) {
  const key = category?.toLowerCase();
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${COLORS[key] || 'bg-slate-100 text-slate-700'}`}
    >
      {LABELS[key] || category}
    </span>
  );
}
