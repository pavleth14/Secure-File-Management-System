import { DISPATCH_TIMEZONE } from '../config/dispatchConstants.js';

export function parseChicagoDateTime(dateStr, timeStr) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(timeStr || '').trim());

  if (!dateMatch || !timeMatch) {
    const err = new Error('Each stop requires a valid date (YYYY-MM-DD) and time (HH:mm)');
    err.status = 400;
    throw err;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  for (const offsetHours of [6, 5]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, hour + offsetHours, minute));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: DISPATCH_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(candidate);
    const mapped = Object.fromEntries(
      parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])
    );

    if (
      mapped.year === year &&
      mapped.month === month &&
      mapped.day === day &&
      mapped.hour === hour &&
      mapped.minute === minute
    ) {
      return candidate;
    }
  }

  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
}

export function formatChicagoDateTime(value) {
  if (!value) return { date: '', time: '' };
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPATCH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const mapped = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );

  return {
    date: `${mapped.year}-${mapped.month}-${mapped.day}`,
    time: `${mapped.hour}:${mapped.minute}`,
  };
}

export function formatChicagoDisplay(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DISPATCH_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
