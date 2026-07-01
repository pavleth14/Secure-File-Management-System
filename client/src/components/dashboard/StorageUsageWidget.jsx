import { formatSize } from '../../utils/format';

export default function StorageUsageWidget({ storage }) {
  if (!storage) return null;

  const { usedBytes, limitBytes, percentage } = storage;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
      {/* Gradient Accent Bar */}
      <div className="absolute top-0 left-0 h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

      <h3 className="mb-6 pt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Storage Usage
      </h3>

      <div className="flex min-h-[260px] flex-col items-center justify-center gap-8 sm:flex-row sm:items-center sm:justify-between">
        {/* Circular Progress - bolje centriran */}
        <div className="relative flex-shrink-0 h-40 w-40">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="11"
              className="text-slate-200 dark:text-slate-700"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="text-brand-600 transition-all duration-700 ease-out dark:text-brand-400"
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
              {percentage}%
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400 -mt-1">used</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <div className="mb-5">
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {formatSize(usedBytes)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              of {formatSize(limitBytes)}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            My Files storage only
          </div>
        </div>
      </div>
    </div>
  );
}