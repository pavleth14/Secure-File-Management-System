export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function getDatePresetRange(preset) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (preset === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  if (preset === '30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  if (preset === '90d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 89);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  return { from: '', to: '' };
}
