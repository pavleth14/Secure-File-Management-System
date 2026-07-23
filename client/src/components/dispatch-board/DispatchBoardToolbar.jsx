import { formatWeekLabel } from '../../utils/dispatchWeek';

export default function DispatchBoardToolbar({
  boardName,
  weekStart,
  weekEnd,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onNewLoad,
  canCreateLoads,
  loading,
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{boardName}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {formatWeekLabel(weekStart, weekEnd)}
          {weekStart && weekEnd ? ' · Chicago time' : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrevWeek}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Prev week
        </button>
        <button
          type="button"
          onClick={onThisWeek}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          This week
        </button>
        <button
          type="button"
          onClick={onNextWeek}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Next week
        </button>
        {canCreateLoads && (
          <button
            type="button"
            onClick={onNewLoad}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New Load
          </button>
        )}
      </div>
    </div>
  );
}
