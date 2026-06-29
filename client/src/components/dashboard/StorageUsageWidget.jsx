import { formatSize } from '../../utils/format';

export default function StorageUsageWidget({ storage }) {
  if (!storage) return null;

  const { usedBytes, limitBytes, percentage } = storage;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Storage Usage
      </h3>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-slate-200 dark:text-slate-700"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="text-brand-600 transition-all duration-500 dark:text-brand-400"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {percentage}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">used</span>
          </div>
        </div>

        <div className="text-center sm:text-left">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Used: <span className="font-semibold">{formatSize(usedBytes)}</span> /{' '}
            {formatSize(limitBytes)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            My Files storage only
          </p>
        </div>
      </div>
    </div>
  );
}
