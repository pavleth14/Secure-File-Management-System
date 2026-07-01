/**
 * Vertical drag handle for resizable sidebars (VS Code / Explorer style).
 */
export default function SidebarResizeHandle({ onMouseDown, isResizing = false }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onMouseDown={onMouseDown}
      className={`relative z-10 w-1 shrink-0 cursor-col-resize touch-none select-none ${
        isResizing
          ? 'bg-brand-500'
          : 'bg-slate-200/80 hover:bg-brand-400/40 dark:bg-slate-700/80 dark:hover:bg-brand-500/40'
      }`}
    >
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" aria-hidden />
    </div>
  );
}
