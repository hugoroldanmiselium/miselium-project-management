// Pure helpers for the CRM module. Status (vencido/hoy/proximo/sin
// seguimiento) is never stored - it's derived here from next_followup_at vs
// "now", following the same string/UTC-safe date conventions established in
// recurringDates.ts and financeUtils.ts (avoid raw `new Date(dateStr)`
// local-tz pitfalls). next_followup_at is a timestamptz (has both date and
// time per spec section 1's "10:00 AM" example), so comparisons here work in
// real Date/epoch terms rather than plain 'YYYY-MM-DD' strings - that's safe
// specifically because timestamptz carries an absolute instant, unlike the
// date-only strings recurringDates.ts has to protect against.

import { todayDateStr } from './recurringDates';
import type { Contact } from '../types/database';

export type FollowupStatus = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'NONE';

export const FOLLOWUP_STATUS_LABEL: Record<FollowupStatus, string> = {
  OVERDUE: 'Vencido',
  TODAY: 'Hoy',
  UPCOMING: 'Proximo',
  NONE: 'Sin seguimiento',
};

export const FOLLOWUP_STATUS_EMOJI: Record<FollowupStatus, string> = {
  OVERDUE: '\u{1F534}', // red circle
  TODAY: '\u{1F7E1}', // yellow circle
  UPCOMING: '\u{1F7E2}', // green circle
  NONE: '\u{26AA}', // white circle
};

/** 'YYYY-MM-DD' local-date boundaries of "today", as epoch ms (UTC-based, matching recurringDates.ts). */
function todayBounds(today: string = todayDateStr()): { start: number; end: number } {
  const [year, month, day] = today.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const end = Date.UTC(year, month - 1, day + 1);
  return { start, end };
}

/**
 * Derives the followup status for a contact from next_followup_at (a
 * timestamptz ISO string, or null). "Vencido" = set and strictly before the
 * start of today; "Hoy" = falls within today's calendar day; "Proximo" =
 * strictly after today; "Sin seguimiento" = not set. Nothing here
 * auto-resolves anything - it's a pure read of next_followup_at, so
 * "vencido" persists exactly as long as the stored value stays in the past,
 * per spec ("permanecen visibles hasta que el usuario los reprograme o
 * registre el contacto").
 */
export function followupStatus(nextFollowupAt: string | null, today: string = todayDateStr()): FollowupStatus {
  if (!nextFollowupAt) return 'NONE';
  const ts = new Date(nextFollowupAt).getTime();
  if (Number.isNaN(ts)) return 'NONE';
  const { start, end } = todayBounds(today);
  if (ts < start) return 'OVERDUE';
  if (ts < end) return 'TODAY';
  return 'UPCOMING';
}

export function formatFollowup(nextFollowupAt: string | null): string {
  if (!nextFollowupAt) return 'Sin seguimiento';
  return new Date(nextFollowupAt).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatLastContact(lastContactDate: string | null): string {
  return lastContactDate ?? 'Nunca';
}

export function sumPotentialValue(contacts: Contact[]): number {
  return contacts.reduce((sum, c) => sum + Number(c.potential_value ?? 0), 0);
}

export function countByStatus(contacts: Contact[], status: FollowupStatus, today: string = todayDateStr()): number {
  return contacts.filter((c) => followupStatus(c.next_followup_at, today) === status).length;
}

/** Case-insensitive substring match against name/company/phone/whatsapp/email. */
export function matchesSearch(contact: Contact, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [contact.name, contact.company, contact.phone, contact.whatsapp, contact.email]
    .filter((v): v is string => !!v)
    .some((v) => v.toLowerCase().includes(q));
}

/** Converts a <input type="datetime-local"> value ('YYYY-MM-DDTHH:mm') to an ISO timestamptz string, or null. */
export function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Converts a stored timestamptz ISO string to a value for <input type="datetime-local">, or ''. */
export function isoToDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
