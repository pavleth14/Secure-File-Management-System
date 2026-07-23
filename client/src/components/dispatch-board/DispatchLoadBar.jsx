import { LOAD_BAR_COLORS } from '../../utils/dispatchWeek';

export default function DispatchLoadBar({ load, onClick, onContextMenu }) {
  const colorClass = LOAD_BAR_COLORS[load.color] || LOAD_BAR_COLORS.open;

  return (
    <button
      type="button"
      title={`Load #${load.loadNumber} · ${load.label}`}
      onClick={(event) => onClick?.(event, load)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.(event, load);
      }}
      className={`absolute top-1/2 z-10 flex h-8 min-w-0 -translate-y-1/2 items-center justify-center overflow-hidden rounded-md border px-2 text-xs font-medium shadow-sm transition hover:brightness-95 ${colorClass}`}
      style={{
        left: `${load.leftPct}%`,
        width: `${load.widthPct}%`,
      }}
    >
      <span className="truncate">{load.label}</span>
    </button>
  );
}
