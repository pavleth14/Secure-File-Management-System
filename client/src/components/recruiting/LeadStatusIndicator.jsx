import { DEFAULT_STATUS_COLOR } from '../../utils/leadStatusColors';

export default function LeadStatusIndicator({ statusName, statusColorMap = {} }) {
  if (!statusName) {
    return <span className="text-slate-400">—</span>;
  }

  const color = statusColorMap[statusName] || DEFAULT_STATUS_COLOR;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span>{statusName}</span>
    </span>
  );
}
