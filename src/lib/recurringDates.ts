// Pure calendar-date arithmetic for weekly recurring tasks. Deliberately does
// NOT use `new Date(dateString)` for any date that came from/goes to the DB
// (that parses as UTC midnight and can shift a day depending on the local
// timezone when later formatted) - everything here works on plain
// 'YYYY-MM-DD' strings and integer year/month/day math, matching how
// due_date/start_date/etc. are already stored and compared elsewhere in this
// app (e.g. Badge.tsx's isOverdue, which does the same string-safe pattern).
//
// Week boundary: Monday-Sunday (ISO week) - see the header comment in
// 010_recurring_tasks.sql for why.

import type { Weekday } from '../types/database';

export const WEEKDAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: 'Lunes',
  TUE: 'Martes',
  WED: 'Miercoles',
  THU: 'Jueves',
  FRI: 'Viernes',
  SAT: 'Sabado',
  SUN: 'Domingo',
};

/** 'YYYY-MM-DD' for today, in the browser's local calendar date (not UTC). */
export function todayDateStr(): string {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function toDateStr(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/** Parses a 'YYYY-MM-DD' string into {year, month, day} without any timezone conversion. */
export function parseDateStr(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

/** ISO weekday code for a 'YYYY-MM-DD' string, computed via UTC (no local-tz drift). */
export function weekdayOf(dateStr: string): Weekday {
  const { year, month, day } = parseDateStr(dateStr);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[jsDay === 0 ? 6 : jsDay - 1];
}

/** Adds `days` (can be negative) to a 'YYYY-MM-DD' string, returning a new 'YYYY-MM-DD' string. */
export function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateStr(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function compareDateStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Monday of the ISO week containing `dateStr` (defaults to today). */
export function startOfWeek(dateStr: string = todayDateStr()): string {
  const wd = weekdayOf(dateStr);
  const offset = WEEKDAYS.indexOf(wd); // MON=0 ... SUN=6
  return addDays(dateStr, -offset);
}

/** The 7 dates (Mon..Sun) of the week starting at `weekStart` (a Monday). */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Which dates within `weekStart`'s Mon-Sun week a recurring task would
 * occur on, given its weekday/start_date/end_date/active config. Returns at
 * most one date (a recurring task only fires once per week on its weekday),
 * but as an array to keep call sites uniform and forward-compatible.
 */
export function occurrenceDatesInWeek(
  weekStart: string,
  config: { weekday: Weekday; start_date: string; end_date: string | null; active: boolean }
): string[] {
  if (!config.active) return [];
  const idx = WEEKDAYS.indexOf(config.weekday);
  const candidate = addDays(weekStart, idx);
  if (compareDateStr(candidate, config.start_date) < 0) return [];
  if (config.end_date && compareDateStr(candidate, config.end_date) > 0) return [];
  return [candidate];
}

/**
 * The next date on/after `fromDate` that a recurring task would occur on,
 * respecting active/start_date/end_date. Returns null if paused or if
 * end_date has already passed relative to every future occurrence.
 */
export function nextOccurrenceDate(
  config: { weekday: Weekday; start_date: string; end_date: string | null; active: boolean },
  fromDate: string = todayDateStr()
): string | null {
  if (!config.active) return null;
  const base = compareDateStr(fromDate, config.start_date) < 0 ? config.start_date : fromDate;
  const targetIdx = WEEKDAYS.indexOf(config.weekday);
  const baseIdx = WEEKDAYS.indexOf(weekdayOf(base));
  const diff = (targetIdx - baseIdx + 7) % 7;
  const candidate = addDays(base, diff);
  if (config.end_date && compareDateStr(candidate, config.end_date) > 0) return null;
  return candidate;
}

/** Formats a 'YYYY-MM-DD' string as e.g. "6 sep" for compact display. */
export function formatShortDate(dateStr: string): string {
  const { year, month, day } = parseDateStr(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
