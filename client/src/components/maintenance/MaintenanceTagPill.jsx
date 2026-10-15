export default function MaintenanceTagPill({ label, color, empty = '—' }) {
  if (!label) {
    return <span className="text-slate-400">{empty}</span>;
  }

  return (
    <span
      className="inline-block max-w-[10rem] truncate rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white"
      style={{ backgroundColor: color || '#64748B' }}
      title={label}
    >
      {label}
    </span>
  );
}
