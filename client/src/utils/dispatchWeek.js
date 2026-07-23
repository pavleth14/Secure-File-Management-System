export function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekStart, weekEnd) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(`${weekEnd}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export const LOAD_BAR_COLORS = {
  active: 'bg-green-500 text-white border-green-600',
  open: 'bg-yellow-400 text-slate-900 border-yellow-500',
  delivered: 'bg-slate-300/70 text-slate-600 border-slate-400 dark:bg-slate-600/50 dark:text-slate-300 dark:border-slate-500',
};
