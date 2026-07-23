import DispatchLoadBar from './DispatchLoadBar';

const LABEL_WIDTH = '18rem';

export default function DispatchBoardGrid({ days, rows, onLoadClick, onLoadContextMenu }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="min-w-[960px]">
        <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/50">
          <div
            className="shrink-0 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            style={{ width: LABEL_WIDTH }}
          >
            Truck / Trailer / Driver / Dispatcher
          </div>
          <div className="grid flex-1 grid-cols-7">
            {days.map((day) => (
              <div
                key={day.dateKey}
                className={`border-l border-slate-200 px-2 py-3 text-center text-xs font-semibold uppercase dark:border-slate-700 ${
                  day.isToday
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : day.isThursday
                      ? 'bg-slate-100 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200'
                      : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {day.label}
              </div>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No trucks assigned to this board yet.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.truckId}
              className="flex border-b border-slate-200 last:border-b-0 dark:border-slate-700"
            >
              <div
                className="shrink-0 px-4 py-4 text-sm text-slate-900 dark:text-slate-100"
                style={{ width: LABEL_WIDTH }}
              >
                <div className="font-semibold">{row.truckNumber}</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {row.trailerNumber} · {row.driverLabel}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.dispatcherName}</div>
              </div>

              <div className="relative min-h-[72px] flex-1">
                <div className="absolute inset-0 grid grid-cols-7">
                  {days.map((day) => (
                    <div
                      key={`${row.truckId}-${day.dateKey}`}
                      className={`border-l border-slate-200 dark:border-slate-700 ${
                        day.isToday ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''
                      }`}
                    />
                  ))}
                </div>

                <div className="relative h-full min-h-[72px]">
                  {row.loads.map((load) => (
                    <DispatchLoadBar
                      key={load.id}
                      load={load}
                      onClick={onLoadClick}
                      onContextMenu={onLoadContextMenu}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
