const COLORS = {
  READ: 'bg-blue-100 text-blue-800',
  UPLOAD: 'bg-green-100 text-green-800',
  DOWNLOAD: 'bg-purple-100 text-purple-800',
  EDIT: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-red-100 text-red-800',
  MOVE: 'bg-indigo-100 text-indigo-800',
};

export default function PermissionBadge({ permission }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${COLORS[permission] || 'bg-slate-100 text-slate-700'}`}
    >
      {permission}
    </span>
  );
}
