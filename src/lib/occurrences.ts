// Merges a recurring_tasks config list with any persisted
// recurring_task_occurrences rows into a flat list of "occurrence view
// models" for a date range - one entry per (recurring_task, date) pair that
// the config says should occur, with the persisted status overlaid when a
// row exists (PENDING is the implicit default otherwise). See
// 010_recurring_tasks.sql for the full duplicate-avoidance writeup.

import { occurrenceDatesInWeek, weekDates } from './recurringDates';
import type { OccurrenceStatus, RecurringTask, RecurringTaskOccurrence } from '../types/database';

export interface OccurrenceView {
  recurringTask: RecurringTask;
  date: string;
  status: OccurrenceStatus;
  occurrenceRow: RecurringTaskOccurrence | null;
}

/** Builds occurrence view models for every day of the Mon-Sun week starting at `weekStart`. */
export function buildWeekOccurrences(
  recurringTasks: RecurringTask[],
  occurrenceRows: RecurringTaskOccurrence[],
  weekStart: string
): OccurrenceView[] {
  const rowsByKey = new Map(occurrenceRows.map((o) => [`${o.recurring_task_id}|${o.occurrence_date}`, o]));
  const out: OccurrenceView[] = [];
  for (const rt of recurringTasks) {
    for (const date of occurrenceDatesInWeek(weekStart, rt)) {
      const row = rowsByKey.get(`${rt.id}|${date}`) ?? null;
      out.push({ recurringTask: rt, date, status: row?.status ?? 'PENDING', occurrenceRow: row });
    }
  }
  return out;
}

/** Convenience: occurrences for a single date within a week's view models. */
export function occurrencesForDate(views: OccurrenceView[], date: string): OccurrenceView[] {
  return views.filter((v) => v.date === date);
}

export { weekDates };
