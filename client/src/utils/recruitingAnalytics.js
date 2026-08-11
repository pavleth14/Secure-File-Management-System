export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function formatDurationMs(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';

  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes ? `${totalHours}h ${remMinutes}m` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

export function getDatePresetRange(preset) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  if (preset === 'yesterday') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(start);
    yesterdayEnd.setHours(23, 59, 59, 999);
    return {
      from: start.toISOString().slice(0, 10),
      to: yesterdayEnd.toISOString().slice(0, 10),
    };
  }

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
