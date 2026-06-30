/**
 * File-explorer style breadcrumb with back navigation.
 * Segments: [{ id: string|null, label: string }] — last segment is current (non-clickable).
 */
export default function FileExplorerBreadcrumb({
  segments = [],
  onNavigate,
  onBack,
  backLabel = 'Back',
}) {
  const current = segments[segments.length - 1];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
      >
        <span aria-hidden>←</span>
        {backLabel}
      </button>

      <nav
        aria-label="Folder path"
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-slate-500 dark:text-slate-400"
      >
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <span key={`${segment.id ?? 'root'}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
              {isLast ? (
                <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                  {segment.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(segment.id)}
                  className="truncate hover:text-brand-600 hover:underline dark:hover:text-brand-400"
                >
                  {segment.label}
                </button>
              )}
            </span>
          );
        })}

        {!current && segments.length === 0 && (
          <span className="font-semibold text-slate-900 dark:text-slate-100">Root</span>
        )}
      </nav>
    </div>
  );
}
