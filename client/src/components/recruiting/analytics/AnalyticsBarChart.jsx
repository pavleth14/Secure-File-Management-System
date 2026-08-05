export default function AnalyticsBarChart({
  title,
  items,
  labelKey = 'label',
  valueKey = 'count',
  emptyMessage = 'No data for this period.',
}) {
  const maxValue = Math.max(...items.map((item) => item[valueKey] || 0), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const value = item[valueKey] || 0;
            const width = `${Math.max((value / maxValue) * 100, value > 0 ? 4 : 0)}%`;
            return (
              <li key={item[labelKey]}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    {item[labelKey]}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-brand-600 transition-all"
                    style={{ width }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
