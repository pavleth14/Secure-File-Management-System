import { DISPATCH_TIMEZONE } from '../config/dispatchConstants.js';
import { parseChicagoDateTime } from './chicagoTime.js';

function getChicagoParts(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPATCH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(value);

  const mapped = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );

  return {
    year: Number(mapped.year),
    month: Number(mapped.month),
    day: Number(mapped.day),
    weekday: mapped.weekday,
    dateKey: `${mapped.year}-${mapped.month}-${mapped.day}`,
  };
}

function dateKeyToUtcMs(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  return parseChicagoDateTime(dateKey, '12:00').getTime();
}

export function parseDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
  if (!match) {
    const err = new Error('Invalid week start date. Use YYYY-MM-DD.');
    err.status = 400;
    throw err;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getChicagoTodayKey() {
  return getChicagoParts(new Date()).dateKey;
}

export function getMondayOfChicagoWeek(referenceDate = new Date()) {
  const todayKey = getChicagoParts(referenceDate).dateKey;
  const noonMs = dateKeyToUtcMs(todayKey);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPATCH_TIMEZONE,
    weekday: 'short',
  }).format(new Date(noonMs));

  const weekdayIndex = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }[weekday];

  const daysFromMonday = (weekdayIndex + 6) % 7;
  const mondayMs = noonMs - daysFromMonday * 24 * 60 * 60 * 1000;
  return getChicagoParts(new Date(mondayMs)).dateKey;
}

export function addDaysToDateKey(dateKey, days) {
  const ms = dateKeyToUtcMs(dateKey) + days * 24 * 60 * 60 * 1000;
  return getChicagoParts(new Date(ms)).dateKey;
}

export function buildWeekDays(weekStartMonday) {
  const todayKey = getChicagoTodayKey();
  const days = [];

  for (let index = 0; index < 7; index += 1) {
    const dateKey = addDaysToDateKey(weekStartMonday, index);
    const { month, day } = parseDateKey(dateKey);
    days.push({
      index,
      dateKey,
      label: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
      isToday: dateKey === todayKey,
      isThursday: index === 3,
    });
  }

  return days;
}

export function resolveWeekStart(weekStartParam) {
  if (!weekStartParam) {
    return getMondayOfChicagoWeek(new Date());
  }

  const dateKey = String(weekStartParam).trim();
  parseDateKey(dateKey);
  return getMondayOfChicagoWeek(new Date(dateKeyToUtcMs(dateKey)));
}

export function getChicagoDateKeyFromDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return getChicagoParts(date).dateKey;
}

export function getLoadDateRange(load) {
  const stops = [...(load.pickups || []), ...(load.deliveries || [])]
    .map((stop) => new Date(stop.scheduledAt))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (!stops.length) {
    return { start: null, end: null, startKey: null, endKey: null };
  }

  const start = new Date(Math.min(...stops.map((date) => date.getTime())));
  const end = new Date(Math.max(...stops.map((date) => date.getTime())));

  return {
    start,
    end,
    startKey: getChicagoDateKeyFromDate(start),
    endKey: getChicagoDateKeyFromDate(end),
  };
}

export function getLoadBarColor(load) {
  if (load.status === 'delivered') return 'delivered';
  if (load.isActive) return 'active';
  return 'open';
}

export function buildHandoffDaySet(loads) {
  const handoffDays = new Set();

  for (let i = 0; i < loads.length; i += 1) {
    for (let j = 0; j < loads.length; j += 1) {
      if (i === j) continue;
      const rangeA = getLoadDateRange(loads[i]);
      const rangeB = getLoadDateRange(loads[j]);
      if (rangeA.endKey && rangeB.startKey && rangeA.endKey === rangeB.startKey) {
        handoffDays.add(rangeA.endKey);
      }
    }
  }

  return handoffDays;
}

export function computeLoadBarPosition(load, weekDays, handoffDays, allLoads) {
  const range = getLoadDateRange(load);
  if (!range.startKey || !range.endKey) return null;

  const weekStartKey = weekDays[0].dateKey;
  const weekEndKey = weekDays[6].dateKey;

  if (range.endKey < weekStartKey || range.startKey > weekEndKey) {
    return null;
  }

  let startCol = weekDays.findIndex((day) => day.dateKey === range.startKey);
  let endCol = weekDays.findIndex((day) => day.dateKey === range.endKey);
  let startOffset = 0;
  let endOffset = 1;

  if (startCol === -1) startCol = 0;
  else if (handoffDays.has(range.startKey) && hasLoadEndingOnDay(allLoads, load._id, range.startKey)) {
    startOffset = 0.5;
  }

  if (endCol === -1) endCol = 6;
  else if (handoffDays.has(range.endKey) && hasLoadStartingOnDay(allLoads, load._id, range.endKey)) {
    endOffset = 0.5;
  }

  const leftPct = ((startCol + startOffset) / 7) * 100;
  const widthPct = ((endCol + endOffset - (startCol + startOffset)) / 7) * 100;

  if (widthPct <= 0) return null;

  return { leftPct, widthPct };
}

function hasLoadStartingOnDay(loads, loadId, dayKey) {
  return loads.some((load) => {
    if (load._id.toString() === loadId.toString()) return false;
    return getLoadDateRange(load).startKey === dayKey;
  });
}

function hasLoadEndingOnDay(loads, loadId, dayKey) {
  return loads.some((load) => {
    if (load._id.toString() === loadId.toString()) return false;
    return getLoadDateRange(load).endKey === dayKey;
  });
}

export function loadOverlapsWeek(load, weekDays) {
  const range = getLoadDateRange(load);
  if (!range.startKey || !range.endKey) return false;
  return !(range.endKey < weekDays[0].dateKey || range.startKey > weekDays[6].dateKey);
}
