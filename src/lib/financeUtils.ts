// Pure date/aggregation helpers for the Finanzas module. Mirrors the
// string-safe date arithmetic conventions established in recurringDates.ts
// (never `new Date(dateStr)` on a DB date - everything works on plain
// 'YYYY-MM-DD' strings + integer year/month/day math to avoid local-tz
// off-by-one-day bugs).

import { addDays, parseDateStr, toDateStr, todayDateStr, compareDateStr, startOfWeek } from './recurringDates';
import type { Expense, Income } from '../types/database';

export type FinancePeriodKey = 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom';

export const FINANCE_PERIOD_LABELS: Record<FinancePeriodKey, string> = {
  week: 'Esta semana',
  month: 'Este mes',
  last_month: 'Mes anterior',
  quarter: 'Este trimestre',
  year: 'Este año',
  custom: 'Personalizado',
};

export interface DateRange {
  start: string;
  end: string;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-12; day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function startOfMonth(dateStr: string): string {
  const { year, month } = parseDateStr(dateStr);
  return toDateStr(year, month, 1);
}

export function endOfMonth(dateStr: string): string {
  const { year, month } = parseDateStr(dateStr);
  return toDateStr(year, month, daysInMonth(year, month));
}

function shiftMonths(dateStr: string, months: number): string {
  const { year, month, day } = parseDateStr(dateStr);
  const total = (year * 12 + (month - 1)) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(newYear, newMonth));
  return toDateStr(newYear, newMonth, clampedDay);
}

export function startOfQuarter(dateStr: string): string {
  const { year, month } = parseDateStr(dateStr);
  const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return toDateStr(year, qStartMonth, 1);
}

export function endOfQuarter(dateStr: string): string {
  const start = startOfQuarter(dateStr);
  return endOfMonth(shiftMonths(start, 2));
}

export function startOfYear(dateStr: string): string {
  const { year } = parseDateStr(dateStr);
  return toDateStr(year, 1, 1);
}

export function endOfYear(dateStr: string): string {
  const { year } = parseDateStr(dateStr);
  return toDateStr(year, 12, 31);
}

export function rangeForPeriod(period: FinancePeriodKey, custom?: DateRange, today: string = todayDateStr()): DateRange {
  switch (period) {
    case 'week': {
      const start = startOfWeek(today);
      return { start, end: addDays(start, 6) };
    }
    case 'month':
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'last_month': {
      const prevMonthDate = shiftMonths(today, -1);
      return { start: startOfMonth(prevMonthDate), end: endOfMonth(prevMonthDate) };
    }
    case 'quarter':
      return { start: startOfQuarter(today), end: endOfQuarter(today) };
    case 'year':
      return { start: startOfYear(today), end: endOfYear(today) };
    case 'custom':
      return custom ?? { start: startOfMonth(today), end: endOfMonth(today) };
    default:
      return { start: startOfMonth(today), end: endOfMonth(today) };
  }
}

export function inRange(dateStr: string, range: DateRange): boolean {
  return compareDateStr(dateStr, range.start) >= 0 && compareDateStr(dateStr, range.end) <= 0;
}

/** Whole days between `fromDate` and `toDate` (toDate - fromDate), can be negative. */
export function daysBetween(fromDate: string, toDate: string): number {
  const a = parseDateStr(fromDate);
  const b = parseDateStr(toDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / msPerDay);
}

/** "Dias pendientes" for a receivable/payable row: today - due_date (positive = overdue). */
export function daysPending(dueDate: string | null, today: string = todayDateStr()): number | null {
  if (!dueDate) return null;
  return daysBetween(dueDate, today);
}

export function isOverdueDate(dueDate: string | null, today: string = todayDateStr()): boolean {
  if (!dueDate) return false;
  return compareDateStr(dueDate, today) < 0;
}

// ===== Aggregation helpers =====

export function sumTotals(rows: { total: number }[]): number {
  return rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
}

export function formatMXN(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
}

/** Groups expenses by category id, returning total + % of the group's total. */
export function groupExpensesByCategory(
  expenses: Expense[],
  categoryNameById: Map<string, string>
): { categoryId: string; name: string; total: number; percent: number }[] {
  const totals = new Map<string, number>();
  expenses.forEach((e) => {
    const key = e.category_id ?? 'sin-categoria';
    totals.set(key, (totals.get(key) ?? 0) + Number(e.total));
  });
  const grandTotal = expenses.reduce((sum, e) => sum + Number(e.total), 0);
  return Array.from(totals.entries())
    .map(([categoryId, total]) => ({
      categoryId,
      name: categoryId === 'sin-categoria' ? 'Sin categoria' : categoryNameById.get(categoryId) ?? 'Sin categoria',
      total,
      percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Monthly buckets ('YYYY-MM') of totals for a date-keyed list, for simple bar comparisons. */
export function monthlyTotals(rows: { date: string; total: number }[], monthCount = 6, today: string = todayDateStr()): { month: string; total: number }[] {
  const { year, month } = parseDateStr(today);
  const buckets: { month: string; total: number }[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const total = (year * 12 + (month - 1)) - i;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    buckets.push({ month: `${y}-${String(m).padStart(2, '0')}`, total: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.month, i]));
  rows.forEach((r) => {
    const key = r.date.slice(0, 7);
    const i = index.get(key);
    if (i !== undefined) buckets[i].total += Number(r.total);
  });
  return buckets;
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

/**
 * Simple month-end projection (deliberately not a statistical/ML model, per
 * spec section 8): projected income = already-collected income this month +
 * pending income due within this month; projected expense = already-paid
 * expense this month + pending expense due within this month. Burn rate
 * (avg monthly paid-expense total over the last 3 full prior months) is
 * returned alongside as context, not folded into the projection itself -
 * showing both lets the user sanity-check the projection against recent
 * history rather than hiding one behind the other.
 */
export function projectMonthClose(
  incomes: Income[],
  expenses: Expense[],
  monthRange: DateRange
): { projectedIncome: number; projectedExpense: number; projectedProfit: number; burnRate: number } {
  const incomeInMonth = incomes.filter((i) => inRange(i.date, monthRange) || (i.due_date && inRange(i.due_date, monthRange)));
  const expenseInMonth = expenses.filter((e) => inRange(e.date, monthRange) || (e.due_date && inRange(e.due_date, monthRange)));

  const projectedIncome = incomeInMonth.reduce((sum, i) => {
    if (i.status === 'COBRADO') return sum + Number(i.total);
    return sum + Number(i.total); // pending, due this month - counted as expected
  }, 0);
  const projectedExpense = expenseInMonth.reduce((sum, e) => sum + Number(e.total), 0);

  // Burn rate: average of total paid expenses over the 3 calendar months
  // strictly before the projected month.
  const monthStart = monthRange.start;
  const prior = [1, 2, 3].map((n) => {
    const d = parseDateStr(monthStart);
    const total = d.year * 12 + (d.month - 1) - n;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    return { start: toDateStr(y, m, 1), end: endOfMonth(toDateStr(y, m, 1)) };
  });
  const burnTotals = prior.map((range) =>
    expenses.filter((e) => e.status === 'PAGADO' && inRange(e.paid_date ?? e.date, range)).reduce((sum, e) => sum + Number(e.total), 0)
  );
  const burnRate = burnTotals.reduce((sum, t) => sum + t, 0) / burnTotals.length;

  return {
    projectedIncome,
    projectedExpense,
    projectedProfit: projectedIncome - projectedExpense,
    burnRate,
  };
}
