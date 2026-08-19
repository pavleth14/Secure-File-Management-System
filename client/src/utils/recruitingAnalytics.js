const CHICAGO_TIMEZONE = 'America/Chicago';

function getChicagoDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
}

function formatChicagoDateString(year, month, day) {
  return `${year}-${month}-${day}`;
}

export function getTodayChicagoDateString() {
  const { year, month, day } = getChicagoDateParts();
  return formatChicagoDateString(year, month, day);
}

export function addChicagoDays(dateStr, deltaDays) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(utc);
  const mapped = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  return formatChicagoDateString(mapped.year, mapped.month, mapped.day);
}

export function getDatePresetRange(preset) {
  const today = getTodayChicagoDateString();
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yesterday = addChicagoDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case '7': {
      const from = addChicagoDays(today, -6);
      return { from, to: today };
    }
    case '30': {
      const from = addChicagoDays(today, -29);
      return { from, to: today };
    }
    default:
      return { from: today, to: today };
  }
}

export function formatChicagoSavedAt(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const mapped = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  return `${mapped.month}/${mapped.day}/${mapped.year} at ${mapped.hour}:${mapped.minute} ${mapped.dayPeriod}`;
}

export function formatDurationMs(ms) {
  if (ms == null || ms < 0) return '—';
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatPeriodLabel(from, to) {
  if (!from || !to) return '';
  if (from === to) return from;
  return `${from} – ${to}`;
}
